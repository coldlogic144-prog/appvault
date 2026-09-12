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
import { doc, getDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ERROR_CODES, createAppError } from '@comiclink/error-codes';
import type { UserAccount, PublicProfile, PublicProfileUpdate, UserAccountUpdate } from '@comiclink/shared-types';

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
): Promise<{ user: FirebaseUser; account: UserAccount; profile: PublicProfile }> {
  if (!auth || !db) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firebase Auth is not configured.');
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // Update Firebase Auth profile display name
    await updateProfile(user, { displayName });

    // 1. Private User Account: users/{uid}
    const initialAccount: UserAccount = {
      uid: user.uid,
      email: user.email || email,
      emailVerified: user.emailVerified,
      blockedUsers: [],
      clipboardSyncEnabled: true,
      deviceCount: 0,
      role: 'user',
      accountStatus: 'active',
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any
    };

    // 2. Public Presentation Profile: publicProfiles/{uid}
    const initialProfile: PublicProfile = {
      uid: user.uid,
      displayName: displayName.trim(),
      photoURL: null,
      bio: '',
      presenceStatus: 'online',
      updatedAt: serverTimestamp() as any
    };

    // Write both documents in a batch
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', user.uid), initialAccount);
    batch.set(doc(db, 'publicProfiles', user.uid), initialProfile);
    await batch.commit();

    return { user, account: initialAccount, profile: initialProfile };
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

export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  if (!db) return null;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data() as UserAccount;
}

export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  if (!db) return null;
  const profileRef = doc(db, 'publicProfiles', uid);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return null;
  return snap.data() as PublicProfile;
}

export async function updatePublicProfile(uid: string, data: PublicProfileUpdate): Promise<void> {
  if (!db) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firestore database is not configured.');
  }
  const profileRef = doc(db, 'publicProfiles', uid);
  await updateDoc(profileRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserAccount(uid: string, data: UserAccountUpdate): Promise<void> {
  if (!db) {
    throw createAppError(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'Firestore database is not configured.');
  }
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}
