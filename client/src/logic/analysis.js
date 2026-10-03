/**
 * Builds the complete derived view of the user's data. Recomputed whenever any
 * record or setting changes, so every page reads consistent, current numbers.
 */
import { isNum, sum } from '../lib/format.js';
import { addDaysISO, subDaysISO } from '../lib/dates.js';
import {
  compareSemesters,
  evaluateCumulative,
  evaluateSemester,
  gradeByName,
  gradeForPercent,
  ascendingGrades,
  subjectCredits,
  subjectSplits,
  weightTotals,
} from './academics.js';
import { attendanceStats } from './attendance.js';
import { minutesOf, sessionsBetween, studySummary } from './study.js';
import { goalProgress, goalsOverview } from './goals.js';
import { lifestyleCorrelations, lifestyleMetrics, lifestyleSummary } from './lifestyle.js';
import { cgpaRequirement, gradePlan, subjectTargetStatus, uniformRequirement } from './targets.js';
import { generateInsights, isOpenAssignment, todaysFocus } from './insights.js';
import { buildPredictions } from './predictions.js';
import { buildNotifications } from './notifications.js';
import { computeAchievements } from './achievements.js';

export function pickCurrentSemester(semesters, profile) {
  const byId = semesters.find((s) => s.id === profile.currentSemesterId);
  if (byId) return byId;
  const ongoing = semesters.filter((s) => s.status === 'ongoing').sort(compareSemesters);
  if (ongoing.length) return ongoing[ongoing.length - 1];
  const all = [...semesters].sort(compareSemesters);
  return all[all.length - 1] || null;
}

function targetPercentFor(subject, grading, sgpaTarget) {
  const tg = gradeByName(subject.targetGrade, grading);
  if (tg) return tg.min;
  if (!isNum(sgpaTarget)) return null;
  const g = ascendingGrades(grading).find((x) => Number(x.points) >= sgpaTarget - 1e-9);
  return g ? g.min : null;
}

function buildSubjectStats(current, data, grading, attendance, sgpaTarget, today) {
  if (!current) return [];
  return current.subjects.map((s) => {
    const units = current.units.filter((u) => u.subjectId === s.id);
    // Only units with real (assessed or official) data feed the subject's percent/grade.
    const graded = units.filter((u) => u.source !== 'empty' && (u.source === 'official' || (u.confidence || 0) > 0));
    const withPct = graded.filter((u) => isNum(u.percent));
    const cw = sum(withPct, (u) => u.credits || 1);
    const percent = withPct.length ? sum(withPct, (u) => u.percent * (u.credits || 1)) / cw : null;
    const withPts = graded.filter((u) => isNum(u.points));
    const pw = sum(withPts, (u) => u.credits || 1);
    const points = withPts.length ? sum(withPts, (u) => u.points * (u.credits || 1)) / pw : null;
    const grade = graded.length === 1 ? graded[0].grade : isNum(percent) ? gradeForPercent(percent, grading) : null;

    const known = (s.components || [])
      .map((c, i) => ({ ...c, i, percent: c.status !== 'pending' && isNum(c.obtained) && c.maxMarks > 0 ? (c.obtained / c.maxMarks) * 100 : null }))
      .filter((c) => c.percent != null && c.status === 'confirmed')
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.i - b.i);
    // Compare like with like: the latest assessment against the previous one of the same type (Mid-1 → Mid-2).
    const last = known[known.length - 1];
    const prev = last ? [...known.slice(0, -1)].reverse().find((c) => c.assessmentType === last.assessmentType && c.kind === last.kind) : null;
    const trend = last && prev ? { prev, last, delta: last.percent - prev.percent } : null;

    const totalW = sum(s.components || [], (c) => c.weight);
    const pendingW = sum((s.components || []).filter((c) => c.status === 'pending' || !isNum(c.obtained)), (c) => c.weight);
    const sessions = data.studySessions.filter((x) => x.subjectId === s.id);
    const combinedUnit = units.find((u) => u.part === 'combined');

    return {
      subject: s,
      units,
      credits: subjectCredits(s),
      percent,
      points,
      grade,
      splits: subjectSplits(s),
      splitsConfirmed: subjectSplits(s, { confirmedOnly: true }),
      targetPercent: targetPercentFor(s, grading, sgpaTarget),
      targetStatus: combinedUnit ? subjectTargetStatus(combinedUnit, s, grading) : null,
      trend,
      pendingShare: totalW ? pendingW / totalW : 0,
      weightTotal: weightTotals(s).total,
      attendance: attendance.bySubject.find((x) => x.subject.id === s.id) || null,
      studyMin28: minutesOf(sessionsBetween(sessions, subDaysISO(today, 27), today)),
      studyMinTotal: minutesOf(sessions),
      upcomingExams: data.exams.filter((e) => e.subjectId === s.id && e.status === 'upcoming' && e.date >= today),
      openAssignments: data.assignments.filter((x) => x.subjectId === s.id && isOpenAssignment(x)),
    };
  });
}

