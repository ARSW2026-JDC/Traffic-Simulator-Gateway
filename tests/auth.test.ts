import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockVerifyIdToken = jest.fn<any>();
jest.mock('firebase-admin', () => ({
  credential: {
    cert: jest.fn(() => ({})),
  },
  initializeApp: jest.fn(() => ({})),
  auth: jest.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

let isGuestPath: (path: string) => boolean;

beforeAll(() => {
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
  process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';
  jest.resetModules();
  isGuestPath = require('../src/authentication/auth').isGuestPath;
});

describe('isGuestPath', () => {
  it('should return true for exact guest path', () => {
    expect(isGuestPath('/auth/verify')).toBe(true);
  });

  it('should return true for guest path with prefix', () => {
    expect(isGuestPath('/api/auth/verify')).toBe(true);
  });

  it('should return false for non-guest paths', () => {
    expect(isGuestPath('/api/data')).toBe(false);
  });

  it('should return false for paths that do not contain guest marker', () => {
    expect(isGuestPath('/api/users')).toBe(false);
    expect(isGuestPath('/auth/login')).toBe(false);
  });
});

describe('getFirebaseApp', () => {
  beforeEach(() => {
    jest.resetModules();
    mockVerifyIdToken.mockReset();
  });

  it('should initialize Firebase when credentials are set', () => {
    const oldEnv = { ...process.env };
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';

    jest.isolateModules(() => {
      const admin = require('firebase-admin');
      const { getFirebaseApp } = require('../src/authentication/auth');
      const app = getFirebaseApp();
      expect(app).toBeDefined();
      expect(admin.initializeApp).toHaveBeenCalled();
    });

    process.env = oldEnv;
  });

  it('should exit on Firebase init failure', () => {
    const oldEnv = { ...process.env };
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';

    jest.isolateModules(() => {
      const admin = require('firebase-admin');
      admin.initializeApp.mockImplementationOnce(() => { throw new Error('Init failed'); });
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
      const { getFirebaseApp } = require('../src/authentication/auth');
      getFirebaseApp();
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    process.env = oldEnv;
  });
});

describe('authMiddleware', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      path: '/api/data',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFn = jest.fn();
    mockVerifyIdToken.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass through in development mode when Firebase not configured', async () => {
    const oldEnv = { ...process.env };
    process.env.NODE_ENV = 'development';
    process.env.FIREBASE_PROJECT_ID = '';
    process.env.FIREBASE_CLIENT_EMAIL = '';
    process.env.FIREBASE_PRIVATE_KEY = '';

    jest.isolateModules(async () => {
      const { authMiddleware } = require('../src/authentication/auth');
      await authMiddleware(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });

    process.env = oldEnv;
  });

  it('should return 500 in production when Firebase not configured', async () => {
    const oldEnv = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.FIREBASE_PROJECT_ID = '';
    process.env.FIREBASE_CLIENT_EMAIL = '';
    process.env.FIREBASE_PRIVATE_KEY = '';

    jest.isolateModules(async () => {
      const { authMiddleware } = require('../src/authentication/auth');
      await authMiddleware(mockReq, mockRes, nextFn);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication service unavailable' });
    });

    process.env = oldEnv;
  });

  it('should return 401 when no authorization header', async () => {
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 when authorization header is not Bearer', async () => {
    mockReq.headers.authorization = 'Basic token123';
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Authorization') }),
    );
  });

  it('should return 401 for expired token', async () => {
    mockReq.headers.authorization = 'Bearer validtoken';
    mockVerifyIdToken.mockRejectedValue(new Error('auth/id-token-expired'));
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('should return 401 for invalid token', async () => {
    mockReq.headers.authorization = 'Bearer invalidtoken';
    mockVerifyIdToken.mockRejectedValue(new Error('auth/invalid-id-token'));
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });

  it('should return 401 for token with invalid email (non-guest path)', async () => {
    mockReq.headers.authorization = 'Bearer validtoken';
    mockVerifyIdToken.mockResolvedValue({ uid: 'user1', email: null });
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token: missing email claim' });
  });

  it('should allow guest path even with null email', async () => {
    mockReq.path = '/auth/verify';
    mockReq.headers.authorization = 'Bearer validtoken';
    mockVerifyIdToken.mockResolvedValue({ uid: 'guest1', email: null });
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockReq.headers['x-user-id']).toBe('guest1');
    expect(mockReq.headers['x-user-email']).toBe('');
    expect(nextFn).toHaveBeenCalled();
  });

  it('should set headers and call next for valid token', async () => {
    mockReq.headers.authorization = 'Bearer validtoken';
    mockVerifyIdToken.mockResolvedValue({ uid: 'user1', email: 'user@test.com' });
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockReq.headers['x-user-id']).toBe('user1');
    expect(mockReq.headers['x-user-email']).toBe('user@test.com');
    expect(nextFn).toHaveBeenCalled();
  });

  it('should handle generic token verification errors', async () => {
    mockReq.headers.authorization = 'Bearer sometoken';
    mockVerifyIdToken.mockRejectedValue(new Error('Unknown error'));
    const { authMiddleware } = require('../src/authentication/auth');
    await authMiddleware(mockReq, mockRes, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token verification failed' });
  });
});
