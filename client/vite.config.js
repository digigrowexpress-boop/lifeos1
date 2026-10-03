import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://localhost:4000';

/**
 * During `npm run dev` the web app often starts (or the API restarts after a
 * .env change) a moment before the API is listening. Instead of a stack trace
 * per request, print one short notice; the app retries automatically.
 */
const logger = createLogger();
const logError = logger.error.bind(logger);
let lastNotice = 0;
logger.error = (msg, options) => {
  const refused = options?.error?.code === 'ECONNREFUSED' && String(msg).includes('http proxy error');
  if (!refused) return logError(msg, options);
  if (Date.now() - lastNotice > 5000) {
    lastNotice = Date.now();
    logger.warn(`waiting for the LifeOS API on ${API_TARGET} to start…`, { timestamp: true });
  }
};

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        configure(proxy) {
          // Answer like the API would, so the app can tell "starting up" from a real error.
          proxy.on('error', (err, _req, res) => {
            if (err?.code !== 'ECONNREFUSED' || !res || typeof res.writeHead !== 'function' || res.headersSent) return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'The LifeOS API is still starting — one moment…', code: 'API_STARTING' }));
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/three|@react-three/.test(id)) return 'three';
          if (/recharts|d3-|victory/.test(id)) return 'charts';
          if (/react-router|react-dom|scheduler|\/react\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
});
