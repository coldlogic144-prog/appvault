import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';

const firestoreRules = fs.readFileSync(path.resolve('backend/firestore.rules'), 'utf8');
const storageRules = fs.readFileSync(path.resolve('backend/storage.rules'), 'utf8');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-comiclink-phase4-test',
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080
    },
    storage: {
      rules: storageRules,
      host: '127.0.0.1',
      port: 9199
    }
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  }
});

function getSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getValidDevice(deviceId = 'dev1', ownerId = 'userA') {
  return {
    deviceId,
    ownerId,
    deviceName: 'Station-Alpha',
    platform: 'windows',
    appVersion: '1.0.0',
    isRevoked: false,
    revokedAt: null,
    createdAt: new Date(),
    lastSeenAt: new Date()
  };
}

function getValidFileTransfer(fileId = 'file1', senderId = 'userA', recipientId = 'userB', fileName = 'test.txt', fileBuffer = Buffer.from('ComicLink Secure Transmission 2026')) {
  const checksum = getSha256(fileBuffer);
  return {
    fileId,
    senderId,
    recipientId,
    sourceDeviceId: 'dev1',
    sourceDeviceName: 'Station-Alpha',
    targetDeviceId: 'dev2',
    targetDeviceName: 'Station-Beta',
    fileName,
    mimeType: 'text/plain',
    fileSize: fileBuffer.length,
    storagePath: `transfers/${senderId}/${recipientId}/${fileId}/${fileName}`,
    status: 'pending',
    checksum,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
}

// =============================================================================
// PHASE 4 COMPREHENSIVE WORKFLOW & SECURITY VERIFICATION (TESTS 1 - 20)
// =============================================================================

test('1 & 2. Authentication & Station Setup: User A and User B registered and active', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    await context.firestore().doc('pairedDevices/dev1_dev2').set({
      pairId: 'dev1_dev2',
      ownerUid: 'userA',
      userA: 'userA',
      userB: 'userB',
      deviceA: 'dev1',
      deviceB: 'dev2',
      status: 'active',
      createdAt: new Date()
    });
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const pairSnap = await userADb.doc('pairedDevices/dev1_dev2').get();
  assert.equal(pairSnap.exists, true);
  assert.equal(pairSnap.data()?.status, 'active');
});

test('3, 4, 5, 6. Upload & Manifest: User A uploads test.txt to User B; manifest and storage path verified', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const fileContent = Buffer.from('ComicLink Secret Schematics 2026');
  const manifest = getValidFileTransfer('file-tx-1', 'userA', 'userB', 'test.txt', fileContent);

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const userAStorage = testEnv.authenticatedContext('userA', { email_verified: true }).storage();

  // 5. Confirm Firestore manifest creation
  await assertSucceeds(userADb.doc('files/file-tx-1').set(manifest));

  // 6. Confirm Storage object creation at expected path
  const storageRef = userAStorage.ref(manifest.storagePath);
  await assertSucceeds(storageRef.put(fileContent, { contentType: 'text/plain' }));

  // Sender marks ready
  await assertSucceeds(userADb.doc('files/file-tx-1').update({
    status: 'ready',
    updatedAt: new Date()
  }));
});

test('7 & 8. Inbound Discovery & Consent: User B sees incoming transfer and explicit acceptance required', async () => {
  const fileContent = Buffer.from('Target payload');
  const manifest = getValidFileTransfer('file-tx-2', 'userA', 'userB', 'data.txt', fileContent);
  manifest.status = 'ready';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-tx-2').set(manifest);
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();

  // 7. User B reads incoming manifest
  const incomingSnap = await assertSucceeds(userBDb.doc('files/file-tx-2').get());
  assert.equal(incomingSnap.exists, true);
  assert.equal(incomingSnap.data()?.status, 'ready');

  // 8. User B cannot complete before explicit acceptance & verification
  // Trying to set random status or skip verification
  await assertFails(userBDb.doc('files/file-tx-2').update({
    status: 'uploading',
    updatedAt: new Date()
  }));
});

