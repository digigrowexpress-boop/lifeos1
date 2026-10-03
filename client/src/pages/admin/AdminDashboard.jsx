import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, History, KeyRound, Mail, PauseCircle, PlayCircle, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, Users, XCircle } from 'lucide-react';
import { useSession } from '../../store/session.jsx';
import { useConfirm, useToast } from '../../components/ui/Feedback.jsx';
import { Callout, Card, Empty, PageHeader, StatTile, Tabs } from '../../components/ui/Card.jsx';
import { TextField } from '../../components/ui/Fields.jsx';
import { ToneBadge } from '../../components/ui/Indicators.jsx';

const STATUS_META = {
  pending: { label: 'Pending', tone: 'warning' },
  active: { label: 'Active', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'critical' },
  suspended: { label: 'Suspended', tone: 'neutral' },
};

const TABS = [
  { value: 'pending', label: 'Pending requests', icon: Clock },
  { value: 'active', label: 'Active users', icon: UserCheck },
  { value: 'rejected', label: 'Rejected', icon: XCircle },
  { value: 'suspended', label: 'Suspended', icon: PauseCircle },
  { value: 'all', label: 'All users', icon: Users },
  { value: 'history', label: 'Registration history', icon: History },
  { value: 'account', label: 'Admin account', icon: KeyRound },
];

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' };
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

