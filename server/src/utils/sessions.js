import crypto from 'node:crypto';
import { config } from '../config.js';
import { Session } from '../models/index.js';

export const COOKIE_NAME = 'lifeos_session';
const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = DAY_MS; // sliding expiry: extend at most once a day

/** Keyed hash, so stored hashes are useless without the server secret. */
export const hashToken = (token) => crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');

function cookieOptions() {
  // Cross-origin deployments (CORS_ORIGIN set) need SameSite=None, which browsers only accept with Secure.
  const sameSite = config.cookie.sameSite || (config.corsOrigins.length ? 'none' : 'lax');
  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : config.cookie.secure,
    sameSite,
    path: '/',
    maxAge: config.sessionDays * DAY_MS,
  };
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(res) {
  const { maxAge: _ignored, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

/** Reads the session token from the cookie (browser) or a Bearer header (API clients). */
export function readSessionToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

export async function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + config.sessionDays * DAY_MS),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: String(req.ip || '').slice(0, 64),
  });
  setSessionCookie(res, token);
  return token;
}

/** Extends an active session (sliding expiry) without touching the database on every request. */
export async function touchSession(req, res, session, token) {
  if (Date.now() - new Date(session.lastSeenAt).getTime() < RENEW_AFTER_MS) return;
  session.lastSeenAt = new Date();
  session.expiresAt = new Date(Date.now() + config.sessionDays * DAY_MS);
  await session.save();
  setSessionCookie(res, token);
}

/**
 * Ends sessions for an account. With a reason, sessions are kept as revoked
 * markers (until they expire) so the next request can explain why access ended.
 */
export function revokeUserSessions(userId, exceptSessionId = null, reason = null) {
  const filter = exceptSessionId ? { userId, _id: { $ne: exceptSessionId } } : { userId };
  if (!reason) return Session.deleteMany(filter);
  return Session.updateMany({ ...filter, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}