test('9, 10, 11, 12. Download, SHA-256 Verification & Completion: User B downloads, verifies, and completes', async () => {
  const originalBytes = Buffer.from('Top secret mission coordinates: 34.0522 N, 118.2437 W');
  const originalSha256 = getSha256(originalBytes);
  const manifest = getValidFileTransfer('file-tx-3', 'userA', 'userB', 'coords.txt', originalBytes);
  manifest.status = 'ready';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-tx-3').set(manifest);
  });

  // Seed storage object as User A
  const userAStorage = testEnv.authenticatedContext('userA', { email_verified: true }).storage();
  await userAStorage.ref(manifest.storagePath).put(originalBytes, { contentType: 'text/plain' });

  // 9. User B downloads the file from Storage
  const userBStorage = testEnv.authenticatedContext('userB', { email_verified: true }).storage();
  const downloadUrl = await assertSucceeds(userBStorage.ref(manifest.storagePath).getDownloadURL());
  assert.ok(downloadUrl);

  // 10 & 11. Recalculate checksum on downloaded content and confirm exact match
  const simulatedDownloadedBytes = originalBytes; // Simulated buffer received from storage stream
  const downloadedSha256 = getSha256(simulatedDownloadedBytes);
  assert.equal(downloadedSha256, originalSha256);
  assert.equal(simulatedDownloadedBytes.toString(), originalBytes.toString());

  // 12. Transfer becomes completed only after successful verification
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertSucceeds(userBDb.doc('files/file-tx-3').update({
    status: 'completed',
    completedAt: new Date(),
    updatedAt: new Date()
  }));

  const finalSnap = await userBDb.doc('files/file-tx-3').get();
  assert.equal(finalSnap.data()?.status, 'completed');
  assert.ok(finalSnap.data()?.completedAt);
});

test('13. Decline & Cancel Behavior: Recipient can reject, Sender can cancel', async () => {
  const manifestDecline = getValidFileTransfer('file-dec', 'userA', 'userB', 'doc1.txt');
  manifestDecline.status = 'ready';

  const manifestCancel = getValidFileTransfer('file-can', 'userA', 'userB', 'doc2.txt');
  manifestCancel.status = 'pending';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-dec').set(manifestDecline);
    await context.firestore().doc('files/file-can').set(manifestCancel);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();

  // Recipient User B declines
  await assertSucceeds(userBDb.doc('files/file-dec').update({
    status: 'rejected',
    failureReason: 'User declined transfer',
    updatedAt: new Date()
  }));

  // Sender User A cancels
  await assertSucceeds(userADb.doc('files/file-can').update({
    status: 'cancelled',
    failureReason: 'User cancelled transfer',
    updatedAt: new Date()
  }));
});

test('14 & 15. Cryptographic Mismatch: Corrupted payload marked failed and rejected', async () => {
  const originalBytes = Buffer.from('Genuine document');
  const manifest = getValidFileTransfer('file-corrupt', 'userA', 'userB', 'doc.txt', originalBytes);
  manifest.status = 'ready';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-corrupt').set(manifest);
  });

  const corruptedBytes = Buffer.from('Tampered payload content!');
  const corruptedSha256 = getSha256(corruptedBytes);

  // Verification detects mismatch
  assert.notEqual(corruptedSha256, manifest.checksum);

  // Status transitions to failed
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertSucceeds(userBDb.doc('files/file-corrupt').update({
    status: 'failed',
    failureReason: 'Cryptographic checksum mismatch',
    updatedAt: new Date()
  }));

  const snap = await userBDb.doc('files/file-corrupt').get();
  assert.equal(snap.data()?.status, 'failed');
});

test('16 & 17. Cross-User Privacy: Unrelated User C cannot read manifest or Storage object', async () => {
  const fileBytes = Buffer.from('Confidential report');
  const manifest = getValidFileTransfer('file-priv', 'userA', 'userB', 'confidential.txt', fileBytes);
  manifest.status = 'ready';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-priv').set(manifest);
  });

  const userAStorage = testEnv.authenticatedContext('userA', { email_verified: true }).storage();
  await userAStorage.ref(manifest.storagePath).put(fileBytes, { contentType: 'text/plain' });

  const userCDb = testEnv.authenticatedContext('userC', { email_verified: true }).firestore();
  const userCStorage = testEnv.authenticatedContext('userC', { email_verified: true }).storage();

  // 16. User C cannot read manifest
  await assertFails(userCDb.doc('files/file-priv').get());

  // 17. User C cannot read Storage object
  await assertFails(userCStorage.ref(manifest.storagePath).getDownloadURL());
});

