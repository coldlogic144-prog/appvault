# ComicLink Database Schema Documentation

This document specifies the complete Cloud Firestore database schema for ComicLink. It details all 15 collections and subcollections, defining field structures, validation types, ownership models, access rules, indexes, retention policies, and abuse prevention mechanisms.

---

## 1. Collections Summary Matrix

| Collection Path | Purpose | Primary Owner | Client Read | Client Write | Cloud Function Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users/{uid}` | User account & profile | Self (`uid`) | Public / Self | Self (Restricted) | Yes (User lifecycle, stats) |
| `users/{uid}/devices/{deviceId}` | Registered user devices | Self (`uid`) | Self only | Self only | Yes (Heartbeat sweeper) |
| `pairingSessions/{sessionId}` | Ephemeral pairing codes | Initiator | Initiator only | Create only | Yes (Pairing verification) |
| `pairedDevices/{pairId}` | Active device-to-device links| Paired owners | Paired owners | Update flags only | Yes (Pairing creation/revocation) |
| `files/{fileId}` | File transfer metadata | Upload owner | Owner/Recipient | Owner (Restricted) | Yes (Integrity & storage sync) |
| `conversations/{conversationId}` | Chat conversation metadata | Members | Members only | Members (Restricted) | Yes (Fanout & notification) |
| `conversations/{id}/members/{uid}` | Conversation member config | Member (`uid`) | Members only | Self only | No (Rule enforced) |
| `conversations/{id}/messages/{id}` | Comic styled messages | Sender | Members only | Sender only | Yes (Notification & counter) |
| `clipboardItems/{clipboardId}` | Cross-device clipboard sync | Owner (`uid`) | Owner only | Owner only | Yes (Scheduled TTL cleanup) |
| `posts/{postId}` | Community feed posts | Author (`uid`) | Public | Author (Restricted) | Yes (Aggregations & moderation) |
| `posts/{id}/comments/{commentId}` | Post comments | Author (`uid`) | Public | Author only | Yes (Comment counter) |
| `posts/{id}/likes/{uid}` | Post likes deduplication | Liker (`uid`) | Public | Liker only | Yes (Like counter) |
| `reports/{reportId}` | Abuse & moderation reports | Reporter | None (Admin only)| Create only | Yes (Rate limiting & alerts) |
| `notifications/{notificationId}` | User in-app notifications | Recipient | Recipient only | Mark read only | Yes (Creation & fanout) |
| `auditLogs/{logId}` | Immutable security log | System | None | None | Yes (Exclusively Admin SDK) |

---

## 2. Collection Specifications

### 2.1 `users/{uid}`

#### Purpose
Stores user profile information, public comic persona details, preferences, and account metadata.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `uid` | `string` | Yes | Firebase Auth unique user ID matching document ID. |
| `email` | `string` | Yes | Primary email address. |
| `displayName` | `string` | Yes | Public user handle (3–32 characters). |
| `photoUrl` | `string \| null` | No | Public avatar URL in Cloud Storage or null. |
| `comicHeroName` | `string` | No | Comic-style superhero / hero alias (e.g., "Neon Striker"). |
| `bio` | `string` | No | Short biography or tagline (max 280 characters). |
| `comicTheme` | `string` | Yes | UI theme preference: `'manga-dark'` \| `'golden-age'` \| `'pop-art'` \| `'cyber-panel'`. |
| `emailVerified` | `boolean` | Yes | Verification status synced from Firebase Auth. |
| `status` | `string` | Yes | Account status: `'ACTIVE'` \| `'SUSPENDED'` \| `'DEACTIVATED'`. |
| `storageUsageBytes` | `number` | Yes | Aggregated bytes of files stored in Cloud Storage (default: `0`). |
| `createdAt` | `Timestamp` | Yes | Document creation timestamp (enforced `request.time`). |
| `updatedAt` | `Timestamp` | Yes | Last update timestamp (enforced `request.time`). |

- **Ownership**: The user whose `auth.uid == uid`.
- **Rules Summary**:
  - `read`: Any authenticated user can read public profile attributes (`uid`, `displayName`, `photoUrl`, `comicHeroName`, `bio`, `comicTheme`, `status`). Only `request.auth.uid == uid` can read private attributes (`email`, `storageUsageBytes`).
  - `write`: Allowed only when `request.auth.uid == uid`. Clients cannot modify `status`, `storageUsageBytes`, or `emailVerified` (managed by Cloud Functions).
  - `delete`: Disallowed directly. Must be initiated via account deletion Cloud Function.
- **Required Indexes**:
  - Single: `email` (asc)
  - Single: `displayName` (asc)
  - Single: `createdAt` (desc)
- **Retention Policy**: Indefinite until explicit account deletion.
- **Abuse Risks**: Handle spoofing, offensive names/bios, unauthorized alteration of storage quotas or account status.
- **Cloud Functions Needed**: Yes.
  - `onUserCreated`: Initializes default user document upon Firebase Auth registration.
  - `onUserDeleted`: Cleans up user devices, conversations, files, and Storage objects.
  - `updateStorageUsage`: Aggregates storage quota when files are uploaded/deleted.

---

### 2.2 `users/{uid}/devices/{deviceId}`

#### Purpose
Registers all active desktop and mobile client instances linked to a user account.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `deviceId` | `string` | Yes | Hardware UUID v4 generated on client installation. |
| `deviceName` | `string` | Yes | User-facing device label (e.g., "Office-PC", "Laptop-Win11"). |
| `platform` | `string` | Yes | Client OS platform: `'WINDOWS'` \| `'MACOS'` \| `'LINUX'` \| `'ANDROID'` \| `'IOS'`. |
| `clientVersion` | `string` | Yes | Semantic version of running client (e.g., "0.1.0"). |
| `isOnline` | `boolean` | Yes | Real-time presence flag updated via heartbeat. |
| `lastHeartbeatAt` | `Timestamp` | Yes | Timestamp of last active ping. |
| `pairedAt` | `Timestamp` | Yes | Timestamp when the device was registered. |
| `fcmToken` | `string \| null` | No | Firebase Cloud Messaging push token. |
| `publicKey` | `string \| null` | No | Optional client-generated public key for E2EE payload exchange. |

- **Ownership**: Subcollection strictly owned by `auth.uid == uid`.
- **Rules Summary**:
  - `read`: `request.auth.uid == uid`.
  - `write`: `request.auth.uid == uid`. Device cannot alter `pairedAt` on update.
  - `delete`: `request.auth.uid == uid` (unpairing device).
- **Required Indexes**:
  - Composite: `isOnline` (asc) + `lastHeartbeatAt` (desc)
- **Retention Policy**: Active for device lifecycle; deleted on explicit unpair.
- **Abuse Risks**: Zombie devices remaining online indefinitely; spoofing client versions.
- **Cloud Functions Needed**: Yes.
  - `deviceHeartbeatSweeper`: Scheduled cron job running every 5 minutes to set `isOnline = false` for devices with `lastHeartbeatAt > 5 minutes ago`.

---

### 2.3 `pairingSessions/{sessionId}`

#### Purpose
Facilitates secure, short-lived device pairing handshakes using 6-digit numeric codes or QR deep links.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sessionId` | `string` | Yes | Cryptographically secure UUID v4 session ID. |
| `initiatorUid` | `string` | Yes | Auth UID of the user who requested the pairing code. |
| `initiatorDeviceId`| `string` | Yes | Device ID generating the pairing invitation. |
| `code` | `string` | Yes | 6-digit numeric pairing code (e.g., "849201"). |
| `codeHash` | `string` | Yes | Salted SHA-256 hash of the 6-digit code. |
| `status` | `string` | Yes | Session state: `'PENDING'` \| `'CONSUMED'` \| `'EXPIRED'` \| `'REVOKED'`. |
| `targetDeviceId` | `string \| null` | No | Device ID of the device redeeming the code. |
| `attempts` | `number` | Yes | Number of incorrect verification attempts (max 3). |
| `expiresAt` | `Timestamp` | Yes | Hard expiration timestamp (TTL: 300 seconds from creation). |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |

