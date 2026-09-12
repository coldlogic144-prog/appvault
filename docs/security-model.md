# ComicLink Security Model & Threat Specifications

This document defines the comprehensive security architecture, authorization controls, threat mitigations, and defense-in-depth principles implemented across ComicLink.

---

## 1. Authentication Architecture

ComicLink relies on **Firebase Authentication** as its foundational identity provider:

```
[ Desktop Client ]  -->  [ Firebase Auth Service ]
                              |
                              +--> Validates Credentials (Email/Password or Google OAuth)
                              +--> Enforces Email Verification
                              +--> Generates Signed JWT (ID Token, 1h lifespan)
                              +--> Injects Claims (uid, email_verified)
```

### 1.1 Credential Mechanisms
- **Email & Password**: Primary authentication mechanism. Passwords must satisfy security complexity: minimum 8 characters, at least one uppercase letter, one number, and one symbol. Passwords are never sent to or stored on ComicLink custom servers; hashing is managed directly by Firebase Auth infrastructure (scrypt).
- **Google OAuth (Optional)**: Provides federated identity via native browser loopback or secure redirect.
- **Email Verification**: Critical operations (e.g., initiating device pairing, posting publicly to the community feed) require `request.auth.token.email_verified == true`. Verification emails are triggered upon account registration.

### 1.2 Token Lifecycle & Session Management
- Tokens are short-lived JSON Web Tokens (JWTs) valid for 60 minutes.
- Refresh tokens are managed securely in the desktop client's protected application storage.
- Revocation of user sessions (via password change or account compromise) invalidates the refresh token, terminating access within the token refresh window.

---

## 2. Multi-Layered Authorization Architecture

ComicLink implements a three-tier defense-in-depth authorization model:

