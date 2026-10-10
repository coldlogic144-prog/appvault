'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  idToken: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshAdminStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  idToken: null,
  signIn: async () => ({ success: false }),
  signOut: async () => {},
  refreshAdminStatus: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  const checkAdminPrivileges = async (firebaseUser: User, forceRefresh = false): Promise<boolean> => {
    try {
      const tokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
      setIdToken(tokenResult.token);

      // Check Layer 1: Firebase Auth Custom Claim (admin: true)
      if (tokenResult.claims && tokenResult.claims.admin === true) {
        setIsAdmin(true);
        return true;
      }

      // Check Layer 2: Cloud Firestore collection /admins/{uid}
      const adminDocRef = doc(db, 'admins', firebaseUser.uid);
      const adminDoc = await getDoc(adminDocRef);
      if (adminDoc.exists()) {
        const data = adminDoc.data();
        if (data.admin === true || data.role === 'admin') {
          setIsAdmin(true);
          return true;
        }
      }

      setIsAdmin(false);
      return false;
    } catch (err) {
      console.error('Error verifying admin privileges:', err);
      setIsAdmin(false);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkAdminPrivileges(currentUser, true);
      } else {
        setIsAdmin(false);
        setIdToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const isAdm = await checkAdminPrivileges(cred.user, true);
      if (!isAdm) {
        return {
          success: false,
          error: "Access Denied: This account is authenticated but does not possess administrator privileges."
        };
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Authentication failed"
      };
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setUser(null);
    setIsAdmin(false);
    setIdToken(null);
  };

  const refreshAdminStatus = async () => {
    if (!auth.currentUser) return false;
    return await checkAdminPrivileges(auth.currentUser, true);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      loading,
      idToken,
      signIn,
      signOut,
      refreshAdminStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
