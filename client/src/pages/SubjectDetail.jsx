import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarCheck, ClipboardCheck, Crosshair, GraduationCap, Info, LayoutTemplate, Pencil, PenLine, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Callout, Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { ProgressBar, RiskBadge, StateChip } from '../components/ui/Indicators.jsx';
import { TextArea } from '../components/ui/Fields.jsx';
import { useSaveComponents } from '../hooks/useSaveComponents.js';
import { evaluateSubject, fmtGradeSource, subjectSplits, weightTotals } from '../logic/academics.js';
import { gradeRequirements, subjectTargetStatus } from '../logic/targets.js';
import { ASSESSMENT_TYPES, componentsFromTemplate } from '../logic/defaults.js';
import { fmtDuration, fmtPct, isNum } from '../lib/format.js';
import { relativeDay, subDaysISO } from '../lib/dates.js';
import { uid } from '../lib/ids.js';
import { minutesOf } from '../logic/study.js';

const SOURCE_STATE = { official: 'official', confirmed: 'confirmed', projected: 'projected', simulated: 'hypothetical', empty: 'pending' };

function ComponentsEditor({ subject, onDirty }) {
  const { profile } = useData();
  const saveComponents = useSaveComponents();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(subject.components || []);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(subject.components || []);
    setDirty(false);
  }, [subject.id, subject.components]);

  useEffect(() => onDirty?.(dirty ? rows : null), [dirty, rows, onDirty]);

  const change = (id, key, value) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [key]: value };
        // Entering a mark on a pending component defaults it to confirmed.
        if (key === 'obtained' && value != null && r.status === 'pending') next.status = 'confirmed';
        if (key === 'status' && value === 'pending') next.obtained = null;
        return next;
      })
    );
    setDirty(true);
  };

  const add = () => {
    setRows((rs) => [...rs, { id: uid('c_'), name: 'New assessment', kind: 'theory', assessmentType: 'other', evaluation: 'internal', maxMarks: 10, weight: 10, obtained: null, status: 'pending', minPassPercent: null, date: null, notes: '' }]);
    setDirty(true);
  };

  const applyTemplate = async (templateId) => {
    const t = profile.templates.find((x) => x.id === templateId);
    if (!t) return;
    if (rows.length) {
      const ok = await confirm({ title: `Replace with “${t.name}”?`, message: 'All current components and their marks for this subject will be replaced.', confirmLabel: 'Replace', danger: true });
      if (!ok) return;
    }
    setRows(componentsFromTemplate(t));
    setDirty(true);
  };

  const save = async () => {
    for (const r of rows) {
      if (!r.name?.trim()) return toast('Every component needs a name', 'critical');
      if (!(Number(r.maxMarks) > 0)) return toast(`${r.name}: maximum marks must be above 0`, 'critical');
      if (r.obtained != null && (r.obtained < 0 || r.obtained > r.maxMarks)) return toast(`${r.name}: marks must be between 0 and ${r.maxMarks}`, 'critical');
    }
    setBusy(true);
    try {
      await saveComponents(subject, rows.map((r) => ({ ...r, maxMarks: Number(r.maxMarks), weight: Number(r.weight) || 0, obtained: r.status === 'pending' ? null : r.obtained })));
      setDirty(false);
      toast('Assessments saved');
    } catch {
      /* toast shown by store */
    } finally {
      setBusy(false);
    }
  };

  const totals = weightTotals({ components: rows });
  const sumWeight = totals.total || 0;
  const num = (v) => (v === '' ? null : Number(v));

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="table comp-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Part</th>
              <th>Type</th>
              <th>Int / Ext</th>
              <th className="num">Max</th>
              <th className="num" title="Share of the subject's final score">Weight</th>
              <th className="num">Obtained</th>
              <th>Status</th>
              <th>Date</th>
              <th className="num" title="Minimum % required in this component to pass">Min %</th>
              <th className="num">Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.status !== 'pending' && isNum(r.obtained) && r.maxMarks > 0 ? (r.obtained / r.maxMarks) * 100 : null;
              const contribution = pct != null && sumWeight ? (pct * (Number(r.weight) || 0)) / sumWeight : null;
              return (
                <tr key={r.id}>
                  <td className="w-name">
                    <input className="input" aria-label="Assessment name" value={r.name} onChange={(e) => change(r.id, 'name', e.target.value)} />
                  </td>
                  <td>
                    <select className="select" aria-label="Part" value={r.kind} onChange={(e) => change(r.id, 'kind', e.target.value)}>
                      <option value="theory">Theory</option>
                      <option value="practical">Practical</option>
                    </select>
                  </td>
                  <td className="w-sel">
                    <select className="select" aria-label="Assessment type" value={r.assessmentType || 'other'} onChange={(e) => change(r.id, 'assessmentType', e.target.value)}>
                      {ASSESSMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="select" aria-label="Internal or external" value={r.evaluation} onChange={(e) => change(r.id, 'evaluation', e.target.value)}>
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                  </td>
                  <td className="w-num">
                    <input className="input" type="number" min={0} step="any" aria-label="Maximum marks" value={r.maxMarks ?? ''} onChange={(e) => change(r.id, 'maxMarks', num(e.target.value))} />
                  </td>
                  <td className="w-num">
                    <input className="input" type="number" min={0} step="any" aria-label="Weight" value={r.weight ?? ''} onChange={(e) => change(r.id, 'weight', num(e.target.value))} />
                  </td>
                  <td className="w-num">
                    <input className="input" type="number" min={0} max={r.maxMarks} step="any" aria-label="Marks obtained" value={r.status === 'pending' ? '' : r.obtained ?? ''} placeholder="—" onChange={(e) => change(r.id, 'obtained', num(e.target.value))} />
                  </td>
                  <td className="w-sel">
                    <select className="select" aria-label="Data state" value={r.status} onChange={(e) => change(r.id, 'status', e.target.value)}>
                      <option value="confirmed">Confirmed</option>
                      <option value="expected">Expected</option>
                      <option value="estimated">Estimated</option>
                      <option value="pending">Pending</option>
                    </select>
                  </td>
                  <td>
                    <input className="input" type="date" aria-label="Date" style={{ width: 140 }} value={r.date || ''} onChange={(e) => change(r.id, 'date', e.target.value || null)} />
                  </td>
                  <td className="w-num">
                    <input className="input" type="number" min={0} max={100} aria-label="Minimum pass percent" value={r.minPassPercent ?? ''} placeholder="—" onChange={(e) => change(r.id, 'minPassPercent', num(e.target.value))} />
                  </td>
                  <td className="num nowrap">
                    {pct != null ? (
                      <>
                        <div className="strong">{fmtPct(pct)}</div>
                        <div className="tiny muted">+{contribution.toFixed(1)} pts</div>
                      </>
                    ) : (
                      <StateChip state="pending" />
                    )}
                  </td>
                  <td>
                    <button type="button" className="icon-btn sm danger" aria-label={`Remove ${r.name}`} onClick={() => { setRows(rows.filter((x) => x.id !== r.id)); setDirty(true); }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Weight total{totals.practical ? ` (theory ${totals.theory} · practical ${totals.practical})` : ''}</td>
              <td className="num" style={{ color: Math.abs(sumWeight - 100) > 0.5 ? 'var(--warning)' : undefined }}>{sumWeight}</td>
              <td colSpan={6} className="small muted">
                {Math.abs(sumWeight - 100) > 0.5 ? 'Weights don’t add to 100 — they’ll be scaled proportionally.' : 'Weights add to 100.'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="row between wrap">
        <div className="row-sm wrap">
          <button type="button" className="btn btn-sm" onClick={add}>
            <Plus size={14} /> Add component
          </button>
          <label className="row-sm small muted">
            <LayoutTemplate size={14} />
            <select className="select sm" style={{ width: 210 }} value="" onChange={(e) => e.target.value && applyTemplate(e.target.value)} aria-label="Apply assessment template">
              <option value="">Apply a structure template…</option>
              {profile.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row-sm">
          {dirty && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRows(subject.components || []); setDirty(false); }}>
              <RotateCcw size={14} /> Discard
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || busy}>
            <Save size={14} /> {busy ? 'Saving…' : 'Save marks'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, profile, analysis: a, update, remove, today } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const [draft, setDraft] = useState(null);
  const [notes, setNotes] = useState('');
  const subject = data.subjects.find((s) => s.id === id);
  const grading = profile.grading;

  useEffect(() => setNotes(subject?.notes || ''), [subject?.id, subject?.notes]);

  const rates = a.semesterResults.find((r) => r.semester.id === subject?.semesterId)?.rates;
  const units = useMemo(() => {
    if (!subject) return [];
    const s = draft ? { ...subject, components: draft } : subject;
    return evaluateSubject(s, grading, { rate: rates?.overall });
  }, [subject, draft, grading, rates]);

  if (!subject) return <Empty icon={GraduationCap} title="Subject not found" action={<Link to="/academics" className="btn">Back to academics</Link>} />;

  const semester = a.semesterById[subject.semesterId];
  const splits = subjectSplits(draft ? { components: draft } : subject);
  const splitsConfirmed = subjectSplits(draft ? { components: draft } : subject, { confirmedOnly: true });
  const att = a.attendanceAll.bySubject.find((x) => x.subject.id === subject.id);
  const sessions = data.studySessions.filter((s) => s.subjectId === subject.id);
  const exams = data.exams.filter((e) => e.subjectId === subject.id).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const assignments = data.assignments.filter((x) => x.subjectId === subject.id).sort((x, y) => String(x.dueDate).localeCompare(String(y.dueDate)));

  const del = async () => {
    const ok = await confirm({ title: `Delete ${subject.name}?`, message: 'Marks, attendance, assignments and exams for this subject will be removed. Study sessions are kept but unlinked.', confirmLabel: 'Delete subject', danger: true });
    if (!ok) return;
    await remove('subjects', subject.id);
    toast('Subject deleted');
    navigate(semester ? `/academics/semesters/${semester.id}` : '/academics');
  };

  return (
    <div>
      <Link to={semester ? `/academics/semesters/${semester.id}` : '/academics'} className="small row-sm mb" style={{ display: 'inline-flex' }}>
        <ArrowLeft size={14} /> {semester?.name || 'Academics'}
      </Link>
      <PageHeader
        eyebrow={[subject.code, `${subject.gradingMode === 'split' ? `${subject.theoryCredits ?? 0}+${subject.practicalCredits ?? 0}` : subject.credits} credits`, subject.category].filter(Boolean).join(' · ')}
        title={subject.name}
        description={[subject.faculty && `Faculty: ${subject.faculty}`, subject.difficulty && `Difficulty ${subject.difficulty}/5`, subject.strength && `Your strength ${subject.strength}/5`].filter(Boolean).join(' · ')}
        actions={
          <>
            <button type="button" className="btn" onClick={() => openForm('subject', { subject })}>
              <Pencil size={14} /> Edit
            </button>
            <button type="button" className="btn btn-danger" onClick={del}>
              <Trash2 size={14} /> Delete
            </button>
            <Link to="/simulator" className="btn">
              <Crosshair size={14} /> What-if
            </Link>
          </>
        }
      />

      {draft && (
        <div className="mb">
          <Callout tone="warning" icon={Info}>
            Showing results for your <b>unsaved</b> changes. Save to make them part of your record, or discard.
          </Callout>
        </div>
      )}

      <div className="grid-4 mb">
        {units.map((u) => {
          const target = subjectTargetStatus(u, subject, grading);
          // Same rule as the semester SGPA: no projected grade until something has been assessed.
          const shown = u.source !== 'projected' || (u.confidence || 0) > 0;
          const source = shown ? u.source : 'empty';
          return (
            <StatTile
              key={u.key}
              label={units.length > 1 ? `${u.part === 'theory' ? 'Theory' : 'Practical'} grade · ${u.credits} cr` : 'Grade'}
              value={shown ? (u.grade?.grade ?? '—') : '—'}
              unit={shown && u.points != null ? `${u.points} pts` : ''}
              foot={
                <>
                  <StateChip state={SOURCE_STATE[source]} label={fmtGradeSource(source)} />
                  {shown && u.percent != null && <span>{fmtPct(u.percent, 1)}</span>}
                  {target && !target.locked && target.feasible && <span>· {target.target.grade} needs {fmtPct(target.required)} on rest</span>}
                </>
              }
            />
          );
        })}
        {units[0]?.percent != null && (
          <>
            <StatTile label="Secured (confirmed only)" value={fmtPct(units[0].securedPercent, 1)} foot="Guaranteed even with zero on the rest" />
            <StatTile label="Range still possible" value={`${fmtPct(units[0].minPercent, 0)}–${fmtPct(units[0].maxPercent, 0)}`} foot={`${Math.round((units[0].pendingShare || 0) * 100)}% of weight still pending`} />
          </>
        )}
      </div>

      <Card className="mb" title="Assessments & marks" icon={PenLine} sub="Every component with its weight. Confirmed, expected and estimated marks are kept distinct.">
        <ComponentsEditor subject={subject} onDirty={setDraft} />
      </Card>

      <div className="grid-3">
          <Card title="What each grade needs" icon={Crosshair} sub="Score required on remaining assessments">
            {units.map((u) => (
              <div key={u.key} className="stack-xs mb">
                {units.length > 1 && <div className="field-label">{u.label}</div>}
                {u.source === 'official' || u.source === 'confirmed' ? (
                  <div className="small text-2">Final grade {u.source === 'official' ? 'declared' : 'confirmed'}: <b>{u.grade?.grade}</b></div>
                ) : (
                  gradeRequirements(u, grading)
                    .slice(0, 6)
                    .map((r) => (
                      <div key={r.grade.grade} className="row between small">
                        <span className="row-sm">
                          <b style={{ minWidth: 26 }}>{r.grade.grade}</b>
                          <span className="muted">≥{r.grade.min}%</span>
                        </span>
                        <span className={r.secured ? 'delta-up' : !r.feasible ? 'muted' : ''}>
                          {r.secured ? 'Secured' : !r.feasible ? 'Not reachable' : `${fmtPct(r.required, 0)} on rest`}
                        </span>
                      </div>
                    ))
                )}
              </div>
            ))}
            <p className="tiny muted">Assumes expected/estimated marks hold. Component minimum-pass rules still apply.</p>
          </Card>

          <Card title="Performance split" sub="Including provisional marks (confirmed only in brackets)">
            {[
              ['Theory', splits.theory, splitsConfirmed.theory],
              ['Practical', splits.practical, splitsConfirmed.practical],
              ['Internal', splits.internal, splitsConfirmed.internal],
              ['External', splits.external, splitsConfirmed.external],
            ]
              .filter(([, v]) => v != null)
              .map(([label, v, c]) => (
                <div key={label} className="stack-xs mb">
                  <div className="row between small">
                    <span>{label}</span>
                    <span className="tabular">
                      <b>{fmtPct(v)}</b> <span className="muted">({c != null ? fmtPct(c) : '—'})</span>
                    </span>
                  </div>
                  <ProgressBar value={v} size="thin" />
                </div>
              ))}
            {splits.theory == null && splits.practical == null && <div className="small muted">Enter marks to see the split.</div>}
          </Card>
        <Card title="Attendance" icon={CalendarCheck} link={{ to: '/attendance', label: 'Mark' }}>
          {!att?.total ? (
            <div className="small muted">No attendance recorded.</div>
          ) : (
            <div className="stack-sm">
              <div className="row between">
                <span className="stat-value">{fmtPct(att.percent)}</span>
                <RiskBadge level={att.risk} />
              </div>
              <div className="small text-2">
                {att.present}/{att.total} classes ·{' '}
                {att.risk === 'safe' ? `can miss ${att.canMiss}` : `attend next ${att.mustAttend} to reach ${a.attendanceAll.threshold}%`}
              </div>
              {['lecture', 'lab', 'tutorial']
                .filter((k) => att.byType[k].total)
                .map((k) => (
                  <div key={k} className="row between small">
                    <span className="muted" style={{ textTransform: 'capitalize' }}>{k}s</span>
                    <span>
                      {att.byType[k].present}/{att.byType[k].total} ({fmtPct(att.byType[k].percent)})
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2 mt">
        <Card title="Study time" icon={BookOpen} action={<button type="button" className="btn btn-sm" onClick={() => openForm('study', { defaults: { subjectId: subject.id } })}><Plus size={13} /> Log</button>}>
          <div className="stack-sm">
            <div className="row between small"><span className="text-2">Last 7 days</span><b>{fmtDuration(minutesOf(sessions.filter((s) => s.date >= subDaysISO(today, 6))), profile.preferences.timeFormat)}</b></div>
            <div className="row between small"><span className="text-2">Last 28 days</span><b>{fmtDuration(minutesOf(sessions.filter((s) => s.date >= subDaysISO(today, 27))), profile.preferences.timeFormat)}</b></div>
            <div className="row between small"><span className="text-2">All time</span><b>{fmtDuration(minutesOf(sessions), profile.preferences.timeFormat)}</b></div>
            <div className="row between small"><span className="text-2">Sessions</span><b>{sessions.length}</b></div>
          </div>
        </Card>
        <Card title="Exams & deadlines" icon={ClipboardCheck} action={<div className="row-sm"><button type="button" className="btn btn-sm" onClick={() => openForm('exam', { defaults: { subjectId: subject.id } })}><Plus size={13} /> Exam</button><button type="button" className="btn btn-sm" onClick={() => openForm('assignment', { defaults: { subjectId: subject.id } })}><Plus size={13} /> Task</button></div>}>
          {exams.length + assignments.length === 0 ? (
            <div className="small muted">Nothing scheduled.</div>
          ) : (
            <div className="list">
              {[...exams.map((e) => ({ ...e, kind: 'exam', when: e.date })), ...assignments.map((x) => ({ ...x, kind: 'assignment', when: x.dueDate }))].slice(0, 8).map((x) => (
                <button key={x.id} type="button" className="list-item" style={{ border: 0, background: 'none', textAlign: 'left', width: '100%', borderBottom: '1px solid var(--border)' }} onClick={() => openForm(x.kind, x.kind === 'exam' ? { exam: x } : { assignment: x })}>
                  <div className="li-main">
                    <div className="li-title small">{x.title}</div>
                    <div className="li-sub">{x.status.replace('-', ' ')}{x.marks != null && x.maxMarks ? ` · ${x.marks}/${x.maxMarks}` : ''}</div>
                  </div>
                  <span className="tiny muted nowrap">{x.when ? relativeDay(x.when, today) : '—'}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt" title="Notes">
        <TextArea value={notes} onChange={setNotes} rows={4} aria-label="Subject notes" placeholder="Syllabus notes, faculty tips, important topics…" />
        <div className="row end mt-sm">
          <button type="button" className="btn btn-sm" disabled={notes === (subject.notes || '')} onClick={async () => { await update('subjects', subject.id, { notes }); toast('Notes saved'); }}>
            <Save size={14} /> Save notes
          </button>
        </div>
      </Card>
    </div>
  );
}
