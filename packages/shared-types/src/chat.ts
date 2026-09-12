import type { Timestamp } from './user';

export interface Conversation {
  conversationId: string;
  participantA: string;
  participantB: string;
  participants: string[];
  pairId: string;
  lastMessageText: string | null;
  lastMessageSenderId: string | null;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  text: string;
  deleted: boolean;
  createdAt: Timestamp;
}

export interface SendChatMessageRequest {
  conversationId: string;
  text: string;
}

// Backward-compatible alias
export type Message = ChatMessage;
