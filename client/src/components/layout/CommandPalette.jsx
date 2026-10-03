import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Plus } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { useQuickForms } from '../../store/quick.jsx';
import { buildSearchIndex, searchIndex, SEARCH_TYPES } from '../../logic/search.js';
import { NAV } from './navigation.js';

const ACTIONS = [
  { label: 'Log study session', kind: 'study' },
  { label: 'Enter marks', kind: 'marks' },
  { label: 'Add assignment / submission', kind: 'assignment' },
  { label: 'Add exam', kind: 'exam' },
  { label: 'Add task', kind: 'task' },
  { label: 'New goal', kind: 'goal' },
  { label: 'Add subject', kind: 'subject' },
  { label: 'Add semester', kind: 'semester' },
];

/** Ctrl/⌘+K: jump to any page, record, or quick action. */
export function CommandPalette({ open, onClose }) {
  const { data, analysis, profile } = useData();
  const navigate = useNavigate();
  const openForm = useQuickForms();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const index = useMemo(() => (open && analysis ? buildSearchIndex(data, analysis, profile) : []), [open, data, analysis, profile]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = NAV.flatMap((g) => g.items)
      .concat([{ to: '/settings', label: 'Settings' }, { to: '/search', label: 'Advanced search' }])
      .filter((p) => !term || p.label.toLowerCase().includes(term))
      .map((p) => ({ key: `page-${p.to}`, group: 'Pages', title: p.label, run: () => navigate(p.to) }));
    const actions = ACTIONS.filter((a) => !term || a.label.toLowerCase().includes(term)).map((a) => ({
      key: `act-${a.kind}`,
      group: 'Quick actions',
      title: a.label,
      icon: Plus,
      run: () => openForm(a.kind),
    }));
    const records = term
      ? searchIndex(index, term)
          .slice(0, 30)
          .map((r) => ({ key: `${r.type}-${r.id}`, group: SEARCH_TYPES[r.type], title: r.title, sub: r.subtitle, run: () => navigate(r.to) }))
      : [];
    return [...(term ? records : []), ...actions.slice(0, term ? 4 : 8), ...pages.slice(0, term ? 6 : 20)];
  }, [q, index, navigate, openForm]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const run = (item) => {
    onClose();
    item.run();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup = null;
  return createPortal(
    <div className="modal-backdrop" style={{ placeItems: 'start center', paddingTop: '10vh' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Search LifeOS" style={{ width: 'min(640px, 100%)' }} onKeyDown={onKey}>
        <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} className="muted" aria-hidden />
          <input
            ref={inputRef}
            className="grow"
            style={{ border: 0, background: 'transparent', outline: 'none', fontSize: 15, height: 32 }}
            placeholder="Search subjects, goals, exams, logs… or type a command"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `pal-${active}` : undefined}
          />
          <kbd className="tiny muted">Esc</kbd>
        </div>
        <div className="modal-body" style={{ padding: 8, maxHeight: '60vh' }} id="palette-results" role="listbox">
          {results.length === 0 && <div className="empty small">No matches for “{q}”.</div>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {header && <div className="nav-section" style={{ padding: '10px 10px 4px' }}>{header}</div>}
                <button
                  type="button"
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="row"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(r)}
                  style={{
                    width: '100%',
                    border: 0,
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: i === active ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {r.icon && <r.icon size={15} className="muted" aria-hidden />}
                  <span className="grow">
                    <span className="truncate" style={{ display: 'block' }}>{r.title}</span>
                    {r.sub && <span className="tiny muted truncate" style={{ display: 'block' }}>{r.sub}</span>}
                  </span>
                  {i === active && <ArrowRight size={14} className="muted" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
