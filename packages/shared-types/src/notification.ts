import type { Timestamp } from './user';

export type NotificationType = 'file_received' | 'message' | 'like' | 'comment' | 'pairing_request' | 'device_paired' | 'report_update' | 'system';

export interface Notification {
  notificationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  createdAt: Timestamp;
}
