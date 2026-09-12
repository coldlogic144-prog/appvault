import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import type { UserAccount, PublicProfile } from '@comiclink/shared-types';
import {
  observeAuthState,
  loginWithEmail,
  registerWithEmail,
  logout as authLogout,
  sendPasswordReset as authReset,
  getUserAccount,
  getPublicProfile
} from '../services/auth';
import { isFirebaseConfigValid } from '../services/firebase';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userAccount: UserAccount | null;
  publicProfile: PublicProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserData = async (uid: string) => {
    try {
      const [account, profile] = await Promise.all([
        getUserAccount(uid),
        getPublicProfile(uid)
      ]);
      setUserAccount(account);
      setPublicProfile(profile);
    } catch (err: any) {
      console.error('[AuthContext] Error fetching user documents:', err);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigValid) {
      setLoading(false);
      return;
    }

    const unsubscribe = observeAuthState(async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserData(user.uid);
      } else {
        setUserAccount(null);
        setPublicProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithEmail(email, pass);
      setCurrentUser(user);
      await loadUserData(user.uid);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string, displayName: string) => {
    setError(null);
    setLoading(true);
    try {
      const { user, account, profile } = await registerWithEmail(email, pass, displayName);
      setCurrentUser(user);
      setUserAccount(account);
      setPublicProfile(profile);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    setLoading(true);
    try {
      await authLogout();
      setCurrentUser(null);
      setUserAccount(null);
      setPublicProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (email: string) => {
    setError(null);
    try {
      await authReset(email);
    } catch (err: any) {
      setError(err.message || 'Password reset request failed');
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await loadUserData(currentUser.uid);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userAccount,
        publicProfile,
        loading,
        error,
        login,
        register,
        logout,
        sendReset,
        clearError,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
