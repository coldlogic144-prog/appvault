import type { Timestamp } from './user';

export type ConversationType = 'direct' | 'group';

export interface Conversation {
  conversationId: string;
  type: ConversationType;
  memberUids: string[];
  createdBy: string;
  lastMessageAt: Timestamp | null;
  lastMessagePreview: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConversationMember {
  uid: string;
  role: 'owner' | 'member';
  joinedAt: Timestamp;
  lastReadAt: Timestamp | null;
  isTyping: boolean;
  typingUpdatedAt: Timestamp | null;
}

export type MessageType = 'text' | 'file' | 'system';

export interface Message {
  messageId: string;
  senderId: string;
  type: MessageType;
  content: string;
  fileId: string | null;
  replyTo: string | null;
  edited: boolean;
  editedAt: Timestamp | null;
  deleted: boolean;
  reportCount: number;
  createdAt: Timestamp;
}

export interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content: string;
  fileId?: string;
  replyTo?: string;
}