```
+--------------------------------------------------------------------------------+
|                             AUTHORIZATION TIERS                                |
+--------------------------------------------------------------------------------+
|  Layer 1: Firestore Declarative Security Rules                                 |
|  - Real-time evaluation on every database read, write, update, and delete      |
|  - Verifies auth context (request.auth.uid)                                    |
|  - Validates document schemas, field immutability, and server timestamps       |
|  - Evaluates relationship boundaries (membership arrays, ownership paths)      |
+--------------------------------------------------------------------------------+
|  Layer 2: Cloud Storage Security Rules                                         |
|  - Path-based user isolation (`files/{uid}/**`, `avatars/{uid}/**`)             |
|  - MIME-type whitelisting (images, zip, pdf, text)                             |
|  - Strict byte-size ceilings (50MB maximum per file)                           |
+--------------------------------------------------------------------------------+
|  Layer 3: Cloud Functions Privilege Barrier                                    |
|  - Server-side execution using Firebase Admin SDK                              |
|  - Contextual token validation on every callable function                      |
|  - Business logic invariant enforcement (rate limiting, multi-doc transactions)|
|  - Append-only audit logging inaccessible to clients                           |
+--------------------------------------------------------------------------------+
```

---

## 3. Ownership & Access Control Patterns

### 3.1 Direct Ownership Model
Every individual resource (e.g., file metadata, clipboard item, community post) contains an immutable ownership identifier (`ownerUid` or `authorUid`). 

In Firestore Security Rules, write operations mandate that the authenticated caller matches this identifier:
```javascript
// Firestore Rule Snippet: Clipboard Items
match /clipboardItems/{clipboardId} {
  allow read, delete: if request.auth != null && request.auth.uid == resource.data.ownerUid;
  allow create: if request.auth != null 
    && request.resource.data.ownerUid == request.auth.uid
    && request.resource.data.createdAt == request.time;
  allow update: if request.auth != null 
    && request.auth.uid == resource.data.ownerUid
    && request.resource.data.ownerUid == resource.data.ownerUid
    && request.resource.data.updatedAt == request.time;
}
```

### 3.2 Path-Based Subcollection Ownership
User devices are modeled as subcollections under the user's document path: `/users/{uid}/devices/{deviceId}`. Ownership is inherently guaranteed by the document path:
```javascript
// Firestore Rule Snippet: Path-Based Device Isolation
match /users/{uid}/devices/{deviceId} {
  allow read, write, delete: if request.auth != null && request.auth.uid == uid;
}
```
Any attempt by user `uid_A` to access `/users/uid_B/devices/{deviceId}` is rejected at the rule engine level without querying data.

### 3.3 Conversation Membership
Multi-party communication (conversations, messages, and membership metadata) utilizes array membership verification:
- The parent conversation document maintains a `memberUids` array: `['uid_1', 'uid_2']`.
- Security rules verify membership before granting read or message insertion permissions:
```javascript
// Firestore Rule Snippet: Conversation & Message Security
match /conversations/{conversationId} {
  allow read: if request.auth != null && request.auth.uid in resource.data.memberUids;
  allow create: if request.auth != null && request.auth.uid in request.resource.data.memberUids;
  allow update: if request.auth != null 
    && request.auth.uid in resource.data.memberUids
    && request.resource.data.createdBy == resource.data.createdBy;

  match /messages/{messageId} {
    allow read: if request.auth != null 
      && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.memberUids;
    allow create: if request.auth != null 
      && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.memberUids
      && request.resource.data.senderUid == request.auth.uid
      && request.resource.data.createdAt == request.time;
    allow update, delete: if request.auth != null && request.auth.uid == resource.data.senderUid;
  }
}
```

---

## 4. Integrity and Immutability Controls

### 4.1 Strict Server Timestamps
Clients cannot supply arbitrary creation or modification timestamps. This prevents clock manipulation, replay attacks, and falsified timeline sorting. Rules enforce equality with `request.time`:
```javascript
// Enforcing request.time on creation and mutation
request.resource.data.createdAt == request.time
request.resource.data.updatedAt == request.time
```

### 4.2 Field Immutability
Critical identifiers and relational links must never be altered once created. Rules enforce immutability by inspecting modified fields:
```javascript
// Disallow mutation of ownerUid, createdAt, and id
allow update: if request.auth.uid == resource.data.ownerUid
  && request.resource.data.id == resource.data.id
  && request.resource.data.ownerUid == resource.data.ownerUid
  && request.resource.data.createdAt == resource.data.createdAt;
```

### 4.3 Zero Client-Side Trust (No Client-Side Authorization)
Client-side permission checks in the React frontend (e.g., hiding a delete button if `user.uid !== post.authorUid`) exist strictly for User Experience (UX). All security guarantees are enforced authoritatively by the Firebase Security Rules engine and Cloud Functions. A modified or compromised client cannot bypass these checks.

---

## 5. Elevated Operations & Cloud Functions Barrier

Operations requiring multi-document coordination, rate limits, or elevated privileges are isolated to Cloud Functions via the Firebase Admin SDK:

```
[ Client ] 
    |
    | (1) httpsCallable('verifyDevicePairing', payload) + Auth Bearer Token
    v
[ Cloud Functions Middleware ]
    |
    | (2) Validate Caller UID & Rate Limit Quota
    | (3) Validate Payload Schema with Zod
    v
[ Firebase Admin SDK (Trusted Environment) ]
    |
    | (4) Atomic Firestore Transaction
    |     - Invalidate Pairing Session
    |     - Create Paired Device Document
    |     - Append Immutable Audit Log
    v
[ Cloud Firestore ]
```

### 5.1 Device Pairing Security
Pairing a new device bypasses direct Firestore writes:
1. **Initiation**: The primary device generates an ephemeral 6-digit pairing code with a strict 5-minute time-to-live (`expiresAt = now + 300s`).
2. **Rate Limiting**: The verification callable function restricts redemption attempts to a maximum of 3 failed tries per session and 10 requests per hour per IP.
3. **Atomic Consumption**: When verified, a database transaction invalidates the session (`status = 'CONSUMED'`), registers the paired device, and logs an audit record. Once consumed, the pairing code cannot be reused.

### 5.2 Append-Only Audit Logging
All security-sensitive operations generate an immutable record in `auditLogs/{logId}`:
- **Direct Client Access Denied**:
  ```javascript
  match /auditLogs/{logId} {
    allow read, write: if false;
  }
  ```
- Written exclusively by Cloud Functions running the Firebase Admin SDK.
- Tracks actor UID, client platform, IP address (truncated/salted), timestamp, and operation status.

---

## 6. Secrets & Environment Management

1. **Client Bundles**:
   - The React renderer and Electron preload bundles only include public Firebase configuration keys (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.). These keys identify the Firebase project but do not grant administrative privileges; all access is gated by Firestore and Storage security rules.
2. **Backend Secrets**:
   - Firebase Service Account credentials and administrative API keys are stored in secure environment secrets (e.g., Google Cloud Secret Manager) and never packaged into client distributions.
3. **Version Control Protection**:
   - `.env`, `.env.local`, and service account JSON files (`*.service-account.json`, `firebase-service-account.json`) are strictly excluded in `.gitignore`.

---

## 7. App Check Integration (Phase 7 Specification)

In Phase 7, **Firebase App Check** will be integrated to protect the backend from abuse, automated scrapers, and unauthorized API clients:
- **Desktop (Windows)**: Implementation of a custom App Check provider or token-exchange service validating the desktop executable hash and signature.
- **Web / Development**: Integration of reCAPTCHA Enterprise tokens for web surface endpoints.
- **Enforcement**: Once active, incoming requests to Cloud Firestore, Cloud Storage, and Cloud Functions lacking a valid App Check attestation token are rejected automatically at the Google Cloud edge.

---

## 8. Threat Modeling & Mitigation Matrix

The following matrix outlines primary attack vectors against ComicLink and the architectural defenses preventing them:

| Attack Vector | Threat Scenario | Mitigation Strategy |
| :--- | :--- | :--- |
| **Impersonation** | Attacker attempts to forge another user's UID in a write payload. | Firestore rules verify `request.resource.data.ownerUid == request.auth.uid`. Since `request.auth` is derived directly from the cryptographically verified JWT, the UID cannot be spoofed. |
| **Privilege Escalation** | Regular member attempts to promote self to group owner or administrator. | Rules for `conversations/{id}/members/{uid}` enforce that only existing users with `role == 'OWNER'` can modify the `role` field. |
| **Cross-User Data Access** | Attacker crafts a query to read another user's private clipboard items or files. | Rules evaluate `request.auth.uid == resource.data.ownerUid`. Queries lacking the user's UID filter or attempting to read foreign documents are denied immediately. |
| **Pairing Code Brute-Force** | Attacker attempts to guess the 6-digit device pairing code via automated requests. | Pairing sessions expire after 5 minutes (300 seconds); verification is executed via a Cloud Function enforcing a 3-attempt ceiling before immediate session revocation. |
| **Pairing Replay** | Attacker captures a previously used pairing code and attempts to link a secondary device. | Pairing verification runs in an atomic Firestore transaction that checks `status == 'PENDING'` and sets `status = 'CONSUMED'`. Subsequent attempts are rejected. |
| **Storage Path Traversal** | Attacker attempts to overwrite other users' files by uploading to `files/victim_uid/...`. | Cloud Storage rules enforce `match /files/{ownerUid}/{fileId}/{filename} { allow write: if request.auth.uid == ownerUid; }`. Path tampering is denied. |
| **Malicious File Upload** | Attacker attempts to upload massive files or malicious executable scripts. | Storage rules enforce `request.resource.size <= 50 * 1024 * 1024` (50MB ceiling) and validate `request.resource.contentType.matches('image/.*\|application/zip\|application/pdf\|text/.*')`. |
| **Report Brigading & Spam** | Attacker spams the `/reports` collection to cause denial-of-service or censor content. | Cloud Function middleware applies sliding-window rate limiting (max 5 reports per hour per user). Clients have no read access to reports. |
| **Tampering with Audit Logs** | Attacker attempts to delete or modify audit trails after unauthorized actions. | Firestore security rules explicitly declare `allow read, write: if false;` for `auditLogs`. Only the trusted Admin SDK can write entries. |
| **XSS / Client RCE** | Malicious content injected in chat attempts to execute arbitrary shell commands. | Electron `contextIsolation: true`, `nodeIntegration: false`, strict CSP, and sanitized DOM rendering ensure scripts cannot break out of the browser sandbox. |
