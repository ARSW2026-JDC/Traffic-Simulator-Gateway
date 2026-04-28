import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

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

import { checkBackendHealth, checkSimulationHealth } from '../src/health';

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  global.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── checkBackendHealth ───────────────────────────────────────────────────────

describe('checkBackendHealth', () => {
  it('should return "ok" when backend responds with ok: true', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    const result = await checkBackendHealth();
    expect(result).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should return "error" when backend responds with ok: false', async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    const result = await checkBackendHealth();
    expect(result).toBe('error');
  });

  it('should return "unavailable" when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkBackendHealth();
    expect(result).toBe('unavailable');
  });

  it('should return "unavailable" when fetch is aborted (timeout)', async () => {
    mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const result = await checkBackendHealth();
    expect(result).toBe('unavailable');
  });
});

// ─── checkSimulationHealth ────────────────────────────────────────────────────

describe('checkSimulationHealth', () => {
  it('should return "ok" when simulation server responds with ok: true', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    const result = await checkSimulationHealth();
    expect(result).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/sim/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should return "error" when simulation server responds with ok: false', async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    const result = await checkSimulationHealth();
    expect(result).toBe('error');
  });

  it('should return "unavailable" when simulation server is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await checkSimulationHealth();
    expect(result).toBe('unavailable');
  });

  it('should return "unavailable" on timeout', async () => {
    mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const result = await checkSimulationHealth();
    expect(result).toBe('unavailable');
  });
});
