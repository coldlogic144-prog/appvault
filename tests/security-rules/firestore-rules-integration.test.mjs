import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';

const firestoreRules = fs.readFileSync(path.resolve('backend/firestore.rules'), 'utf8');

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-comiclink-rules-test',
    firestore: {
      rules: firestoreRules,
      host: '127.0.0.1',
      port: 8080
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
  }
});

// Helper fixture factories
function getValidUserAccount(uid = 'userA') {
  return {
    uid,
    email: `${uid}@comiclink.hq`,
    emailVerified: true,
    blockedUsers: [],
    clipboardSyncEnabled: true,
    deviceCount: 0,
    role: 'user',
    accountStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function getValidPublicProfile(uid = 'userA') {
  return {
    uid,
    displayName: 'ShadowHawk',
    photoURL: null,
    bio: 'Defender of Bludhaven',
    presenceStatus: 'online',
    updatedAt: new Date()
  };
}

// ============================================================================
// PRIVATE USERS COLLECTION TESTS (1 - 13)
// ============================================================================

test('1. Private users: Unauthenticated read is rejected', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.doc('users/userA').get());
});

test('2. Private users: User A can read users/userA', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('users/userA').get());
});

test('3. Private users: User B cannot read users/userA', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('users/userA').get());
});

test('4. Private users: User B cannot create users/userA', async () => {
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('users/userA').set(getValidUserAccount('userA')));
});

test('5. Private users: User B cannot update users/userA', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('users/userA').update({ clipboardSyncEnabled: false }));
});

test('6. Private users: User A cannot change role', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA').update({ role: 'admin' }));
});

test('7. Private users: User A cannot change accountStatus', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA').update({ accountStatus: 'suspended' }));
});

test('8. Private users: User A cannot change emailVerified', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA').update({ emailVerified: false }));
});

test('9. Private users: User A cannot change deviceCount', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA').update({ deviceCount: 10 }));
});

test('10. Private users: User A cannot change createdAt', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA').update({ createdAt: new Date() }));
});

test('11. Private users: User A cannot delete users/userA', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA').set(getValidUserAccount('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA').delete());
});

test('12. Private users: User B cannot list/query users', async () => {
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.collection('users').get());
});

test('13. Private users: Invalid or extra fields are rejected on create', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const invalidAccount = {
    ...getValidUserAccount('userA'),
    hackerField: 'unauthorized_payload'
  };
  await assertFails(userADb.doc('users/userA').set(invalidAccount));
});

// ============================================================================
// PUBLIC PROFILES COLLECTION TESTS (14 - 26)
// ============================================================================

test('14. Public profiles: Unauthenticated read is rejected', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.doc('publicProfiles/userA').get());
});

test('15. Public profiles: User B can read publicProfiles/userA', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertSucceeds(userBDb.doc('publicProfiles/userA').get());
});

test('16. Public profiles: User A can create publicProfiles/userA with valid fields', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('publicProfiles/userA').set(getValidPublicProfile('userA')));
});

test('17. Public profiles: User A can update their own bio', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('publicProfiles/userA').update({ bio: 'Vigilante of the night' }));
});

test('18. Public profiles: User B cannot create publicProfiles/userA', async () => {
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('publicProfiles/userA').set(getValidPublicProfile('userA')));
});

test('19. Public profiles: User B cannot update publicProfiles/userA', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('publicProfiles/userA').update({ bio: 'Compromised bio' }));
});

test('20. Public profiles: User A cannot modify uid', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('publicProfiles/userA').update({ uid: 'hijackedUid' }));
});

test('21. Public profiles: User A cannot inject role or accountStatus', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('publicProfiles/userA').update({ role: 'admin' }));
  await assertFails(userADb.doc('publicProfiles/userA').update({ accountStatus: 'suspended' }));
});

test('22. Public profiles: User A cannot inject email or private fields', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('publicProfiles/userA').update({ email: 'leak@comiclink.app' }));
  await assertFails(userADb.doc('publicProfiles/userA').update({ blockedUsers: ['userB'] }));
});

