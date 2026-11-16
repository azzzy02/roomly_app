import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import {
  completeRedirectSignInIfAny,
  ensureUserProfile,
  signInWithGooglePopup,
  signInWithGoogleRedirectFallback,
  signOutUser,
  updateUserDisplayName,
} from '@/src/services/authService';
import { claimOrUpdateUsername } from '@/src/services/usernameService';
import type { UserProfile } from '@/src/types/chat';
import { getHumanReadableError } from '@/src/utils/errorHandling';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  needsUsernameSetup: boolean;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  popupBlocked: boolean;
  signIn: () => Promise<void>;
  signInWithRedirectFallback: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  updateUsername: (newUsername: string) => Promise<string>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState<boolean>(false);
  const activeUidRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void completeRedirectSignInIfAny().catch((err) => {
      if (mounted) {
        setAuthError(getHumanReadableError(err));
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      if (!user) {
        activeUidRef.current = null;
        setFirebaseUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const currentUid = user.uid;
      activeUidRef.current = currentUid;
      setFirebaseUser(user);

      try {
        const loadedProfile = await ensureUserProfile(user);
        if (mounted && activeUidRef.current === currentUid) {
          setProfile(loadedProfile);
          setAuthError(null);
        }
      } catch (err) {
        if (mounted && activeUidRef.current === currentUid) {
          setAuthError(getHumanReadableError(err, 'Unable to load your user profile.'));
        }
      } finally {
        if (mounted && activeUidRef.current === currentUid) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    setPopupBlocked(false);

    try {
      await signInWithGooglePopup();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-blocked') {
        setPopupBlocked(true);
      }
      setAuthError(getHumanReadableError(err));
    } finally {
      setSigningIn(false);
    }
  }, [signingIn]);

  const signInWithRedirectFallback = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogleRedirectFallback();
    } catch (err) {
      setAuthError(getHumanReadableError(err));
      setSigningIn(false);
    }
  }, [signingIn]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    activeUidRef.current = null;
    try {
      await signOutUser();
      setFirebaseUser(null);
      setProfile(null);
    } catch (err) {
      setAuthError(getHumanReadableError(err, 'Failed to sign out. Please try again.'));
    }
  }, []);

  const updateDisplayName = useCallback(
    async (newName: string) => {
      if (!firebaseUser) {
        throw new Error('You must be signed in to update your display name.');
      }
      const trimmed = await updateUserDisplayName(firebaseUser.uid, newName);
      setProfile((prev) => (prev ? { ...prev, displayName: trimmed } : prev));
    },
    [firebaseUser]
  );

  const updateUsername = useCallback(
    async (newUsername: string) => {
      if (!firebaseUser) {
        throw new Error('You must be signed in to claim a username.');
      }
      const claimed = await claimOrUpdateUsername(
        firebaseUser.uid,
        newUsername,
        profile?.username
      );
      setProfile((prev) => (prev ? { ...prev, username: claimed } : prev));
      return claimed;
    },
    [firebaseUser, profile?.username]
  );

  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setPopupBlocked(false);
  }, []);

  const needsUsernameSetup = Boolean(firebaseUser && profile && !profile.username);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      needsUsernameSetup,
      loading,
      signingIn,
      authError,
      popupBlocked,
      signIn,
      signInWithRedirectFallback,
      signOut,
      updateDisplayName,
      updateUsername,
      clearAuthError,
    }),
    [
      firebaseUser,
      profile,
      needsUsernameSetup,
      loading,
      signingIn,
      authError,
      popupBlocked,
      signIn,
      signInWithRedirectFallback,
      signOut,
      updateDisplayName,
      updateUsername,
      clearAuthError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
