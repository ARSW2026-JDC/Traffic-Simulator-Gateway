import { describe, it, expect } from '@jest/globals';

describe('Auth Middleware', () => {
  it('should have authMiddleware exported', async () => {
    const { authMiddleware } = await import('../src/authentication/auth');
    expect(authMiddleware).toBeDefined();
    expect(typeof authMiddleware).toBe('function');
  });
});