/**
 * Area-of-improvement engine and smart recommendations.
 * Every insight is derived from recorded data and links to where to act.
 */
import { fmtDuration, fmtGpa, fmtPct, isNum, plural, sum } from '../lib/format.js';
import { addDaysISO, daysFromToday, parse, relativeDay, subDaysISO } from '../lib/dates.js';
import { gradeByName, isFail } from './academics.js';
import { sessionsBetween, minutesOf } from './study.js';

const SEVERITY_RANK = { critical: 3, warning: 2, info: 1, positive: 0 };

const OPEN_ASSIGNMENT = new Set(['not-started', 'in-progress', 'completed']);
export const isOpenAssignment = (a) => OPEN_ASSIGNMENT.has(a.status) && !a.archived;

function insight(id, severity, category, title, detail, extra = {}) {
  return { id, severity, category, title, detail, priority: SEVERITY_RANK[severity] * 100 + (extra.weight || 0), ...extra };
}

export function generateInsights(a, data, profile, today) {
  const out = [];
  const grading = profile.grading;
  const prefs = profile.preferences;
  const mod = prefs.modules || {};
  const fmtD = (m) => fmtDuration(m, prefs.timeFormat);
  const decimals = grading.decimals ?? 2;
  const cur = a.current;
  const subjects = a.subjectStats || [];

  /* ---------------- Academic targets ---------------- */
  if (cur && isNum(a.targets.sgpaTarget) && isNum(cur.projectedSgpa) && cur.status === 'in-progress') {
    const t = a.targets.sgpaTarget;
    const u = a.targets.uniform;
    if (u?.status === 'unreachable') {
      out.push(
        insight('target-unreachable', 'critical', 'Academics', `Target SGPA ${t} is out of reach this semester`, `Even with full marks on every remaining assessment the maximum is ${fmtGpa(u.max, decimals)}. Consider adjusting the target or focusing on your CGPA plan.`, { action: { label: 'Open target calculator', to: '/targets' }, weight: 40 })
      );
    } else if (cur.projectedSgpa < t - 1e-9 && u?.status === 'reachable') {
      const avgRate = cur.rates?.overall;
      out.push(
        insight('target-gap', 'warning', 'Academics', `Projected SGPA ${fmtGpa(cur.projectedSgpa, decimals)} is below your target ${t}`, `You need about ${fmtPct(u.percent, 1)} on all remaining assessments${isNum(avgRate) ? ` (your current average is ${fmtPct(avgRate)})` : ''}. Estimate based on marks entered so far.`, { action: { label: 'See required scores', to: '/targets' }, weight: 35 })
      );
    } else if (cur.projectedSgpa >= t) {
      out.push(insight('target-on-track', 'positive', 'Academics', `On track for target SGPA ${t}`, `Projected SGPA ${fmtGpa(cur.projectedSgpa, decimals)} (estimate). Keep your current performance on the remaining assessments.`, { action: { label: 'View plan', to: '/targets' } }));
    }
  }

  /* ---------------- Subject-level ---------------- */
  const credits = subjects.map((s) => s.credits).sort((x, y) => x - y);
  const medianCredits = credits.length ? credits[Math.floor(credits.length / 2)] : 0;
  const targetPoints = isNum(a.targets.sgpaTarget) ? a.targets.sgpaTarget : null;

  for (const s of subjects) {
    const name = s.subject.code || s.subject.name;
    const to = `/academics/subjects/${s.subject.id}`;
    for (const u of s.units) {
      if (u.source === 'empty') continue;
      if (isFail(u.grade)) {
        out.push(insight(`fail-${u.key}`, 'critical', 'Academics', `${u.label} is projected below passing`, u.failReason ? `${u.failReason}. Prioritise the remaining assessments.` : `Current projection ${fmtPct(u.percent)} is under the ${grading.passingPercent}% passing mark.`, { action: { label: 'Open subject', to }, subjectId: s.subject.id, weight: 50 }));
      }
    }
    const tg = gradeByName(s.subject.targetGrade, grading);
    const goalPts = tg ? Number(tg.points) : targetPoints;
    const open = s.units.some((u) => u.source === 'projected' || u.source === 'simulated');
    if (open && isNum(goalPts) && isNum(s.points) && s.points < goalPts && s.credits >= medianCredits && s.credits > 0) {
      const step = a.current?.totalCredits ? s.credits / a.current.totalCredits : 0;
      out.push(
        insight(`high-credit-gap-${s.subject.id}`, 'warning', 'Academics', `${name} carries ${plural(s.credits, 'credit')} and is below target`, `Projected ${s.grade?.grade ?? '—'} (${fmtGpa(s.points, 0)} pts) vs ${tg ? `target ${tg.grade}` : `target SGPA ${targetPoints}`}. Each grade point gained here moves SGPA by about +${step.toFixed(2)}.`, { action: { label: 'Open subject', to }, subjectId: s.subject.id, weight: 20 + s.credits })
      );
    }
    if (open && s.pendingShare >= 0.5 && isNum(goalPts) && isNum(s.points) && s.points < goalPts) {
      out.push(insight(`recoverable-${s.subject.id}`, 'info', 'Academics', `${Math.round(s.pendingShare * 100)}% of ${name} is still to be assessed`, 'Plenty of marks remain — consistent preparation now can still change the final grade.', { action: { label: 'See requirements', to: '/targets' }, subjectId: s.subject.id }));
    }
    const { theory, practical, internal, external } = s.splits;
    if (isNum(theory) && isNum(practical) && Math.abs(theory - practical) >= 15) {
      const strongPart = practical > theory ? 'practical' : 'theory';
      const weakPart = strongPart === 'practical' ? 'theory' : 'practical';
      out.push(insight(`split-${s.subject.id}`, 'info', 'Academics', `${name}: ${strongPart} is stronger than ${weakPart}`, `Your ${name} ${strongPart} performance is ${fmtPct(Math.max(theory, practical))}, but ${weakPart} is ${fmtPct(Math.min(theory, practical))}. Focus revision on the ${weakPart} side.`, { action: { label: 'Open subject', to }, subjectId: s.subject.id }));
    }
    if (isNum(internal) && isNum(external) && Math.abs(internal - external) >= 20) {
      out.push(insight(`intext-${s.subject.id}`, 'info', 'Academics', `${name}: ${internal > external ? 'external' : 'internal'} marks trail ${internal > external ? 'internal' : 'external'} marks`, `Internal ${fmtPct(internal)} vs external ${fmtPct(external)} (including provisional marks).`, { action: { label: 'Open subject', to }, subjectId: s.subject.id }));
    }
    const tr = s.trend;
    if (tr && tr.delta <= -15) {
      out.push(insight(`decline-${s.subject.id}`, 'warning', 'Academics', `Marks in ${name} dropped`, `${tr.prev.name}: ${fmtPct(tr.prev.percent)} → ${tr.last.name}: ${fmtPct(tr.last.percent)}.`, { action: { label: 'Open subject', to }, subjectId: s.subject.id, weight: 10 }));
    } else if (tr && tr.delta >= 15) {
      out.push(insight(`improve-${s.subject.id}`, 'positive', 'Academics', `Marks in ${name} improved`, `${tr.prev.name}: ${fmtPct(tr.prev.percent)} → ${tr.last.name}: ${fmtPct(tr.last.percent)}. Keep it going.`, { subjectId: s.subject.id }));
    }
    if (s.weightTotal && Math.abs(s.weightTotal - 100) > 0.5) {
      out.push(insight(`weights-${s.subject.id}`, 'info', 'Data quality', `${name}: component weights add up to ${s.weightTotal}`, 'LifeOS scales weights proportionally, but check that the assessment structure matches your university scheme.', { action: { label: 'Fix structure', to } }));
    }
  }

  /* ---------------- Study allocation ---------------- */
  const window28 = sessionsBetween(data.studySessions, subDaysISO(today, 27), today);
  const academicStudy = window28.filter((x) => subjects.some((s) => s.subject.id === x.subjectId));
  const totalAcademicMin = minutesOf(academicStudy);
  if (subjects.length >= 2 && totalAcademicMin >= 300) {
    const ranked = subjects
      .filter((s) => isNum(s.percent))
      .map((s) => {
        const need = s.credits * Math.max(5, (s.targetPercent ?? 85) - s.percent);
        return { s, need, time: minutesOf(academicStudy.filter((x) => x.subjectId === s.subject.id)) };
      });
    const needTotal = sum(ranked, (r) => r.need) || 1;
    ranked.forEach((r) => {
      r.needShare = r.need / needTotal;
      r.timeShare = r.time / totalAcademicMin;
    });
    const weakest = [...ranked].sort((x, y) => x.s.percent - y.s.percent)[0];
    const overServed = ranked.filter((r) => r.s.percent >= 75 && r.timeShare >= 0.3 && r.timeShare > r.needShare * 1.75).sort((x, y) => y.timeShare - x.timeShare)[0];
    if (weakest && overServed && weakest !== overServed && weakest.timeShare < weakest.needShare * 0.6) {
      const n1 = overServed.s.subject.code || overServed.s.subject.name;
      const n2 = weakest.s.subject.code || weakest.s.subject.name;
      out.push(insight('allocation', 'warning', 'Study', 'Study time is going to already-strong subjects', `In the last 4 weeks ${Math.round(overServed.timeShare * 100)}% of subject study went to ${n1} (${fmtPct(overServed.s.percent)}), but only ${Math.round(weakest.timeShare * 100)}% to ${n2}, your weakest at ${fmtPct(weakest.s.percent)}.`, { action: { label: 'Plan study', to: '/study' }, weight: 15 }));
    }
  }
  for (const s of subjects) {
    if (!isNum(s.percent) || s.percent >= 60) continue;
    const recent = minutesOf(sessionsBetween(data.studySessions, subDaysISO(today, 13), today).filter((x) => x.subjectId === s.subject.id));
    if (recent === 0 && data.studySessions.length > 0) {
      out.push(insight(`neglect-${s.subject.id}`, 'warning', 'Study', `No study logged for ${s.subject.code || s.subject.name} in 2 weeks`, `It is one of your weaker subjects (${fmtPct(s.percent)} projected).`, { action: { label: 'Log a session', to: '/study' }, subjectId: s.subject.id, weight: 8 }));
    }
  }

  /* ---------------- Study consistency ---------------- */
  const st = a.study;
  if (st.prev7 >= 120 && st.last7 < st.prev7 * 0.7) {
    out.push(insight('study-decline', 'warning', 'Study', 'Study consistency is declining', `${fmtD(st.last7)} in the last 7 days vs ${fmtD(st.prev7)} the week before (−${Math.round((1 - st.last7 / st.prev7) * 100)}%).`, { action: { label: 'Open study tracker', to: '/study' }, weight: 5 }));
  } else if (st.prev7 > 0 && st.last7 >= st.prev7 * 1.25 && st.last7 >= 300) {
    out.push(insight('study-rise', 'positive', 'Study', 'Study time is up', `${fmtD(st.last7)} in the last 7 days, up from ${fmtD(st.prev7)}.`, {}));
  }
  if (st.streak.current >= 5) {
    out.push(insight('streak', 'positive', 'Study', `${st.streak.current}-day study streak`, `Your longest streak is ${plural(st.streak.longest, 'day')}.`, {}));
  }
  if (st.weeklyTargetMin > 0) {
    const dow = (parse(today).getDay() + 6) % 7; // Mon=0
    const expectedSoFar = (st.weeklyTargetMin * (dow + 1)) / 7;
    if (dow >= 3 && st.thisWeek < expectedSoFar * 0.7) {
      out.push(insight('weekly-target', 'info', 'Study', 'Behind this week’s study target', `${fmtD(st.thisWeek)} of ${fmtD(st.weeklyTargetMin)} so far — about ${fmtD(expectedSoFar - st.thisWeek)} behind pace.`, { action: { label: 'Open study tracker', to: '/study' } }));
    }
  }

  /* ---------------- Deadlines & exams ---------------- */
  if (mod.assignments !== false) {
    const open = data.assignments.filter(isOpenAssignment).filter((x) => x.dueDate);
    const overdue = open.filter((x) => x.dueDate < today);
    if (overdue.length) {
      out.push(insight('overdue', 'critical', 'Deadlines', `${plural(overdue.length, 'submission')} overdue`, overdue.slice(0, 3).map((x) => `${x.title} (due ${relativeDay(x.dueDate, today)})`).join(' · '), { action: { label: 'Open submissions', to: '/assignments' }, weight: 30 }));
    }
    const week = open.filter((x) => x.dueDate >= today && x.dueDate <= addDaysISO(today, 7));
    if (week.length) {
      const notStarted = week.filter((x) => x.status === 'not-started' && daysFromToday(x.dueDate, today) <= 3);
      out.push(insight('due-week', notStarted.length ? 'warning' : 'info', 'Deadlines', `${plural(week.length, 'submission')} due this week`, notStarted.length ? `${plural(notStarted.length, 'is', 'are')} not started and due within 3 days: ${notStarted.map((x) => x.title).join(', ')}.` : week.map((x) => `${x.title} — ${relativeDay(x.dueDate, today)}`).join(' · '), { action: { label: 'Open submissions', to: '/assignments' }, weight: 12 }));
    }
  }
  if (mod.exams !== false) {
    const soon = data.exams.filter((e) => e.status === 'upcoming' && e.date && e.date >= today && e.date <= addDaysISO(today, 7));
    for (const e of soon) {
      const subj = a.subjectById[e.subjectId];
      const high = ['mid', 'university', 'practical', 'competitive'].includes(e.type) || (subj && subj.credits >= medianCredits);
      const prep = Number(e.preparation) || 0;
      if (prep < 70) {
        out.push(insight(`exam-${e.id}`, high && prep < 50 ? 'warning' : 'info', 'Exams', `${e.title} ${relativeDay(e.date, today).toLowerCase()}`, `Preparation is at ${prep}%${subj ? ` · ${subj.name}, ${plural(Number(subj.credits) || 0, 'credit')}` : ''}.`, { action: { label: 'Open exams', to: '/exams' }, weight: 20 - daysFromToday(e.date, today) }));
      }
    }
  }

  /* ---------------- Attendance ---------------- */
  if (mod.attendance !== false && a.attendance.recordCount > 0) {
    for (const s of a.attendance.bySubject) {
      if (!s.total) continue;
      const name = s.subject.code || s.subject.name;
      if (s.risk === 'critical') {
        out.push(insight(`att-${s.subject.id}`, 'critical', 'Attendance', `${name} attendance is ${fmtPct(s.percent)}`, `Below the ${a.attendance.threshold}% requirement. Attend the next ${plural(s.mustAttend, 'class', 'classes')} in a row to recover.`, { action: { label: 'Open attendance', to: '/attendance' }, weight: 25 }));
      } else if (s.risk === 'warning') {
        out.push(insight(`att-${s.subject.id}`, 'warning', 'Attendance', `${name} attendance is close to the limit`, s.canMiss > 0 ? `${fmtPct(s.percent)} — you can miss at most ${plural(s.canMiss, 'more class', 'more classes')}.` : `${fmtPct(s.percent)} — missing even one more class drops you below ${a.attendance.threshold}%.`, { action: { label: 'Open attendance', to: '/attendance' }, weight: 5 }));
      }
    }
  }

  /* ---------------- Goals ---------------- */
  for (const g of a.goals) {
    if (g.goal.status !== 'active') continue;
    const to = `/goals/${g.goal.id}`;
    if ((g.type === 'cgpa' || g.type === 'sgpa') && ['behind', 'at-risk', 'overdue'].includes(g.pace)) {
      out.push(insight(`goal-${g.goal.id}`, g.pace === 'behind' ? 'warning' : 'critical', 'Goals', `“${g.goal.title}” needs a stronger finish`, `Current ${g.unit} ${fmtGpa(g.current, decimals)} (includes this semester’s estimate) vs target ${g.target}.`, { action: { label: 'Open target calculator', to: '/targets' }, weight: 6 }));
      continue;
    }
    if (g.pace === 'at-risk' || g.pace === 'overdue') {
      out.push(insight(`goal-${g.goal.id}`, 'critical', 'Goals', `“${g.goal.title}” is ${g.pace === 'overdue' ? 'past its target date' : 'falling well behind'}`, `${Math.round(g.percent)}% complete vs ${Math.round(g.expected ?? 100)}% expected by now.`, { action: { label: 'Open goal', to }, weight: g.goal.priority === 'critical' || g.goal.priority === 'high' ? 15 : 5 }));
    } else if (g.pace === 'behind') {
      out.push(insight(`goal-${g.goal.id}`, 'warning', 'Goals', `“${g.goal.title}” is behind schedule`, `${Math.round(g.percent)}% complete vs ${Math.round(g.expected)}% expected by now.`, { action: { label: 'Open goal', to }, weight: g.goal.priority === 'high' || g.goal.priority === 'critical' ? 10 : 2 }));
    }
    if (g.behindWeekly) {
      out.push(insight(`goal-week-${g.goal.id}`, 'info', 'Goals', `“${g.goal.title}” is below its weekly hours`, `${fmtD(g.weekStudyMin)} in the last 7 days vs ${fmtD(g.weeklyTargetMin)} target.`, { action: { label: 'Open goal', to } }));
    }
    for (const m of g.overdueMilestones.slice(0, 2)) {
      out.push(insight(`ms-${g.goal.id}-${m.id}`, 'warning', 'Goals', `Milestone overdue: ${m.title}`, `Part of “${g.goal.title}”, due ${relativeDay(m.dueDate, today)}.`, { action: { label: 'Open goal', to } }));
    }
    if (g.exam && mod.competitive !== false) {
      for (const sp of g.exam.subjects) {
        if (sp.behindWeekly && sp.weekMin < sp.weeklyTargetMin * 0.6) {
          out.push(insight(`exam-week-${g.goal.id}-${sp.subject.id}`, 'warning', 'Goals', `${g.goal.title} ${sp.subject.name} is behind your weekly target`, `${fmtD(sp.weekMin)} this week vs ${fmtD(sp.weeklyTargetMin)} planned.`, { action: { label: 'Open tracker', to } }));
        }
      }
      if (g.exam.behind) {
        out.push(insight(`exam-behind-${g.goal.id}`, 'warning', 'Goals', `${g.goal.title} syllabus coverage is behind`, `${Math.round(g.exam.overall)}% covered vs ~${Math.round(g.exam.expected)}% expected by today. Weakest: ${g.exam.weakest.map((x) => x.subject.name).join(', ')}.`, { action: { label: 'Open tracker', to }, weight: 8 }));
      }
    }
    if (g.pace === 'ahead') {
      out.push(insight(`goal-ahead-${g.goal.id}`, 'positive', 'Goals', `“${g.goal.title}” is ahead of schedule`, `${Math.round(g.percent)}% complete vs ${Math.round(g.expected)}% expected.`, {}));
    }
  }

  /* ---------------- Lifestyle ---------------- */
  if (mod.lifestyle !== false && profile.privacy?.useLifestyleInInsights !== false) {
    const ls = a.lifestyle;
    if (ls.daysLogged7 >= 3) {
      const sleep = ls.summary.last7.sleep;
      if (isNum(sleep) && sleep < (prefs.sleepTargetHours || 7.5) - 1) {
        out.push(insight('sleep-low', 'warning', 'Lifestyle', `Averaging ${sleep.toFixed(1)}h of sleep`, `Below your ${prefs.sleepTargetHours}h target over the last 7 days.`, { action: { label: 'Open lifestyle', to: '/lifestyle' }, weight: 4 }));
      }
      const social = ls.summary.last7.social;
      if (isNum(social) && social > (prefs.socialLimitHours || 1.5) + 0.25) {
        const studyH = st.last7 / 60 / 7;
        out.push(insight('social-high', 'warning', 'Lifestyle', `Social media is averaging ${social.toFixed(1)}h/day`, `Above your ${prefs.socialLimitHours}h limit${studyH ? ` — compared with ${studyH.toFixed(1)}h/day of study` : ''}.`, { action: { label: 'Open lifestyle', to: '/lifestyle' }, weight: 3 }));
      }
      const screen = ls.summary.last7.screen;
      if (isNum(screen) && screen > (prefs.screenLimitHours || 4) + 0.25) {
        out.push(insight('screen-high', 'info', 'Lifestyle', `Screen time averaging ${screen.toFixed(1)}h/day`, `Above your ${prefs.screenLimitHours}h limit this week.`, { action: { label: 'Open lifestyle', to: '/lifestyle' } }));
      }
    }
    for (const c of ls.correlations.results.slice(0, 2)) {
      out.push(insight(`corr-${c.a}-${c.b}`, 'info', 'Lifestyle', 'Pattern in your data', `${c.text} (${c.strength} relationship, r = ${c.r.toFixed(2)}, ${c.n} days — a pattern, not proof of cause.)`, { action: { label: 'See trends', to: '/lifestyle' } }));
    }
  }

  /* ---------------- Logging habit ---------------- */
  if (mod.logbook !== false && data.dailyLogs.length >= 3) {
    const recent = data.dailyLogs.some((l) => l.date >= subDaysISO(today, 1));
    if (!recent) out.push(insight('log-gap', 'info', 'Habits', 'No daily log for the last 2 days', 'Logging keeps your trends and predictions accurate.', { action: { label: 'Log today', to: '/logbook' } }));
  }

  /* ---------------- History ---------------- */
  const confirmedSeries = a.cumulative.series.filter((x) => x.sgpaStatus === 'official' || x.sgpaStatus === 'confirmed');
  if (confirmedSeries.length >= 2) {
    const [p, l] = confirmedSeries.slice(-2);
    const d = l.sgpa - p.sgpa;
    if (d >= 0.3) out.push(insight('sgpa-up', 'positive', 'Academics', `SGPA improved in ${l.name}`, `${fmtGpa(p.sgpa, decimals)} → ${fmtGpa(l.sgpa, decimals)} (+${d.toFixed(2)}).`, {}));
    if (d <= -0.3) out.push(insight('sgpa-down', 'warning', 'Academics', `SGPA dropped in ${l.name}`, `${fmtGpa(p.sgpa, decimals)} → ${fmtGpa(l.sgpa, decimals)} (${d.toFixed(2)}). Review which subjects pulled it down.`, { action: { label: 'Open academics', to: '/academics' } }));
  }

  return out.sort((x, y) => y.priority - x.priority);
}

