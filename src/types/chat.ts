import type { Timestamp } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type RoomRole = 'owner' | 'member';

export interface UsernameClaim {
  uid: string;
  username: string;
  normalizedUsername: string;
  createdAt: Timestamp | null;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Room {
  roomId: string;
  name: string;
  normalizedName: string;
  createdBy: string;
  createdByUsername?: string;
  createdByDisplayName?: string;
  createdAt: Timestamp | null;
  status?: 'active' | 'deleting';
}

export interface RoomMember {
  uid: string;
  roomId: string;
  displayName: string;
  username?: string;
  photoURL: string;
  role?: RoomRole;
  joinedAt: Timestamp | null;
  lastMessageAt?: Timestamp | null;
}

export interface RecentRoom {
  uid: string;
  roomId: string;
  roomName: string;
  /** Legacy alias preserved for backward compatibility */
  name?: string;
  normalizedName: string;
  ownerUid: string;
  ownerUsername: string;
  role: RoomRole;
  lastVisitedAt: Timestamp | null;
  lastReadAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface ChatMessage {
  messageId: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderUsername?: string;
  senderPhotoURL: string;
  text: string;
  createdAt: Timestamp | null;
  /** True when written locally and awaiting Firestore server confirmation */
  hasPendingWrites?: boolean;
  /** Client-only failure tracking for retry UI */
  deliveryStatus?: 'confirmed' | 'sending' | 'failed';
  deliveryError?: string;
  localOrder?: number;
}

export interface RoomJoinResult {
  room: Room;
  status: 'created' | 'joined';
}

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'error';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  dedupeKey?: string;
}
