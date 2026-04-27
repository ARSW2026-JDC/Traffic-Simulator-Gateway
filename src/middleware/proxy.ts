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
import nodeHttp from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '../config/config';

/**
 * HTTP Agent with connection keep-alive
 * Reuses connections to reduce latency
 */
const createHttpAgent = () =>
  new nodeHttp.Agent({
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
  return (err: Error, req: IncomingMessage, res: any) => {
    const code = (err as any).code;
    const statusCode = code === 'ECONNREFUSED' ? 503 : 502;
    console.error(`[${proxyName}] Error:`, {
      message: err.message,
      code,
      method: req?.method,
      url: req?.url,
    });

    const payload = JSON.stringify({
      error: 'Service unavailable',
      message: `The ${proxyName} service is not responding.`,
    });

    // If res is a normal HTTP ServerResponse
    if (res && typeof res.writeHead === 'function') {
      try {
        if ((res as ServerResponse).writableEnded) return;
        (res as ServerResponse).writeHead(statusCode, { 'Content-Type': 'application/json' });
        (res as ServerResponse).end(payload);
      } catch (writeErr) {
        // Best-effort: destroy if unable to write
        try {
          res.destroy && res.destroy();
        } catch {}
      }
      return;
    }

    // If res is a raw socket (upgrade / websocket path) - try best-effort minimal HTTP response
    try {
      if (res && typeof res.write === 'function') {
        const statusText = require('http').STATUS_CODES[statusCode] || 'Error';
        const header = `HTTP/1.1 ${statusCode} ${statusText}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n`;
        res.write(header + payload);
        res.end && res.end();
        return;
      }

      // Fallback: destroy underlying request socket if present
      if (req && req.socket && typeof req.socket.destroy === 'function') {
        req.socket.destroy();
      }
    } catch (socketErr) {
      try {
        res && res.destroy && res.destroy();
      } catch {}
    }
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
    on: {
      error: createErrorHandler('API'),
    },
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
    on: {
      error: createErrorHandler('Chat'),
    },
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
    on: {
      error: createErrorHandler('Simulation'),
    },
  });
}
