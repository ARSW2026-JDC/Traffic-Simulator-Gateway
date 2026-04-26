/**
 * Proxy Middleware Configuration
 * 
 * Configures HTTP reverse proxies with:
 * - Request timeouts (prevents hanging connections)
 * - WebSocket support with timeout
 * - Proper error handling with context logging
 * - Connection pooling optimization (keep-alive)
 * - Latency optimization
 */

import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { config } from '../config/config';

/**
 * HTTP Agent with connection keep-alive
 * Reuses connections to reduce latency
 */
const createHttpAgent = () =>
  new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: 256,
    maxFreeSockets: 64,
    timeout: 60_000,
  });

/**
 * Handles proxy errors uniformly
 */
const createErrorHandler = (proxyName: string) => {
  return (err: Error, req: IncomingMessage, res: ServerResponse) => {
    const statusCode = (err as any).code === 'ECONNREFUSED' ? 503 : 502;
    console.error(`[${proxyName}] Error:`, {
      message: err.message,
      code: (err as any).code,
      method: req.method,
      url: req.url,
    });

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Service unavailable',
        message: `The ${proxyName} service is not responding.`,
      }),
    );
  };
};

/**
 * Base proxy configuration shared across all proxies
 */
const baseProxyOptions: Partial<Options> = {
  changeOrigin: true,
  xfwd: false,
  agent: createHttpAgent(),
};

/**
 * Creates HTTP proxy to Backend API (/api route)
 */
export function createApiProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.backendUrl,
    timeout: 60_000,
    proxyTimeout: 60_000,
    onError: createErrorHandler('API'),
  });
}

/**
 * Creates WebSocket proxy to Backend NRT (/nrt route)
 */
export function createNrtProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.backendUrl,
    ws: true,
    timeout: 600_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/nrt': '' },
    onError: createErrorHandler('Chat'),
  });
}

/**
 * Creates WebSocket proxy to Simulation Server (/sim route)
 */
export function createSimProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.simulationUrl,
    ws: true,
    timeout: 600_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/sim': '' },
    onError: createErrorHandler('Simulation'),
  });
}