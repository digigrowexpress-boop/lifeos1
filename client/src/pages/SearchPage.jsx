import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Card, Empty, PageHeader } from '../components/ui/Card.jsx';
import { buildSearchIndex, searchIndex, SEARCH_TYPES } from '../logic/search.js';
import { GOAL_CATEGORIES, EXAM_TYPES, STUDY_TYPES } from '../logic/defaults.js';
import { compareSemesters } from '../logic/academics.js';
import { fmtDate } from '../lib/dates.js';

const STATUSES = ['upcoming', 'ongoing', 'completed', 'active', 'paused', 'archived', 'todo', 'in-progress', 'done', 'skipped', 'not-started', 'submitted', 'late', 'missed', 'result', 'present', 'absent', 'cancelled'];

export default function SearchPage() {
  const { data, profile, analysis: a } = useData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [f, setF] = useState({ type: '', semesterId: '', subjectId: '', goalId: '', status: '', category: '', from: '', to: '' });
  const index = useMemo(() => buildSearchIndex(data, a, profile), [data, a, profile]);
  const active = q.trim() || Object.values(f).some(Boolean);
  const results = useMemo(() => (active ? searchIndex(index, q, f) : []), [index, q, f, active]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const grouped = Object.entries(results.reduce((acc, r) => ((acc[r.type] ||= []).push(r), acc), {}));
  const categories = [...new Set([...GOAL_CATEGORIES.map((c) => c.value), ...EXAM_TYPES.map((c) => c.value), ...STUDY_TYPES, ...data.subjects.map((s) => s.category).filter(Boolean)])];

  return (
    <div>
      <PageHeader eyebrow="Search" title="Search everything" description="Subjects, semesters, goals, tasks, assignments, exams, study sessions, daily logs and lecture notes." />
      <Card className="mb">
        <div className="stack">
          <div className="row" style={{ position: 'relative' }}>
            <Search size={16} className="muted" style={{ position: 'absolute', left: 12 }} />
            <input
              className="input"
              style={{ paddingLeft: 38, height: 44, fontSize: 15 }}
              autoFocus
              placeholder="Type to search…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
              }}
              aria-label="Search"
            />
          </div>
          <div className="grid-4" style={{ gap: 10 }}>
            <select className="select sm" value={f.type} onChange={set('type')} aria-label="Type">
              <option value="">All types</option>
              {Object.entries(SEARCH_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className="select sm" value={f.semesterId} onChange={set('semesterId')} aria-label="Semester">
              <option value="">Any semester</option>
              {[...data.semesters].sort(compareSemesters).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="select sm" value={f.subjectId} onChange={set('subjectId')} aria-label="Subject">
              <option value="">Any subject</option>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>)}
            </select>
            <select className="select sm" value={f.goalId} onChange={set('goalId')} aria-label="Goal">
              <option value="">Any goal</option>
              {data.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <select className="select sm" value={f.status} onChange={set('status')} aria-label="Status">
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
            </select>
            <select className="select sm" value={f.category} onChange={set('category')} aria-label="Category">
              <option value="">Any category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input sm" type="date" value={f.from} onChange={set('from')} aria-label="From date" />
            <input className="input sm" type="date" value={f.to} onChange={set('to')} aria-label="To date" />
          </div>
          {Object.values(f).some(Boolean) && (
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ type: '', semesterId: '', subjectId: '', goalId: '', status: '', category: '', from: '', to: '' })}>
                <X size={14} /> Clear filters
              </button>
            </div>
          )}
        </div>
      </Card>
      {!active ? (
        <Card><Empty icon={Search} title="Start typing or pick a filter" /></Card>
      ) : results.length === 0 ? (
        <Card><Empty icon={Search} title="No results">Try fewer words or remove a filter.</Empty></Card>
      ) : (
        <div className="stack">
          <div className="small muted">{results.length} result{results.length === 1 ? '' : 's'}</div>
          {grouped.map(([type, items]) => (
            <Card key={type} title={SEARCH_TYPES[type]} sub={`${items.length} match${items.length === 1 ? '' : 'es'}`}>
              <div className="list">
                {items.slice(0, 50).map((r) => (
                  <Link key={r.id} to={r.to} className="list-item" style={{ color: 'var(--text)' }}>
                    <div className="li-main">
                      <div className="li-title small">{r.title}</div>
                      <div className="li-sub">{r.subtitle}</div>
                    </div>
                    {r.date && <span className="tiny muted nowrap">{fmtDate(r.date)}</span>}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
