import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  validateUrl,
  validatePort,
  validateFirebasePrivateKey,
  validateEnvironment,
} from '../src/config/env.validation';

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

describe('validateEnvironment', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.GRAFANA_CLOUD_URL;
    delete process.env.GRAFANA_CLOUD_USER;
    delete process.env.GRAFANA_CLOUD_API_KEY;
    process.env.NODE_ENV = 'test';
    process.env.BACKEND_URL = 'http://localhost:4000';
    process.env.SIMULATION_URL = 'http://localhost:5000';
    process.env.CHAT_URL = 'http://localhost:6000';
    process.env.HISTORY_URL = 'http://localhost:3060';
    process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
    process.env.PORT = '3000';
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('should return default values when no env vars are set', () => {
    delete process.env.BACKEND_URL;
    delete process.env.SIMULATION_URL;
    delete process.env.CHAT_URL;
    delete process.env.HISTORY_URL;
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.PORT;
    const result = validateEnvironment();
    expect(result.port).toBe(3000);
    expect(result.backendUrl).toBe('http://localhost:4000');
    expect(result.simulationUrl).toBe('http://localhost:5000');
    expect(result.chatUrl).toBe('http://localhost:6000');
    expect(result.historyUrl).toBe('http://localhost:3060');
    expect(result.allowedOrigin).toBe('http://localhost:5173');
  });

  it('should use provided env var values', () => {
    process.env.PORT = '8080';
    process.env.BACKEND_URL = 'http://backend:4000';
    process.env.SIMULATION_URL = 'http://sim:5000';
    process.env.NODE_ENV = 'production';
    const result = validateEnvironment();
    expect(result.port).toBe(8080);
    expect(result.backendUrl).toBe('http://backend:4000');
    expect(result.simulationUrl).toBe('http://sim:5000');
    expect(result.nodeEnv).toBe('production');
  });

  it('should fail for invalid PORT', () => {
    process.env.PORT = '99999';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail for invalid BACKEND_URL', () => {
    process.env.BACKEND_URL = 'not-a-url';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail for invalid SIMULATION_URL', () => {
    process.env.SIMULATION_URL = 'not-a-url';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail for invalid CHAT_URL', () => {
    process.env.CHAT_URL = 'bad-url';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail for invalid HISTORY_URL', () => {
    process.env.HISTORY_URL = 'not-a-url';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail for invalid ALLOWED_ORIGIN', () => {
    process.env.ALLOWED_ORIGIN = 'not-a-url';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail for invalid NODE_ENV', () => {
    process.env.NODE_ENV = 'invalid';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail when Firebase is partially configured', () => {
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail when Firebase private key is malformed', () => {
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
    process.env.FIREBASE_PRIVATE_KEY = 'invalid-key';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should fail when Firebase client email is invalid', () => {
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'not-an-email';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should succeed when all Firebase vars are valid', () => {
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase@test.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';
    const result = validateEnvironment();
    expect(result.firebaseProjectId).toBe('my-project');
    expect(result.firebaseClientEmail).toBe('firebase@test.com');
  });

  it('should replace \\n with actual newlines in private key', () => {
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'firebase@test.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nMII\\n-----END PRIVATE KEY-----';
    const result = validateEnvironment();
    expect(result.firebasePrivateKey).toContain('\n');
  });

  it('should collect multiple errors and report all', () => {
    process.env.PORT = '0';
    process.env.BACKEND_URL = 'bad';
    process.env.NODE_ENV = 'wrong';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateEnvironment();
    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should log success message when validation passes', () => {
    const logSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    validateEnvironment();
    expect(logSpy).toHaveBeenCalledWith('Environment variables validated successfully');
    logSpy.mockRestore();
  });
});

describe('Config Module', () => {
  it('should export config with all expected fields', () => {
    const OLD = { ...process.env };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    process.env.NODE_ENV = 'test';
    process.env.BACKEND_URL = 'http://localhost:4000';
    process.env.SIMULATION_URL = 'http://localhost:5000';
    process.env.CHAT_URL = 'http://localhost:6000';
    process.env.HISTORY_URL = 'http://localhost:3060';
    process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
    process.env.PORT = '3000';

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    jest.isolateModules(() => {
      const { config } = require('../src/config/config');
      expect(config).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.backendUrl).toBeDefined();
      expect(config.simulationUrl).toBeDefined();
      expect(config.chatUrl).toBeDefined();
      expect(config.historyUrl).toBeDefined();
      expect(config.allowedOrigin).toBeDefined();
      expect(config.nodeEnv).toBeDefined();
    });
    exitSpy.mockRestore();
    process.env = OLD;
  });
});
