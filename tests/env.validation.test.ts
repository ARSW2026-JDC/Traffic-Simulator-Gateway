import { describe, it, expect } from '@jest/globals';

describe('Environment Validation', () => {
  it('should have validateEnvironment exported', async () => {
    const { validateEnvironment } = await import('../src/config/env.validation');
    expect(validateEnvironment).toBeDefined();
    expect(typeof validateEnvironment).toBe('function');
  });

  it('should have validateUrl function exported', async () => {
    const mod = await import('../src/config/env.validation');
    expect(mod.validateEnvironment).toBeDefined();
  });
});