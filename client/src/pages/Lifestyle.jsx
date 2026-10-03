import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HeartPulse, Link2, NotebookPen, Moon, Smartphone, Dumbbell, Zap, BookOpen } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Card, Empty, PageHeader, StatTile, Callout } from '../components/ui/Card.jsx';
import { Segmented } from '../components/ui/Fields.jsx';
import { ProgressBar, ToneBadge } from '../components/ui/Indicators.jsx';
import { ChartCard, ChartTooltip, Legend, axisProps, gridProps } from '../components/charts/ChartKit.jsx';
import { averages, lifestyleSeries } from '../logic/lifestyle.js';
import { isNum, groupBy, avg } from '../lib/format.js';
import { fmtShort, subDaysISO, weekStartISO } from '../lib/dates.js';
import { Info } from 'lucide-react';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

const fmtVal = (v, unit) => (isNum(v) ? `${Number(v).toFixed(unit === 'min' ? 0 : 1)}${unit === 'h' ? 'h' : unit === 'min' ? ' min' : unit}` : '—');

function TrendChart({ title, icon, rows, series, unit, refLine, height = 200, empty }) {
  return (
    <ChartCard
      title={title}
      icon={icon}
      rows={rows}
      columns={[{ key: 'label', label: 'Date' }, ...series.map((s) => ({ key: s.key, label: s.label, format: (v) => fmtVal(v, unit) }))]}
      legend={series.length > 1 ? <Legend items={series.map((s) => ({ label: s.label, color: s.color, line: true }))} /> : null}
      height={height}
      empty={empty}
    >
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...axisProps} />
          <Tooltip content={<ChartTooltip formatter={(v) => fmtVal(v, unit)} />} />
          {refLine && <ReferenceLine y={refLine.y} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: refLine.label, fill: 'var(--muted)', fontSize: 10, position: 'insideTopRight' }} />}
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={rows.length <= 31 ? { r: 3, fill: s.color, strokeWidth: 0 } : false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default function Lifestyle() {
  const { data, profile, analysis: a, today } = useData();
  const [days, setDays] = useState(30);
  const prefs = profile.preferences;
  const metrics = a.lifestyle.metrics;

  const { rows, cur, prev, logged } = useMemo(() => {
    const start = subDaysISO(today, days - 1);
    const daily = lifestyleSeries(data.dailyLogs, data.studySessions, start, today, metrics);
    const prevRows = lifestyleSeries(data.dailyLogs, data.studySessions, subDaysISO(start, days), subDaysISO(start, 1), metrics);
    let chartRows = daily.map((r) => ({ ...r, label: fmtShort(r.date) }));
    if (days > 60) {
      // weekly averages for long ranges
      chartRows = Object.entries(groupBy(daily, (r) => weekStartISO(r.date))).map(([week, list]) => {
        const out = { date: week, label: fmtShort(week) };
        for (const m of metrics) {
          const vals = list.map((x) => x[m.key]).filter(isNum);
          out[m.key] = vals.length ? Number(avg(vals).toFixed(2)) : null;
        }
        return out;
      });
    } else {
      chartRows = chartRows.map((r) => {
        const out = { ...r };
        for (const m of metrics) if (isNum(out[m.key])) out[m.key] = Number(Number(out[m.key]).toFixed(2));
        return out;
      });
    }
    return { rows: chartRows, cur: averages(daily, metrics), prev: averages(prevRows, metrics), logged: daily.filter((r) => r.logged).length };
  }, [data.dailyLogs, data.studySessions, today, days, metrics]);

  const card = (key, label, unit, target, better, Icon) => {
    const v = cur[key];
    const p = prev[key];
    const d = isNum(v) && isNum(p) ? v - p : null;
    const good = d == null ? null : better === 'higher' ? d >= 0 : d <= 0;
    const ok = !isNum(v) || target == null ? null : better === 'higher' ? v >= target * 0.9 : v <= target;
    return (
      <StatTile
        key={key}
        icon={Icon}
        label={`${label} · avg/day`}
        value={fmtVal(v, unit)}
        foot={
          <>
            {target != null && ok != null && <ToneBadge tone={ok ? 'good' : 'warning'}>{better === 'higher' ? 'target' : 'limit'} {target}{unit === 'min' ? ' min' : unit}</ToneBadge>}
            {d != null && Math.abs(d) > 0.01 && <span className={good ? 'delta-up' : 'delta-down'}>{d > 0 ? '+' : ''}{d.toFixed(unit === 'min' ? 0 : 1)} vs prev.</span>}
          </>
        }
      />
    );
  };

  const corr = a.lifestyle.correlations;
  const allocation = [
    ['Sleep', cur.sleep],
    ['Study', cur.study],
    ['Screen time', cur.screen],
    ['Social media (part of screen)', cur.social],
    ['Entertainment', cur.entertainment],
    ['Exercise', isNum(cur.exercise) ? cur.exercise / 60 : null],
    ['Personal', cur.personal],
    ['Breaks', cur.breaks],
  ].filter(([, v]) => isNum(v));
  const maxAlloc = Math.max(1, ...allocation.map(([, v]) => v));
  const noData = logged === 0;
  const customMetrics = metrics.filter((m) => m.custom);

  if (data.dailyLogs.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Lifestyle" title="Lifestyle trends" />
        <Card>
          <Empty icon={HeartPulse} title="Start logging your days" action={<Link to="/logbook" className="btn btn-primary"><NotebookPen size={15} /> Open logbook</Link>}>
            Sleep, screen time, social media, exercise and productivity — logged daily — become trends and patterns here.
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Lifestyle"
        title="Lifestyle trends"
        description={`Based on ${logged} logged day${logged === 1 ? '' : 's'} in this range. Days you didn’t log are left blank, not counted as zero.`}
        actions={<Segmented label="Range" value={days} onChange={setDays} options={RANGES} />}
      />
      <div className="grid-4 mb">
        {card('sleep', 'Sleep', 'h', prefs.sleepTargetHours, 'higher', Moon)}
        {card('screen', 'Screen time', 'h', prefs.screenLimitHours, 'lower', Smartphone)}
        {card('social', 'Social media', 'h', prefs.socialLimitHours, 'lower', Smartphone)}
        {card('exercise', 'Exercise', 'min', prefs.exerciseTargetMin, 'higher', Dumbbell)}
        {card('study', 'Study', 'h', prefs.dailyStudyTargetHours, 'higher', BookOpen)}
        {card('productivity', 'Productivity', '/10', null, 'higher', Zap)}
        {card('mood', 'Mood', '/5', null, 'higher', HeartPulse)}
        {card('entertainment', 'Entertainment', 'h', null, 'lower', Smartphone)}
      </div>

      <div className="grid-2 mb">
        <TrendChart title="Sleep" icon={Moon} rows={rows} unit="h" series={[{ key: 'sleep', label: 'Sleep', color: 'var(--series-1)' }]} refLine={{ y: prefs.sleepTargetHours, label: 'target' }} empty={noData ? <Empty title="No logs in range" /> : null} />
        <TrendChart title="Screen time & social media" icon={Smartphone} rows={rows} unit="h" series={[{ key: 'screen', label: 'Screen time', color: 'var(--series-2)' }, { key: 'social', label: 'Social media', color: 'var(--series-5)' }]} empty={noData ? <Empty title="No logs in range" /> : null} />
        <TrendChart title="Study vs productivity" icon={Zap} rows={rows} unit="" series={[{ key: 'study', label: 'Study (h)', color: 'var(--series-3)' }, { key: 'productivity', label: 'Productivity (/10)', color: 'var(--series-7)' }]} empty={noData ? <Empty title="No logs in range" /> : null} />
        <TrendChart title="Exercise" icon={Dumbbell} rows={rows} unit="min" series={[{ key: 'exercise', label: 'Exercise', color: 'var(--series-4)' }]} refLine={{ y: prefs.exerciseTargetMin, label: 'target' }} empty={noData ? <Empty title="No logs in range" /> : null} />
        {customMetrics.map((m, i) => (
          <TrendChart key={m.key} title={m.label} rows={rows} unit={m.unit === 'yes/no' ? '' : ` ${m.unit}`} series={[{ key: m.key, label: m.label, color: `var(--series-${(i % 8) + 1})` }]} />
        ))}
      </div>

      <div className="grid-2">
        <Card title="Patterns in your data" icon={Link2} sub={`Looks at up to 120 days · needs ${corr.minDays}+ logged days per pair`}>
          {corr.results.length === 0 ? (
            <div className="small text-2">
              {corr.sampleDays < corr.minDays
                ? `Not enough history yet — ${corr.sampleDays} logged day${corr.sampleDays === 1 ? '' : 's'} so far. Patterns appear after about ${corr.minDays} days.`
                : 'No meaningful relationships found between your lifestyle and productivity yet.'}
            </div>
          ) : (
            <div className="stack">
              {corr.results.map((c) => (
                <div key={`${c.a}-${c.b}`} className="stack-xs">
                  <div className="small strong">{c.text}</div>
                  <div className="row-sm small text-2">
                    <span className="badge">{c.strength}</span>
                    <span>r = {c.r.toFixed(2)} · {c.n} days</span>
                  </div>
                  <ProgressBar value={Math.abs(c.r) * 100} size="thin" color={c.r > 0 ? 'var(--series-1)' : 'var(--series-8)'} />
                </div>
              ))}
              <Callout tone="info" icon={Info}>These are correlations in your own data — useful hints, not proof that one causes the other.</Callout>
            </div>
          )}
        </Card>
        <Card title="Average day" sub="Hours per logged day in this range">
          {allocation.length === 0 ? (
            <div className="small muted">Log time for sleep, study and screen to see how your day is spent.</div>
          ) : (
            <div className="stack-sm">
              {allocation.map(([label, v], i) => (
                <div key={label} className="stack-xs">
                  <div className="row between small">
                    <span className="text-2">{label}</span>
                    <b className="tabular">{v.toFixed(1)}h</b>
                  </div>
                  <ProgressBar value={v} max={maxAlloc} size="thin" color={`var(--series-${(i % 8) + 1})`} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
