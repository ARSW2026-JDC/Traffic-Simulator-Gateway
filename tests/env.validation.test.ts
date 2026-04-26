import { describe, it, expect } from '@jest/globals';
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