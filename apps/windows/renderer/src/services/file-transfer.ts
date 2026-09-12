import {
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getBlob
} from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { getLocalDeviceId, getLocalDeviceName } from './device';
import type { FileTransferRecord } from '@comiclink/shared-types';
import { MAX_FILE_SIZE } from '@comiclink/shared-types';
import { ERROR_CODES, createAppError } from '@comiclink/error-codes';

/**
 * Computes the SHA-256 hex checksum of a File or Blob using the Web Crypto API.
 */
export async function computeFileChecksum(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const digestBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sanitizes a file name to prevent path traversal and illegal filesystem characters.
 */
export function sanitizeFileName(name: string): string {
  // Strip path traversal and illegal characters
  const clean = name
    .trim()
    .replace(/[/\\]/g, '_')
    .replace(/[?%*:|"<>]/g, '')
    .replace(/\.\.+/g, '.');
  return clean || 'unnamed_payload.dat';
}

/**
 * Human-readable format for byte sizes.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface InitiateTransferParams {
  file: File;
  targetDeviceId: string;
  targetDeviceName: string;
  recipientId: string;
  onProgress?: (progressPercent: number, bytesTransferred: number, totalBytes: number) => void;
}

/**
 * Initiates an inter-station file transfer:
 * 1. Validates size and calculates SHA-256 checksum.
 * 2. Writes the Firestore metadata document in 'pending' status.
 * 3. Uploads the file blob to Firebase Storage.
 * 4. Updates Firestore status to 'ready' upon successful upload.
 */
export async function initiateFileTransfer({
  file,
  targetDeviceId,
  targetDeviceName,
  recipientId,
  onProgress
}: InitiateTransferParams): Promise<FileTransferRecord> {
  if (!db || !auth || !auth.currentUser || !storage) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Authentication and storage configuration required.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw createAppError(
      ERROR_CODES.FILE.TOO_LARGE,
      `Payload exceeds maximum size limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB.`
    );
  }

  const senderId = auth.currentUser.uid;
  const sourceDeviceId = getLocalDeviceId();
  const sourceDeviceName = getLocalDeviceName();
  const sanitizedName = sanitizeFileName(file.name);
  const fileId = crypto.randomUUID();

  // Compute SHA-256 cryptographic digest
  const checksum = await computeFileChecksum(file);

  const storagePath = `transfers/${senderId}/${recipientId}/${fileId}/${sanitizedName}`;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000); // 24hr TTL

  const transferRecord: FileTransferRecord = {
    fileId,
    senderId,
    recipientId,
    sourceDeviceId,
    sourceDeviceName,
    targetDeviceId,
    targetDeviceName,
    fileName: sanitizedName,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    storagePath,
    status: 'pending',
    checksum,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    expiresAt
  };

  const fileRef = doc(db, 'files', fileId);
  await setDoc(fileRef, transferRecord);

  // Upload to Storage
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      fileId,
      senderId,
      recipientId,
      checksum
    }
  });

  await updateDoc(fileRef, {
    status: 'uploading',
    updatedAt: serverTimestamp()
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) {
          onProgress(progress, snapshot.bytesTransferred, snapshot.totalBytes);
        }
      },
      async (uploadError) => {
        console.error('[FileTransferService] Upload failed:', uploadError);
        try {
          await updateDoc(fileRef, {
            status: 'failed',
            failureReason: uploadError.message || 'Upload failed',
            updatedAt: serverTimestamp()
          });
        } catch {}
        reject(createAppError(ERROR_CODES.FILE.UPLOAD_FAILED, uploadError.message));
      },
      async () => {
        // Upload successful -> mark as ready for recipient
        try {
          await updateDoc(fileRef, {
            status: 'ready',
            updatedAt: serverTimestamp()
          });
          resolve({
            ...transferRecord,
            status: 'ready'
          });
        } catch (updateError: any) {
          reject(updateError);
        }
      }
    );
  });
}

/**
 * Downloads a payload from Firebase Storage, verifies SHA-256 integrity,
 * saves to client disk, and finalizes transfer status to 'completed'.
 */
