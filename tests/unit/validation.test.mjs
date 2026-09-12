import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayNameSchema,
  registerDeviceSchema,
  createPairingSchema,
  initiateTransferSchema,
  sanitizedFileNameSchema,
  sha256ChecksumSchema,
  sendMessageSchema,
  chatMessageTextSchema,
  createConversationSchema,
  sendChatMessageSchema,
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

test('sanitizedFileNameSchema: rejects path traversal and illegal chars', () => {
  assert.equal(sanitizedFileNameSchema.safeParse('valid-document.pdf').success, true);
  assert.equal(sanitizedFileNameSchema.safeParse('report_2026.png').success, true);
  assert.equal(sanitizedFileNameSchema.safeParse('../secret.txt').success, false);
  assert.equal(sanitizedFileNameSchema.safeParse('..\\secret.txt').success, false);
  assert.equal(sanitizedFileNameSchema.safeParse('file/name.txt').success, false);
  assert.equal(sanitizedFileNameSchema.safeParse('file*name?.txt').success, false);
});

test('sha256ChecksumSchema: accepts 64-char hex and rejects invalid length or chars', () => {
  assert.equal(sha256ChecksumSchema.safeParse('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855').success, true);
  assert.equal(sha256ChecksumSchema.safeParse('short-hash').success, false);
  assert.equal(sha256ChecksumSchema.safeParse('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85G').success, false);
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

// Phase 5 Chat Unit Tests
test('chatMessageTextSchema: accepts valid plain text', () => {
  const valid = 'Incoming transmission from Station Alpha.';
  const res = chatMessageTextSchema.safeParse(valid);
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data, valid);
  }
});

test('chatMessageTextSchema: trims whitespace and rejects empty or blank text', () => {
  assert.equal(chatMessageTextSchema.safeParse('').success, false);
  assert.equal(chatMessageTextSchema.safeParse('   ').success, false);
  assert.equal(chatMessageTextSchema.safeParse('\n\t  ').success, false);

  const res = chatMessageTextSchema.safeParse('   padded text   ');
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data, 'padded text');
  }
});

test('chatMessageTextSchema: rejects text exceeding 2000 characters', () => {
  const oversized = 'x'.repeat(2001);
  const exactlyMax = 'x'.repeat(2000);
  assert.equal(chatMessageTextSchema.safeParse(oversized).success, false);
  assert.equal(chatMessageTextSchema.safeParse(exactlyMax).success, true);
});

test('createConversationSchema: accepts sorted participants and rejects unsorted or equal', () => {
  const valid = {
    participantA: 'userA',
    participantB: 'userB',
    pairId: 'devA_devB'
  };
  assert.equal(createConversationSchema.safeParse(valid).success, true);

  const unsorted = {
    participantA: 'userB',
    participantB: 'userA',
    pairId: 'devA_devB'
  };
  assert.equal(createConversationSchema.safeParse(unsorted).success, false);

  const equal = {
    participantA: 'userA',
    participantB: 'userA',
    pairId: 'devA_devB'
  };
  assert.equal(createConversationSchema.safeParse(equal).success, false);
});

test('sendChatMessageSchema: validates message payload and rejects invalid inputs', () => {
  const valid = {
    conversationId: 'userA_userB',
    text: 'Hello Operative'
  };
  assert.equal(sendChatMessageSchema.safeParse(valid).success, true);

  const emptyText = {
    conversationId: 'userA_userB',
    text: '   '
  };
  assert.equal(sendChatMessageSchema.safeParse(emptyText).success, false);

  const missingConvId = {
    conversationId: '',
    text: 'Valid text'
  };
  assert.equal(sendChatMessageSchema.safeParse(missingConvId).success, false);
});

test('deterministicConversationId: sorts participant UIDs lexicographically', () => {
  function getDeterministicConversationId(uid1, uid2) {
    if (!uid1 || !uid2 || uid1 === uid2) throw new Error('Invalid UIDs');
    const [a, b] = [uid1, uid2].sort();
    return `${a}_${b}`;
  }

  assert.equal(getDeterministicConversationId('userA', 'userB'), 'userA_userB');
  assert.equal(getDeterministicConversationId('userB', 'userA'), 'userA_userB');
  assert.equal(getDeterministicConversationId('operative_zebra', 'agent_alpha'), 'agent_alpha_operative_zebra');
  assert.throws(() => getDeterministicConversationId('userA', 'userA'));
  assert.throws(() => getDeterministicConversationId('', 'userB'));
});

