import { createApiProxy, createNrtProxy, createSimProxy } from '../src/middleware/proxy';
import { describe, it, expect, jest } from '@jest/globals';

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

  describe('createErrorHandler', () => {
    it('should return 503 for ECONNREFUSED errors', () => {
      const { createApiProxy } = require('../src/middleware/proxy');
      const proxy = createApiProxy();
      
      const mockReq = { method: 'GET', url: '/api/test' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const mockErr = { code: 'ECONNREFUSED', message: 'Connection refused' };
      
      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, mockReq, mockRes);
        expect(mockRes.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'application/json' });
      }
    });

    it('should return 502 for other errors', () => {
      const { createApiProxy } = require('../src/middleware/proxy');
      const proxy = createApiProxy();
      
      const mockReq = { method: 'GET', url: '/api/test' };
      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const mockErr = { code: 'ETIMEDOUT', message: 'Timeout' };
      
      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, mockReq, mockRes);
        expect(mockRes.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
      }
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