import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, Hash, LogOut, Pencil, Shield, Trash2, X } from 'lucide-react';
import { Avatar } from '@/src/components/Avatar';
import { DeleteRoomModal } from '@/src/components/DeleteRoomModal';
import { JoinRoomForm } from '@/src/components/JoinRoomForm';
import { Logo } from '@/src/components/Logo';
import { ProfileModal } from '@/src/components/ProfileModal';
import { RecentRoomsSkeleton } from '@/src/components/Skeletons';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import {
  joinExistingRoomById,
  joinOrCreateRoom,
  removeRecentRoom,
  subscribeRecentRooms,
  verifyRoomsExist,
} from '@/src/services/roomService';
import type { RecentRoom } from '@/src/types/chat';
import { getHumanReadableError } from '@/src/utils/errorHandling';
import { formatRelativeVisit, parseRoomInviteFromSearch } from '@/src/utils/formatting';

export function HomePage() {
  const { profile, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [roomExistence, setRoomExistence] = useState<
    Map<string, { exists: boolean; status?: string; createdByUsername?: string }>
  >(new Map());
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<RecentRoom | null>(null);
  const [prefilledRoom, setPrefilledRoom] = useState<string>('');
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseRoomInviteFromSearch(location.search);
    if (!parsed.present) return;

    if (parsed.valid) {
      setPrefilledRoom(parsed.roomName);
      setInviteNotice(`Invitation link loaded for #${parsed.roomName}. Click Join Room to enter.`);
    } else {
      showToast('error', 'Invalid invitation link', parsed.error, 'invalid-invite');
      navigate('/', { replace: true });
    }
  }, [location.search, navigate, showToast]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoadingRecent(true);
    setRecentError(null);

    const unsubscribe = subscribeRecentRooms(
      profile.uid,
      (rooms) => {
        if (!active) return;
        setRecentRooms(rooms);
        setLoadingRecent(false);
        setRecentError(null);

        if (rooms.length > 0) {
          void verifyRoomsExist(rooms.map((r) => r.roomId)).then((statusMap) => {
            if (active) {
              setRoomExistence(statusMap);
            }
          });
        }
      },
      (err) => {
        if (!active) return;
        setLoadingRecent(false);
        const msg = getHumanReadableError(err, 'Unable to load recent rooms.');
        setRecentError(msg);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile]);

  if (!profile) return null;

  const handleJoinOrCreate = async (roomName: string) => {
    try {
      const result = await joinOrCreateRoom(roomName, profile);
      showToast(
        'success',
        result.status === 'created' ? 'Room created successfully' : `Joined #${result.room.name}`,
        result.status === 'created'
          ? `#${result.room.name} is ready. Share the invite link to collaborate.`
          : 'Entered existing room conversation.',
        `enter-${result.room.roomId}`
      );
      navigate(`/room/${result.room.roomId}`);
    } catch (err) {
      const msg = getHumanReadableError(err, 'Unable to open this room. Please try again.');
      showToast('error', 'Could not enter room', msg);
      throw new Error(msg);
    }
  };

  const handleRejoinRecent = async (recent: RecentRoom) => {
    try {
      const room = await joinExistingRoomById(recent.roomId, profile);
      if (!room) {
        setRoomExistence((prev) => {
          const next = new Map(prev);
          next.set(recent.roomId, { exists: false });
          return next;
        });
        showToast(
          'info',
          'Room no longer exists',
          `#${recent.roomName} was deleted by its owner.`,
          `missing-${recent.roomId}`
        );
        return;
      }
      navigate(`/room/${room.roomId}`);
    } catch (err) {
      showToast('error', 'Unable to rejoin room', getHumanReadableError(err));
    }
  };

  const handleRemoveFromRecent = async (recent: RecentRoom) => {
    try {
      await removeRecentRoom(profile.uid, recent.roomId);
      showToast('info', `Removed #${recent.roomName} from recent rooms`, undefined, `remove-${recent.roomId}`);
    } catch (err) {
      showToast('error', 'Could not remove room', getHumanReadableError(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100">
      {/* Top Navigation Bar */}
      <header className="border-b border-white/[0.07] bg-[#12161F]/70 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo size="md" />

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex h-10 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0B0E14]/70 px-2.5 pr-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-indigo-500"
              title="Account settings"
            >
              <Avatar uid={profile.uid} name={profile.displayName} photoURL={profile.photoURL} size="xs" />
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-[140px] truncate text-xs font-semibold text-slate-100">
                  {profile.displayName}
                </p>
                {profile.username && (
                  <p className="max-w-[140px] truncate text-[11px] text-slate-400">
                    @{profile.username}
                  </p>
                )}
              </div>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6 sm:py-12">
        {/* Primary Join/Create Card */}
        <section
          aria-labelledby="join-room-heading"
          className="rounded-2xl border border-white/[0.08] bg-[#12161F] p-6 shadow-xl shadow-black/30 sm:p-7"
        >
          <div className="mb-4 space-y-1">
            <h1 id="join-room-heading" className="font-display text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
              Join or create a room
            </h1>
            <p className="text-sm text-slate-400">
              Enter a room name to start a new conversation or reconnect with an existing room.
            </p>
          </div>

          <JoinRoomForm
            initialValue={prefilledRoom}
            helperNotice={inviteNotice}
            onJoinRoom={handleJoinOrCreate}
          />
        </section>

        {/* Recent Rooms Section */}
        <section aria-labelledby="recent-rooms-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="recent-rooms-heading" className="font-display text-base font-semibold text-slate-200">
              Recent rooms
            </h2>
            {recentRooms.length > 0 && (
              <span className="font-mono-tabular text-xs text-slate-500">
                {recentRooms.length} {recentRooms.length === 1 ? 'room' : 'rooms'}
              </span>
            )}
          </div>

          {loadingRecent ? (
            <RecentRoomsSkeleton />
          ) : recentError ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
            >
              {recentError}
            </div>
          ) : recentRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#12161F]/40 px-6 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400">
                <Hash className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-display text-sm font-semibold text-slate-200">
                No recent rooms yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
                Enter any room name above to start messaging. Rooms you create or visit stay saved to your account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recentRooms.map((item) => {
                const visitedDate =
                  item.lastVisitedAt && typeof item.lastVisitedAt.toDate === 'function'
                    ? item.lastVisitedAt.toDate()
                    : null;
                const isOwner = item.ownerUid === profile.uid;
                const existenceInfo = roomExistence.get(item.roomId);
                const isStaleDeleted = existenceInfo ? !existenceInfo.exists : false;
                const resolvedOwnerUsername =
                  existenceInfo?.createdByUsername || item.ownerUsername;

                const creatorText = isOwner
                  ? 'Created by you'
                  : resolvedOwnerUsername
                    ? `Created by @${resolvedOwnerUsername}`
                    : 'Created by another member';

                return (
                  <div
                    key={item.roomId}
                    className={`group flex items-center justify-between gap-2 rounded-xl border bg-[#12161F] p-1.5 transition-colors ${
                      isStaleDeleted
                        ? 'border-white/[0.05] opacity-75'
                        : 'border-white/[0.07] hover:border-indigo-500/30 hover:bg-[#151A25]'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isStaleDeleted}
                      onClick={() => void handleRejoinRecent(item)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 text-left disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-indigo-500"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isOwner
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}
                      >
                        {isOwner ? (
                          <Crown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Hash className="h-4 w-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {item.roomName}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              isOwner ? 'text-amber-300' : 'text-slate-400'
                            }`}
                          >
                            {!isOwner && <Shield className="h-3 w-3 text-slate-500" aria-hidden="true" />}
                            <span>{isOwner ? 'Owner' : 'Member'}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {isStaleDeleted ? (
                            <span className="text-rose-400">Room no longer exists</span>
                          ) : (
                            <>
                              <span>{creatorText}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono-tabular text-slate-500">
                                {formatRelativeVisit(visitedDate)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {!isStaleDeleted && (
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400"
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    {isOwner && !isStaleDeleted ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Delete ${item.roomName} permanently`}
                        title="Delete room permanently"
                        className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400 focus-visible:outline-2 focus-visible:outline-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleRemoveFromRecent(item)}
                        aria-label={`Remove ${item.roomName} from recent rooms`}
                        title="Remove from recent"
                        className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      <DeleteRoomModal
        isOpen={Boolean(deleteTarget)}
        roomId={deleteTarget?.roomId || ''}
        roomName={deleteTarget?.roomName || ''}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          const deletedName = deleteTarget?.roomName || 'Room';
          const deletedId = deleteTarget?.roomId || '';
          setDeleteTarget(null);
          showToast('success', 'Room deleted successfully', `#${deletedName} was removed for everyone.`, `deleted-${deletedId}`);
        }}
      />
    </div>
  );
}
