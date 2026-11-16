import React, { useEffect, useState } from 'react';
import { ArrowRight, Hash, Loader2 } from 'lucide-react';
import { ROOM_NAME_MAX_LENGTH, validateRoomName } from '@/src/utils/validation';

interface JoinRoomFormProps {
  initialValue?: string;
  onJoinRoom: (roomName: string) => Promise<void>;
  compact?: boolean;
  submitLabel?: string;
  helperNotice?: string | null;
}

export function JoinRoomForm({
  initialValue = '',
  onJoinRoom,
  compact = false,
  submitLabel = 'Join Room',
  helperNotice = null,
}: JoinRoomFormProps) {
  const [roomInput, setRoomInput] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialValue) {
      setRoomInput(initialValue);
      setError(null);
    }
  }, [initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validation = validateRoomName(roomInput);
    if (!validation.valid) {
      setError(validation.error || 'Please enter a valid room name.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onJoinRoom(validation.displayName);
      if (compact) {
        setRoomInput('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2.5" noValidate>
      <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3 sm:flex-row'}>
        <div className="relative flex-1">
          <Hash
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor={compact ? 'sidebar-room-input' : 'home-room-input'} className="sr-only">
            Room name
          </label>
          <input
            id={compact ? 'sidebar-room-input' : 'home-room-input'}
            type="text"
            value={roomInput}
            onChange={(e) => {
              setRoomInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder={compact ? 'Join or create room...' : 'Enter a room name (e.g. Product Design)'}
            maxLength={ROOM_NAME_MAX_LENGTH + 10}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'room-input-error' : undefined}
            className={`w-full rounded-xl border bg-[#0B0E14] pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
              compact ? 'h-10' : 'h-12'
            } ${
              error
                ? 'border-rose-500/70 focus-visible:outline-rose-500'
                : 'border-white/10 hover:border-white/20'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 font-display text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 whitespace-nowrap shrink-0 ${
            compact ? 'h-10 w-full' : 'h-12 sm:min-w-[140px]'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Entering...</span>
            </>
          ) : (
            <>
              <span>{submitLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {helperNotice && !error && (
        <p className="text-xs text-indigo-300" role="status">
          {helperNotice}
        </p>
      )}

      {error && (
        <p id="room-input-error" role="alert" className="text-xs font-medium text-rose-400">
          {error}
        </p>
      )}
    </form>
  );
}
