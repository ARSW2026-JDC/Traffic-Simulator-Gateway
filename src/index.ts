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
  createNrtProxy,
  createSimProxy,
} from './middleware/proxy';
// import { metricsMiddleware, register } from './monitoring/metrics';
// import { logger } from './monitoring/logging';

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────────────
// MIDDLEWARE STACK
// ─────────────────────────────────────────────────────────────────────

app.use(morgan('combined'));

// Metrics collection middleware
// app.use(metricsMiddleware);

// CORS: Only allow requests from configured origin
app.use(
  cors({
    origin: config.allowedOrigin,
    credentials: true,
  }),
);

// ─────────────────────────────────────────────────────────────────────
// RATE LIMITING (Per-route configuration)
// ─────────────────────────────────────────────────────────────────────

/**
 * API rate limiter: 300 requests per minute
 * - Standard REST API calls
 * - Protected by authentication
 */
const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 300, // 300 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  skip: (req) => {
    // Log rate limit hits for monitoring
    return false;
  },
  handler: (req, res) => {
    console.warn('[rate-limit] API rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'API rate limit exceeded. Please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * NRT (Chat/Real-time) rate limiter: 50 requests per minute
 * - More restrictive for chat/real-time connections
 * - Critical for stability
 */
const nrtLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  max: 50,
  standardHeaders: true,
  skip: (req) => {
    // WebSocket upgrades don't count against rate limit
    // (only initial connection requests)
    return req.method === 'GET' && req.get('upgrade') === 'websocket';
  },
  handler: (req, res) => {
    console.warn('[rate-limit] NRT rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
    });
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
  skip: (req) => {
    // WebSocket upgrades don't count against rate limit
    return req.method === 'GET' && req.get('upgrade') === 'websocket';
  },
  handler: (req, res) => {
    console.warn('[rate-limit] Simulation rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Simulation rate limit exceeded. Please try again later.',
      retryAfter: 60,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────
// PROXY MIDDLEWARE (with timeouts and error handling)
// ─────────────────────────────────────────────────────────────────────

const apiProxy = createApiProxy();
const nrtProxy = createNrtProxy();
const simProxy = createSimProxy();

// ─────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────

// API route: /api → Backend (with authentication and rate limiting)
app.use('/api', apiLimiter, authMiddleware, apiProxy);

// NRT route: /nrt → Backend (WebSocket for chat, with rate limiting)
app.use('/nrt', nrtLimiter, nrtProxy);

// SIM route: /sim → Simulation Server (WebSocket, with rate limiting)
app.use('/sim', simLimiter, simProxy);

// ─────────────────────────────────────────────────────────────────────
// HEALTH CHECKS
// ─────────────────────────────────────────────────────────────────────

const healthStatus = {
  gateway: 'ok',
  backend: 'unknown',
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

    return response.ok ? 'ok' : 'error';
  } catch {
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

    return response.ok ? 'ok' : 'error';
  } catch {
    return 'unavailable';
  }
};

setInterval(async () => {
  healthStatus.backend = await checkBackendHealth();
  healthStatus.simulationServer = await checkSimulationHealth();
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
healthStatus.lastCheck = new Date().toISOString();

// Health check endpoint with dependency status
app.get('/health', (_req, res) => {
  const allHealthy =
    healthStatus.backend === 'ok' && healthStatus.simulationServer === 'ok';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      gateway: healthStatus.gateway,
      backend: healthStatus.backend,
      simulationServer: healthStatus.simulationServer,
      lastCheck: healthStatus.lastCheck,
    },
  });
});

// // Prometheus metrics endpoint
// app.get('/metrics', async (_req, res) => {
//   try {
//     res.set('Content-Type', register.contentType);
//     res.end(await register.metrics());
//   } catch (err) {
//     res.status(500).end(err instanceof Error ? err.message : 'Metrics error');
//   }
// });

// ─────────────────────────────────────────────────────────────────────
// WEBSOCKET UPGRADE HANDLING
// ─────────────────────────────────────────────────────────────────────

server.on('upgrade', (req, socket, head) => {
  const url = req.url ?? '';

  try {
    if (url.startsWith('/nrt')) {
      (nrtProxy as any).upgrade(req, socket, head);
    } else if (url.startsWith('/sim')) {
      (simProxy as any).upgrade(req, socket, head);
    } else {
      console.warn(`[upgrade] Rejecting unknown WebSocket upgrade request: ${url}`);
      socket.destroy();
    }
  } catch (error) {
    console.error('[upgrade] Error handling WebSocket upgrade:', error);
    socket.destroy();
  }
});

// ─────────────────────────────────────────────────────────────────────
// SERVER STARTUP
// ─────────────────────────────────────────────────────────────────────

server.listen(config.port, () => {
  console.info(`
  Gateway http://localhost:${config.port}
    /api ${config.backendUrl}  (with auth)
    /nrt ${config.backendUrl}  (WebSocket)
    /sim ${config.simulationUrl} (WebSocket)
  CORS Origin: ${config.allowedOrigin}
  Health Check: http://localhost:${config.port}/health
`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
});

