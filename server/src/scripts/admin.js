/**
 * Create the LifeOS administrator, or reset its password, from the terminal:
 *
 *   npm run admin:create            (prompts for email + password)
 *   npm run admin:reset-password    (prompts for a new password)
 *
 * The password is typed hidden and stored only as a bcrypt hash.
 */
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { connectDatabase, disconnectDatabase } from '../db.js';
import { User } from '../models/index.js';
import { ADMIN_MIN_PASSWORD, BCRYPT_ROUNDS } from '../services/bootstrap.js';
import { revokeUserSessions } from '../utils/sessions.js';

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write(s.includes('\n') || s.includes('\r') ? '\n' : '*');
    };
  }
  return new Promise((resolve) => rl.question(question, (answer) => (rl.close(), resolve(answer.trim()))));
}

async function askPassword() {
  const pass = await ask(`Password (min ${ADMIN_MIN_PASSWORD} characters): `, { hidden: true });
  if (pass.length < ADMIN_MIN_PASSWORD || !/[A-Za-z]/.test(pass) || !/\d/.test(pass)) {
    throw new Error(`Use at least ${ADMIN_MIN_PASSWORD} characters with letters and numbers.`);
  }
  const again = await ask('Repeat password: ', { hidden: true });
  if (again !== pass) throw new Error('Passwords did not match.');
  return pass;
}

async function main() {
  const command = process.argv[2] || 'create';
  if (!config.mongoUri) throw new Error('MONGODB_URI is not set in server/.env');
  await connectDatabase();
  const existing = await User.findOne({ role: 'admin' });

  if (command === 'reset-password') {
    if (!existing) throw new Error('There is no administrator yet — run: npm run admin:create');
    console.log(`Resetting the password for ${existing.email}`);
    existing.passwordHash = await bcrypt.hash(await askPassword(), BCRYPT_ROUNDS);
    await existing.save();
    await revokeUserSessions(existing._id);
    console.log('✔ Administrator password updated. Existing admin sessions were signed out.');
    return;
  }

  if (existing) throw new Error(`An administrator already exists (${existing.email}). Use: npm run admin:reset-password`);
  const email = ((await ask(`Admin email${config.admin.email ? ` [${config.admin.email}]` : ''}: `)) || config.admin.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That is not a valid email address.');
  if (await User.exists({ email })) throw new Error(`${email} already belongs to a regular account. Choose another email for the administrator.`);
  const password = await askPassword();
  await User.create({
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: 'admin',
    status: 'active',
    approvedAt: new Date(),
    statusHistory: [{ status: 'active', note: 'Administrator created from the command line' }],
    profile: { name: 'Administrator' },
  });
  console.log(`✔ Administrator ${email} created. Sign in on the normal LifeOS sign-in page.`);
}

main()
  .catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase().catch(() => {}));
