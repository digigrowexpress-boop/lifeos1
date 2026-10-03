import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronRight, Minus, Plus, Trash2, Trophy, BookMarked } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { useConfirm } from '../ui/Feedback.jsx';
import { CommitInput } from '../ui/Fields.jsx';
import { Card, Empty, StatTile } from '../ui/Card.jsx';
import { ProgressBar, ToneBadge } from '../ui/Indicators.jsx';
import { ChartCard, ChartTooltip, axisProps, gridProps } from '../charts/ChartKit.jsx';
import { TOPIC_STATUSES, GATE_CS_SUBJECTS } from '../../logic/defaults.js';
import { uid } from '../../lib/ids.js';
import { fmtDuration, fmtPct } from '../../lib/format.js';
import { fmtDate, fmtShort } from '../../lib/dates.js';

function SubjectRow({ sp, onChange, onRemove, fmt }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const s = sp.subject;
  const setTopicPatch = (id, patch) => onChange({ topics: (s.topics || []).map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  return (
    <>
      <tr>
        <td>
          <button type="button" className="row-sm" style={{ border: 0, background: 'none', padding: 0, color: 'var(--text)', textAlign: 'left' }} onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>
              <span className="strong small">{s.name}</span>
              <span className="tiny muted" style={{ display: 'block' }}>
                weight {s.weight ?? '—'} · {sp.topicsDone}/{sp.topicCount} topics{sp.weakTopics.length ? ` · ${sp.weakTopics.length} weak` : ''}
              </span>
            </span>
          </button>
        </td>
        <td style={{ minWidth: 140 }}>
          <div className="stack-xs">
            <span className="small tabular">{fmtPct(sp.progress)}</span>
            <ProgressBar value={sp.progress} size="thin" />
          </div>
        </td>
        <td className="num nowrap">
          <div className="row-sm end">
            <button type="button" className="icon-btn sm" aria-label="One fewer lecture" onClick={() => onChange({ lecturesDone: Math.max(0, (Number(s.lecturesDone) || 0) - 1) })}><Minus size={12} /></button>
            <span className="small tabular">{s.lecturesDone || 0}/{s.lecturesTotal || '—'}</span>
            <button type="button" className="icon-btn sm" aria-label="One more lecture" onClick={() => onChange({ lecturesDone: (Number(s.lecturesDone) || 0) + 1 })}><Plus size={12} /></button>
          </div>
        </td>
        <td className="num small">{fmt(sp.studyMin)}<div className="tiny muted">practice {fmt(sp.practiceMin)}</div></td>
        <td className="num small">{sp.questionsSolved}</td>
        <td className="num small">
          {sp.weeklyTargetMin ? (
            <span style={{ color: sp.behindWeekly ? 'var(--warning)' : undefined }}>{fmt(sp.weekMin)} / {fmt(sp.weeklyTargetMin)}</span>
          ) : (
            fmt(sp.weekMin)
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--surface-2)' }}>
            <div className="stack">
              <div className="grid-6">
                {[
                  ['Marks weight', 'weight'],
                  ['Total lectures', 'lecturesTotal'],
                  ['Lectures done', 'lecturesDone'],
                  ['Questions solved (extra)', 'questionsSolved'],
                  ['Revisions', 'revisions'],
                  ['Weekly hours target', 'weeklyHoursTarget'],
                ].map(([label, key]) => (
                  <div className="field" key={key}>
                    <label className="field-label">{label}</label>
                    <CommitInput className="input sm" type="number" min={0} step="any" aria-label={label} value={s[key]} onCommit={(v) => onChange({ [key]: v })} />
                  </div>
                ))}
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>Syllabus topics</div>
                {(s.topics || []).length === 0 && <div className="small muted mb">No topics yet — add the syllabus to track coverage, weak and strong topics.</div>}
                <div className="stack-sm">
                  {(s.topics || []).map((t) => (
                    <div key={t.id} className="row-sm wrap">
                      <CommitInput className="input sm grow" style={{ minWidth: 160 }} value={t.name} aria-label="Topic" onCommit={(v) => setTopicPatch(t.id, { name: v })} />
                      <select className="select sm" style={{ width: 130 }} value={t.status} aria-label="Topic status" onChange={(e) => setTopicPatch(t.id, { status: e.target.value })}>
                        {TOPIC_STATUSES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                      <select className="select sm" style={{ width: 120 }} value={t.confidence || ''} aria-label="Confidence" onChange={(e) => setTopicPatch(t.id, { confidence: e.target.value })}>
                        <option value="">Confidence…</option>
                        <option value="weak">Weak</option>
                        <option value="ok">Okay</option>
                        <option value="strong">Strong</option>
                      </select>
                      <button type="button" className="icon-btn sm danger" aria-label="Remove topic" onClick={() => onChange({ topics: s.topics.filter((x) => x.id !== t.id) })}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                <form
                  className="row-sm mt-sm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const names = topic.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean);
                    if (!names.length) return;
                    onChange({ topics: [...(s.topics || []), ...names.map((name) => ({ id: uid('tp_'), name, status: 'not-started', confidence: '' }))] });
                    setTopic('');
                  }}
                >
                  <input className="input sm grow" placeholder="Add topics (comma-separated)" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="New topics" />
                  <button type="submit" className="btn btn-sm"><Plus size={13} /> Add</button>
                </form>
              </div>
              <div className="row between">
                <span className="small text-2">
                  {sp.weakTopics.length > 0 && <>Weak: {sp.weakTopics.map((t) => t.name).join(', ')}. </>}
                  {sp.strongTopics.length > 0 && <>Strong: {sp.strongTopics.map((t) => t.name).join(', ')}.</>}
                </span>
                <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}><Trash2 size={13} /> Remove subject</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Competitive-exam tracker (GATE etc.) stored in goal.exam. */
export function ExamTracker({ progress }) {
  const { update, profile } = useData();
  const confirm = useConfirm();
  const goal = progress.goal;
  const exam = goal.exam || { subjects: [], mocks: [] };
  const e = progress.exam;
  const fmt = (m) => fmtDuration(m, profile.preferences.timeFormat);
  const [newSubject, setNewSubject] = useState('');
  const [mock, setMock] = useState({ date: '', name: '', score: '', maxScore: '', rank: '' });

  const save = (patch) => update('goals', goal.id, { exam: { ...exam, ...patch } });
  const changeSubject = (id, patch) => save({ subjects: exam.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const mocks = (e?.mocks || []).map((m) => ({ ...m, label: fmtShort(m.date), pct: Number(m.percent.toFixed(1)) }));

  return (
    <div className="stack">
      <div className="grid-4">
        <StatTile label="Syllabus coverage" value={fmtPct(e?.overall, 1)} foot={e?.expected != null ? <>expected ≈{fmtPct(e.expected)} by today {e.behind && <ToneBadge tone="warning">Behind</ToneBadge>}</> : 'weighted by marks'} />
        <StatTile label="Days to exam" value={e?.daysToExam != null ? Math.max(0, e.daysToExam) : '—'} foot={exam.date ? fmtDate(exam.date) : 'Set exam date'} />
        <StatTile label="Prep time" value={fmt(e?.studyMin)} foot={`${fmt(e?.weekMin)} this week`} />
        <StatTile label="Best mock" value={e?.bestMock ? fmtPct(e.bestMock.percent) : '—'} foot={e?.lastMock ? `Last: ${fmtPct(e.lastMock.percent)}` : 'No mocks yet'} />
      </div>

      <Card title={`${exam.name || goal.title} subjects`} icon={BookMarked} sub="Click a subject to manage topics, lectures and targets. Progress = topics 65% + lectures 35%.">
        {exam.subjects.length === 0 ? (
          <Empty title="No subjects yet" action={
            /gate/i.test(`${goal.title} ${exam.name}`) && (
              <button type="button" className="btn btn-sm" onClick={() => save({ subjects: GATE_CS_SUBJECTS.map((x) => ({ id: uid('es_'), name: x.name, weight: x.weight, topics: [], lecturesTotal: null, lecturesDone: 0, questionsSolved: 0, revisions: 0, weeklyHoursTarget: null, notes: '' })) })}>
                Add GATE CSE subjects
              </button>
            )
          } />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Progress</th>
                  <th className="num">Lectures</th>
                  <th className="num">Study</th>
                  <th className="num">Questions</th>
                  <th className="num">This week</th>
                </tr>
              </thead>
              <tbody>
                {e.subjects.map((sp) => (
                  <SubjectRow
                    key={sp.subject.id}
                    sp={sp}
                    fmt={fmt}
                    onChange={(patch) => changeSubject(sp.subject.id, patch)}
                    onRemove={async () => {
                      if (await confirm({ title: `Remove ${sp.subject.name}?`, message: 'Its topics and counters are removed. Linked study sessions are kept.', confirmLabel: 'Remove', danger: true })) {
                        save({ subjects: exam.subjects.filter((x) => x.id !== sp.subject.id) });
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form
          className="row-sm mt"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!newSubject.trim()) return;
            save({ subjects: [...exam.subjects, { id: uid('es_'), name: newSubject.trim(), weight: null, topics: [], lecturesTotal: null, lecturesDone: 0, questionsSolved: 0, revisions: 0, weeklyHoursTarget: null, notes: '' }] });
            setNewSubject('');
          }}
        >
          <input className="input sm grow" placeholder="Add a subject (e.g. Compiler Design)" value={newSubject} onChange={(ev) => setNewSubject(ev.target.value)} aria-label="New exam subject" />
          <button type="submit" className="btn btn-sm"><Plus size={13} /> Add subject</button>
        </form>
      </Card>

      <div className="grid-2">
        <ChartCard title="Mock test scores" icon={Trophy} rows={mocks} columns={[{ key: 'label', label: 'Date' }, { key: 'name', label: 'Test' }, { key: 'pct', label: '%' }, { key: 'rank', label: 'Rank' }]} height={220} empty={mocks.length < 1 ? <Empty title="No mock tests yet" /> : null}>
          <ResponsiveContainer>
            <LineChart data={mocks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip labelFormatter={(l, p) => p?.[0]?.payload?.name || l} formatter={(v) => `${v}%`} />} />
              <Line dataKey="pct" name="Score" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4, fill: 'var(--series-2)', stroke: 'var(--surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card title="Mock tests">
          <form
            className="grid-6"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!mock.score || !mock.maxScore) return;
              save({ mocks: [...(exam.mocks || []), { id: uid('mk_'), date: mock.date || new Date().toISOString().slice(0, 10), name: mock.name || 'Mock test', score: Number(mock.score), maxScore: Number(mock.maxScore), rank: mock.rank ? Number(mock.rank) : null, notes: '' }] });
              setMock({ date: '', name: '', score: '', maxScore: '', rank: '' });
            }}
          >
            <input className="input sm" style={{ gridColumn: 'span 2' }} type="date" aria-label="Mock date" value={mock.date} onChange={(ev) => setMock({ ...mock, date: ev.target.value })} />
            <input className="input sm" style={{ gridColumn: 'span 4' }} placeholder="Test name" aria-label="Mock name" value={mock.name} onChange={(ev) => setMock({ ...mock, name: ev.target.value })} />
            <input className="input sm" style={{ gridColumn: 'span 2' }} type="number" step="any" placeholder="Score" aria-label="Score" value={mock.score} onChange={(ev) => setMock({ ...mock, score: ev.target.value })} />
            <input className="input sm" style={{ gridColumn: 'span 2' }} type="number" step="any" placeholder="Out of" aria-label="Maximum score" value={mock.maxScore} onChange={(ev) => setMock({ ...mock, maxScore: ev.target.value })} />
            <input className="input sm" type="number" placeholder="Rank" aria-label="Rank" value={mock.rank} onChange={(ev) => setMock({ ...mock, rank: ev.target.value })} />
            <button type="submit" className="btn btn-sm" aria-label="Add mock"><Plus size={13} /></button>
          </form>
          <div className="list mt">
            {[...(exam.mocks || [])].sort((x, y) => String(y.date).localeCompare(String(x.date))).map((m) => (
              <div key={m.id} className="list-item">
                <div className="li-main">
                  <div className="li-title small">{m.name}</div>
                  <div className="li-sub">{fmtDate(m.date)}{m.rank ? ` · rank ${m.rank}` : ''}</div>
                </div>
                <b className="small">{m.score}/{m.maxScore} ({fmtPct((m.score / m.maxScore) * 100)})</b>
                <button type="button" className="icon-btn sm danger" aria-label="Delete mock" onClick={() => save({ mocks: exam.mocks.filter((x) => x.id !== m.id) })}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
