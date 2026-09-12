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
