import { useMemo, useState } from 'react';
import { CalendarClock, Pencil, PenLine, Plus, Trash2 } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader } from '../components/ui/Card.jsx';
import { ProgressBar, StateChip } from '../components/ui/Indicators.jsx';
import { EXAM_TYPES } from '../logic/defaults.js';
import { diffDays, fmtDate, relativeDay } from '../lib/dates.js';
import { fmtPct } from '../lib/format.js';

const typeLabel = (t) => EXAM_TYPES.find((x) => x.value === t)?.label || t;

export default function Exams() {
  const { data, analysis: a, today, update, remove } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const [type, setType] = useState('');

  const filtered = data.exams.filter((e) => !type || e.type === type);
  const upcoming = filtered.filter((e) => e.status === 'upcoming' && (!e.date || e.date >= today)).sort((x, y) => String(x.date || '9999').localeCompare(String(y.date || '9999')));
  const past = filtered.filter((e) => !upcoming.includes(e)).sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')));
  const missedUpdate = past.filter((e) => e.status === 'upcoming');

  const del = async (e) => {
    if (!(await confirm({ title: `Delete “${e.title}”?`, confirmLabel: 'Delete', danger: true }))) return;
    await remove('exams', e.id);
    toast('Exam deleted');
  };

  const resultStats = useMemo(() => {
    const r = data.exams.filter((e) => e.status === 'result' && e.marks != null && e.maxMarks > 0 && e.marksStatus === 'confirmed');
    return { count: r.length, avg: r.length ? (r.reduce((s, e) => s + e.marks / e.maxMarks, 0) / r.length) * 100 : null };
  }, [data.exams]);

  return (
    <div>
      <PageHeader
        eyebrow="Exams"
        title="Exam schedule & results"
        description="Mid-sems, practicals, university exams, quizzes, vivas, mock tests and competitive exams."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openForm('exam')}>
            <Plus size={15} /> Add exam
          </button>
        }
      />
      <div className="chips mb">
        <button type="button" className="chip" aria-pressed={!type} onClick={() => setType('')}>All</button>
        {EXAM_TYPES.map((t) => (
          <button key={t.value} type="button" className="chip" aria-pressed={type === t.value} onClick={() => setType(t.value)}>{t.label}</button>
        ))}
      </div>

      <h2 className="mb">Upcoming</h2>
      {upcoming.length === 0 ? (
        <Card className="mb">
          <Empty icon={CalendarClock} title="No upcoming exams" action={<button type="button" className="btn btn-sm" onClick={() => openForm('exam')}><Plus size={14} /> Add exam</button>} />
        </Card>
      ) : (
        <div className="grid-auto mb">
          {upcoming.map((e) => {
            const days = e.date ? diffDays(e.date, today) : null;
            const subj = a.subjectById[e.subjectId];
            return (
              <Card key={e.id} glow={days != null && days <= 3}>
                <div className="row between row-top">
                  <div className="grow">
                    <div className="tiny muted">{typeLabel(e.type)}{subj ? ` · ${subj.name}` : ''}</div>
                    <div className="strong" style={{ fontSize: 15 }}>{e.title}</div>
                  </div>
                  <span className={`badge ${days != null && days <= 2 ? 'badge-critical' : days != null && days <= 7 ? 'badge-warning' : 'badge-info'}`}>{e.date ? relativeDay(e.date, today) : 'No date'}</span>
                </div>
                <div className="small text-2 mt-sm">{[e.date && fmtDate(e.date, 'EEE d MMM'), e.time, e.venue].filter(Boolean).join(' · ')}</div>
                {e.syllabus && <div className="small mt-sm" style={{ whiteSpace: 'pre-wrap' }}>{e.syllabus}</div>}
                <div className="mt">
                  <div className="row between small mb" style={{ marginBottom: 6 }}>
                    <span className="text-2">Preparation</span>
                    <b>{e.preparation || 0}%</b>
                  </div>
                  <input className="range" type="range" min={0} max={100} step={5} value={e.preparation || 0} aria-label={`Preparation for ${e.title}`} onChange={(ev) => update('exams', e.id, { preparation: Number(ev.target.value) })} />
                </div>
                <div className="row-sm mt">
                  <button type="button" className="btn btn-sm grow" onClick={() => openForm('exam', { exam: { ...e, status: 'result' } })}>Enter result</button>
                  <button type="button" className="icon-btn sm" aria-label="Edit" onClick={() => openForm('exam', { exam: e })}><Pencil size={14} /></button>
                  <button type="button" className="icon-btn sm danger" aria-label="Delete" onClick={() => del(e)}><Trash2 size={14} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="Past exams & results" icon={PenLine} sub={resultStats.count ? `Average on confirmed results: ${fmtPct(resultStats.avg)}` : undefined}>
        {missedUpdate.length > 0 && <p className="small" style={{ color: 'var(--warning)', marginBottom: 10 }}>{missedUpdate.length} exam(s) have passed but are still marked upcoming — update their status.</p>}
        {past.length === 0 ? (
          <Empty title="No past exams yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Marks</th>
                  <th style={{ width: 160 }}>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {past.map((e) => {
                  const pct = e.marks != null && e.maxMarks ? (e.marks / e.maxMarks) * 100 : null;
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="strong small">{e.title}</div>
                        <div className="tiny muted">{typeLabel(e.type)}{a.subjectById[e.subjectId] ? ` · ${a.subjectById[e.subjectId].name}` : ''}</div>
                      </td>
                      <td className="small nowrap">{fmtDate(e.date)}</td>
                      <td className="small">{e.status === 'result' ? 'Result' : e.status === 'completed' ? 'Awaiting result' : 'Not updated'}</td>
                      <td className="num small nowrap">
                        {e.marks != null ? `${e.marks}${e.maxMarks ? `/${e.maxMarks}` : ''}` : '—'} {e.marks != null && <StateChip state={e.marksStatus || 'confirmed'} />}
                      </td>
                      <td>{pct != null ? <div className="stack-xs"><span className="small">{fmtPct(pct)}</span><ProgressBar value={pct} size="thin" /></div> : '—'}</td>
                      <td className="right nowrap">
                        <button type="button" className="icon-btn sm" aria-label="Edit" onClick={() => openForm('exam', { exam: e })}><Pencil size={14} /></button>
                        <button type="button" className="icon-btn sm danger" aria-label="Delete" onClick={() => del(e)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="tiny muted mt-sm">Tip: subject marks that count toward your grade live on the subject page (Assessments & marks). Exams here track schedule, preparation and results.</p>
      </Card>
    </div>
  );
}
