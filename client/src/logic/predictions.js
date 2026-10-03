/**
 * Predictions. Every value here is an ESTIMATE derived from the data entered so
 * far and is labelled as such in the UI.
 */
import { isNum, stdDev, sum } from '../lib/format.js';
import { addDaysISO, diffDays, monthEndISO } from '../lib/dates.js';
import { componentPercent, evaluateSemester, isFail } from './academics.js';
import { projectAttendance } from './attendance.js';
import { isOpenAssignment } from './insights.js';

export function confidenceLabel(c) {
  if (c >= 0.7) return 'high';
  if (c >= 0.35) return 'medium';
  return 'low';
}

/** Projected SGPA with a plausible range from the spread of your known marks. */
export function predictSgpa(current, data, grading) {
  if (!current || current.status !== 'in-progress' || !isNum(current.projectedSgpa)) return null;
  const known = current.subjects.flatMap((s) => (s.components || []).map(componentPercent).filter(isNum));
  const spread = Math.min(15, Math.max(5, stdDev(known) / 2));
  const low = evaluateSemester(current.semester, data.subjects, grading, { rateOffset: -spread }).computedSgpa;
  const high = evaluateSemester(current.semester, data.subjects, grading, { rateOffset: spread }).computedSgpa;
  return {
    value: current.projectedSgpa,
    low,
    high,
    spread,
    confidence: confidenceLabel(current.confidence),
    assessedShare: current.confidence,
  };
}

export function predictCgpa(cumulative, sgpaPrediction, current) {
  const conf = cumulative.confirmed;
  if (!sgpaPrediction || !current) return { value: cumulative.projected.cgpa, low: null, high: null };
  const credits = current.computedCredits || current.totalCredits;
  const mix = (sgpa) => {
    if (!isNum(sgpa)) return null;
    if (cumulative.method === 'sgpa-average') return ((conf.cgpa ?? 0) * conf.count + sgpa) / (conf.count + 1);
    return ((conf.points ?? 0) + sgpa * credits) / ((conf.credits ?? 0) + credits);
  };
  return { value: cumulative.projected.cgpa, low: mix(sgpaPrediction.low), high: mix(sgpaPrediction.high) };
}

/** Per-unit risk: failing, missing the subject target, or safe. */
export function subjectRisks(subjectStats, grading) {
  const out = [];
  for (const s of subjectStats) {
    for (const u of s.units) {
      if (u.source !== 'projected' || !(u.confidence > 0)) continue;
      let level = 'low';
      let reason = 'Projected comfortably above passing.';
      if (isFail(u.grade)) {
        level = 'high';
        reason = u.failReason || 'Projected below passing.';
      } else if (isNum(u.percent) && u.percent < (grading.passingPercent ?? 40) + 8) {
        level = 'high';
        reason = 'Projected close to the passing mark.';
      } else if (s.targetStatus && !s.targetStatus.locked && s.targetStatus.feasible && !s.targetStatus.onTrack) {
        level = s.targetStatus.required - (u.rateUsed ?? 0) > 15 ? 'medium' : 'low';
        reason = `Needs ${s.targetStatus.required.toFixed(0)}% on remaining work for ${s.targetStatus.target.grade}.`;
      } else if (s.targetStatus && !s.targetStatus.locked && !s.targetStatus.feasible) {
        level = 'medium';
        reason = `Target ${s.targetStatus.target.grade} is no longer reachable.`;
      }
      out.push({ unit: u, subject: s.subject, level, reason, confidence: confidenceLabel(u.confidence) });
    }
  }
  const rank = { high: 2, medium: 1, low: 0 };
  return out.sort((a, b) => rank[b.level] - rank[a.level]);
}

export function deadlineRisks(assignments, today, subjectById) {
  return assignments
    .filter(isOpenAssignment)
    .filter((a) => a.dueDate && a.dueDate <= addDaysISO(today, 14))
    .map((a) => {
      const days = diffDays(a.dueDate, today);
      let level = 'low';
      if (days < 0) level = 'overdue';
      else if (a.status === 'not-started' && days <= 3) level = 'high';
      else if (a.status === 'not-started' && days <= 7) level = 'medium';
      else if (a.status === 'in-progress' && days <= 1) level = 'medium';
      return { assignment: a, subject: subjectById[a.subjectId], days, level };
    })
    .sort((a, b) => a.days - b.days);
}

export function studyProjection(sessions, study, today) {
  const end = monthEndISO(today);
  const daysLeft = Math.max(0, diffDays(end, today));
  return {
    monthProjectedMin: study.thisMonth + study.avgPerDay28 * daysLeft,
    weekProjectedMin: study.thisWeek + study.avgPerDay28 * Math.max(0, 6 - ((new Date(`${today}T00:00:00`).getDay() + 6) % 7)),
    avgPerDay28: study.avgPerDay28,
  };
}

export function buildPredictions(a, data, profile, today) {
  const grading = profile.grading;
  const sgpa = predictSgpa(a.current, data, grading);
  const cgpa = predictCgpa(a.cumulative, sgpa, a.current);
  const attendance = a.currentSemester ? projectAttendance(a.attendance, a.currentSemester, today) : null;
  const goals = a.goals
    .filter((g) => g.goal.status === 'active' && g.likelihood)
    .map((g) => ({ goal: g.goal, likelihood: g.likelihood, projectedPercent: g.projectedPercent, percent: g.percent }));
  const exams = a.goals
    .filter((g) => g.goal.status === 'active' && g.exam)
    .map((g) => {
      const e = g.exam;
      const startedDays = g.goal.startDate ? Math.max(1, diffDays(today, g.goal.startDate)) : null;
      const perDay = startedDays ? e.overall / startedDays : null;
      const daysToFull = perDay > 0 ? Math.ceil((100 - e.overall) / perDay) : null;
      return { goal: g.goal, overall: e.overall, finishDate: daysToFull != null ? addDaysISO(today, daysToFull) : null, examDate: g.goal.exam?.date };
    });
  return {
    sgpa,
    cgpa,
    attendance,
    subjects: subjectRisks(a.subjectStats || [], grading),
    deadlines: deadlineRisks(data.assignments, today, a.subjectById),
    study: studyProjection(data.studySessions, a.study, today),
    goals,
    exams,
    sampleSize: {
      assessed: a.current ? Math.round((a.current.confidence || 0) * 100) : 0,
      studyDays: new Set(data.studySessions.map((s) => s.date)).size,
      logs: data.dailyLogs.length,
      sessions: sum(data.studySessions, () => 1),
    },
  };
}
