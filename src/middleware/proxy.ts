/**
 * Proxy Middleware Configuration
 *
 * Configures HTTP reverse proxies with:
 * - Request timeouts (prevents hanging connections)
 * - WebSocket support with timeout
 * - Proper error handling with context logging
 * - Per-proxy agent isolation (prevents cross-contamination)
 *
 * NOTE: WebSocket proxies (chat, sim, history) do NOT use ws:true nor a
 * keepAlive agent.  Both options interfere with the TCP-hijack that the
 * WebSocket upgrade requires and cause every proxy to register its own
 * "upgrade" listener on the server, producing the ECONNRESET fan-out bug.
 * The single server.on('upgrade', …) handler in index.ts is the only place
 * where WS connections are dispatched.
 */

import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '../config/config';
import { proxyErrorsTotal } from '../metrics/index';

// ---------------------------------------------------------------------------
// Agent helpers  (only used for the pure-HTTP API proxy)
// ---------------------------------------------------------------------------

const createAgentSettings = (_serviceName: string) => ({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 32,
  maxFreeSockets: 16,
  requestTimeoutMs: 60_000,
});

const httpAgents: Map<string, http.Agent> = new Map();
const httpsAgents: Map<string, https.Agent> = new Map();

function getAgent(target: string, serviceName: string): http.Agent {
  const isHttps = target.startsWith('https');
  const agents = isHttps ? httpsAgents : httpAgents;

  if (!agents.has(serviceName)) {
    const settings = createAgentSettings(serviceName);
    const agent = isHttps
      ? new https.Agent(settings)
      : new http.Agent(settings);
    agents.set(serviceName, agent);
    console.log(
      `[PROXY] Created isolated ${serviceName} agent (${isHttps ? 'HTTPS' : 'HTTP'})`,
    );
  }

  return agents.get(serviceName)!;
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

const createErrorHandler = (proxyName: string, targetUrl: string) => {
  return (err: Error, req: IncomingMessage, res: any) => {
    const code = (err as any).code || 'UNKNOWN';
    const statusCode = code === 'ECONNREFUSED' ? 503 : 502;
    proxyErrorsTotal.inc({ target: proxyName.toLowerCase(), error_code: code });

    const requestPath = req?.url || 'unknown';
    const host = req?.headers?.host || 'unknown';

    const routeMap: Record<string, string> = {
      Chat: '/chat',
      Simulation: '/sim',
      History: '/history',
    };
    const expectedRoutePath = routeMap[proxyName] ?? '';

    console.error(`[${proxyName}] ERROR:`, {
      message: err.message,
      code: code || 'UNKNOWN',
      requestPath,
      host,
      expectedRoutePath,
      target: targetUrl,
      timestamp: new Date().toISOString(),
    });

    const payload = JSON.stringify({
      error: 'Service unavailable',
      message: `The ${proxyName} service is not responding.`,
      details: err.message,
      requestPath,
    });

    // HTTP response (regular requests)
    if (res && typeof res.writeHead === 'function') {
      try {
        if ((res as ServerResponse).writableEnded) return;
        (res as ServerResponse).writeHead(statusCode, {
          'Content-Type': 'application/json',
        });
        (res as ServerResponse).end(payload);
      } catch {
        try {
          res.destroy?.();
        } catch {}
      }
      return;
    }

    // WebSocket / raw socket fallback
    try {
      if (res && typeof res.write === 'function') {
        const statusText =
          require('http').STATUS_CODES[statusCode] || 'Error';
        const header =
          `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
          `Content-Type: application/json\r\n` +
          `Content-Length: ${Buffer.byteLength(payload)}\r\n` +
          `Connection: close\r\n\r\n`;
        res.write(header + payload);
        res.end?.();
        return;
      }
      req?.socket?.destroy();
    } catch {
      try {
        res?.destroy?.();
      } catch {}
    }
  };
};

// ---------------------------------------------------------------------------
// Debug logger
// ---------------------------------------------------------------------------

const createDebugLogger = (proxyName: string, _targetUrl: string) => ({
  onProxyReq: (proxyReq: http.ClientRequest, req: IncomingMessage) => {
    console.log(`[${proxyName}] HTTP request:`, {
      method: req.method,
      url: req.url,
      targetHost: proxyReq.getHeader('host'),
    });
  },
  onProxyReqWs: (
    proxyReq: http.ClientRequest,
    req: IncomingMessage,
    _socket: any,
  ) => {
    console.log(`[${proxyName}] WebSocket upgrade:`, {
      url: req.url,
      targetPath: proxyReq.path,
      hasAuth: !!req.headers.authorization,
    });
  },
  onProxyRes: (proxyRes: http.IncomingMessage, req: IncomingMessage) => {
    console.log(`[${proxyName}] Response:`, {
      statusCode: proxyRes.statusCode,
      url: req.url,
    });
  },
  onError: (err: Error, req: IncomingMessage) => {
    console.error(`[${proxyName}] Error:`, {
      message: err.message,
      url: req.url,
    });
  },
});

// ---------------------------------------------------------------------------
// Shared base options
// ---------------------------------------------------------------------------

const baseProxyOptions: Partial<Options> = {
  changeOrigin: true,
  xfwd: false,
};

// ---------------------------------------------------------------------------
// Proxies
// ---------------------------------------------------------------------------

/**
 * HTTP proxy → Backend API  (/api)
 *
 * Uses a keepAlive agent because this is pure REST — no WS upgrades.
 */
export function createApiProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.backendUrl,
    agent: getAgent(config.backendUrl, 'API'),
    timeout: 60_000,
    proxyTimeout: 60_000,
    on: {
      error: createErrorHandler('API', config.backendUrl),
      ...createDebugLogger('API', config.backendUrl),
    },
  });
}

/**
 * WebSocket proxy → Chat service  (/chat)
 *
 * - NO ws: true   → prevents internal "upgrade" listener registration
 * - NO agent      → keepAlive agents are incompatible with WS TCP-hijack
 *
 * WS upgrades are dispatched by the single server.on('upgrade') in index.ts.
 */
export function createChatProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.chatUrl,
    timeout: 600_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/chat': '' },
    on: {
      error: createErrorHandler('Chat', config.chatUrl),
      ...createDebugLogger('Chat', config.chatUrl),
    },
  });
}

/**
 * WebSocket proxy → Simulation server  (/sim)
 *
 * - NO ws: true
 * - NO agent
 */
export function createSimProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.simulationUrl,
    timeout: 600_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/sim': '' },
    on: {
      error: createErrorHandler('Simulation', config.simulationUrl),
      ...createDebugLogger('Simulation', config.simulationUrl),
    },
  });
}

/**
 * WebSocket proxy → History service  (/history)
 *
 * - NO ws: true
 * - NO agent
 */
export function createHistoryProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.historyUrl,
    timeout: 60_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/history': '' },
    on: {
      error: createErrorHandler('History', config.historyUrl),
      ...createDebugLogger('History', config.historyUrl),
    },
  });
}

export { createErrorHandler, createDebugLogger };