- **Ownership**: Initiated by `initiatorUid`.
- **Rules Summary**:
  - `read`: `request.auth.uid == resource.data.initiatorUid`.
  - `write`: Create allowed if `request.auth.uid == request.resource.data.initiatorUid` and `status == 'PENDING'`. Direct updates by clients are forbidden.
  - `delete`: `request.auth.uid == resource.data.initiatorUid` (to revoke early).
- **Required Indexes**:
  - Composite: `initiatorUid` (asc) + `status` (asc) + `expiresAt` (desc)
  - Composite: `code` (asc) + `status` (asc) + `expiresAt` (desc)
- **Retention Policy**: TTL of 5 minutes. Cleaned automatically via Firestore TTL policy on `expiresAt`.
- **Abuse Risks**: Brute-force guessing of 6-digit codes, replay attacks, session exhaustion.
- **Cloud Functions Needed**: Yes.
  - `verifyDevicePairing`: Callable function that validates code, enforces the 3-attempt limit, invalidates the session atomically, and creates the `pairedDevices` entry.

---

### 2.4 `pairedDevices/{pairId}`

#### Purpose
Maintains authorized pairings between devices for cross-device clipboard sync and direct file transfers.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `pairId` | `string` | Yes | Composite identifier formatted as `${deviceA}_${deviceB}`. |
| `primaryUid` | `string` | Yes | UID of the primary account owner. |
| `primaryDeviceId` | `string` | Yes | Initiating device ID. |
| `pairedUid` | `string` | Yes | UID of the paired account (same UID for personal devices). |
| `pairedDeviceId` | `string` | Yes | Linked device ID. |
| `status` | `string` | Yes | Link status: `'ACTIVE'` \| `'PAUSED'` \| `'REVOKED'`. |
| `allowClipboardSync`| `boolean` | Yes | Permission toggle for automatic clipboard synchronization. |
| `allowFileTransfer` | `boolean` | Yes | Permission toggle for direct file transfer requests. |
| `createdAt` | `Timestamp` | Yes | Timestamp of pair establishment. |
| `updatedAt` | `Timestamp` | Yes | Last configuration change timestamp. |

