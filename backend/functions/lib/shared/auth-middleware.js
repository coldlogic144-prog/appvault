"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = validateAuth;
exports.validateEmailVerified = validateEmailVerified;
exports.getAuthUid = getAuthUid;
const https_1 = require("firebase-functions/v2/https");
function validateAuth(request) {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to call this function.');
    }
}
function validateEmailVerified(request) {
    validateAuth(request);
    if (!request.auth?.token.email_verified) {
        throw new https_1.HttpsError('permission-denied', 'User must have a verified email address.');
    }
}
function getAuthUid(request) {
    validateAuth(request);
    return request.auth.uid;
}
//# sourceMappingURL=auth-middleware.js.map