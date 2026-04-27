import { isValidEmail, isGuestPath } from '../authentication/auth';

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

    it('should return true for email with plus sign', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should return true for email with numbers', () => {
      expect(isValidEmail('user123@example.com')).toBe(true);
    });

    it('should return true for email with hyphen in domain', () => {
      expect(isValidEmail('user@sub-domain.com')).toBe(true);
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

    it('should return false for number input', () => {
      expect(isValidEmail(123 as any)).toBe(false);
    });

    it('should return false for object input', () => {
      expect(isValidEmail({} as any)).toBe(false);
    });

    it('should return false for boolean input', () => {
      expect(isValidEmail(true as any)).toBe(false);
      expect(isValidEmail(false as any)).toBe(false);
    });

    it('should return false for array input', () => {
      expect(isValidEmail([] as any)).toBe(false);
    });
  });
});

describe('Authentication - isGuestPath', () => {
  it('should return true for /auth/verify path', () => {
    expect(isGuestPath('/auth/verify')).toBe(true);
  });

  it('should return true for /api/auth/verify path', () => {
    expect(isGuestPath('/api/auth/verify')).toBe(true);
  });

  it('should return true for /auth/verify/extra path', () => {
    expect(isGuestPath('/auth/verify/extra')).toBe(true);
  });

  it('should return true for nested auth/verify paths', () => {
    expect(isGuestPath('/some/path/auth/verify')).toBe(true);
  });

  it('should return false for /api/users path', () => {
    expect(isGuestPath('/api/users')).toBe(false);
  });

  it('should return false for /api/chat path', () => {
    expect(isGuestPath('/api/chat')).toBe(false);
  });

  it('should return false for /auth/login path', () => {
    expect(isGuestPath('/auth/login')).toBe(false);
  });

  it('should return false for /auth/signup path', () => {
    expect(isGuestPath('/auth/signup')).toBe(false);
  });

  it('should return false for /auth path', () => {
    expect(isGuestPath('/auth')).toBe(false);
  });

  it('should return false for root path', () => {
    expect(isGuestPath('/')).toBe(false);
  });

  it('should return false for empty path', () => {
    expect(isGuestPath('')).toBe(false);
  });

  it('should return false for /api/auth path', () => {
    expect(isGuestPath('/api/auth')).toBe(false);
  });
});