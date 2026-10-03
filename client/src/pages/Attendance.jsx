import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, ChevronLeft, ChevronRight, Plus, Save, Trash2, CheckCheck, School } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile, Callout } from '../components/ui/Card.jsx';
import { RiskBadge, ProgressBar, toneColor } from '../components/ui/Indicators.jsx';
import { Segmented } from '../components/ui/Fields.jsx';
import { ChartCard, ChartTooltip, axisProps, gridProps, BAR_RADIUS } from '../components/charts/ChartKit.jsx';
import { addDaysISO, fmtDate, fmtShort, isISODate, weekdayKey } from '../lib/dates.js';
import { fmtPct } from '../lib/format.js';
import { uid } from '../lib/ids.js';
import { attendanceStats } from '../logic/attendance.js';
import { Info } from 'lucide-react';

const STATUS_OPTS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'cancelled', label: 'Cancelled' },
];

function buildRows(date, records, semester, subjects) {
  const existing = records.filter((r) => r.date === date && subjects.some((s) => s.id === r.subjectId));
  if (existing.length) return existing.map((r) => ({ ...r, key: r.id, saved: true }));
  const slots = (semester?.timetable?.[weekdayKey(date)] || []).filter((sl) => subjects.some((s) => s.id === sl.subjectId));
  return slots
    .slice()
    .sort((x, y) => String(x.time || '').localeCompare(String(y.time || '')))
    .map((sl) => ({ key: uid('r_'), subjectId: sl.subjectId, slotType: sl.slotType || 'lecture', time: sl.time || '', status: 'present', count: sl.slotType === 'lab' ? 2 : 1, topic: '', faculty: '', reason: '', saved: false }));
}

