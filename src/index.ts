import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config';
import { authMiddleware } from './authentication/auth';
import { send } from 'process';

const app = express();
const server = http.createServer(app);
const axios = require('axios');

app.use(morgan('combined'));
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true }));
app.use(express.json());

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
  pathRewrite: { '^/api/v1/simulator': '' },
  onError: (err: Error) => console.error('[sim-proxy]', err.message),
});

const apiProxy = createProxyMiddleware({
  target: config.backendUrl,
  changeOrigin: true,
  onError: (err: Error) => console.error('[api-proxy]', err.message),
});

app.post('/api/v1/simulator/forward', async (req, res) => {
  try {
    const response = await axios.post(
      `${config.simulationUrl}/api/events`,
      req.body
    );
    res.json({ status: 'event sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'failed to forward' });
  }
});

app.use('/api/v1/simulator', simProxy);
app.use('/api', authMiddleware, apiProxy);
app.use('/nrt', nrtProxy);


app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Health check for simulation every 5 seconds
setInterval(async () => {
  try {
    const response = await axios.get(`${config.simulationUrl}/health`);
    console.log(`[health-check] Simulation status: ${response.status}`);
  }
  catch (err) {
    console.error(`[health-check] Error: ${err.message}`);
  }
}, 5000);

async function sendEvent() {
  try {
    const payload = {
      type: 'SIMULATION_START',
      timestamp: new Date().toISOString(),
    };
    await axios.post(`${config.simulationUrl}/api/events`, payload);
    console.log('[event] Simulation start event sent');
  } catch (err) {
    console.error(`[event] Error sending event: ${err.message}`);
  }
}


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
