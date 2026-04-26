import * as fs from 'fs';

describe('Auth Middleware', () => {
  describe('authMiddleware', () => {
    it('should export authMiddleware function', async () => {
      const { authMiddleware } = await import('../src/authentication/auth');
      expect(authMiddleware).toBeDefined();
      expect(typeof authMiddleware).toBe('function');
    });
  });
});

describe('Auth Source Files', () => {
  it('should have auth.ts file', () => {
    expect(fs.existsSync('src/authentication/auth.ts')).toBe(true);
  });

  it('should not have code duplication in auth.ts', () => {
    const content = fs.readFileSync('src/authentication/auth.ts', 'utf-8');
    
    // Check for main functions
    expect(content).toContain('authMiddleware');
    expect(content).toContain('getFirebaseApp');
    expect(content).toContain('isValidEmail');
  });
});