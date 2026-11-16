import React, { useEffect } from 'react';
import { Calendar, Copy, Crown, Hash, Shield, Trash2, Users, X } from 'lucide-react';
import { Avatar } from '@/src/components/Avatar';
import type { Room, RoomMember } from '@/src/types/chat';
import { formatRoomCreatedDate } from '@/src/utils/formatting';

interface MembersPanelProps {
  room: Room | null;
  members: RoomMember[];
  currentUid: string;
  isOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCopyInvite: () => void;
  onRequestDeleteRoom: () => void;
}

export function MembersPanel({
  room,
  members,
  currentUid,
  isOwner,
  isOpen,
  onClose,
  onCopyInvite,
  onRequestDeleteRoom,
}: MembersPanelProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ownerUid = room?.createdBy;
  const createdDate =
    room?.createdAt && typeof room.createdAt.toDate === 'function'
      ? room.createdAt.toDate()
      : null;

  const sortedMembers = [...members].sort((a, b) => {
    const aIsOwner = a.uid === ownerUid || a.role === 'owner';
    const bIsOwner = b.uid === ownerUid || b.role === 'owner';
    if (aIsOwner !== bIsOwner) return aIsOwner ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const creatorLabel =
    room?.createdBy === currentUid
      ? 'you'
      : room?.createdByUsername
        ? `@${room.createdByUsername}`
        : room?.createdByDisplayName || 'Creator';

  const panelBody = (
    <div className="flex h-full w-72 flex-col border-l border-white/[0.07] bg-[#12161F]">
      {/* Panel Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-400" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-slate-100">Room details</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close room details panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Room Metadata Card */}
      {room && (
        <div className="border-b border-white/[0.07] p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <Hash className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-slate-100">
                {room.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Created by <span className="text-slate-200">{creatorLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span>Created {formatRoomCreatedDate(createdDate)}</span>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={onCopyInvite}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0B0E14]/70 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <Copy className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              <span>Copy invitation link</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={onRequestDeleteRoom}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Delete room permanently</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Member List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400">Members</h3>
          <span className="font-mono-tabular text-xs text-slate-500">{sortedMembers.length}</span>
        </div>

        {sortedMembers.length === 0 ? (
          <p className="text-xs text-slate-500">No active members loaded.</p>
        ) : (
          <ul className="space-y-1.5">
            {sortedMembers.map((member) => {
              const memberIsOwner = member.uid === ownerUid || member.role === 'owner';
              const isSelf = member.uid === currentUid;

              return (
                <li
                  key={member.uid}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/[0.03]"
                >
                  <Avatar
                    uid={member.uid}
                    name={member.displayName}
                    photoURL={member.photoURL}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-100">
                        {member.displayName}
                        {isSelf ? ' (you)' : ''}
                      </span>
                      {memberIsOwner && (
                        <Crown
                          className="h-3.5 w-3.5 shrink-0 text-amber-400"
                          aria-label="Room owner"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      {member.username && <span className="truncate">@{member.username}</span>}
                      {member.username && <span aria-hidden="true">·</span>}
                      <span className={memberIsOwner ? 'text-amber-300/90' : 'text-slate-500'}>
                        {memberIsOwner ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </div>
                  {!memberIsOwner && (
                    <Shield className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop collapsible right panel */}
      <aside className="hidden h-full shrink-0 xl:block" aria-label="Room members and info">
        {panelBody}
      </aside>

      {/* Tablet / Mobile slide-over drawer */}
      <div
        className="fixed inset-0 z-40 flex justify-end xl:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Room members and info"
      >
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside className="relative z-10 h-full max-w-[85vw] shadow-2xl">{panelBody}</aside>
      </div>
    </>
  );
}
