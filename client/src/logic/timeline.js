/**
 * Unified history: derived from records plus the event log (marks entered,
 * grade changes) so the user can look back over months and years.
 */
import { fmtDuration, groupBy } from '../lib/format.js';

export const TIMELINE_TYPES = {
  result: { label: 'Semester results' },
  marks: { label: 'Marks & grades' },
  goal: { label: 'Goals & milestones' },
  study: { label: 'Study' },
  submission: { label: 'Submissions' },
  exam: { label: 'Exams' },
  log: { label: 'Daily logs' },
  achievement: { label: 'Achievements' },
};

export function buildTimeline(a, data, profile) {
  const fmt = (m) => fmtDuration(m, profile.preferences.timeFormat);
  const items = [];
  const push = (x) => x.date && items.push({ ...x, at: x.at || `${x.date}T12:00:00` });

  for (const r of a.semesterResults) {
    if (r.status === 'official' || r.status === 'confirmed') {
      push({ id: `sem-${r.semester.id}`, type: 'result', date: r.semester.endDate || r.semester.updatedAt?.slice(0, 10), title: `${r.semester.name} result: SGPA ${r.confirmedSgpa.toFixed(2)}`, detail: `${r.totalCredits} credits · ${r.status === 'official' ? 'official' : 'all marks confirmed'}`, to: `/academics/semesters/${r.semester.id}` });
    }
  }
  for (const e of data.events) {
    push({ id: `ev-${e.id}`, type: e.type === 'grade' ? 'marks' : e.type, date: e.at?.slice(0, 10), at: e.at, title: e.title, detail: e.detail, to: e.refCollection === 'subjects' && e.refId ? `/academics/subjects/${e.refId}` : undefined });
  }
  for (const g of data.goals) {
    push({ id: `goal-new-${g.id}`, type: 'goal', date: g.startDate || g.createdAt?.slice(0, 10), title: `Goal created: ${g.title}`, detail: g.description?.slice(0, 120), to: `/goals/${g.id}` });
    if (g.completedAt) push({ id: `goal-done-${g.id}`, type: 'goal', date: g.completedAt.slice(0, 10), at: g.completedAt, title: `Goal completed: ${g.title}`, to: `/goals/${g.id}` });
    for (const m of g.milestones || []) {
      if (m.done && m.doneAt) push({ id: `ms-${g.id}-${m.id}`, type: 'goal', date: m.doneAt.slice(0, 10), at: m.doneAt, title: `Milestone reached: ${m.title}`, detail: g.title, to: `/goals/${g.id}` });
    }
  }
  const byDay = groupBy(data.studySessions, (s) => s.date);
  for (const [date, list] of Object.entries(byDay)) {
    const minutes = list.reduce((s, x) => s + (Number(x.durationMin) || 0), 0);
    const names = [...new Set(list.map((x) => a.subjectById[x.subjectId]?.code || a.subjectById[x.subjectId]?.name || x.topic || x.type).filter(Boolean))];
    push({ id: `study-${date}`, type: 'study', date, title: `Studied ${fmt(minutes)}`, detail: `${list.length} session${list.length === 1 ? '' : 's'}${names.length ? ` · ${names.slice(0, 4).join(', ')}` : ''}`, to: '/study' });
  }
  for (const x of data.assignments) {
    if (x.submittedDate && ['submitted', 'late'].includes(x.status)) {
      push({ id: `sub-${x.id}`, type: 'submission', date: x.submittedDate, title: `${x.status === 'late' ? 'Submitted late' : 'Submitted'}: ${x.title}`, detail: [a.subjectById[x.subjectId]?.name, x.marks != null && x.maxMarks ? `${x.marks}/${x.maxMarks}` : null].filter(Boolean).join(' · '), to: '/assignments' });
    }
  }
  for (const e of data.exams) {
    if (e.status === 'result' && e.marks != null) {
      push({ id: `exam-${e.id}`, type: 'exam', date: e.date, title: `Result: ${e.title} — ${e.marks}${e.maxMarks ? `/${e.maxMarks}` : ''}`, detail: [a.subjectById[e.subjectId]?.name, e.marksStatus !== 'confirmed' ? e.marksStatus : null].filter(Boolean).join(' · '), to: '/exams' });
    } else if (e.status === 'completed') {
      push({ id: `exam-${e.id}`, type: 'exam', date: e.date, title: `Exam taken: ${e.title}`, detail: a.subjectById[e.subjectId]?.name, to: '/exams' });
    }
  }
  for (const l of data.dailyLogs) {
    const bits = [];
    if (l.sleepHours != null) bits.push(`sleep ${l.sleepHours}h`);
    if (l.productivity != null) bits.push(`productivity ${l.productivity}/10`);
    if (l.collegeAttended === true) bits.push('college');
    push({ id: `log-${l.id}`, type: 'log', date: l.date, title: 'Daily log', detail: [bits.join(' · '), l.notes?.slice(0, 100)].filter(Boolean).join(' — '), to: `/logbook?date=${l.date}` });
  }
  for (const x of a.achievements.earned) {
    push({ id: `ach-${x.id}`, type: 'achievement', date: x.date, title: `Achievement: ${x.title}`, detail: x.detail });
  }
  return items.sort((x, y) => String(y.at).localeCompare(String(x.at)));
}
