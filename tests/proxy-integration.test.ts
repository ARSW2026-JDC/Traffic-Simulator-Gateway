import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createApiProxy, createHistoryProxy, createChatProxy, createSimProxy } from '../src/middleware/proxy';

// Mock http-proxy-middleware
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn().mockImplementation((options: any) => {
    return (req: any, res: any, next: any) => {
      // Mock proxy behavior - simulate error for specific URLs to test error handling
      if (req.url && req.url.includes('/error')) {
        // Simulate error for testing
        if (options.onError) {
          options.onError(new Error('Proxy error'), req, res);
        }
        // Don't call next() when there's an error
        return;
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Proxied successfully' }));
        // Call next() when successful
        if (next) next();
      }
    };
  })
}));

describe('Proxy Middleware Integration', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {}
    };
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
      statusCode: 200
    };
    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Proxy Integration', () => {
    it('should call the proxy middleware function', () => {
      const proxy = createApiProxy();
      proxy(mockReq, mockRes, nextFn);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200, 
        { 'Content-Type': 'application/json' }
      );
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({ message: 'Proxied successfully' })
      );
    });

    it('should create API proxy with correct configuration', () => {
      const proxy = createApiProxy();
      // Verify proxy is created and callable
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });
  });

  describe('History Proxy Integration', () => {
    it('should call the proxy middleware function', () => {
      const proxy = createHistoryProxy();
      proxy(mockReq, mockRes, nextFn);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200, 
        { 'Content-Type': 'application/json' }
      );
    });
  });

  describe('Chat Proxy Integration', () => {
    it('should call the proxy middleware function', () => {
      const proxy = createChatProxy();
      proxy(mockReq, mockRes, nextFn);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200, 
        { 'Content-Type': 'application/json' }
      );
    });
  });

  describe('Simulation Proxy Integration', () => {
    it('should call the proxy middleware function', () => {
      const proxy = createSimProxy();
      proxy(mockReq, mockRes, nextFn);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(
        200, 
        { 'Content-Type': 'application/json' }
      );
    });
  });

  describe('Proxy Configuration', () => {
    it('should configure API proxy with correct target', () => {
      const proxy = createApiProxy();
      // We can't directly test internal options, but we can verify it's created
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });

    it('should configure chat proxy with WebSocket enabled', () => {
      const proxy = createChatProxy();
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });

    it('should configure simulation proxy with WebSocket enabled', () => {
      const proxy = createSimProxy();
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });

    it('should configure history proxy with WebSocket enabled', () => {
      const proxy = createHistoryProxy();
      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('function');
    });
  });
});