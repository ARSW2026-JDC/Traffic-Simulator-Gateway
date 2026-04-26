/**
 * Prometheus Metrics
 * 
 * Exposes metrics for monitoring Gateway performance:
 * - Request count and duration
 * - Error rates
 * - WebSocket connections
 * - Rate limit hits
 */

import client from 'prom-client';

// Create a Registry
export const register = new client.Registry();

// Add default metrics (CPU, Memory, etc)
client.collectDefaultMetrics({ register });

// HTTP METRICS

export const httpRequestsTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// PROXY METRICS

export const proxyErrorsTotal = new client.Counter({
  name: 'gateway_proxy_errors_total',
  help: 'Total number of proxy errors',
  labelNames: ['target', 'error_type'],
  registers: [register],
});

export const proxyRequestDuration = new client.Histogram({
  name: 'gateway_proxy_request_duration_seconds',
  help: 'Duration of proxied requests in seconds',
  labelNames: ['target'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// WEBSOCKET METRICS

export const websocketConnections = new client.Gauge({
  name: 'gateway_websocket_connections',
  help: 'Current number of WebSocket connections',
  labelNames: ['route'],
  registers: [register],
});

export const websocketMessagesTotal = new client.Counter({
  name: 'gateway_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['route', 'direction'],
  registers: [register],
});

export const websocketDisconnectionsTotal = new client.Counter({
  name: 'gateway_websocket_disconnections_total',
  help: 'Total number of WebSocket disconnections',
  labelNames: ['route', 'reason'],
  registers: [register],
});

// RATE LIMITING METRICS

export const rateLimitExceededTotal = new client.Counter({
  name: 'gateway_rate_limit_exceeded_total',
  help: 'Total number of requests blocked by rate limiting',
  labelNames: ['route'],
  registers: [register],
});

// AUTH METRICS

export const authFailuresTotal = new client.Counter({
  name: 'gateway_auth_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['reason'],
  registers: [register],
});

export const authSuccessTotal = new client.Counter({
  name: 'gateway_auth_success_total',
  help: 'Total number of successful authentications',
  registers: [register],
});

// HEALTH METRICS

export const backendHealthStatus = new client.Gauge({
  name: 'gateway_backend_health_status',
  help: 'Backend service health status (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
  registers: [register],
});

export const simulationServerHealthStatus = new client.Gauge({
  name: 'gateway_simulation_server_health_status',
  help: 'Simulation server health status (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
  registers: [register],
});

// MIDDLEWARE FOR METRICS COLLECTION

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to track request metrics
 * Should be applied before proxy middleware
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const route = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const status = res.statusCode.toString();
    const method = req.method;

    // Track request count and duration
    httpRequestsTotal.inc({ method, path: route, status });
    httpRequestDuration.observe({ method, path: route, status }, duration);
  });

  next();
}