test('23. Public profiles: Invalid presenceStatus is rejected', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('publicProfiles/userA').update({ presenceStatus: 'stealth_invisible' }));
});

test('24. Public profiles: Missing required fields are rejected on create', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const incompleteProfile = {
    uid: 'userA',
    displayName: 'ShadowHawk'
    // missing presenceStatus and updatedAt
  };
  await assertFails(userADb.doc('publicProfiles/userA').set(incompleteProfile));
});

test('25. Public profiles: Excessively long displayName or bio is rejected', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('publicProfiles/userA').update({ displayName: 'A'.repeat(51) }));
  await assertFails(userADb.doc('publicProfiles/userA').update({ bio: 'B'.repeat(501) }));
});

test('26. Public profiles: User A cannot delete the public profile', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('publicProfiles/userA').set(getValidPublicProfile('userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('publicProfiles/userA').delete());
});

// ============================================================================
// DEVICE SUBCOLLECTION TESTS (27 - 40)
// ============================================================================

function getValidDevice(deviceId = 'dev1', ownerId = 'userA') {
  return {
    deviceId,
    ownerId,
    deviceName: 'HQ-Terminal-Alpha',
    platform: 'windows',
    appVersion: '0.1.0',
    createdAt: new Date(),
    lastSeenAt: new Date(),
    isRevoked: false,
    revokedAt: null
  };
}

test('27. Device: Unauthenticated read is rejected', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.doc('users/userA/devices/dev1').get());
});

test('28. Device: User A can read own device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('users/userA/devices/dev1').get());
});

test('29. Device: User A can list own devices', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.collection('users/userA/devices').get());
});

test('30. Device: User B cannot read User A device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('users/userA/devices/dev1').get());
});

test('31. Device: User B cannot list User A devices', async () => {
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.collection('users/userA/devices').get());
});

test('32. Device: User A can register a new device with valid fields', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA')));
});

test('33. Device: User B cannot register a device under User A', async () => {
  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('users/userA/devices/dev2').set(getValidDevice('dev2', 'userA')));
});

test('34. Device: User A cannot register device with mismatched deviceId or ownerId', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const mismatchedId = { ...getValidDevice('dev1', 'userA'), deviceId: 'wrongId' };
  const mismatchedOwner = { ...getValidDevice('dev1', 'userA'), ownerId: 'userB' };

  await assertFails(userADb.doc('users/userA/devices/dev1').set(mismatchedId));
  await assertFails(userADb.doc('users/userA/devices/dev1').set(mismatchedOwner));
});

test('35. Device: User A cannot register device initially marked isRevoked: true', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const alreadyRevoked = { ...getValidDevice('dev1', 'userA'), isRevoked: true };
  await assertFails(userADb.doc('users/userA/devices/dev1').set(alreadyRevoked));
});

test('36. Device: User A can update deviceName and lastSeenAt on own device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('users/userA/devices/dev1').update({
    deviceName: 'Batcave-Workstation-1',
    lastSeenAt: new Date()
  }));
});

test('37. Device: User A can revoke own device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('users/userA/devices/dev1').update({
    isRevoked: true,
    revokedAt: new Date()
  }));
});

test('38. Device: User A cannot change ownerId, platform, or createdAt on update', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA/devices/dev1').update({ ownerId: 'userB' }));
  await assertFails(userADb.doc('users/userA/devices/dev1').update({ platform: 'android' }));
  await assertFails(userADb.doc('users/userA/devices/dev1').update({ createdAt: new Date() }));
});

test('39. Device: User B cannot update or revoke User A device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('users/userA/devices/dev1').update({ deviceName: 'Hacked-Name' }));
  await assertFails(userBDb.doc('users/userA/devices/dev1').update({ isRevoked: true }));
});

test('40. Device: User A cannot delete device directly', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('users/userA/devices/dev1').delete());
});