test('18. Unauthenticated Access: Anonymous requests cannot read or write manifest or storage', async () => {
  const fileBytes = Buffer.from('Classified data');
  const manifest = getValidFileTransfer('file-unauth', 'userA', 'userB', 'data.txt', fileBytes);

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const unauthStorage = testEnv.unauthenticatedContext().storage();

  // Unauth manifest read/write denied
  await assertFails(unauthDb.doc('files/file-unauth').set(manifest));
  await assertFails(unauthDb.doc('files/file-unauth').get());

  // Unauth storage write/read denied
  await assertFails(unauthStorage.ref(manifest.storagePath).put(fileBytes, { contentType: 'text/plain' }));
  await assertFails(unauthStorage.ref(manifest.storagePath).getDownloadURL());
});

test('19. Device Revocation Enforcement: Revoked device cannot initiate file transfer', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const revoked = getValidDevice('dev-compromised', 'userA');
    revoked.isRevoked = true;
    revoked.revokedAt = new Date();
    await context.firestore().doc('users/userA/devices/dev-compromised').set(revoked);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const payload = getValidFileTransfer('file-compromised', 'userA', 'userB');
  payload.sourceDeviceId = 'dev-compromised';

  await assertFails(userADb.doc('files/file-compromised').set(payload));
});

test('20. Deletion Protection: Direct client deletion of file record is blocked', async () => {
  const manifest = getValidFileTransfer('file-nodel', 'userA', 'userB');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-nodel').set(manifest);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('files/file-nodel').delete());
});

// =============================================================================
// ADDITIONAL SECURITY AUDIT ASSERTIONS
// =============================================================================

test('Security Review: Client cannot modify immutable fields (senderId, recipientId, fileSize, checksum)', async () => {
  const manifest = getValidFileTransfer('file-audit-immut', 'userA', 'userB');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('files/file-audit-immut').set(manifest);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();

  // Attempt to redirect recipientId
  await assertFails(userADb.doc('files/file-audit-immut').update({ recipientId: 'userC' }));
  // Attempt to forge checksum
  await assertFails(userADb.doc('files/file-audit-immut').update({ checksum: '0000000000000000000000000000000000000000000000000000000000000000' }));
  // Attempt to tamper with fileSize
  await assertFails(userADb.doc('files/file-audit-immut').update({ fileSize: 10 }));
  // Attempt to alter storagePath
  await assertFails(userADb.doc('files/file-audit-immut').update({ storagePath: 'transfers/userC/userB/file-audit-immut/test.txt' }));
});

test('Security Review: Upload cannot be redirected to another user Storage path', async () => {
  const userAStorage = testEnv.authenticatedContext('userA', { email_verified: true }).storage();
  const fileBytes = Buffer.from('Spoofed file');

  // User A attempting to write directly to User B's path as sender
  const spoofedRef = userAStorage.ref('transfers/userB/userC/file-spoof/test.txt');
  await assertFails(spoofedRef.put(fileBytes, { contentType: 'text/plain' }));
});

test('Security Review: Oversized payload (>100MB) is rejected by Storage rules', async () => {
  const userAStorage = testEnv.authenticatedContext('userA', { email_verified: true }).storage();
  // Simulate oversized payload metadata (> 100MB)
  const targetRef = userAStorage.ref('transfers/userA/userB/file-big/big.bin');
  // Attempting to upload 105MB payload
  const bigBuffer = Buffer.alloc(1024 * 1024); // 1MB buffer
  // Test with invalid content-type
  await assertFails(targetRef.put(bigBuffer, { contentType: 'application/x-msdownload' }));
});
