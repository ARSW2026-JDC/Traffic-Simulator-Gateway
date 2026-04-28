import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { validateUrl, validatePort, validateFirebasePrivateKey } from '../src/config/env.validation';

describe('Environment Validation Functions', () => {
  describe('validateUrl', () => {
    it('should accept valid HTTP URLs', () => {
      expect(() => validateUrl('http://localhost:4000', 'TEST')).not.toThrow();
      expect(() => validateUrl('https://example.com', 'TEST')).not.toThrow();
      expect(() => validateUrl('http://localhost:4000/path', 'TEST')).not.toThrow();
    });

    it('should throw on invalid URLs', () => {
      expect(() => validateUrl('invalid', 'TEST')).toThrow();
      expect(() => validateUrl('', 'TEST')).toThrow();
    });
  });

  describe('validatePort', () => {
    it('should accept valid ports', () => {
      expect(() => validatePort(3000, 'PORT')).not.toThrow();
      expect(() => validatePort(1, 'PORT')).not.toThrow();
      expect(() => validatePort(65535, 'PORT')).not.toThrow();
    });

    it('should throw on invalid ports', () => {
      expect(() => validatePort(0, 'PORT')).toThrow();
      expect(() => validatePort(-1, 'PORT')).toThrow();
      expect(() => validatePort(65536, 'PORT')).toThrow();
      expect(() => validatePort(3000.5, 'PORT')).toThrow();
    });
  });

  describe('validateFirebasePrivateKey', () => {
    it('should accept valid private keys', () => {
      const validKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBA
-----END PRIVATE KEY-----`;
      expect(() => validateFirebasePrivateKey(validKey)).not.toThrow();
    });

    it('should throw on invalid private keys', () => {
      expect(() => validateFirebasePrivateKey('invalid')).toThrow();
      expect(() => validateFirebasePrivateKey('BEGIN PRIVATE KEY')).toThrow();
      expect(() => validateFirebasePrivateKey('END PRIVATE KEY')).toThrow();
    });
  });
});

describe('Config Module', () => {
  it('should export config object', () => {
    const { config } = require('../src/config/config');
    expect(config).toBeDefined();
    expect(config.port).toBeDefined();
    expect(config.backendUrl).toBeDefined();
    expect(config.simulationUrl).toBeDefined();
  });
});

// ─── validateEnvironment() ────────────────────────────────────────────────────

describe('validateEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const loadAndValidate = () => {
    const { validateEnvironment } = require('../src/config/env.validation') as
      typeof import('../src/config/env.validation');
    return validateEnvironment;
  };

  it('should succeed with valid defaults (no env vars set)', () => {
    delete process.env.PORT;
    delete process.env.BACKEND_URL;
    delete process.env.SIMULATION_URL;
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    process.env.NODE_ENV = 'development';

    const validate = loadAndValidate();
    const result = validate();
    expect(result.port).toBe(3000);
    expect(result.backendUrl).toBe('http://localhost:4000');
    expect(result.simulationUrl).toBe('http://localhost:5000');
    expect(result.nodeEnv).toBe('development');
  });

  it('should replace \\n in FIREBASE_PRIVATE_KEY with real newlines', () => {
    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\\nfakekey\\n-----END PRIVATE KEY-----';
    process.env.NODE_ENV = 'development';

    const validate = loadAndValidate();
    const result = validate();
    expect(result.firebasePrivateKey).toContain('\n');
    expect(result.firebasePrivateKey).not.toContain('\\n');
  });

  it('should fail when only FIREBASE_PROJECT_ID is set (partial config)', () => {
    process.env.FIREBASE_PROJECT_ID = 'proj';
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    process.env.NODE_ENV = 'development';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const validate = loadAndValidate();
    validate();
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('should fail when FIREBASE_CLIENT_EMAIL has no @', () => {
    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_CLIENT_EMAIL = 'notanemail';
    process.env.FIREBASE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    process.env.NODE_ENV = 'development';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const validate = loadAndValidate();
    validate();
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('should fail when FIREBASE_PRIVATE_KEY is missing PEM markers', () => {
    process.env.FIREBASE_PROJECT_ID = 'proj';
    process.env.FIREBASE_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = 'just-some-random-string';
    process.env.NODE_ENV = 'development';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const validate = loadAndValidate();
    validate();
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('should fail when PORT is out of range', () => {
    process.env.PORT = '99999';
    process.env.NODE_ENV = 'development';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const validate = loadAndValidate();
    validate();
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('should fail when BACKEND_URL is not a valid URL', () => {
    process.env.BACKEND_URL = 'not-a-url';
    process.env.NODE_ENV = 'development';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const validate = loadAndValidate();
    validate();
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('should accumulate multiple validation errors before exiting', () => {
    process.env.PORT = '0';
    process.env.BACKEND_URL = 'invalid';
    process.env.NODE_ENV = 'development';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const validate = loadAndValidate();
    validate();
    // Should exit only once even with multiple errors
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    consoleSpy.mockRestore();
  });
});