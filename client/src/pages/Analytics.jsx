import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Scatter } from 'recharts';
import { BookOpen, CalendarCheck, GraduationCap, HeartPulse, ListChecks } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Card, Empty, PageHeader, Tabs } from '../components/ui/Card.jsx';
import { StateChip } from '../components/ui/Indicators.jsx';
import { ChartCard, ChartTooltip, Legend, axisProps, gridProps, BAR_RADIUS, HBAR_RADIUS } from '../components/charts/ChartKit.jsx';
import { attendanceStats } from '../logic/attendance.js';
import { evaluateSubject, compareSemesters } from '../logic/academics.js';
import { lifestyleSeries } from '../logic/lifestyle.js';
import { breakdown, minutesOf, weeklySeries } from '../logic/study.js';
import { avg, fmtDuration, fmtGpa, fmtPct, groupBy, isNum, round } from '../lib/format.js';
import { addDaysISO, fmtMonth, fmtShort, monthKey, subDaysISO, weekStartISO } from '../lib/dates.js';
import { isOpenAssignment } from '../logic/insights.js';

const TABS = [
  { value: 'academics', label: 'Academics', icon: GraduationCap },
  { value: 'study', label: 'Study', icon: BookOpen },
  { value: 'lifestyle', label: 'Lifestyle', icon: HeartPulse },
  { value: 'tasks', label: 'Tasks', icon: ListChecks },
  { value: 'attendance', label: 'Attendance', icon: CalendarCheck },
];

const SRC = { official: 'official', confirmed: 'confirmed', projected: 'projected', empty: 'pending', simulated: 'hypothetical' };