- **Ownership**: Shared between `primaryUid` and `pairedUid`.
- **Rules Summary**:
  - `read`: `request.auth.uid == resource.data.primaryUid || request.auth.uid == resource.data.pairedUid`.
  - `write`: Direct creation forbidden to client (created solely via `verifyDevicePairing` Cloud Function). Update permitted only for `allowClipboardSync`, `allowFileTransfer`, and `status` by authenticated owners.
  - `delete`: Prohibited (status set to `'REVOKED'`).
- **Required Indexes**:
  - Composite: `primaryUid` (asc) + `status` (asc)
  - Composite: `pairedUid` (asc) + `status` (asc)
- **Retention Policy**: Retained until explicitly revoked by user.
- **Abuse Risks**: Unauthorized toggling of clipboard permissions by compromised clients.
- **Cloud Functions Needed**: Yes (Atomic record creation upon successful code verification).

---

### 2.5 `files/{fileId}`

#### Purpose
Tracks metadata, validation checksums, and delivery state for files uploaded and shared across devices.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fileId` | `string` | Yes | Unique file transfer UUID v4. |
| `ownerUid` | `string` | Yes | UID of uploading user. |
| `sourceDeviceId` | `string` | Yes | Device ID where the file originated. |
| `recipientUid` | `string \| null` | No | Target user UID for direct user-to-user transfers. |
| `targetDeviceId` | `string \| null` | No | Target device ID for targeted cross-device push. |
| `conversationId` | `string \| null` | No | Associated conversation ID if file is a chat attachment. |
| `storagePath` | `string` | Yes | Cloud Storage object location (`files/{ownerUid}/{fileId}/{fileName}`). |
| `fileName` | `string` | Yes | Original sanitized filename with extension. |
| `fileSizeBytes` | `number` | Yes | File size in bytes (maximum 52,428,800 bytes / 50MB). |
| `mimeType` | `string` | Yes | Standard IANA media type (e.g., `'image/png'`, `'application/zip'`). |
| `sha256Checksum` | `string` | Yes | SHA-256 hex string for post-transfer integrity verification. |
| `transferStatus` | `string` | Yes | `'UPLOADING'` \| `'READY'` \| `'DOWNLOADING'` \| `'COMPLETED'` \| `'FAILED'`. |
| `downloadCount` | `number` | Yes | Number of times file was retrieved. |
| `expiresAt` | `Timestamp \| null` | No | Optional TTL expiration timestamp for ephemeral transfers. |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `updatedAt` | `Timestamp` | Yes | Server update timestamp. |

- **Ownership**: `ownerUid` (uploader) and `recipientUid` (target receiver).
- **Rules Summary**:
  - `read`: `request.auth.uid == resource.data.ownerUid || request.auth.uid == resource.data.recipientUid` or user is a member of `conversationId`.
  - `write`: Create: `request.auth.uid == request.resource.data.ownerUid` and `fileSizeBytes <= 52428800`. Update: Allowed for status tracking by authorized parties.
  - `delete`: `request.auth.uid == resource.data.ownerUid`.
- **Required Indexes**:
  - Composite: `ownerUid` (asc) + `createdAt` (desc)
  - Composite: `recipientUid` (asc) + `transferStatus` (asc)
  - Composite: `conversationId` (asc) + `createdAt` (desc)
- **Retention Policy**: Ephemeral direct transfers deleted after 7 days via TTL. Chat attachments persist with conversation.
- **Abuse Risks**: Quota exhaustion, uploading malicious executables, storage path traversal.
- **Cloud Functions Needed**: Yes.
  - `onFileUploadComplete`: Cloud Storage trigger verifying uploaded byte count matches Firestore metadata; updates user `storageUsageBytes`.
  - `onFileDelete`: Deletes the physical Cloud Storage blob when the Firestore document is removed.

---

### 2.6 `conversations/{conversationId}`

#### Purpose
Top-level metadata for 1-on-1 chats, self-device sync threads, and comic group rooms.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `conversationId` | `string` | Yes | Unique conversation UUID v4. |
| `type` | `string` | Yes | Conversation category: `'DIRECT'` \| `'SELF_SYNC'` \| `'GROUP'`. |
| `memberUids` | `array<string>` | Yes | Array of participant user UIDs (max 50 for groups). |
| `title` | `string \| null`| No | Display name for group conversations (max 60 chars). |
| `lastMessage` | `map \| null` | No | Embedded summary of latest message (`messageId`, `senderUid`, `textPreview`, `createdAt`). |
| `lastActivityAt` | `Timestamp` | Yes | Timestamp of most recent activity for ordering thread lists. |
| `createdBy` | `string` | Yes | UID of the user who initiated the conversation. |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `updatedAt` | `Timestamp` | Yes | Server update timestamp. |

- **Ownership**: Shared among all UIDs present in `memberUids`.
- **Rules Summary**:
  - `read`: `request.auth.uid in resource.data.memberUids`.
  - `write`: Create: `request.auth.uid in request.resource.data.memberUids`. Update: `request.auth.uid in resource.data.memberUids`. Clients cannot modify `createdBy` or `createdAt`.
  - `delete`: Prohibited (archiving only).
- **Required Indexes**:
  - Composite: `memberUids` (array-contains) + `lastActivityAt` (desc)
- **Retention Policy**: Permanent until all members leave or request room destruction.
- **Abuse Risks**: Thread spamming, unauthorized user injection into private rooms.
- **Cloud Functions Needed**: Yes.
  - `aggregateConversationLastMessage`: Ensures consistency of `lastMessage` preview and dispatches push notifications.

---

### 2.7 `conversations/{conversationId}/members/{uid}`

#### Purpose
Per-user conversation settings, roles, unread message markers, and custom aliases.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `uid` | `string` | Yes | Member's Firebase Auth UID matching document ID. |
| `role` | `string` | Yes | Membership level: `'OWNER'` \| `'ADMIN'` \| `'MEMBER'`. |
| `joinedAt` | `Timestamp` | Yes | Server timestamp of joining. |
| `lastReadMessageId`| `string \| null`| No | ID of latest message read by this member. |
| `lastReadAt` | `Timestamp \| null`| No | Timestamp of latest read receipt. |
| `isMuted` | `boolean` | Yes | User preference to suppress notifications. |
| `comicNickname` | `string \| null`| No | Custom alias inside this specific conversation. |

- **Ownership**: `request.auth.uid == uid`.
- **Rules Summary**:
  - `read`: `request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.memberUids`.
  - `write`: Create/Update: `request.auth.uid == uid` (cannot alter `role` unless current user is `'OWNER'`).
  - `delete`: `request.auth.uid == uid` (leaving the conversation).
- **Required Indexes**:
  - Composite: `uid` (asc) + `joinedAt` (desc)
- **Retention Policy**: Synchronized with parent conversation membership.
- **Abuse Risks**: Privilege escalation by modifying role from `'MEMBER'` to `'ADMIN'`.
- **Cloud Functions Needed**: No. Handled strictly via security rules.

---

### 2.8 `conversations/{conversationId}/messages/{messageId}`

#### Purpose
Chat messages styled with dynamic comic dialog attributes (speech bubbles, action sounds, attachments).

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `messageId` | `string` | Yes | Unique message UUID v4. |
| `conversationId` | `string` | Yes | Parent conversation ID. |
| `senderUid` | `string` | Yes | UID of the sender. |
| `senderDeviceId` | `string` | Yes | Device ID where message originated. |
| `content` | `string` | Yes | Text content of the message (max 2000 characters). |
| `bubbleStyle` | `string` | Yes | Speech bubble theme: `'SPEECH'` \| `'THOUGHT'` \| `'SHOUT'` \| `'WHISPER'` \| `'NARRATOR'`. |
| `actionSound` | `string \| null`| No | Comic onomatopoeia: `"POW!"`, `"BOOM!"`, `"ZAP!"`, `"SWOOSH!"`. |
| `attachments` | `array<map>` | Yes | Array of attachment maps (`fileId`, `fileName`, `fileSizeBytes`, `storagePath`). |
| `isEdited` | `boolean` | Yes | Flag indicating whether message was edited. |
| `status` | `string` | Yes | Delivery state: `'SENT'` \| `'DELIVERED'` \| `'READ'`. |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `updatedAt` | `Timestamp` | Yes | Server update timestamp. |

- **Ownership**: Sender (`senderUid`).
- **Rules Summary**:
  - `read`: `request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.memberUids`.
  - `write`: Create: `request.auth.uid in get(...).data.memberUids` and `request.resource.data.senderUid == request.auth.uid`. Update: `request.auth.uid == resource.data.senderUid` (text content only, within 15 minutes of creation).
  - `delete`: `request.auth.uid == resource.data.senderUid`.
- **Required Indexes**:
  - Composite: `conversationId` (asc) + `createdAt` (asc)
  - Composite: `senderUid` (asc) + `createdAt` (desc)
- **Retention Policy**: Retained indefinitely or until parent conversation deletion.
- **Abuse Risks**: Rapid message flooding/spam, hostile content insertion, altering old messages.
- **Cloud Functions Needed**: Yes.
  - `onMessageCreated`: Updates parent conversation `lastMessage` and `lastActivityAt`, and triggers push notifications to offline members.

---

### 2.9 `clipboardItems/{clipboardId}`

#### Purpose
Cross-device clipboard history items synchronized in real-time across a user's paired devices.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `clipboardId` | `string` | Yes | Unique clipboard item UUID v4. |
| `ownerUid` | `string` | Yes | UID of the item owner. |
| `sourceDeviceId` | `string` | Yes | Device ID where clipboard content was copied. |
| `type` | `string` | Yes | Data type: `'TEXT'` \| `'URL'` \| `'IMAGE_SNIPPET'` \| `'CODE'`. |
| `content` | `string` | Yes | Sanitized text content (max 51,200 bytes / 50KB). |
| `preview` | `string` | Yes | Truncated preview string for display in panels (max 100 chars). |
| `isPinned` | `boolean` | Yes | Whether item is pinned to top of clipboard history. |
| `deviceTargetIds`| `array<string>` | No | Specific device IDs allowed to receive item (empty = all paired). |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `expiresAt` | `Timestamp` | Yes | Expiration timestamp (24h for unpinned, 30 days for pinned). |

- **Ownership**: Single-user ownership (`ownerUid`).
- **Rules Summary**:
  - `read`: `request.auth.uid == resource.data.ownerUid`.
  - `write`: Create/Update/Delete: `request.auth.uid == request.resource.data.ownerUid` and `content.size() <= 51200`.
- **Required Indexes**:
  - Composite: `ownerUid` (asc) + `isPinned` (desc) + `createdAt` (desc)
- **Retention Policy**: TTL of 24 hours for unpinned items; 30 days for pinned items. Managed via Firestore TTL on `expiresAt`.
- **Abuse Risks**: Storing confidential secrets (passwords/API keys) indefinitely; ballooning database size with massive text blobs.
- **Cloud Functions Needed**: Yes (Fallback cleanup job for expired entries).

---

### 2.10 `posts/{postId}`

#### Purpose
Community feed posts containing multi-panel comic strips, artwork, or announcements.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `postId` | `string` | Yes | Unique post UUID v4. |
| `authorUid` | `string` | Yes | Author user UID. |
| `authorDisplayName`| `string` | Yes | Denormalized display name of author at post time. |
| `authorHeroName` | `string \| null`| No | Denormalized comic alias of author. |
| `title` | `string` | Yes | Post headline (max 120 characters). |
| `caption` | `string` | Yes | Storyline description or caption (max 1000 characters). |
| `comicPanelUrls` | `array<string>` | Yes | Array of Cloud Storage URLs for comic panels (1 to 6 panels). |
| `tags` | `array<string>` | Yes | Categorical tags (max 5 tags, each max 24 chars). |
| `likeCount` | `number` | Yes | Aggregated count of user likes (default: `0`). |
| `commentCount` | `number` | Yes | Aggregated count of comments (default: `0`). |
| `visibility` | `string` | Yes | `'PUBLIC'` \| `'FRIENDS'` \| `'UNLISTED'`. |
| `isFlagged` | `boolean` | Yes | Content moderation flag (default: `false`). |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `updatedAt` | `Timestamp` | Yes | Server update timestamp. |

- **Ownership**: Author (`authorUid`).
- **Rules Summary**:
  - `read`: Allowed if `resource.data.visibility == 'PUBLIC' && !resource.data.isFlagged` or `request.auth.uid == resource.data.authorUid`.
  - `write`: Create: `request.auth.uid == request.resource.data.authorUid` and `likeCount == 0` and `commentCount == 0` and `!isFlagged`. Update: Author can edit title/caption; cannot modify counters or moderation flags.
  - `delete`: `request.auth.uid == resource.data.authorUid`.
- **Required Indexes**:
  - Composite: `visibility` (asc) + `isFlagged` (asc) + `createdAt` (desc)
  - Composite: `authorUid` (asc) + `createdAt` (desc)
  - Composite: `tags` (array-contains) + `createdAt` (desc)
- **Retention Policy**: Indefinite until deleted by author or removed by moderation.
- **Abuse Risks**: NSFW / copyright infringement in comic panels, spamming feed, artificial counter manipulation.
- **Cloud Functions Needed**: Yes.
  - `onPostDelete`: Cascades deletion of subcollections (`comments`, `likes`) and associated Storage panel blobs.

---

### 2.11 `posts/{postId}/comments/{commentId}`

#### Purpose
User discussion comments under community posts.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `commentId` | `string` | Yes | Unique comment UUID v4. |
| `postId` | `string` | Yes | Parent post ID. |
| `authorUid` | `string` | Yes | Comment author UID. |
| `authorDisplayName`| `string` | Yes | Denormalized display name. |
| `content` | `string` | Yes | Comment body (max 500 characters). |
| `bubbleStyle` | `string` | Yes | Comic speech bubble style: `'SPEECH'` \| `'SHOUT'` \| `'THOUGHT'`. |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `updatedAt` | `Timestamp` | Yes | Server update timestamp. |

- **Ownership**: Comment author (`authorUid`).
- **Rules Summary**:
  - `read`: Public if parent post is readable.
  - `write`: Create: `request.auth != null && request.resource.data.authorUid == request.auth.uid`. Update/Delete: `request.auth.uid == resource.data.authorUid`.
- **Required Indexes**:
  - Composite: `postId` (asc) + `createdAt` (asc)
- **Retention Policy**: Co-exists with parent post.
- **Abuse Risks**: Harassment, spam comments, link farming.
- **Cloud Functions Needed**: Yes.
  - `onCommentCreated`: Atomically increments parent post `commentCount`.
  - `onCommentDeleted`: Atomically decrements parent post `commentCount`.

---

### 2.12 `posts/{postId}/likes/{uid}`

#### Purpose
Tracks user likes on community posts and prevents duplicate like actions.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `uid` | `string` | Yes | Liking user's Auth UID matching document ID. |
| `postId` | `string` | Yes | Target post ID. |
| `likedAt` | `Timestamp` | Yes | Server timestamp when like was registered. |

- **Ownership**: `request.auth.uid == uid`.
- **Rules Summary**:
  - `read`: Public if parent post is readable.
  - `write`: Create: `request.auth.uid == uid`. Delete: `request.auth.uid == uid` (unliking).
- **Required Indexes**:
  - Composite: `uid` (asc) + `likedAt` (desc)
- **Retention Policy**: Retained until unliked or parent post deleted.
- **Abuse Risks**: Like botting, race conditions on rapid like/unlike toggling.
- **Cloud Functions Needed**: Yes.
  - `onLikeCreated`: Atomically increments `likeCount` on parent post.
  - `onLikeDeleted`: Atomically decrements `likeCount` on parent post.

---

### 2.13 `reports/{reportId}`

#### Purpose
Stores user abuse reports for content moderation review (posts, comments, messages, bad actors).

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `reportId` | `string` | Yes | Unique report UUID v4. |
| `reporterUid` | `string` | Yes | UID of user filing the report. |
| `targetType` | `string` | Yes | Target type: `'USER'` \| `'POST'` \| `'COMMENT'` \| `'MESSAGE'` \| `'FILE'`. |
| `targetId` | `string` | Yes | ID of the reported entity. |
| `targetOwnerUid` | `string` | Yes | UID of the owner of the reported resource. |
| `reason` | `string` | Yes | Reason: `'SPAM'` \| `'HARASSMENT'` \| `'INAPPROPRIATE'` \| `'COPYRIGHT'` \| `'OTHER'`. |
| `details` | `string` | No | Additional context from reporter (max 1000 characters). |
| `status` | `string` | Yes | `'PENDING'` \| `'INVESTIGATING'` \| `'RESOLVED'` \| `'DISMISSED'`. |
| `resolutionNotes` | `string \| null`| No | Moderation administrative notes. |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `resolvedAt` | `Timestamp \| null`| No | Timestamp when report was resolved. |

- **Ownership**: Reporter (`reporterUid`).
- **Rules Summary**:
  - `read`: Prohibited for all clients (`allow read: if false`). Reports are strictly accessible by Admin SDK.
  - `write`: Create allowed if `request.auth != null && request.resource.data.reporterUid == request.auth.uid && request.resource.data.status == 'PENDING'`. Updates and deletes are forbidden to clients (`allow update, delete: if false`).
- **Required Indexes**:
  - Composite: `status` (asc) + `createdAt` (asc)
  - Composite: `targetId` (asc) + `status` (asc)
- **Retention Policy**: Retained for 180 days for moderation compliance and appeal processing.
- **Abuse Risks**: Coordinated report brigading against innocent users; report submission flooding.
- **Cloud Functions Needed**: Yes.
  - `handleReportSubmission`: Rate-limits report submissions per user; automatically flags target entity if report count reaches threshold (e.g., >= 5 unique reports).

---

### 2.14 `notifications/{notificationId}`

#### Purpose
Delivers in-app notification alerts for pairing requests, file transfers, messages, and social interactions.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `notificationId` | `string` | Yes | Unique notification UUID v4. |
| `recipientUid` | `string` | Yes | Target user Auth UID. |
| `senderUid` | `string \| null`| No | Triggering user UID (if applicable). |
| `type` | `string` | Yes | Notification type: `'PAIRING_REQUEST'` \| `'FILE_RECEIVED'` \| `'NEW_MESSAGE'` \| `'POST_LIKE'` \| `'POST_COMMENT'` \| `'SYSTEM_ALERT'`. |
| `title` | `string` | Yes | Notification headline (e.g., "POW! New File Arrived!"). |
| `body` | `string` | Yes | Brief description text. |
| `actionUrl` | `string \| null`| No | App navigation route or deep link. |
| `isRead` | `boolean` | Yes | Read receipt status (default: `false`). |
| `data` | `map` | No | Context map (`fileId`, `conversationId`, `pairId`). |
| `createdAt` | `Timestamp` | Yes | Server creation timestamp. |
| `expiresAt` | `Timestamp` | Yes | TTL expiration timestamp (30 days from creation). |

- **Ownership**: Recipient (`recipientUid`).
- **Rules Summary**:
  - `read`: `request.auth.uid == resource.data.recipientUid`.
  - `write`: Direct creation forbidden to client (Cloud Functions / Admin SDK only). Update permitted only to set `isRead = true` by recipient.
  - `delete`: `request.auth.uid == resource.data.recipientUid`.
- **Required Indexes**:
  - Composite: `recipientUid` (asc) + `isRead` (asc) + `createdAt` (desc)
- **Retention Policy**: TTL of 30 days via Firestore TTL policy on `expiresAt`.
- **Abuse Risks**: Notification spamming, spoofing system alerts (prevented by forbidding client writes).
- **Cloud Functions Needed**: Yes (Dispatched exclusively by backend event triggers).

---

### 2.15 `auditLogs/{logId}`

#### Purpose
Tamper-evident system log tracking security-relevant events, authentication attempts, device pairing, and moderation actions.

#### Fields
| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `logId` | `string` | Yes | Unique audit record ID (UUID v4 or KSUID). |
| `actorUid` | `string` | Yes | Auth UID of the actor or `'SYSTEM'`. |
| `actorIp` | `string \| null`| No | Masked IP address of the requester. |
| `actorUserAgent` | `string \| null`| No | Client platform and version string. |
| `action` | `string` | Yes | Action code: `'AUTH.LOGIN'` \| `'DEVICE.PAIR_SUCCESS'` \| `'DEVICE.PAIR_FAILED'` \| `'DEVICE.REVOKED'` \| `'FILE.UPLOAD'` \| `'REPORT.SUBMITTED'` \| `'SECURITY.RATE_LIMIT_EXCEEDED'`. |
| `resourceType` | `string` | Yes | Target resource: `'USER'` \| `'DEVICE'` \| `'PAIRING'` \| `'FILE'` \| `'REPORT'`. |
| `resourceId` | `string` | Yes | ID of the target resource. |
| `metadata` | `map` | Yes | Structured key-value context without PII (e.g., attempt counts, error codes). |
| `status` | `string` | Yes | Outcome: `'SUCCESS'` \| `'FAILURE'` \| `'BLOCKED'`. |
| `timestamp` | `Timestamp` | Yes | Server timestamp when event was recorded. |

- **Ownership**: Append-only system collection.
- **Rules Summary**:
  - `read`: `allow read: if false;` (Restricted to Cloud Functions Admin SDK and BigQuery export).
  - `write`: `allow write: if false;` (Strictly prohibited to all clients).
- **Required Indexes**:
  - Composite: `actorUid` (asc) + `timestamp` (desc)
  - Composite: `action` (asc) + `timestamp` (desc)
  - Composite: `resourceType` (asc) + `resourceId` (asc) + `timestamp` (desc)
- **Retention Policy**: Retained for 365 days minimum; exported to cold storage for compliance.
- **Abuse Risks**: Log tampering or deletion (completely prevented by zero client read/write rules).
- **Cloud Functions Needed**: Yes (Written exclusively by Cloud Functions via Firebase Admin SDK).
