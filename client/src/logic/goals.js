/**
 * Goal progress, pacing and completion likelihood (an estimate, never a promise).
 */
import { clamp, isNum, sum } from '../lib/format.js';
import { diffDays, subDaysISO } from '../lib/dates.js';
import { minutesOf } from './study.js';
import { examProgress } from './competitive.js';

/**
 * @param ctx { today, sessions, tasks, cgpa, semesterSgpa: (semesterId) => number }
 */
export function goalProgress(goal, ctx) {
  const metric = goal.metric || { type: 'manual' };
  const type = metric.type || 'manual';
  let current = isNum(metric.current) ? Number(metric.current) : 0;
  let target = isNum(metric.target) ? Number(metric.target) : 100;
  let start = isNum(metric.start) ? Number(metric.start) : 0;
  let unit = metric.unit || '';
  let exam = null;
  const goalSessions = ctx.sessions.filter((s) => s.goalId === goal.id);

  if (type === 'milestones') {
    const ms = goal.milestones || [];
    current = ms.filter((m) => m.done).length;
    target = ms.length || 1;
    start = 0;
    unit = 'milestones';
  } else if (type === 'study-hours') {
    current = minutesOf(goalSessions) / 60;
    start = 0;
    unit = 'h';
  } else if (type === 'tasks') {
    const ts = ctx.tasks.filter((t) => t.goalId === goal.id);
    current = ts.filter((t) => t.status === 'done').length;
    target = ts.length || 1;
    start = 0;
    unit = 'tasks';
  } else if (type === 'cgpa') {
    current = ctx.cgpa ?? 0;
    unit = 'CGPA';
    if (!isNum(metric.start)) start = 0;
  } else if (type === 'sgpa') {
    current = ctx.semesterSgpa?.(metric.semesterId) ?? 0;
    unit = 'SGPA';
    if (!isNum(metric.start)) start = 0;
  } else if (type === 'exam-prep') {
    exam = examProgress(goal, ctx.sessions, ctx.today);
    current = exam.overall;
    target = 100;
    start = 0;
    unit = '%';
  }

  // GPA-style goals measure distance from the starting point, not from zero.
  const span = target - start;
  const percent = goal.status === 'completed' ? 100 : span > 0 ? clamp(((current - start) / span) * 100, 0, 100) : current >= target ? 100 : 0;

  // Pace: compare progress with time elapsed.
  let expected = null;
  let daysLeft = null;
  let elapsedDays = null;
  if (goal.targetDate) daysLeft = diffDays(goal.targetDate, ctx.today);
  if (goal.startDate && goal.targetDate && goal.targetDate > goal.startDate) {
    const total = diffDays(goal.targetDate, goal.startDate);
    elapsedDays = clamp(diffDays(ctx.today, goal.startDate), 0, total);
    expected = (elapsedDays / total) * 100;
  }

  let pace = 'no-deadline';
  if (goal.status === 'completed') pace = 'completed';
  else if (goal.status === 'paused') pace = 'paused';
  else if (goal.status === 'archived') pace = 'archived';
  else if (percent >= 100) pace = 'done';
  else if (type === 'cgpa' || type === 'sgpa') {
    // Grade averages only move when results arrive: judge by the (estimated) value, not by elapsed time.
    if (daysLeft != null && daysLeft < 0) pace = 'overdue';
    else pace = current >= target - 0.05 ? 'on-track' : current >= target - 0.4 ? 'behind' : 'at-risk';
  } else if (expected != null) {
    if (daysLeft < 0) pace = 'overdue';
    else if (percent >= expected + 5) pace = 'ahead';
    else if (percent >= expected - 10) pace = 'on-track';
    else if (percent >= expected - 25) pace = 'behind';
    else pace = 'at-risk';
  }

  // Likelihood estimate from recent pace (study/milestone/manual progress rate).
  let likelihood = null;
  let projectedPercent = null;
  if (type !== 'cgpa' && type !== 'sgpa' && ['ahead', 'on-track', 'behind', 'at-risk'].includes(pace) && elapsedDays > 0 && daysLeft != null) {
    let ratePerDay = percent / elapsedDays;
    if (type === 'study-hours' && target > 0) {
      const recentMin = minutesOf(goalSessions.filter((s) => s.date >= subDaysISO(ctx.today, 27)));
      ratePerDay = (recentMin / 60 / 28 / target) * 100;
    }
    projectedPercent = clamp(percent + ratePerDay * daysLeft, 0, 100);
    likelihood = projectedPercent >= 95 ? 'high' : projectedPercent >= 75 ? 'medium' : 'low';
  }

  const ms = goal.milestones || [];
  const nextMilestone = ms
    .filter((m) => !m.done)
    .sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))[0];
  const overdueMilestones = ms.filter((m) => !m.done && m.dueDate && m.dueDate < ctx.today);

  const weekStudyMin = minutesOf(goalSessions.filter((s) => s.date >= subDaysISO(ctx.today, 6)));
  const weeklyTargetMin = (Number(goal.weeklyHoursTarget) || 0) * 60;

  return {
    goal,
    type,
    current,
    target,
    start,
    unit,
    percent,
    expected,
    daysLeft,
    pace,
    likelihood,
    projectedPercent,
    nextMilestone,
    overdueMilestones,
    studyMin: minutesOf(goalSessions),
    weekStudyMin,
    weeklyTargetMin,
    behindWeekly: weeklyTargetMin > 0 && weekStudyMin < weeklyTargetMin * 0.8,
    exam,
  };
}

export const PACE_META = {
  ahead: { label: 'Ahead', tone: 'good' },
  'on-track': { label: 'On track', tone: 'good' },
  behind: { label: 'Behind', tone: 'warning' },
  'at-risk': { label: 'At risk', tone: 'critical' },
  overdue: { label: 'Overdue', tone: 'critical' },
  done: { label: 'Target reached', tone: 'good' },
  completed: { label: 'Completed', tone: 'good' },
  paused: { label: 'Paused', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
  'no-deadline': { label: 'No deadline', tone: 'neutral' },
};

export function goalsOverview(progressList) {
  const active = progressList.filter((p) => p.goal.status === 'active');
  return {
    active: active.length,
    completed: progressList.filter((p) => p.goal.status === 'completed').length,
    behind: active.filter((p) => ['behind', 'at-risk', 'overdue'].includes(p.pace)).length,
    avgPercent: active.length ? sum(active, (p) => p.percent) / active.length : null,
  };
}
