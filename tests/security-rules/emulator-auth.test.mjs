import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const firestoreRulesPath = path.resolve('backend/firestore.rules');

test('Firestore Security Rules: User profile collection exists and defines strict client limits', () => {
  assert.ok(fs.existsSync(firestoreRulesPath), 'firestore.rules must exist');
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');

  // Must match users collection
  assert.ok(content.includes('match /users/{uid}'), 'Must match users/{uid}');

  // Must restrict create to owner with standard role and status
  assert.ok(content.includes("allow create: if isOwner(uid)"), 'Create requires isOwner(uid)');
  assert.ok(content.includes("request.resource.data.role == 'user'"), "Create forces role to be 'user'");
  assert.ok(content.includes("request.resource.data.status == 'active'"), "Create forces status to be 'active'");

  // Must forbid modifying role or status on update
  assert.ok(content.includes("request.resource.data.role == resource.data.role"), 'Role cannot be escalated by client');
  assert.ok(content.includes("request.resource.data.status == resource.data.status"), 'Status cannot be altered by client');
  assert.ok(content.includes("request.resource.data.createdAt == resource.data.createdAt"), 'createdAt cannot be overwritten');

  // Must whitelist safe client update fields only
  assert.ok(
    content.includes("hasOnly(['displayName', 'photoURL', 'bio', 'clipboardSyncEnabled', 'updatedAt'])"),
    'Only safe client fields are permitted for profile updates'
  );

  // Must NOT allow client delete on users doc
  assert.equal(content.includes("allow delete: if isOwner(uid)"), false, 'Client must not be allowed to delete users doc directly');
});

test('Firestore Security Rules: Device registration rules enforce ownership and required keys', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');

  assert.ok(content.includes('match /devices/{deviceId}'), 'Must match user subcollection devices/{deviceId}');
  assert.ok(content.includes("allow read: if isOwner(uid);"), 'Device read requires owner');
  assert.ok(content.includes("allow create: if isOwner(uid)"), 'Device create requires owner');
  assert.ok(content.includes("keys().hasAll(['deviceName', 'platform', 'createdAt'])"), 'Device must include required keys');
  assert.ok(content.includes("allow delete: if false;"), 'Direct client device deletion is blocked');
});
