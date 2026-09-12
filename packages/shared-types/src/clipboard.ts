import type { Timestamp } from './user';

export type ClipboardContentType = 'text' | 'url' | 'image';

export interface ClipboardItem {
  clipboardId: string;
  ownerId: string;
  sourceDeviceId: string;
  contentType: ClipboardContentType;
  content: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface SyncClipboardRequest {
  sourceDeviceId: string;
  contentType: ClipboardContentType;
  content: string;
}
