"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOnDelete = void 0;
const v1_1 = require("firebase-functions/v1");
const admin_1 = require("../shared/admin");
const audit_1 = require("../shared/audit");
exports.authOnDelete = v1_1.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    try {
        const batch = admin_1.db.batch();
        // Mark user as deleted
        const userRef = admin_1.db.collection('users').doc(uid);
        batch.update(userRef, {
            status: 'deleted',
            deletedAt: admin_1.FieldValue.serverTimestamp(),
            updatedAt: admin_1.FieldValue.serverTimestamp()
        });
        // Delete all user devices (soft delete)
        const devicesSnapshot = await admin_1.db.collection('users').doc(uid).collection('devices').get();
        devicesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref); // Alternatively could do a soft delete update
        });
        await batch.commit();
        await (0, audit_1.writeAuditLog)(uid, 'delete_user_profile', 'user', uid);
        v1_1.logger.info(`Successfully processed deletion for user ${uid}`);
    }
    catch (error) {
        v1_1.logger.error(`Error processing deletion for user ${uid}`, error);
    }
});
//# sourceMappingURL=onDelete.js.map