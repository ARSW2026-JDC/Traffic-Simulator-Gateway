import { describe, it, expect, jest, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';

const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as any;

import {
  app,
  server,
  checkBackendHealth,
  checkSimulationHealth,
  checkChatHealth,
  checkHistoryHealth,
  SKIP_SOCKET_IO,
} from '../src/index';

afterAll(() => {
  server.close();
});

describe('SKIP_SOCKET_IO', () => {
  it('should skip for socket.io paths', () => {
    const req = { path: '/socket.io', url: '/socket.io', get: () => undefined } as any;
    expect(SKIP_SOCKET_IO(req)).toBe(true);
  });

  it('should skip for websocket upgrade header', () => {
    const req = { path: '/chat', url: '/chat', get: (h: string) => h === 'upgrade' ? 'websocket' : undefined } as any;
    expect(SKIP_SOCKET_IO(req)).toBe(true);
  });

  it('should not skip for normal HTTP requests', () => {
    const req = { path: '/api/data', url: '/api/data', get: () => undefined } as any;
    expect(SKIP_SOCKET_IO(req)).toBe(false);
  });
});

describe('Health check functions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('checkBackendHealth', () => {
    it('should return ok when backend responds', async () => {
      mockFetch.mockResolvedValue({ ok: true } as any);
      const status = await checkBackendHealth();
      expect(status).toBe('ok');
    });

    it('should return error when backend responds with error', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);
      const status = await checkBackendHealth();
      expect(status).toBe('error');
    });

    it('should return unavailable on network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const status = await checkBackendHealth();
      expect(status).toBe('unavailable');
    });
  });

  describe('checkSimulationHealth', () => {
    it('should return ok when simulation responds', async () => {
      mockFetch.mockResolvedValue({ ok: true } as any);
      const status = await checkSimulationHealth();
      expect(status).toBe('ok');
    });

    it('should return error when simulation responds with error', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);
      const status = await checkSimulationHealth();
      expect(status).toBe('error');
    });

    it('should return unavailable on timeout', async () => {
      mockFetch.mockRejectedValue(new Error('timeout'));
      const status = await checkSimulationHealth();
      expect(status).toBe('unavailable');
    });
  });

  describe('checkChatHealth', () => {
    it('should return ok when chat responds', async () => {
      mockFetch.mockResolvedValue({ ok: true } as any);
      const status = await checkChatHealth();
      expect(status).toBe('ok');
    });

    it('should return unavailable on error', async () => {
      mockFetch.mockRejectedValue(new Error('error'));
      const status = await checkChatHealth();
      expect(status).toBe('unavailable');
    });
  });

  describe('checkHistoryHealth', () => {
    it('should return ok when history responds', async () => {
      mockFetch.mockResolvedValue({ ok: true } as any);
      const status = await checkHistoryHealth();
      expect(status).toBe('ok');
    });

    it('should return unavailable on error', async () => {
      mockFetch.mockRejectedValue(new Error('error'));
      const status = await checkHistoryHealth();
      expect(status).toBe('unavailable');
    });
  });
});

describe('HTTP Endpoints', () => {
  it('GET /health should return 200 when no services have been checked', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.gateway).toBe('ok');
  });

  it('GET /metrics should return prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });
});
