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
import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '../config/config';

/**
 * HTTP and HTTPS Agents with connection keep-alive
 * Reuses connections to reduce latency
 */
const agentSettings = {
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 256,
  maxFreeSockets: 64,
  requestTimeoutMs: 60000,
};
const httpAgent = new http.Agent(agentSettings);
const httpsAgent = new https.Agent(agentSettings);

/**
 * Helper function to get the appropriate agent based on the target URL protocol
 */
function getAgent(target: string) {
  const isHttps = target.startsWith('https');
  return isHttps ? httpsAgent : httpAgent;
}

/**
 * Creates detailed error handler with context
 */
const createErrorHandler = (proxyName: string, targetUrl: string) => {
  return (err: Error, req: IncomingMessage, res: any) => {
    const code = (err as any).code;
    const statusCode = code === 'ECONNREFUSED' ? 503 : 502;
    
    // Get the actual path from the incoming request
    const requestPath = req?.url || 'unknown';
    const headers = req?.headers || {};
    const host = headers.host || 'unknown';
    
    // Determine the correct target path based on proxy name
    // This helps identify which request path was incorrectly used
    let expectedRoutePath = '';
    if (proxyName === 'Chat') {
      expectedRoutePath = '/chat';
    } else if (proxyName === 'Simulation') {
      expectedRoutePath = '/sim';
    } else if (proxyName === 'History') {
      expectedRoutePath = '/history';
    }

    const payload = JSON.stringify({
      error: 'Service unavailable',
      message: `The ${proxyName} service is not responding.`,
      details: err.message,
      requestPath: requestPath,
    });

    // If res is a normal HTTP ServerResponse
    if (res && typeof res.writeHead === 'function') {
      try {
        if ((res as ServerResponse).writableEnded) return;
        (res as ServerResponse).writeHead(statusCode, { 'Content-Type': 'application/json' });
        (res as ServerResponse).end(payload);
      } catch (writeErr) {
        try {
          res.destroy && res.destroy();
        } catch {}
      }
      return;
    }

    // If res is a raw socket (upgrade / websocket path)
    try {
      if (res && typeof res.write === 'function') {
        const statusText = require('http').STATUS_CODES[statusCode] || 'Error';
        const header = `HTTP/1.1 ${statusCode} ${statusText}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n`;
        res.write(header + payload);
        res.end && res.end();
        return;
      }

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
};

/**
 * Creates HTTP proxy to Backend API (/api route)
 */
export function createApiProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.backendUrl,
    agent: getAgent(config.backendUrl),
    timeout: 60_000,
    proxyTimeout: 60_000,
    on: {
      error: createErrorHandler('API', config.backendUrl),
    },
  });
}

/**
 * Creates WebSocket proxy to Chat service (/chat route)
 * 
 * Note: pathRewrite removes /chat prefix before forwarding to backend
 * The backend expects just /socket.io/... not /chat/socket.io/...
 */
export function createChatProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.chatUrl,
    agent: getAgent(config.chatUrl),
    ws: true,
    timeout: 600_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/chat': '' },
    on: {
      error: createErrorHandler('Chat', config.chatUrl),
    },
  });
}

/**
 * Creates WebSocket proxy to Simulation Server (/sim route)
 * 
 * Note: pathRewrite strips /sim prefix before forwarding to backend
 * Frontend uses /sim prefix but backend expects just /socket.io/...
 */
export function createSimProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.simulationUrl,
    agent: getAgent(config.simulationUrl),
    ws: true,
    timeout: 600_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/sim': '' },
    on: {
      error: createErrorHandler('Simulation', config.simulationUrl),
    },
  });
}

/**
 * Creates proxy to History Service (/history route)
 */
export function createHistoryProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.historyUrl,
    agent: getAgent(config.historyUrl),
    ws: true,
    timeout: 60_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/history': '' },
    on: {
      error: createErrorHandler('History', config.historyUrl),
    },
  });
}