// =============================================================================
// PAIRING SESSIONS & PAIRED DEVICES SECURITY INTEGRATION TESTS (41 - 58)
// =============================================================================

function getValidPairingSession(sessionId, initiatorUserId, initiatorDeviceId) {
  return {
    sessionId,
    initiatorUserId,
    initiatorDeviceId,
    initiatorDeviceName: 'Station-Alpha',
    pairingCode: 'CL-A1B2C3',
    status: 'pending',
    targetUserId: null,
    targetDeviceId: null,
    targetDeviceName: null,
    challengeHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    approvedAt: null,
    completedAt: null,
    cancelledAt: null,
    rejectedAt: null
  };
}

test('41. Pairing: Unauthenticated user cannot create pairing session', async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.doc('pairingSessions/sess1').set(getValidPairingSession('sess1', 'userA', 'dev1')));
});

test('42. Pairing: User A can create valid pending pairing session for own active device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('pairingSessions/sess1').set(getValidPairingSession('sess1', 'userA', 'dev1')));
});

test('43. Pairing: Initiator cannot create pairing session if initiator device is revoked', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const revoked = getValidDevice('dev-revoked', 'userA');
    revoked.isRevoked = true;
    revoked.revokedAt = new Date();
    await context.firestore().doc('users/userA/devices/dev-revoked').set(revoked);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('pairingSessions/sess-rev').set(getValidPairingSession('sess-rev', 'userA', 'dev-revoked')));
});

test('44. Pairing: Initiator cannot create session with false initiatorUserId', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  // userA pretending initiator is userB
  await assertFails(userADb.doc('pairingSessions/sess2').set(getValidPairingSession('sess2', 'userB', 'dev1')));
});

test('45. Pairing: Pairing session cannot be created with non-pending status', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  const invalidStatus = getValidPairingSession('sess3', 'userA', 'dev1');
  invalidStatus.status = 'approved';
  await assertFails(userADb.doc('pairingSessions/sess3').set(invalidStatus));
});

test('46. Pairing: Pairing session cannot be created with missing required fields', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('pairingSessions/sess4').set({
    sessionId: 'sess4',
    initiatorUserId: 'userA',
    status: 'pending'
  }));
});

test('47. Pairing: Collection list queries on pairingSessions are denied (anti-enumeration)', async () => {
  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.collection('pairingSessions').get());
});

test('48. Pairing: User B can read a pending pairing session by direct ID lookup', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('pairingSessions/sess-pending').set(getValidPairingSession('sess-pending', 'userA', 'dev1'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertSucceeds(userBDb.doc('pairingSessions/sess-pending').get());
});

test('49. Pairing: User A can cancel their own pending session', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('pairingSessions/sess-cancel').set(getValidPairingSession('sess-cancel', 'userA', 'dev1'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('pairingSessions/sess-cancel').update({
    status: 'cancelled',
    cancelledAt: new Date()
  }));
});

test('50. Pairing: User B cannot cancel User A pending session', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('pairingSessions/sess-cancel-b').set(getValidPairingSession('sess-cancel-b', 'userA', 'dev1'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('pairingSessions/sess-cancel-b').update({
    status: 'cancelled',
    cancelledAt: new Date()
  }));
});

test('51. Pairing: Target User B can approve User A pending session before expiration', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    await context.firestore().doc('pairingSessions/sess-approve').set(getValidPairingSession('sess-approve', 'userA', 'dev1'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertSucceeds(userBDb.doc('pairingSessions/sess-approve').update({
    status: 'approved',
    targetUserId: 'userB',
    targetDeviceId: 'dev2',
    targetDeviceName: 'Station-Beta',
    approvedAt: new Date()
  }));
});

test('52. Pairing: Target User B cannot approve session using a revoked device', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    const revoked = getValidDevice('dev-rev-b', 'userB');
    revoked.isRevoked = true;
    revoked.revokedAt = new Date();
    await context.firestore().doc('users/userB/devices/dev-rev-b').set(revoked);
    await context.firestore().doc('pairingSessions/sess-rev-b').set(getValidPairingSession('sess-rev-b', 'userA', 'dev1'));
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('pairingSessions/sess-rev-b').update({
    status: 'approved',
    targetUserId: 'userB',
    targetDeviceId: 'dev-rev-b',
    targetDeviceName: 'Station-Revoked',
    approvedAt: new Date()
  }));
});

