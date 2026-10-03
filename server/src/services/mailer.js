import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { User } from '../models/index.js';

/**
 * Outgoing email. Configured only through server environment variables, so
 * SMTP credentials never reach the browser. Email failures are logged and never
 * block registration or approval.
 */
let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  if (config.mail.transport === 'console') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else if (config.mail.host) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
  }
  return transporter;
}

export const mailEnabled = () => Boolean(config.mail.transport === 'console' || config.mail.host);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

function layout(title, rows, cta) {
  const tableRows = rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#727d92">${esc(k)}</td><td style="padding:6px 0;color:#0e1525"><b>${esc(v)}</b></td></tr>`).join('');
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e6e9f0;border-radius:14px">
  <div style="font-size:18px;font-weight:700;color:#0e1525">Life<span style="color:#5b8cff">OS</span></div>
  <h2 style="font-size:17px;color:#0e1525;margin:16px 0 8px">${esc(title)}</h2>
  <table style="font-size:14px;border-collapse:collapse">${tableRows}</table>
  ${cta ? `<p style="margin-top:18px"><a href="${esc(cta.href)}" style="display:inline-block;background:#2f5fe0;color:#fff;text-decoration:none;padding:10px 16px;border-radius:9px;font-weight:600">${esc(cta.label)}</a></p>` : ''}
  <p style="font-size:12px;color:#7d8799;margin-top:20px">Sent automatically by your LifeOS server.</p></div>`;
}

async function send({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport || !to) return false;
  try {
    const info = await transport.sendMail({ from: config.mail.from || 'LifeOS <no-reply@lifeos.local>', to, subject, text, html });
    if (config.mail.transport === 'console') {
      const msg = JSON.parse(info.message);
      console.log(`[mail] (console) to=${msg.to?.map?.((t) => t.address).join(', ') || to} subject="${msg.subject}"\n${text}\n`);
    } else {
      console.log(`[mail] sent "${subject}" to ${to}`);
    }
    return true;
  } catch (err) {
    console.error(`[mail] could not send "${subject}" to ${to}: ${err.message}`);
    return false;
  }
}

async function adminRecipient() {
  if (config.admin.notifyEmail) return config.admin.notifyEmail;
  const admin = await User.findOne({ role: 'admin' }, { email: 1 }).lean();
  return admin?.email || null;
}

/** Tell the administrator about a new registration request. */
export async function notifyAdminOfRegistration(user) {
  if (!mailEnabled()) return false;
  const to = await adminRecipient();
  if (!to) {
    console.warn('[mail] new registration, but no admin email is configured (ADMIN_EMAIL / ADMIN_NOTIFY_EMAIL).');
    return false;
  }
  const rows = [
    ['Email', user.email],
    ['Registered', fmt(user.createdAt)],
    ['Status', 'Pending approval'],
    ['Role requested', 'User'],
    ['Request ID', String(user._id)],
  ];
  const href = `${config.appUrl}/admin`;
  return send({
    to,
    subject: `LifeOS: new registration request from ${user.email}`,
    text: `A new LifeOS account is waiting for approval.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nReview it in the Admin Dashboard: ${href}`,
    html: layout('New registration request', rows, { href, label: 'Review in Admin Dashboard' }),
  });
}

/** Tell a user their registration was approved or rejected. */
export async function notifyUserOfDecision(user, status) {
  if (!mailEnabled() || !config.mail.notifyUsers) return false;
  const approved = status === 'active';
  const rows = [
    ['Account', user.email],
    ['Status', approved ? 'Approved — active' : 'Not approved'],
    ['Updated', fmt(new Date())],
  ];
  return send({
    to: user.email,
    subject: approved ? 'Your LifeOS account is ready' : 'Your LifeOS registration request',
    text: approved
      ? `Good news — your LifeOS account (${user.email}) has been approved. You can sign in now: ${config.appUrl}`
      : `Your LifeOS registration request for ${user.email} was not approved, so the account can't sign in. Contact the administrator if you think this is a mistake.`,
    html: layout(approved ? 'Your account has been approved' : 'Registration not approved', rows, approved ? { href: config.appUrl, label: 'Sign in to LifeOS' } : null),
  });
}
