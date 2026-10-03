import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, CalendarCheck, ChevronLeft, ChevronRight, HeartPulse, ListChecks, NotebookPen, Plus, Save, Settings2, Trash2, Zap } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { Field, NumberField, Rating, Segmented, TextArea, TextField } from '../components/ui/Fields.jsx';
import { addDaysISO, fmtDate, isISODate, monthStartISO, monthEndISO, rangeISO, weekStartISO, parse } from '../lib/dates.js';
import { fmtDuration, isNum, plural } from '../lib/format.js';
import { minutesOf } from '../logic/study.js';

const EMPTY = {
  collegeAttended: null,
  sleepHours: null,
  bedTime: '',
  wakeTime: '',
  screenTimeMin: null,
  socialMediaMin: null,
  exerciseMin: null,
  entertainmentMin: null,
  breaksMin: null,
  personalMin: null,
  activities: {},
  tasksPlanned: null,
  tasksCompleted: null,
  tasksSkipped: null,
  plannedWork: '',
  completedWork: '',
  productivity: null,
  mood: null,
  notes: '',
  custom: {},
};

const ACTIVITIES = [
  ['revisionMin', 'Revision'],
  ['practiceMin', 'Practice'],
  ['codingMin', 'Coding'],
  ['gateMin', 'GATE prep'],
  ['projectMin', 'Projects'],
  ['assignmentMin', 'Assignments'],
  ['practicalMin', 'Practical work'],
];

function DurationField({ label, value, onChange, hint }) {
  const h = isNum(value) ? Math.floor(value / 60) : '';
  const m = isNum(value) ? value % 60 : '';
  const emit = (hh, mm) => {
    if (hh === '' && mm === '') return onChange(null);
    onChange((Number(hh) || 0) * 60 + (Number(mm) || 0));
  };
  return (
    <Field label={label} hint={hint}>
      <div className="row-sm">
        <input className="input" type="number" min={0} max={24} aria-label={`${label} hours`} placeholder="h" value={h} onChange={(e) => emit(e.target.value, m)} />
        <input className="input" type="number" min={0} max={59} step={5} aria-label={`${label} minutes`} placeholder="m" value={m} onChange={(e) => emit(h, e.target.value)} />
      </div>
    </Field>
  );
}

function CustomFieldInput({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <Field label={field.label}>
        <Segmented label={field.label} value={value ?? null} onChange={onChange} options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
      </Field>
    );
  }
  if (field.type === 'rating') {
    return (
      <Field label={field.label}>
        <Rating value={value ?? null} onChange={onChange} max={5} label={field.label} />
      </Field>
    );
  }
  if (field.type === 'text') return <TextField label={field.label} value={value ?? ''} onChange={onChange} />;
  return <NumberField label={`${field.label}${field.unit ? ` (${field.unit})` : ''}`} value={value ?? null} onChange={onChange} step="any" />;
}

