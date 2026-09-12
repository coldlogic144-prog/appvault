import type { Timestamp } from './user';

export type FileTransferStatus = 'created' | 'uploading' | 'uploaded' | 'queued' | 'transferring' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface FileTransferRecord {
  fileId: string;
  ownerId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  status: FileTransferStatus;
  checksum: string | null;
  failureReason: string | null;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
  expiresAt: Timestamp;
}

export interface InitiateTransferRequest {
  sourceDeviceId: string;
  targetDeviceId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export const ALLOWED_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/zip'
];

export const MAX_FILE_SIZE: number = 100 * 1024 * 1024;
