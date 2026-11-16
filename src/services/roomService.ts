import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/src/lib/firebase';
import {
  OperationType,
  type RecentRoom,
  type Room,
  type RoomJoinResult,
  type RoomMember,
  type RoomRole,
  type UserProfile,
} from '@/src/types/chat';
import { handleFirestoreError } from '@/src/utils/errorHandling';
import {
  computeRoomId,
  isValidRoomIdFormat,
  sanitizePhotoUrl,
  validateRoomName,
} from '@/src/utils/validation';

function mapRecentRoomDoc(uid: string, docId: string, raw: Record<string, unknown>): RecentRoom {
  const roomName =
    (typeof raw.roomName === 'string' && raw.roomName) ||
    (typeof raw.name === 'string' && raw.name) ||
    'Untitled room';
  const ownerUid = (typeof raw.ownerUid === 'string' && raw.ownerUid) || 'legacy';
  const ownerUsername = (typeof raw.ownerUsername === 'string' && raw.ownerUsername) || '';
  const role: RoomRole =
    raw.role === 'owner' || raw.role === 'member'
      ? raw.role
      : ownerUid === uid
        ? 'owner'
        : 'member';

  return {
    uid: (typeof raw.uid === 'string' && raw.uid) || uid,
    roomId: (typeof raw.roomId === 'string' && raw.roomId) || docId,
    roomName,
    name: roomName,
    normalizedName:
      (typeof raw.normalizedName === 'string' && raw.normalizedName) || roomName.toLowerCase(),
    ownerUid,
    ownerUsername,
    role,
    lastVisitedAt: (raw.lastVisitedAt as RecentRoom['lastVisitedAt']) ?? null,
    lastReadAt: (raw.lastReadAt as RecentRoom['lastReadAt']) ?? null,
    createdAt: (raw.createdAt as RecentRoom['createdAt']) ?? null,
  };
}

