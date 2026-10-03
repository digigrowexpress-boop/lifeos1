import { config, assertConfig, explainDbError } from './config.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { createApp } from './app.js';
import { ensureAdmin, migrateLegacyUsers } from './services/bootstrap.js';
import { mailEnabled } from './services/mailer.js';

const RETRY_MS = 30_000;

/**
 * Setup problems (bad .env, unreachable database) don't crash the API: it keeps
 * running and answers every request with a clear explanation, so the web app can
 * show it. Saving server/.env restarts the API automatically in dev (node --watch).
 */
const state = { startupError: null, ready: false };

function fail(message) {
  state.startupError = message;
  console.error(`\n[api] ✖ ${message}\n`);
}

async function connectWithRetry() {
  try {
    await connectDatabase();
    // Preserve existing accounts and make sure the administrator exists before serving requests.
    await migrateLegacyUsers();
    await ensureAdmin();
    state.startupError = null;
    state.ready = true;
    console.log('[api] ✔ database ready');
  } catch (err) {
    fail(`Database connection failed: ${explainDbError(err)}`);
    // Auth/config problems won't fix themselves; network blips might.
    if (!/bad auth|authentication failed|ENOTFOUND|querySrv/i.test(String(err?.message))) {
      setTimeout(connectWithRetry, RETRY_MS).unref();
    }
  }
}

async function main() {
  let configOk = true;
  try {
    assertConfig();
  } catch (err) {
    configOk = false;
    fail(`Configuration problem in server/.env: ${err.message}`);
  }

  const app = createApp({ getStartupError: () => state.startupError, isReady: () => state.ready });
  const server = app.listen(config.port, () => {
    console.log(`[api] LifeOS API listening on http://localhost:${config.port} (${config.env})`);
    console.log(`[api] email: ${mailEnabled() ? 'enabled' : 'disabled — set SMTP_* (or MAIL_TRANSPORT=console) to send admin notifications'}`);
    console.log(`[api] AI coach: ${config.ai.apiKey ? `enabled (${config.ai.model})` : 'disabled — set OPENAI_API_KEY to enable'}`);
  });
  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `[api] Port ${config.port} is already in use — stop the other process or set PORT in server/.env.` : err);
    process.exit(1);
  });
  if (configOk) await connectWithRetry();

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
