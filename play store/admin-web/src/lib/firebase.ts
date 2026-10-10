import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAn4MTUhIBPwh9n8pWiDipkUeg6UMQTt10",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "playstore-d0ba0.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "playstore-d0ba0",
  messagingSenderId: "994688766053",
  appId: "1:994688766053:android:0a9c88b30272b2b488f68c"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