function AdminPassword() {
  const { adapter } = useSession();
  const toast = useToast();
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (v.next.length < 12) return toast('The administrator password needs at least 12 characters.', 'critical');
    if (v.next !== v.confirm) return toast('New passwords don’t match.', 'critical');
    setBusy(true);
    try {
      await adapter.changePassword(v.current, v.next);
      setV({ current: '', next: '', confirm: '' });
      toast('Administrator password changed. Other sessions were signed out.');
    } catch (err) {
      toast(err.message, 'critical');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Administrator password" icon={KeyRound} sub="Changing it signs the administrator out everywhere else.">
      <form className="form-grid" onSubmit={submit} style={{ maxWidth: 640 }}>
        <TextField className="full" label="Current password" type="password" value={v.current} onChange={(x) => setV({ ...v, current: x })} autoComplete="current-password" required />
        <TextField label="New password" type="password" value={v.next} onChange={(x) => setV({ ...v, next: x })} autoComplete="new-password" hint="At least 12 characters, letters and numbers" required />
        <TextField label="Confirm new password" type="password" value={v.confirm} onChange={(x) => setV({ ...v, confirm: x })} autoComplete="new-password" required />
        <div className="full">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminDashboard() {
  const { adapter } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, u, h] = await Promise.all([adapter.admin.summary(), adapter.admin.users('all'), adapter.admin.history()]);
      setSummary(s);
      setUsers(u);
      setHistory(h);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const t = setInterval(load, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(t);
    };
  }, [load]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter((u) => (tab === 'all' || u.status === tab) && (!term || u.email.includes(term) || u.name.toLowerCase().includes(term)));
  }, [users, tab, q]);

  const act = async (u, action) => {
    const prompts = {
      reject: { title: `Reject ${u.email}?`, message: 'The account stays unable to sign in. You can still approve it later.', confirmLabel: 'Reject request', danger: true },
      suspend: { title: `Suspend ${u.email}?`, message: 'They are signed out everywhere immediately and can’t sign in until reactivated. Their LifeOS data is kept.', confirmLabel: 'Suspend account', danger: true },
    };
    if (prompts[action] && !(await confirm(prompts[action]))) return;
    setBusyId(u.id);
    try {
      await adapter.admin.act(u.id, action);
      toast({ approve: `${u.email} approved`, reject: `${u.email} rejected`, suspend: `${u.email} suspended`, reactivate: `${u.email} reactivated` }[action]);
      await load();
    } catch (err) {
      toast(err.message, 'critical');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (u) => {
    const ok = await confirm({
      title: `Delete the request from ${u.email}?`,
      message: 'The registration request is removed permanently. The person can register again later.',
      confirmLabel: 'Delete request',
      danger: true,
    });
    if (!ok) return;
    setBusyId(u.id);
    try {
      await adapter.admin.remove(u.id);
      toast('Registration request deleted');
      await load();
    } catch (err) {
      toast(err.message, 'critical');
    } finally {
      setBusyId(null);
    }
  };

  const counts = summary?.counts || {};
  const tabs = TABS.map((t) => (['pending', 'active', 'rejected', 'suspended'].includes(t.value) ? { ...t, count: counts[t.value] ?? 0 } : t.value === 'all' ? { ...t, count: counts.total ?? 0 } : t));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Accounts & approvals"
        description="Review registration requests and manage who can use LifeOS. Only account details are shown here — never anyone’s personal LifeOS data."
        actions={
          <button type="button" className="btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb">
          <Callout tone="critical" icon={XCircle}>{error}</Callout>
        </div>
      )}
      {summary && !summary.email.enabled && (
        <div className="mb">
          <Callout tone="info" icon={Mail}>
            Email notifications are off. Set the <code className="md-code">SMTP_*</code> environment variables on the server to be emailed about new registration requests.
          </Callout>
        </div>
      )}

      <div className="grid-4 mb">
        <StatTile icon={Clock} label="Pending requests" value={counts.pending ?? '—'} foot={counts.pending ? <ToneBadge tone="warning">Needs review</ToneBadge> : 'All caught up'} />
        <StatTile icon={UserCheck} label="Active users" value={counts.active ?? '—'} />
        <StatTile icon={XCircle} label="Rejected" value={counts.rejected ?? '—'} />
        <StatTile icon={PauseCircle} label="Suspended" value={counts.suspended ?? '—'} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={(v) => { setTab(v); setExpanded(null); }} label="Account lists" />

      {tab === 'account' ? (
        <AdminPassword />
      ) : tab === 'history' ? (
        <Card title="Registration history" icon={History} sub="Every registration and status change, newest first">
          {history.length === 0 ? (
            <Empty icon={History} title="No registrations yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Account</th>
                    <th>Status</th>
                    <th>By</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={`${h.userId}-${i}`}>
                      <td className="small nowrap">{fmtDateTime(h.at)}</td>
                      <td className="small">{h.email}</td>
                      <td><StatusBadge status={h.status} /></td>
                      <td className="small muted">{h.byAdmin ? 'Administrator' : 'User / system'}</td>
                      <td className="small text-2">{h.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card
          title={TABS.find((t) => t.value === tab)?.label}
          icon={tab === 'pending' ? Clock : Users}
          action={
            <div className="row-sm" style={{ position: 'relative' }}>
              <Search size={14} className="muted" style={{ position: 'absolute', left: 10 }} />
              <input className="input sm" style={{ paddingLeft: 30, width: 220 }} placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
            </div>
          }
        >
          {loading && !users.length ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : visible.length === 0 ? (
            <Empty icon={tab === 'pending' ? CheckCircle2 : Users} title={tab === 'pending' ? 'No pending requests' : 'No accounts here'}>
              {tab === 'pending' ? 'New registration requests will appear here.' : q ? 'No accounts match your search.' : null}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table admin-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Last sign-in</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <FragmentRow key={u.id} u={u} busy={busyId === u.id} expanded={expanded === u.id} onToggle={() => setExpanded(expanded === u.id ? null : u.id)} act={act} remove={remove} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <p className="tiny muted mt row-sm">
        <ShieldCheck size={12} /> Passwords are stored only as secure hashes and are never visible here. Status changes take effect immediately — suspended or rejected accounts are signed out at once.
      </p>
    </div>
  );
}

function FragmentRow({ u, busy, expanded, onToggle, act, remove }) {
  return (
    <>
      <tr>
        <td>
          <button type="button" className="admin-account" onClick={onToggle} aria-expanded={expanded}>
            <span className="strong small">{u.email}</span>
            <span className="tiny muted">{u.name || 'No name given'} · {expanded ? 'hide history' : 'show history'}</span>
          </button>
        </td>
        <td className="small nowrap">{fmtDateTime(u.registeredAt)}</td>
        <td><StatusBadge status={u.status} /></td>
        <td className="small" style={{ textTransform: 'capitalize' }}>{u.role}</td>
        <td className="small nowrap muted">{fmtDateTime(u.lastLoginAt)}</td>
        <td className="right">
          <div className="row-sm end wrap">
            {(u.status === 'pending' || u.status === 'rejected') && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(u, 'approve')}>
                <CheckCircle2 size={14} /> Approve
              </button>
            )}
            {u.status === 'pending' && (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(u, 'reject')}>
                <XCircle size={14} /> Reject
              </button>
            )}
            {u.status === 'active' && (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(u, 'suspend')}>
                <PauseCircle size={14} /> Suspend
              </button>
            )}
            {u.status === 'suspended' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(u, 'reactivate')}>
                <PlayCircle size={14} /> Reactivate
              </button>
            )}
            {(u.status === 'pending' || u.status === 'rejected') && (
              <button type="button" className="icon-btn sm danger" disabled={busy} onClick={() => remove(u)} aria-label={`Delete request from ${u.email}`} title="Delete request">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--surface-2)' }}>
            <div className="stack-xs">
              {u.history.length === 0 && <span className="small muted">No history recorded.</span>}
              {[...u.history].reverse().map((h, i) => (
                <div key={i} className="row-sm small wrap">
                  <span className="muted nowrap" style={{ minWidth: 150 }}>{fmtDateTime(h.at)}</span>
                  <StatusBadge status={h.status} />
                  <span className="text-2">{h.note}{h.byAdmin ? ' · by administrator' : ''}</span>
                </div>
              ))}
              {u.approvedAt && <span className="tiny muted">Approved {fmtDateTime(u.approvedAt)}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
