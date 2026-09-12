"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const admin_1 = require("./admin");
const https_1 = require("firebase-functions/v2/https");
async function checkRateLimit(uid, action, maxRequests, windowMs) {
    const ref = admin_1.db.collection('users').doc(uid).collection('rateLimits').doc(action);
    await admin_1.db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ref);
        const now = Date.now();
        if (!doc.exists) {
            transaction.set(ref, {
                count: 1,
                resetAt: new Date(now + windowMs),
            });
            return;
        }
        const data = doc.data();
        if (now > data.resetAt.toMillis()) {
            // Window expired, reset
            transaction.set(ref, {
                count: 1,
                resetAt: new Date(now + windowMs),
            });
        }
        else {
            // Still in window
            if (data.count >= maxRequests) {
                throw new https_1.HttpsError('resource-exhausted', `Rate limit exceeded for action: ${action}. Try again later.`);
            }
            transaction.update(ref, {
                count: admin_1.FieldValue.increment(1)
            });
        }
    });
}
//# sourceMappingURL=rate-limiter.js.map