export default function Attendance() {
  const { data, profile, analysis: a, today, create, bulkCreate, update, remove } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const date = isISODate(params.get('date')) ? params.get('date') : today;
  const setDate = (d) => setParams(d === today ? {} : { date: d }, { replace: true });
  const semester = a.currentSemester;
  const subjects = a.current?.subjects || [];
  const threshold = profile.grading.attendanceThreshold;
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    setRows(buildRows(date, data.attendance, semester, subjects));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, data.attendance, semester?.id, semester?.timetable, subjects.length]);

  const log = data.dailyLogs.find((l) => l.date === date);
  const stats = a.attendance;
  const dayStats = useMemo(() => attendanceStats(data.attendance.filter((r) => r.date === date), subjects, threshold), [data.attendance, date, subjects, threshold]);

  const change = (key, patch) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const fresh = rows.filter((r) => !r.saved);
      const keep = new Set(rows.filter((r) => r.saved).map((r) => r.id));
      const removed = data.attendance.filter((r) => r.date === date && subjects.some((s) => s.id === r.subjectId) && !keep.has(r.id));
      for (const r of removed) await remove('attendance', r.id);
      for (const r of rows.filter((x) => x.saved)) {
        const orig = data.attendance.find((x) => x.id === r.id);
        if (orig && ['status', 'topic', 'reason', 'slotType', 'time', 'count', 'faculty'].some((k) => orig[k] !== r[k])) {
          await update('attendance', r.id, { status: r.status, topic: r.topic, reason: r.reason, slotType: r.slotType, time: r.time, count: r.count, faculty: r.faculty });
        }
      }
      if (fresh.length) {
        await bulkCreate('attendance', fresh.map(({ key: _k, saved: _s, ...r }) => ({ ...r, date })));
      }
      const attendedAny = rows.some((r) => r.status === 'present');
      if (rows.length && (!log || log.collegeAttended == null)) {
        if (log) await update('dailyLogs', log.id, { collegeAttended: attendedAny });
        else await create('dailyLogs', { date, collegeAttended: attendedAny });
      }
      setDirty(false);
      toast(`Attendance saved for ${fmtDate(date)}`);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  const setCollege = async (value) => {
    if (log) await update('dailyLogs', log.id, { collegeAttended: value });
    else await create('dailyLogs', { date, collegeAttended: value });
    if (value === false && rows.length && rows.every((r) => !r.saved)) {
      setRows((rs) => rs.map((r) => ({ ...r, status: 'absent' })));
      setDirty(true);
    }
  };

  const weekly = stats.weekly.slice(-12).map((w) => ({ ...w, label: fmtShort(w.week), pct: w.percent != null ? Math.round(w.percent) : null }));
  const history = data.attendance
    .filter((r) => subjects.some((s) => s.id === r.subjectId) && (!filterSubject || r.subjectId === filterSubject))
    .sort((x, y) => y.date.localeCompare(x.date) || String(x.time).localeCompare(String(y.time)))
    .slice(0, 60);

  if (!semester || !subjects.length) {
    return (
      <div>
        <PageHeader eyebrow="Attendance" title="College attendance" />
        <Card>
          <Empty icon={CalendarCheck} title="Add subjects to your current semester first">Then mark which lectures you attend each day.</Empty>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Attendance · ${semester.name}`}
        title="Lectures & attendance"
        description={`Mark each lecture you attend or miss. Requirement: ${threshold}% (change in Settings).`}
      />

      <div className="grid-4 mb">
        <StatTile label="Overall attendance" value={stats.overall.total ? fmtPct(stats.overall.percent, 1) : '—'} foot={stats.overall.total ? <><RiskBadge level={stats.overall.risk} /> {stats.overall.present}/{stats.overall.total}</> : 'No records'} />
        <StatTile label="Can still miss" value={stats.overall.total ? stats.overall.canMiss : '—'} foot="classes overall, staying ≥ requirement" />
        <StatTile label="Subjects at risk" value={stats.bySubject.filter((s) => s.risk === 'critical').length} foot={`${stats.bySubject.filter((s) => s.risk === 'warning').length} close to the limit`} />
        <StatTile label="Projected end of semester" value={a.predictions.attendance?.percent != null ? fmtPct(a.predictions.attendance.percent) : '—'} foot={a.predictions.attendance ? `Estimate · last 4 weeks at ${fmtPct(a.predictions.attendance.recentRate)}` : 'Needs a semester end date'} />
      </div>

      <div className="grid-3">
        <Card className="span-2" title={fmtDate(date, 'EEEE, d MMMM yyyy')} icon={CalendarCheck} action={
          <div className="row-sm">
            <button type="button" className="icon-btn sm" aria-label="Previous day" onClick={() => setDate(addDaysISO(date, -1))}><ChevronLeft size={16} /></button>
            <input className="input sm" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" style={{ width: 150 }} />
            <button type="button" className="icon-btn sm" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDaysISO(date, 1))}><ChevronRight size={16} /></button>
          </div>
        }>
          <div className="row wrap between mb">
            <div className="row-sm">
              <School size={15} className="muted" />
              <span className="small text-2">College today:</span>
              <Segmented
                label="College attended"
                value={log?.collegeAttended ?? null}
                onChange={setCollege}
                options={[
                  { value: true, label: 'Attended' },
                  { value: false, label: 'Not attended' },
                ]}
              />
            </div>
            {rows.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRows(rows.map((r) => ({ ...r, status: 'present' }))); setDirty(true); }}>
                <CheckCheck size={14} /> All present
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <Empty icon={CalendarCheck} title="No lectures listed for this day">
              Add lectures below, or set up your weekly timetable on the semester page so days fill in automatically.
            </Empty>
          ) : (
            <>
              {rows.some((r) => !r.saved) && (
                <div className="mb">
                  <Callout tone="info" icon={Info}>Pre-filled from your timetable — adjust and save.</Callout>
                </div>
              )}
              <div className="table-wrap">
                <table className="table comp-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Subject</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Topic / note</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td style={{ width: 100 }}>
                          <input className="input" type="time" value={r.time || ''} aria-label="Time" onChange={(e) => change(r.key, { time: e.target.value })} />
                        </td>
                        <td className="w-sel">
                          <select className="select" value={r.subjectId} aria-label="Subject" onChange={(e) => change(r.key, { subjectId: e.target.value })}>
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>{s.code || s.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ width: 110 }}>
                          <select className="select" value={r.slotType} aria-label="Type" onChange={(e) => change(r.key, { slotType: e.target.value, count: e.target.value === 'lab' ? 2 : 1 })}>
                            <option value="lecture">Lecture</option>
                            <option value="lab">Lab (2)</option>
                            <option value="tutorial">Tutorial</option>
                          </select>
                        </td>
                        <td>
                          <Segmented label="Attendance status" value={r.status} onChange={(v) => change(r.key, { status: v })} options={STATUS_OPTS} />
                        </td>
                        <td className="w-name">
                          <input className="input" value={r.status === 'absent' ? r.reason || '' : r.topic || ''} placeholder={r.status === 'absent' ? 'Reason (optional)' : 'Topic covered'} aria-label="Topic or reason" onChange={(e) => change(r.key, r.status === 'absent' ? { reason: e.target.value } : { topic: e.target.value })} />
                        </td>
                        <td>
                          <button type="button" className="icon-btn sm danger" aria-label="Remove lecture" onClick={() => { setRows(rows.filter((x) => x.key !== r.key)); setDirty(true); }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="row between mt wrap">
            <button type="button" className="btn btn-sm" onClick={() => { setRows([...rows, { key: uid('r_'), subjectId: subjects[0].id, slotType: 'lecture', time: '', status: 'present', count: 1, topic: '', faculty: '', reason: '', saved: false }]); setDirty(true); }}>
              <Plus size={14} /> Add lecture
            </button>
            <div className="row-sm">
              {dayStats.overall.total > 0 && <span className="small muted">Saved: {dayStats.overall.present}/{dayStats.overall.total} attended</span>}
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || busy}>
                <Save size={14} /> {busy ? 'Saving…' : 'Save day'}
              </button>
            </div>
          </div>
        </Card>

        <ChartCard
          title="Weekly attendance"
          sub="% of classes attended per week"
          rows={weekly}
          columns={[{ key: 'label', label: 'Week of' }, { key: 'pct', label: '%' }, { key: 'present', label: 'Present' }, { key: 'total', label: 'Total' }]}
          height={240}
          empty={!weekly.length ? <Empty title="No data yet" /> : null}
        >
          <ResponsiveContainer>
            <BarChart data={weekly} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
              <ReferenceLine y={threshold} stroke="var(--critical)" strokeDasharray="4 4" />
              <Bar dataKey="pct" name="Attendance" fill="var(--series-3)" radius={BAR_RADIUS} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid-2 mt">
        <Card title="Subject-wise attendance" sub="Lectures, labs and tutorials combined; labs count as their period count">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="num">Attended</th>
                  <th style={{ width: '28%' }}>%</th>
                  <th className="num">Margin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.bySubject.map((s) => (
                  <tr key={s.subject.id}>
                    <td>
                      <div className="strong small">{s.subject.code || s.subject.name}</div>
                      <div className="tiny muted">
                        {['lecture', 'lab', 'tutorial'].filter((k) => s.byType[k].total).map((k) => `${k} ${s.byType[k].present}/${s.byType[k].total}`).join(' · ')}
                      </div>
                    </td>
                    <td className="num">{s.total ? `${s.present}/${s.total}` : '—'}</td>
                    <td>
                      {s.total ? (
                        <div className="stack-xs">
                          <span className="small tabular">{fmtPct(s.percent, 1)}</span>
                          <ProgressBar value={s.percent} size="thin" color={toneColor(s.risk === 'safe' ? 'good' : s.risk)} marker={threshold} />
                        </div>
                      ) : '—'}
                    </td>
                    <td className="num small">{!s.total ? '—' : s.risk === 'safe' || s.canMiss > 0 ? `miss ≤ ${s.canMiss}` : `attend ${s.mustAttend}`}</td>
                    <td>{s.total ? <RiskBadge level={s.risk} /> : <span className="muted small">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Lecture history" action={
          <select className="select sm" style={{ width: 160 }} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name}</option>)}
          </select>
        }>
          {history.length === 0 ? (
            <Empty title="No lectures recorded" />
          ) : (
            <div className="list" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {history.map((r) => (
                <div key={r.id} className="list-item">
                  <span className="tone-dot" style={{ background: r.status === 'present' ? 'var(--good)' : r.status === 'absent' ? 'var(--critical)' : 'var(--muted)' }} />
                  <div className="li-main">
                    <div className="li-title small">
                      {a.subjectById[r.subjectId]?.code || a.subjectById[r.subjectId]?.name} · {r.slotType} · <span style={{ textTransform: 'capitalize' }}>{r.status}</span>
                    </div>
                    <div className="li-sub">{[fmtDate(r.date, 'EEE d MMM'), r.time, r.topic || r.reason].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(r.date)}>Edit day</button>
                  <button
                    type="button"
                    className="icon-btn sm danger"
                    aria-label="Delete record"
                    onClick={async () => {
                      if (await confirm({ title: 'Delete this attendance record?', confirmLabel: 'Delete', danger: true })) {
                        await remove('attendance', r.id);
                        toast('Record deleted');
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