export async function recordRecentRoom(userId: string, room: Room): Promise<void> {
  const path = `users/${userId}/recentRooms/${room.roomId}`;
  const recentRef = doc(db, 'users', userId, 'recentRooms', room.roomId);
  const ownerUid = room.createdBy || 'legacy';
  const ownerUsername = room.createdByUsername || room.createdByDisplayName || '';
  const role: RoomRole = ownerUid === userId ? 'owner' : 'member';

  try {
    await setDoc(recentRef, {
      uid: userId,
      roomId: room.roomId,
      roomName: room.name,
      name: room.name,
      normalizedName: room.normalizedName,
      ownerUid,
      ownerUsername,
      role,
      lastVisitedAt: serverTimestamp(),
      lastReadAt: serverTimestamp(),
      createdAt: room.createdAt ?? serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markRoomRead(userId: string, roomId: string): Promise<void> {
  if (!isValidRoomIdFormat(roomId)) return;
  const recentRef = doc(db, 'users', userId, 'recentRooms', roomId);
  try {
    await updateDoc(recentRef, {
      lastReadAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if document was not yet created or offline
  }
}

export async function joinOrCreateRoom(
  rawRoomName: string,
  userProfile: UserProfile
): Promise<RoomJoinResult> {
  const validation = validateRoomName(rawRoomName);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid room name.');
  }

  const { displayName: cleanRoomName, normalizedName } = validation;
  const roomId = await computeRoomId(normalizedName);
  const roomPath = `rooms/${roomId}`;
  const roomRef = doc(db, 'rooms', roomId);
  const memberRef = doc(db, 'rooms', roomId, 'members', userProfile.uid);
  const safePhoto = sanitizePhotoUrl(userProfile.photoURL);
  const creatorUsername = userProfile.username || '';

  let resultRoom: Room | null = null;
  let wasCreated = false;

  try {
    await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      const memberSnap = await tx.get(memberRef);

      let activeRoom: Room;

      if (!roomSnap.exists()) {
        wasCreated = true;
        if (!creatorUsername) {
          throw new Error('Please choose a unique username before creating a room.');
        }
        const newRoomData = {
          roomId,
          name: cleanRoomName,
          normalizedName,
          createdBy: userProfile.uid,
          createdByUsername: creatorUsername,
          createdByDisplayName: userProfile.displayName,
          createdAt: serverTimestamp(),
          status: 'active' as const,
        };
        tx.set(roomRef, newRoomData);
        activeRoom = {
          roomId,
          name: cleanRoomName,
          normalizedName,
          createdBy: userProfile.uid,
          createdByUsername: creatorUsername,
          createdByDisplayName: userProfile.displayName,
          createdAt: null,
          status: 'active',
        };
      } else {
        wasCreated = false;
        const existingData = roomSnap.data() as Room;
        if (existingData.status === 'deleting') {
          throw new Error('This room is being deleted and can no longer be joined.');
        }
        activeRoom = existingData;

        // If the original creator visits an older room missing username attribution, backfill safely
        if (
          existingData.createdBy === userProfile.uid &&
          creatorUsername &&
          (existingData.createdByUsername !== creatorUsername ||
            existingData.createdByDisplayName !== userProfile.displayName)
        ) {
          tx.update(roomRef, {
            createdByUsername: creatorUsername,
            createdByDisplayName: userProfile.displayName,
          });
          activeRoom = {
            ...existingData,
            createdByUsername: creatorUsername,
            createdByDisplayName: userProfile.displayName,
          };
        }
      }

      resultRoom = activeRoom;
      const memberRole: RoomRole = activeRoom.createdBy === userProfile.uid ? 'owner' : 'member';

      if (!memberSnap.exists()) {
        tx.set(memberRef, {
          uid: userProfile.uid,
          roomId,
          displayName: userProfile.displayName,
          ...(creatorUsername ? { username: creatorUsername } : {}),
          photoURL: safePhoto,
          role: memberRole,
          joinedAt: serverTimestamp(),
        });
      } else {
        const existingMember = memberSnap.data() as RoomMember;
        if (
          existingMember.displayName !== userProfile.displayName ||
          existingMember.photoURL !== safePhoto ||
          (creatorUsername && existingMember.username !== creatorUsername) ||
          existingMember.role !== memberRole
        ) {
          tx.update(memberRef, {
            displayName: userProfile.displayName,
            ...(creatorUsername ? { username: creatorUsername } : {}),
            photoURL: safePhoto,
            role: memberRole,
          });
        }
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('being deleted') || error.message.includes('choose a unique username'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, roomPath);
  }

  if (!resultRoom) {
    throw new Error('Unable to resolve room state.');
  }

  await recordRecentRoom(userProfile.uid, resultRoom);

  return {
    room: resultRoom,
    status: wasCreated ? 'created' : 'joined',
  };
}

export async function joinExistingRoomById(
  roomId: string,
  userProfile: UserProfile
): Promise<Room | null> {
  if (!isValidRoomIdFormat(roomId)) {
    return null;
  }

  const roomPath = `rooms/${roomId}`;
  const roomRef = doc(db, 'rooms', roomId);
  const memberRef = doc(db, 'rooms', roomId, 'members', userProfile.uid);
  const safePhoto = sanitizePhotoUrl(userProfile.photoURL);
  const memberUsername = userProfile.username || '';

  let foundRoom: Room | null = null;

  try {
    await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists()) {
        foundRoom = null;
        return;
      }

      const existingData = roomSnap.data() as Room;
      if (existingData.status === 'deleting') {
        foundRoom = null;
        return;
      }

      const memberSnap = await tx.get(memberRef);
      let activeRoom = existingData;

      if (
        existingData.createdBy === userProfile.uid &&
        memberUsername &&
        (existingData.createdByUsername !== memberUsername ||
          existingData.createdByDisplayName !== userProfile.displayName)
      ) {
        tx.update(roomRef, {
          createdByUsername: memberUsername,
          createdByDisplayName: userProfile.displayName,
        });
        activeRoom = {
          ...existingData,
          createdByUsername: memberUsername,
          createdByDisplayName: userProfile.displayName,
        };
      }

      foundRoom = activeRoom;
      const memberRole: RoomRole = activeRoom.createdBy === userProfile.uid ? 'owner' : 'member';

      if (!memberSnap.exists()) {
        tx.set(memberRef, {
          uid: userProfile.uid,
          roomId,
          displayName: userProfile.displayName,
          ...(memberUsername ? { username: memberUsername } : {}),
          photoURL: safePhoto,
          role: memberRole,
          joinedAt: serverTimestamp(),
        });
      } else {
        const existingMember = memberSnap.data() as RoomMember;
        if (
          existingMember.displayName !== userProfile.displayName ||
          existingMember.photoURL !== safePhoto ||
          (memberUsername && existingMember.username !== memberUsername) ||
          existingMember.role !== memberRole
        ) {
          tx.update(memberRef, {
            displayName: userProfile.displayName,
            ...(memberUsername ? { username: memberUsername } : {}),
            photoURL: safePhoto,
            role: memberRole,
          });
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, roomPath);
  }

  if (foundRoom) {
    await recordRecentRoom(userProfile.uid, foundRoom);
  }

  return foundRoom;
}

export async function leaveRoomMembership(roomId: string, uid: string): Promise<void> {
  if (!isValidRoomIdFormat(roomId)) return;
  const path = `rooms/${roomId}/members/${uid}`;
  const memberRef = doc(db, 'rooms', roomId, 'members', uid);
  try {
    const snap = await getDoc(memberRef);
    if (snap.exists()) {
      await deleteDoc(memberRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeRecentRoom(uid: string, roomId: string): Promise<void> {
  const path = `users/${uid}/recentRooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'recentRooms', roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteRoomPermanently(roomId: string): Promise<{ deleted: boolean }> {
  if (!isValidRoomIdFormat(roomId)) {
    throw new Error('Invalid room identifier.');
  }
  const callable = httpsCallable<{ roomId: string }, { deleted: boolean }>(functions, 'deleteRoom');
  const response = await callable({ roomId });
  return response.data;
}

export async function verifyRoomsExist(
  roomIds: string[]
): Promise<Map<string, { exists: boolean; status?: string; createdByUsername?: string }>> {
  const results = new Map<string, { exists: boolean; status?: string; createdByUsername?: string }>();
  if (roomIds.length === 0) return results;

  const settled = await Promise.allSettled(
    roomIds.map(async (id) => {
      if (!isValidRoomIdFormat(id)) {
        return { id, exists: false };
      }
      const snap = await getDoc(doc(db, 'rooms', id));
      if (!snap.exists()) {
        return { id, exists: false };
      }
      const data = snap.data() as Room;
      return {
        id,
        exists: data.status !== 'deleting',
        status: data.status || 'active',
        createdByUsername: data.createdByUsername,
      };
    })
  );

  settled.forEach((entry, idx) => {
    const id = roomIds[idx];
    if (entry.status === 'fulfilled') {
      results.set(id, {
        exists: entry.value.exists,
        status: entry.value.status,
        createdByUsername: entry.value.createdByUsername,
      });
    } else {
      // Isolate per-room check errors so healthy rooms are never blocked
      results.set(id, { exists: true });
    }
  });

  return results;
}

export function subscribeRecentRooms(
  uid: string,
  onData: (rooms: RecentRoom[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/recentRooms`;
  const q = query(
    collection(db, 'users', uid, 'recentRooms'),
    orderBy('lastVisitedAt', 'desc'),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rooms: RecentRoom[] = [];
      for (const docSnap of snapshot.docs) {
        try {
          rooms.push(mapRecentRoomDoc(uid, docSnap.id, docSnap.data() as Record<string, unknown>));
        } catch (err) {
          console.warn(`Skipping malformed recentRoom ${docSnap.id}:`, err);
        }
      }
      onData(rooms);
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Already surfaced to caller via onError
      }
    }
  );
}

export function subscribeRoomMetadata(
  roomId: string,
  onRoom: (room: Room | null) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onRoom(null);
        return;
      }
      onRoom(snapshot.data() as Room);
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Already forwarded
      }
    }
  );
}

export function subscribeRoomMembers(
  roomId: string,
  onData: (members: RoomMember[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `rooms/${roomId}/members`;
  const membersCol = collection(db, 'rooms', roomId, 'members');

  return onSnapshot(
    membersCol,
    (snapshot) => {
      const members = snapshot.docs.map((d) => d.data() as RoomMember);
      onData(members);
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Error already forwarded to onError callback
      }
    }
  );
}
