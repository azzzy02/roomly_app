import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronUp,
  Copy,
  Crown,
  DoorOpen,
  Hash,
  Loader2,
  Menu,
  MessageSquarePlus,
  Users,
} from 'lucide-react';
import { ConnectionStatus } from '@/src/components/ConnectionStatus';
import { DeleteRoomModal } from '@/src/components/DeleteRoomModal';
import { MembersPanel } from '@/src/components/MembersPanel';
import { MessageComposer } from '@/src/components/MessageComposer';
import { MessageItem } from '@/src/components/MessageItem';
import { ProfileModal } from '@/src/components/ProfileModal';
import { Sidebar } from '@/src/components/Sidebar';
import { MessageListSkeleton } from '@/src/components/Skeletons';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { useRoomChat } from '@/src/hooks/useRoomChat';
import {
  joinOrCreateRoom,
  subscribeRecentRooms,
} from '@/src/services/roomService';
import type { ChatMessage, RecentRoom } from '@/src/types/chat';
import { getHumanReadableError } from '@/src/utils/errorHandling';
import {
  buildRoomInviteUrl,
  formatRoomCreatedDate,
  getDayKey,
  getDaySeparatorLabel,
} from '@/src/utils/formatting';

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { showToast } = useToast();

  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [membersOpen, setMembersOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false
  );
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);
  const [unreadBelow, setUnreadBelow] = useState<number>(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevLastMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const initialScrollDoneRef = useRef<boolean>(false);
  const ownerInitiatedDeleteRef = useRef<boolean>(false);

  const {
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
  } = useRoomChat(roomId, profile);

  // Reset scroll tracking on room change
  useEffect(() => {
    initialScrollDoneRef.current = false;
    prevLastMessageIdRef.current = null;
    isNearBottomRef.current = true;
    ownerInitiatedDeleteRef.current = false;
    setUnreadBelow(0);
    setCopiedInvite(false);
    setDeleteModalOpen(false);
  }, [roomId]);

  // Subscribe to recent rooms for sidebar
  useEffect(() => {
    if (!profile) return;
    setLoadingRecent(true);
    const unsub = subscribeRecentRooms(
      profile.uid,
      (list) => {
        setRecentRooms(list);
        setLoadingRecent(false);
      },
      () => {
        setLoadingRecent(false);
      }
    );
    return () => unsub();
  }, [profile]);

  // Redirect participants when room is deleted by its owner
  useEffect(() => {
    if (roomDeletedByOwner && !ownerInitiatedDeleteRef.current) {
      showToast(
        'info',
        'Room deleted',
        'This room was permanently deleted by its owner.',
        `deleted-${roomId}`
      );
      navigate('/', { replace: true });
    }
  }, [roomDeletedByOwner, roomId, navigate, showToast]);

  // Handle cross-tab membership revocation gracefully
  useEffect(() => {
    if (membershipRevoked && !roomDeletedByOwner) {
      showToast(
        'info',
        'Left room',
        'Your membership in this room was closed.',
        `revoked-${roomId}`
      );
      navigate('/', { replace: true });
    }
  }, [membershipRevoked, roomDeletedByOwner, roomId, navigate, showToast]);

  // Preserve scroll position when older messages are prepended
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || prevScrollHeightRef.current === null) return;
    const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
    if (heightDiff > 0) {
      container.scrollTop += heightDiff;
    }
    prevScrollHeightRef.current = null;
  }, [messages.length]);

  // Smart auto-scroll to new messages
  useEffect(() => {
    if (loadingRoom || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg.messageId;

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      prevLastMessageIdRef.current = lastId;
      bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }

    if (prevLastMessageIdRef.current !== lastId) {
      const isOwnNewMessage = lastMsg.senderId === profile?.uid;
      prevLastMessageIdRef.current = lastId;

      if (isNearBottomRef.current || isOwnNewMessage) {
        bottomSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
        setUnreadBelow(0);
      } else {
        setUnreadBelow((prev) => prev + 1);
      }
    }
  }, [messages, loadingRoom, profile?.uid]);

  if (!profile) return null;

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = nearBottom;
    if (nearBottom && unreadBelow > 0) {
      setUnreadBelow(0);
    }
  };

  const scrollToBottom = () => {
    bottomSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadBelow(0);
    isNearBottomRef.current = true;
  };

  const handleLoadOlder = async () => {
    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }
    await loadOlderMessages();
  };

  const handleCopyInvite = async () => {
    if (!room) return;
    const url = buildRoomInviteUrl(room.name);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInvite(true);
      showToast(
        'success',
        'Invitation link copied',
        `Anyone with this link can join #${room.name}.`,
        `invite-${room.roomId}`
      );
      window.setTimeout(() => setCopiedInvite(false), 2200);
    } catch {
      showToast('error', 'Clipboard unavailable', url);
    }
  };

  const handleLeaveRoom = async () => {
    if (isLeaving) return;
    const name = room?.name;
    const id = room?.roomId || roomId || '';
    try {
      const left = await leaveCurrentRoom();
      if (!left) return;
      navigate('/', { replace: true });
      if (name) {
        showToast(
          'info',
          `Left #${name}`,
          'You can rejoin anytime from recent rooms.',
          `leave-${id}`
        );
      }
    } catch (err) {
      showToast('error', 'Could not leave room', getHumanReadableError(err));
    }
  };

  const handleSwitchOrCreateRoom = async (roomName: string) => {
    try {
      const result = await joinOrCreateRoom(roomName, profile);
      if (result.room.roomId === roomId) {
        showToast('info', `Already in #${result.room.name}`, undefined, `already-${roomId}`);
        return;
      }
      showToast(
        'success',
        result.status === 'created' ? 'Room created successfully' : `Joined #${result.room.name}`,
        undefined,
        `enter-${result.room.roomId}`
      );
      navigate(`/room/${result.room.roomId}`);
    } catch (err) {
      const msg = getHumanReadableError(err, 'Unable to switch rooms.');
      showToast('error', 'Room error', msg);
      throw new Error(msg);
    }
  };

  const handleSelectRecent = (recent: RecentRoom) => {
    if (recent.roomId === roomId) return;
    navigate(`/room/${recent.roomId}`);
  };

  const creatorBadgeLabel = room
    ? isOwner
      ? 'you'
      : room.createdByUsername
        ? `@${room.createdByUsername}`
        : room.createdByDisplayName || 'Creator'
    : '';

  const roomCreatedDate =
    room?.createdAt && typeof room.createdAt.toDate === 'function'
      ? room.createdAt.toDate()
      : null;

  const renderConversationOriginBanner = () => {
    if (!room || hasMoreOlder) return null;

    return (
      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#12161F]/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Crown className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-slate-100">
              Room created by{' '}
              <span className="text-indigo-300">
                {isOwner ? `@${profile.username || profile.displayName} (you)` : creatorBadgeLabel}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              #{room.name} · Created {formatRoomCreatedDate(roomCreatedDate)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderMessageStream = () => {
    if (loadingRoom) {
      return <MessageListSkeleton />;
    }

    if (roomNotFound) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-slate-100">Room not found</h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-400">
            {roomError || 'This room link is invalid or the room has been deleted.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 h-11 rounded-xl bg-indigo-600 px-5 font-display text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            Back to home
          </button>
        </div>
      );
    }

    if (roomError && messages.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-slate-100">
            Unable to load messages
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-400">{roomError}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 h-11 rounded-xl bg-indigo-600 px-5 font-display text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            Return to home
          </button>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end px-4 py-5 sm:px-6">
        {hasMoreOlder && (
          <div className="mb-6 flex justify-center">
            <button
              type="button"
              onClick={() => void handleLoadOlder()}
              disabled={loadingOlder}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#12161F] px-4 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              {loadingOlder ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Loading older messages...</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Load older messages</span>
                </>
              )}
            </button>
          </div>
        )}

        {renderConversationOriginBanner()}

        {messages.length === 0 ? (
          <div className="my-auto py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
              <MessageSquarePlus className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-slate-100">
              No messages yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
              Start the conversation below or share the invitation link so teammates can join live.
            </p>
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#12161F] px-4 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <Copy className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              <span>Copy invitation link</span>
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((msg, idx) => {
              const prev: ChatMessage | undefined = idx > 0 ? messages[idx - 1] : undefined;
              const msgDate =
                msg.createdAt && typeof msg.createdAt.toDate === 'function'
                  ? msg.createdAt.toDate()
                  : new Date();
              const prevDate =
                prev?.createdAt && typeof prev.createdAt.toDate === 'function'
                  ? prev.createdAt.toDate()
                  : prev
                    ? new Date()
                    : null;

              const currentDayKey = getDayKey(msgDate);
              const prevDayKey = prevDate ? getDayKey(prevDate) : null;
              const showDaySeparator = !prev || currentDayKey !== prevDayKey;

              const withinGroupWindow =
                prev &&
                prevDate &&
                !showDaySeparator &&
                prev.senderId === msg.senderId &&
                Math.abs(msgDate.getTime() - prevDate.getTime()) <= GROUPING_WINDOW_MS;

              const showSenderHeader = !withinGroupWindow;

              return (
                <React.Fragment key={msg.messageId}>
                  {showDaySeparator && (
                    <div className="my-6 flex items-center gap-4" role="separator">
                      <div className="h-px flex-1 bg-white/[0.07]" />
                      <span className="text-xs font-medium text-slate-500">
                        {getDaySeparatorLabel(msgDate)}
                      </span>
                      <div className="h-px flex-1 bg-white/[0.07]" />
                    </div>
                  )}
                  <MessageItem
                    message={msg}
                    isOwn={msg.senderId === profile.uid}
                    showSenderHeader={showSenderHeader}
                    onRetry={(m) => void retryMessage(m)}
                    onDismissFailed={dismissFailedMessage}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div ref={bottomSentinelRef} className="h-1" />
      </div>
    );
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#0B0E14] text-slate-100">
      <Sidebar
        profile={profile}
        recentRooms={recentRooms}
        loadingRecent={loadingRecent}
        activeRoomId={roomId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onJoinOrCreateRoom={handleSwitchOrCreateRoom}
        onSelectRecentRoom={handleSelectRecent}
        onOpenProfile={() => setProfileOpen(true)}
        onSignOut={signOut}
      />

      {/* Main Conversation Panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Conversation Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#12161F]/70 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open rooms navigation"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <Hash className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
              <h1 className="truncate font-display text-base font-semibold text-slate-100 sm:text-lg">
                {room ? room.name : loadingRoom ? 'Loading room...' : 'Room'}
              </h1>
            </div>

            {room && (
              <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex whitespace-nowrap shrink-0">
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Crown className="h-3 w-3 text-amber-400" aria-hidden="true" />
                  <span>{isOwner ? 'Owner: you' : `Owner: ${creatorBadgeLabel}`}</span>
                </span>
                {members.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ConnectionStatus state={connectionState} />

            {room && (
              <>
                <button
                  type="button"
                  onClick={() => setMembersOpen((prev) => !prev)}
                  aria-expanded={membersOpen}
                  aria-label="Toggle room info and members panel"
                  title="Members & room info"
                  className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 whitespace-nowrap shrink-0 ${
                    membersOpen
                      ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                      : 'border-white/10 bg-[#0B0E14]/60 text-slate-200 hover:bg-white/[0.06]'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tabular-nums hidden sm:inline">
                    {members.length > 0 ? members.length : 'Info'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyInvite()}
                  aria-label="Copy room invitation link"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B0E14]/60 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-indigo-500 whitespace-nowrap shrink-0"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span className="hidden sm:inline">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <span className="hidden sm:inline">Copy invite</span>
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={isLeaving}
              onClick={() => void handleLeaveRoom()}
              aria-label="Leave current room"
              title="Leave room"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-rose-400 whitespace-nowrap shrink-0"
            >
              {isLeaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isLeaving ? 'Leaving...' : 'Leave'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Message Viewport */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden"
          >
            {renderMessageStream()}
          </div>

          {unreadBelow > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <button
                type="button"
                onClick={scrollToBottom}
                className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-600 px-4 text-xs font-semibold text-white shadow-lg shadow-black/50 transition-transform hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-300"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="tabular-nums">
                  {unreadBelow} new {unreadBelow === 1 ? 'message' : 'messages'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Message Input Bar */}
        {!roomNotFound && (
          <MessageComposer
            roomName={room?.name || 'room'}
            disabled={loadingRoom || !room || Boolean(roomError && messages.length === 0) || isLeaving}
            isCooldownActive={isCooldownActive}
            onSendMessage={sendMessage}
          />
        )}
      </div>

      {/* Collapsible Members & Room Info Panel */}
      <MembersPanel
        room={room}
        members={members}
        currentUid={profile.uid}
        isOwner={isOwner}
        isOpen={membersOpen && Boolean(room)}
        onClose={() => setMembersOpen(false)}
        onCopyInvite={() => void handleCopyInvite()}
        onRequestDeleteRoom={() => setDeleteModalOpen(true)}
      />

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      <DeleteRoomModal
        isOpen={deleteModalOpen}
        roomId={room?.roomId || ''}
        roomName={room?.name || ''}
        onClose={() => {
          ownerInitiatedDeleteRef.current = false;
          setDeleteModalOpen(false);
        }}
        onBeforeDelete={() => {
          ownerInitiatedDeleteRef.current = true;
        }}
        onDeleted={() => {
          pauseListenersForDeletion();
          const name = room?.name || 'Room';
          const id = room?.roomId || '';
          setDeleteModalOpen(false);
          navigate('/', { replace: true });
          showToast(
            'success',
            'Room deleted successfully',
            `#${name} and all its messages were removed.`,
            `deleted-${id}`
          );
        }}
      />
    </div>
  );
}
