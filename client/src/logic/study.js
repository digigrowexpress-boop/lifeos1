import { groupBy, sum } from '../lib/format.js';
import { monthKey, rangeISO, subDaysISO, weekStartISO, yearKey, addDaysISO } from '../lib/dates.js';

export const sessionsBetween = (sessions, start, end) => sessions.filter((s) => s.date >= start && s.date <= end);
export const minutesOf = (sessions) => sum(sessions, (s) => s.durationMin);

/** Minutes per day for an inclusive date range (zero-filled). */
export function dailySeries(sessions, start, end) {
  const byDay = groupBy(sessionsBetween(sessions, start, end), (s) => s.date);
  return rangeISO(start, end).map((date) => ({ date, minutes: minutesOf(byDay[date] || []) }));
}

export function weeklySeries(sessions, weeks, today) {
  const thisWeek = weekStartISO(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDaysISO(thisWeek, -7 * i);
    const end = addDaysISO(start, 6);
    out.push({ week: start, minutes: minutesOf(sessionsBetween(sessions, start, end)) });
  }
  return out;
}

export function monthlySeries(sessions) {
  return Object.entries(groupBy(sessions, (s) => monthKey(s.date)))
    .map(([month, list]) => ({ month, minutes: minutesOf(list), days: new Set(list.map((s) => s.date)).size }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function yearlySeries(sessions) {
  return Object.entries(groupBy(sessions, (s) => yearKey(s.date)))
    .map(([year, list]) => ({ year, minutes: minutesOf(list) }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export function breakdown(sessions, keyFn) {
  return Object.entries(groupBy(sessions, keyFn))
    .map(([key, list]) => ({ key, minutes: minutesOf(list), count: list.length }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Current and longest streak of consecutive days with at least one session. */
export function studyStreak(sessions, today) {
  const days = new Set(sessions.map((s) => s.date));
  let current = 0;
  let d = days.has(today) ? today : subDaysISO(today, 1);
  while (days.has(d)) {
    current += 1;
    d = subDaysISO(d, 1);
  }
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const day of sorted) {
    run = prev && addDaysISO(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  return { current, longest, activeToday: days.has(today) };
}

/** Share of days in the window with any study. */
export function consistency(sessions, start, end) {
  const days = rangeISO(start, end);
  if (!days.length) return null;
  const active = new Set(sessionsBetween(sessions, start, end).map((s) => s.date));
  return (days.filter((d) => active.has(d)).length / days.length) * 100;
}

export function studySummary(sessions, today, prefs = {}) {
  const weekStart = weekStartISO(today);
  const lastWeekStart = addDaysISO(weekStart, -7);
  const last7 = minutesOf(sessionsBetween(sessions, subDaysISO(today, 6), today));
  const prev7 = minutesOf(sessionsBetween(sessions, subDaysISO(today, 13), subDaysISO(today, 7)));
  const thisWeek = minutesOf(sessionsBetween(sessions, weekStart, today));
  const lastWeek = minutesOf(sessionsBetween(sessions, lastWeekStart, addDaysISO(lastWeekStart, 6)));
  const monthStart = `${today.slice(0, 7)}-01`;
  return {
    today: minutesOf(sessions.filter((s) => s.date === today)),
    thisWeek,
    lastWeek,
    last7,
    prev7,
    thisMonth: minutesOf(sessionsBetween(sessions, monthStart, today)),
    total: minutesOf(sessions),
    streak: studyStreak(sessions, today),
    consistency14: consistency(sessions, subDaysISO(today, 13), today),
    consistency28: consistency(sessions, subDaysISO(today, 27), today),
    dailyTargetMin: (Number(prefs.dailyStudyTargetHours) || 0) * 60,
    weeklyTargetMin: (Number(prefs.weeklyStudyTargetHours) || 0) * 60,
    avgPerDay28: minutesOf(sessionsBetween(sessions, subDaysISO(today, 27), today)) / 28,
  };
}
