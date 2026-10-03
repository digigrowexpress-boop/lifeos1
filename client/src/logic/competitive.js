/**
 * Competitive-exam tracker (GATE and similar). Data lives in goal.exam:
 * { name, date, syllabusDeadline, subjects: [{ id, name, weight, topics:[{id,name,status,confidence}],
 *   lecturesTotal, lecturesDone, questionsSolved, revisions, weeklyHoursTarget, notes }],
 *   mocks: [{ id, date, name, score, maxScore, rank, notes }] }
 */
import { sum } from '../lib/format.js';
import { addDaysISO, diffDays, weekStartISO } from '../lib/dates.js';
import { minutesOf } from './study.js';

const PRACTICE_TYPES = new Set(['Problem solving', 'Mock test', 'Coding', 'DSA']);

export function examSubjectProgress(subject, sessions, today) {
  const topics = subject.topics || [];
  const done = topics.filter((t) => t.status === 'done' || t.status === 'revised').length;
  const revised = topics.filter((t) => t.status === 'revised').length;
  const learning = topics.filter((t) => t.status === 'learning').length;
  const topicProgress = topics.length ? ((done + learning * 0.4) / topics.length) * 100 : null;
  const lecturesTotal = Number(subject.lecturesTotal) || 0;
  const lectureProgress = lecturesTotal ? Math.min(100, ((Number(subject.lecturesDone) || 0) / lecturesTotal) * 100) : null;

  let progress;
  if (topicProgress != null && lectureProgress != null) progress = topicProgress * 0.65 + lectureProgress * 0.35;
  else progress = topicProgress ?? lectureProgress ?? (Number(subject.manualProgress) || 0);

  const mine = sessions.filter((s) => s.examSubjectId === subject.id);
  const weekStart = weekStartISO(today);
  const weekMin = minutesOf(mine.filter((s) => s.date >= weekStart && s.date <= today));
  const weeklyTargetMin = (Number(subject.weeklyHoursTarget) || 0) * 60;
  const lastWeekStart = addDaysISO(weekStart, -7);
  const lastWeekMin = minutesOf(mine.filter((s) => s.date >= lastWeekStart && s.date < weekStart));
  const sessionQuestions = sum(mine, (s) => s.questionsSolved);

  return {
    subject,
    progress: Math.round(progress * 10) / 10,
    topicCount: topics.length,
    topicsDone: done,
    topicsRevised: revised,
    topicsLearning: learning,
    lectureProgress,
    studyMin: minutesOf(mine),
    practiceMin: minutesOf(mine.filter((s) => PRACTICE_TYPES.has(s.type))),
    weekMin,
    lastWeekMin,
    weeklyTargetMin,
    behindWeekly: weeklyTargetMin > 0 && weekMin < weeklyTargetMin,
    questionsSolved: (Number(subject.questionsSolved) || 0) + sessionQuestions,
    revisions: Number(subject.revisions) || 0,
    weakTopics: topics.filter((t) => t.confidence === 'weak'),
    strongTopics: topics.filter((t) => t.confidence === 'strong'),
  };
}

export function examProgress(goal, sessions, today) {
  const exam = goal.exam || {};
  const goalSessions = sessions.filter((s) => s.goalId === goal.id);
  const subjects = (exam.subjects || []).map((s) => examSubjectProgress(s, goalSessions, today));
  const totalWeight = sum(subjects, (s) => Number(s.subject.weight) || 1);
  const overall = subjects.length ? sum(subjects, (s) => s.progress * (Number(s.subject.weight) || 1)) / totalWeight : 0;

  // Expected syllabus coverage today, if the user set a deadline (else the exam date).
  const deadline = exam.syllabusDeadline || exam.date || goal.targetDate;
  let expected = null;
  if (deadline && goal.startDate && deadline > goal.startDate) {
    const span = diffDays(deadline, goal.startDate);
    const elapsed = Math.min(span, Math.max(0, diffDays(today, goal.startDate)));
    expected = (elapsed / span) * 100;
  }

  const mocks = [...(exam.mocks || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const mockPercents = mocks.filter((m) => Number(m.maxScore) > 0).map((m) => ({ ...m, percent: (Number(m.score) / Number(m.maxScore)) * 100 }));

  return {
    goal,
    subjects,
    overall: Math.round(overall * 10) / 10,
    expected,
    behind: expected != null && overall < expected - 10,
    daysToExam: exam.date ? diffDays(exam.date, today) : null,
    studyMin: minutesOf(goalSessions),
    weekMin: minutesOf(goalSessions.filter((s) => s.date >= weekStartISO(today) && s.date <= today)),
    mocks: mockPercents,
    bestMock: mockPercents.reduce((b, m) => (!b || m.percent > b.percent ? m : b), null),
    lastMock: mockPercents[mockPercents.length - 1] || null,
    weakest: [...subjects].sort((a, b) => a.progress - b.progress).slice(0, 3),
  };
}
