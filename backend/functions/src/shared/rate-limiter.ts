import { db, FieldValue } from './admin';
import { HttpsError } from 'firebase-functions/v2/https';

interface RateLimitData {
  count: number;
  resetAt: FirebaseFirestore.Timestamp;
}

export async function checkRateLimit(
  uid: string,
  action: string,
  maxRequests: number,
  windowMs: number
): Promise<void> {
  const ref = db.collection('users').doc(uid).collection('rateLimits').doc(action);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const now = Date.now();

    if (!doc.exists) {
      transaction.set(ref, {
        count: 1,
        resetAt: new Date(now + windowMs),
      });
      return;
    }

    const data = doc.data() as RateLimitData;
    
    if (now > data.resetAt.toMillis()) {
      // Window expired, reset
      transaction.set(ref, {
        count: 1,
        resetAt: new Date(now + windowMs),
      });
    } else {
      // Still in window
      if (data.count >= maxRequests) {
        throw new HttpsError('resource-exhausted', `Rate limit exceeded for action: ${action}. Try again later.`);
      }
      transaction.update(ref, {
        count: FieldValue.increment(1)
      });
    }
  });
}
