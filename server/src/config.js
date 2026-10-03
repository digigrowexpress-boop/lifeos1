const env = process.env;
const trimSlash = (s) => s.trim().replace(/\/+$/, '');

export const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT) || 4000,
  mongoUri: (env.MONGODB_URI || '').trim(),
  // Secret used to hash session tokens (JWT_SECRET is accepted for older .env files).
  sessionSecret: env.SESSION_SECRET || env.JWT_SECRET || '',
  sessionDays: Math.max(1, Number(env.SESSION_DAYS) || 14),
  corsOrigins: (env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Public URL of the web app (used for links in emails).
  appUrl: trimSlash(env.APP_URL || 'http://localhost:5173'),
  // The single administrator account is configured on the server only — never through signup.
  admin: {
    email: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: env.ADMIN_PASSWORD || '',
    resetPassword: env.ADMIN_RESET_PASSWORD === 'true',
    notifyEmail: (env.ADMIN_NOTIFY_EMAIL || env.ADMIN_EMAIL || '').trim(),
  },
  // Outgoing email over SMTP. MAIL_TRANSPORT=console prints emails to the terminal instead (development).
  mail: {
    transport: (env.MAIL_TRANSPORT || '').trim().toLowerCase(),
    host: (env.SMTP_HOST || '').trim(),
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : Number(env.SMTP_PORT) === 465,
    user: (env.SMTP_USER || '').trim(),
    pass: env.SMTP_PASS || '',
    from: (env.MAIL_FROM || env.SMTP_USER || '').trim(),
    notifyUsers: env.NOTIFY_USERS !== 'false',
  },
  // Session cookie. Defaults: Secure in production; SameSite=None when the client is on another origin.
  cookie: {
    secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    sameSite: (env.COOKIE_SAMESITE || '').trim().toLowerCase() || null,
  },
  // Optional AI coach (OpenAI or any OpenAI-compatible API). Disabled when no key is set.
  ai: {
    apiKey: (env.OPENAI_API_KEY || '').trim(),
    model: (env.OPENAI_MODEL || 'gpt-6-luna').trim(),
    baseUrl: trimSlash(env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
  },
};

export function assertConfig() {
  const missing = [];
  if (!config.mongoUri) missing.push('MONGODB_URI');
  if (!config.sessionSecret) missing.push('SESSION_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See server/.env.example.`);
  }
  if (!/^mongodb(\+srv)?:\/\//.test(config.mongoUri)) {
    throw new Error('MONGODB_URI must start with mongodb+srv:// or mongodb:// — copy it from Atlas → Connect → Drivers.');
  }
  const placeholder = config.mongoUri.match(/<[^>]*>/);
  if (placeholder) {
    throw new Error(
      `MONGODB_URI still contains the placeholder ${placeholder[0]}. Replace it (including the < > brackets) with your real value — ` +
        'the database user and password from Atlas → Database Access.'
    );
  }
  if (config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }
}

/** Turns low-level MongoDB connection errors into actionable advice. */
export function explainDbError(err) {
  const msg = String(err?.message || err);
  if (/bad auth|authentication failed/i.test(msg)) {
    return 'MongoDB Atlas rejected the username/password in MONGODB_URI. Use a *database user* from Atlas → Database Access (not your Atlas website login), check the password, and percent-encode special characters in it (@ → %40, # → %23, / → %2F, : → %3A).';
  }
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) {
    return 'The database host in MONGODB_URI could not be found. Re-copy the connection string from Atlas → Connect → Drivers and check your internet connection.';
  }
  if (/Server selection timed out|ETIMEDOUT|ECONNREFUSED|whitelist|not authorized to access/i.test(msg) || /\bIP\b/.test(msg)) {
    return 'Could not reach the Atlas cluster. In Atlas → Network Access, add your current IP address (or 0.0.0.0/0 while testing), then save .env again.';
  }
  return msg;
}
