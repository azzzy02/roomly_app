import { auth } from '@/src/lib/firebase';
import { OperationType, type FirestoreErrorInfo } from '@/src/types/chat';

export const ERROR_MESSAGES = {
  empty_room: 'Please enter a room name.',
  invalid_room: 'This room name is not valid.',
  empty_message: 'You cannot send an empty message.',
  message_too_long: 'Your message exceeds the 2000-character limit.',
  connection_lost: 'Connection lost. Trying to reconnect...',
  permission_denied: 'You do not have permission to access this room.',
  send_failed: 'Message could not be sent. Please retry.',
  room_unavailable: 'Unable to open this room. Please try again.',
} as const;

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: string; message?: string };
  if (errObj.code === 'permission-denied' || errObj.code === 'firestore/permission-denied') {
    return true;
  }
  const msg = (errObj.message || '').toLowerCase();
  return msg.includes('missing or insufficient permissions') || msg.includes('permission-denied');
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: string; message?: string };
  return (
    errObj.code === 'resource-exhausted' ||
    (errObj.message || '').toLowerCase().includes('quota exceeded')
  );
}

export function isNetworkUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { code?: string; message?: string };
  const code = (errObj.code || '').toLowerCase();
  const msg = (errObj.message || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'auth/network-request-failed' ||
    msg.includes('client is offline') ||
    msg.includes('network')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getHumanReadableError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error) {
    // Check if it's our structured FirestoreErrorInfo JSON
    if (error.message.startsWith('{')) {
      try {
        const parsed = JSON.parse(error.message) as FirestoreErrorInfo;
        const innerMsg = (parsed.error || '').toLowerCase();
        if (innerMsg.includes('missing or insufficient permissions') || innerMsg.includes('permission-denied')) {
          return ERROR_MESSAGES.permission_denied;
        }
        if (innerMsg.includes('quota exceeded') || innerMsg.includes('resource-exhausted')) {
          return 'Daily database quota exceeded. Please try again tomorrow.';
        }
        if (innerMsg.includes('unavailable') || innerMsg.includes('offline')) {
          return ERROR_MESSAGES.connection_lost;
        }
      } catch {
        // Ignore parse failure
      }
    }
  }

  if (error && typeof error === 'object') {
    const code = ((error as { code?: string }).code || '').toLowerCase();
    switch (code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled. Click Continue with Google whenever you are ready.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-in popup. Please allow popups for this site or try again.';
      case 'auth/network-request-failed':
        return 'Network error during authentication. Check your connection and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-token-expired':
      case 'auth/invalid-user-token':
        return 'Your session has expired. Please sign in again.';
      case 'permission-denied':
      case 'functions/permission-denied':
        return 'You do not have permission to perform this action.';
      case 'functions/unauthenticated':
        return 'Please sign in again to continue.';
      case 'functions/not-found':
      case 'functions/internal':
        return 'Permanent room deletion requires the deleteRoom Cloud Function to be deployed.';
      case 'unavailable':
      case 'functions/unavailable':
        return ERROR_MESSAGES.connection_lost;
      case 'resource-exhausted':
        return 'Service quota limit reached. Please try again shortly.';
      default:
        break;
    }
  }

  if (isPermissionDeniedError(error)) {
    return ERROR_MESSAGES.permission_denied;
  }
  if (isQuotaExceededError(error)) {
    return 'Service quota limit reached. Please try again later.';
  }
  if (isNetworkUnavailableError(error)) {
    return ERROR_MESSAGES.connection_lost;
  }

  if (error instanceof Error && error.message && !error.message.startsWith('{')) {
    return error.message;
  }

  return fallback;
}
