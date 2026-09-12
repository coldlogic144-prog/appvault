import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getLocalDeviceId, getLocalDeviceName } from './device';
import type {
  PairingSession,
  PairedDevice,
  QRPairingPayload
} from '@comiclink/shared-types';
import { ERROR_CODES, createAppError } from '@comiclink/error-codes';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateCryptographicChallenge(): Promise<{ nonce: string; hash: string }> {
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonceHex = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const hashBuffer = await crypto.subtle.digest('SHA-256', nonceBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return { nonce: nonceHex, hash: hashHex };
}

export function generatePairingCode(): string {
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < 6; i++) {
    const byte = randomBytes[i] ?? 0;
    code += CHARS[byte % CHARS.length];
  }
  return `CL-${code}`;
}

/**
 * Initiates a new short-lived pairing session with QR payload and 6-digit code.
 */
export async function createPairingSession(): Promise<{
  session: PairingSession;
  qrPayload: QRPairingPayload;
}> {
  if (!db || !auth || !auth.currentUser) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Operative must be authenticated to pair.');
  }

  const sessionId = crypto.randomUUID();
  const initiatorDeviceId = getLocalDeviceId();
  const initiatorDeviceName = getLocalDeviceName();
  const pairingCode = generatePairingCode();
  const { hash } = await generateCryptographicChallenge();

  const ttlMs = 5 * 60 * 1000; // 5 minutes
  const expiresTimestamp = Timestamp.fromMillis(Date.now() + ttlMs);

  const sessionDoc: PairingSession = {
    sessionId,
    initiatorUserId: auth.currentUser.uid,
    initiatorDeviceId,
    initiatorDeviceName,
    pairingCode,
    status: 'pending',
    targetUserId: null,
    targetDeviceId: null,
    targetDeviceName: null,
    challengeHash: hash,
    createdAt: serverTimestamp() as any,
    expiresAt: expiresTimestamp as any,
    approvedAt: null,
    completedAt: null,
    cancelledAt: null,
    rejectedAt: null
  };

  // Write session and pairing code index in Firestore
  const sessionRef = doc(db, 'pairingSessions', sessionId);
  const codeRef = doc(db, 'pairingCodes', pairingCode);

  await setDoc(sessionRef, sessionDoc);
  await setDoc(codeRef, {
    code: pairingCode,
    sessionId,
    createdAt: serverTimestamp()
  });

  const qrPayload: QRPairingPayload = {
    v: 1,
    sid: sessionId,
    code: pairingCode,
    initDev: initiatorDeviceId,
    exp: Date.now() + ttlMs,
    ch: hash
  };

  return { session: sessionDoc, qrPayload };
}

/**
 * Looks up a pairing session by 6-digit code, UUID, or raw JSON payload.
 */
export async function lookupSessionByCode(rawInput: string): Promise<PairingSession> {
  if (!db || !auth || !auth.currentUser) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Operative must be authenticated.');
  }

  const trimmed = rawInput.trim();
  let targetSessionId: string | null = null;

  // Check if input is a JSON QR payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as QRPairingPayload;
      if (parsed.sid) {
        targetSessionId = parsed.sid;
      }
    } catch {
      // Not JSON, continue to other formats
    }
  }

  // Check if input is direct UUID v4
  if (!targetSessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    targetSessionId = trimmed;
  }

  // Otherwise, treat as pairing code (e.g. CL-XXXXXX or XXXXXX)
  if (!targetSessionId) {
    let code = trimmed.toUpperCase();
    if (!code.startsWith('CL-')) {
      code = `CL-${code}`;
    }
    const codeRef = doc(db, 'pairingCodes', code);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
      throw createAppError(ERROR_CODES.PAIRING.SESSION_NOT_FOUND, 'Pairing code not found or expired.');
    }
    targetSessionId = codeSnap.data()?.sessionId;
  }

  if (!targetSessionId) {
    throw createAppError(ERROR_CODES.PAIRING.INVALID_CODE, 'Invalid pairing format.');
  }

  const sessionRef = doc(db, 'pairingSessions', targetSessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    throw createAppError(ERROR_CODES.PAIRING.SESSION_NOT_FOUND, 'Pairing session does not exist.');
  }

  const session = sessionSnap.data() as PairingSession;

  if (session.status !== 'pending') {
    throw createAppError(
      ERROR_CODES.PAIRING.SESSION_USED,
      `Pairing session is no longer active (Status: ${session.status.toUpperCase()}).`
    );
  }

  const expMillis = session.expiresAt?.seconds ? session.expiresAt.seconds * 1000 : 0;
  if (expMillis > 0 && expMillis < Date.now()) {
    throw createAppError(ERROR_CODES.PAIRING.SESSION_EXPIRED, 'Pairing session has expired.');
  }

  if (session.initiatorDeviceId === getLocalDeviceId()) {
    throw createAppError(ERROR_CODES.PAIRING.INVALID_CODE, 'Cannot pair this station with itself.');
  }

  return session;
}

