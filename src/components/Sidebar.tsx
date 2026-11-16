import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Hash, Home, LogOut, Pencil, X } from 'lucide-react';
import { Avatar } from '@/src/components/Avatar';
import { JoinRoomForm } from '@/src/components/JoinRoomForm';
import { Logo } from '@/src/components/Logo';
import { RecentRoomsSkeleton } from '@/src/components/Skeletons';
import type { RecentRoom, UserProfile } from '@/src/types/chat';
import { formatRelativeVisit } from '@/src/utils/formatting';

interface SidebarProps {
  profile: UserProfile;
  recentRooms: RecentRoom[];
  loadingRecent: boolean;
  activeRoomId?: string;
  isOpen: boolean;
  onClose: () => void;
  onJoinOrCreateRoom: (roomName: string) => Promise<void>;
  onSelectRecentRoom: (room: RecentRoom) => void;
  onOpenProfile: () => void;
  onSignOut: () => Promise<void>;
}

export function Sidebar({
  profile,
  recentRooms,
  loadingRecent,
  activeRoomId,
  isOpen,
  onClose,
  onJoinOrCreateRoom,
  onSelectRecentRoom,
  onOpenProfile,
  onSignOut,
}: SidebarProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const content = (
    <div className="flex h-full w-72 flex-col border-r border-white/[0.07] bg-[#12161F]">
      {/* Top Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
        <Link
          to="/"
          onClick={onClose}
          className="rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/');
            }}
            aria-label="Go to home screen"
            title="Home"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <Home className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Join / Create */}
      <div className="border-b border-white/[0.07] p-4">
        <p className="mb-2.5 text-xs font-medium text-slate-400">Switch or create room</p>
        <JoinRoomForm
          compact
          submitLabel="Enter room"
          onJoinRoom={async (name) => {
            await onJoinOrCreateRoom(name);
            onClose();
          }}
        />
      </div>

      {/* Recent Rooms */}
      <nav aria-label="Recent rooms" className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold text-slate-400">Recent rooms</h2>
          {recentRooms.length > 0 && (
            <span className="font-mono-tabular text-xs text-slate-500">{recentRooms.length}</span>
          )}
        </div>

        {loadingRecent ? (
          <RecentRoomsSkeleton />
        ) : recentRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center">
            <p className="text-xs font-medium text-slate-400">No recent rooms yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Rooms you join or create appear here for quick access.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {recentRooms.map((item) => {
              const isActive = item.roomId === activeRoomId;
              const isOwner = item.ownerUid === profile.uid || item.role === 'owner';
              const visitedDate =
                item.lastVisitedAt && typeof item.lastVisitedAt.toDate === 'function'
                  ? item.lastVisitedAt.toDate()
                  : null;
              const ownerLabel = isOwner
                ? 'Owner'
                : item.ownerUsername
                  ? `@${item.ownerUsername}`
                  : 'Member';

              return (
                <li key={item.roomId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectRecentRoom(item);
                      onClose();
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/30'
                        : 'text-slate-300 hover:bg-white/[0.04] hover:text-slate-100'
                    }`}
                  >
                    <Hash
                      className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{item.roomName}</p>
                        {isOwner && (
                          <Crown
                            className="h-3 w-3 shrink-0 text-amber-400"
                            aria-label="Room created by you"
                          />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-slate-500">
                        <span>{ownerLabel}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono-tabular">{formatRelativeVisit(visitedDate)}</span>
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Bottom User Profile Bar (Username instead of raw email) */}
      <div className="shrink-0 border-t border-white/[0.07] p-3">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[#0B0E14]/70 p-2.5">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-indigo-500"
            title="Account settings"
          >
            <Avatar uid={profile.uid} name={profile.displayName} photoURL={profile.photoURL} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-slate-100">{profile.displayName}</p>
                <Pencil className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
              </div>
              <p className="truncate text-[11px] text-slate-400">
                {profile.username ? `@${profile.username}` : 'Set username'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void onSignOut()}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-rose-400 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full shrink-0 lg:block">{content}</aside>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Room navigation">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full max-w-[85vw] shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}
