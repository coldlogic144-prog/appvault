import type { Timestamp } from './user';

export type FileTransferStatus =
  | 'pending'
  | 'uploading'
  | 'ready'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'expired';

export interface FileTransferRecord {
  fileId: string;
  senderId: string;
  recipientId: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  targetDeviceId: string;
  targetDeviceName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  status: FileTransferStatus;
  checksum: string;
  failureReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
  expiresAt: Timestamp;
}

export interface InitiateTransferRequest {
  targetDeviceId: string;
  targetDeviceName: string;
  recipientId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
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
