import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, CalendarDays, Clock, Flame, Pencil, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { Segmented } from '../components/ui/Fields.jsx';
import { ProgressBar } from '../components/ui/Indicators.jsx';
import { ChartCard, ChartTooltip, axisProps, gridProps, BAR_RADIUS, HBAR_RADIUS } from '../components/charts/ChartKit.jsx';
import { CalendarHeatmap } from '../components/charts/CalendarHeatmap.jsx';
import { breakdown, dailySeries, minutesOf, monthlySeries, sessionsBetween, consistency } from '../logic/study.js';
import { fmtDuration, fmtPct, groupBy, plural } from '../lib/format.js';
import { fmtDate, fmtMonth, fmtShort, isISODate, monthStartISO, weekStartISO } from '../lib/dates.js';

const RANGES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'semester', label: 'Semester' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

export default function Study() {
  const { data, profile, analysis: a, today, remove } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState('month');
  const [filters, setFilters] = useState({ subjectId: '', type: '', goalId: '' });
  const tf = profile.preferences.timeFormat;
  const fmt = (m) => fmtDuration(m, tf);
  const sessions = data.studySessions;
  const dateFilter = isISODate(params.get('date')) ? params.get('date') : null;

  useEffect(() => {
    const subject = params.get('subject');
    if (subject) {
      openForm('study', { defaults: { subjectId: subject } });
      setParams({}, { replace: true });
    }
  }, [params, openForm, setParams]);

  const start = useMemo(() => {
    if (range === 'week') return weekStartISO(today);
    if (range === 'month') return monthStartISO(today);
    if (range === 'semester') return a.currentSemester?.startDate || monthStartISO(today);
    if (range === 'year') return `${today.slice(0, 4)}-01-01`;
    return sessions.reduce((m, s) => (s.date < m ? s.date : m), today);
  }, [range, today, a.currentSemester, sessions]);

  const inRange = useMemo(() => sessionsBetween(sessions, start, today), [sessions, start, today]);
  const long = range === 'year' || range === 'all';
  const series = useMemo(() => {
    if (long) {
      return monthlySeries(inRange).map((m) => ({ label: fmtMonth(m.month), hours: Number((m.minutes / 60).toFixed(1)), minutes: m.minutes }));
    }
    return dailySeries(sessions, start, today).map((d) => ({ label: fmtShort(d.date), hours: Number((d.minutes / 60).toFixed(2)), minutes: d.minutes }));
  }, [long, inRange, sessions, start, today]);

  const subjectName = (id) => a.subjectById[id]?.code || a.subjectById[id]?.name || 'Unlinked';
  const goalName = (id) => data.goals.find((g) => g.id === id)?.title || 'No goal';
  const bySubject = breakdown(inRange.filter((s) => s.subjectId), (s) => s.subjectId).map((x) => ({ ...x, name: subjectName(x.key), hours: Number((x.minutes / 60).toFixed(1)) }));
  const byType = breakdown(inRange, (s) => s.type || 'Other').map((x) => ({ ...x, name: x.key, hours: Number((x.minutes / 60).toFixed(1)) }));
  const byGoal = breakdown(inRange.filter((s) => s.goalId), (s) => s.goalId).map((x) => ({ ...x, name: goalName(x.key) }));
  const total = minutesOf(inRange);
  const days = Math.max(1, series.length && !long ? series.length : Math.round((new Date(today) - new Date(start)) / 864e5) + 1);
  const heatValues = useMemo(() => Object.fromEntries(Object.entries(groupBy(sessions, (s) => s.date)).map(([d, l]) => [d, minutesOf(l)])), [sessions]);

  const list = useMemo(
    () =>
      [...sessions]
        .filter((s) => (dateFilter ? s.date === dateFilter : true))
        .filter((s) => !filters.subjectId || s.subjectId === filters.subjectId)
        .filter((s) => !filters.type || s.type === filters.type)
        .filter((s) => !filters.goalId || s.goalId === filters.goalId)
        .sort((x, y) => y.date.localeCompare(x.date) || String(y.createdAt).localeCompare(String(x.createdAt)))
        .slice(0, 100),
    [sessions, filters, dateFilter]
  );

  const del = async (s) => {
    if (!(await confirm({ title: 'Delete this study session?', message: `${fmt(s.durationMin)} on ${fmtDate(s.date)}`, confirmLabel: 'Delete', danger: true }))) return;
    await remove('studySessions', s.id);
    toast('Session deleted');
  };

  const st = a.study;
  return (
    <div>
      <PageHeader
        eyebrow="Study tracker"
        title="Study"
        description="Every session, by subject, type and goal — with daily to yearly analytics."
        actions={<button type="button" className="btn btn-primary" onClick={() => openForm('study')}><Plus size={15} /> Log session</button>}
      />
      <div className="grid-4 mb">
        <StatTile icon={Clock} label="Today" value={fmt(st.today)} foot={st.dailyTargetMin ? <ProgressBar value={st.today} max={st.dailyTargetMin} size="thin" className="grow" label="Daily target" /> : null} />
        <StatTile icon={CalendarDays} label="This week" value={fmt(st.thisWeek)} foot={st.weeklyTargetMin ? `${fmtPct((st.thisWeek / st.weeklyTargetMin) * 100)} of ${fmt(st.weeklyTargetMin)} · last week ${fmt(st.lastWeek)}` : `last week ${fmt(st.lastWeek)}`} />
        <StatTile icon={Flame} label="Streak" value={plural(st.streak.current, 'day')} foot={`Longest ${plural(st.streak.longest, 'day')}`} />
        <StatTile icon={TrendingUp} label="Consistency (4 wk)" value={fmtPct(st.consistency28)} foot={`≈${fmt(st.avgPerDay28)} per day · month projection ${fmt(a.predictions.study.monthProjectedMin)} (est.)`} />
      </div>

      <div className="row between wrap mb">
        <Segmented label="Range" value={range} onChange={setRange} options={RANGES} />
        <span className="small text-2">
          {fmtDate(start)} – {fmtDate(today)} · <b>{fmt(total)}</b> total · {fmt(total / days)} per day · consistency {fmtPct(consistency(sessions, start, today))}
        </span>
      </div>

      <div className="grid-3 mb">
        <ChartCard
          className="span-2"
          title={long ? 'Study hours per month' : 'Study hours per day'}
          icon={BookOpen}
          rows={series}
          columns={[{ key: 'label', label: long ? 'Month' : 'Day' }, { key: 'minutes', label: 'Time', format: (v) => fmt(v) }]}
          empty={!total ? <Empty icon={BookOpen} title="No study logged in this range" action={<button type="button" className="btn btn-sm" onClick={() => openForm('study')}><Plus size={14} /> Log session</button>} /> : null}
        >
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={14} />
              <YAxis {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => fmt(p.payload.minutes)} />} />
              {!long && st.dailyTargetMin > 0 && <ReferenceLine y={st.dailyTargetMin / 60} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'target', fill: 'var(--muted)', fontSize: 10, position: 'insideTopRight' }} />}
              <Bar dataKey="hours" name="Study" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="By study type" rows={byType} columns={[{ key: 'name', label: 'Type' }, { key: 'minutes', label: 'Time', format: (v) => fmt(v) }, { key: 'count', label: 'Sessions' }]} empty={!byType.length ? <Empty title="No data" /> : null}>
          <ResponsiveContainer>
            <BarChart data={byType.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" {...axisProps} width={96} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => fmt(p.payload.minutes)} />} />
              <Bar dataKey="hours" name="Time" fill="var(--series-7)" radius={HBAR_RADIUS} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid-3 mb">
        <ChartCard title="By subject" rows={bySubject} columns={[{ key: 'name', label: 'Subject' }, { key: 'minutes', label: 'Time', format: (v) => fmt(v) }, { key: 'count', label: 'Sessions' }]} empty={!bySubject.length ? <Empty title="No subject-linked sessions" /> : null}>
          <ResponsiveContainer>
            <BarChart data={bySubject.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" {...axisProps} width={70} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => fmt(p.payload.minutes)} />} />
              <Bar dataKey="hours" name="Time" fill="var(--series-3)" radius={HBAR_RADIUS} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card title="By goal" icon={Target}>
          {byGoal.length === 0 ? (
            <Empty title="No goal-linked sessions">Link sessions to goals (e.g. GATE) to track goal hours.</Empty>
          ) : (
            <div className="stack">
              {byGoal.map((g) => (
                <div key={g.key} className="stack-xs">
                  <div className="row between small">
                    <span className="truncate strong">{g.name}</span>
                    <span>{fmt(g.minutes)}</span>
                  </div>
                  <ProgressBar value={g.minutes} max={byGoal[0].minutes} size="thin" color="var(--series-2)" />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Activity heatmap" sub="Last 26 weeks — click a day to see its sessions">
          <CalendarHeatmap values={heatValues} end={today} weeks={26} format={(v) => (v ? fmt(v) : 'no study')} label="Study" onSelect={(d) => setParams({ date: d })} />
        </Card>
      </div>

      <Card
        title={dateFilter ? `Sessions on ${fmtDate(dateFilter)}` : 'Sessions'}
        action={
          <div className="row-sm wrap">
            {dateFilter && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({})}>Clear date</button>}
            <select className="select sm" style={{ width: 150 }} value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })} aria-label="Filter by subject">
              <option value="">All subjects</option>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code || s.name}</option>)}
            </select>
            <select className="select sm" style={{ width: 140 }} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} aria-label="Filter by type">
              <option value="">All types</option>
              {profile.preferences.studyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="select sm" style={{ width: 150 }} value={filters.goalId} onChange={(e) => setFilters({ ...filters, goalId: e.target.value })} aria-label="Filter by goal">
              <option value="">All goals</option>
              {data.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        }
      >
        {list.length === 0 ? (
          <Empty icon={BookOpen} title="No sessions match" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th>Type</th>
                  <th className="num">Duration</th>
                  <th className="num">Productivity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const goal = data.goals.find((g) => g.id === s.goalId);
                  const es = goal?.exam?.subjects?.find((x) => x.id === s.examSubjectId);
                  return (
                    <tr key={s.id}>
                      <td className="small nowrap">{fmtDate(s.date, 'EEE d MMM')}</td>
                      <td>
                        <div className="small strong">{s.topic || (s.subjectId ? a.subjectById[s.subjectId]?.name : es?.name) || s.type}</div>
                        <div className="tiny muted">{[s.subjectId && subjectName(s.subjectId), goal?.title, es?.name, s.questionsSolved ? `${s.questionsSolved} questions` : null].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="small">{s.type}</td>
                      <td className="num small">{fmt(s.durationMin)}</td>
                      <td className="num small">{s.productivity ? `${s.productivity}/5` : '—'}</td>
                      <td className="right nowrap">
                        <button type="button" className="icon-btn sm" aria-label="Edit session" onClick={() => openForm('study', { session: s })}><Pencil size={14} /></button>
                        <button type="button" className="icon-btn sm danger" aria-label="Delete session" onClick={() => del(s)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
