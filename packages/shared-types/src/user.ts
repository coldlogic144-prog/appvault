export type Timestamp = { seconds: number; nanoseconds: number } | any;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  status: 'active' | 'suspended' | 'deleted';
  role: 'user' | 'moderator' | 'admin';
  emailVerified: boolean;
  clipboardSyncEnabled: boolean;
  blockedUsers: string[];
  deviceCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type UserProfileUpdate = Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'bio' | 'clipboardSyncEnabled'>>;
