import * as fs from 'node:fs';
import { describe, it, expect } from '@jest/globals';

describe('Environment Validation', () => {
  describe('validateEnvironment', () => {
    it('should export validateEnvironment function', async () => {
      const { validateEnvironment } = await import('../src/config/env.validation');
      expect(validateEnvironment).toBeDefined();
      expect(typeof validateEnvironment).toBe('function');
    });
  });

  describe('config module', () => {
    it('should export config object', async () => {
      const { config } = await import('../src/config/config');
      expect(config).toBeDefined();
    });
  });
});

describe('File Structure', () => {
  it('should have required source files', () => {
    const requiredFiles = [
      'src/index.ts',
      'src/config/config.ts',
      'src/config/env.validation.ts',
      'src/authentication/auth.ts',
      'src/middleware/proxy.ts',
    ];

    requiredFiles.forEach(file => {
      const exists = fs.existsSync(file);
      expect(exists).toBe(true);
    });
  });

  it('should have .env.example file', () => {
    expect(fs.existsSync('.env.example')).toBe(true);
  });

  it('should have tests directory', () => {
    expect(fs.existsSync('tests')).toBe(true);
  });
});

describe('Source Files', () => {
  it('should have monitoring files', () => {
    expect(fs.existsSync('src/monitoring/metrics.ts')).toBe(true);
    expect(fs.existsSync('src/monitoring/logging.ts')).toBe(true);
  });

  it('should have middleware files', () => {
    expect(fs.existsSync('src/middleware/proxy.ts')).toBe(true);
  });

  it('should not have orphaned websocket-heartbeat file', () => {
    expect(fs.existsSync('src/middleware/websocket-heartbeat.ts')).toBe(false);
  });
});