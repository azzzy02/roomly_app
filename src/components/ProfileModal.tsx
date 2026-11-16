import React, { useEffect, useState } from 'react';
import { AtSign, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { Avatar } from '@/src/components/Avatar';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { checkUsernameAvailability } from '@/src/services/usernameService';
import { getHumanReadableError } from '@/src/utils/errorHandling';
import { maskEmail } from '@/src/utils/formatting';
import {
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeUsername,
  validateDisplayName,
  validateUsername,
} from '@/src/utils/validation';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, updateDisplayName, updateUsername } = useAuth();
  const { showToast } = useToast();

  const [nameInput, setNameInput] = useState(profile?.displayName || '');
  const [usernameInput, setUsernameInput] = useState(profile?.username || '');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checkedValue: string;
    available: boolean;
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setNameInput(profile.displayName);
      setUsernameInput(profile.username || '');
      setUsernameStatus(null);
      setError(null);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  useEffect(() => {
    if (!isOpen || !profile) return;
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setUsernameStatus(null);
      setCheckingUsername(false);
      return;
    }

    const currentNorm = profile.username ? normalizeUsername(profile.username).normalizedUsername : '';
    const nextNorm = normalizeUsername(trimmed).normalizedUsername;
    if (currentNorm && nextNorm === currentNorm) {
      setUsernameStatus({ checkedValue: trimmed, available: true });
      setCheckingUsername(false);
      return;
    }

    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setUsernameStatus({ checkedValue: trimmed, available: false, error: validation.error });
      setCheckingUsername(false);
      return;
    }

    let cancelled = false;
    setCheckingUsername(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed, profile.uid);
        if (!cancelled) {
          setUsernameStatus({
            checkedValue: trimmed,
            available: res.available,
            error: res.error,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setUsernameStatus({
            checkedValue: trimmed,
            available: false,
            error: getHumanReadableError(err, 'Unable to verify username availability.'),
          });
        }
      } finally {
        if (!cancelled) {
          setCheckingUsername(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, usernameInput, profile]);

  if (!isOpen || !profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const nameValidation = validateDisplayName(nameInput);
    if (!nameValidation.valid) {
      setError(nameValidation.error || 'Please enter a valid display name.');
      return;
    }

    const usernameValidation = validateUsername(usernameInput);
    if (!usernameValidation.valid) {
      setError(usernameValidation.error || 'Please enter a valid username.');
      return;
    }

    const nameChanged = nameValidation.trimmed !== profile.displayName;
    const usernameChanged = usernameValidation.username !== (profile.username || '');

    if (!nameChanged && !usernameChanged) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (usernameChanged) {
        await updateUsername(usernameValidation.username);
      }
      if (nameChanged) {
        await updateDisplayName(nameValidation.trimmed);
      }
      showToast(
        'success',
        'Profile updated',
        `${nameValidation.trimmed} (@${usernameValidation.username})`,
        'profile-updated'
      );
      onClose();
    } catch (err) {
      setError(getHumanReadableError(err, 'Could not update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12161F] p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="profile-modal-title" className="font-display text-lg font-semibold text-slate-100">
            Account settings
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close account settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3.5 border-b border-white/[0.07] pb-5">
          <Avatar uid={profile.uid} name={profile.displayName} photoURL={profile.photoURL} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{profile.displayName}</p>
            {profile.username && (
              <p className="truncate text-xs text-indigo-300">@{profile.username}</p>
            )}
            <p className="truncate text-xs text-slate-500">{maskEmail(profile.email)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="profile-display-name" className="text-xs font-medium text-slate-300">
                Display name
              </label>
              <span className="font-mono-tabular text-xs text-slate-500">
                {nameInput.trim().length}/{DISPLAY_NAME_MAX_LENGTH}
              </span>
            </div>
            <input
              id="profile-display-name"
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (error) setError(null);
              }}
              maxLength={DISPLAY_NAME_MAX_LENGTH + 6}
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0B0E14] px-3.5 text-sm text-slate-100 placeholder:text-slate-500 hover:border-white/20 focus-visible:outline-2 focus-visible:outline-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="profile-username" className="text-xs font-medium text-slate-300">
                Unique username
              </label>
              <span className="font-mono-tabular text-xs text-slate-500">
                {usernameInput.trim().length}/{USERNAME_MAX_LENGTH}
              </span>
            </div>
            <div className="relative mt-2">
              <AtSign
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="profile-username"
                type="text"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={USERNAME_MAX_LENGTH + 4}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0E14] pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 hover:border-white/20 focus-visible:outline-2 focus-visible:outline-indigo-500"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingUsername ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                ) : usernameStatus && usernameStatus.checkedValue === usernameInput.trim() ? (
                  usernameStatus.available ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-400" aria-hidden="true" />
                  )
                ) : null}
              </div>
            </div>
            {usernameStatus &&
              usernameStatus.checkedValue === usernameInput.trim() &&
              !usernameStatus.available && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-rose-400">
                  {usernameStatus.error || 'This username is already taken.'}
                </p>
              )}
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-10 rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                checkingUsername ||
                Boolean(usernameStatus && !usernameStatus.available)
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-indigo-400 whitespace-nowrap"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{saving ? 'Saving...' : 'Save changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
