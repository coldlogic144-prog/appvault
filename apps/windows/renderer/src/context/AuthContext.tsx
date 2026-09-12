import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import type { UserAccount, PublicProfile, PublicProfileUpdate, UserAccountUpdate } from '@comiclink/shared-types';
import {
  observeAuthState,
  loginWithEmail,
  registerWithEmail,
  logout as authLogout,
  sendPasswordReset as authReset,
  getUserAccount,
  getPublicProfile,
  updatePublicProfile,
  updateUserAccount
} from '../services/auth';
import { registerCurrentDevice, getLocalDeviceId } from '../services/device';
import { isFirebaseConfigValid } from '../services/firebase';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userAccount: UserAccount | null;
  publicProfile: PublicProfile | null;
  loading: boolean;
  error: string | null;
  currentDeviceId: string;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: PublicProfileUpdate) => Promise<void>;
  updateAccount: (data: UserAccountUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentDeviceId = getLocalDeviceId();

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
        await Promise.allSettled([
          loadUserData(user.uid),
          registerCurrentDevice(user.uid)
        ]);
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
      await Promise.allSettled([
        loadUserData(user.uid),
        registerCurrentDevice(user.uid)
      ]);
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
      await registerCurrentDevice(user.uid).catch((e) => console.warn('[AuthContext] Device registration warning:', e));
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

  const updateProfile = async (data: PublicProfileUpdate) => {
    if (!currentUser) throw new Error('Not authenticated');
    setError(null);
    try {
      await updatePublicProfile(currentUser.uid, data);
      setPublicProfile((prev) => prev ? { ...prev, ...data } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to update public profile');
      throw err;
    }
  };

  const updateAccount = async (data: UserAccountUpdate) => {
    if (!currentUser) throw new Error('Not authenticated');
    setError(null);
    try {
      await updateUserAccount(currentUser.uid, data);
      setUserAccount((prev) => prev ? { ...prev, ...data } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to update account preferences');
      throw err;
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
        currentDeviceId,
        login,
        register,
        logout,
        sendReset,
        clearError,
        refreshProfile,
        updateProfile,
        updateAccount
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