function lifeAreas(a, data, profile) {
  const prefs = profile.preferences;
  const grading = profile.grading;
  const maxPoint = Number(grading.maxPoint) || 10;
  const areas = [];
  const tone = (score) => (score == null ? 'neutral' : score >= 75 ? 'good' : score >= 50 ? 'warning' : 'critical');

  const sg = a.current?.effectiveSgpa;
  const sgTarget = a.targets.sgpaTarget;
  const acadScore = isNum(sg) ? Math.min(100, (sg / (isNum(sgTarget) ? sgTarget : maxPoint)) * 100) : null;
  areas.push({ key: 'academics', label: 'Academics', to: '/academics', score: acadScore, headline: isNum(sg) ? `SGPA ${sg.toFixed(2)}` : 'No marks yet', sub: isNum(a.cumulative.projected.cgpa) ? `CGPA ${a.cumulative.projected.cgpa.toFixed(2)}${a.cumulative.confirmed.cgpa == null ? ' (est.)' : ''}` : 'Add subjects & marks' });

  const wk = a.study.weeklyTargetMin ? Math.min(100, (a.study.thisWeek / a.study.weeklyTargetMin) * 100) : null;
  areas.push({ key: 'study', label: 'Study', to: '/study', score: wk, headline: `${(a.study.thisWeek / 60).toFixed(1)}h this week`, sub: `${a.study.streak.current}-day streak` });

  const go = a.goalsOverview;
  const goalScore = go.active ? Math.max(0, 100 - (go.behind / go.active) * 100 * 0.8) : null;
  areas.push({ key: 'goals', label: 'Goals', to: '/goals', score: goalScore, headline: `${go.active} active`, sub: go.behind ? `${go.behind} behind schedule` : go.active ? 'All on pace' : 'Set your first goal' });

  if (prefs.modules.lifestyle !== false) {
    const l7 = a.lifestyle.summary.last7;
    const parts = [];
    if (isNum(l7.sleep)) parts.push(Math.min(100, (l7.sleep / (prefs.sleepTargetHours || 7.5)) * 100));
    if (isNum(l7.social)) parts.push(Math.max(0, 100 - Math.max(0, l7.social - (prefs.socialLimitHours || 1.5)) * 40));
    if (isNum(l7.exercise)) parts.push(Math.min(100, (l7.exercise / (prefs.exerciseTargetMin || 30)) * 100));
    areas.push({ key: 'lifestyle', label: 'Lifestyle', to: '/lifestyle', score: parts.length ? sum(parts) / parts.length : null, headline: isNum(l7.sleep) ? `${l7.sleep.toFixed(1)}h sleep avg` : 'Not logged', sub: isNum(l7.social) ? `${l7.social.toFixed(1)}h social/day` : 'Log your day' });
  }
  if (prefs.modules.attendance !== false) {
    const o = a.attendance.overall;
    areas.push({ key: 'attendance', label: 'Attendance', to: '/attendance', score: o.percent, headline: o.total ? `${o.percent.toFixed(0)}% overall` : 'No records', sub: o.total ? (o.risk === 'safe' ? `Can miss ${o.canMiss}` : `Attend next ${o.mustAttend}`) : 'Mark today’s lectures' });
  }
  const open = data.tasks.filter((t) => t.status === 'todo' || t.status === 'in-progress');
  const overdue = open.filter((t) => t.dueDate && t.dueDate < a.today).length + data.assignments.filter(isOpenAssignment).filter((x) => x.dueDate && x.dueDate < a.today).length;
  const doneRecent = data.tasks.filter((t) => t.status === 'done' && t.completedAt && t.completedAt >= subDaysISO(a.today, 13)).length;
  areas.push({ key: 'tasks', label: 'Tasks', to: '/tasks', score: open.length + doneRecent ? Math.max(0, (doneRecent / (doneRecent + open.length)) * 100 - overdue * 10) : null, headline: `${open.length} open`, sub: overdue ? `${overdue} overdue` : `${doneRecent} done in 2 wk` });
  areas.push({ key: 'analytics', label: 'Analytics', to: '/analytics', score: a.study.consistency28, headline: isNum(a.study.consistency28) ? `${a.study.consistency28.toFixed(0)}% consistent` : '—', sub: 'Study days, last 4 weeks' });
  const crit = a.insights.filter((i) => i.severity === 'critical').length;
  const warn = a.insights.filter((i) => i.severity === 'warning').length;
  const insightsScore = a.insights.length ? 100 * Math.exp(-(crit * 0.25 + warn * 0.06)) : null;
  areas.push({ key: 'progress', label: 'Insights', to: '/insights', score: insightsScore, headline: `${a.insights.filter((i) => i.severity === 'critical' || i.severity === 'warning').length} need attention`, sub: `${a.insights.filter((i) => i.severity === 'positive').length} wins` });
  areas.push({ key: 'achievements', label: 'Achievements', to: '/timeline', score: a.achievements.all.length ? (a.achievements.earned.length / a.achievements.all.length) * 100 : null, headline: `${a.achievements.earned.length} earned`, sub: a.achievements.earned[0]?.title || 'Keep going' });

  return areas.map((x) => ({ ...x, tone: tone(x.score) }));
}

