import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { ToneIcon, toneColor } from '../ui/Indicators.jsx';

const DISMISSED_KEY = 'lifeos.dismissed';
const SHOWN_KEY = 'lifeos.notified';

const readSet = (key) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
};
const writeSet = (key, set) => {
  try {
    localStorage.setItem(key, JSON.stringify([...set].slice(-400)));
  } catch {
    /* ignore */
  }
};

export function NotificationCenter() {
  const { analysis, profile, user } = useData();
  const DISMISSED = `${DISMISSED_KEY}.${user?.id || 'device'}`;
  const SHOWN = `${SHOWN_KEY}.${user?.id || 'device'}`;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => readSet(DISMISSED));
  const ref = useRef(null);

  const items = useMemo(() => (analysis?.notifications || []).filter((n) => !dismissed.has(n.id)), [analysis, dismissed]);

  // Optional browser notifications (user opts in from Settings), shown once per reminder.
  useEffect(() => {
    if (!profile.notifications?.browser || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const shown = readSet(SHOWN);
    const fresh = items.filter((n) => !shown.has(n.id) && (n.severity === 'critical' || n.severity === 'warning'));
    for (const n of fresh.slice(0, 3)) {
      try {
        new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' });
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
      shown.add(n.id);
    }
    if (fresh.length) writeSet(SHOWN, shown);
  }, [items, profile.notifications?.browser, SHOWN]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const dismiss = (ids) => {
    const next = new Set(dismissed);
    ids.forEach((id) => next.add(id));
    setDismissed(next);
    writeSet(DISMISSED, next);
  };

  const urgent = items.filter((n) => n.severity !== 'info').length;

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="icon-btn" aria-label={`Notifications (${items.length})`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {items.length > 0 && <span className="dot">{urgent || items.length}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <h3>Reminders</h3>
            <div className="row-sm">
              {items.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismiss(items.map((n) => n.id))}>
                  <CheckCheck size={14} /> Clear all
                </button>
              )}
              <button type="button" className="icon-btn sm" aria-label="Notification settings" onClick={() => { setOpen(false); navigate('/settings?tab=notifications'); }}>
                <Settings size={15} />
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto', padding: '6px 8px' }}>
            {items.length === 0 && <div className="empty small">You’re all caught up.</div>}
            {items.map((n) => (
              <div key={n.id} className="row row-top" style={{ padding: '9px 6px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: toneColor(n.severity), marginTop: 2 }}>
                  <ToneIcon tone={n.severity} size={15} />
                </span>
                <button
                  type="button"
                  className="grow"
                  style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }}
                  onClick={() => {
                    setOpen(false);
                    navigate(n.to);
                  }}
                >
                  <div className="strong small">{n.title}</div>
                  <div className="tiny muted">{n.body}</div>
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismiss([n.id])} aria-label={`Dismiss ${n.title}`}>
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
