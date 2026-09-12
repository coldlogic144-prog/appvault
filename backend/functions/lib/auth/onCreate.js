"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOnCreate = void 0;
const identity_1 = require("firebase-functions/v2/identity");
const admin_1 = require("../shared/admin");
const audit_1 = require("../shared/audit");
const v2_1 = require("firebase-functions/v2");
exports.authOnCreate = (0, identity_1.beforeUserCreated)(async (event) => {
    const user = event.data;
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
            createdAt: admin_1.FieldValue.serverTimestamp(),
            updatedAt: admin_1.FieldValue.serverTimestamp(),
        };
        await admin_1.db.collection('users').doc(uid).set(userDoc);
        await (0, audit_1.writeAuditLog)(uid, 'create_user_profile', 'user', uid);
        v2_1.logger.info(`Successfully created user profile for ${uid}`);
    }
    catch (error) {
        v2_1.logger.error(`Error creating user profile for ${uid}`, error);
        // Returning without throwing keeps the auth process going even if DB fails,
        // though in production we might want to handle this differently.
    }
    return {}; // Return empty modifications
});
//# sourceMappingURL=onCreate.js.map