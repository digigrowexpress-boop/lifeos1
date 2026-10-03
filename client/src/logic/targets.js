/**
 * Target calculator: what the user must score on remaining assessments to reach
 * a target SGPA / CGPA / subject grade. Based only on entered marks.
 */
import { isNum, sum } from '../lib/format.js';
import { ascendingGrades, evaluateSemester, gradeByName, isFail, sortedScale } from './academics.js';

/** Percent needed on the remaining (pending) weight of a unit to reach `minPercent` overall. */
export function requiredOnRemaining(unit, minPercent) {
  const ev = unit.evaluation;
  if (!ev || !ev.totalWeight) return null;
  const needC = (minPercent / 100) * ev.totalWeight - ev.knownC;
  if (needC <= 1e-9) return 0;
  if (ev.pendingW <= 0) return Infinity;
  return (needC / ev.pendingW) * 100;
}

/** For each unit, the score needed on remaining work for every grade in the scale. */
export function gradeRequirements(unit, grading) {
  return sortedScale(grading)
    .filter((g) => !isFail(g))
    .map((g) => {
      const req = requiredOnRemaining(unit, Math.max(g.min, grading.passingPercent ?? 0));
      return { grade: g, required: req, feasible: req !== null && req <= 100, secured: req === 0 };
    });
}

/** Best grade still mathematically reachable (100% on everything pending). */
export function maxAchievableGrade(unit, grading) {
  if (unit.source === 'official') return unit.grade;
  const reqs = gradeRequirements(unit, grading);
  return reqs.find((r) => r.feasible)?.grade || null;
}

/** SGPA if every pending component scored `p` percent. */
export function sgpaAtUniform(semester, subjects, grading, p) {
  return evaluateSemester(semester, subjects, grading, { forcePendingRate: p }).computedSgpa;
}

/**
 * Uniform requirement: the single percentage on all remaining assessments that
 * reaches the target SGPA (binary search; SGPA is monotonic in p).
 */
export function uniformRequirement(semester, subjects, grading, target) {
  const lo = sgpaAtUniform(semester, subjects, grading, 0);
  const hi = sgpaAtUniform(semester, subjects, grading, 100);
  if (!isNum(target) || lo == null || hi == null) return { status: 'no-data', min: lo, max: hi };
  if (lo >= target - 1e-9) return { status: 'secured', percent: 0, min: lo, max: hi };
  if (hi < target - 1e-9) return { status: 'unreachable', percent: null, min: lo, max: hi };
  let a = 0;
  let b = 100;
  for (let i = 0; i < 30; i += 1) {
    const m = (a + b) / 2;
    if (sgpaAtUniform(semester, subjects, grading, m) >= target - 1e-9) b = m;
    else a = m;
  }
  return { status: 'reachable', percent: Math.ceil(b * 10) / 10, min: lo, max: hi };
}

/**
 * Grade plan: start from the projected grade of every unit and upgrade the
 * cheapest units (least extra effort per SGPA point, credit-aware) until the
 * target is met. Returns per-unit target grade + required score on remaining.
 */
export function gradePlan(semResult, grading, target) {
  const units = semResult.units.filter((u) => u.credits > 0 && u.source !== 'empty');
  const totalCredits = sum(units, (u) => u.credits);
  if (!units.length || !totalCredits || !isNum(target)) return null;
  const asc = ascendingGrades(grading).filter((g) => !isFail(g));

  const state = units.map((u) => {
    const locked = u.source === 'official' || u.source === 'confirmed' || (u.evaluation?.pendingW ?? 0) <= 0;
    const current = u.grade && !isFail(u.grade) ? u.grade : asc[0];
    return { unit: u, locked, grade: locked ? u.grade : current, rate: u.rateUsed ?? 0 };
  });
  const sgpaOf = () => sum(state, (s) => s.unit.credits * (Number(s.grade?.points) || 0)) / totalCredits;

  let guard = 0;
  while (sgpaOf() < target - 1e-9 && guard < 200) {
    guard += 1;
    let best = null;
    for (const s of state) {
      if (s.locked) continue;
      const idx = asc.findIndex((g) => g.grade === s.grade?.grade);
      const next = asc[idx + 1];
      if (!next) continue;
      const req = requiredOnRemaining(s.unit, Math.max(next.min, grading.passingPercent ?? 0));
      if (req == null || req > 100) continue;
      const gain = s.unit.credits * (Number(next.points) - Number(s.grade?.points || 0));
      if (gain <= 0) continue;
      const effort = Math.max(0, req - s.rate) + 1; // +1 keeps ties credit-aware
      const cost = effort / gain;
      if (!best || cost < best.cost) best = { s, next, cost };
    }
    if (!best) break;
    best.s.grade = best.next;
  }

  const reached = sgpaOf() >= target - 1e-9;
  return {
    target,
    reached,
    plannedSgpa: sgpaOf(),
    rows: state.map((s) => {
      const req = s.locked ? null : requiredOnRemaining(s.unit, Math.max(Number(s.grade?.min) || 0, grading.passingPercent ?? 0));
      return {
        unit: s.unit,
        locked: s.locked,
        projectedGrade: s.unit.grade,
        targetGrade: s.grade,
        requiredOnRemaining: req,
        upgrade: (Number(s.grade?.points) || 0) - (Number(s.unit.points) || 0),
        aboveCurrentRate: req != null && s.unit.rateUsed != null ? req - s.unit.rateUsed : null,
      };
    }),
  };
}

