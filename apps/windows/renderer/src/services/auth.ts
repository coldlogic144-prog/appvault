import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  NextOrObserver
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ERROR_CODES, createAppError } from '@comiclink/error-codes';
import type { UserProfile } from '@comiclink/shared-types';

export function mapFirebaseAuthError(errorCode: string): { code: string; message: string } {
  switch (errorCode) {
    case 'auth/invalid-email':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return createAppError(ERROR_CODES.AUTH.INVALID_CREDENTIALS, 'Invalid email address or passcode.');
    case 'auth/email-already-in-use':
      return createAppError(ERROR_CODES.AUTH.USER_COLLISION, 'An account with this email address already exists.');
    case 'auth/weak-password':
      return createAppError(ERROR_CODES.AUTH.WEAK_PASSWORD, 'Passcode must be at least 8 characters with sufficient strength.');
    case 'auth/too-many-requests':
      return createAppError(ERROR_CODES.AUTH.TOO_MANY_REQUESTS, 'Access blocked temporarily due to multiple failed attempts. Try again later.');
    case 'auth/network-request-failed':
      return createAppError(ERROR_CODES.AUTH.NETWORK_ERROR, 'Network connectivity error. Check your connection or emulator status.');
    default:
      return createAppError(ERROR_CODES.GENERAL.INTERNAL_ERROR, 'Authentication failed. Please verify your credentials and try again.');
  }
}

export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string
): Promise<{ user: FirebaseUser; profile: UserProfile }> {
  if (!auth || !db) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firebase Auth is not configured.');
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // Update Firebase Auth profile display name
    await updateProfile(user, { displayName });

    // Client only writes safe, user-owned initial profile fields.
    // Role, status, and system counters are server-governed.
    const initialProfile: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName: displayName.trim(),
      photoURL: null,
      bio: '',
      status: 'active',
      role: 'user',
      emailVerified: user.emailVerified,
      clipboardSyncEnabled: true,
      blockedUsers: [],
      deviceCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, initialProfile);

    return { user, profile: initialProfile };
  } catch (error: any) {
    const mapped = mapFirebaseAuthError(error.code || '');
    throw createAppError(mapped.code, mapped.message, error);
  }
}

export async function loginWithEmail(
  email: string,
  pass: string
): Promise<FirebaseUser> {
  if (!auth) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firebase Auth is not configured.');
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (error: any) {
    const mapped = mapFirebaseAuthError(error.code || '');
    throw createAppError(mapped.code, mapped.message, error);
  }
}

export async function logout(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firebase Auth is not configured.');
  }

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    // To prevent account enumeration, treat non-fatal errors generically
    if (error.code === 'auth/user-not-found') {
      return; // Do not reveal that account does not exist
    }
    const mapped = mapFirebaseAuthError(error.code || '');
    throw createAppError(mapped.code, mapped.message, error);
  }
}

export function observeAuthState(
  observer: NextOrObserver<FirebaseUser | null>
): () => void {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, observer);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}
