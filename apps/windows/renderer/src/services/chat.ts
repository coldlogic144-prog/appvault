import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Conversation, ChatMessage } from '@comiclink/shared-types';
import { ERROR_CODES, createAppError } from '@comiclink/error-codes';
import { chatMessageTextSchema } from '@comiclink/validation';

/**
 * Generates the deterministic conversation ID for two user IDs by sorting them lexicographically.
 */
export function getDeterministicConversationId(uid1: string, uid2: string): string {
  if (!uid1 || !uid2) {
    throw createAppError(ERROR_CODES.GENERAL.INVALID_INPUT, 'Both participant IDs are required.');
  }
  if (uid1 === uid2) {
    throw createAppError(ERROR_CODES.GENERAL.INVALID_INPUT, 'Cannot establish a one-to-one conversation with oneself.');
  }
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]!}_${sorted[1]!}`;
}

/**
 * Retrieves an existing conversation or creates a new one deterministically
 * authorized by an active paired device link.
 */
export async function getOrCreateConversation(peerUid: string, pairId: string): Promise<Conversation> {
  if (!db || !auth || !auth.currentUser) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Authentication required to access conversation.');
  }

  const currentUid = auth.currentUser.uid;
  const conversationId = getDeterministicConversationId(currentUid, peerUid);
  const sorted = [currentUid, peerUid].sort();
  const participantA = sorted[0]!;
  const participantB = sorted[1]!;

  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);

  if (snap.exists()) {
    return snap.data() as Conversation;
  }

  // Create new conversation
  const newConversation: Conversation = {
    conversationId,
    participantA,
    participantB,
    participants: [participantA, participantB],
    pairId,
    lastMessageText: null,
    lastMessageSenderId: null,
    lastMessageAt: null,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any
  };

  await setDoc(convRef, newConversation);
  return {
    ...newConversation,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
}

/**
 * Sends a plain-text message in the specified conversation.
 */
export async function sendChatMessage(conversationId: string, text: string): Promise<ChatMessage> {
  if (!db || !auth || !auth.currentUser) {
    throw createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'Authentication required to send message.');
  }

  const validation = chatMessageTextSchema.safeParse(text);
  if (!validation.success) {
    throw createAppError(
      ERROR_CODES.GENERAL.INVALID_INPUT,
      validation.error.issues[0]?.message || 'Invalid message text.'
    );
  }

  const cleanText = text.trim();
  const senderId = auth.currentUser.uid;
  const messageId = crypto.randomUUID();

  const messageDoc: ChatMessage = {
    messageId,
    conversationId,
    senderId,
    text: cleanText,
    deleted: false,
    createdAt: serverTimestamp() as any
  };

  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const convRef = doc(db, 'conversations', conversationId);

  // Write message subdocument
  await setDoc(messageRef, messageDoc);

  // Update conversation snippet (bounded to 100 chars)
  try {
    await updateDoc(convRef, {
      lastMessageText: cleanText.length > 100 ? `${cleanText.slice(0, 97)}...` : cleanText,
      lastMessageSenderId: senderId,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (updateErr) {
    console.warn('[ChatService] Could not update conversation snippet:', updateErr);
  }

  return {
    ...messageDoc,
    createdAt: Timestamp.now()
  };
}

/**
 * Listens in real time to messages within a conversation (bounded to the latest 50 entries).
 */
export function listenToConversationMessages(
  conversationId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db || !auth || !auth.currentUser) {
    return () => {};
  }

  const messagesCol = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        messages.push(docSnap.data() as ChatMessage);
      });
      onMessages(messages);
    },
    (err) => {
      console.warn('[ChatService] Error listening to messages:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes to all conversations involving the current operative.
 */
export function listenToUserConversations(
  onConversations: (conversations: Conversation[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db || !auth || !auth.currentUser) {
    return () => {};
  }

  const currentUid = auth.currentUser.uid;
  const convCol = collection(db, 'conversations');
  const q = query(convCol, where('participants', 'array-contains', currentUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const convList: Conversation[] = [];
      snapshot.forEach((docSnap) => {
        convList.push(docSnap.data() as Conversation);
      });
      convList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      onConversations(convList);
    },
    (err) => {
      console.warn('[ChatService] Error listening to conversations:', err);
      if (onError) onError(err);
    }
  );
}
