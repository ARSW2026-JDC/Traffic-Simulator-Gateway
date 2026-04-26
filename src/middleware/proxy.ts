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
import { config } from '../config/config';

/**
 * HTTP Agent with connection keep-alive
 * Reuses connections to reduce latency
 */
const createHttpAgent = () =>
  new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30_000, // 30 seconds
    maxSockets: 256, // Max concurrent sockets
    maxFreeSockets: 64, // Max free sockets to keep
    timeout: 60_000, // Socket timeout
  });

/**
 * Base proxy configuration shared across all proxies
 */
const baseProxyOptions: Partial<Options> = {
  changeOrigin: true,
  xfwd: true, // Add X-Forwarded-* headers
  agent: createHttpAgent(), // Connection keep-alive
};

/**
 * Creates HTTP proxy to Backend API (/api route)
 * - No WebSocket support
 * - 60 second request timeout
 * - Auth middleware applied separately
 */
export function createApiProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.backendUrl,
    timeout: 60_000, // 60 seconds
    proxyTimeout: 60_000, // 60 seconds
    onError: (err, req, res) => {
      console.error('[api-proxy] Error:', {
        message: err.message,
        code: (err as any).code,
        method: req.method,
        url: req.url,
      });

      // Return 502 Bad Gateway for upstream errors
      res.writeHead(502, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          error: 'Backend service unavailable',
          message: 'The API server is not responding. Please try again later.',
        }),
      );
    },
  });
}

/**
 * Creates WebSocket proxy to Backend NRT (Near Real-Time) (/nrt route)
 * - WebSocket support enabled
 * - 10 minute WebSocket timeout (keeps connections alive longer)
 * - Used for chat and real-time notifications
 */
export function createNrtProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.backendUrl,
    ws: true,
    timeout: 600_000, // 10 minutes
    proxyTimeout: 600_000, // 10 minutes
    pathRewrite: { '^/nrt': '' },
    onError: (err, req, res) => {
      console.error('[nrt-proxy] Error:', {
        message: err.message,
        code: (err as any).code,
        method: req.method,
        url: req.url,
      });

      // Return 502 Bad Gateway for upstream errors
      res.writeHead(502, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          error: 'WebSocket service unavailable',
          message: 'Connection to chat service failed. Please reconnect.',
        }),
      );
    },
  });
}

/**
 * Creates WebSocket proxy to Simulation Server (/sim route)
 * - WebSocket support enabled
 * - 10 minute WebSocket timeout
 * - Used for simulation engine communication
 */
export function createSimProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.simulationUrl,
    ws: true,
    timeout: 600_000, // 10 minutes
    proxyTimeout: 600_000, // 10 minutes
    pathRewrite: { '^/sim': '' },
    onError: (err, req, res) => {
      console.error('[sim-proxy] Error:', {
        message: err.message,
        code: (err as any).code,
        method: req.method,
        url: req.url,
      });

      // Return 502 Bad Gateway for upstream errors
      res.writeHead(502, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          error: 'Simulation service unavailable',
          message: 'Connection to simulation server failed. Please try again later.',
        }),
      );
    },
  });
}