/**
 * Target approves the incoming pairing invitation.
 */
export async function approvePairingSession(sessionId: string): Promise<void> {
  if (!db || !auth || !auth.currentUser) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Authentication required.');
  }

  const sessionRef = doc(db, 'pairingSessions', sessionId);
  await updateDoc(sessionRef, {
    status: 'approved',
    targetUserId: auth.currentUser.uid,
    targetDeviceId: getLocalDeviceId(),
    targetDeviceName: getLocalDeviceName(),
    approvedAt: serverTimestamp()
  });
}

/**
 * Target rejects the incoming pairing invitation.
 */
export async function rejectPairingSession(sessionId: string): Promise<void> {
  if (!db || !auth || !auth.currentUser) return;

  const sessionRef = doc(db, 'pairingSessions', sessionId);
  await updateDoc(sessionRef, {
    status: 'rejected',
    targetUserId: auth.currentUser.uid,
    rejectedAt: serverTimestamp()
  });
}

/**
 * Initiator finalizes the approved pairing session and stores the mutual link in pairedDevices.
 */
export async function completePairingSession(session: PairingSession): Promise<PairedDevice> {
  if (!db || !auth || !auth.currentUser) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Authentication required.');
  }

  if (session.status !== 'approved' || !session.targetDeviceId || !session.targetUserId) {
    throw createAppError(ERROR_CODES.PAIRING.SESSION_NOT_FOUND, 'Session must be approved before completion.');
  }

  const pairId = [session.initiatorDeviceId, session.targetDeviceId].sort().join('_');
  const sessionRef = doc(db, 'pairingSessions', session.sessionId);
  const pairRef = doc(db, 'pairedDevices', pairId);

  const pairedRecord: PairedDevice = {
    pairId,
    ownerUid: session.initiatorUserId,
    deviceA: session.initiatorDeviceId,
    deviceB: session.targetDeviceId,
    platformA: 'windows',
    platformB: 'windows',
    deviceNameA: session.initiatorDeviceName,
    deviceNameB: session.targetDeviceName || 'Remote Station',
    status: 'active',
    createdAt: serverTimestamp() as any,
    unpairedAt: null
  };

  // Finalize session and register pair
  await updateDoc(sessionRef, {
    status: 'completed',
    completedAt: serverTimestamp()
  });

  await setDoc(pairRef, {
    ...pairedRecord,
    userA: session.initiatorUserId,
    userB: session.targetUserId
  });

  return pairedRecord;
}

/**
 * Initiator cancels an active pairing session.
 */
export async function cancelPairingSession(sessionId: string): Promise<void> {
  if (!db) return;
  const sessionRef = doc(db, 'pairingSessions', sessionId);
  await updateDoc(sessionRef, {
    status: 'cancelled',
    cancelledAt: serverTimestamp()
  });
}

/**
 * Realtime listener for pairing session status changes.
 */
export function listenToPairingSession(
  sessionId: string,
  onUpdate: (session: PairingSession | null) => void
): () => void {
  if (!db) return () => {};
  const sessionRef = doc(db, 'pairingSessions', sessionId);
  return onSnapshot(sessionRef, (snap) => {
    if (!snap.exists()) {
      onUpdate(null);
    } else {
      onUpdate(snap.data() as PairingSession);
    }
  });
}

/**
 * Fetches all active paired devices for the current authenticated operative.
 */
export async function getPairedDevices(ownerUid: string): Promise<PairedDevice[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'pairedDevices'),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    const list: PairedDevice[] = [];
    snap.forEach((d) => {
      const data = d.data() as PairedDevice & { userA?: string; userB?: string };
      if (data.ownerUid === ownerUid || data.userA === ownerUid || data.userB === ownerUid) {
        list.push(data);
      }
    });
    return list;
  } catch (error) {
    console.warn('[PairingService] Error fetching paired devices:', error);
    return [];
  }
}
