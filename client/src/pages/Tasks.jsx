import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, ListChecks, Pencil, Plus, Trash2, SkipForward } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { addDaysISO, relativeDay, subDaysISO } from '../lib/dates.js';
import { fmtPct } from '../lib/format.js';

const GROUPS = [
  ['overdue', 'Overdue'],
  ['today', 'Today'],
  ['week', 'Next 7 days'],
  ['later', 'Later / no date'],
];

export default function Tasks() {
  const { data, analysis: a, today, create, update, remove } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const [quick, setQuick] = useState('');
  const [show, setShow] = useState('open');

  const open = data.tasks.filter((t) => t.status === 'todo' || t.status === 'in-progress');
  const recent = data.tasks.filter((t) => t.completedAt && t.completedAt >= subDaysISO(today, 6));
  const done14 = data.tasks.filter((t) => t.status === 'done' && t.completedAt >= subDaysISO(today, 13)).length;
  const skipped = data.tasks.filter((t) => t.status === 'skipped').length;

  const grouped = useMemo(() => {
    const g = { overdue: [], today: [], week: [], later: [] };
    for (const t of open) {
      if (t.dueDate && t.dueDate < today) g.overdue.push(t);
      else if (t.dueDate === today) g.today.push(t);
      else if (t.dueDate && t.dueDate <= addDaysISO(today, 7)) g.week.push(t);
      else g.later.push(t);
    }
    const prio = { high: 0, medium: 1, low: 2 };
    Object.values(g).forEach((l) => l.sort((x, y) => String(x.dueDate || '9999').localeCompare(String(y.dueDate || '9999')) || prio[x.priority] - prio[y.priority]));
    return g;
  }, [open, today]);

  const toggle = (t) => update('tasks', t.id, t.status === 'done' ? { status: 'todo', completedAt: null } : { status: 'done', completedAt: today });

  const addQuick = async (e) => {
    e.preventDefault();
    if (!quick.trim()) return;
    await create('tasks', { title: quick.trim(), dueDate: today, priority: 'medium', status: 'todo', goalId: null, subjectId: null, notes: '', completedAt: null });
    setQuick('');
  };

  const Row = ({ t }) => (
    <div className="list-item">
      <button type="button" className="icon-btn sm" aria-label={t.status === 'done' ? `Mark ${t.title} not done` : `Mark ${t.title} done`} onClick={() => toggle(t)}>
        {t.status === 'done' ? <CheckCircle2 size={18} style={{ color: 'var(--good)' }} /> : <Circle size={18} />}
      </button>
      <div className="li-main">
        <div className="li-title small" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' || t.status === 'skipped' ? 0.6 : 1 }}>
          {t.title}
        </div>
        <div className="li-sub">
          {[t.dueDate && relativeDay(t.dueDate, today), t.priority !== 'medium' && `${t.priority} priority`, a.subjectById[t.subjectId]?.code || a.subjectById[t.subjectId]?.name, data.goals.find((g) => g.id === t.goalId)?.title, t.status === 'skipped' && 'skipped'].filter(Boolean).join(' · ')}
        </div>
      </div>
      {(t.status === 'todo' || t.status === 'in-progress') && (
        <button type="button" className="icon-btn sm" aria-label={`Skip ${t.title}`} title="Skip" onClick={() => update('tasks', t.id, { status: 'skipped', completedAt: today })}>
          <SkipForward size={14} />
        </button>
      )}
      <button type="button" className="icon-btn sm" aria-label={`Edit ${t.title}`} onClick={() => openForm('task', { task: t })}><Pencil size={14} /></button>
      <button type="button" className="icon-btn sm danger" aria-label={`Delete ${t.title}`} onClick={async () => { if (await confirm({ title: `Delete “${t.title}”?`, confirmLabel: 'Delete', danger: true })) { await remove('tasks', t.id); toast('Task deleted'); } }}><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title="Tasks"
        description="Small, concrete actions — link them to goals or subjects to see them in context."
        actions={<button type="button" className="btn btn-primary" onClick={() => openForm('task')}><Plus size={15} /> Add task</button>}
      />
      <div className="grid-4 mb">
        <StatTile label="Open" value={open.length} foot={`${grouped.overdue.length} overdue`} />
        <StatTile label="Due today" value={grouped.today.length} />
        <StatTile label="Done (14 days)" value={done14} />
        <StatTile label="Completion rate" value={done14 + open.length ? fmtPct((done14 / (done14 + open.length)) * 100) : '—'} foot={`${skipped} skipped overall`} />
      </div>
      <Card className="mb">
        <form className="row" onSubmit={addQuick}>
          <input className="input grow" placeholder="Quick add a task for today and press Enter…" value={quick} onChange={(e) => setQuick(e.target.value)} aria-label="Quick add task" />
          <button type="submit" className="btn btn-primary" disabled={!quick.trim()}><Plus size={15} /> Add</button>
        </form>
      </Card>
      <div className="chips mb">
        {[['open', 'Open'], ['recent', 'Completed / skipped (7 days)'], ['all', 'All']].map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={show === v} onClick={() => setShow(v)}>{l}</button>
        ))}
      </div>
      {show === 'open' ? (
        open.length === 0 ? (
          <Card><Empty icon={ListChecks} title="No open tasks">Add tasks or link them to goals to break big goals into steps.</Empty></Card>
        ) : (
          <div className="grid-2">
            {GROUPS.filter(([k]) => grouped[k].length).map(([k, label]) => (
              <Card key={k} title={label} sub={`${grouped[k].length} task${grouped[k].length === 1 ? '' : 's'}`}>
                <div className="list">{grouped[k].map((t) => <Row key={t.id} t={t} />)}</div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          {(show === 'recent' ? recent : data.tasks).length === 0 ? (
            <Empty title="Nothing here yet" />
          ) : (
            <div className="list">
              {[...(show === 'recent' ? recent : data.tasks)].sort((x, y) => String(y.dueDate || '').localeCompare(String(x.dueDate || ''))).map((t) => <Row key={t.id} t={t} />)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
