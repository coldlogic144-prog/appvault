"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = writeAuditLog;
const admin_1 = require("./admin");
async function writeAuditLog(actorId, action, targetType, targetId, metadata, ipHash) {
    const logData = {
        actorId,
        action,
        targetType,
        targetId,
        createdAt: admin_1.FieldValue.serverTimestamp(),
    };
    if (metadata) {
        logData.metadata = metadata;
    }
    if (ipHash) {
        logData.ipHash = ipHash;
    }
    await admin_1.db.collection('auditLogs').add(logData);
}
//# sourceMappingURL=audit.js.map