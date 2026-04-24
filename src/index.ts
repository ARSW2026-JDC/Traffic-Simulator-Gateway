import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config/config';
import { authMiddleware } from './authentication/auth';

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────────────
// MIDDLEWARE STACK
// ─────────────────────────────────────────────────────────────────────

app.use(morgan('combined'));

// CORS: Only allow requests from configured origin
app.use(
  cors({
    origin: config.allowedOrigin,
    credentials: true,
  }),
);

// Rate Limiting: Global 600 req/min (will be refined in Phase 2)
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 600,
    standardHeaders: true,
    message: 'Too many requests from this IP, please try again later.',
  }),
);

// ─────────────────────────────────────────────────────────────────────
// PROXY MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────

/**
 * /nrt → Backend (WebSocket enabled)
 * Routes chat and real-time notifications
 */
const nrtProxy = createProxyMiddleware({
  target: config.backendUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/nrt': '' },
  onError: (err: Error) => {
    console.error('[nrt-proxy]', err.message);
  },
});

/**
 * /sim → Simulation Server (WebSocket enabled)
 * Routes simulation engine requests
 */
const simProxy = createProxyMiddleware({
  target: config.simulationUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/sim': '' },
  onError: (err: Error) => {
    console.error('[sim-proxy]', err.message);
  },
});

/**
 * /api → Backend (REST only)
 * Routes general API requests with authentication
 */
const apiProxy = createProxyMiddleware({
  target: config.backendUrl,
  changeOrigin: true,
  onError: (err: Error) => {
    console.error('[api-proxy]', err.message);
  },
});

// ─────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────

// API route (with authentication)
app.use('/api', authMiddleware, apiProxy);

// NRT route (WebSocket, no auth yet)
app.use('/nrt', nrtProxy);

// SIM route (WebSocket, no auth yet)
app.use('/sim', simProxy);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

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

