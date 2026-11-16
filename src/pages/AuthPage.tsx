import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, Lock, MessageSquare, Users } from 'lucide-react';
import { Logo } from '@/src/components/Logo';
import { FullPageAuthSkeleton } from '@/src/components/Skeletons';
import { useAuth } from '@/src/context/AuthContext';
import { parseRoomInviteFromSearch } from '@/src/utils/formatting';

export function AuthPage() {
  const {
    firebaseUser,
    profile,
    loading,
    signingIn,
    authError,
    popupBlocked,
    signIn,
    signInWithRedirectFallback,
  } = useAuth();
  const location = useLocation();
  const invite = parseRoomInviteFromSearch(location.search);

  if (loading) {
    return <FullPageAuthSkeleton />;
  }

  if (firebaseUser && profile) {
    const target = invite.present && invite.valid ? `/?room=${encodeURIComponent(invite.roomName)}` : '/';
    return <Navigate to={target} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#0B0E14] px-4 py-8 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Logo size="md" />
        <span className="text-xs font-medium text-slate-500">Real-time multiplayer rooms</span>
      </header>

      <main className="mx-auto my-auto flex w-full max-w-md flex-col justify-center py-10">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12161F] p-7 shadow-2xl shadow-black/50 sm:p-9">
          <div className="space-y-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100 sm:text-[28px] [text-wrap:balance]">
              Instant chat rooms, synced in real time
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              Sign in with Google to create or join rooms by name and message everyone in the room instantaneously.
            </p>
          </div>

          {invite.present && invite.valid && (
            <div className="mt-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs leading-relaxed text-indigo-200">
              You have an invitation to join <span className="font-semibold">#{invite.roomName}</span>. Sign in to enter the room.
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <div className="space-y-2">
                <p>{authError}</p>
                {popupBlocked && (
                  <button
                    type="button"
                    onClick={() => void signInWithRedirectFallback()}
                    className="inline-flex h-8 items-center rounded-lg border border-rose-400/30 bg-rose-500/20 px-3 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-500/30 focus-visible:outline-2 focus-visible:outline-rose-400"
                  >
                    Continue with redirect instead
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={signingIn}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-5 font-display text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              {signingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-700" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 border-t border-white/[0.07] pt-6 text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-400" aria-hidden="true" />
              <span>Deterministic rooms — enter any name to create or join</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-indigo-400" aria-hidden="true" />
              <span>Live presence and message history across sessions</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Lock className="h-3.5 w-3.5 shrink-0 text-indigo-400" aria-hidden="true" />
              <span>Room-isolated access enforced by Firestore rules</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-slate-600">
        Roomly · Authenticated messaging workspace
      </footer>
    </div>
  );
}
