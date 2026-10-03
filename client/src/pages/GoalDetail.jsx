import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Flag, ListChecks, Pause, Pencil, Play, Plus, Save, Target, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { PaceBadge, ProgressBar } from '../components/ui/Indicators.jsx';
import { CommitInput, TextArea } from '../components/ui/Fields.jsx';
import { ExamTracker } from '../components/goals/ExamTracker.jsx';
import { useGoalActions } from '../hooks/useGoalActions.js';
import { GOAL_CATEGORIES, GOAL_METRICS } from '../logic/defaults.js';
import { fmtDuration, fmtNum, fmtPct } from '../lib/format.js';
import { fmtDate, nowISO, relativeDay } from '../lib/dates.js';
import { uid } from '../lib/ids.js';

export default function GoalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, profile, analysis: a, today, update } = useData();
  const openForm = useQuickForms();
  const toast = useToast();
  const act = useGoalActions();
  const [newMs, setNewMs] = useState({ title: '', dueDate: '' });
  const [notes, setNotes] = useState('');
  const p = a.goals.find((x) => x.goal.id === id);
  const goal = p?.goal;
  useEffect(() => setNotes(goal?.notes || ''), [goal?.id, goal?.notes]);

  if (!p) return <Empty icon={Target} title="Goal not found" action={<Link to="/goals" className="btn">Back to goals</Link>} />;

  const fmt = (m) => fmtDuration(m, profile.preferences.timeFormat);
  const ms = goal.milestones || [];
  const tasks = data.tasks.filter((t) => t.goalId === goal.id);
  const sessions = data.studySessions.filter((s) => s.goalId === goal.id).sort((x, y) => y.date.localeCompare(x.date));
  const exams = data.exams.filter((e) => e.goalId === goal.id);

  const saveMilestones = (list) => update('goals', goal.id, { milestones: list });
  const toggleMs = (m) => saveMilestones(ms.map((x) => (x.id === m.id ? { ...x, done: !x.done, doneAt: !x.done ? nowISO() : null } : x)));

  return (
    <div>
      <Link to="/goals" className="small row-sm mb" style={{ display: 'inline-flex' }}>
        <ArrowLeft size={14} /> Goals
      </Link>
      <PageHeader
        eyebrow={`${GOAL_CATEGORIES.find((c) => c.value === goal.category)?.label || goal.category} · ${goal.priority} priority · ${goal.status}`}
        title={goal.title}
        description={goal.description}
        actions={
          <>
            {goal.status === 'active' && <button type="button" className="btn" onClick={() => act.pause(goal)}><Pause size={14} /> Pause</button>}
            {goal.status === 'paused' && <button type="button" className="btn" onClick={() => act.resume(goal)}><Play size={14} /> Resume</button>}
            {goal.status === 'active' && <button type="button" className="btn" onClick={() => act.complete(goal)}><CheckCircle2 size={14} /> Complete</button>}
            {goal.status === 'archived' || goal.status === 'completed' ? (
              <button type="button" className="btn" onClick={() => act.reopen(goal)}><ArchiveRestore size={14} /> Reopen</button>
            ) : (
              <button type="button" className="btn" onClick={() => act.archive(goal)}><Archive size={14} /> Archive</button>
            )}
            <button type="button" className="btn" onClick={() => openForm('goal', { goal })}><Pencil size={14} /> Edit</button>
            <button type="button" className="btn btn-danger" onClick={async () => { if (await act.del(goal)) navigate('/goals'); }}><Trash2 size={14} /> Delete</button>
          </>
        }
      />

      <div className="grid-4 mb">
        <StatTile label="Progress" value={fmtPct(p.percent)} foot={<><PaceBadge pace={p.pace} />{p.expected != null && <span>expected {fmtPct(p.expected)}</span>}</>} />
        <StatTile label="Measured by" value={GOAL_METRICS.find((m) => m.value === p.type)?.label} foot={p.type === 'exam-prep' ? 'syllabus coverage' : `${fmtNum(p.current, 2)} of ${fmtNum(p.target, 2)} ${p.unit}`} />
        <StatTile label="Time left" value={p.daysLeft != null ? (p.daysLeft >= 0 ? `${p.daysLeft} days` : 'Overdue') : '—'} foot={goal.targetDate ? `Target ${fmtDate(goal.targetDate)}` : 'No target date'} />
        <StatTile label="Completion likelihood" value={p.likelihood ? p.likelihood[0].toUpperCase() + p.likelihood.slice(1) : '—'} foot={p.projectedPercent != null ? `Estimate: ~${Math.round(p.projectedPercent)}% by target date at current pace` : 'Needs dates and some progress'} />
      </div>

      <Card className="mb">
        <div className="row between small mb" style={{ marginBottom: 8 }}>
          <span className="text-2">{goal.startDate ? `Started ${fmtDate(goal.startDate)}` : ''}</span>
          <span className="text-2">{p.expected != null ? 'Marker shows where you should be by now' : ''}</span>
        </div>
        <ProgressBar value={p.percent} marker={p.expected} size="thick" tone={['at-risk', 'overdue'].includes(p.pace) ? 'critical' : p.pace === 'behind' ? 'warning' : undefined} label="Goal progress" />
        {p.type === 'manual' && goal.status === 'active' && (
          <div className="row-sm mt wrap">
            <span className="small text-2">Update current value:</span>
            <CommitInput className="input sm" type="number" step="any" style={{ width: 120 }} aria-label="Current value" value={goal.metric?.current} onCommit={(v) => update('goals', goal.id, { metric: { ...goal.metric, current: v ?? 0 } })} />
            <span className="small muted">/ {goal.metric?.target} {goal.metric?.unit}</span>
          </div>
        )}
        {(p.weeklyTargetMin > 0 || p.studyMin > 0) && (
          <div className="small text-2 mt">
            Study linked to this goal: <b>{fmt(p.studyMin)}</b> total · <b>{fmt(p.weekStudyMin)}</b> in the last 7 days{p.weeklyTargetMin ? ` (target ${fmt(p.weeklyTargetMin)}/week)` : ''}
          </div>
        )}
      </Card>

      {goal.exam && (
        <div className="mb">
          <ExamTracker progress={p} />
        </div>
      )}

      <div className="grid-3">
        <Card title="Milestones" icon={Flag} sub={ms.length ? `${ms.filter((m) => m.done).length}/${ms.length} done` : undefined}>
          {ms.length === 0 && <div className="small muted mb">Break the goal into checkpoints.</div>}
          <div className="list">
            {[...ms].sort((x, y) => Number(x.done) - Number(y.done) || String(x.dueDate || '9999').localeCompare(String(y.dueDate || '9999'))).map((m) => (
              <div key={m.id} className="list-item">
                <button type="button" className="icon-btn sm" aria-label={m.done ? `Mark ${m.title} not done` : `Mark ${m.title} done`} onClick={() => toggleMs(m)}>
                  {m.done ? <CheckCircle2 size={18} style={{ color: 'var(--good)' }} /> : <Circle size={18} />}
                </button>
                <div className="li-main">
                  <CommitInput className="input sm" style={{ border: 0, background: 'transparent', paddingLeft: 0, textDecoration: m.done ? 'line-through' : 'none' }} aria-label="Milestone title" value={m.title} onCommit={(v) => v.trim() && saveMilestones(ms.map((x) => (x.id === m.id ? { ...x, title: v.trim() } : x)))} />
                  <div className="li-sub">
                    {m.done && m.doneAt ? `Done ${fmtDate(m.doneAt.slice(0, 10))}` : m.dueDate ? (
                      <span style={{ color: m.dueDate < today ? 'var(--critical)' : undefined }}>Due {relativeDay(m.dueDate, today)}</span>
                    ) : 'No due date'}
                  </div>
                </div>
                <input className="input sm" type="date" style={{ width: 132 }} aria-label="Due date" value={m.dueDate || ''} onChange={(e) => saveMilestones(ms.map((x) => (x.id === m.id ? { ...x, dueDate: e.target.value || null } : x)))} />
                <button type="button" className="icon-btn sm danger" aria-label="Delete milestone" onClick={() => saveMilestones(ms.filter((x) => x.id !== m.id))}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <form
            className="row-sm mt wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newMs.title.trim()) return;
              saveMilestones([...ms, { id: uid('m_'), title: newMs.title.trim(), dueDate: newMs.dueDate || null, done: false, doneAt: null }]);
              setNewMs({ title: '', dueDate: '' });
            }}
          >
            <input className="input sm grow" style={{ minWidth: 140 }} placeholder="New milestone" value={newMs.title} onChange={(e) => setNewMs({ ...newMs, title: e.target.value })} aria-label="New milestone" />
            <input className="input sm" type="date" style={{ width: 132 }} value={newMs.dueDate} onChange={(e) => setNewMs({ ...newMs, dueDate: e.target.value })} aria-label="Milestone due date" />
            <button type="submit" className="btn btn-sm"><Plus size={13} /></button>
          </form>
        </Card>

        <Card title="Tasks" icon={ListChecks} action={<button type="button" className="btn btn-sm" onClick={() => openForm('task', { defaults: { goalId: goal.id } })}><Plus size={13} /> Task</button>}>
          {tasks.length === 0 ? (
            <div className="small muted">No tasks linked yet.</div>
          ) : (
            <div className="list">
              {tasks.sort((x, y) => String(x.dueDate || '9999').localeCompare(String(y.dueDate || '9999'))).map((t) => (
                <div key={t.id} className="list-item">
                  <button type="button" className="icon-btn sm" aria-label="Toggle task" onClick={() => update('tasks', t.id, t.status === 'done' ? { status: 'todo', completedAt: null } : { status: 'done', completedAt: today })}>
                    {t.status === 'done' ? <CheckCircle2 size={17} style={{ color: 'var(--good)' }} /> : <Circle size={17} />}
                  </button>
                  <div className="li-main">
                    <div className="li-title small" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
                    <div className="li-sub">{t.dueDate ? relativeDay(t.dueDate, today) : 'No date'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Study sessions" icon={BookOpen} action={<button type="button" className="btn btn-sm" onClick={() => openForm('study', { defaults: { goalId: goal.id } })}><Plus size={13} /> Log</button>}>
          {sessions.length === 0 ? (
            <div className="small muted">Link study sessions to this goal to track its hours.</div>
          ) : (
            <div className="list">
              {sessions.slice(0, 8).map((s) => (
                <div key={s.id} className="list-item">
                  <div className="li-main">
                    <div className="li-title small">{s.topic || goal.exam?.subjects?.find((x) => x.id === s.examSubjectId)?.name || s.type}</div>
                    <div className="li-sub">{fmtDate(s.date, 'EEE d MMM')} · {s.type}</div>
                  </div>
                  <b className="small">{fmt(s.durationMin)}</b>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2 mt">
        <Card title="Related">
          <div className="stack-sm small">
            <div>
              <span className="text-2">Subjects: </span>
              {(goal.relatedSubjectIds || []).length ? goal.relatedSubjectIds.map((sid) => a.subjectById[sid]).filter(Boolean).map((s, i) => (
                <span key={s.id}>{i ? ', ' : ''}<Link to={`/academics/subjects/${s.id}`}>{s.name}</Link></span>
              )) : <span className="muted">none</span>}
            </div>
            <div>
              <span className="text-2">Exams / mocks: </span>
              {exams.length ? exams.map((e) => e.title).join(', ') : <span className="muted">none</span>}
            </div>
          </div>
        </Card>
        <Card title="Notes">
          <TextArea value={notes} onChange={setNotes} rows={4} aria-label="Goal notes" placeholder="Strategy, resources, reflections…" />
          <div className="row end mt-sm">
            <button type="button" className="btn btn-sm" disabled={notes === (goal.notes || '')} onClick={async () => { await update('goals', goal.id, { notes }); toast('Notes saved'); }}>
              <Save size={14} /> Save notes
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
