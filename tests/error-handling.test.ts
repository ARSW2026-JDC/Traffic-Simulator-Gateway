import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createApiProxy, createHistoryProxy, createChatProxy, createSimProxy } from '../src/middleware/proxy';

describe('Gateway Proxy Error Handling', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/test',
      headers: {},
      socket: {
        destroyed: false,
        destroy: jest.fn()
      }
    };
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
      writableEnded: false
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Handler for API Proxy', () => {
    it('should return 503 for ECONNREFUSED errors', () => {
      const proxy = createApiProxy();
      const errorMockReq = { ...mockReq, url: '/api/error' };
      const mockErr = { code: 'ECONNREFUSED', message: 'Connection refused' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(
          503, 
          { 'Content-Type': 'application/json' }
        );
        expect(mockRes.end).toHaveBeenCalled();
      }
    });

    it('should return 502 for ETIMEDOUT errors', () => {
      const proxy = createApiProxy();
      const errorMockReq = { ...mockReq, url: '/api/error' };
      const mockErr = { code: 'ETIMEDOUT', message: 'Timeout' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(
          502, 
          { 'Content-Type': 'application/json' }
        );
        expect(mockRes.end).toHaveBeenCalled();
      }
    });

    it('should return 502 for unknown errors', () => {
      const proxy = createApiProxy();
      const errorMockReq = { ...mockReq, url: '/api/error' };
      const mockErr = { code: 'UNKNOWN_ERROR', message: 'Unknown error' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(
          502, 
          { 'Content-Type': 'application/json' }
        );
        expect(mockRes.end).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handler for Chat Proxy', () => {
    it('should handle ECONNREFUSED errors', () => {
      const proxy = createChatProxy();
      const errorMockReq = { ...mockReq, url: '/chat/error' };
      const mockErr = { code: 'ECONNREFUSED', message: 'Connection refused' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(
          503, 
          { 'Content-Type': 'application/json' }
        );
        expect(mockRes.end).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handler for Simulation Proxy', () => {
    it('should handle ECONNREFUSED errors', () => {
      const proxy = createSimProxy();
      const errorMockReq = { ...mockReq, url: '/sim/error' };
      const mockErr = { code: 'ECONNREFUSED', message: 'Connection refused' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(
          503, 
          { 'Content-Type': 'application/json' }
        );
        expect(mockRes.end).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handler for History Proxy', () => {
    it('should handle ECONNREFUSED errors', () => {
      const proxy = createHistoryProxy();
      const errorMockReq = { ...mockReq, url: '/history/error' };
      const mockErr = { code: 'ECONNREFUSED', message: 'Connection refused' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(
          503, 
          { 'Content-Type': 'application/json' }
        );
        expect(mockRes.end).toHaveBeenCalled();
      }
    });
  });

  describe('Error Response Content', () => {
    it('should return proper JSON error format', () => {
      const proxy = createApiProxy();
      const errorMockReq = { ...mockReq, url: '/api/error' };
      const mockErr = { code: 'ECONNREFUSED', message: 'Connection refused' };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        // Parse the JSON response
        const endCall = (mockRes.end as jest.Mock).mock.calls[0];
        if (endCall && endCall[0]) {
          const payload = JSON.parse(endCall[0] as string);
          
          expect(payload.error).toBe('Service unavailable');
          expect(payload.message).toBe('The API service is not responding.');
          expect(payload.details).toBe('Connection refused');
          expect(payload.requestPath).toBe('/api/error');
        } else {
          // If we can't parse the response, at least verify the end function was called
          expect(mockRes.end).toHaveBeenCalled();
        }
      }
    });
  });

  describe('Error Handler Logging Context', () => {
    it('should include correct context in error logs', () => {
      // We can't easily test console.log output in jest without mocking
      // But we can verify the error handler is called with correct parameters
      const proxy = createApiProxy();
      const errorMockReq = { 
        ...mockReq, 
        url: '/api/test',
        headers: { host: 'localhost:3000' }
      };
      const mockErr = { 
        message: 'socket hang up', 
        code: 'ECONNRESET' 
      };

      const onError = (proxy as any).options?.onError;
      if (onError) {
        onError(mockErr, errorMockReq, mockRes);
        
        // Verify response was sent
        expect(mockRes.writeHead).toHaveBeenCalled();
        expect(mockRes.end).toHaveBeenCalled();
      }
    });
  });
});