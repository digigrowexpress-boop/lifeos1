import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckCircle2, Pause, Pencil, Play, Plus, Target, Trash2, ArchiveRestore } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useGoalActions } from '../hooks/useGoalActions.js';
import { Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { PaceBadge, ProgressBar } from '../components/ui/Indicators.jsx';
import { GOAL_CATEGORIES } from '../logic/defaults.js';
import { fmtDate } from '../lib/dates.js';
import { fmtNum, fmtPct } from '../lib/format.js';

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

export default function Goals() {
  const { data, analysis: a } = useData();
  const openForm = useQuickForms();
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');
  const act = useGoalActions();

  const list = a.goals
    .filter((g) => status === 'all' || g.goal.status === status)
    .filter((g) => !category || g.goal.category === category)
    .sort((x, y) => {
      const pr = { critical: 0, high: 1, medium: 2, low: 3 };
      return pr[x.goal.priority] - pr[y.goal.priority] || String(x.goal.targetDate || '9999').localeCompare(String(y.goal.targetDate || '9999'));
    });

  const o = a.goalsOverview;
  return (
    <div>
      <PageHeader
        eyebrow="Goals"
        title="Goals"
        description="Long-term goals with milestones, linked study and honest pacing. Likelihoods are estimates from your recent pace."
        actions={<button type="button" className="btn btn-primary" onClick={() => openForm('goal')}><Plus size={15} /> New goal</button>}
      />
      <div className="grid-4 mb">
        <StatTile label="Active goals" value={o.active} />
        <StatTile label="Average completion" value={fmtPct(o.avgPercent)} foot="across active goals" />
        <StatTile label="Behind schedule" value={o.behind} foot={o.behind ? 'see insights' : 'all on pace'} />
        <StatTile label="Completed" value={o.completed} />
      </div>
      <div className="row between wrap mb">
        <div className="chips">
          {STATUS_TABS.map((t) => (
            <button key={t.value} type="button" className="chip" aria-pressed={status === t.value} onClick={() => setStatus(t.value)}>
              {t.label} <span className="muted">{t.value === 'all' ? data.goals.length : data.goals.filter((g) => g.status === t.value).length}</span>
            </button>
          ))}
        </div>
        <select className="select sm" style={{ width: 180 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {GOAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon={Target} title="No goals here" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => openForm('goal')}><Plus size={14} /> New goal</button>}>
            Try “GATE 2027”, “CGPA 8.5”, “Complete DSA” or “Finish a course”.
          </Empty>
        </Card>
      ) : (
        <div className="grid-auto">
          {list.map((p) => {
            const g = p.goal;
            return (
              <Card key={g.id}>
                <div className="row between row-top">
                  <div className="grow">
                    <div className="tiny muted">
                      {GOAL_CATEGORIES.find((c) => c.value === g.category)?.label || g.category} · {g.priority} priority
                    </div>
                    <Link to={`/goals/${g.id}`} className="strong" style={{ fontSize: 15, color: 'var(--text)' }}>{g.title}</Link>
                  </div>
                  <PaceBadge pace={p.pace} />
                </div>
                <div className="mt">
                  <div className="row between small mb" style={{ marginBottom: 6 }}>
                    <span className="text-2">
                      {p.type === 'manual' || p.type === 'study-hours' || p.type === 'cgpa' || p.type === 'sgpa' ? `${fmtNum(p.current, 2)} / ${fmtNum(p.target, 2)} ${p.unit}` : p.type === 'milestones' || p.type === 'tasks' ? `${p.current}/${p.target} ${p.unit}` : `${fmtNum(p.current)}% syllabus`}
                    </span>
                    <b>{Math.round(p.percent)}%</b>
                  </div>
                  <ProgressBar value={p.percent} marker={p.expected} tone={['at-risk', 'overdue'].includes(p.pace) ? 'critical' : p.pace === 'behind' ? 'warning' : undefined} label={`${g.title} progress`} />
                  <div className="tiny muted mt-sm row between">
                    <span>{g.targetDate ? `Target ${fmtDate(g.targetDate)}${p.daysLeft != null && p.daysLeft >= 0 ? ` · ${p.daysLeft}d left` : ''}` : 'No target date'}</span>
                    {p.likelihood && <span>Likelihood {p.likelihood} (est.)</span>}
                  </div>
                  {p.nextMilestone && <div className="small mt-sm">Next: {p.nextMilestone.title}{p.nextMilestone.dueDate ? ` · ${fmtDate(p.nextMilestone.dueDate, 'd MMM')}` : ''}</div>}
                </div>
                <div className="row-sm mt wrap">
                  <Link to={`/goals/${g.id}`} className="btn btn-sm grow">Open</Link>
                  {g.status === 'active' && <button type="button" className="icon-btn sm" title="Mark complete" aria-label="Mark complete" onClick={() => act.complete(g)}><CheckCircle2 size={15} /></button>}
                  {g.status === 'active' && <button type="button" className="icon-btn sm" title="Pause" aria-label="Pause" onClick={() => act.pause(g)}><Pause size={15} /></button>}
                  {g.status === 'paused' && <button type="button" className="icon-btn sm" title="Resume" aria-label="Resume" onClick={() => act.resume(g)}><Play size={15} /></button>}
                  {(g.status === 'completed' || g.status === 'archived') && <button type="button" className="icon-btn sm" title="Reopen" aria-label="Reopen" onClick={() => act.reopen(g)}><ArchiveRestore size={15} /></button>}
                  {g.status !== 'archived' && <button type="button" className="icon-btn sm" title="Archive" aria-label="Archive" onClick={() => act.archive(g)}><Archive size={15} /></button>}
                  <button type="button" className="icon-btn sm" title="Edit" aria-label="Edit" onClick={() => openForm('goal', { goal: g })}><Pencil size={15} /></button>
                  <button type="button" className="icon-btn sm danger" title="Delete" aria-label="Delete" onClick={() => act.del(g)}><Trash2 size={15} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
