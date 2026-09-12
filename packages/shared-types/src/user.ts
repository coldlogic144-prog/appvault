export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

export type Timestamp = FirestoreTimestamp;

export type AccountStatus = 'active' | 'suspended' | 'deleted';
export type UserRole = 'user' | 'moderator' | 'admin';
export type PresenceStatus = 'online' | 'offline' | 'away';

/**
 * users/{uid} — Private Account Document.
 * Strictly owned and accessed only by the user themselves.
 * Contains PII, private settings, and server-owned security fields.
 */
export interface UserAccount {
  uid: string;
  email: string;
  emailVerified: boolean;
  blockedUsers: string[];
  clipboardSyncEnabled: boolean;
  deviceCount: number;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

/**
 * publicProfiles/{uid} — Public Presentation Document.
 * Read-accessible to all authenticated users.
 * Contains only non-sensitive visual and presence data.
 */
export interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  presenceStatus: PresenceStatus;
  updatedAt: FirestoreTimestamp;
}

export type PublicProfileUpdate = Partial<Pick<PublicProfile, 'displayName' | 'photoURL' | 'bio' | 'presenceStatus'>>;
export type UserAccountUpdate = Partial<Pick<UserAccount, 'clipboardSyncEnabled' | 'blockedUsers'>>;
