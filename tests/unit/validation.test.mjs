import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayNameSchema,
  registerDeviceSchema,
  createPairingSchema,
  initiateTransferSchema,
  sendMessageSchema,
  syncClipboardSchema,
  createPostSchema,
  updateProfileSchema
} from '../../packages/validation/dist/schemas.js';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_DISPLAY_NAME_LENGTH
} from '../../packages/constants/dist/limits.js';
import {
  USER_STATUS,
  DEVICE_PLATFORM,
  FILE_TRANSFER_STATUS
} from '../../packages/constants/dist/status.js';
import { ERROR_CODES, createAppError } from '../../packages/error-codes/dist/codes.js';

test('displayNameSchema: validates valid display name', () => {
  const result = displayNameSchema.safeParse('ComicHero');
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data, 'ComicHero');
  }
});

test('displayNameSchema: trims and rejects empty name', () => {
  const result = displayNameSchema.safeParse('   ');
  assert.equal(result.success, false);
});

test('displayNameSchema: rejects name exceeding max length', () => {
  const longName = 'A'.repeat(MAX_DISPLAY_NAME_LENGTH + 1);
  const result = displayNameSchema.safeParse(longName);
  assert.equal(result.success, false);
});

test('registerDeviceSchema: validates compliant device data', () => {
  const valid = {
    deviceName: 'Desktop-Workstation',
    platform: 'windows',
    appVersion: '1.0.0'
  };
  const result = registerDeviceSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test('registerDeviceSchema: rejects invalid platform and bad semver', () => {
  const invalid = {
    deviceName: 'MyPhone',
    platform: 'ios_unsupported',
    appVersion: 'invalid-version'
  };
  const result = registerDeviceSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('createPairingSchema: enforces UUID for sourceDeviceId', () => {
  const valid = { sourceDeviceId: '123e4567-e89b-12d3-a456-426614174000' };
  const invalid = { sourceDeviceId: 'not-a-uuid' };

  assert.equal(createPairingSchema.safeParse(valid).success, true);
  assert.equal(createPairingSchema.safeParse(invalid).success, false);
});

test('initiateTransferSchema: enforces max file size limit', () => {
  const valid = {
    sourceDeviceId: '123e4567-e89b-12d3-a456-426614174000',
    targetDeviceId: '223e4567-e89b-12d3-a456-426614174001',
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 1024 // 1MB
  };
  const oversized = {
    ...valid,
    fileSize: MAX_FILE_SIZE_BYTES + 1
  };
  assert.equal(initiateTransferSchema.safeParse(valid).success, true);
  assert.equal(initiateTransferSchema.safeParse(oversized).success, false);
});

test('constants: enum integrity checks', () => {
  assert.equal(USER_STATUS.ACTIVE, 'active');
  assert.equal(DEVICE_PLATFORM.WINDOWS, 'windows');
  assert.equal(DEVICE_PLATFORM.ANDROID, 'android');
  assert.equal(FILE_TRANSFER_STATUS.COMPLETED, 'completed');
});

test('error-codes: createAppError formats structured application errors', () => {
  const err = createAppError(ERROR_CODES.AUTH.NOT_AUTHENTICATED, 'User not signed in', { attempt: 1 });
  assert.equal(err.code, 'NOT_AUTHENTICATED');
  assert.equal(err.message, 'User not signed in');
  assert.deepEqual(err.details, { attempt: 1 });
});
