import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User, Session } from '../models/index.js';
import { requireAuth, STATUS_DENIAL } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, unauthorized } from '../utils/http.js';
import { clearSessionCookie, createSession, hashToken, readSessionToken, revokeUserSessions } from '../utils/sessions.js';
import { mailEnabled, notifyAdminOfRegistration } from '../services/mailer.js';
import { BCRYPT_ROUNDS } from '../services/bootstrap.js';
import { config } from '../config.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.', code: 'RATE_LIMITED' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when an email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('lifeos-timing-equaliser', 10);

/** The account shape the browser sees — never the password hash. */
export function publicUser(user) {
  const u = user.toJSON();
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    profile: u.role === 'admin' ? { name: u.profile?.name || 'Administrator' } : u.profile || {},
  };
}

function validateSignup(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const details = {};
  if (!EMAIL_RE.test(email) || email.length > 254) details.email = 'Please enter a valid email address.';
  if (password.length < 8) details.password = 'Password must be at least 8 characters.';
  else if (password.length > 200) details.password = 'Password is too long.';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) details.password = 'Use at least one letter and one number.';
  if (Object.keys(details).length) throw badRequest(Object.values(details)[0], details);
  return { email, password };
}

/**
 * Registration request. Always creates role=user, status=pending — the role is
 * never read from the request, so nobody can sign up as an administrator.
 */
router.post('/register', authLimiter, async (req, res) => {
  const { email, password } = validateSignup(req.body);
  const name = String(req.body?.name || '').trim().slice(0, 120);
  if (await User.exists({ email })) {
    throw conflict('An account with this email already exists or is awaiting approval. Try signing in instead.', 'EMAIL_TAKEN');
  }
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: 'user',
    status: 'pending',
    statusHistory: [{ status: 'pending', note: 'Registration request submitted' }],
    profile: name ? { name } : {},
  });
  notifyAdminOfRegistration(user).catch(() => {});
  res.status(201).json({
    status: 'pending',
    email: user.email,
    message: 'Registration request received. Your account is pending administrator approval.',
    emailNotifications: mailEnabled() && config.mail.notifyUsers,
  });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw badRequest('Enter your email and password.');

  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) {
    throw unauthorized('Email or password is incorrect. If you don’t have an account yet, create one first.', 'INVALID_CREDENTIALS');
  }
  // Account status is only revealed after the correct password, so it can't be probed.
  if (user.status !== 'active') {
    const denial = STATUS_DENIAL[user.status] || STATUS_DENIAL.suspended;
    throw forbidden(denial.message, denial.code);
  }

  await createSession(req, res, user._id);
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ user: publicUser(user) });
});

/** Ends the current session on the server (the old cookie stops working immediately). */
router.post('/logout', async (req, res) => {
  const token = readSessionToken(req);
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/** Like /me, but answers { user: null } instead of an error when nobody is signed in (used on app start). */
router.get('/session', async (req, res, next) => {
  if (!readSessionToken(req)) return res.json({ user: null });
  return requireAuth(req, res, (err) => {
    if (err) {
      if (err.status === 401 || err.status === 403) return res.json({ user: null, reason: err.code });
      return next(err);
    }
    return res.json({ user: publicUser(req.user) });
  });
});

router.put('/password', requireAuth, authLimiter, async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  const minLength = req.user.role === 'admin' ? 12 : 8;
  if (next.length < minLength) throw badRequest(`New password must be at least ${minLength} characters.`);
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) throw badRequest('Use at least one letter and one number.');
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!(await bcrypt.compare(current, user.passwordHash))) throw badRequest('Current password is incorrect.');
  user.passwordHash = await bcrypt.hash(next, BCRYPT_ROUNDS);
  await user.save();
  // Sign out every other device; keep this one.
  await revokeUserSessions(user._id, req.authSession._id, 'password');
  res.json({ ok: true });
});

export default router;