export async function downloadAndVerifyTransferFile(
  transfer: FileTransferRecord,
  onProgress?: (progressPercent: number) => void
): Promise<{ verified: boolean; fileName: string }> {
  if (!db || !auth || !auth.currentUser || !storage) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Authentication and storage required.');
  }

  const fileRef = doc(db, 'files', transfer.fileId);
  const storageRef = ref(storage, transfer.storagePath);

  try {
    if (onProgress) onProgress(20);
    // Fetch blob from storage
    const blob = await getBlob(storageRef);

    if (onProgress) onProgress(60);
    // Verify SHA-256 integrity
    const downloadedChecksum = await computeFileChecksum(blob);

    if (downloadedChecksum.toLowerCase() !== transfer.checksum.toLowerCase()) {
      // Tampering or transmission corruption detected
      await updateDoc(fileRef, {
        status: 'failed',
        failureReason: 'Cryptographic checksum mismatch. File rejected for security integrity.',
        updatedAt: serverTimestamp()
      });
      throw createAppError(
        ERROR_CODES.FILE.TRANSFER_FAILED,
        'Integrity check failed: Received file does not match sender SHA-256 hash!'
      );
    }

    if (onProgress) onProgress(90);

    // Save to disk by triggering browser / Electron download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = transfer.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Mark as completed in Firestore
    await updateDoc(fileRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (onProgress) onProgress(100);
    return { verified: true, fileName: transfer.fileName };
  } catch (err: any) {
    console.error('[FileTransferService] Download or verification error:', err);
    throw err;
  }
}

/**
 * Recipient declines / rejects an incoming payload.
 */
export async function rejectTransfer(fileId: string, reason?: string): Promise<void> {
  if (!db || !auth || !auth.currentUser) return;
  const fileRef = doc(db, 'files', fileId);
  await updateDoc(fileRef, {
    status: 'rejected',
    failureReason: reason || 'Transfer declined by recipient station.',
    updatedAt: serverTimestamp()
  });
}

/**
 * Sender aborts / cancels an outbound payload.
 */
export async function cancelTransfer(fileId: string): Promise<void> {
  if (!db || !auth || !auth.currentUser) return;
  const fileRef = doc(db, 'files', fileId);
  await updateDoc(fileRef, {
    status: 'cancelled',
    failureReason: 'Transfer cancelled by transmitting station.',
    updatedAt: serverTimestamp()
  });
}

/**
 * Subscribes to inbound and outbound file transfer queues for the current operative.
 */
export function listenToStationTransfers(callbacks: {
  onOutboundChange: (transfers: FileTransferRecord[]) => void;
  onInboundChange: (transfers: FileTransferRecord[]) => void;
  onError?: (error: Error) => void;
}): () => void {
  if (!db || !auth || !auth.currentUser) {
    return () => {};
  }

  const currentUid = auth.currentUser.uid;
  const filesCol = collection(db, 'files');

  // Outbound query (sent by current user)
  const outboundQuery = query(filesCol, where('senderId', '==', currentUid));
  // Inbound query (received by current user)
  const inboundQuery = query(filesCol, where('recipientId', '==', currentUid));

  const unsubOutbound = onSnapshot(
    outboundQuery,
    (snapshot) => {
      const records: FileTransferRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as FileTransferRecord);
      });
      // Sort newest first
      records.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callbacks.onOutboundChange(records);
    },
    (err) => {
      console.warn('[FileTransferService] Outbound snapshot error:', err);
      if (callbacks.onError) callbacks.onError(err);
    }
  );

  const unsubInbound = onSnapshot(
    inboundQuery,
    (snapshot) => {
      const records: FileTransferRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as FileTransferRecord);
      });
      // Sort newest first
      records.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callbacks.onInboundChange(records);
    },
    (err) => {
      console.warn('[FileTransferService] Inbound snapshot error:', err);
      if (callbacks.onError) callbacks.onError(err);
    }
  );

  return () => {
    unsubOutbound();
    unsubInbound();
  };
}
