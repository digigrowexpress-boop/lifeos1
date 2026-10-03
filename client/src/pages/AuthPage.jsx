import { useState } from 'react';
import { Activity, Brain, CheckCircle2, Clock, Crosshair, GraduationCap, HardDrive, Lock, MailCheck, OctagonAlert, Orbit, ShieldCheck } from 'lucide-react';
import { useSession } from '../store/session.jsx';
import { TextField } from '../components/ui/Fields.jsx';
import { Callout } from '../components/ui/Card.jsx';
import { BrandMark, BrandWordmark } from '../components/layout/Brand.jsx';
import { Segmented } from '../components/ui/Fields.jsx';

const FEATURES = [
  [GraduationCap, 'SGPA & CGPA that follow your university’s own grading rules'],
  [Crosshair, 'Target calculator and what-if simulator for every remaining assessment'],
  [Brain, 'Insights and an optional AI coach that tell you what to focus on — based on your data'],
  [Activity, 'Study, attendance, goals, GATE prep and lifestyle in one place'],
  [Orbit, 'An interactive 3D map of every area of your life'],
];

/** How each sign-in problem is shown. Messages come from the server; tone + icon come from here. */
const ERROR_STYLE = {
  ACCOUNT_PENDING: { tone: 'warning', icon: Clock, title: 'Waiting for approval' },
  ACCOUNT_REJECTED: { tone: 'critical', icon: OctagonAlert, title: 'Registration not approved' },
  ACCOUNT_SUSPENDED: { tone: 'critical', icon: OctagonAlert, title: 'Account suspended' },
  INVALID_CREDENTIALS: { tone: 'critical', icon: Lock },
  EMAIL_TAKEN: { tone: 'warning', icon: Lock },
  RATE_LIMITED: { tone: 'warning', icon: Clock },
};

function validateSignup({ email, password, confirm }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number in your password.';
  if (password !== confirm) return 'Passwords don’t match.';
  return null;
}

export default function AuthPage() {
  const session = useSession();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { message, code }
  const [registered, setRegistered] = useState(null); // successful registration request
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setRegistered(null);
    session.clearNotice();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    session.clearNotice();
    if (mode === 'register') {
      const problem = validateSignup(form);
      if (problem) return setError({ message: problem });
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await session.login({ email: form.email, password: form.password });
      } else {
        const result = await session.register({ name: form.name, email: form.email, password: form.password });
        setRegistered(result);
        setForm((f) => ({ ...f, password: '', confirm: '' }));
      }
    } catch (err) {
      setError({ message: err.message, code: err.code });
    } finally {
      setBusy(false);
    }
  };

  const startDevice = async () => {
    setBusy(true);
    try {
      await session.startDevice({ name: form.name });
    } catch (err) {
      setError({ message: err.message });
      setBusy(false);
    }
  };

  const errStyle = (error?.code && ERROR_STYLE[error.code]) || { tone: 'critical', icon: Lock };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="row">
          <BrandMark size={40} />
          <div>
            <BrandWordmark size={22} />
            <div className="small muted">Your personal intelligence system</div>
          </div>
        </div>
        <div>
          <h1>Turn your academic and personal data into clear next steps.</h1>
          <p className="text-2 mt" style={{ maxWidth: 520, fontSize: 15 }}>
            Track marks, study, attendance, goals and lifestyle — and see where you stand, where you are slipping and what to do today.
          </p>
          <div className="feature-list">
            {FEATURES.map(([Icon, text]) => (
              <div className="feature" key={text}>
                <Icon size={18} aria-hidden />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="small muted row-sm">
          <ShieldCheck size={14} aria-hidden /> Your data is private to your account — export or delete it any time.
        </div>
      </section>

      <section className="auth-form-wrap">
        <div className="card auth-card">
          {registered ? (
            <div className="stack" role="status">
              <div className="empty-icon" style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--good-soft)', color: 'var(--good)' }}>
                <CheckCircle2 size={22} aria-hidden />
              </div>
              <div>
                <h2 style={{ fontSize: 22 }}>Request received</h2>
                <p className="small text-2 mt-sm">
                  Your registration request for <b>{registered.email}</b> was submitted.
                </p>
              </div>
              <Callout tone="warning" icon={Clock}>
                Your account is <b>pending administrator approval</b>. You can’t sign in until it has been approved.
              </Callout>
              <div className="row-sm small text-2 row-top">
                <MailCheck size={15} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <span>
                  {registered.emailNotifications
                    ? 'We’ll email you as soon as the administrator reviews your request.'
                    : 'Check back later — try signing in once the administrator has approved your account.'}
                </span>
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={() => switchMode('login')}>
                Back to sign in
              </button>
            </div>
          ) : (
            <div className="stack">
              <div>
                <h2 style={{ fontSize: 22 }}>{mode === 'login' ? 'Welcome back' : 'Create your LifeOS'}</h2>
                <p className="small muted mt-sm">
                  {mode === 'login' ? 'Sign in to your LifeOS account.' : 'Request an account — the administrator approves new accounts before first sign-in.'}
                </p>
              </div>
              <Segmented
                label="Account"
                value={mode}
                onChange={switchMode}
                options={[
                  { value: 'login', label: 'Sign in' },
                  { value: 'register', label: 'Create account' },
                ]}
              />
              {session.notice && mode === 'login' && (
                <Callout tone={session.notice.tone} icon={session.notice.tone === 'good' ? CheckCircle2 : session.notice.tone === 'critical' ? OctagonAlert : Clock}>
                  {session.notice.message}
                </Callout>
              )}
              <form className="stack" onSubmit={submit} noValidate>
                {mode === 'register' && <TextField label="Your name (optional)" value={form.name} onChange={set('name')} autoComplete="name" />}
                <TextField label="Email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
                <TextField
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  hint={mode === 'register' ? 'At least 8 characters, with a letter and a number' : undefined}
                />
                {mode === 'register' && (
                  <TextField label="Confirm password" type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
                )}
                {error && (
                  <Callout tone={errStyle.tone} icon={errStyle.icon}>
                    {errStyle.title && <b style={{ display: 'block' }}>{errStyle.title}</b>}
                    {error.message}
                  </Callout>
                )}
                <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Request account'}
                </button>
              </form>
              {session.deviceModeAllowed && (
                <>
                  <div className="row-sm muted small" style={{ justifyContent: 'center' }}>
                    <span style={{ height: 1, flex: 1, background: 'var(--border)' }} /> or <span style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  </div>
                  <button type="button" className="btn btn-block" onClick={startDevice} disabled={busy}>
                    <HardDrive size={15} /> Use on this device without an account
                  </button>
                  <p className="tiny muted center">Device mode keeps data only in this browser. You can export it and import it into an account later.</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