function MonthCalendar({ month, selected, onSelect, today, logged, studied }) {
  const start = weekStartISO(monthStartISO(month));
  const end = addDaysISO(weekStartISO(monthEndISO(month)), 6);
  const days = rangeISO(start, end);
  return (
    <div className="calendar">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
      {days.map((d) => (
        <button
          key={d}
          type="button"
          className={`cal-day ${d.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''} ${d === today ? 'today' : ''} ${d === selected ? 'selected' : ''}`}
          onClick={() => onSelect(d)}
          disabled={d > today}
          aria-label={`${fmtDate(d)}${logged.has(d) ? ', logged' : ''}${studied[d] ? `, studied ${studied[d]} minutes` : ''}`}
        >
          <span>{parse(d).getDate()}</span>
          <span className="cal-marks">
            {logged.has(d) && <i style={{ '--tone': 'var(--accent)' }} />}
            {studied[d] > 0 && <i style={{ '--tone': 'var(--good)' }} />}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Logbook() {
  const { data, profile, analysis: a, today, create, update, remove } = useData();
  const openForm = useQuickForms();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const date = isISODate(params.get('date')) ? params.get('date') : today;
  const setDate = (d) => setParams(d === today ? {} : { date: d }, { replace: true });
  const [month, setMonth] = useState(date);
  const log = data.dailyLogs.find((l) => l.date === date);
  const [v, setV] = useState({ ...EMPTY });
  const [dirty, setDirty] = useState(false);
  const prefs = profile.preferences;
  const mod = prefs.modules || {};
  const tf = prefs.timeFormat;
  const customFields = prefs.customFields || [];

  useEffect(() => {
    setV(log ? { ...EMPTY, ...log, activities: { ...(log.activities || {}) }, custom: { ...(log.custom || {}) } } : { ...EMPTY });
    setDirty(false);
    setMonth(date);
  }, [date, log]);

  const set = (key) => (value) => {
    setV((s) => ({ ...s, [key]: value }));
    setDirty(true);
  };
  const setAct = (key) => (value) => {
    setV((s) => ({ ...s, activities: { ...s.activities, [key]: value } }));
    setDirty(true);
  };
  const setCustom = (key) => (value) => {
    setV((s) => ({ ...s, custom: { ...s.custom, [key]: value } }));
    setDirty(true);
  };

  const sessions = data.studySessions.filter((s) => s.date === date);
  const lectures = data.attendance.filter((r) => r.date === date);
  const dueTasks = data.tasks.filter((t) => t.dueDate === date);
  const logged = useMemo(() => new Set(data.dailyLogs.map((l) => l.date)), [data.dailyLogs]);
  const studied = useMemo(() => {
    const out = {};
    for (const s of data.studySessions) out[s.date] = (out[s.date] || 0) + (Number(s.durationMin) || 0);
    return out;
  }, [data.studySessions]);

  const save = async () => {
    const { id: _i, createdAt: _c, updatedAt: _u, date: _d, ...payload } = v;
    if (log) await update('dailyLogs', log.id, payload);
    else await create('dailyLogs', { ...payload, date });
    setDirty(false);
    toast(`Log saved for ${fmtDate(date)}`);
  };

  const del = async () => {
    if (!log) return;
    if (!(await confirm({ title: `Delete the log for ${fmtDate(date)}?`, message: 'Study sessions and attendance for this day are kept.', confirmLabel: 'Delete log', danger: true }))) return;
    await remove('dailyLogs', log.id);
    toast('Log deleted');
  };

  const section = (s) => customFields.filter((f) => (f.section || 'lifestyle') === s);

  return (
    <div>
      <PageHeader
        eyebrow="Daily logbook"
        title={fmtDate(date, 'EEEE, d MMMM yyyy')}
        description={log ? `Logged · last updated ${fmtDate(log.updatedAt?.slice(0, 10))}` : 'Not logged yet — fill in what you want; everything is optional.'}
        actions={
          <>
            <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDaysISO(date, -1))}><ChevronLeft size={18} /></button>
            <input className="input" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Log date" style={{ width: 160 }} />
            <button type="button" className="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDaysISO(date, 1))}><ChevronRight size={18} /></button>
            {date !== today && <button type="button" className="btn btn-ghost" onClick={() => setDate(today)}>Today</button>}
          </>
        }
      />

      <div className="grid-3">
        <div className="span-2 stack">
          <Card title="Academic" icon={BookOpen}>
            <div className="stack">
              <div className="row wrap between">
                <div className="row-sm">
                  <span className="small text-2">College:</span>
                  <Segmented label="College attended" value={v.collegeAttended} onChange={set('collegeAttended')} options={[{ value: true, label: 'Attended' }, { value: false, label: 'Not attended' }, { value: null, label: 'No college' }]} />
                </div>
                {mod.attendance !== false && (
                  <Link className="btn btn-sm" to={`/attendance?date=${date}`}>
                    <CalendarCheck size={14} /> {lectures.length ? `${lectures.filter((r) => r.status === 'present').length}/${lectures.filter((r) => r.status !== 'cancelled').length} lectures attended` : 'Mark lectures'}
                  </Link>
                )}
              </div>
              <div>
                <div className="row between mb" style={{ marginBottom: 6 }}>
                  <span className="field-label">Study sessions · {fmtDuration(minutesOf(sessions), tf)}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm('study', { defaults: { date } })}><Plus size={13} /> Add session</button>
                </div>
                {sessions.length === 0 ? (
                  <div className="small muted">No study sessions logged for this day.</div>
                ) : (
                  <div className="list">
                    {sessions.map((s) => (
                      <button key={s.id} type="button" className="list-item" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', borderBottom: '1px solid var(--border)' }} onClick={() => openForm('study', { session: s })}>
                        <div className="li-main">
                          <div className="li-title small">{s.topic || a.subjectById[s.subjectId]?.name || s.type}</div>
                          <div className="li-sub">{[a.subjectById[s.subjectId]?.code, s.type, data.goals.find((g) => g.id === s.goalId)?.title].filter(Boolean).join(' · ')}</div>
                        </div>
                        <b className="small">{fmtDuration(s.durationMin, tf)}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>Other academic time (not logged as sessions)</div>
                <div className="form-grid three">
                  {ACTIVITIES.map(([key, label]) => (
                    <DurationField key={key} label={label} value={v.activities?.[key] ?? null} onChange={setAct(key)} />
                  ))}
                </div>
              </div>
              {section('academic').length > 0 && (
                <div className="form-grid three">
                  {section('academic').map((f) => <CustomFieldInput key={f.key} field={f} value={v.custom?.[f.key]} onChange={setCustom(f.key)} />)}
                </div>
              )}
            </div>
          </Card>

          {mod.lifestyle !== false && (
            <Card title="Lifestyle" icon={HeartPulse}>
              <div className="form-grid three">
                <NumberField label="Sleep (hours)" value={v.sleepHours} onChange={set('sleepHours')} min={0} max={24} step={0.25} />
                <TextField label="Bed time" type="time" value={v.bedTime} onChange={set('bedTime')} />
                <TextField label="Wake time" type="time" value={v.wakeTime} onChange={set('wakeTime')} />
                <DurationField label="Screen time" value={v.screenTimeMin} onChange={set('screenTimeMin')} hint={`Limit ${prefs.screenLimitHours}h`} />
                <DurationField label="Social media" value={v.socialMediaMin} onChange={set('socialMediaMin')} hint={`Limit ${prefs.socialLimitHours}h`} />
                <DurationField label="Exercise" value={v.exerciseMin} onChange={set('exerciseMin')} hint={`Target ${prefs.exerciseTargetMin} min`} />
                <DurationField label="Entertainment" value={v.entertainmentMin} onChange={set('entertainmentMin')} />
                <DurationField label="Breaks" value={v.breaksMin} onChange={set('breaksMin')} />
                <DurationField label="Personal activities" value={v.personalMin} onChange={set('personalMin')} />
                <Field label="Mood">
                  <Rating value={v.mood} onChange={set('mood')} max={5} label="Mood" />
                </Field>
                {section('lifestyle').map((f) => <CustomFieldInput key={f.key} field={f} value={v.custom?.[f.key]} onChange={setCustom(f.key)} />)}
              </div>
            </Card>
          )}

          <Card title="Productivity" icon={Zap}>
            <div className="form-grid three">
              <NumberField label="Tasks planned" value={v.tasksPlanned} onChange={set('tasksPlanned')} min={0} step={1} />
              <NumberField label="Tasks completed" value={v.tasksCompleted} onChange={set('tasksCompleted')} min={0} step={1} />
              <NumberField label="Tasks skipped" value={v.tasksSkipped} onChange={set('tasksSkipped')} min={0} step={1} />
              <TextArea className="span-2" label="Planned work" value={v.plannedWork} onChange={set('plannedWork')} rows={2} />
              <Field label="Productivity (1–10)">
                <Rating value={v.productivity} onChange={set('productivity')} max={10} label="Productivity rating" />
              </Field>
              <TextArea className="full" label="Completed work" value={v.completedWork} onChange={set('completedWork')} rows={2} />
              {section('productivity').map((f) => <CustomFieldInput key={f.key} field={f} value={v.custom?.[f.key]} onChange={setCustom(f.key)} />)}
              <TextArea className="full" label="Notes & reflections" value={v.notes} onChange={set('notes')} rows={3} />
            </div>
          </Card>

          <div className="row between wrap">
            <Link to="/settings?tab=tracking" className="small row-sm"><Settings2 size={14} /> Add custom fields</Link>
            <div className="row-sm">
              {log && <button type="button" className="btn btn-danger" onClick={del}><Trash2 size={14} /> Delete log</button>}
              <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
                <Save size={15} /> {log ? 'Save changes' : 'Save log'}
              </button>
            </div>
          </div>
        </div>

        <div className="stack">
          <Card title={fmtDate(month, 'MMMM yyyy')} icon={NotebookPen} action={
            <div className="row-sm">
              <button type="button" className="icon-btn sm" aria-label="Previous month" onClick={() => setMonth(addDaysISO(monthStartISO(month), -1))}><ChevronLeft size={15} /></button>
              <button type="button" className="icon-btn sm" aria-label="Next month" disabled={monthStartISO(month) >= monthStartISO(today)} onClick={() => setMonth(addDaysISO(monthEndISO(month), 1))}><ChevronRight size={15} /></button>
            </div>
          }>
            <MonthCalendar month={month} selected={date} onSelect={setDate} today={today} logged={logged} studied={studied} />
            <div className="legend mt-sm">
              <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent)', borderRadius: '50%' }} /> Logged</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--good)', borderRadius: '50%' }} /> Studied</span>
            </div>
          </Card>
          {mod.tasks !== false && (
            <Card title="Tasks due this day" icon={ListChecks} link={{ to: '/tasks', label: 'Tasks' }}>
              {dueTasks.length === 0 ? (
                <div className="small muted">No tasks due.</div>
              ) : (
                <div className="list">
                  {dueTasks.map((t) => (
                    <label key={t.id} className="list-item check">
                      <input type="checkbox" checked={t.status === 'done'} onChange={(e) => update('tasks', t.id, e.target.checked ? { status: 'done', completedAt: date } : { status: 'todo', completedAt: null })} />
                      <span className="small">{t.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </Card>
          )}
          <Card title="Logging streak">
            <div className="small text-2">
              {plural(data.dailyLogs.length, 'day')} logged in total · {a.lifestyle.summary.daysLogged7}/7 this week · {a.lifestyle.summary.daysLogged30}/30 this month
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
