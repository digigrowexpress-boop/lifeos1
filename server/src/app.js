import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import accountRoutes from './routes/account.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';
import { errorHandler, notFound } from './utils/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

// Setup problems (.env, database) are detailed in the server log; production visitors only get a generic notice.
const publicSetupError = (error) => (config.isProd ? 'LifeOS is temporarily unavailable. Please try again in a few minutes.' : error);

export function createApp({ getStartupError = () => null, isReady = () => true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: config.corsOrigins.length ? config.corsOrigins : false,
      // Session cookies must be allowed for a client hosted on another origin.
      credentials: config.corsOrigins.length > 0,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    const error = getStartupError();
    const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(error ? 503 : 200).json({ ok: !error && db === 'connected', db, error: error ? publicSetupError(error) : undefined });
  });

  // CSRF protection: state-changing API calls must carry a custom header. Browsers only send
  // custom headers cross-origin after a CORS preflight, which is refused for unknown origins.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('X-LifeOS-Client') === '1') return next();
    return res.status(403).json({ error: 'Request blocked: missing LifeOS client header.', code: 'CSRF' });
  });

  // While the server is misconfigured or the database is unavailable, explain why instead of failing obscurely.
  app.use('/api', (_req, res, next) => {
    const error = getStartupError();
    if (error) return res.status(503).json({ error: publicSetupError(error), code: 'SETUP' });
    if (mongoose.connection.readyState !== 1 || !isReady()) {
      return res.status(503).json({ error: 'The database is still connecting — try again in a moment.', code: 'DB_CONNECTING' });
    }
    return next();
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, _res, next) => next(notFound('Unknown API route')));

  // Single-deployment mode: serve the built React client when it exists.
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
