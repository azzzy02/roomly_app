import {
  browserLocalPersistence,
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/src/lib/firebase';
import { OperationType, type UserProfile } from '@/src/types/chat';
import { handleFirestoreError } from '@/src/utils/errorHandling';
import {
  sanitizeInitialDisplayName,
  sanitizePhotoUrl,
  validateDisplayName,
} from '@/src/utils/validation';

export async function configureAuthPersistence(): Promise<void> {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('Auth persistence fallback:', error);
  }
}

export async function completeRedirectSignInIfAny(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (error) {
    console.error('Redirect sign-in error:', error);
    throw error;
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  await configureAuthPersistence();
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithGoogleRedirectFallback(): Promise<void> {
  await configureAuthPersistence();
  await signInWithRedirect(auth, googleProvider);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfile> {
  const userPath = `users/${firebaseUser.uid}`;
  const userRef = doc(db, 'users', firebaseUser.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (existingSnap.exists()) {
    const data = existingSnap.data() as UserProfile;
    const latestPhoto = sanitizePhotoUrl(firebaseUser.photoURL);
    // Keep photoURL synced if user updated their Google avatar and didn't break constraints
    if (latestPhoto && latestPhoto !== data.photoURL) {
      try {
        await updateDoc(userRef, {
          photoURL: latestPhoto,
          updatedAt: serverTimestamp(),
        });
        return { ...data, photoURL: latestPhoto };
      } catch {
        // Non-fatal if offline; return cached profile
        return data;
      }
    }
    return data;
  }

  const initialName = sanitizeInitialDisplayName(firebaseUser.displayName, firebaseUser.email);
  const email = (firebaseUser.email || '').trim();
  const photoURL = sanitizePhotoUrl(firebaseUser.photoURL);

  const newProfile = {
    uid: firebaseUser.uid,
    displayName: initialName,
    email,
    photoURL,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, newProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  return {
    uid: firebaseUser.uid,
    displayName: initialName,
    email,
    photoURL,
    createdAt: null,
    updatedAt: null,
  };
}

export async function updateUserDisplayName(uid: string, rawDisplayName: string): Promise<string> {
  const validation = validateDisplayName(rawDisplayName);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid display name.');
  }

  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    await updateDoc(userRef, {
      displayName: validation.trimmed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  return validation.trimmed;
}
