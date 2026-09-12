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
            email: user.email || '',
            emailVerified: user.emailVerified || false,
            blockedUsers: [],
            clipboardSyncEnabled: true,
            deviceCount: 0,
            role: 'user',
            accountStatus: 'active',
            createdAt: admin_1.FieldValue.serverTimestamp(),
            updatedAt: admin_1.FieldValue.serverTimestamp(),
        };
        const publicProfileDoc = {
            uid,
            displayName: user.displayName || 'AGENT',
            photoURL: user.photoURL || null,
            bio: '',
            presenceStatus: 'online',
            updatedAt: admin_1.FieldValue.serverTimestamp(),
        };
        const batch = admin_1.db.batch();
        batch.set(admin_1.db.collection('users').doc(uid), userDoc);
        batch.set(admin_1.db.collection('publicProfiles').doc(uid), publicProfileDoc);
        await batch.commit();
        await (0, audit_1.writeAuditLog)(uid, 'create_user_profile', 'user', uid);
        v2_1.logger.info(`Successfully created user account and public profile for ${uid}`);
    }
    catch (error) {
        v2_1.logger.error(`Error creating user documents for ${uid}`, error);
    }
    return {};
});
//# sourceMappingURL=onCreate.js.map