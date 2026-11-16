import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import {
  fetchOlderMessages,
  MESSAGE_PAGE_SIZE,
  sendMessageToRoom,
  subscribeLatestMessages,
} from '@/src/services/messageService';
import {
  joinExistingRoomById,
  leaveRoomMembership,
  markRoomRead,
  subscribeRoomMembers,
  subscribeRoomMetadata,
} from '@/src/services/roomService';
import type {
  ChatMessage,
  ConnectionState,
  Room,
  RoomMember,
  UserProfile,
} from '@/src/types/chat';
import {
  ERROR_MESSAGES,
  getHumanReadableError,
  isPermissionDeniedError,
} from '@/src/utils/errorHandling';
import {
  createUniqueId,
  isValidRoomIdFormat,
  MESSAGE_COOLDOWN_MS,
  sanitizePhotoUrl,
  validateMessageText,
} from '@/src/utils/validation';

interface UseRoomChatResult {
  room: Room | null;
  isOwner: boolean;
  members: RoomMember[];
  messages: ChatMessage[];
  loadingRoom: boolean;
  roomError: string | null;
  roomNotFound: boolean;
  roomDeletedByOwner: boolean;
  membershipRevoked: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  connectionState: ConnectionState;
  isCooldownActive: boolean;
  isLeaving: boolean;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (rawText: string) => Promise<boolean>;
  retryMessage: (message: ChatMessage) => Promise<void>;
  dismissFailedMessage: (messageId: string) => void;
  leaveCurrentRoom: () => Promise<boolean>;
  pauseListenersForDeletion: () => void;
}

function getTimestampValue(msg: ChatMessage): number {
  if (msg.createdAt && typeof msg.createdAt.toMillis === 'function') {
    return msg.createdAt.toMillis();
  }
  return msg.localOrder ?? Number.MAX_SAFE_INTEGER;
}

