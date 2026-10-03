import { Session, User } from '../models/index.js';
import { forbidden, unauthorized } from '../utils/http.js';
import { clearSessionCookie, hashToken, readSessionToken, revokeUserSessions, touchSession } from '../utils/sessions.js';

/** What each non-active status means for the person trying to sign in. */
export const STATUS_DENIAL = {
  pending: {
    code: 'ACCOUNT_PENDING',
    message: 'Your account is waiting for administrator approval. You’ll be able to sign in once it has been approved.',
  },
  rejected: {
    code: 'ACCOUNT_REJECTED',
    message: 'This registration request was not approved, so the account can’t sign in. Contact the administrator if you think this is a mistake.',
  },
  suspended: {
    code: 'ACCOUNT_SUSPENDED',
    message: 'This account has been suspended. Contact the administrator to restore access.',
  },
};

const REVOKE_MESSAGES = {
  password: 'You were signed out because the account password was changed. Please sign in again.',
};

/**
 * Requires a valid, unexpired session whose account is still active. Sets
 * req.user / req.userId / req.authSession. Enforced on the server for every
 * protected API — never only in the UI.
 */
export async function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  if (!token) return next(unauthorized('Please sign in to continue.', 'NO_SESSION'));

  const session = await Session.findOne({ tokenHash: hashToken(token) });
  if (session?.revokedAt) {
    await session.deleteOne();
    clearSessionCookie(res);
    const denial = STATUS_DENIAL[session.revokedReason];
    if (denial) return next(forbidden(denial.message, denial.code));
    return next(unauthorized(REVOKE_MESSAGES[session.revokedReason] || 'You were signed out. Please sign in again.', 'SESSION_REVOKED'));
  }
  if (!session || session.expiresAt <= new Date()) {
    if (session) await session.deleteOne();
    clearSessionCookie(res);
    return next(unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED'));
  }

  const user = await User.findById(session.userId);
  if (!user) {
    await revokeUserSessions(session.userId);
    clearSessionCookie(res);
    return next(unauthorized('This account no longer exists.', 'ACCOUNT_NOT_FOUND'));
  }
  if (user.status !== 'active') {
    // Status changed after sign-in (e.g. suspended): end every session for this account.
    await revokeUserSessions(user._id);
    clearSessionCookie(res);
    const denial = STATUS_DENIAL[user.status] || STATUS_DENIAL.suspended;
    return next(forbidden(denial.message, denial.code));
  }

  await touchSession(req, res, session, token);
  req.user = user;
  req.userId = user._id;
  req.authSession = session;
  return next();
}

/** LifeOS personal data is for user accounts; the admin account only manages accounts. */
export function requireUser(req, _res, next) {
  if (req.user?.role !== 'user') {
    return next(forbidden('The administrator account manages registrations only and has no personal LifeOS workspace.', 'ADMIN_NO_WORKSPACE'));
  }
  return next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(forbidden('This area is for the administrator only.', 'ADMIN_ONLY'));
  return next();
}
