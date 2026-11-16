import React, { useEffect, useState } from 'react';
import { AtSign, CheckCircle2, Loader2, LogOut, XCircle } from 'lucide-react';
import { Logo } from '@/src/components/Logo';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { checkUsernameAvailability } from '@/src/services/usernameService';
import { getHumanReadableError } from '@/src/utils/errorHandling';
import { USERNAME_MAX_LENGTH, validateUsername } from '@/src/utils/validation';

export function UsernameOnboardingScreen() {
  const { profile, updateUsername, signOut } = useAuth();
  const { showToast } = useToast();

  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{
    checkedValue: string;
    available: boolean;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setAvailability(null);
      setChecking(false);
      return;
    }

    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setAvailability({
        checkedValue: trimmed,
        available: false,
        error: validation.error,
      });
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed, profile?.uid);
        if (!cancelled) {
          setAvailability({
            checkedValue: trimmed,
            available: res.available,
            error: res.error,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAvailability({
            checkedValue: trimmed,
            available: false,
            error: getHumanReadableError(err, 'Unable to check username availability.'),
          });
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, profile?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validation = validateUsername(input);
    if (!validation.valid) {
      setSubmitError(validation.error || 'Please enter a valid username.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const claimed = await updateUsername(validation.username);
      showToast('success', 'Username claimed', `You are now @${claimed}.`, `username-${claimed}`);
    } catch (err) {
      const msg = getHumanReadableError(err, 'Unable to claim username.');
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#0B0E14] px-4 py-8 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Logo size="md" />
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          <LogOut className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12161F] p-7 shadow-2xl shadow-black/50 sm:p-8">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">
              Choose your username
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              Pick a unique handle so teammates and room members can identify you without exposing your email.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="onboarding-username" className="text-xs font-medium text-slate-300">
                  Username
                </label>
                <span className="font-mono-tabular text-xs text-slate-500">
                  {input.trim().length}/{USERNAME_MAX_LENGTH}
                </span>
              </div>

              <div className="relative mt-2">
                <AtSign
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="onboarding-username"
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (submitError) setSubmitError(null);
                  }}
                  placeholder="ayush_dev"
                  maxLength={USERNAME_MAX_LENGTH + 4}
                  autoComplete="username"
                  autoFocus
                  aria-invalid={Boolean(submitError || (availability && !availability.available))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0E14] pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-500"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                  ) : availability && availability.checkedValue === input.trim() ? (
                    availability.available ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400" aria-hidden="true" />
                    )
                  ) : null}
                </div>
              </div>

              {submitError ? (
                <p role="alert" className="mt-2 text-xs font-medium text-rose-400">
                  {submitError}
                </p>
              ) : availability && availability.checkedValue === input.trim() ? (
                availability.available ? (
                  <p role="status" className="mt-2 text-xs font-medium text-emerald-400">
                    @{availability.checkedValue} is available
                  </p>
                ) : (
                  <p role="alert" className="mt-2 text-xs font-medium text-rose-400">
                    {availability.error || 'This username is already taken.'}
                  </p>
                )
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  3–20 characters. Letters, numbers, underscores, periods, and hyphens.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || checking || Boolean(availability && !availability.available)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 font-display text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Claiming username...</span>
                </>
              ) : (
                <span>Continue to Roomly</span>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-slate-600">
        Roomly · Unique identity setup
      </footer>
    </div>
  );
}