export function useRoomChat(
  roomId: string | undefined,
  profile: UserProfile | null
): UseRoomChatResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [failedMessages, setFailedMessages] = useState<Map<string, ChatMessage>>(new Map());
  const [loadingRoom, setLoadingRoom] = useState<boolean>(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomNotFound, setRoomNotFound] = useState<boolean>(false);
  const [roomDeletedByOwner, setRoomDeletedByOwner] = useState<boolean>(false);
  const [membershipRevoked, setMembershipRevoked] = useState<boolean>(false);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(false);
  const [hasInitialSnapshot, setHasInitialSnapshot] = useState<boolean>(false);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [listenerError, setListenerError] = useState<boolean>(false);
  const [isCooldownActive, setIsCooldownActive] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);

  const generationRef = useRef<number>(0);
  const unsubMessagesRef = useRef<(() => void) | null>(null);
  const unsubMembersRef = useRef<(() => void) | null>(null);
  const unsubRoomRef = useRef<(() => void) | null>(null);
  const oldestCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hasPaginatedRef = useRef<boolean>(false);
  const knownConfirmedRef = useRef<Map<string, ChatMessage>>(new Map());
  const lastSendTimestampRef = useRef<number>(0);
  const cooldownTimerRef = useRef<number | null>(null);
  const localSequenceRef = useRef<number>(0);
  const confirmedMemberOnceRef = useRef<boolean>(false);
  const leavingLockRef = useRef<boolean>(false);
  const lastReadSyncRef = useRef<number>(0);

  const cleanupListeners = useCallback(() => {
    if (unsubMessagesRef.current) {
      unsubMessagesRef.current();
      unsubMessagesRef.current = null;
    }
    if (unsubMembersRef.current) {
      unsubMembersRef.current();
      unsubMembersRef.current = null;
    }
    if (unsubRoomRef.current) {
      unsubRoomRef.current();
      unsubRoomRef.current = null;
    }
  }, []);

  useEffect(() => {
    const currentGen = ++generationRef.current;
    cleanupListeners();

    setRoom(null);
    setMembers([]);
    setLiveMessages([]);
    setOlderMessages([]);
    setFailedMessages(new Map());
    setRoomError(null);
    setRoomNotFound(false);
    setRoomDeletedByOwner(false);
    setMembershipRevoked(false);
    setLoadingOlder(false);
    setHasMoreOlder(false);
    setHasInitialSnapshot(false);
    setIsFromCache(false);
    setListenerError(false);
    setIsLeaving(false);
    leavingLockRef.current = false;
    oldestCursorRef.current = null;
    hasPaginatedRef.current = false;
    knownConfirmedRef.current = new Map();
    confirmedMemberOnceRef.current = false;
    lastReadSyncRef.current = 0;

    if (!roomId || !profile) {
      setLoadingRoom(false);
      return;
    }

    if (!isValidRoomIdFormat(roomId)) {
      setRoomNotFound(true);
      setRoomError(ERROR_MESSAGES.invalid_room);
      setLoadingRoom(false);
      return;
    }

    setLoadingRoom(true);

    const initRoom = async () => {
      try {
        const joinedRoom = await joinExistingRoomById(roomId, profile);
        if (generationRef.current !== currentGen) return;

        if (!joinedRoom) {
          setRoomNotFound(true);
          setLoadingRoom(false);
          return;
        }

        setRoom(joinedRoom);

        // Subscribe to room metadata for real-time deletion & attribution sync
        unsubRoomRef.current = subscribeRoomMetadata(
          roomId,
          (liveRoom) => {
            if (generationRef.current !== currentGen) return;
            if (!liveRoom || liveRoom.status === 'deleting') {
              ++generationRef.current;
              cleanupListeners();
              setRoomDeletedByOwner(true);
              return;
            }
            setRoom(liveRoom);
          },
          () => {
            // Non-fatal metadata listener issue
          }
        );

        // Subscribe to members list
        unsubMembersRef.current = subscribeRoomMembers(
          roomId,
          (memberList) => {
            if (generationRef.current !== currentGen) return;
            setMembers(memberList);
            const stillMember = memberList.some((m) => m.uid === profile.uid);
            if (stillMember) {
              confirmedMemberOnceRef.current = true;
            } else if (confirmedMemberOnceRef.current && !leavingLockRef.current) {
              setMembershipRevoked(true);
            }
          },
          (err) => {
            if (generationRef.current !== currentGen) return;
            if (isPermissionDeniedError(err) && !leavingLockRef.current) {
              setMembershipRevoked(true);
            }
          }
        );

        // Subscribe to latest 50 messages
        unsubMessagesRef.current = subscribeLatestMessages(
          roomId,
          MESSAGE_PAGE_SIZE,
          (result) => {
            if (generationRef.current !== currentGen) return;

            setHasInitialSnapshot(true);
            setIsFromCache(result.fromCache);
            setListenerError(false);

            const liveIds = new Set(result.messages.map((m) => m.messageId));
            const oldestLiveTime =
              result.messages.length > 0 ? getTimestampValue(result.messages[0]) : Number.MAX_SAFE_INTEGER;

            const overflowed: ChatMessage[] = [];
            knownConfirmedRef.current.forEach((msg, id) => {
              if (!liveIds.has(id) && getTimestampValue(msg) <= oldestLiveTime) {
                overflowed.push(msg);
              }
            });

            if (overflowed.length > 0) {
              setOlderMessages((prev) => {
                const map = new Map(prev.map((m) => [m.messageId, m]));
                overflowed.forEach((m) => map.set(m.messageId, m));
                return Array.from(map.values());
              });
            }

            result.messages.forEach((m) => {
              if (!m.hasPendingWrites && m.createdAt) {
                knownConfirmedRef.current.set(m.messageId, m);
              }
            });

            if (!hasPaginatedRef.current) {
              oldestCursorRef.current = result.oldestDoc;
              setHasMoreOlder(result.messages.length >= MESSAGE_PAGE_SIZE);
            }

            setFailedMessages((prev) => {
              if (prev.size === 0) return prev;
              let changed = false;
              const next = new Map(prev);
              liveIds.forEach((id) => {
                if (next.has(id)) {
                  next.delete(id);
                  changed = true;
                }
              });
              return changed ? next : prev;
            });

            setLiveMessages(result.messages);
            setLoadingRoom(false);

            // Throttled lastReadAt sync while reading messages
            const now = Date.now();
            if (!result.fromCache && now - lastReadSyncRef.current > 15000) {
              lastReadSyncRef.current = now;
              void markRoomRead(profile.uid, roomId);
            }
          },
          (err) => {
            if (generationRef.current !== currentGen) return;
            if (leavingLockRef.current) return;
            setListenerError(true);
            setLoadingRoom(false);
            if (isPermissionDeniedError(err)) {
              setMembershipRevoked(true);
              setRoomError(ERROR_MESSAGES.permission_denied);
            } else {
              setRoomError(getHumanReadableError(err, ERROR_MESSAGES.room_unavailable));
            }
          }
        );
      } catch (err) {
        if (generationRef.current !== currentGen) return;
        setLoadingRoom(false);
        setRoomError(getHumanReadableError(err, ERROR_MESSAGES.room_unavailable));
      }
    };

    void initRoom();

    return () => {
      ++generationRef.current;
      cleanupListeners();
    };
  }, [roomId, profile, cleanupListeners]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || loadingOlder || !hasMoreOlder || !oldestCursorRef.current) {
      return;
    }

    const currentGen = generationRef.current;
    setLoadingOlder(true);

    try {
      const page = await fetchOlderMessages(roomId, oldestCursorRef.current, MESSAGE_PAGE_SIZE);
      if (generationRef.current !== currentGen) return;

      hasPaginatedRef.current = true;
      if (page.oldestDoc) {
        oldestCursorRef.current = page.oldestDoc;
      }
      setHasMoreOlder(page.hasMore);

      if (page.messages.length > 0) {
        setOlderMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          page.messages.forEach((m) => {
            map.set(m.messageId, m);
            if (m.createdAt) knownConfirmedRef.current.set(m.messageId, m);
          });
          prev.forEach((m) => map.set(m.messageId, m));
          return Array.from(map.values());
        });
      }
    } catch (err) {
      if (generationRef.current !== currentGen) return;
      setRoomError(getHumanReadableError(err, 'Unable to load older messages.'));
    } finally {
      if (generationRef.current === currentGen) {
        setLoadingOlder(false);
      }
    }
  }, [roomId, loadingOlder, hasMoreOlder]);

  const executeSend = useCallback(
    async (messageId: string, trimmedText: string, localOrder: number): Promise<boolean> => {
      if (!roomId || !profile) return false;
      const currentGen = generationRef.current;

      setFailedMessages((prev) => {
        if (!prev.has(messageId)) return prev;
        const next = new Map(prev);
        next.delete(messageId);
        return next;
      });

      const optimisticEntry: ChatMessage = {
        messageId,
        roomId,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderUsername: profile.username,
        senderPhotoURL: sanitizePhotoUrl(profile.photoURL),
        text: trimmedText,
        createdAt: null,
        hasPendingWrites: true,
        deliveryStatus: 'sending',
        localOrder,
      };

      try {
        await sendMessageToRoom({
          roomId,
          messageId,
          senderId: profile.uid,
          senderName: profile.displayName,
          senderUsername: profile.username,
          senderPhotoURL: sanitizePhotoUrl(profile.photoURL),
          text: trimmedText,
        });
        return true;
      } catch (err) {
        if (generationRef.current !== currentGen) return false;
        const readableError = getHumanReadableError(err, ERROR_MESSAGES.send_failed);
        setFailedMessages((prev) => {
          const next = new Map(prev);
          next.set(messageId, {
            ...optimisticEntry,
            hasPendingWrites: false,
            deliveryStatus: 'failed',
            deliveryError: readableError,
          });
          return next;
        });
        return false;
      }
    },
    [roomId, profile]
  );

  const sendMessage = useCallback(
    async (rawText: string): Promise<boolean> => {
      if (!roomId || !profile) return false;
      const validation = validateMessageText(rawText);
      if (!validation.valid) {
        throw new Error(validation.error || ERROR_MESSAGES.empty_message);
      }

      const now = Date.now();
      const elapsed = now - lastSendTimestampRef.current;
      if (elapsed < MESSAGE_COOLDOWN_MS) {
        return false;
      }

      lastSendTimestampRef.current = now;
      setIsCooldownActive(true);
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
      }
      cooldownTimerRef.current = window.setTimeout(() => {
        setIsCooldownActive(false);
      }, MESSAGE_COOLDOWN_MS);

      const messageId = createUniqueId();
      const localOrder = Date.now() * 1000 + (++localSequenceRef.current % 1000);

      void executeSend(messageId, validation.trimmed, localOrder);
      return true;
    },
    [roomId, profile, executeSend]
  );

  const retryMessage = useCallback(
    async (message: ChatMessage) => {
      const localOrder = message.localOrder ?? Date.now() * 1000;
      await executeSend(message.messageId, message.text, localOrder);
    },
    [executeSend]
  );

  const dismissFailedMessage = useCallback((messageId: string) => {
    setFailedMessages((prev) => {
      if (!prev.has(messageId)) return prev;
      const next = new Map(prev);
      next.delete(messageId);
      return next;
    });
  }, []);

  const pauseListenersForDeletion = useCallback(() => {
    leavingLockRef.current = true;
    ++generationRef.current;
    cleanupListeners();
  }, [cleanupListeners]);

  const leaveCurrentRoom = useCallback(async (): Promise<boolean> => {
    if (leavingLockRef.current) return false;
    leavingLockRef.current = true;
    setIsLeaving(true);

    // Unsubscribe active listeners FIRST before deleting membership
    ++generationRef.current;
    cleanupListeners();

    try {
      if (roomId && profile) {
        await leaveRoomMembership(roomId, profile.uid);
      }
      return true;
    } catch (err) {
      leavingLockRef.current = false;
      setIsLeaving(false);
      throw err;
    }
  }, [cleanupListeners, roomId, profile]);

  const messages = useMemo(() => {
    const merged = new Map<string, ChatMessage>();
    olderMessages.forEach((m) => merged.set(m.messageId, m));
    liveMessages.forEach((m) => merged.set(m.messageId, m));
    failedMessages.forEach((m, id) => {
      if (!merged.has(id)) {
        merged.set(id, m);
      }
    });

    return Array.from(merged.values()).sort((a, b) => {
      const timeA = getTimestampValue(a);
      const timeB = getTimestampValue(b);
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.messageId.localeCompare(b.messageId);
    });
  }, [olderMessages, liveMessages, failedMessages]);

  const connectionState = useNetworkStatus(hasInitialSnapshot, isFromCache, listenerError);
  const isOwner = Boolean(room && profile && room.createdBy === profile.uid);

  return {
    room,
    isOwner,
    members,
    messages,
    loadingRoom,
    roomError,
    roomNotFound,
    roomDeletedByOwner,
    membershipRevoked,
    loadingOlder,
    hasMoreOlder,
    connectionState,
    isCooldownActive,
    isLeaving,
    loadOlderMessages,
    sendMessage,
    retryMessage,
    dismissFailedMessage,
    leaveCurrentRoom,
    pauseListenersForDeletion,
  };
}
