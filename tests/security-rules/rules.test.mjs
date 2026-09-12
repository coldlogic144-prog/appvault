import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const firestoreRulesPath = path.resolve('backend/firestore.rules');
const storageRulesPath = path.resolve('backend/storage.rules');

test('Firestore Security Rules: File exists and has content', () => {
  assert.ok(fs.existsSync(firestoreRulesPath), 'firestore.rules must exist');
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');
  assert.ok(content.length > 500, 'firestore.rules must contain substantial rules');
});

test('Firestore Security Rules: Strict deny-all baseline and v2 syntax', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');
  assert.ok(content.includes("rules_version = '2';"), "Must declare rules_version = '2';");
  assert.ok(content.includes("match /{document=**}"), "Must have root recursive document match");
  assert.ok(content.includes("allow read, write: if false;"), "Must declare root default deny-all");
  assert.equal(content.includes("allow read, write: if true;"), false, "Must NEVER have open allow read, write: if true;");
});

test('Firestore Security Rules: Privileged collections locked from client access', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');

  // pairingSessions must be Cloud Functions only
  assert.ok(
    content.includes("match /pairingSessions/{sessionId}") && content.includes("allow read, write: if false;"),
    "pairingSessions must deny all client read/write"
  );

  // auditLogs must be Cloud Functions only
  assert.ok(
    content.includes("match /auditLogs/{logId}") && content.includes("allow read, write: if false;"),
    "auditLogs must deny all client read/write"
  );
});

test('Firestore Security Rules: Comprehensive coverage of all 14 schema collections', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');
  const requiredCollections = [
    'users/{uid}',
    'publicProfiles/{uid}',
    'devices/{deviceId}',
    'pairingSessions/{sessionId}',
    'pairedDevices/{pairId}',
    'files/{fileId}',
    'conversations/{conversationId}',
    'members/{uid}',
    'messages/{messageId}',
    'clipboardItems/{clipboardId}',
    'posts/{postId}',
    'comments/{commentId}',
    'likes/{uid}',
    'reports/{reportId}',
    'notifications/{notificationId}',
    'auditLogs/{logId}'
  ];

  for (const col of requiredCollections) {
    assert.ok(content.includes(`match /${col}`), `firestore.rules must explicitly match collection: ${col}`);
  }
});

test('Firestore Security Rules: Critical security helpers defined', () => {
  const content = fs.readFileSync(firestoreRulesPath, 'utf8');
  assert.ok(content.includes("function isAuthenticated()"), "Must define isAuthenticated helper");
  assert.ok(content.includes("function isOwner(uid)"), "Must define isOwner helper");
  assert.ok(content.includes("function isConversationMember(conversationId)"), "Must define isConversationMember helper");
  assert.ok(content.includes("function isServerTimestamp(value)"), "Must define isServerTimestamp helper");
});

test('Storage Security Rules: File exists, v2 syntax, and deny-all baseline', () => {
  assert.ok(fs.existsSync(storageRulesPath), 'storage.rules must exist');
  const content = fs.readFileSync(storageRulesPath, 'utf8');
  assert.ok(content.includes("rules_version = '2';"), "Must declare rules_version = '2';");
  assert.ok(content.includes("match /{allPaths=**}"), "Must have root allPaths match");
  assert.ok(content.includes("allow read, write: if false;"), "Must declare root default deny-all");
  assert.equal(content.includes("allow read, write: if true;"), false, "Must NEVER have open allow read, write: if true;");
});

test('Storage Security Rules: Size and MIME type validations enforced', () => {
  const content = fs.readFileSync(storageRulesPath, 'utf8');
  assert.ok(content.includes("isImage()"), "Must enforce isImage constraint");
  assert.ok(content.includes("isValidContentType()"), "Must enforce isValidContentType constraint");
  assert.ok(content.includes("isLessThanMB("), "Must enforce file size limits");
  assert.ok(content.includes("match /users/{uid}/avatar/{fileName}"), "Must cover avatar path");
  assert.ok(content.includes("match /users/{uid}/files/{fileId}/{fileName}"), "Must cover user file transfer path");
  assert.ok(content.includes("match /users/{uid}/posts/{postId}/{fileName}"), "Must cover post media path");
});
