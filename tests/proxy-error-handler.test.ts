import { describe, it, expect, jest } from '@jest/globals';
import type { IncomingMessage, ServerResponse } from 'node:http';

jest.mock('../src/config/config', () => ({
  config: {
    backendUrl: 'http://localhost:4000',
    simulationUrl: 'http://localhost:5000',
    allowedOrigin: 'http://localhost:5173',
    port: 3000,
    nodeEnv: 'test',
    firebaseProjectId: '',
    firebaseClientEmail: '',
    firebasePrivateKey: '',
  },
}));

import { createErrorHandler } from '../src/middleware/proxy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeHttpRes = (writableEnded = false) => ({
  writeHead: jest.fn(),
  end: jest.fn(),
  destroy: jest.fn(),
  writableEnded,
});

const makeRawSocket = () => ({
  write: jest.fn(),
  end: jest.fn(),
  destroy: jest.fn(),
});

const makeReq = () =>
  ({ method: 'GET', url: '/test', socket: { destroy: jest.fn() } } as unknown as IncomingMessage);

// ─── Status code selection ────────────────────────────────────────────────────

describe('createErrorHandler — status codes', () => {
  it('should use 503 for ECONNREFUSED errors', () => {
    const handler = createErrorHandler('API');
    const res = makeHttpRes();
    handler({ code: 'ECONNREFUSED', message: 'refused' } as any, makeReq(), res);
    expect(res.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalled();
  });

  it('should use 502 for other error codes (ETIMEDOUT)', () => {
    const handler = createErrorHandler('API');
    const res = makeHttpRes();
    handler({ code: 'ETIMEDOUT', message: 'timeout' } as any, makeReq(), res);
    expect(res.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalled();
  });

  it('should use 502 when error code is undefined', () => {
    const handler = createErrorHandler('API');
    const res = makeHttpRes();
    handler({ message: 'unknown' } as any, makeReq(), res);
    expect(res.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
  });
});

// ─── HTTP ServerResponse branch ───────────────────────────────────────────────

describe('createErrorHandler — HTTP response branch', () => {
  it('should write JSON error when response is writable', () => {
    const handler = createErrorHandler('Chat');
    const res = makeHttpRes(false);
    handler({ code: 'ECONNREFUSED', message: 'refused' } as any, makeReq(), res);
    expect(res.writeHead).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
    const payload = JSON.parse((res.end as jest.Mock).mock.calls[0][0] as string);
    expect(payload.error).toBe('Service unavailable');
    expect(payload.message).toContain('Chat');
  });

  it('should skip writing when writableEnded is true', () => {
    const handler = createErrorHandler('API');
    const res = makeHttpRes(true);
    handler({ code: 'ECONNREFUSED', message: 'refused' } as any, makeReq(), res);
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('should call destroy when writeHead throws', () => {
    const handler = createErrorHandler('API');
    const res = makeHttpRes(false);
    (res.writeHead as jest.Mock).mockImplementation(() => {
      throw new Error('write failed');
    });
    expect(() =>
      handler({ code: 'ECONNREFUSED', message: 'refused' } as any, makeReq(), res),
    ).not.toThrow();
    expect(res.destroy).toHaveBeenCalled();
  });
});

// ─── Raw socket branch ────────────────────────────────────────────────────────

describe('createErrorHandler — raw socket branch', () => {
  it('should write raw HTTP response when res is a raw socket', () => {
    const handler = createErrorHandler('Simulation');
    const res = makeRawSocket();
    handler({ code: 'ECONNREFUSED', message: 'refused' } as any, makeReq(), res as any);
    expect(res.write).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it('should destroy request socket when res has no write or writeHead', () => {
    const handler = createErrorHandler('API');
    const req = makeReq();
    handler({ message: 'fail' } as any, req, null as any);
    expect((req as any).socket.destroy).toHaveBeenCalled();
  });

  it('should not throw when res is null and socket is also missing', () => {
    const handler = createErrorHandler('API');
    const req = { method: 'GET', url: '/test' } as unknown as IncomingMessage;
    expect(() => handler({ message: 'fail' } as any, req, null as any)).not.toThrow();
  });
});

// ─── Proxy name in payload ────────────────────────────────────────────────────

describe('createErrorHandler — payload content', () => {
  it('should include proxy name in the error message', () => {
    const handler = createErrorHandler('MyService');
    const res = makeHttpRes(false);
    handler({ message: 'fail' } as any, makeReq(), res);
    const payload = JSON.parse((res.end as jest.Mock).mock.calls[0][0] as string);
    expect(payload.message).toContain('MyService');
  });
});
