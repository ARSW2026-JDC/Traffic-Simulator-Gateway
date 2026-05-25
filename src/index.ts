import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import morgan from 'morgan';
import { config } from './config/config';
import { authMiddleware } from './authentication/auth';
import {
  createApiProxy,
  createChatProxy,
  createSimProxy,
  createHistoryProxy,
} from './middleware/proxy';
import { metricsMiddleware } from './middleware/metrics';
import { registry, startMetricsPush, stopMetricsPush, backendHealthStatus, rateLimitExceededTotal, frontendPageLoadSeconds, frontendApiDurationSeconds, frontendWsConnectionTime, frontendJsErrorsTotal } from './metrics/index';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

app.use(morgan('combined'));

// CORS: Only allow requests from configured origin
app.use(
  cors({
    origin: config.allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  }),
);

// Handle preflight requests for all routes
app.use(metricsMiddleware);

app.options('*', cors());

// RATE LIMITING (Per-route configuration)

const SKIP_SOCKET_IO = (req: express.Request): boolean => {
  const path = req.path || req.url || '';
  return (
    path.includes('/socket.io') ||
    path.includes('/socket.io/') ||
    req.get('upgrade') === 'websocket'
  );
};

/**
 * API rate limiter: 300 requests per minute
 * - Standard REST API calls
 * - Protected by authentication
 */
const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 300, // 300 requests per window
  standardHeaders: true,
  skip: SKIP_SOCKET_IO,
  handler: (req, res) => {
    console.warn('[rate-limit] API rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
    });
    rateLimitExceededTotal.inc({ route: 'api' });
    res.status(429).json({
      error: 'Too many requests',
      message: 'API rate limit exceeded. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * chat (Chat/Real-time) rate limiter: 50 requests per minute
 * - More restrictive for chat/real-time connections
 * - Critical for stability
 */
const chatLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  max: 50,
  standardHeaders: true,
  skip: SKIP_SOCKET_IO,
  handler: (req, res) => {
    console.warn('[rate-limit] chat rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
    });
    rateLimitExceededTotal.inc({ route: 'chat' });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Chat connection rate limit exceeded. Please reconnect later.',
      retryAfter: 60,
    });
  },
});

/**
 * Simulation rate limiter: 100 requests per minute
 * - Moderate limit for computationally heavy simulation requests
 */
const simLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  skip: SKIP_SOCKET_IO,
  handler: (req, res) => {
    console.warn('[rate-limit] Simulation rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
    });
    rateLimitExceededTotal.inc({ route: 'sim' });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Simulation rate limit exceeded. Please try again later.',
      retryAfter: 60,
    });
  },
});

// PROXY MIDDLEWARE (with timeouts and error handling)

const apiProxy = createApiProxy();
const chatProxy = createChatProxy();
const simProxy = createSimProxy();
const historyProxy = createHistoryProxy();

// ROUTES

// API route: /api → Backend (with authentication and rate limiting)
app.use('/api', apiLimiter, authMiddleware, apiProxy);

// History route: /history → History Service
app.use('/history', apiLimiter, authMiddleware, historyProxy);

// chat route: /chat → Chat Service (WebSocket for chat, with rate limiting)
app.use('/chat', chatLimiter, chatProxy);

// SIM route: /sim → Simulation Server (WebSocket, with rate limiting)
app.use('/sim', simLimiter, simProxy);

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    const metrics = await registry.metrics();
    res.set('Content-Type', registry.contentType);
    res.end(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Frontend E2E metrics endpoint 
app.post('/metrics/frontend-e2e', express.json(), (req, res) => {
  const { pageLoads, apiCalls, wsConnections, jsErrors } = req.body

  pageLoads?.forEach(({ metric, value }: any) =>
    frontendPageLoadSeconds.observe({ metric }, value))

  apiCalls?.forEach(({ method, route, duration }: any) =>
    frontendApiDurationSeconds.observe({ method, route }, duration))

  wsConnections?.forEach(({ namespace, seconds }: any) =>
    frontendWsConnectionTime.set({ namespace }, seconds))

  jsErrors?.forEach(({ type }: any) =>
    frontendJsErrorsTotal.inc({ type }))

  res.json({ ok: true })
})

// HEALTH CHECKS

const healthStatus = {
  gateway: 'ok',
  backend: 'unknown',
  chat: 'unknown',
  history: 'unknown',
  simulationServer: 'unknown',
  lastCheck: null as string | null,
};

const checkBackendHealth = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.backendUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const status = response.ok ? 'ok' : 'error';
    backendHealthStatus.set({ service: 'backend' }, status === 'ok' ? 1 : 0);
    return status;
  } catch {
    backendHealthStatus.set({ service: 'backend' }, 0);
    return 'unavailable';
  }
};

