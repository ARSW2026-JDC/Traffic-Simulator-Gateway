import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

// ─── Mocks (hoisted by Jest before imports) ───────────────────────────────────

// Declared as any to avoid ts-jest inferring 'never' from the jest.mock factory context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockVerifyIdToken: any;

jest.mock('firebase-admin', () => {
  // Define the mock here to avoid hoisting issues with external variable references
  const verifyMock = jest.fn();
  // Store it so tests can control its behavior via the module-level variable
  mockVerifyIdToken = verifyMock;
  return {
    initializeApp: jest.fn().mockReturnValue({ name: 'mock-gateway-app' }),
    auth: jest.fn().mockReturnValue({ verifyIdToken: verifyMock }),
    credential: { cert: jest.fn().mockReturnValue({}) },
  };
});

jest.mock('../src/config/config', () => ({
  config: {
    firebaseProjectId: 'test-project',
    firebaseClientEmail: 'test@test-project.iam.gserviceaccount.com',
    firebasePrivateKey:
      '-----BEGIN PRIVATE KEY-----\nfakekey\n-----END PRIVATE KEY-----\n',
    nodeEnv: 'production',
    backendUrl: 'http://localhost:4000',
    simulationUrl: 'http://localhost:5000',
    allowedOrigin: 'http://localhost:5173',
    port: 3000,
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { authMiddleware } from '../src/authentication/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createMocks = (
  headers: Record<string, string> = {},
  path = '/api/test',
) => {
  const req = { headers, path } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('authMiddleware — Firebase configured (production)', () => {
  beforeEach(() => {
    mockVerifyIdToken.mockReset();
  });

  // ── Missing / malformed header ───────────────────────────────────────────

  it('should return 401 when Authorization header is absent', async () => {
    const { req, res, next } = createMocks({});
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is not Bearer', async () => {
    const { req, res, next } = createMocks({ authorization: 'Basic abc123' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Valid token with email ────────────────────────────────────────────────

  it('should call next() and set headers when token and email are valid', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-123',
      email: 'test@example.com',
    });
    const { req, res, next } = createMocks({ authorization: 'Bearer good-token' });
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-user-id']).toBe('user-123');
    expect(req.headers['x-user-email']).toBe('test@example.com');
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Missing email on non-guest path ──────────────────────────────────────

  it('should return 401 when token has no email on a protected path', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'anon-uid', email: null });
    const { req, res, next } = createMocks(
      { authorization: 'Bearer anon-token' },
      '/api/users',
    );
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token: missing email claim',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // ── Guest path (anonymous users) ─────────────────────────────────────────

  it('should allow anonymous token on /auth/verify (guest path)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'anon-uid', email: null });
    const { req, res, next } = createMocks(
      { authorization: 'Bearer anon-token' },
      '/auth/verify',
    );
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-user-id']).toBe('anon-uid');
    expect(req.headers['x-user-email']).toBe('');
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── Token verification errors ─────────────────────────────────────────────

  it('should return 401 with "Token expired" for expired token error', async () => {
    mockVerifyIdToken.mockRejectedValue(
      new Error('auth/id-token-expired: token is expired'),
    );
    const { req, res, next } = createMocks({ authorization: 'Bearer old-token' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('should return 401 with "Token expired" when message contains "expired"', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('token expired'));
    const { req, res, next } = createMocks({ authorization: 'Bearer token' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('should return 401 with "Invalid token" for invalid id-token error', async () => {
    mockVerifyIdToken.mockRejectedValue(
      new Error('auth/invalid-id-token: malformed'),
    );
    const { req, res, next } = createMocks({ authorization: 'Bearer bad-token' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });

  it('should return 401 with "Invalid token" when message contains "invalid"', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('token is invalid'));
    const { req, res, next } = createMocks({ authorization: 'Bearer token' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });

  it('should return 401 with "Token verification failed" for unknown errors', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('some network glitch'));
    const { req, res, next } = createMocks({ authorization: 'Bearer token' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token verification failed' });
  });

  it('should handle non-Error thrown values gracefully', async () => {
    mockVerifyIdToken.mockRejectedValue('plain string error');
    const { req, res, next } = createMocks({ authorization: 'Bearer token' });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
