import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('Cloud Functions runtime export check: v1/v2 coexistence', () => {
  const funcs = require('../../backend/functions/lib/index.js');
  
  assert.ok(funcs, 'Functions module should load');
  assert.ok(funcs.authOnCreate, 'authOnCreate (v2 blocking identity trigger) must be exported');
  assert.ok(funcs.authOnDelete, 'authOnDelete (v1 background auth trigger) must be exported');
  
  assert.equal(typeof funcs.authOnCreate, 'function', 'authOnCreate must be a callable Cloud Function handler');
  assert.equal(typeof funcs.authOnDelete, 'function', 'authOnDelete must be a callable Cloud Function handler');
  
  console.log('Exported functions verified at runtime:', Object.keys(funcs));
});
