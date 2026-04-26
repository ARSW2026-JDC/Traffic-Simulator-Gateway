import { describe, it, expect } from '@jest/globals';

describe('Authentication Module', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      const { isValidEmail } = require('../src/authentication/auth');
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user@domain.org')).toBe(true);
      expect(isValidEmail('user.name@domain.com')).toBe(true);
      expect(isValidEmail('test+tag@example.com')).toBe(true);
      expect(isValidEmail('test@sub.domain.com')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      const { isValidEmail } = require('../src/authentication/auth');
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });

    it('should return false for whitespace-only strings', () => {
      const { isValidEmail } = require('../src/authentication/auth');
      expect(isValidEmail('   ')).toBe(false);
    });
  });

  describe('getFirebaseApp', () => {
    it('should export getFirebaseApp function', () => {
      const { getFirebaseApp } = require('../src/authentication/auth');
      expect(getFirebaseApp).toBeDefined();
      expect(typeof getFirebaseApp).toBe('function');
    });
  });

  describe('authMiddleware', () => {
    it('should export authMiddleware function', () => {
      const { authMiddleware } = require('../src/authentication/auth');
      expect(authMiddleware).toBeDefined();
      expect(typeof authMiddleware).toBe('function');
    });
  });
});