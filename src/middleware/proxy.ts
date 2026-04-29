/**
 * Proxy Middleware Configuration
 * 
 * Configures HTTP reverse proxies with:
 * - Request timeouts (prevents hanging connections)
 * - WebSocket support with timeout
 * - Proper error handling with context logging
 * - Per-proxy agent isolation (prevents cross-contamination)
 */

import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '../config/config';

/**
 * Per-proxy agent isolation to prevent cross-contamination
 * When one service fails repeatedly, its connection pool doesn't affect others
 */
const createAgentSettings = (serviceName: string) => {
  return {
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 32,
    maxFreeSockets: 16,
    requestTimeoutMs: 60000,
  };
};

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
    console.log(`[PROXY] Created isolated ${serviceName} agent (${isHttps ? 'HTTPS' : 'HTTP'})`);
  }
  
  return agents.get(serviceName)!;
}

/**
 * Creates detailed error handler with context
 */
const createErrorHandler = (proxyName: string, targetUrl: string) => {
  return (err: Error, req: IncomingMessage, res: any) => {
    const code = (err as any).code;
    const statusCode = code === 'ECONNREFUSED' ? 503 : 502;
    
    const requestPath = req?.url || 'unknown';
    const headers = req?.headers || {};
    const host = headers.host || 'unknown';
    
    let expectedRoutePath = '';
    if (proxyName === 'Chat') expectedRoutePath = '/chat';
    else if (proxyName === 'Simulation') expectedRoutePath = '/sim';
    else if (proxyName === 'History') expectedRoutePath = '/history';

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

    if (res && typeof res.writeHead === 'function') {
      try {
        if ((res as ServerResponse).writableEnded) return;
        (res as ServerResponse).writeHead(statusCode, { 'Content-Type': 'application/json' });
        (res as ServerResponse).end(payload);
      } catch {
        try { res.destroy && res.destroy(); } catch {}
      }
      return;
    }

    try {
      if (res && typeof res.write === 'function') {
        const statusText = require('http').STATUS_CODES[statusCode] || 'Error';
        const header = `HTTP/1.1 ${statusCode} ${statusText}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n`;
        res.write(header + payload);
        res.end && res.end();
        return;
      }

      if (req?.socket?.destroy) {
        req.socket.destroy();
      }
    } catch {
      try { res?.destroy?.(); } catch {}
    }
  };
};

/**
 * Debug logger for proxy events
 */
const createDebugLogger = (proxyName: string, targetUrl: string) => ({
  onProxyReq: (proxyReq: http.ClientRequest, req: IncomingMessage) => {
    console.log(`[${proxyName}] HTTP request:`, {
      method: req.method,
      url: req.url,
      targetHost: proxyReq.getHeader('host'),
    });
  },
  onProxyReqWs: (proxyReq: http.ClientRequest, req: IncomingMessage, socket: any) => {
    const auth = req.headers.authorization;
    console.log(`[${proxyName}] WebSocket upgrade:`, {
      url: req.url,
      targetPath: proxyReq.path,
      hasAuth: !!auth,
    });
  },
  onProxyRes: (proxyRes: http.IncomingMessage, req: IncomingMessage) => {
    console.log(`[${proxyName}] Response:`, { statusCode: proxyRes.statusCode, url: req.url });
  },
  onError: (err: Error, req: IncomingMessage) => {
    console.error(`[${proxyName}] Error:`, { message: err.message, url: req.url });
  },
});

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
 * Creates WebSocket proxy to Chat service (/chat route)
 */
export function createChatProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.chatUrl,
    agent: getAgent(config.chatUrl, 'Chat'),
    ws: true,
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
 * Creates WebSocket proxy to Simulation Server (/sim route)
 */
export function createSimProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.simulationUrl,
    agent: getAgent(config.simulationUrl, 'Simulation'),
    ws: true,
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
 * Creates proxy to History Service (/history route)
 */
export function createHistoryProxy() {
  return createProxyMiddleware({
    ...baseProxyOptions,
    target: config.historyUrl,
    agent: getAgent(config.historyUrl, 'History'),
    ws: true,
    timeout: 60_000,
    proxyTimeout: 600_000,
    pathRewrite: { '^/history': '' },
    on: {
      error: createErrorHandler('History', config.historyUrl),
      ...createDebugLogger('History', config.historyUrl),
    },
  });
}