const checkSimulationHealth = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.simulationUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const status = response.ok ? 'ok' : 'error';
    backendHealthStatus.set({ service: 'simulation' }, status === 'ok' ? 1 : 0);
    return status;
  } catch {
    backendHealthStatus.set({ service: 'simulation' }, 0);
    return 'unavailable';
  }
};

const checkChatHealth = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.chatUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const status = response.ok ? 'ok' : 'error';
    backendHealthStatus.set({ service: 'chat' }, status === 'ok' ? 1 : 0);
    return status;
  } catch {
    backendHealthStatus.set({ service: 'chat' }, 0);
    return 'unavailable';
  }
};

const checkHistoryHealth = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.historyUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const status = response.ok ? 'ok' : 'error';
    backendHealthStatus.set({ service: 'history' }, status === 'ok' ? 1 : 0);
    return status;
  } catch {
    backendHealthStatus.set({ service: 'history' }, 0);
    return 'unavailable';
  }
};

setInterval(async () => {
  healthStatus.backend = await checkBackendHealth();
  healthStatus.simulationServer = await checkSimulationHealth();
  healthStatus.chat = await checkChatHealth();
  healthStatus.history = await checkHistoryHealth();
  healthStatus.lastCheck = new Date().toISOString();
}, 30_000);

// Run health check immediately on startup
checkBackendHealth().then((status) => {
  healthStatus.backend = status;
  console.info(`[health] Backend status: ${status}`);
});
checkSimulationHealth().then((status) => {
  healthStatus.simulationServer = status;
  console.info(`[health] Simulation Server status: ${status}`);
});
checkChatHealth().then((status) => {
  healthStatus.chat = status;
  console.info(`[health] Chat Server status: ${status}`);
});
checkHistoryHealth().then((status) => {
  healthStatus.history = status;
  console.info(`[health] History Server status: ${status}`);
});

healthStatus.lastCheck = new Date().toISOString();

// Health check endpoint with dependency status
app.get('/health', (_req, res) => {
  const allHealthy =
    healthStatus.backend === 'ok' && healthStatus.simulationServer === 'ok' && healthStatus.history === 'ok' && healthStatus.chat === 'ok';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      gateway: healthStatus.gateway,
      backend: healthStatus.backend,
      simulationServer: healthStatus.simulationServer,
      chat: healthStatus.chat,
      history: healthStatus.history,
      lastCheck: healthStatus.lastCheck,
    },
  });
});

// WEBSOCKET UPGRADE HANDLING

server.on('upgrade', (req, socket, head) => {
  const url = req.url ?? '';

  try {
    if (url.startsWith('/chat')) {
      (chatProxy as any).upgrade(req, socket, head);
    } else if (url.startsWith('/sim')) {
      (simProxy as any).upgrade(req, socket, head);
    } else if (url.startsWith('/history')) {
      (historyProxy as any).upgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  } catch {
    socket.destroy();
  }
});

// SERVER STARTUP

if (process.env.NODE_ENV !== 'test') {
server.listen(config.port, () => {
  console.info(`
  Gateway http://localhost:${config.port}
    /api ${config.backendUrl}  (with auth)
    /chat ${config.chatUrl}  (WebSocket)
    /history ${config.historyUrl}  (WebSocket)
    /sim ${config.simulationUrl} (WebSocket)
  CORS Origin: ${config.allowedOrigin}
  Health Check: http://localhost:${config.port}/health
`);
  startMetricsPush();
});
}

// Graceful shutdown

const shutdown = (signal: string) => {
  console.info(`${signal} received: closing HTTP server`);
  stopMetricsPush();
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  console.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
});

// Export functions for testing
export {
  app,
  server,
  checkBackendHealth,
  checkSimulationHealth,
  checkChatHealth,
  checkHistoryHealth,
  SKIP_SOCKET_IO,
  apiLimiter,
  chatLimiter,
  simLimiter,
};

process.on('SIGINT', () => {
  console.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
});

