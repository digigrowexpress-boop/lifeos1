/**
 * Global search across every record type, with structured filters.
 */
import { fmtDuration } from '../lib/format.js';
import { fmtDate } from '../lib/dates.js';

export const SEARCH_TYPES = {
  semester: 'Semesters',
  subject: 'Subjects',
  goal: 'Goals',
  task: 'Tasks',
  assignment: 'Assignments',
  exam: 'Exams',
  study: 'Study sessions',
  log: 'Daily logs',
  attendance: 'Attendance',
};

export function buildSearchIndex(data, a, profile) {
  const subj = (id) => a.subjectById[id];
  const semOf = (subjectId) => subj(subjectId)?.semesterId || null;
  const tf = profile.preferences.timeFormat;
  const idx = [];
  for (const s of data.semesters) {
    idx.push({ type: 'semester', id: s.id, title: s.name, subtitle: [s.academicYear, s.status].filter(Boolean).join(' · '), text: s.notes, date: s.startDate, semesterId: s.id, status: s.status, to: `/academics/semesters/${s.id}` });
  }
  for (const s of data.subjects) {
    idx.push({ type: 'subject', id: s.id, title: s.name, subtitle: [s.code, `${s.credits} cr`, s.faculty, a.semesterById[s.semesterId]?.name].filter(Boolean).join(' · '), text: `${s.code} ${s.faculty} ${s.category} ${s.notes}`, semesterId: s.semesterId, subjectId: s.id, category: s.category, to: `/academics/subjects/${s.id}` });
  }
  for (const g of data.goals) {
    idx.push({ type: 'goal', id: g.id, title: g.title, subtitle: [g.category, g.status, g.targetDate && `by ${fmtDate(g.targetDate)}`].filter(Boolean).join(' · '), text: `${g.description} ${g.notes} ${(g.milestones || []).map((m) => m.title).join(' ')} ${(g.exam?.subjects || []).map((x) => `${x.name} ${(x.topics || []).map((t) => t.name).join(' ')}`).join(' ')}`, date: g.targetDate, goalId: g.id, category: g.category, status: g.status, to: `/goals/${g.id}` });
  }
  for (const t of data.tasks) {
    idx.push({ type: 'task', id: t.id, title: t.title, subtitle: [t.status, t.dueDate && `due ${fmtDate(t.dueDate)}`].filter(Boolean).join(' · '), text: t.notes, date: t.dueDate, status: t.status, subjectId: t.subjectId, goalId: t.goalId, semesterId: semOf(t.subjectId), to: '/tasks' });
  }
  for (const x of data.assignments) {
    idx.push({ type: 'assignment', id: x.id, title: x.title, subtitle: [subj(x.subjectId)?.name, x.status, x.dueDate && `due ${fmtDate(x.dueDate)}`].filter(Boolean).join(' · '), text: `${x.description} ${x.notes}`, date: x.dueDate, status: x.status, subjectId: x.subjectId, semesterId: semOf(x.subjectId), to: '/assignments' });
  }
  for (const e of data.exams) {
    idx.push({ type: 'exam', id: e.id, title: e.title, subtitle: [subj(e.subjectId)?.name, e.type, fmtDate(e.date)].filter(Boolean).join(' · '), text: `${e.syllabus} ${e.notes}`, date: e.date, status: e.status, category: e.type, subjectId: e.subjectId, goalId: e.goalId, semesterId: semOf(e.subjectId), to: '/exams' });
  }
  for (const s of data.studySessions) {
    idx.push({ type: 'study', id: s.id, title: s.topic || subj(s.subjectId)?.name || s.type || 'Study session', subtitle: [fmtDate(s.date), fmtDuration(s.durationMin, tf), s.type, subj(s.subjectId)?.name].filter(Boolean).join(' · '), text: s.notes, date: s.date, category: s.type, subjectId: s.subjectId, goalId: s.goalId, semesterId: semOf(s.subjectId), to: `/study?date=${s.date}` });
  }
  for (const l of data.dailyLogs) {
    idx.push({ type: 'log', id: l.id, title: `Daily log — ${fmtDate(l.date)}`, subtitle: [l.sleepHours != null && `sleep ${l.sleepHours}h`, l.productivity != null && `productivity ${l.productivity}/10`].filter(Boolean).join(' · '), text: `${l.notes} ${l.plannedWork} ${l.completedWork}`, date: l.date, to: `/logbook?date=${l.date}` });
  }
  for (const r of data.attendance) {
    if (!r.topic && !r.reason) continue;
    idx.push({ type: 'attendance', id: r.id, title: r.topic || `${r.status} — ${subj(r.subjectId)?.name ?? ''}`, subtitle: [fmtDate(r.date), subj(r.subjectId)?.name, r.status].filter(Boolean).join(' · '), text: r.reason, date: r.date, status: r.status, subjectId: r.subjectId, semesterId: semOf(r.subjectId), to: `/attendance?date=${r.date}` });
  }
  return idx.map((x) => ({ ...x, haystack: `${x.title} ${x.subtitle} ${x.text || ''}`.toLowerCase() }));
}

export function searchIndex(index, query, filters = {}) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  return index.filter((x) => {
    if (filters.type && x.type !== filters.type) return false;
    if (filters.semesterId && x.semesterId !== filters.semesterId) return false;
    if (filters.subjectId && x.subjectId !== filters.subjectId) return false;
    if (filters.goalId && x.goalId !== filters.goalId) return false;
    if (filters.status && x.status !== filters.status) return false;
    if (filters.category && x.category !== filters.category) return false;
    if (filters.from && (!x.date || x.date < filters.from)) return false;
    if (filters.to && (!x.date || x.date > filters.to)) return false;
    return terms.every((t) => x.haystack.includes(t));
  });
}