function AcademicsTab() {
  const { data, profile, analysis: a } = useData();
  const grading = profile.grading;
  const dec = grading.decimals ?? 2;
  const max = grading.maxPoint || 10;

  const semRows = a.cumulative.series.map((s) => ({
    name: s.name.replace('Semester ', 'S'),
    fullName: s.name,
    sgpa: isNum(s.sgpa) ? round(s.sgpa, dec) : null,
    target: isNum(s.target) ? s.target : null,
    cgpa: isNum(s.cgpa) ? round(s.cgpa, dec) : isNum(s.projectedCgpa) ? round(s.projectedCgpa, dec) : null,
    status: s.sgpaStatus,
  }));

  const subj = a.subjectStats.map((s) => ({
    name: s.subject.code || s.subject.name.slice(0, 10),
    fullName: s.subject.name,
    actual: isNum(s.percent) ? round(s.percent, 1) : null,
    target: isNum(s.targetPercent) ? s.targetPercent : null,
    theory: isNum(s.splits.theory) ? round(s.splits.theory, 1) : null,
    practical: isNum(s.splits.practical) ? round(s.splits.practical, 1) : null,
    internal: isNum(s.splits.internal) ? round(s.splits.internal, 1) : null,
    external: isNum(s.splits.external) ? round(s.splits.external, 1) : null,
    credits: s.credits,
    creditPoints: isNum(s.points) ? round(s.points * s.credits, 1) : null,
    grade: s.grade?.grade,
  }));

  const allSubjects = useMemo(() => {
    const sems = [...data.semesters].sort(compareSemesters);
    return sems.flatMap((sem) =>
      data.subjects
        .filter((s) => s.semesterId === sem.id)
        .flatMap((s) => evaluateSubject(s, grading).map((u) => ({ sem, s, u })))
    );
  }, [data.semesters, data.subjects, grading]);

  const semCompare = a.semesterResults.map((r) => ({
    r,
    avgPct: avg(r.units.filter((u) => isNum(u.percent)).map((u) => u.percent)),
  }));

  return (
    <div className="stack">
      <div className="grid-2">
        <ChartCard
          title="SGPA vs target by semester"
          sub="Bars: SGPA · dots: target SGPA · line: CGPA after each semester"
          rows={semRows}
          columns={[{ key: 'fullName', label: 'Semester' }, { key: 'sgpa', label: 'SGPA', format: (v, r) => `${v ?? '—'}${r.status === 'in-progress' ? ' (est.)' : ''}` }, { key: 'target', label: 'Target' }, { key: 'cgpa', label: 'CGPA' }]}
          legend={<Legend items={[{ label: 'SGPA', color: 'var(--series-1)' }, { label: 'Target', color: 'var(--series-4)' }, { label: 'CGPA', color: 'var(--series-2)', line: true }]} />}
          empty={!semRows.length ? <Empty title="No semesters" /> : null}
        >
          <ResponsiveContainer>
            <ComposedChart data={semRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} domain={[0, max]} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullName || l} />} />
              <Bar dataKey="sgpa" name="SGPA" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={24} />
              <Scatter dataKey="target" name="Target" fill="var(--series-4)" shape="diamond" />
              <Line dataKey="cgpa" name="CGPA" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4, fill: 'var(--series-2)', stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`Target vs actual · ${a.currentSemester?.name || 'current semester'}`}
          sub="Projected % per subject vs % needed for its target grade"
          rows={subj}
          columns={[{ key: 'fullName', label: 'Subject' }, { key: 'actual', label: 'Projected %' }, { key: 'target', label: 'Target %' }, { key: 'grade', label: 'Grade' }]}
          legend={<Legend items={[{ label: 'Projected %', color: 'var(--series-1)' }, { label: 'Target %', color: 'var(--series-4)' }]} />}
          empty={!subj.length ? <Empty title="No subjects in the current semester" /> : null}
        >
          <ResponsiveContainer>
            <BarChart data={subj} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullName || l} formatter={(v) => `${v}%`} />} />
              <Bar dataKey="actual" name="Projected %" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={18} />
              <Bar dataKey="target" name="Target %" fill="var(--series-4)" radius={BAR_RADIUS} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Theory vs practical"
          sub="Per subject, including provisional marks"
          rows={subj.filter((s) => s.theory != null || s.practical != null)}
          columns={[{ key: 'fullName', label: 'Subject' }, { key: 'theory', label: 'Theory %' }, { key: 'practical', label: 'Practical %' }]}
          legend={<Legend items={[{ label: 'Theory', color: 'var(--series-1)' }, { label: 'Practical', color: 'var(--series-2)' }]} />}
          empty={!subj.some((s) => s.theory != null || s.practical != null) ? <Empty title="No marks yet" /> : null}
        >
          <ResponsiveContainer>
            <BarChart data={subj} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
              <Bar dataKey="theory" name="Theory" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={18} />
              <Bar dataKey="practical" name="Practical" fill="var(--series-2)" radius={BAR_RADIUS} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Internal vs external"
          sub="Per subject, including provisional marks"
          rows={subj}
          columns={[{ key: 'fullName', label: 'Subject' }, { key: 'internal', label: 'Internal %' }, { key: 'external', label: 'External %' }]}
          legend={<Legend items={[{ label: 'Internal', color: 'var(--series-3)' }, { label: 'External', color: 'var(--series-7)' }]} />}
          empty={!subj.some((s) => s.internal != null || s.external != null) ? <Empty title="No marks yet" /> : null}
        >
          <ResponsiveContainer>
            <BarChart data={subj} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
              <Bar dataKey="internal" name="Internal" fill="var(--series-3)" radius={BAR_RADIUS} maxBarSize={18} />
              <Bar dataKey="external" name="External" fill="var(--series-7)" radius={BAR_RADIUS} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid-2">
        <ChartCard
          title="Credit-weighted contribution"
          sub="Credit points (credits × grade points) each subject adds to the SGPA numerator"
          rows={subj}
          columns={[{ key: 'fullName', label: 'Subject' }, { key: 'credits', label: 'Credits' }, { key: 'grade', label: 'Grade' }, { key: 'creditPoints', label: 'Credit points' }]}
          empty={!subj.length ? <Empty title="No subjects" /> : null}
        >
          <ResponsiveContainer>
            <BarChart data={subj} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" {...axisProps} width={60} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip labelFormatter={(l, p) => `${p?.[0]?.payload?.fullName} · ${p?.[0]?.payload?.credits} cr`} />} />
              <Bar dataKey="creditPoints" name="Credit points" fill="var(--series-1)" radius={HBAR_RADIUS} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card title="Semester comparison">
          {semCompare.length === 0 ? <Empty title="No semesters" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Semester</th><th className="num">Subjects</th><th className="num">Credits</th><th className="num">Avg score</th><th className="num">SGPA</th><th>Basis</th></tr></thead>
                <tbody>
                  {semCompare.map(({ r, avgPct }) => (
                    <tr key={r.semester.id}>
                      <td><Link to={`/academics/semesters/${r.semester.id}`}>{r.semester.name}</Link></td>
                      <td className="num">{r.subjects.length || '—'}</td>
                      <td className="num">{r.totalCredits || '—'}</td>
                      <td className="num">{fmtPct(avgPct)}</td>
                      <td className="num strong">{fmtGpa(r.effectiveSgpa, dec)}</td>
                      <td><StateChip state={r.status === 'in-progress' ? 'projected' : r.status === 'empty' ? 'pending' : r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="All subject grades" sub="Every subject across semesters">
        {allSubjects.length === 0 ? <Empty title="No subjects yet" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Semester</th><th>Subject</th><th className="num">Credits</th><th className="num">Score</th><th>Grade</th><th className="num">Points</th><th>Basis</th></tr></thead>
              <tbody>
                {allSubjects.map(({ sem, s, u }) => (
                  <tr key={u.key}>
                    <td className="small">{sem.name}</td>
                    <td><Link to={`/academics/subjects/${s.id}`}>{u.label}</Link></td>
                    <td className="num">{u.credits}</td>
                    <td className="num">{fmtPct(u.percent, 1)}</td>
                    <td className="strong">{u.grade?.grade ?? '—'}</td>
                    <td className="num">{u.points ?? '—'}</td>
                    <td><StateChip state={SRC[u.source]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StudyTab() {
  const { data, profile, analysis: a, today } = useData();
  const tf = profile.preferences.timeFormat;
  const fmt = (m) => fmtDuration(m, tf);
  const s = data.studySessions;
  const weeks = weeklySeries(s, 16, today).map((w) => {
    const days = new Set(s.filter((x) => x.date >= w.week && x.date <= addDaysISO(w.week, 6)).map((x) => x.date)).size;
    return { label: fmtShort(w.week), hours: round(w.minutes / 60, 1), minutes: w.minutes, days };
  });
  const months = Object.entries(groupBy(s, (x) => monthKey(x.date)))
    .sort(([x], [y]) => x.localeCompare(y))
    .slice(-12)
    .map(([m, list]) => ({ label: fmtMonth(m), hours: round(minutesOf(list) / 60, 1), minutes: minutesOf(list), days: new Set(list.map((x) => x.date)).size }));
  const semStart = a.currentSemester?.startDate;
  const semSessions = semStart ? s.filter((x) => x.date >= semStart) : [];
  const bySubject = breakdown(semSessions.filter((x) => x.subjectId), (x) => x.subjectId).map((x) => ({ name: a.subjectById[x.key]?.code || a.subjectById[x.key]?.name || '—', hours: round(x.minutes / 60, 1), minutes: x.minutes }));
  const byGoal = breakdown(s.filter((x) => x.goalId), (x) => x.goalId).map((x) => ({ name: data.goals.find((g) => g.id === x.key)?.title || '—', hours: round(x.minutes / 60, 1), minutes: x.minutes }));

  return (
    <div className="grid-2">
      <ChartCard title="Weekly study hours" sub="Last 16 weeks" rows={weeks} columns={[{ key: 'label', label: 'Week of' }, { key: 'minutes', label: 'Time', format: fmt }, { key: 'days', label: 'Days studied' }]}>
        <ResponsiveContainer>
          <BarChart data={weeks} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => fmt(p.payload.minutes)} />} />
            {a.study.weeklyTargetMin > 0 && <ReferenceLine y={a.study.weeklyTargetMin / 60} stroke="var(--muted)" strokeDasharray="4 4" />}
            <Bar dataKey="hours" name="Study" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Weekly consistency" sub="Days with any study, per week (out of 7)" rows={weeks} columns={[{ key: 'label', label: 'Week of' }, { key: 'days', label: 'Days' }]}>
        <ResponsiveContainer>
          <LineChart data={weeks} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} domain={[0, 7]} allowDecimals={false} />
            <Tooltip content={<ChartTooltip formatter={(v) => `${v}/7 days`} />} />
            <Line dataKey="days" name="Days studied" stroke="var(--series-3)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-3)', strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Monthly study & consistency" sub="Hours per month (last 12 months)" rows={months} columns={[{ key: 'label', label: 'Month' }, { key: 'minutes', label: 'Time', format: fmt }, { key: 'days', label: 'Days studied' }]} empty={!months.length ? <Empty title="No sessions yet" /> : null}>
        <ResponsiveContainer>
          <BarChart data={months} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => `${fmt(p.payload.minutes)} · ${p.payload.days} days`} />} />
            <Bar dataKey="hours" name="Study" fill="var(--series-7)" radius={BAR_RADIUS} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Subject-wise hours this semester" rows={bySubject} columns={[{ key: 'name', label: 'Subject' }, { key: 'minutes', label: 'Time', format: fmt }]} empty={!bySubject.length ? <Empty title="No subject-linked sessions this semester" /> : null}>
        <ResponsiveContainer>
          <BarChart data={bySubject} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="name" {...axisProps} width={60} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => fmt(p.payload.minutes)} />} />
            <Bar dataKey="hours" name="Study" fill="var(--series-3)" radius={HBAR_RADIUS} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Goal-related study hours" rows={byGoal} columns={[{ key: 'name', label: 'Goal' }, { key: 'minutes', label: 'Time', format: fmt }]} empty={!byGoal.length ? <Empty title="No goal-linked sessions" /> : null}>
        <ResponsiveContainer>
          <BarChart data={byGoal} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="name" {...axisProps} width={110} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v, n, p) => fmt(p.payload.minutes)} />} />
            <Bar dataKey="hours" name="Study" fill="var(--series-2)" radius={HBAR_RADIUS} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function LifestyleTab() {
  const { data, profile, analysis: a, today } = useData();
  const metrics = a.lifestyle.metrics;
  const rows = useMemo(() => {
    const daily = lifestyleSeries(data.dailyLogs, data.studySessions, subDaysISO(today, 83), today, metrics);
    return Object.entries(groupBy(daily, (r) => weekStartISO(r.date))).map(([week, list]) => {
      const out = { label: fmtShort(week) };
      for (const m of metrics) {
        const vals = list.map((x) => x[m.key]).filter(isNum);
        out[m.key] = vals.length ? round(avg(vals), 2) : null;
      }
      return out;
    });
  }, [data.dailyLogs, data.studySessions, today, metrics]);
  const prefs = profile.preferences;
  const charts = [
    ['sleep', 'Sleep (h/day)', 'var(--series-1)', prefs.sleepTargetHours],
    ['screen', 'Screen time (h/day)', 'var(--series-2)', prefs.screenLimitHours],
    ['social', 'Social media (h/day)', 'var(--series-5)', prefs.socialLimitHours],
    ['exercise', 'Exercise (min/day)', 'var(--series-4)', prefs.exerciseTargetMin],
    ['productivity', 'Productivity (/10)', 'var(--series-7)', null],
    ['study', 'Study (h/day)', 'var(--series-3)', prefs.dailyStudyTargetHours],
  ];
  if (!data.dailyLogs.length) return <Card><Empty icon={HeartPulse} title="No lifestyle logs yet" action={<Link to="/logbook" className="btn btn-sm">Open logbook</Link>} /></Card>;
  return (
    <div className="stack">
      <p className="small text-2">Weekly averages over the last 12 weeks. <Link to="/lifestyle">Open detailed lifestyle trends →</Link></p>
      <div className="grid-3">
        {charts.map(([key, title, color, ref]) => (
          <ChartCard key={key} title={title} rows={rows} columns={[{ key: 'label', label: 'Week of' }, { key, label: title }]} height={170}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
                <YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                {ref != null && <ReferenceLine y={ref} stroke="var(--muted)" strokeDasharray="4 4" />}
                <Line dataKey={key} name={title} stroke={color} strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ))}
      </div>
    </div>
  );
}

function TasksTab() {
  const { data, today } = useData();
  const t = data.tasks;
  const asg = data.assignments.filter((x) => !x.archived);
  const counts = [
    { name: 'Tasks', completed: t.filter((x) => x.status === 'done').length, missed: t.filter((x) => x.status === 'skipped').length, late: t.filter((x) => (x.status === 'todo' || x.status === 'in-progress') && x.dueDate && x.dueDate < today).length, pending: t.filter((x) => (x.status === 'todo' || x.status === 'in-progress') && (!x.dueDate || x.dueDate >= today)).length },
    { name: 'Submissions', completed: asg.filter((x) => x.status === 'submitted').length, missed: asg.filter((x) => x.status === 'missed').length, late: asg.filter((x) => x.status === 'late' || (isOpenAssignment(x) && x.dueDate && x.dueDate < today)).length, pending: asg.filter((x) => isOpenAssignment(x) && (!x.dueDate || x.dueDate >= today)).length },
  ];
  const weekly = weeklySeries([], 12, today).map((w) => ({
    label: fmtShort(w.week),
    completed: t.filter((x) => x.status === 'done' && x.completedAt >= w.week && x.completedAt <= addDaysISO(w.week, 6)).length + asg.filter((x) => (x.status === 'submitted' || x.status === 'late') && x.submittedDate >= w.week && x.submittedDate <= addDaysISO(w.week, 6)).length,
  }));
  const STATUS = [['completed', 'Completed', 'var(--series-3)'], ['late', 'Late / overdue', 'var(--series-2)'], ['missed', 'Missed / skipped', 'var(--series-8)'], ['pending', 'Pending', 'var(--series-1)']];
  return (
    <div className="grid-2">
      <ChartCard title="Completed, late, missed & pending" rows={counts} columns={[{ key: 'name', label: 'Type' }, ...STATUS.map(([k, l]) => ({ key: k, label: l }))]} legend={<Legend items={STATUS.map(([, l, c]) => ({ label: l, color: c }))} />}>
        <ResponsiveContainer>
          <BarChart data={counts} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip />} />
            {STATUS.map(([k, l, c]) => <Bar key={k} dataKey={k} name={l} fill={c} radius={BAR_RADIUS} maxBarSize={20} />)}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Things finished per week" sub="Tasks done + submissions handed in" rows={weekly} columns={[{ key: 'label', label: 'Week of' }, { key: 'completed', label: 'Completed' }]}>
        <ResponsiveContainer>
          <BarChart data={weekly} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip />} />
            <Bar dataKey="completed" name="Completed" fill="var(--series-3)" radius={BAR_RADIUS} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AttendanceTab() {
  const { data, profile, analysis: a } = useData();
  const threshold = profile.grading.attendanceThreshold;
  const st = a.attendance;
  const subj = st.bySubject.filter((s) => s.total).map((s) => ({ name: s.subject.code || s.subject.name.slice(0, 10), pct: round(s.percent, 1), present: s.present, total: s.total, lecture: s.byType.lecture.percent != null ? round(s.byType.lecture.percent, 1) : null, lab: s.byType.lab.percent != null ? round(s.byType.lab.percent, 1) : null }));
  const perSem = [...data.semesters].sort(compareSemesters).map((sem) => {
    const stats = attendanceStats(data.attendance, data.subjects.filter((s) => s.semesterId === sem.id), threshold);
    return { name: sem.name, pct: stats.overall.percent != null ? round(stats.overall.percent, 1) : null, total: stats.overall.total };
  }).filter((x) => x.total);
  const weekly = st.weekly.map((w) => ({ label: fmtShort(w.week), pct: w.percent != null ? round(w.percent, 1) : null }));
  if (!st.recordCount) return <Card><Empty icon={CalendarCheck} title="No attendance records yet" action={<Link to="/attendance" className="btn btn-sm">Mark attendance</Link>} /></Card>;
  return (
    <div className="grid-2">
      <ChartCard title="Subject-wise attendance" sub={`Dashed line: ${threshold}% requirement`} rows={subj} columns={[{ key: 'name', label: 'Subject' }, { key: 'pct', label: '%' }, { key: 'present', label: 'Present' }, { key: 'total', label: 'Total' }]}>
        <ResponsiveContainer>
          <BarChart data={subj} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} domain={[0, 100]} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
            <ReferenceLine y={threshold} stroke="var(--critical)" strokeDasharray="4 4" />
            <Bar dataKey="pct" name="Attendance" fill="var(--series-3)" radius={BAR_RADIUS} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Lectures vs labs" sub="Attendance % by class type" rows={subj} columns={[{ key: 'name', label: 'Subject' }, { key: 'lecture', label: 'Lectures %' }, { key: 'lab', label: 'Labs %' }]} legend={<Legend items={[{ label: 'Lectures', color: 'var(--series-1)' }, { label: 'Labs', color: 'var(--series-2)' }]} />}>
        <ResponsiveContainer>
          <BarChart data={subj} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} domain={[0, 100]} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
            <Bar dataKey="lecture" name="Lectures" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={18} />
            <Bar dataKey="lab" name="Labs" fill="var(--series-2)" radius={BAR_RADIUS} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Weekly attendance trend" rows={weekly} columns={[{ key: 'label', label: 'Week of' }, { key: 'pct', label: '%' }]}>
        <ResponsiveContainer>
          <LineChart data={weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} domain={[0, 100]} />
            <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
            <ReferenceLine y={threshold} stroke="var(--critical)" strokeDasharray="4 4" />
            <Line dataKey="pct" name="Attendance" stroke="var(--series-3)" strokeWidth={2} dot={{ r: 3, fill: 'var(--series-3)', strokeWidth: 0 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Overall attendance by semester" rows={perSem} columns={[{ key: 'name', label: 'Semester' }, { key: 'pct', label: '%' }, { key: 'total', label: 'Classes' }]} empty={!perSem.length ? <Empty title="No data" /> : null}>
        <ResponsiveContainer>
          <BarChart data={perSem} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} domain={[0, 100]} />
            <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
            <ReferenceLine y={threshold} stroke="var(--critical)" strokeDasharray="4 4" />
            <Bar dataKey="pct" name="Attendance" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export default function Analytics() {
  const [tab, setTab] = useState('academics');
  const { profile } = useData();
  const mod = profile.preferences.modules || {};
  const tabs = TABS.filter((t) => (t.value === 'lifestyle' ? mod.lifestyle !== false : t.value === 'attendance' ? mod.attendance !== false : t.value === 'tasks' ? mod.tasks !== false || mod.assignments !== false : true));
  return (
    <div>
      <PageHeader eyebrow="Analytics" title="Performance analytics" description="Every chart has a table view (top-right toggle) with exact values." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'academics' && <AcademicsTab />}
      {tab === 'study' && <StudyTab />}
      {tab === 'lifestyle' && <LifestyleTab />}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'attendance' && <AttendanceTab />}
    </div>
  );
}
