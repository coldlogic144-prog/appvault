import { auth, logger } from 'firebase-functions/v1';
import { db, FieldValue } from '../shared/admin';
import { writeAuditLog } from '../shared/audit';

export const authOnDelete = auth.user().onDelete(async (user: auth.UserRecord) => {
  const uid = user.uid;

  try {
    const batch = db.batch();
    
    // Mark user as deleted
    const userRef = db.collection('users').doc(uid);
    batch.update(userRef, {
      status: 'deleted',
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Delete all user devices (soft delete)
    const devicesSnapshot = await db.collection('users').doc(uid).collection('devices').get();
    devicesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref); // Alternatively could do a soft delete update
    });

    await batch.commit();
    await writeAuditLog(uid, 'delete_user_profile', 'user', uid);

    logger.info(`Successfully processed deletion for user ${uid}`);
  } catch (error) {
    logger.error(`Error processing deletion for user ${uid}`, error);
  }
});
