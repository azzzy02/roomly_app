import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { OperationType } from '@/src/types/chat';
import { handleFirestoreError } from '@/src/utils/errorHandling';
import { normalizeUsername, validateUsername } from '@/src/utils/validation';

export interface UsernameAvailability {
  valid: boolean;
  available: boolean;
  username: string;
  normalizedUsername: string;
  ownedByUid: string | null;
  error?: string;
}

export async function checkUsernameAvailability(
  rawUsername: string,
  currentUid?: string
): Promise<UsernameAvailability> {
  const validation = validateUsername(rawUsername);
  if (!validation.valid) {
    return {
      valid: false,
      available: false,
      username: validation.username,
      normalizedUsername: validation.normalizedUsername,
      ownedByUid: null,
      error: validation.error,
    };
  }

  const path = `usernames/${validation.normalizedUsername}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', validation.normalizedUsername));
    if (!snap.exists()) {
      return {
        valid: true,
        available: true,
        username: validation.username,
        normalizedUsername: validation.normalizedUsername,
        ownedByUid: null,
      };
    }

    const ownerUid = (snap.data()?.uid as string) || null;
    const isSelf = Boolean(currentUid && ownerUid === currentUid);
    return {
      valid: true,
      available: isSelf,
      username: validation.username,
      normalizedUsername: validation.normalizedUsername,
      ownedByUid: ownerUid,
      error: isSelf ? undefined : 'This username is already taken.',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function claimOrUpdateUsername(
  uid: string,
  rawUsername: string,
  previousUsername?: string
): Promise<string> {
  const validation = validateUsername(rawUsername);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid username.');
  }

  const { username, normalizedUsername } = validation;
  const newPath = `usernames/${normalizedUsername}`;
  const newRef = doc(db, 'usernames', normalizedUsername);
  const userRef = doc(db, 'users', uid);

  const prevNorm = previousUsername ? normalizeUsername(previousUsername).normalizedUsername : '';
  const hasDifferentPrev = Boolean(prevNorm && prevNorm !== normalizedUsername);
  const oldRef = hasDifferentPrev ? doc(db, 'usernames', prevNorm) : null;

  try {
    await runTransaction(db, async (tx) => {
      const newSnap = await tx.get(newRef);
      let oldSnap: DocumentSnapshot | null = null;
      if (oldRef) {
        oldSnap = await tx.get(oldRef);
      }

      if (newSnap.exists() && newSnap.data()?.uid !== uid) {
        throw new Error('This username is already taken.');
      }

      if (!newSnap.exists()) {
        tx.set(newRef, {
          uid,
          username,
          normalizedUsername,
          createdAt: serverTimestamp(),
        });
      }

      tx.update(userRef, {
        username,
        updatedAt: serverTimestamp(),
      });

      if (oldRef && oldSnap && oldSnap.exists() && oldSnap.data()?.uid === uid) {
        tx.delete(oldRef);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'This username is already taken.') {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, newPath);
  }

  return username;
}
