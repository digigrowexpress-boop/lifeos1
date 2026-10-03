import { Router } from 'express';
import mongoose from 'mongoose';
import { User, STATUSES, collections, collectionNames } from '../models/index.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, notFound } from '../utils/http.js';
import { revokeUserSessions } from '../utils/sessions.js';
import { mailEnabled, notifyUserOfDecision } from '../services/mailer.js';
import { config } from '../config.js';

/**
 * Administrator API: account management only. It exposes account metadata
 * (email, status, dates) and never anyone's personal LifeOS records.
 */
const router = Router();
router.use(requireAuth, requireAdmin);

/** Allowed status changes. */
const TRANSITIONS = {
  approve: { from: ['pending', 'rejected'], to: 'active', note: 'Approved' },
  reject: { from: ['pending'], to: 'rejected', note: 'Rejected' },
  suspend: { from: ['active'], to: 'suspended', note: 'Suspended' },
  reactivate: { from: ['suspended', 'rejected'], to: 'active', note: 'Reactivated' },
};

function accountView(u) {
  return {
    id: String(u._id),
    email: u.email,
    name: u.profile?.name || '',
    role: u.role,
    status: u.status,
    registeredAt: u.createdAt,
    approvedAt: u.approvedAt,
    lastLoginAt: u.lastLoginAt,
    updatedAt: u.updatedAt,
    history: (u.statusHistory || []).map((h) => ({ status: h.status, at: h.at, byAdmin: Boolean(h.by), note: h.note })),
  };
}

const ACCOUNT_FIELDS = { email: 1, role: 1, status: 1, createdAt: 1, approvedAt: 1, lastLoginAt: 1, updatedAt: 1, statusHistory: 1, 'profile.name': 1 };

async function targetUser(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid account id');
  const user = await User.findOne({ _id: id, role: 'user' });
  if (!user) throw notFound('Account not found');
  return user;
}

router.get('/summary', async (_req, res) => {
  const rows = await User.aggregate([{ $match: { role: 'user' } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) counts[r._id] = r.n;
  res.json({
    counts: { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) },
    email: { enabled: mailEnabled(), adminNotifications: Boolean(mailEnabled() && config.admin.notifyEmail), userNotifications: mailEnabled() && config.mail.notifyUsers },
  });
});

router.get('/users', async (req, res) => {
  const status = String(req.query.status || 'all');
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, 100);
  const filter = { role: 'user' };
  if (status !== 'all') {
    if (!STATUSES.includes(status)) throw badRequest('Unknown status');
    filter.status = status;
  }
  if (q) filter.email = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
  const users = await User.find(filter, ACCOUNT_FIELDS).sort({ createdAt: -1 }).limit(500).lean();
  res.json(users.map(accountView));
});

/** Every status change across accounts, newest first. */
router.get('/history', async (_req, res) => {
  const users = await User.find({ role: 'user' }, { email: 1, statusHistory: 1 }).lean();
  const events = users
    .flatMap((u) => (u.statusHistory || []).map((h) => ({ userId: String(u._id), email: u.email, status: h.status, at: h.at, byAdmin: Boolean(h.by), note: h.note })))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 300);
  res.json(events);
});

router.post('/users/:id/:action', async (req, res) => {
  const transition = TRANSITIONS[req.params.action];
  if (!transition) throw badRequest('Unknown action');
  const user = await targetUser(req.params.id);
  if (!transition.from.includes(user.status)) {
    throw conflict(`Can’t ${req.params.action} an account that is ${user.status}.`, 'INVALID_TRANSITION');
  }
  const note = String(req.body?.note || '').trim().slice(0, 300);
  user.status = transition.to;
  if (transition.to === 'active') user.approvedAt = new Date();
  user.statusHistory.push({ status: transition.to, at: new Date(), by: req.userId, note: note || transition.note });
  await user.save();
  // Anyone who is no longer active loses every session immediately.
  if (transition.to !== 'active') await revokeUserSessions(user._id, null, transition.to);
  if (req.params.action === 'approve' || req.params.action === 'reject') notifyUserOfDecision(user, transition.to).catch(() => {});
  const fresh = await User.findById(user._id, ACCOUNT_FIELDS).lean();
  res.json(accountView(fresh));
});

/**
 * Removes a registration request (pending or rejected accounts only). Approved
 * or suspended accounts can't be deleted here, so nobody's LifeOS data is lost
 * by accident; suspend them instead.
 */
router.delete('/users/:id', async (req, res) => {
  const user = await targetUser(req.params.id);
  if (!['pending', 'rejected'].includes(user.status)) {
    throw conflict('Only pending or rejected registration requests can be deleted. Suspend active accounts instead.', 'DELETE_NOT_ALLOWED');
  }
  await revokeUserSessions(user._id);
  await Promise.all(collectionNames.map((name) => collections[name].deleteMany({ userId: user._id })));
  await User.deleteOne({ _id: user._id });
  res.json({ ok: true, id: String(user._id) });
});

export default router;
