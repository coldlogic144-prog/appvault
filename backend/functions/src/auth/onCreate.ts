import { beforeUserCreated, AuthUserRecord } from 'firebase-functions/v2/identity';
import { db, FieldValue } from '../shared/admin';
import { writeAuditLog } from '../shared/audit';
import { logger } from 'firebase-functions/v2';

export const authOnCreate = beforeUserCreated(async (event) => {
  const user: AuthUserRecord = event.data;
  const uid = user.uid;

  try {
    const userDoc = {
      uid,
      email: user.email || '',
      emailVerified: user.emailVerified || false,
      blockedUsers: [],
      clipboardSyncEnabled: true,
      deviceCount: 0,
      role: 'user',
      accountStatus: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const publicProfileDoc = {
      uid,
      displayName: user.displayName || 'AGENT',
      photoURL: user.photoURL || null,
      bio: '',
      presenceStatus: 'online',
      updatedAt: FieldValue.serverTimestamp(),
    };

    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), userDoc);
    batch.set(db.collection('publicProfiles').doc(uid), publicProfileDoc);
    await batch.commit();

    await writeAuditLog(uid, 'create_user_profile', 'user', uid);
    
    logger.info(`Successfully created user account and public profile for ${uid}`);
  } catch (error) {
    logger.error(`Error creating user documents for ${uid}`, error);
  }
  
  return {};
});
