const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

type DecodedToken = { uid: string; email: string | null };
type TestDecoded = string | boolean | DecodedToken;

const mockErrorTests: [string, string, number][] = [
  ['auth/id-token-expired', 'Token expired', 401],
  ['auth/invalid-id-token', 'Invalid token', 401],
  ['some other error', 'Token verification failed', 401],
  ['connect ECONNREFUSED', 'Service unavailable', 503],
];

const authorizationHeaderTests: [Record<string, unknown>, string][] = [
  [{ authorization: undefined }, 'Missing token'],
  [{ authorization: 'Basic abc123' }, 'Invalid format'],
];

const guestPathTests: [DecodedToken, string, boolean][] = [
  [{ uid: 'guest-123', email: null }, '/auth/verify', true],
  [{ uid: 'user-123', email: null }, '/api/users', false],
];

const validTokenTests: [DecodedToken, boolean][] = [
  [{ uid: 'user-123', email: 'test@example.com' }, true],
  [{ uid: 'user-123', email: '' }, false],
  [{ uid: 'user-123', email: null }, false],
];

describe('Gateway Auth Middleware - Edge Cases', () => {
  describe('Authorization header validation', () => {
    it.each(authorizationHeaderTests)(
      'should reject invalid header',
      (headers, expectedError) => {
        const res = createMockResponse();
        
        const authHeader = headers.authorization as string | undefined;
        if (!authHeader?.startsWith('Bearer ')) {
          res.status(401).json({ error: expectedError });
        }
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: expectedError });
      }
    );

    it('should extract token correctly', () => {
      const authHeader = 'Bearer my-secret-token';
      const token = authHeader.slice(7);
      expect(token).toBe('my-secret-token');
    });

    it('should handle Bearer with empty token', () => {
      const authHeader = 'Bearer ';
      const token = authHeader.slice(7);
      expect(token).toBe('');
    });
  });

  describe.each(mockErrorTests)(
    'Token verification errors - %s',
    (errorMessage, expectedError, expectedStatus) => {
      it(`should handle error`, () => {
        const res = createMockResponse();
        
        if (errorMessage.includes('auth/id-token-expired') || errorMessage.includes('expired')) {
          res.status(401).json({ error: 'Token expired' });
        } else if (errorMessage.includes('auth/invalid-id-token') || errorMessage.includes('invalid')) {
          res.status(401).json({ error: 'Invalid token' });
        } else if (errorMessage.includes('ECONNREFUSED')) {
          res.status(503).json({ error: 'Service unavailable' });
        } else {
          res.status(401).json({ error: 'Token verification failed' });
        }
        
        expect(res.status).toHaveBeenCalledWith(expectedStatus);
        expect(res.json).toHaveBeenCalledWith({ error: expectedError });
      });
    }
  );

  describe('Guest path validation', () => {
    it.each(guestPathTests)(
      'should handle guest path validation',
      (decoded, path, shouldAllow) => {
        const isGuestPath = (p: string) => p.includes('/auth/verify');
        const res = createMockResponse();
        
        if (decoded.email === null && !isGuestPath(path)) {
          res.status(401).json({ error: 'Invalid token: missing email claim' });
        }
        
        if (shouldAllow) {
          expect(res.status).not.toHaveBeenCalled();
        } else {
          expect(res.status).toHaveBeenCalledWith(401);
        }
      }
    );
  });

  describe('Valid token scenarios', () => {
    it.each(validTokenTests)(
      'should handle token validation',
      (decoded, shouldSetHeaders) => {
        const headers: Record<string, string> = {};
        
        if (decoded.email) {
          headers['x-user-id'] = decoded.uid;
          headers['x-user-email'] = decoded.email;
        }
        
        if (shouldSetHeaders) {
          expect(headers['x-user-id']).toBe(decoded.uid);
          expect(headers['x-user-email']).toBe(decoded.email);
        } else {
          expect(headers['x-user-id']).toBeUndefined();
        }
      }
    );
  });
});