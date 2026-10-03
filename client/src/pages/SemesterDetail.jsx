import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, GraduationCap, Pencil, Plus, Save, Sigma, Trash2, ListTree } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile, Tabs, Callout } from '../components/ui/Card.jsx';
import { RiskBadge, StateChip } from '../components/ui/Indicators.jsx';
import { evaluateSemester, fmtGradeSource } from '../logic/academics.js';
import { attendanceStats } from '../logic/attendance.js';
import { fmtGpa, fmtPct, isNum } from '../lib/format.js';
import { fmtDate, WEEKDAY_LABELS, relativeDay } from '../lib/dates.js';
import { uid } from '../lib/ids.js';
import { Info } from 'lucide-react';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SOURCE_STATE = { official: 'official', confirmed: 'confirmed', projected: 'projected', simulated: 'hypothetical', empty: 'pending' };

function Timetable({ semester, subjects }) {
  const { update } = useData();
  const toast = useToast();
  const [tt, setTt] = useState(() => semester.timetable || {});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setTt(semester.timetable || {});
    setDirty(false);
  }, [semester.id, semester.timetable]);

  const change = (day, slots) => {
    setTt((t) => ({ ...t, [day]: slots }));
    setDirty(true);
  };
  const save = async () => {
    await update('semesters', semester.id, { timetable: tt });
    setDirty(false);
    toast('Timetable saved');
  };

  if (!subjects.length) return <Empty icon={CalendarClock} title="Add subjects first">The timetable lists which lectures happen on each weekday.</Empty>;

  return (
    <div className="stack">
      <Callout tone="info" icon={Info}>
        Your weekly timetable pre-fills the Attendance page, so marking a day takes one tap per lecture.
      </Callout>
      <div className="grid-auto">
        {DAYS.map((day) => {
          const slots = tt[day] || [];
          return (
            <Card key={day} title={WEEKDAY_LABELS[day]} sub={`${slots.length} slot${slots.length === 1 ? '' : 's'}`}>
              <div className="stack-sm">
                {slots
                  .slice()
                  .sort((x, y) => String(x.time || '').localeCompare(String(y.time || '')))
                  .map((sl) => (
                    <div key={sl.id} className="row-sm">
                      <input className="input sm" type="time" style={{ width: 96 }} aria-label="Time" value={sl.time || ''} onChange={(e) => change(day, slots.map((x) => (x.id === sl.id ? { ...x, time: e.target.value } : x)))} />
                      <select className="select sm grow" aria-label="Subject" value={sl.subjectId} onChange={(e) => change(day, slots.map((x) => (x.id === sl.id ? { ...x, subjectId: e.target.value } : x)))}>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code || s.name}
                          </option>
                        ))}
                      </select>
                      <select className="select sm" style={{ width: 92 }} aria-label="Type" value={sl.slotType} onChange={(e) => change(day, slots.map((x) => (x.id === sl.id ? { ...x, slotType: e.target.value } : x)))}>
                        <option value="lecture">Lecture</option>
                        <option value="lab">Lab</option>
                        <option value="tutorial">Tutorial</option>
                      </select>
                      <button type="button" className="icon-btn sm danger" aria-label="Remove slot" onClick={() => change(day, slots.filter((x) => x.id !== sl.id))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => change(day, [...slots, { id: uid('t_'), subjectId: subjects[0].id, slotType: 'lecture', time: '' }])}>
                  <Plus size={14} /> Add slot
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="row end">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty}>
          <Save size={15} /> Save timetable
        </button>
      </div>
    </div>
  );
}

export default function SemesterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, profile, analysis: a, remove, saveProfile, today } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState('grades');
  const semester = data.semesters.find((s) => s.id === id);
  const grading = profile.grading;
  const dec = grading.decimals ?? 2;

  const result = useMemo(() => (semester ? evaluateSemester(semester, data.subjects, grading) : null), [semester, data.subjects, grading]);
  const att = useMemo(() => (result ? attendanceStats(data.attendance, result.subjects, grading.attendanceThreshold) : null), [data.attendance, result, grading.attendanceThreshold]);

  if (!semester || !result) {
    return <Empty icon={GraduationCap} title="Semester not found" action={<Link to="/academics" className="btn">Back to academics</Link>} />;
  }

  const subjectIds = new Set(result.subjects.map((s) => s.id));
  const assignments = data.assignments.filter((x) => subjectIds.has(x.subjectId));
  const exams = data.exams.filter((x) => subjectIds.has(x.subjectId));
  const isCurrent = a.currentSemester?.id === semester.id;

  const deleteSubject = async (s) => {
    const ok = await confirm({ title: `Delete ${s.name}?`, message: 'Its marks, attendance, assignments and exams will be removed. SGPA and CGPA will be recalculated.', confirmLabel: 'Delete subject', danger: true });
    if (!ok) return;
    await remove('subjects', s.id);
    toast('Subject deleted');
  };

  const deleteSemester = async () => {
    const ok = await confirm({ title: `Delete ${semester.name}?`, message: `Removes ${result.subjects.length} subject(s) and everything attached to them.`, confirmLabel: 'Delete semester', danger: true, requireText: result.subjects.length ? 'delete' : undefined });
    if (!ok) return;
    await remove('semesters', semester.id);
    if (profile.currentSemesterId === semester.id) await saveProfile({ currentSemesterId: null });
    toast('Semester deleted');
    navigate('/academics');
  };

  const units = result.units;
  const statusLabel = { official: 'Official result', confirmed: 'All marks confirmed', 'in-progress': 'In progress — projected', empty: 'No marks yet' }[result.status];

  return (
    <div>
      <Link to="/academics" className="small row-sm mb" style={{ display: 'inline-flex' }}>
        <ArrowLeft size={14} /> Academics
      </Link>
      <PageHeader
        eyebrow={[semester.academicYear, semester.status].filter(Boolean).join(' · ')}
        title={semester.name}
        description={semester.startDate ? `${fmtDate(semester.startDate)} – ${fmtDate(semester.endDate)}` : undefined}
        actions={
          <>
            {!isCurrent && (
              <button type="button" className="btn" onClick={() => saveProfile({ currentSemesterId: semester.id })}>
                Set as current
              </button>
            )}
            <button type="button" className="btn" onClick={() => openForm('semester', { semester })}>
              <Pencil size={14} /> Edit
            </button>
            <button type="button" className="btn btn-danger" onClick={deleteSemester}>
              <Trash2 size={14} /> Delete
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openForm('subject', { semesterId: semester.id })}>
              <Plus size={15} /> Subject
            </button>
          </>
        }
      />

      <div className="grid-4 mb">
        <StatTile label={result.status === 'in-progress' ? 'Projected SGPA' : 'SGPA'} value={fmtGpa(result.effectiveSgpa, dec)} foot={<><StateChip state={result.status === 'in-progress' ? 'projected' : result.status === 'empty' ? 'pending' : result.status} /> {statusLabel}</>} />
        <StatTile
          label="Confirmed so far"
          value={result.status === 'official' ? fmtGpa(semester.officialSgpa, dec) : fmtGpa(result.partialConfirmed.sgpa, dec)}
          foot={result.status === 'official' ? 'Declared by university' : `On ${result.partialConfirmed.credits} of ${result.totalCredits} credits fully confirmed`}
        />
        <StatTile label="Credits" value={result.totalCredits || '—'} foot={`${result.subjects.length} subjects`} />
        <StatTile label="Marks assessed" value={fmtPct((result.confidence || 0) * 100)} foot={isNum(semester.targetSgpa) ? `Target SGPA ${semester.targetSgpa}` : 'of total weight'} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'grades', label: 'Subjects & SGPA', icon: Sigma },
          { value: 'timetable', label: 'Timetable', icon: CalendarClock },
          { value: 'records', label: 'Attendance & submissions', icon: ListTree },
        ]}
      />

      {tab === 'grades' && (
        <div className="stack">
          {result.status === 'official' && (
            <Callout tone="info" icon={Info}>
              This semester has an official SGPA of {semester.officialSgpa} which overrides the values calculated from subject marks below.
            </Callout>
          )}
          <Card title="SGPA calculation" icon={Sigma} sub="SGPA = Σ (credits × grade points) ÷ Σ credits — following your grading rules">
            {units.length === 0 ? (
              <Empty icon={GraduationCap} title="No subjects in this semester" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => openForm('subject', { semesterId: semester.id })}><Plus size={14} /> Add subject</button>} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="num">Credits</th>
                      <th className="num">Score</th>
                      <th>Grade</th>
                      <th className="num">Points</th>
                      <th className="num">Credit points</th>
                      <th>Basis</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => {
                      const subj = a.subjectById[u.subjectId];
                      return (
                        <tr key={u.key}>
                          <td>
                            <Link to={`/academics/subjects/${u.subjectId}`} className="strong">
                              {u.label}
                            </Link>
                            {u.failReason && <div className="tiny" style={{ color: 'var(--critical)' }}>{u.failReason}</div>}
                          </td>
                          <td className="num">{u.credits}</td>
                          <td className="num">{u.percent != null ? fmtPct(u.percent, 1) : '—'}</td>
                          <td className="strong">{u.grade?.grade ?? '—'}</td>
                          <td className="num">{u.points ?? '—'}</td>
                          <td className="num">{u.points != null ? (u.points * u.credits).toFixed(1) : '—'}</td>
                          <td>
                            <StateChip state={SOURCE_STATE[u.source]} label={fmtGradeSource(u.source)} />
                            {u.source === 'projected' && <div className="tiny muted">{Math.round((u.confidence || 0) * 100)}% assessed</div>}
                          </td>
                          <td className="right nowrap">
                            {subj && (
                              <>
                                <button type="button" className="icon-btn sm" aria-label={`Edit ${subj.name}`} onClick={() => openForm('subject', { subject: subj })}>
                                  <Pencil size={14} />
                                </button>
                                <button type="button" className="icon-btn sm danger" aria-label={`Delete ${subj.name}`} onClick={() => deleteSubject(subj)}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="num">{result.computedCredits}</td>
                      <td colSpan={3} />
                      <td className="num">{result.creditPoints.toFixed(1)}</td>
                      <td colSpan={2}>
                        SGPA = {result.creditPoints.toFixed(1)} ÷ {result.computedCredits} = <b>{fmtGpa(result.computedSgpa, dec)}</b>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="tiny muted mt-sm">
              Projected rows fill pending assessments with your current performance rate in that subject (or your semester average when a subject has no marks yet). They are estimates, not results.
              {!grading.countFailedCredits && ' Failed subjects are excluded from the credit total, per your settings.'}
            </p>
          </Card>
        </div>
      )}

      {tab === 'timetable' && <Timetable semester={semester} subjects={result.subjects} />}

      {tab === 'records' && (
        <div className="grid-2">
          <Card title="Attendance" icon={CalendarClock} link={{ to: '/attendance', label: 'Mark attendance' }}>
            {!att.recordCount ? (
              <Empty title="No attendance records" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="num">Present</th>
                    <th className="num">%</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {att.bySubject.map((s) => (
                    <tr key={s.subject.id}>
                      <td>{s.subject.code || s.subject.name}</td>
                      <td className="num">
                        {s.present}/{s.total}
                      </td>
                      <td className="num">{fmtPct(s.percent)}</td>
                      <td>
                        <RiskBadge level={s.risk} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Assignments & exams" link={{ to: '/assignments', label: 'Submissions' }}>
            {assignments.length + exams.length === 0 ? (
              <Empty title="Nothing recorded" />
            ) : (
              <div className="list">
                {[...exams.map((e) => ({ ...e, kind: 'Exam', when: e.date })), ...assignments.map((x) => ({ ...x, kind: 'Assignment', when: x.dueDate }))]
                  .sort((x, y) => String(y.when).localeCompare(String(x.when)))
                  .map((x) => (
                    <div key={x.id} className="list-item">
                      <div className="li-main">
                        <div className="li-title small">{x.title}</div>
                        <div className="li-sub">
                          {x.kind} · {a.subjectById[x.subjectId]?.code} · {x.status}
                          {x.marks != null && x.maxMarks ? ` · ${x.marks}/${x.maxMarks}` : ''}
                        </div>
                      </div>
                      <span className="tiny muted nowrap">{x.when ? relativeDay(x.when, today) : '—'}</span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
