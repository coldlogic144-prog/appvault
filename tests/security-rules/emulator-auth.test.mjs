import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const firestoreRulesPath = path.resolve('backend/firestore.rules');

test('Firestore Static Rules Check: Private User Account rules enforce owner-only access and immutability', () => {
  assert.ok(fs.existsSync(firestoreRulesPath), 'firestore.rules must exist');
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');

  // Must match users collection
  assert.ok(content.includes('match /users/{uid}'), 'Must match users/{uid}');

  // Must allow get only for owner and deny list
  assert.ok(content.includes("allow get: if isOwner(uid);"), 'Get requires isOwner(uid)');
  assert.ok(content.includes("allow list: if false;"), 'List must be denied');

  // Must restrict create to owner with standard role and status
  assert.ok(content.includes("allow create: if isOwner(uid)"), 'Create requires isOwner(uid)');
  assert.ok(content.includes("request.resource.data.role == 'user'"), "Create forces role to be 'user'");
  assert.ok(content.includes("request.resource.data.accountStatus == 'active'"), "Create forces accountStatus to be 'active'");

  // Must forbid modifying server fields on update
  assert.ok(content.includes("request.resource.data.role == resource.data.role"), 'Role cannot be escalated by client');
  assert.ok(content.includes("request.resource.data.accountStatus == resource.data.accountStatus"), 'accountStatus cannot be altered by client');
  assert.ok(content.includes("request.resource.data.createdAt == resource.data.createdAt"), 'createdAt cannot be overwritten');
  assert.ok(content.includes("request.resource.data.emailVerified == resource.data.emailVerified"), 'emailVerified cannot be altered by client');
  assert.ok(content.includes("request.resource.data.deviceCount == resource.data.deviceCount"), 'deviceCount cannot be altered by client');

  // Must whitelist safe client update fields only
  assert.ok(
    content.includes("hasOnly(['clipboardSyncEnabled', 'blockedUsers', 'updatedAt'])"),
    'Only safe client fields are permitted for account updates'
  );

  // Must NOT allow client delete on users doc
  assert.ok(content.includes("allow delete: if false;"), 'Client must not be allowed to delete users doc directly');
});

test('Firestore Static Rules Check: Public Profile rules enforce authenticated read, owner write, and field bounds', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');

  assert.ok(content.includes('match /publicProfiles/{uid}'), 'Must match publicProfiles/{uid}');
  assert.ok(content.includes("allow read: if isAuthenticated();"), 'Public profiles readable by authenticated users');
  assert.ok(content.includes("allow create: if isOwner(uid)"), 'Public profile create requires owner');
  assert.ok(content.includes("allow update: if isOwner(uid)"), 'Public profile update requires owner');
  assert.ok(content.includes("presenceStatus in ['online', 'offline', 'away']"), 'Enforces valid presenceStatus');
  assert.ok(content.includes("displayName.size() <= 50"), 'Enforces displayName length');
});

test('Firestore Static Rules Check: Device registration rules enforce ownership and required keys', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');

  assert.ok(content.includes('match /devices/{deviceId}'), 'Must match user subcollection devices/{deviceId}');
  assert.ok(content.includes("allow get, list: if isOwner(uid);"), 'Device get and list require owner');
  assert.ok(content.includes("allow create: if isOwner(uid)"), 'Device create requires owner');
  assert.ok(content.includes("request.resource.data.deviceId == deviceId"), 'Device ID must match path ID');
  assert.ok(content.includes("request.resource.data.ownerId == uid"), 'Owner ID must match auth UID');
  assert.ok(content.includes("allow delete: if false;"), 'Direct client device deletion is blocked');
});
