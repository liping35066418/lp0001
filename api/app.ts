import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { authRequired } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const allowedOrigin = process.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3601';

app.use(cors({
  origin: [allowedOrigin, 'http://127.0.0.1:3601', 'http://localhost:3601'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  const token = req.headers.authorization?.slice(7) || '-';
  logger.info(`[${req.method}] ${req.path} - IP:${req.ip} - User:${req.user?.username || 'guest'} - Token:${token.slice(0, 8)}...`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'running', ts: new Date().toISOString() } });
});

registerRoutes(app);

app.use('/api/*', (_req, res) => {
  res.status(404).json({ code: 404, message: 'API endpoint not found', data: null });
});

const distDir = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
