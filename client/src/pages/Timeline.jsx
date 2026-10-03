import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BookOpen, ClipboardCheck, Flag, GraduationCap, History, NotebookPen, PenLine, Search, Trophy } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Card, Empty, PageHeader } from '../components/ui/Card.jsx';
import { buildTimeline, TIMELINE_TYPES } from '../logic/timeline.js';
import { fmtDate, fmtMonth } from '../lib/dates.js';
import { groupBy } from '../lib/format.js';

const ICONS = { result: GraduationCap, marks: PenLine, goal: Flag, study: BookOpen, submission: ClipboardCheck, exam: PenLine, log: NotebookPen, achievement: Trophy };
const TONES = { result: 'var(--series-1)', marks: 'var(--series-7)', goal: 'var(--series-2)', study: 'var(--series-3)', submission: 'var(--series-4)', exam: 'var(--series-5)', log: 'var(--muted)', achievement: 'var(--warning)' };

export default function Timeline() {
  const { data, profile, analysis: a } = useData();
  const all = useMemo(() => buildTimeline(a, data, profile), [a, data, profile]);
  const [types, setTypes] = useState(() => new Set(Object.keys(TIMELINE_TYPES).filter((t) => t !== 'log')));
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const [limit, setLimit] = useState(120);

  const years = [...new Set(all.map((x) => x.date.slice(0, 4)))].sort().reverse();
  const filtered = all.filter((x) => types.has(x.type) && (!year || x.date.startsWith(year)) && (!q || `${x.title} ${x.detail || ''}`.toLowerCase().includes(q.toLowerCase())));
  const months = Object.entries(groupBy(filtered.slice(0, limit), (x) => x.date.slice(0, 7)));

  const toggle = (t) =>
    setTypes((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  return (
    <div>
      <PageHeader eyebrow="History" title="Timeline" description="Your progress over months and years — results, marks, goals, study, submissions, exams, logs and achievements." />
      <div className="grid-3">
        <div className="span-2">
          <Card>
            <div className="row wrap between mb">
              <div className="chips">
                {Object.entries(TIMELINE_TYPES).map(([k, t]) => (
                  <button key={k} type="button" className="chip" aria-pressed={types.has(k)} onClick={() => toggle(k)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="row-sm">
                <div style={{ position: 'relative' }}>
                  <Search size={14} className="muted" style={{ position: 'absolute', left: 10, top: 9 }} />
                  <input className="input sm" style={{ paddingLeft: 30, width: 170 }} placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter timeline" />
                </div>
                <select className="select sm" style={{ width: 100 }} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                  <option value="">All years</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {filtered.length === 0 ? (
              <Empty icon={History} title="Nothing in your timeline yet">As you study, enter marks, finish goals and log days, your history builds here.</Empty>
            ) : (
              <div className="timeline">
                {months.map(([m, items]) => (
                  <div key={m}>
                    <div className="tl-month">{fmtMonth(m)}</div>
                    {items.map((x) => {
                      const Icon = ICONS[x.type] || History;
                      const body = (
                        <>
                          <div className="row-sm small">
                            <Icon size={14} style={{ color: TONES[x.type] }} aria-hidden />
                            <span className="strong">{x.title}</span>
                          </div>
                          <div className="tiny muted">
                            {fmtDate(x.date, 'EEE d MMM yyyy')}
                            {x.detail ? ` · ${x.detail}` : ''}
                          </div>
                        </>
                      );
                      return (
                        <div key={x.id} className="tl-item" style={{ '--tone': TONES[x.type] }}>
                          {x.to ? <Link to={x.to} style={{ color: 'var(--text)', display: 'block' }}>{body}</Link> : body}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {filtered.length > limit && (
                  <button type="button" className="btn btn-sm mt" onClick={() => setLimit(limit + 150)}>
                    Show older ({filtered.length - limit} more)
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>
        <div className="stack">
          <Card title="Achievements" icon={Award} sub={`${a.achievements.earned.length} of ${a.achievements.all.length} earned`}>
            <div className="list">
              {a.achievements.earned.map((x) => (
                <div key={x.id} className="list-item">
                  <span className="list-icon" style={{ '--tone': 'var(--warning)' }}><Trophy size={15} /></span>
                  <div className="li-main">
                    <div className="li-title small">{x.title}</div>
                    <div className="li-sub">{x.detail} · {fmtDate(x.date)}</div>
                  </div>
                </div>
              ))}
            </div>
            {a.achievements.upcoming.length > 0 && (
              <>
                <div className="field-label mt">Next up</div>
                <div className="list">
                  {a.achievements.upcoming.slice(0, 5).map((x) => (
                    <div key={x.id} className="list-item" style={{ opacity: 0.6 }}>
                      <span className="list-icon" style={{ '--tone': 'var(--muted)' }}><Trophy size={15} /></span>
                      <div className="li-main">
                        <div className="li-title small">{x.title}</div>
                        <div className="li-sub">{x.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Card title="By the numbers">
            <dl className="kv">
              <dt>Semesters</dt><dd>{data.semesters.length}</dd>
              <dt>Subjects</dt><dd>{data.subjects.length}</dd>
              <dt>Study sessions</dt><dd>{data.studySessions.length}</dd>
              <dt>Days logged</dt><dd>{data.dailyLogs.length}</dd>
              <dt>Lectures recorded</dt><dd>{data.attendance.length}</dd>
              <dt>Goals completed</dt><dd>{data.goals.filter((g) => g.status === 'completed').length}</dd>
              <dt>Submissions</dt><dd>{data.assignments.filter((x) => x.status === 'submitted' || x.status === 'late').length}</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
