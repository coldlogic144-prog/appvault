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
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      role: 'user',
      status: 'active',
      deviceCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(uid).set(userDoc);
    await writeAuditLog(uid, 'create_user_profile', 'user', uid);
    
    logger.info(`Successfully created user profile for ${uid}`);
  } catch (error) {
    logger.error(`Error creating user profile for ${uid}`, error);
    // Returning without throwing keeps the auth process going even if DB fails,
    // though in production we might want to handle this differently.
  }
  
  return {}; // Return empty modifications
});
