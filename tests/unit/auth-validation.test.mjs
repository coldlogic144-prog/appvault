import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  emailSchema,
  passwordSchema
} from '../../packages/validation/dist/schemas.js';
import { ERROR_CODES } from '../../packages/error-codes/dist/codes.js';

test('emailSchema & passwordSchema: baseline validation rules', () => {
  assert.equal(emailSchema.safeParse('hero@comiclink.local').success, true);
  assert.equal(emailSchema.safeParse('not-an-email').success, false);
  assert.equal(emailSchema.safeParse('   ').success, false);

  assert.equal(passwordSchema.safeParse('superSecret123').success, true);
  assert.equal(passwordSchema.safeParse('short').success, false);
  assert.equal(passwordSchema.safeParse('').success, false);
});

test('loginSchema: accepts valid email and password credentials', () => {
  const valid = {
    email: 'agent.courier@comiclink.app',
    password: 'MissionPassword2026'
  };
  const result = loginSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, 'agent.courier@comiclink.app');
    assert.equal(result.data.password, 'MissionPassword2026');
  }
});

test('loginSchema: rejects invalid email formats and empty password', () => {
  const invalidEmail = {
    email: 'bad-email-format',
    password: 'anyPassword'
  };
  const emptyPassword = {
    email: 'valid@comiclink.app',
    password: ''
  };

  assert.equal(loginSchema.safeParse(invalidEmail).success, false);
  assert.equal(loginSchema.safeParse(emptyPassword).success, false);
});

test('registerSchema: accepts valid registration payload', () => {
  const valid = {
    displayName: 'Nightwing',
    email: 'dick.grayson@comiclink.app',
    password: 'BludhavenProtector1!',
    confirmPassword: 'BludhavenProtector1!'
  };
  const result = registerSchema.safeParse(valid);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.displayName, 'Nightwing');
    assert.equal(result.data.email, 'dick.grayson@comiclink.app');
  }
});

test('registerSchema: rejects mismatched passwords', () => {
  const mismatched = {
    displayName: 'Batman',
    email: 'bruce.wayne@comiclink.app',
    password: 'GothamKnight2026',
    confirmPassword: 'WrongPassword2026'
  };
  const result = registerSchema.safeParse(mismatched);
  assert.equal(result.success, false);
  if (!result.success) {
    const errorIssue = result.error.issues.find(i => i.path.includes('confirmPassword'));
    assert.ok(errorIssue, 'Should have an error issue for confirmPassword');
    assert.equal(errorIssue.message, 'Passcodes do not match');
  }
});

test('registerSchema: rejects invalid callsign or weak password', () => {
  const blankName = {
    displayName: '   ',
    email: 'valid@comiclink.app',
    password: 'ValidPassword123',
    confirmPassword: 'ValidPassword123'
  };
  const shortPass = {
    displayName: 'ValidHero',
    email: 'valid@comiclink.app',
    password: 'short',
    confirmPassword: 'short'
  };

  assert.equal(registerSchema.safeParse(blankName).success, false);
  assert.equal(registerSchema.safeParse(shortPass).success, false);
});

test('forgotPasswordSchema: accepts valid email and rejects invalid', () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: 'rescue@comiclink.app' }).success, true);
  assert.equal(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success, false);
  assert.equal(forgotPasswordSchema.safeParse({ email: '' }).success, false);
});

test('ERROR_CODES.AUTH: exposes required Phase 1 auth codes', () => {
  assert.equal(ERROR_CODES.AUTH.INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  assert.equal(ERROR_CODES.AUTH.USER_COLLISION, 'USER_COLLISION');
  assert.equal(ERROR_CODES.AUTH.WEAK_PASSWORD, 'WEAK_PASSWORD');
  assert.equal(ERROR_CODES.AUTH.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS');
  assert.equal(ERROR_CODES.AUTH.NETWORK_ERROR, 'NETWORK_ERROR');
  assert.equal(ERROR_CODES.AUTH.CONFIGURATION_ERROR, 'CONFIGURATION_ERROR');
});