export function buildAnalysis(data, profile, today) {
  const grading = profile.grading;
  const prefs = profile.preferences;
  const subjectById = Object.fromEntries(data.subjects.map((s) => [s.id, s]));
  const semesterById = Object.fromEntries(data.semesters.map((s) => [s.id, s]));

  const semesterResults = data.semesters.map((sem) => evaluateSemester(sem, data.subjects, grading)).sort(compareSemesters);
  const cumulative = evaluateCumulative(semesterResults, grading);
  const currentSemester = pickCurrentSemester(data.semesters, profile);
  const current = currentSemester ? semesterResults.find((r) => r.semester.id === currentSemester.id) : null;

  const threshold = Number(grading.attendanceThreshold) || 75;
  const attendance = attendanceStats(data.attendance, current?.subjects || [], threshold);
  const attendanceAll = attendanceStats(data.attendance, data.subjects, threshold);
  const study = studySummary(data.studySessions, today, prefs);

  const sgpaTarget = isNum(currentSemester?.targetSgpa) ? Number(currentSemester.targetSgpa) : isNum(profile.targets?.sgpa) ? Number(profile.targets.sgpa) : null;
  const cgpaTarget = isNum(profile.targets?.cgpa) ? Number(profile.targets.cgpa) : null;

  // Goals track the projected CGPA (confirmed semesters + current estimate).
  const cgpaValue = cumulative.projected.cgpa ?? cumulative.confirmed.cgpa;
  const goalCtx = {
    today,
    sessions: data.studySessions,
    tasks: data.tasks,
    cgpa: cgpaValue,
    semesterSgpa: (id) => semesterResults.find((r) => r.semester.id === id)?.effectiveSgpa ?? null,
  };
  const goals = data.goals.map((g) => goalProgress(g, goalCtx));

  const metrics = lifestyleMetrics(prefs.customFields);
  const lifestyle = {
    metrics,
    summary: lifestyleSummary(data.dailyLogs, data.studySessions, today, metrics),
    correlations: lifestyleCorrelations(data.dailyLogs, data.studySessions, metrics, { today }),
    daysLogged7: 0,
  };
  lifestyle.daysLogged7 = lifestyle.summary.daysLogged7;

  const targets = {
    sgpaTarget,
    cgpaTarget,
    uniform: current && isNum(sgpaTarget) ? uniformRequirement(current.semester, data.subjects, grading, sgpaTarget) : null,
    plan: current && isNum(sgpaTarget) ? gradePlan(current, grading, sgpaTarget) : null,
    cgpa: isNum(cgpaTarget) ? cgpaRequirement({ semesterResults, grading, programSemesters: profile.university?.semesterCount, target: cgpaTarget }) : null,
  };

  const subjectStats = buildSubjectStats(current, data, grading, attendance, sgpaTarget, today);
  const ranked = subjectStats.filter((s) => isNum(s.percent)).sort((x, y) => y.percent - x.percent);
  const strong = ranked.filter((s) => s.percent >= 75).slice(0, 3);
  const weak = [...ranked].reverse().filter((s) => s.percent < (s.targetPercent ?? 65) || s.percent < 60).slice(0, 3);

  const upcomingAssignments = data.assignments
    .filter(isOpenAssignment)
    .filter((x) => x.dueDate)
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const upcomingExams = data.exams
    .filter((e) => e.status === 'upcoming' && e.date && e.date >= today)
    .sort((x, y) => x.date.localeCompare(y.date));

  const a = {
    today,
    subjectById,
    semesterById,
    semesterResults,
    cumulative,
    currentSemester,
    current,
    attendance,
    attendanceAll,
    study,
    goals,
    goalsOverview: goalsOverview(goals),
    lifestyle,
    targets,
    subjectStats,
    strong,
    weak,
    upcomingAssignments,
    upcomingExams,
    examsThisWeek: upcomingExams.filter((e) => e.date <= addDaysISO(today, 7)),
  };
  a.insights = generateInsights(a, data, profile, today);
  a.focus = todaysFocus(a, data, profile, today);
  a.predictions = buildPredictions(a, data, profile, today);
  a.notifications = buildNotifications(a, data, profile, today);
  a.achievements = computeAchievements(a, data);
  a.areas = lifeAreas(a, data, profile);
  return a;
}
