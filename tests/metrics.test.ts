import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('snappy', () => ({
  compress: jest.fn(async (buf: Buffer) => buf),
}));

const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as any;

import {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  proxyErrorsTotal,
  activeProxyConnections,
  backendHealthStatus,
  rateLimitExceededTotal,
  startMetricsPush,
  stopMetricsPush,
  convertToTimeseries,
  push,
} from '../src/metrics/index';

beforeEach(() => {
  mockFetch.mockReset();
  registry.resetMetrics();
  jest.useFakeTimers();
});

afterEach(() => {
  stopMetricsPush();
  jest.useRealTimers();
  delete process.env.GRAFANA_CLOUD_URL;
  delete process.env.GRAFANA_CLOUD_USER;
  delete process.env.GRAFANA_CLOUD_API_KEY;
});

describe('Metric Definitions', () => {
  it('should register httpRequestsTotal counter', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    const metrics = await registry.getMetricsAsJSON();
    const found = metrics.find((m: any) => m.name === 'gateway_http_requests_total');
    expect(found).toBeDefined();
    expect(found.values[0].value).toBe(1);
  });

  it('should register httpRequestDurationSeconds histogram', async () => {
    httpRequestDurationSeconds.observe({ method: 'POST', route: '/api', status_code: '201' }, 0.1);
    const metrics = await registry.getMetricsAsJSON();
    const found = metrics.find((m: any) => m.name === 'gateway_http_request_duration_seconds');
    expect(found).toBeDefined();
  });

  it('should register proxyErrorsTotal counter', async () => {
    proxyErrorsTotal.inc({ target: 'API', error_code: 'ECONNREFUSED' });
    const metrics = await registry.getMetricsAsJSON();
    const found = metrics.find((m: any) => m.name === 'gateway_proxy_errors_total');
    expect(found).toBeDefined();
    expect(found.values[0].value).toBe(1);
  });

  it('should register activeProxyConnections gauge', async () => {
    activeProxyConnections.set({ target: 'API' }, 5);
    const metrics = await registry.getMetricsAsJSON();
    const found = metrics.find((m: any) => m.name === 'gateway_active_proxy_connections');
    expect(found).toBeDefined();
    expect(found.values[0].value).toBe(5);
  });

  it('should register backendHealthStatus gauge', async () => {
    backendHealthStatus.set({ service: 'backend' }, 1);
    const metrics = await registry.getMetricsAsJSON();
    const found = metrics.find((m: any) => m.name === 'gateway_backend_health_status');
    expect(found).toBeDefined();
    expect(found.values[0].value).toBe(1);
  });

  it('should register rateLimitExceededTotal counter', async () => {
    rateLimitExceededTotal.inc({ route: 'api' });
    const metrics = await registry.getMetricsAsJSON();
    const found = metrics.find((m: any) => m.name === 'gateway_rate_limit_exceeded_total');
    expect(found).toBeDefined();
    expect(found.values[0].value).toBe(1);
  });

  it('should include default metrics in registry', async () => {
    const metrics = await registry.getMetricsAsJSON();
    const cpuMetric = metrics.find((m: any) => m.name === 'process_cpu_user_seconds_total');
    expect(cpuMetric).toBeDefined();
  });
});

describe('convertToTimeseries', () => {
  it('should convert a simple metric to timeseries format', () => {
    const jsonMetrics = [
      {
        name: 'test_metric',
        values: [{ value: 42, labels: { env: 'prod' } }],
      },
    ];
    const result = convertToTimeseries(jsonMetrics);
    expect(result).toHaveLength(1);
    expect(result[0].samples[0].value).toBe(42);
    const nameLabel = result[0].labels.find((l: any) => l.name.toString() === '__name__');
    expect(nameLabel.value.toString()).toBe('test_metric');
  });

  it('should use metricName when available', () => {
    const jsonMetrics = [
      {
        name: 'base_name',
        values: [{ metricName: 'override_name', value: 1, labels: {} }],
      },
    ];
    const result = convertToTimeseries(jsonMetrics);
    const nameLabel = result[0].labels.find((l: any) => l.name.toString() === '__name__');
    expect(nameLabel.value.toString()).toBe('override_name');
  });

  it('should skip values without metricName or name', () => {
    const jsonMetrics = [
      {
        values: [{ value: 1, labels: {} }],
      },
    ];
    const result = convertToTimeseries(jsonMetrics);
    expect(result).toHaveLength(0);
  });

  it('should convert label values to strings', () => {
    const jsonMetrics = [
      {
        name: 'm',
        values: [{ value: 1, labels: { count: 5 as any } }],
      },
    ];
    const result = convertToTimeseries(jsonMetrics);
    const label = result[0].labels.find((l: any) => l.name.toString() === 'count');
    expect(label.value.toString()).toBe('5');
  });

  it('should include all labels from the metric', () => {
    const jsonMetrics = [
      {
        name: 'm',
        values: [{ value: 1, labels: { a: '1', b: '2' } }],
      },
    ];
    const result = convertToTimeseries(jsonMetrics);
    expect(result[0].labels).toHaveLength(3); // __name__ + a + b
  });

  it('should set timestamp on each sample', () => {
    const jsonMetrics = [
      {
        name: 'm',
        values: [{ value: 1, labels: {} }],
      },
    ];
    const before = Date.now();
    const result = convertToTimeseries(jsonMetrics);
    expect(result[0].samples[0].timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('startMetricsPush / stopMetricsPush', () => {
  it('should log warning and return when Grafana env vars are missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    startMetricsPush();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Grafana Cloud push disabled'),
    );
    warnSpy.mockRestore();
  });

  it('should start interval when Grafana env vars are set', () => {
    process.env.GRAFANA_CLOUD_URL = 'https://grafana.example.com';
    process.env.GRAFANA_CLOUD_USER = 'user';
    process.env.GRAFANA_CLOUD_API_KEY = 'key';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    startMetricsPush();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Grafana Cloud push enabled'));
    logSpy.mockRestore();
  });

  it('should stop the push interval', () => {
    process.env.GRAFANA_CLOUD_URL = 'https://grafana.example.com';
    process.env.GRAFANA_CLOUD_USER = 'user';
    process.env.GRAFANA_CLOUD_API_KEY = 'key';
    startMetricsPush();
    stopMetricsPush();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('push', () => {
  beforeEach(() => {
    process.env.GRAFANA_CLOUD_URL = 'https://grafana.example.com';
    process.env.GRAFANA_CLOUD_USER = 'user';
    process.env.GRAFANA_CLOUD_API_KEY = 'key';
  });

  it('should not call fetch when env vars are missing', async () => {
    delete process.env.GRAFANA_CLOUD_URL;
    await push();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should call fetch when only default metrics exist', async () => {
    mockFetch.mockResolvedValue({ ok: true } as any);
    registry.resetMetrics();
    await push();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should call fetch with correct headers when metrics exist', async () => {
    mockFetch.mockResolvedValue({ ok: true } as any);
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    await push();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://grafana.example.com');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Content-Type']).toBe('application/x-protobuf');
    expect(call[1].headers['Content-Encoding']).toBe('snappy');
    expect(call[1].headers['Authorization']).toBeDefined();
    expect(call[1].headers['X-Prometheus-Remote-Write-Version']).toBe('0.1.0');
  });

  it('should log warning on HTTP error response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Internal Server Error' } as any);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    await push();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('push failed'));
    warnSpy.mockRestore();
  });

  it('should log warning on fetch exception', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    await push();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('push error'));
    warnSpy.mockRestore();
  });
});
