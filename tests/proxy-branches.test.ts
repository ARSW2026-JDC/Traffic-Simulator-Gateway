import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createErrorHandler,
  createDebugLogger,
} from '../src/middleware/proxy';

describe('Error Handler — edge cases', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/api/test',
      headers: { host: 'localhost:3000' },
      socket: { destroyed: false, destroy: jest.fn() },
    };
    mockRes = {
      writeHead: jest.fn(),
      end: jest.fn(),
      writableEnded: false,
    };
  });

  it('should not write response when writableEnded is true', () => {
    mockRes.writableEnded = true;
    const onError = createErrorHandler('API', 'http://localhost:4000');
    onError({ code: 'ECONNREFUSED', message: 'refused' } as any, mockReq as any, mockRes);
    expect(mockRes.writeHead).not.toHaveBeenCalled();
    expect(mockRes.end).not.toHaveBeenCalled();
  });

  it('should handle WebSocket error via raw socket write', () => {
    const wsRes: any = {
      write: jest.fn(),
      end: jest.fn(),
    };
    const onError = createErrorHandler('API', 'http://localhost:4000');
    onError({ code: 'ECONNREFUSED', message: 'refused' } as any, mockReq as any, wsRes);
    expect(wsRes.write).toHaveBeenCalledWith(expect.stringContaining('HTTP/1.1 503'));
    expect(wsRes.end).toHaveBeenCalled();
  });

  it('should destroy request socket when res has no writeHead or write', () => {
    const noopRes = {};
    const onError = createErrorHandler('API', 'http://localhost:4000');
    onError({ code: 'ECONNREFUSED', message: 'refused' } as any, mockReq as any, noopRes);
    expect(mockReq.socket.destroy).toHaveBeenCalled();
  });

  it('should catch and silently ignore errors during writeHead', () => {
    mockRes.writeHead.mockImplementation(() => { throw new Error('writeHead failed'); });
    const onError = createErrorHandler('API', 'http://localhost:4000');
    expect(() => {
      onError({ code: 'ECONNREFUSED', message: 'refused' } as any, mockReq as any, mockRes);
    }).not.toThrow();
  });

  it('should catch and silently ignore errors during ws write', () => {
    const wsRes: any = {
      write: jest.fn(() => { throw new Error('write failed'); }),
    };
    const onError = createErrorHandler('API', 'http://localhost:4000');
    expect(() => {
      onError({ code: 'ECONNREFUSED', message: 'refused' } as any, mockReq as any, wsRes);
    }).not.toThrow();
  });

  it('should use proxy name in error payload message', () => {
    const onError = createErrorHandler('Chat', 'http://localhost:6000');
    onError({ code: 'ECONNREFUSED', message: 'refused' } as any, mockReq as any, mockRes);
    const payload = JSON.parse(mockRes.end.mock.calls[0][0]);
    expect(payload.message).toBe('The Chat service is not responding.');
  });
});

describe('Debug Logger', () => {
  let logSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should log HTTP requests in onProxyReq', () => {
    const logger = createDebugLogger('API', 'http://localhost:4000');
    logger.onProxyReq(
      { getHeader: () => 'backend.com' } as any,
      { method: 'POST', url: '/api/data', headers: {} } as any,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('API'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should log WebSocket upgrades in onProxyReqWs', () => {
    const logger = createDebugLogger('Simulation', 'http://localhost:5000');
    logger.onProxyReqWs(
      { path: '/ws' } as any,
      { url: '/sim/ws', headers: { authorization: 'Bearer token' } } as any,
      null as any,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Simulation'),
      expect.objectContaining({ hasAuth: true }),
    );
  });

  it('should log responses in onProxyRes', () => {
    const logger = createDebugLogger('History', 'http://localhost:3060');
    logger.onProxyRes(
      { statusCode: 200 } as any,
      { url: '/history/data', headers: {} } as any,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('History'),
      expect.objectContaining({ statusCode: 200 }),
    );
  });

  it('should log errors in onError', () => {
    const logger = createDebugLogger('Chat', 'http://localhost:6000');
    logger.onError(
      { message: 'socket hang up' } as any,
      { url: '/chat/socket' } as any,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Chat'),
      expect.objectContaining({ message: 'socket hang up' }),
    );
  });
});
