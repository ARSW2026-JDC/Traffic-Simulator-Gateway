import * as fs from 'node:fs';
import { describe, it, expect } from '@jest/globals';

describe('Integration Tests', () => {
  describe('Gateway Imports', () => {
    it('should import all required modules without errors', async () => {
      let success = true;
      try {
        await import('../src/config/config');
        await import('../src/authentication/auth');
        await import('../src/middleware/proxy');
        await import('../src/monitoring/metrics');
        await import('../src/monitoring/logging');
      } catch {
        success = false;
      }
      expect(success).toBe(true);
    });
  });

  describe('Module Structure', () => {
    it('should have monitoring modules', () => {
      expect(fs.existsSync('src/monitoring/metrics.ts')).toBe(true);
      expect(fs.existsSync('src/monitoring/logging.ts')).toBe(true);
    });

    it('should have proxy middleware', () => {
      expect(fs.existsSync('src/middleware/proxy.ts')).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should have valid .env.example', () => {
      const content = fs.readFileSync('.env.example', 'utf-8');
      expect(content).toContain('FIREBASE_PROJECT_ID');
      expect(content).toContain('BACKEND_URL');
      expect(content).toContain('SIMULATION_URL');
      expect(content).toContain('PORT');
    });

    it('should use placeholder values in .env.example', () => {
      const content = fs.readFileSync('.env.example', 'utf-8');
      expect(content).not.toContain('MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBA');
      expect(content).not.toContain('AIzaSy');
    });
  });

  describe('Security', () => {
    it('should not have xfwd enabled in proxy', () => {
      const content = fs.readFileSync('src/middleware/proxy.ts', 'utf-8');
      expect(content).toContain('xfwd: false');
    });
  });

  describe('Build', () => {
    it('should have tsconfig.json', () => {
      expect(fs.existsSync('tsconfig.json')).toBe(true);
    });

    it('should have package.json', () => {
      expect(fs.existsSync('package.json')).toBe(true);
    });

    it('should have build script', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      expect(pkg.scripts.build).toBeDefined();
    });

    it('should have test script', () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      expect(pkg.scripts.test).toBeDefined();
    });
  });
});