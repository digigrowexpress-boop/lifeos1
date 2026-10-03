/**
 * Builds the compact snapshot the AI coach receives.
 *
 * Privacy: only computed summaries are shared — no name, email, free-text notes
 * or raw daily logs. Lifestyle data is included only when the user allows it.
 * The exact object is viewable on the AI Coach page before anything is sent.
 */
import { isNum } from '../lib/format.js';
import { addDaysISO, subDaysISO } from '../lib/dates.js';
import { isOpenAssignment } from './insights.js';
import { sessionsBetween } from './study.js';

const r1 = (n) => (isNum(n) ? Math.round(Number(n) * 10) / 10 : null);
const r2 = (n) => (isNum(n) ? Math.round(Number(n) * 100) / 100 : null);
const hours = (min) => r1((Number(min) || 0) / 60);

export function buildAiContext(a, data, profile, today, { includeLifestyle = true } = {}) {
  const grading = profile.grading;
  const cur = a.current;
  const subjectName = (id) => a.subjectById[id]?.name || null;
  const last28 = sessionsBetween(data.studySessions, subDaysISO(today, 27), today);

  const snapshot = {
    today,
    student: {
      degree: profile.university?.degree || null,
      program: profile.university?.program || null,
      totalSemesters: profile.university?.semesterCount || null,
    },
    gradingRules: {
      maxGradePoint: grading.maxPoint,
      passingPercent: grading.passingPercent,
      cgpaMethod: grading.cgpaMethod,
      attendanceRequirementPercent: grading.attendanceThreshold,
      scale: [...grading.scale].sort((x, y) => y.min - x.min).map((g) => `${g.grade} ≥${g.min}% = ${g.points}`),
    },
    academics: {
      cgpaConfirmed: r2(a.cumulative.confirmed.cgpa),
      cgpaIncludingCurrentEstimate: r2(a.cumulative.projected.cgpa),
      targetCgpa: a.targets.cgpaTarget,
      cgpaPlan: a.targets.cgpa
        ? { status: a.targets.cgpa.status, requiredAverageSgpaForRest: r2(a.targets.cgpa.requiredSgpa), remainingSemesters: a.targets.cgpa.remainingSemesters }
        : null,
      semesterHistory: a.cumulative.series.map((s) => ({ semester: s.name, sgpa: r2(s.sgpa), basis: s.sgpaStatus === 'in-progress' ? 'projected estimate' : s.sgpaStatus, target: s.target })),
      currentSemester: cur
        ? {
            name: cur.semester.name,
            basis: cur.status === 'in-progress' ? 'projected estimate' : cur.status,
            sgpa: r2(cur.effectiveSgpa),
            likelyRange: a.predictions.sgpa ? [r2(a.predictions.sgpa.low), r2(a.predictions.sgpa.high)] : null,
            percentOfMarksAssessed: Math.round((cur.confidence || 0) * 100),
            targetSgpa: a.targets.sgpaTarget,
            neededOnAllRemainingAssessments:
              a.targets.uniform?.status === 'reachable' ? `${a.targets.uniform.percent}%` : a.targets.uniform?.status || null,
            subjects: a.subjectStats.map((s) => ({
              name: s.subject.name,
              code: s.subject.code || null,
              credits: s.credits,
              projectedPercent: r1(s.percent),
              projectedGrade: s.grade?.grade || null,
              targetGrade: s.subject.targetGrade || null,
              neededOnRemainingForTarget:
                s.targetStatus && !s.targetStatus.locked ? (s.targetStatus.feasible ? `${Math.round(s.targetStatus.required)}%` : 'not reachable') : null,
              stillToBeAssessedPercent: Math.round((s.pendingShare || 0) * 100),
              theoryPercent: r1(s.splits.theory),
              practicalPercent: r1(s.splits.practical),
              latestTrend: s.trend ? `${s.trend.prev.name} ${Math.round(s.trend.prev.percent)}% → ${s.trend.last.name} ${Math.round(s.trend.last.percent)}%` : null,
              attendancePercent: s.attendance?.total ? r1(s.attendance.percent) : null,
              studyHoursLast28Days: hours(s.studyMin28),
              difficulty: s.subject.difficulty || null,
              selfRatedStrength: s.subject.strength || null,
            })),
            efficientGradePlan: a.targets.plan
              ? a.targets.plan.rows.map((row) => ({
                  subject: row.unit.label,
                  aimFor: row.targetGrade?.grade || null,
                  neededOnRemaining: row.locked ? 'final' : isNum(row.requiredOnRemaining) ? `${Math.round(row.requiredOnRemaining)}%` : null,
                }))
              : null,
            subjectRisks: a.predictions.subjects.filter((x) => x.level !== 'low').map((x) => ({ subject: x.unit.label, level: x.level, reason: x.reason })),
          }
        : null,
    },
    study: {
      todayHours: hours(a.study.today),
      thisWeekHours: hours(a.study.thisWeek),
      lastWeekHours: hours(a.study.lastWeek),
      dailyTargetHours: hours(a.study.dailyTargetMin),
      weeklyTargetHours: hours(a.study.weeklyTargetMin),
      streakDays: a.study.streak.current,
      longestStreakDays: a.study.streak.longest,
      daysStudiedLast28Percent: r1(a.study.consistency28),
      hoursBySubjectLast28Days: Object.fromEntries(
        Object.entries(
          last28.reduce((acc, s) => {
            const k = subjectName(s.subjectId) || data.goals.find((g) => g.id === s.goalId)?.title || s.type || 'Other';
            acc[k] = (acc[k] || 0) + (Number(s.durationMin) || 0);
            return acc;
          }, {})
        ).map(([k, v]) => [k, hours(v)])
      ),
      hoursByTypeLast28Days: Object.fromEntries(
        Object.entries(last28.reduce((acc, s) => ({ ...acc, [s.type || 'Other']: (acc[s.type || 'Other'] || 0) + (Number(s.durationMin) || 0) }), {})).map(([k, v]) => [k, hours(v)])
      ),
    },
    goals: a.goals
      .filter((g) => g.goal.status === 'active' || g.goal.status === 'paused')
      .map((g) => ({
        title: g.goal.title,
        category: g.goal.category,
        priority: g.goal.priority,
        status: g.goal.status,
        progressPercent: Math.round(g.percent),
        expectedByNowPercent: isNum(g.expected) ? Math.round(g.expected) : null,
        pace: g.pace,
        daysLeft: g.daysLeft,
        completionLikelihoodEstimate: g.likelihood,
        hoursLast7Days: hours(g.weekStudyMin),
        weeklyHoursTarget: g.goal.weeklyHoursTarget || null,
        nextMilestone: g.nextMilestone ? { title: g.nextMilestone.title, due: g.nextMilestone.dueDate || null } : null,
        competitiveExam: g.exam
          ? {
              exam: g.goal.exam?.name || g.goal.title,
              examDate: g.goal.exam?.date || null,
              daysToExam: g.exam.daysToExam,
              syllabusCoveragePercent: r1(g.exam.overall),
              expectedCoverageByNowPercent: isNum(g.exam.expected) ? Math.round(g.exam.expected) : null,
              subjects: g.exam.subjects.map((sp) => ({
                name: sp.subject.name,
                marksWeight: sp.subject.weight ?? null,
                progressPercent: r1(sp.progress),
                topicsDone: `${sp.topicsDone}/${sp.topicCount}`,
                weakTopics: sp.weakTopics.map((t) => t.name),
                hoursThisWeek: hours(sp.weekMin),
                weeklyTargetHours: sp.weeklyTargetMin ? hours(sp.weeklyTargetMin) : null,
                questionsSolved: sp.questionsSolved,
              })),
              recentMockScoresPercent: g.exam.mocks.slice(-5).map((m) => ({ date: m.date, test: m.name, percent: Math.round(m.percent) })),
            }
          : null,
      })),
    deadlines: {
      submissions: a.upcomingAssignments
        .filter((x) => x.dueDate <= addDaysISO(today, 14))
        .map((x) => ({ title: x.title, subject: subjectName(x.subjectId), due: x.dueDate, status: x.status, overdue: x.dueDate < today })),
      exams: a.upcomingExams
        .filter((e) => e.date <= addDaysISO(today, 30))
        .map((e) => ({ title: e.title, subject: subjectName(e.subjectId), type: e.type, date: e.date, preparationPercent: e.preparation || 0 })),
      overdueTasks: data.tasks.filter((t) => (t.status === 'todo' || t.status === 'in-progress') && t.dueDate && t.dueDate < today).map((t) => t.title).slice(0, 10),
      tasksDueToday: data.tasks.filter((t) => (t.status === 'todo' || t.status === 'in-progress') && t.dueDate === today).map((t) => t.title).slice(0, 10),
      openSubmissionsTotal: data.assignments.filter(isOpenAssignment).length,
    },
    attendance: a.attendance.overall.total
      ? {
          overallPercent: r1(a.attendance.overall.percent),
          canStillMissClasses: a.attendance.overall.canMiss,
          projectedEndOfSemesterPercent: r1(a.predictions.attendance?.percent),
          subjectsAtRisk: a.attendance.bySubject
            .filter((s) => s.total && s.risk !== 'safe')
            .map((s) => ({ subject: s.subject.name, percent: r1(s.percent), mustAttendNext: s.mustAttend, canMiss: s.canMiss })),
        }
      : null,
    lifeosInsights: a.insights.slice(0, 12).map((i) => ({ severity: i.severity, area: i.category, insight: i.title, detail: i.detail })),
    lifeosFocusForToday: a.focus.map((f) => `${f.title} (${f.detail})`),
  };

  if (includeLifestyle && profile.preferences.modules?.lifestyle !== false) {
    const ls = a.lifestyle.summary;
    const pick = (o) =>
      o && {
        sleepHours: r1(o.sleep),
        screenTimeHours: r1(o.screen),
        socialMediaHours: r1(o.social),
        exerciseMinutes: r1(o.exercise),
        productivityOutOf10: r1(o.productivity),
        moodOutOf5: r1(o.mood),
      };
    snapshot.lifestyle = {
      daysLoggedLast7: ls.daysLogged7,
      averagesLast7Days: pick(ls.last7),
      averagesPrevious7Days: pick(ls.prev7),
      averagesLast30Days: pick(ls.last30),
      personalTargets: {
        sleepHours: profile.preferences.sleepTargetHours,
        screenLimitHours: profile.preferences.screenLimitHours,
        socialLimitHours: profile.preferences.socialLimitHours,
        exerciseMinutes: profile.preferences.exerciseTargetMin,
      },
      patternsInData: a.lifestyle.correlations.results.map((c) => `${c.text} (r=${c.r.toFixed(2)}, ${c.n} days; correlation only)`),
    };
  }
  return snapshot;
}
