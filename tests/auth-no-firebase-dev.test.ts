/**
 * Tests authMiddleware when Firebase is NOT configured (development mode).
 * Separate file because jest.mock is file-scoped and we need different config mock.
 */
import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(),
  credential: { cert: jest.fn() },
}));

jest.mock('../src/config/config', () => ({
  config: {
    firebaseProjectId: '',
    firebaseClientEmail: '',
    firebasePrivateKey: '',
    nodeEnv: 'development',
    backendUrl: 'http://localhost:4000',
    simulationUrl: 'http://localhost:5000',
    allowedOrigin: 'http://localhost:5173',
    port: 3000,
  },
}));

import { authMiddleware } from '../src/authentication/auth';

describe('authMiddleware — Firebase NOT configured (development mode)', () => {
  it('should call next() without checking auth when Firebase is not configured', async () => {
    const req = { headers: {}, path: '/api/test' } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
