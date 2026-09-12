export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted'
} as const;

export const PRESENCE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away'
} as const;

// Backward-compatibility alias
export const USER_STATUS = ACCOUNT_STATUS;

export const USER_ROLE = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
} as const;

export const DEVICE_PLATFORM = {
  WINDOWS: 'windows',
  ANDROID: 'android',
  WEB: 'web'
} as const;

export const PAIRING_STATUS = {
  PENDING: 'pending',
  SCANNED: 'scanned',
  CONFIRMED: 'confirmed',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
} as const;

export const PAIRED_DEVICE_STATUS = {
  ACTIVE: 'active',
  UNPAIRED: 'unpaired'
} as const;

export const FILE_TRANSFER_STATUS = {
  CREATED: 'created',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  QUEUED: 'queued',
  TRANSFERRING: 'transferring',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
} as const;

export const CONVERSATION_TYPE = {
  DIRECT: 'direct',
  GROUP: 'group'
} as const;

export const MESSAGE_TYPE = {
  TEXT: 'text',
  FILE: 'file',
  SYSTEM: 'system'
} as const;

export const CLIPBOARD_CONTENT_TYPE = {
  TEXT: 'text',
  URL: 'url',
  IMAGE: 'image'
} as const;

export const POST_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  FRIENDS: 'friends'
} as const;

export const MODERATION_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REMOVED: 'removed'
} as const;

export const REPORT_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  ACTIONED: 'actioned',
  DISMISSED: 'dismissed'
} as const;
