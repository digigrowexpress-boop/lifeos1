/**
 * Achievements derived from recorded data (nothing to maintain by hand).
 */
import { groupBy } from '../lib/format.js';
import { addDaysISO } from '../lib/dates.js';

function dateWhenCumulativeReaches(sessions, minutes) {
  const byDay = Object.entries(groupBy(sessions, (s) => s.date)).sort(([a], [b]) => a.localeCompare(b));
  let total = 0;
  for (const [date, list] of byDay) {
    total += list.reduce((s, x) => s + (Number(x.durationMin) || 0), 0);
    if (total >= minutes) return date;
  }
  return null;
}

function dateWhenStreakReaches(sessions, length) {
  const days = [...new Set(sessions.map((s) => s.date))].sort();
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && addDaysISO(prev, 1) === d ? run + 1 : 1;
    if (run >= length) return d;
    prev = d;
  }
  return null;
}

export function computeAchievements(a, data) {
  const list = [];
  const add = (id, title, detail, date, icon) => list.push({ id, title, detail, date, earned: Boolean(date), icon });
  const s = data.studySessions;

  for (const h of [10, 50, 100, 250, 500, 1000]) add(`hours-${h}`, `${h} hours studied`, `Logged ${h} hours of study in total`, dateWhenCumulativeReaches(s, h * 60), 'clock');
  for (const d of [3, 7, 14, 30]) add(`streak-${d}`, `${d}-day streak`, `Studied ${d} days in a row`, dateWhenStreakReaches(s, d), 'flame');

  const completed = data.goals.filter((g) => g.status === 'completed').sort((x, y) => String(x.completedAt).localeCompare(String(y.completedAt)));
  add('goal-1', 'First goal completed', 'Completed a goal', completed[0]?.completedAt?.slice(0, 10) || null, 'target');
  add('goal-5', 'Five goals completed', 'Completed five goals', completed[4]?.completedAt?.slice(0, 10) || null, 'target');

  const ms = data.goals.flatMap((g) => (g.milestones || []).filter((m) => m.done && m.doneAt)).sort((x, y) => String(x.doneAt).localeCompare(String(y.doneAt)));
  add('ms-10', '10 milestones', 'Completed ten goal milestones', ms[9]?.doneAt?.slice(0, 10) || null, 'flag');

  const logs = [...data.dailyLogs].sort((x, y) => x.date.localeCompare(y.date));
  add('log-7', 'Logging habit', 'Logged 7 days', logs[6]?.date || null, 'notebook');
  add('log-30', 'Self-aware', 'Logged 30 days', logs[29]?.date || null, 'notebook');

  const submittedOnTime = data.assignments.filter((x) => x.status === 'submitted' && x.submittedDate && (!x.dueDate || x.submittedDate <= x.dueDate)).sort((x, y) => x.submittedDate.localeCompare(y.submittedDate));
  add('submit-10', 'Reliable', '10 submissions on time', submittedOnTime[9]?.submittedDate || null, 'check');

  for (const r of a.semesterResults) {
    const target = r.semester.targetSgpa ?? null;
    if ((r.status === 'official' || r.status === 'confirmed') && target != null && r.confirmedSgpa >= target) {
      add(`sem-target-${r.semester.id}`, `Hit target in ${r.semester.name}`, `SGPA ${r.confirmedSgpa.toFixed(2)} ≥ ${target}`, r.semester.endDate || r.semester.updatedAt?.slice(0, 10) || null, 'trophy');
    }
  }

  const mockBest = a.goals.flatMap((g) => g.exam?.mocks || []).sort((x, y) => y.percent - x.percent)[0];
  if (mockBest) add('mock-best', 'Mock test personal best', `${mockBest.name || 'Mock'}: ${mockBest.percent.toFixed(0)}%`, mockBest.date || null, 'medal');

  const highComps = data.subjects.flatMap((sub) => (sub.components || []).filter((c) => c.status === 'confirmed' && Number(c.maxMarks) > 0 && Number(c.obtained) / Number(c.maxMarks) >= 0.9).map((c) => ({ c, sub })));
  if (highComps.length) {
    const latest = highComps.sort((x, y) => String(y.c.date || '').localeCompare(String(x.c.date || '')))[0];
    add('top-mark', 'Top marks', `${highComps.length} assessment${highComps.length === 1 ? '' : 's'} at 90%+ (latest: ${latest.sub.name} ${latest.c.name})`, latest.c.date || latest.sub.updatedAt?.slice(0, 10) || null, 'star');
  }

  if (a.attendance.overall.total >= 20 && a.attendance.overall.percent >= 90) {
    add('attendance-90', 'Always there', 'Attendance at 90% or above this semester', a.attendance.days.at(-1)?.date || null, 'calendar');
  }

  const earned = list.filter((x) => x.earned).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const upcoming = list.filter((x) => !x.earned);
  return { earned, upcoming, all: list };
}
