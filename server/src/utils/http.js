export class HttpError extends Error {
  /** @param code machine-readable reason the client can act on (e.g. ACCOUNT_PENDING) */
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Please sign in to continue.', code = 'UNAUTHORIZED') => new HttpError(401, msg, undefined, code);
export const forbidden = (msg = 'You don’t have access to this.', code = 'FORBIDDEN') => new HttpError(403, msg, undefined, code);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg, code) => new HttpError(409, msg, undefined, code);

/**
 * Recursively drop keys that could be interpreted as MongoDB operators
 * (`$where`, `a.b`) and server-managed fields from client payloads.
 */
const PROTECTED = new Set(['_id', 'id', 'userId', '__v', 'createdAt', 'updatedAt']);

export function sanitizePayload(value, depth = 0) {
  if (depth > 12) return undefined;
  if (Array.isArray(value)) return value.map((v) => sanitizePayload(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      if (depth === 0 && PROTECTED.has(key)) continue;
      out[key] = sanitizePayload(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  if (err?.name === 'ValidationError') {
    const details = Object.fromEntries(Object.entries(err.errors || {}).map(([k, e]) => [k, e.message]));
    return res.status(400).json({ error: 'Validation failed', details });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: `Invalid value for ${err.path}` });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'A record with these values already exists' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Internal server error' });
}
