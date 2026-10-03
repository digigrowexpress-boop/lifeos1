import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { revokeUserSessions } from '../utils/sessions.js';

export const BCRYPT_ROUNDS = 12;
export const ADMIN_MIN_PASSWORD = 12;

/**
 * Accounts created before approval existed have no role/status. They were
 * already using LifeOS, so they stay active with all of their records untouched.
 */
export async function migrateLegacyUsers() {
  const now = new Date();
  const res = await User.updateMany(
    { status: { $exists: false } },
    {
      $set: { status: 'active', approvedAt: now },
      $push: { statusHistory: { status: 'active', at: now, by: null, note: 'Existing account kept active when approval was introduced' } },
    }
  );
  await User.updateMany({ role: { $exists: false } }, { $set: { role: 'user' } });
  if (res.modifiedCount) console.log(`[auth] kept ${res.modifiedCount} existing account(s) active with their data`);
}

/**
 * Creates the single administrator from ADMIN_EMAIL / ADMIN_PASSWORD (server env
 * only). Never promotes an existing user account and never runs through signup.
 */
export async function ensureAdmin() {
  const admin = await User.findOne({ role: 'admin' });
  const { email, password, resetPassword } = config.admin;

  if (admin) {
    if (email && admin.email !== email) {
      console.warn(`[auth] an administrator already exists (${admin.email}); ADMIN_EMAIL=${email} is ignored.`);
    } else if (password && resetPassword) {
      if (password.length < ADMIN_MIN_PASSWORD) return console.error(`[auth] ADMIN_PASSWORD must be at least ${ADMIN_MIN_PASSWORD} characters — password not reset.`);
      admin.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await admin.save();
      await revokeUserSessions(admin._id);
      console.log('[auth] administrator password reset. Remove ADMIN_PASSWORD and ADMIN_RESET_PASSWORD from server/.env now.');
    } else if (password) {
      console.log('[auth] administrator ready. You can remove ADMIN_PASSWORD from server/.env (it is only used to create the account).');
    }
    return;
  }

  if (!email || !password) {
    console.warn('[auth] no administrator account yet — set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env (or run: npm run admin:create).');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return console.error('[auth] ADMIN_EMAIL is not a valid email address — administrator not created.');
  if (password.length < ADMIN_MIN_PASSWORD) return console.error(`[auth] ADMIN_PASSWORD must be at least ${ADMIN_MIN_PASSWORD} characters — administrator not created.`);
  if (await User.exists({ email })) {
    return console.error(`[auth] ${email} already belongs to a regular LifeOS account, so it can't become the administrator. Use a different ADMIN_EMAIL.`);
  }

  await User.create({
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: 'admin',
    status: 'active',
    approvedAt: new Date(),
    statusHistory: [{ status: 'active', note: 'Administrator created from server configuration' }],
    profile: { name: 'Administrator' },
  });
  console.log(`[auth] administrator account created for ${email}. Remove ADMIN_PASSWORD from server/.env now — it is no longer needed.`);
}
