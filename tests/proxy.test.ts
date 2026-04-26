import { createApiProxy, createNrtProxy, createSimProxy } from '../src/middleware/proxy';

describe('Proxy Middleware', () => {
  describe('createApiProxy', () => {
    it('should return a proxy middleware function', () => {
      const proxy = createApiProxy();
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });
  });

  describe('createNrtProxy', () => {
    it('should return a proxy middleware function', () => {
      const proxy = createNrtProxy();
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });
  });

  describe('createSimProxy', () => {
    it('should return a proxy middleware function', () => {
      const proxy = createSimProxy();
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });
  });
});

describe('Proxy Module Exports', () => {
  it('should export createApiProxy', async () => {
    const { createApiProxy } = await import('../src/middleware/proxy');
    expect(createApiProxy).toBeDefined();
    expect(typeof createApiProxy).toBe('function');
  });

  it('should export createNrtProxy', async () => {
    const { createNrtProxy } = await import('../src/middleware/proxy');
    expect(createNrtProxy).toBeDefined();
    expect(typeof createNrtProxy).toBe('function');
  });

  it('should export createSimProxy', async () => {
    const { createSimProxy } = await import('../src/middleware/proxy');
    expect(createSimProxy).toBeDefined();
    expect(typeof createSimProxy).toBe('function');
  });
});