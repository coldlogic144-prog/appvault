import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

export const isEmulatorMode = import.meta.env.VITE_USE_EMULATORS === 'true';

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

export const missingEnvKeys = requiredEnvKeys.filter((key) => !import.meta.env[key]);
export const isFirebaseConfigValid = isEmulatorMode || missingEnvKeys.length === 0;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigValid) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (isEmulatorMode ? 'emulator-dummy-key' : ''),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (isEmulatorMode ? 'localhost' : ''),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (isEmulatorMode ? 'comiclink-dev' : ''),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || (isEmulatorMode ? '1:12345:web:emulator' : ''),
  };

  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (isEmulatorMode) {
    const authPort = Number(import.meta.env.VITE_EMULATOR_AUTH_PORT || 9099);
    const firestorePort = Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT || 8080);
    const storagePort = Number(import.meta.env.VITE_EMULATOR_STORAGE_PORT || 9199);

    try {
      connectAuthEmulator(auth, `http://localhost:${authPort}`, { disableWarnings: true });
      connectFirestoreEmulator(db, 'localhost', firestorePort);
      connectStorageEmulator(storage, 'localhost', storagePort);
      console.log(`[Firebase] Connected to local emulators: Auth:${authPort}, Firestore:${firestorePort}, Storage:${storagePort}`);
    } catch {
      // Ignore if emulators were already connected in HMR
    }
  }
}

export { app, auth, db, storage };
