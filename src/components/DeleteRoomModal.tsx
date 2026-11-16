import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { deleteRoomPermanently } from '@/src/services/roomService';
import { getHumanReadableError } from '@/src/utils/errorHandling';

interface DeleteRoomModalProps {
  isOpen: boolean;
  roomId: string;
  roomName: string;
  onClose: () => void;
  onBeforeDelete?: () => void;
  onDeleted: () => void;
}

export function DeleteRoomModal({
  isOpen,
  roomId,
  roomName,
  onClose,
  onBeforeDelete,
  onDeleted,
}: DeleteRoomModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDeleting(false);
    }
  }, [isOpen, roomId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, deleting, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);

    try {
      onBeforeDelete?.();
      await deleteRoomPermanently(roomId);
      onDeleted();
    } catch (err) {
      setError(
        getHumanReadableError(
          err,
          'Unable to delete this room. Ensure the deleteRoom Cloud Function is deployed.'
        )
      );
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-room-title"
      onClick={() => !deleting && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12161F] p-6 shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="delete-room-title" className="font-display text-base font-semibold text-slate-100">
                Delete #{roomName} permanently?
              </h2>
              <p className="text-xs text-slate-400">Owner action</p>
            </div>
          </div>

          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            aria-label="Close delete confirmation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          This permanently deletes <span className="font-semibold text-slate-100">#{roomName}</span>, all of its messages, all active memberships, and everyone&apos;s recent room references. This cannot be undone.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-rose-200"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="h-10 rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleConfirm()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Delete room</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
