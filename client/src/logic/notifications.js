/**
 * Reminders generated from data, filtered by the user's notification settings.
 * Ids are stable so dismissals persist.
 */
import { addDaysISO, relativeDay } from '../lib/dates.js';
import { isOpenAssignment } from './insights.js';

export function buildNotifications(a, data, profile, today, hourNow = new Date().getHours()) {
  const n = profile.notifications || {};
  const mod = profile.preferences.modules || {};
  if (n.enabled === false) return [];
  const out = [];

  if (mod.assignments !== false) {
    const horizon = addDaysISO(today, Number(n.assignmentsDays ?? 3));
    for (const x of data.assignments.filter(isOpenAssignment)) {
      if (!x.dueDate || x.dueDate > horizon) continue;
      const overdue = x.dueDate < today;
      out.push({
        id: `asg:${x.id}:${x.dueDate}:${overdue ? 'o' : 'd'}`,
        type: 'assignment',
        severity: overdue ? 'critical' : x.dueDate === today ? 'warning' : 'info',
        title: overdue ? `Overdue: ${x.title}` : `Due ${relativeDay(x.dueDate, today).toLowerCase()}: ${x.title}`,
        body: a.subjectById[x.subjectId]?.name || 'Submission',
        date: x.dueDate,
        to: '/assignments',
      });
    }
  }
  if (mod.exams !== false) {
    const horizon = addDaysISO(today, Number(n.examsDays ?? 7));
    for (const e of data.exams) {
      if (e.status !== 'upcoming' || !e.date || e.date < today || e.date > horizon) continue;
      out.push({
        id: `exam:${e.id}:${e.date}`,
        type: 'exam',
        severity: e.date <= addDaysISO(today, 1) ? 'warning' : 'info',
        title: `${e.title} ${relativeDay(e.date, today).toLowerCase()}`,
        body: `Preparation ${e.preparation || 0}%${e.time ? ` · ${e.time}` : ''}`,
        date: e.date,
        to: '/exams',
      });
    }
  }
  if (mod.tasks !== false && n.tasks !== false) {
    for (const t of data.tasks) {
      if (!(t.status === 'todo' || t.status === 'in-progress') || !t.dueDate || t.dueDate > today) continue;
      out.push({ id: `task:${t.id}:${t.dueDate}`, type: 'task', severity: t.dueDate < today ? 'warning' : 'info', title: `Task ${t.dueDate < today ? 'overdue' : 'due today'}: ${t.title}`, body: relativeDay(t.dueDate, today), date: t.dueDate, to: '/tasks' });
    }
  }
  if (n.goals !== false) {
    for (const g of a.goals) {
      if (g.goal.status !== 'active') continue;
      for (const m of g.goal.milestones || []) {
        if (m.done || !m.dueDate || m.dueDate > addDaysISO(today, 3)) continue;
        out.push({ id: `ms:${g.goal.id}:${m.id}:${m.dueDate}`, type: 'goal', severity: m.dueDate < today ? 'warning' : 'info', title: `Milestone ${m.dueDate < today ? 'overdue' : relativeDay(m.dueDate, today).toLowerCase()}: ${m.title}`, body: g.goal.title, date: m.dueDate, to: `/goals/${g.goal.id}` });
      }
      if (['behind', 'at-risk', 'overdue'].includes(g.pace)) {
        out.push({ id: `goal:${g.goal.id}:${g.pace}:${today.slice(0, 7)}`, type: 'goal', severity: 'warning', title: `Goal ${g.pace === 'behind' ? 'behind schedule' : g.pace.replace('-', ' ')}: ${g.goal.title}`, body: `${Math.round(g.percent)}% done`, date: today, to: `/goals/${g.goal.id}` });
      }
    }
  }
  if (mod.attendance !== false && n.attendance !== false) {
    for (const s of a.attendance.bySubject) {
      if (s.risk !== 'critical' || !s.total) continue;
      out.push({ id: `att:${s.subject.id}:${today.slice(0, 7)}`, type: 'attendance', severity: 'critical', title: `Attendance risk: ${s.subject.name}`, body: `${s.percent.toFixed(0)}% — attend the next ${s.mustAttend} classes to recover`, date: today, to: '/attendance' });
    }
  }
  if (mod.logbook !== false && n.dailyLog !== false && hourNow >= Number(n.dailyLogHour ?? 20) && !data.dailyLogs.some((l) => l.date === today)) {
    out.push({ id: `log:${today}`, type: 'log', severity: 'info', title: 'Time to log your day', body: 'A minute of logging keeps your insights accurate.', date: today, to: '/logbook' });
  }
  if (n.studyGoal !== false && a.study.dailyTargetMin > 0 && hourNow >= 18 && a.study.today < a.study.dailyTargetMin * 0.5) {
    out.push({ id: `study:${today}`, type: 'study', severity: 'info', title: 'Daily study goal not reached yet', body: `Target ${Math.round(a.study.dailyTargetMin / 60)}h`, date: today, to: '/study' });
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((x, y) => rank[x.severity] - rank[y.severity] || String(x.date).localeCompare(String(y.date)));
}
