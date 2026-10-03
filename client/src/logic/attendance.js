import { groupBy, sum } from '../lib/format.js';
import { weekStartISO } from '../lib/dates.js';

/** Classes you can still miss / must attend to stay at the threshold. */
export function attendanceMargin(present, total, thresholdPct) {
  const t = thresholdPct / 100;
  if (t <= 0) return { canMiss: Infinity, mustAttend: 0 };
  if (t >= 1) return { canMiss: 0, mustAttend: present < total ? Infinity : 0 };
  const canMiss = Math.max(0, Math.floor(present / t - total + 1e-9));
  const mustAttend = Math.max(0, Math.ceil((t * total - present) / (1 - t) - 1e-9));
  return { canMiss, mustAttend };
}

export function riskLevel(percent, threshold) {
  if (percent == null) return 'none';
  if (percent < threshold) return 'critical';
  if (percent < threshold + 5) return 'warning';
  return 'safe';
}

function tally(records) {
  let present = 0;
  let total = 0;
  for (const r of records) {
    if (r.status === 'cancelled') continue;
    const n = Number(r.count) || 1;
    total += n;
    if (r.status === 'present') present += n;
  }
  return { present, total, absent: total - present, percent: total ? (present / total) * 100 : null };
}

/**
 * Attendance statistics, optionally limited to one semester's subjects.
 */
export function attendanceStats(records, subjects, threshold = 75) {
  const subjectIds = new Set(subjects.map((s) => s.id));
  const scoped = records.filter((r) => subjectIds.has(r.subjectId));
  const overall = { ...tally(scoped), ...attendanceMargin(tally(scoped).present, tally(scoped).total, threshold) };
  overall.risk = riskLevel(overall.percent, threshold);

  const bySubject = subjects.map((s) => {
    const recs = scoped.filter((r) => r.subjectId === s.id);
    const t = tally(recs);
    const byType = Object.fromEntries(
      ['lecture', 'lab', 'tutorial'].map((k) => [k, tally(recs.filter((r) => (r.slotType || 'lecture') === k))])
    );
    return {
      subject: s,
      ...t,
      ...attendanceMargin(t.present, t.total, threshold),
      risk: riskLevel(t.percent, threshold),
      byType,
      lastAbsent: recs.filter((r) => r.status === 'absent').map((r) => r.date).sort().pop() || null,
    };
  });

  const byDate = groupBy(scoped, (r) => r.date);
  const days = Object.entries(byDate)
    .map(([date, recs]) => ({ date, ...tally(recs) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekly = Object.entries(groupBy(days, (d) => weekStartISO(d.date)))
    .map(([week, ds]) => {
      const present = sum(ds, (d) => d.present);
      const total = sum(ds, (d) => d.total);
      return { week, present, total, percent: total ? (present / total) * 100 : null };
    })
    .sort((a, b) => a.week.localeCompare(b.week));

  return { overall, bySubject, days, weekly, threshold, recordCount: scoped.length };
}

/**
 * Projected end-of-semester attendance if the recent pattern continues.
 * Uses the last 4 weeks' rate and the weekly lecture load from the timetable.
 */
export function projectAttendance(stats, semester, today) {
  if (!semester?.endDate || !stats.weekly.length) return null;
  const recent = stats.weekly.slice(-4);
  const p = sum(recent, (w) => w.present);
  const t = sum(recent, (w) => w.total);
  if (!t) return null;
  const rate = p / t;
  const perWeek = t / recent.length;
  const weeksLeft = Math.max(0, (new Date(semester.endDate) - new Date(today)) / (7 * 864e5));
  const futureTotal = perWeek * weeksLeft;
  const total = stats.overall.total + futureTotal;
  const present = stats.overall.present + futureTotal * rate;
  return { percent: total ? (present / total) * 100 : null, recentRate: rate * 100, weeksLeft: Math.round(weeksLeft) };
}
