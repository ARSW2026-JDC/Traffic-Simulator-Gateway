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

app.use(morgan('combined'));
//app.use(morgan('combined', { stream: accessLogStream }));
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true }));

const nrtProxy = createProxyMiddleware({
  target: config.backendUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/nrt': '' },
    onError: (err: Error) => console.error('[nrt-proxy]', err.message),
});

const simProxy = createProxyMiddleware({
  target: config.simulationUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/sim': '' },
  onError: (err: Error) => console.error('[sim-proxy]', err.message),
});

  const apiProxy = createProxyMiddleware({
    target: config.backendUrl,
    changeOrigin: true,
    onError: (err: Error) => console.error('[api-proxy]', err.message),
  });

app.use('/api', authMiddleware, apiProxy);
app.use('/nrt', nrtProxy);
app.use('/sim', simProxy);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url ?? '';
  if (url.startsWith('/nrt')) {
    (nrtProxy as any).upgrade(req, socket, head);
  } else if (url.startsWith('/sim')) {
    (simProxy as any).upgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(config.port, () => {
  console.log(`Gateway  →  http://localhost:${config.port}`);
  console.log(`  NRT backend  →  ${config.backendUrl}`);
  console.log(`  Simulation   →  ${config.simulationUrl}`);
});