test('53. Pairing: Target User B cannot approve an expired session', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    const expiredSession = getValidPairingSession('sess-expired', 'userA', 'dev1');
    expiredSession.expiresAt = new Date(Date.now() - 60 * 1000); // Expired 1 min ago
    await context.firestore().doc('pairingSessions/sess-expired').set(expiredSession);
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('pairingSessions/sess-expired').update({
    status: 'approved',
    targetUserId: 'userB',
    targetDeviceId: 'dev2',
    targetDeviceName: 'Station-Beta',
    approvedAt: new Date()
  }));
});

test('54. Pairing: Target User B cannot approve an already cancelled session', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    const cancelled = getValidPairingSession('sess-was-cancelled', 'userA', 'dev1');
    cancelled.status = 'cancelled';
    cancelled.cancelledAt = new Date();
    await context.firestore().doc('pairingSessions/sess-was-cancelled').set(cancelled);
  });

  const userBDb = testEnv.authenticatedContext('userB', { email_verified: true }).firestore();
  await assertFails(userBDb.doc('pairingSessions/sess-was-cancelled').update({
    status: 'approved',
    targetUserId: 'userB',
    targetDeviceId: 'dev2',
    targetDeviceName: 'Station-Beta',
    approvedAt: new Date()
  }));
});

test('55. Pairing: User C cannot tamper with session approved between User A and User B', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    const approved = getValidPairingSession('sess-appr', 'userA', 'dev1');
    approved.status = 'approved';
    approved.targetUserId = 'userB';
    approved.targetDeviceId = 'dev2';
    approved.targetDeviceName = 'Station-Beta';
    approved.approvedAt = new Date();
    await context.firestore().doc('pairingSessions/sess-appr').set(approved);
  });

  const userCDb = testEnv.authenticatedContext('userC', { email_verified: true }).firestore();
  await assertFails(userCDb.doc('pairingSessions/sess-appr').update({
    status: 'completed',
    completedAt: new Date()
  }));
});

test('56. Pairing: Initiator User A can complete approved session', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    const approved = getValidPairingSession('sess-comp', 'userA', 'dev1');
    approved.status = 'approved';
    approved.targetUserId = 'userB';
    approved.targetDeviceId = 'dev2';
    approved.targetDeviceName = 'Station-Beta';
    approved.approvedAt = new Date();
    await context.firestore().doc('pairingSessions/sess-comp').set(approved);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertSucceeds(userADb.doc('pairingSessions/sess-comp').update({
    status: 'completed',
    completedAt: new Date()
  }));
});

test('57. Pairing: Completed session cannot be completed again or modified (terminal state)', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('users/userB/devices/dev2').set(getValidDevice('dev2', 'userB'));
    const completed = getValidPairingSession('sess-term', 'userA', 'dev1');
    completed.status = 'completed';
    completed.targetUserId = 'userB';
    completed.targetDeviceId = 'dev2';
    completed.completedAt = new Date();
    await context.firestore().doc('pairingSessions/sess-term').set(completed);
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('pairingSessions/sess-term').update({
    status: 'completed',
    completedAt: new Date()
  }));
});

test('58. Pairing: Direct deletion of pairing session is blocked', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/userA/devices/dev1').set(getValidDevice('dev1', 'userA'));
    await context.firestore().doc('pairingSessions/sess-del').set(getValidPairingSession('sess-del', 'userA', 'dev1'));
  });

  const userADb = testEnv.authenticatedContext('userA', { email_verified: true }).firestore();
  await assertFails(userADb.doc('pairingSessions/sess-del').delete());
});

