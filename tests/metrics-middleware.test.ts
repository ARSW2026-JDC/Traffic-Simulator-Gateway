import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../src/metrics/index', () => {
  const original: Record<string, unknown> = jest.requireActual('../src/metrics/index');
  const mocked = Object.assign({}, original, {
    httpRequestsTotal: { inc: jest.fn() },
    httpRequestDurationSeconds: { observe: jest.fn() },
  });
  return mocked;
});

import { metricsMiddleware } from '../src/middleware/metrics';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../src/metrics/index';

describe('metricsMiddleware', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      route: null,
    };
    mockRes = {
      statusCode: 200,
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') cb();
        return mockRes;
      }),
    };
    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() immediately', () => {
    metricsMiddleware(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it('should increment httpRequestsTotal on finish', () => {
    metricsMiddleware(mockReq, mockRes, nextFn);
    expect(httpRequestsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/test',
      status_code: '200',
    });
  });

  it('should observe httpRequestDurationSeconds on finish', () => {
    metricsMiddleware(mockReq, mockRes, nextFn);
    expect(httpRequestDurationSeconds.observe).toHaveBeenCalledWith(
      { method: 'GET', route: '/api/test', status_code: '200' },
      expect.any(Number),
    );
  });

  it('should use route path when available', () => {
    mockReq.route = { path: '/api/:id' };
    metricsMiddleware(mockReq, mockRes, nextFn);
    expect(httpRequestsTotal.inc).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/:id' }),
    );
  });

  it('should fallback to unknown when path is missing', () => {
    mockReq = { ...mockReq, path: undefined };
    metricsMiddleware(mockReq, mockRes, nextFn);
    expect(httpRequestsTotal.inc).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'unknown' }),
    );
  });
});
