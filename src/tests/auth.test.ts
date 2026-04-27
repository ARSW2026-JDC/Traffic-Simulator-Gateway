import { isValidEmail, isGuestPath } from '../authentication/auth';

const validEmails = [
  'test@example.com',
  'user.name@domain.org',
  'user@sub.domain.com',
  'user+tag@example.com',
  'user123@example.com',
  'user@sub-domain.com',
];

type InvalidEmailTest = [unknown, string];
const invalidEmails: InvalidEmailTest[] = [
  ['', 'empty string'],
  ['invalid', 'string without @'],
  ['no-at-sign', 'string with @ but no domain'],
  [null, 'null'],
  [undefined, 'undefined'],
  ['   ', 'whitespace only'],
  [123, 'number'],
  [{}, 'object'],
  [true, 'boolean true'],
  [false, 'boolean false'],
  [[], 'array'],
];

type GuestPathTest = [string, boolean];
const guestPathTests: GuestPathTest[] = [
  ['/auth/verify', true],
  ['/api/auth/verify', true],
  ['/auth/verify/extra', true],
  ['/some/path/auth/verify', true],
  ['/api/users', false],
  ['/api/chat', false],
  ['/auth/login', false],
  ['/auth/signup', false],
  ['/auth', false],
  ['/', false],
  ['', false],
  ['/api/auth', false],
];

describe('Authentication - isValidEmail', () => {
  describe.each(validEmails)('valid email: %s', (email) => {
    it(`should return true for ${email}`, () => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  describe.each(invalidEmails)('invalid email: %s', (email) => {
    it(`should return false for ${email}`, () => {
      expect(isValidEmail(email)).toBe(false);
    });
  });
});

describe('Authentication - isGuestPath', () => {
  describe.each(guestPathTests)('path: %s should return %s', (path, expected) => {
    it(`should return ${expected} for ${path}`, () => {
      expect(isGuestPath(path)).toBe(expected);
    });
  });
});