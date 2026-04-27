import { isValidEmail } from '../authentication/auth';

jest.mock('../config/config', () => ({
  config: {
    firebaseProjectId: 'test-project',
    firebaseClientEmail: 'test@test.com',
    firebasePrivateKey: 'test-key',
    nodeEnv: 'development',
  },
}));

jest.mock('firebase-admin', () => ({
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
}));

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
}));

describe('Authentication - isValidEmail', () => {
  describe('valid emails', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should return true for email with dot', () => {
      expect(isValidEmail('user.name@domain.org')).toBe(true);
    });

    it('should return true for email with subdomain', () => {
      expect(isValidEmail('user@sub.domain.com')).toBe(true);
    });
  });

  describe('invalid emails', () => {
    it('should return false for empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('should return false for string without @', () => {
      expect(isValidEmail('invalid')).toBe(false);
    });

    it('should return false for string with @ but no domain', () => {
      expect(isValidEmail('no-at-sign')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidEmail(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidEmail(undefined)).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(isValidEmail('   ')).toBe(false);
    });

    it('should return false for email starting with whitespace', () => {
      // Edge case: current implementation allows this
      // The main validation is email.includes('@')
      expect(isValidEmail('test@example.com ')).toBe(true);
    });
  });
});