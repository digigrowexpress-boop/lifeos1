import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, collections, collectionNames } from '../models/index.js';
import { requireAuth, requireUser } from '../middleware/auth.js';
import { revokeUserSessions, clearSessionCookie } from '../utils/sessions.js';
import { badRequest, notFound, sanitizePayload } from '../utils/http.js';
import { exportUserData, remapImport } from '../utils/portability.js';

const router = Router();
router.use(requireAuth, requireUser);

async function currentUser(req, withPassword = false) {
  const q = User.findById(req.userId);
  const user = await (withPassword ? q.select('+passwordHash') : q);
  if (!user) throw notFound('Account not found');
  return user;
}

async function wipeRecords(userId) {
  await Promise.all(collectionNames.map((name) => collections[name].deleteMany({ userId })));
}

router.get('/profile', async (req, res) => {
  const user = await currentUser(req);
  res.json(user.profile || {});
});

router.put('/profile', async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw badRequest('Expected a JSON object');
  const user = await currentUser(req);
  user.profile = sanitizePayload(req.body);
  user.markModified('profile');
  await user.save();
  res.json(user.profile);
});

router.get('/export', async (req, res) => {
  const user = await currentUser(req);
  const payload = await exportUserData(user);
  res.setHeader('Content-Disposition', `attachment; filename="lifeos-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(payload);
});

/** Import an export file. mode=replace wipes existing records first; mode=merge adds to them. */
router.post('/import', async (req, res) => {
  const mode = req.query.mode === 'merge' ? 'merge' : 'replace';
  let prepared;
  try {
    prepared = remapImport(req.body);
  } catch (e) {
    throw badRequest(e.message);
  }
  const user = await currentUser(req);
  if (mode === 'replace') await wipeRecords(user._id);
  const counts = {};
  for (const name of collectionNames) {
    const docs = prepared.data[name].map((d) => ({ ...d, userId: user._id }));
    if (docs.length) await collections[name].insertMany(docs);
    counts[name] = docs.length;
  }
  if (mode === 'replace' || !user.profile?.onboarded) {
    user.profile = { ...prepared.profile };
    user.markModified('profile');
    await user.save();
  }
  res.json({ ok: true, mode, counts });
});

/** Delete every tracked record but keep the account and profile settings. */
router.delete('/data', async (req, res) => {
  await wipeRecords(req.userId);
  res.json({ ok: true });
});

/** Permanently delete the account and all of its data. Requires the password. */
router.delete('/', async (req, res) => {
  const user = await currentUser(req, true);
  const ok = await bcrypt.compare(String(req.body?.password || ''), user.passwordHash);
  if (!ok) throw badRequest('Password is incorrect.');
  await wipeRecords(user._id);
  await revokeUserSessions(user._id);
  await User.deleteOne({ _id: user._id });
  clearSessionCookie(res);
  res.json({ ok: true });
});

export default router;