/**
 * Today's focus: a concrete, small plan for today built from tasks, deadlines,
 * exams and a priority-weighted study allocation.
 */
export function todaysFocus(a, data, profile, today) {
  const prefs = profile.preferences;
  const mod = prefs.modules || {};
  const items = [];

  if (mod.tasks !== false) {
    const due = data.tasks
      .filter((t) => (t.status === 'todo' || t.status === 'in-progress') && t.dueDate && t.dueDate <= today)
      .sort((x, y) => String(x.dueDate).localeCompare(String(y.dueDate)));
    for (const t of due.slice(0, 3)) {
      items.push({ id: `task-${t.id}`, kind: 'task', title: t.title, detail: t.dueDate < today ? `Overdue · ${relativeDay(t.dueDate, today)}` : 'Due today', to: '/tasks', taskId: t.id });
    }
  }
  if (mod.assignments !== false) {
    const next = data.assignments
      .filter(isOpenAssignment)
      .filter((x) => x.dueDate && x.dueDate <= addDaysISO(today, 3))
      .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
    for (const x of next.slice(0, 2)) {
      items.push({ id: `asg-${x.id}`, kind: 'assignment', title: `Work on ${x.title}`, detail: `${a.subjectById[x.subjectId]?.name ?? 'Submission'} · due ${relativeDay(x.dueDate, today).toLowerCase()}`, to: '/assignments' });
    }
  }

  // Study allocation by priority
  const examSoon = (subjectId) =>
    data.exams.some((e) => e.subjectId === subjectId && e.status === 'upcoming' && e.date >= today && e.date <= addDaysISO(today, 10));
  const recentMin = (subjectId) => minutesOf(sessionsBetween(data.studySessions, subDaysISO(today, 6), today).filter((s) => s.subjectId === subjectId));
  const scored = (a.subjectStats || [])
    .filter((s) => s.units.some((u) => u.source === 'projected'))
    .map((s) => {
      const gap = isNum(s.percent) ? Math.max(3, (s.targetPercent ?? 85) - s.percent) : 20;
      const score = (s.credits || 1) * gap * (examSoon(s.subject.id) ? 2 : 1) / (1 + recentMin(s.subject.id) / 120);
      return { s, score, examSoon: examSoon(s.subject.id) };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);

  let competitive = null;
  if (mod.competitive !== false) {
    const g = a.goals.find((x) => x.goal.status === 'active' && x.exam && x.exam.subjects.length);
    if (g) competitive = { goal: g.goal, subject: g.exam.weakest[0]?.subject };
  }

  const targetMin = (Number(prefs.dailyStudyTargetHours) || 0) * 60;
  const remaining = Math.max(0, targetMin - a.study.today);
  if (remaining >= 30 && (scored.length || competitive)) {
    const academicShare = competitive ? 0.7 : 1;
    const totalScore = sum(scored, (x) => x.score) || 1;
    for (const x of scored) {
      const min = Math.max(20, Math.round(((remaining * academicShare * x.score) / totalScore) / 5) * 5);
      items.push({
        id: `study-${x.s.subject.id}`,
        kind: 'study',
        title: `Study ${x.s.subject.name}`,
        detail: `${fmtDuration(min, prefs.timeFormat)} · ${x.examSoon ? 'exam coming up' : isNum(x.s.percent) ? `projected ${fmtPct(x.s.percent)}` : 'no marks yet — get ahead early'}`,
        to: `/study?subject=${x.s.subject.id}`,
        minutes: min,
      });
    }
    if (competitive?.subject) {
      const min = Math.max(20, Math.round((remaining * (scored.length ? 0.3 : 1)) / 5) * 5);
      items.push({ id: `comp-${competitive.goal.id}`, kind: 'study', title: `${competitive.goal.title}: ${competitive.subject.name}`, detail: `${fmtDuration(min, prefs.timeFormat)} · weakest syllabus area`, to: `/goals/${competitive.goal.id}`, minutes: min });
    }
  }

  if (mod.exams !== false) {
    const exam = data.exams
      .filter((e) => e.status === 'upcoming' && e.date && e.date >= today && e.date <= addDaysISO(today, 5))
      .sort((x, y) => x.date.localeCompare(y.date))[0];
    if (exam) items.push({ id: `exam-${exam.id}`, kind: 'exam', title: `Prepare for ${exam.title}`, detail: `${relativeDay(exam.date, today)} · preparation ${exam.preparation || 0}%`, to: '/exams' });
  }
  if (mod.logbook !== false && !data.dailyLogs.some((l) => l.date === today)) {
    items.push({ id: 'log-today', kind: 'log', title: 'Log today', detail: 'Sleep, screen time, productivity and notes', to: '/logbook' });
  }
  return items;
}