/**
 * Minimum grade needed in each unit if every other unit achieves its best
 * possible grade. Shows where there is no room for error.
 */
export function minimumGrades(semResult, grading, target) {
  const units = semResult.units.filter((u) => u.credits > 0 && u.source !== 'empty');
  const total = sum(units, (u) => u.credits);
  if (!units.length || !isNum(target)) return [];
  const best = units.map((u) => Number(maxAchievableGrade(u, grading)?.points ?? u.points ?? 0));
  const asc = ascendingGrades(grading);
  return units.map((u, i) => {
    const others = sum(units.map((x, j) => (j === i ? 0 : x.credits * best[j])));
    const neededPoints = (target * total - others) / u.credits;
    const grade = asc.find((g) => Number(g.points) >= neededPoints - 1e-9) || null;
    return {
      unit: u,
      neededPoints,
      grade,
      impossible: neededPoints > Number(asc[asc.length - 1]?.points ?? 0) + 1e-9,
      bestPossible: maxAchievableGrade(u, grading),
      anyPass: neededPoints <= 0,
    };
  });
}

/** SGPA gained per one-grade step in each unit — where effort pays most. */
export function impactRanking(semResult, grading) {
  const units = semResult.units.filter((u) => u.credits > 0 && u.source !== 'empty');
  const total = sum(units, (u) => u.credits);
  const asc = ascendingGrades(grading);
  return units
    .map((u) => {
      const idx = asc.findIndex((g) => g.grade === u.grade?.grade);
      const next = idx >= 0 ? asc[idx + 1] : null;
      const step = next ? Number(next.points) - Number(u.grade.points) : 0;
      const open = u.source !== 'official' && u.source !== 'confirmed' && (u.evaluation?.pendingW ?? 0) > 0;
      const reqNext = next && open ? requiredOnRemaining(u, next.min) : null;
      return {
        unit: u,
        creditShare: u.credits / (total || 1),
        sgpaPerGrade: total ? (u.credits * (step || 1)) / total : 0,
        nextGrade: next,
        requiredForNext: reqNext,
        open,
        remainingShare: u.pendingShare ?? 0,
      };
    })
    .sort((a, b) => b.sgpaPerGrade - a.sgpaPerGrade);
}

/** Required score on remaining work for the subject's own target grade. */
export function subjectTargetStatus(unit, subject, grading) {
  const tg = gradeByName(subject.targetGrade, grading);
  if (!tg) return null;
  if (unit.source === 'official' || unit.source === 'confirmed') {
    return { target: tg, achieved: Number(unit.points) >= Number(tg.points), required: null, locked: true };
  }
  const req = requiredOnRemaining(unit, Math.max(tg.min, grading.passingPercent ?? 0));
  return {
    target: tg,
    required: req,
    feasible: req !== null && req <= 100,
    onTrack: isNum(unit.points) && Number(unit.points) >= Number(tg.points),
    gapPoints: Number(tg.points) - (Number(unit.points) || 0),
    locked: false,
  };
}

/**
 * CGPA target: average SGPA needed across remaining credits.
 * Remaining credits = unfinished semesters (including the in-progress one),
 * estimated from average credits per semester when not yet created.
 */
export function cgpaRequirement({ semesterResults, grading, programSemesters, target }) {
  if (!isNum(target)) return null;
  const method = grading.cgpaMethod || 'credit-weighted';
  const done = semesterResults.filter((r) => isNum(r.confirmedSgpa) && r.totalCredits > 0);
  const open = semesterResults.filter((r) => !isNum(r.confirmedSgpa));
  const knownCredits = semesterResults.map((r) => r.totalCredits).filter((c) => c > 0);
  const avgCredits = knownCredits.length ? sum(knownCredits) / knownCredits.length : 20;
  const plannedCount = Math.max(Number(programSemesters) || 0, done.length + open.length);
  const unseen = Math.max(0, plannedCount - done.length - open.length);
  const openCredits = sum(open, (r) => r.totalCredits || avgCredits) + unseen * avgCredits;
  const remainingSemesters = open.length + unseen;

  const doneCredits = sum(done, (r) => r.totalCredits);
  const donePoints = sum(done, (r) => r.confirmedSgpa * r.totalCredits);
  const currentCgpa = doneCredits ? donePoints / doneCredits : null;

  if (!remainingSemesters || !openCredits) {
    return { status: 'complete', currentCgpa, remainingSemesters: 0, requiredSgpa: null, method };
  }
  let requiredSgpa;
  if (method === 'sgpa-average') {
    requiredSgpa = (target * (done.length + remainingSemesters) - sum(done, (r) => r.confirmedSgpa)) / remainingSemesters;
  } else {
    requiredSgpa = (target * (doneCredits + openCredits) - donePoints) / openCredits;
  }
  const maxPoint = Number(grading.maxPoint) || 10;
  let status = 'reachable';
  if (requiredSgpa > maxPoint + 1e-9) status = 'unreachable';
  else if (requiredSgpa <= 0) status = 'secured';
  return {
    status,
    method,
    currentCgpa,
    doneCredits,
    doneSemesters: done.length,
    remainingSemesters,
    remainingCredits: openCredits,
    avgCredits,
    requiredSgpa,
    maxPoint,
  };
}
