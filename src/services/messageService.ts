import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { OperationType, type ChatMessage } from '@/src/types/chat';
import { handleFirestoreError } from '@/src/utils/errorHandling';
import { sanitizePhotoUrl, validateMessageText } from '@/src/utils/validation';

export const MESSAGE_PAGE_SIZE = 50;

export interface LiveMessagesResult {
  messages: ChatMessage[];
  oldestDoc: QueryDocumentSnapshot<DocumentData> | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
}

function mapDocToMessage(docSnap: QueryDocumentSnapshot<DocumentData>): ChatMessage {
  const data = docSnap.data();
  return {
    messageId: (data.messageId as string) || docSnap.id,
    roomId: data.roomId as string,
    senderId: data.senderId as string,
    senderName: data.senderName as string,
    senderUsername: typeof data.senderUsername === 'string' ? data.senderUsername : undefined,
    senderPhotoURL: (data.senderPhotoURL as string) || '',
    text: data.text as string,
    createdAt: data.createdAt ?? null,
    hasPendingWrites: docSnap.metadata.hasPendingWrites,
    deliveryStatus: docSnap.metadata.hasPendingWrites ? 'sending' : 'confirmed',
  };
}

export function subscribeLatestMessages(
  roomId: string,
  pageSize: number,
  onData: (result: LiveMessagesResult) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `rooms/${roomId}/messages`;
  const messagesQuery = query(
    collection(db, 'rooms', roomId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(
    messagesQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      const docs = snapshot.docs;
      const oldestDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      const chronological = [...docs].reverse().map(mapDocToMessage);

      onData({
        messages: chronological,
        oldestDoc,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Error forwarded to onError
      }
    }
  );
}

export async function fetchOlderMessages(
  roomId: string,
  cursorDoc: QueryDocumentSnapshot<DocumentData>,
  pageSize: number = MESSAGE_PAGE_SIZE
): Promise<{
  messages: ChatMessage[];
  oldestDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const path = `rooms/${roomId}/messages`;
  const olderQuery = query(
    collection(db, 'rooms', roomId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursorDoc),
    limit(pageSize)
  );

  try {
    const snapshot = await getDocs(olderQuery);
    const docs = snapshot.docs;
    const oldestDoc = docs.length > 0 ? docs[docs.length - 1] : null;
    const chronological = [...docs].reverse().map(mapDocToMessage);
    return {
      messages: chronological,
      oldestDoc,
      hasMore: docs.length === pageSize,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface SendMessageParams {
  roomId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderUsername?: string;
  senderPhotoURL: string;
  text: string;
}

export async function sendMessageToRoom(params: SendMessageParams): Promise<void> {
  const validation = validateMessageText(params.text);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid message.');
  }

  const path = `rooms/${params.roomId}/messages/${params.messageId}`;
  const messageRef = doc(db, 'rooms', params.roomId, 'messages', params.messageId);
  const memberRef = doc(db, 'rooms', params.roomId, 'members', params.senderId);
  const safePhoto = sanitizePhotoUrl(params.senderPhotoURL);

  const batch = writeBatch(db);
  batch.set(messageRef, {
    messageId: params.messageId,
    roomId: params.roomId,
    senderId: params.senderId,
    senderName: params.senderName,
    ...(params.senderUsername ? { senderUsername: params.senderUsername } : {}),
    senderPhotoURL: safePhoto,
    text: validation.trimmed,
    createdAt: serverTimestamp(),
  });

  batch.update(memberRef, {
    lastMessageAt: serverTimestamp(),
    displayName: params.senderName,
    ...(params.senderUsername ? { username: params.senderUsername } : {}),
    photoURL: safePhoto,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
