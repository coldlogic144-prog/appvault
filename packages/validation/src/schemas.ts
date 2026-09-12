import { z } from 'zod';
import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_DEVICE_NAME_LENGTH,
  MAX_FILE_NAME_LENGTH,
  MAX_FILE_SIZE_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_POST_LENGTH,
  MAX_POST_IMAGES,
  MAX_COMMENT_LENGTH,
  MAX_REPORT_DETAILS_LENGTH
} from '@comiclink/constants';

export const displayNameSchema = z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH);
export const bioSchema = z.string().max(MAX_BIO_LENGTH);

export const registerDeviceSchema = z.object({
  deviceId: z.string().uuid().optional(),
  deviceName: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH),
  platform: z.enum(['windows', 'android', 'web']),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+/)
});

export const updateDeviceSchema = z.object({
  deviceName: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH).optional(),
  isRevoked: z.boolean().optional()
});

export const pairingCodeSchema = z.string().trim().regex(/^CL-[A-Z0-9]{6}$/i, 'Pairing code must be in the format CL-XXXXXX');

export const createPairingSchema = z.object({
  initiatorDeviceId: z.string().uuid().optional(),
  sourceDeviceId: z.string().uuid().optional(),
  initiatorDeviceName: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH).optional()
}).refine(data => Boolean(data.initiatorDeviceId || data.sourceDeviceId), {
  message: 'Device ID is required'
});

export const approvePairingSchema = z.object({
  sessionId: z.string().uuid(),
  targetDeviceId: z.string().uuid(),
  targetDeviceName: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH)
});

export const qrPairingPayloadSchema = z.object({
  v: z.literal(1),
  sid: z.string().uuid(),
  code: z.string().trim().min(6).max(16),
  initDev: z.string().uuid(),
  exp: z.number().positive(),
  ch: z.string().min(16).max(128)
});

export const scanPairingSchema = z.object({
  pairingCode: z.string().min(6).max(32),
  targetDeviceId: z.string().uuid()
});

export const sanitizedFileNameSchema = z.string()
  .trim()
  .min(1)
  .max(MAX_FILE_NAME_LENGTH)
  .refine(val => !/[/\\?%*:|"<>]/g.test(val) && !val.includes('..'), {
    message: 'Invalid file name. Path traversal characters not allowed.'
  });

export const sha256ChecksumSchema = z.string().regex(
  /^[a-f0-9]{64}$/i,
  'Checksum must be a valid 64-character SHA-256 hex string'
);

export const initiateTransferSchema = z.object({
  sourceDeviceId: z.string().uuid().optional(),
  targetDeviceId: z.string().uuid(),
  targetDeviceName: z.string().trim().min(1).max(MAX_DEVICE_NAME_LENGTH).optional(),
  recipientId: z.string().min(1).optional(),
  fileName: sanitizedFileNameSchema,
  mimeType: z.string().min(1),
  fileSize: z.number().positive().max(MAX_FILE_SIZE_BYTES),
  checksum: sha256ChecksumSchema.optional()
});

export const sendMessageSchema = z.object({
  conversationId: z.string(),
  type: z.enum(['text', 'file', 'system']),
  content: z.string().max(MAX_MESSAGE_LENGTH),
  fileId: z.string().optional(),
  replyTo: z.string().optional()
});

export const syncClipboardSchema = z.object({
  sourceDeviceId: z.string(),
  contentType: z.enum(['text', 'url', 'image']),
  content: z.string().max(10000)
});

export const createPostSchema = z.object({
  content: z.string().max(MAX_POST_LENGTH),
  visibility: z.enum(['public', 'private', 'friends']),
  imageURLs: z.array(z.string().url()).max(MAX_POST_IMAGES).optional()
});

export const createCommentSchema = z.object({
  postId: z.string(),
  content: z.string().max(MAX_COMMENT_LENGTH)
});

export const createReportSchema = z.object({
  targetType: z.enum(['user', 'post', 'comment', 'message']),
  targetId: z.string(),
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'violence', 'inappropriate', 'other']),
  details: z.string().max(MAX_REPORT_DETAILS_LENGTH).optional()
});

export const updatePublicProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  photoURL: z.string().url().nullable().optional(),
  bio: bioSchema.optional(),
  presenceStatus: z.enum(['online', 'offline', 'away']).optional()
});

export const updateUserAccountSchema = z.object({
  clipboardSyncEnabled: z.boolean().optional(),
  blockedUsers: z.array(z.string()).optional()
});

export const updateProfileSchema = updatePublicProfileSchema.extend({
  clipboardSyncEnabled: z.boolean().optional()
});

export const emailSchema = z.string().trim().email('Please enter a valid email address');
export const passwordSchema = z.string().min(8, 'Passcode must be at least 8 characters');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Passcode is required')
});

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm passcode is required')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passcodes do not match',
  path: ['confirmPassword']
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

