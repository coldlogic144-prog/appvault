import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export function validateAuth(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to call this function.');
  }
}

export function validateEmailVerified(request: CallableRequest): void {
  validateAuth(request);
  if (!request.auth?.token.email_verified) {
    throw new HttpsError('permission-denied', 'User must have a verified email address.');
  }
}

export function getAuthUid(request: CallableRequest): string {
  validateAuth(request);
  return request.auth!.uid;
}
