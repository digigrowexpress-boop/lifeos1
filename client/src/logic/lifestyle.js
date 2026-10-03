/**
 * Lifestyle metrics, trends and lifestyle ↔ productivity relationships.
 */
import { avg, groupBy, isNum, pearson } from '../lib/format.js';
import { rangeISO, subDaysISO } from '../lib/dates.js';

const h = (min) => (isNum(min) ? Number(min) / 60 : null);
const n = (v) => (isNum(v) ? Number(v) : null);

export const BASE_METRICS = [
  { key: 'sleep', label: 'Sleep', unit: 'h', get: (l) => n(l.sleepHours), better: 'target' },
  { key: 'study', label: 'Study', unit: 'h', fromSessions: true, better: 'higher' },
  { key: 'screen', label: 'Screen time', unit: 'h', get: (l) => h(l.screenTimeMin), better: 'lower' },
  { key: 'social', label: 'Social media', unit: 'h', get: (l) => h(l.socialMediaMin), better: 'lower' },
  { key: 'exercise', label: 'Exercise', unit: 'min', get: (l) => n(l.exerciseMin), better: 'higher' },
  { key: 'entertainment', label: 'Entertainment', unit: 'h', get: (l) => h(l.entertainmentMin), better: 'neutral' },
  { key: 'breaks', label: 'Breaks', unit: 'h', get: (l) => h(l.breaksMin), better: 'neutral' },
  { key: 'personal', label: 'Personal time', unit: 'h', get: (l) => h(l.personalMin), better: 'neutral' },
  { key: 'productivity', label: 'Productivity', unit: '/10', get: (l) => n(l.productivity), better: 'higher' },
  { key: 'mood', label: 'Mood', unit: '/5', get: (l) => n(l.mood), better: 'higher' },
];

/** Base metrics + numeric custom fields the user defined. */
export function lifestyleMetrics(customFields = []) {
  const custom = customFields
    .filter((f) => f.type === 'number' || f.type === 'rating' || f.type === 'boolean')
    .map((f) => ({
      key: `custom:${f.key}`,
      label: f.label,
      unit: f.type === 'boolean' ? 'yes/no' : f.unit || '',
      get: (l) => {
        const v = l.custom?.[f.key];
        if (f.type === 'boolean') return v === true ? 1 : v === false ? 0 : null;
        return n(v);
      },
      better: 'neutral',
      custom: true,
    }));
  return [...BASE_METRICS, ...custom];
}

/** One row per day with every metric (null when not logged). */
export function lifestyleSeries(logs, sessions, start, end, metrics) {
  const logByDate = Object.fromEntries(logs.map((l) => [l.date, l]));
  const studyByDate = groupBy(sessions.filter((s) => s.date >= start && s.date <= end), (s) => s.date);
  return rangeISO(start, end).map((date) => {
    const log = logByDate[date];
    const row = { date, logged: Boolean(log) };
    for (const m of metrics) {
      if (m.fromSessions) {
        const list = studyByDate[date] || [];
        row[m.key] = list.length || log ? list.reduce((s, x) => s + (Number(x.durationMin) || 0), 0) / 60 : null;
      } else {
        row[m.key] = log ? m.get(log) : null;
      }
    }
    return row;
  });
}

export function averages(rows, metrics) {
  const out = {};
  for (const m of metrics) {
    const vals = rows.map((r) => r[m.key]).filter(isNum);
    out[m.key] = vals.length ? avg(vals) : null;
  }
  return out;
}

export function lifestyleSummary(logs, sessions, today, metrics) {
  const last7 = lifestyleSeries(logs, sessions, subDaysISO(today, 6), today, metrics);
  const prev7 = lifestyleSeries(logs, sessions, subDaysISO(today, 13), subDaysISO(today, 7), metrics);
  const last30 = lifestyleSeries(logs, sessions, subDaysISO(today, 29), today, metrics);
  const todayLog = logs.find((l) => l.date === today) || null;
  const yesterdayLog = logs.find((l) => l.date === subDaysISO(today, 1)) || null;
  return {
    last7: averages(last7, metrics),
    prev7: averages(prev7, metrics),
    last30: averages(last30, metrics),
    daysLogged7: last7.filter((r) => r.logged).length,
    daysLogged30: last30.filter((r) => r.logged).length,
    todayLog,
    latestLog: todayLog || yesterdayLog || [...logs].sort((a, b) => b.date.localeCompare(a.date))[0] || null,
  };
}

const PAIRS = [
  ['sleep', 'productivity'],
  ['sleep', 'study'],
  ['screen', 'study'],
  ['social', 'productivity'],
  ['social', 'study'],
  ['exercise', 'productivity'],
  ['exercise', 'mood'],
  ['sleep', 'mood'],
  ['entertainment', 'study'],
];

/**
 * Relationships between lifestyle and productivity/study. Only reported with
 * at least `minDays` paired observations and |r| ≥ 0.3. Correlation ≠ causation.
 */
export function lifestyleCorrelations(logs, sessions, metrics, { minDays = 10, lookbackDays = 120, today }) {
  const rows = lifestyleSeries(logs, sessions, subDaysISO(today, lookbackDays - 1), today, metrics).filter((r) => r.logged);
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));
  const results = [];
  for (const [a, b] of PAIRS) {
    if (!byKey[a] || !byKey[b]) continue;
    const pairs = rows.filter((r) => isNum(r[a]) && isNum(r[b]));
    if (pairs.length < minDays) continue;
    const r = pearson(pairs.map((p) => p[a]), pairs.map((p) => p[b]));
    if (r == null || Math.abs(r) < 0.3) continue;
    const strength = Math.abs(r) >= 0.6 ? 'strong' : Math.abs(r) >= 0.45 ? 'moderate' : 'mild';
    const direction = r > 0 ? 'higher' : 'lower';
    results.push({
      a,
      b,
      r,
      n: pairs.length,
      strength,
      text: `On days with more ${byKey[a].label.toLowerCase()}, your ${byKey[b].label.toLowerCase()} tended to be ${direction}.`,
    });
  }
  return { results: results.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)), sampleDays: rows.length, minDays };
}
