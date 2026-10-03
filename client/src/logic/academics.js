/**
 * Academic calculation engine: grades, grade points, SGPA and CGPA.
 *
 * Data-state rules (never mixed silently):
 *  - confirmed   official marks; the only values that make a result "confirmed"
 *  - expected /  user-provided provisional marks; used for projections only
 *    estimated
 *  - pending     not assessed yet; projections fill these with a predicted rate
 *  - simulated   what-if overrides; only exist inside the simulator
 */
import { clamp, isNum, round, sum } from '../lib/format.js';

/* ------------------------------------------------------------------ */
/* Grade scale                                                         */
/* ------------------------------------------------------------------ */

export const sortedScale = (grading) => [...(grading?.scale || [])].sort((a, b) => b.min - a.min);

export function gradeForPercent(percent, grading) {
  if (!isNum(percent)) return null;
  const scale = sortedScale(grading);
  if (!scale.length) return null;
  if (percent < (grading.passingPercent ?? 0)) return failGrade(grading);
  for (const g of scale) if (percent >= g.min - 1e-9) return g;
  return scale[scale.length - 1];
}

export function gradeByName(name, grading) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return (grading?.scale || []).find((g) => g.grade.toLowerCase() === key) || null;
}

export function failGrade(grading) {
  const scale = sortedScale(grading);
  return scale.reduce((lo, g) => (lo == null || g.points < lo.points ? g : lo), null);
}

export const isFail = (grade) => Boolean(grade) && Number(grade.points) <= 0;

/** Grades from lowest to highest points (passing grades only, plus the fail grade first). */
export const ascendingGrades = (grading) => sortedScale(grading).slice().reverse();

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

export function componentHasValue(c, status = c.status) {
  return status !== 'pending' && isNum(c.obtained) && Number(c.maxMarks) > 0;
}

export function componentPercent(c) {
  return componentHasValue(c) ? clamp((Number(c.obtained) / Number(c.maxMarks)) * 100, 0, 100) : null;
}

/**
 * Evaluate a list of components.
 * @param overrides  { [componentId]: number } hypothetical obtained marks (simulator)
 * Weights are relative: contribution = percent × weight / Σweight.
 */
export function evaluateComponents(components = [], overrides = null) {
  const buckets = {
    confirmed: { w: 0, c: 0 },
    expected: { w: 0, c: 0 },
    estimated: { w: 0, c: 0 },
    simulated: { w: 0, c: 0 },
    pending: { w: 0, c: 0 },
  };
  let totalWeight = 0;
  const rows = [];
  for (const comp of components) {
    const weight = Math.max(0, Number(comp.weight) || 0);
    totalWeight += weight;
    let status = ['confirmed', 'expected', 'estimated', 'pending'].includes(comp.status) ? comp.status : 'pending';
    let obtained = comp.obtained;
    if (overrides && isNum(overrides[comp.id])) {
      status = 'simulated';
      obtained = Number(overrides[comp.id]);
    }
    const max = Number(comp.maxMarks) || 0;
    const has = status !== 'pending' && isNum(obtained) && max > 0;
    if (!has) {
      buckets.pending.w += weight;
      rows.push({ ...comp, effectiveStatus: 'pending', percent: null, contribution: null, weight });
      continue;
    }
    const percent = clamp((Number(obtained) / max) * 100, 0, 100);
    const contribution = (percent * weight) / 100;
    buckets[status].w += weight;
    buckets[status].c += contribution;
    rows.push({ ...comp, obtained: Number(obtained), effectiveStatus: status, percent, contribution, weight });
  }
  const knownW = buckets.confirmed.w + buckets.expected.w + buckets.estimated.w + buckets.simulated.w;
  const knownC = buckets.confirmed.c + buckets.expected.c + buckets.estimated.c + buckets.simulated.c;
  return { rows, buckets, totalWeight, knownW, knownC, pendingW: buckets.pending.w };
}

/** Average percent the student is scoring on assessed components (null if nothing known). */
export function performanceRate(evaluation, minShare = 0.05) {
  if (!evaluation.totalWeight || evaluation.knownW / evaluation.totalWeight < minShare) return null;
  return (evaluation.knownC / evaluation.knownW) * 100;
}

/* ------------------------------------------------------------------ */
/* Subject → gradeable units                                           */
/* ------------------------------------------------------------------ */

/**
 * A subject yields one gradeable unit (combined) or two (split theory/practical
 * credits graded separately). Each unit carries credits and a grade.
 */
export function subjectParts(subject) {
  const comps = subject.components || [];
  if (subject.gradingMode === 'split') {
    return [
      {
        key: `${subject.id}:theory`,
        part: 'theory',
        label: `${subject.name} (Theory)`,
        credits: Number(subject.theoryCredits) || 0,
        components: comps.filter((c) => c.kind !== 'practical'),
        officialGrade: subject.officialGradeTheory,
      },
      {
        key: `${subject.id}:practical`,
        part: 'practical',
        label: `${subject.name} (Practical)`,
        credits: Number(subject.practicalCredits) || 0,
        components: comps.filter((c) => c.kind === 'practical'),
        officialGrade: subject.officialGradePractical,
      },
    ].filter((p) => p.credits > 0 || p.components.length);
  }
  return [
    {
      key: `${subject.id}:all`,
      part: 'combined',
      label: subject.name,
      credits: Number(subject.credits) || 0,
      components: comps,
      officialGrade: subject.officialGrade,
    },
  ];
}

export const subjectCredits = (subject) =>
  subject.gradingMode === 'split'
    ? (Number(subject.theoryCredits) || 0) + (Number(subject.practicalCredits) || 0)
    : Number(subject.credits) || 0;

/**
 * Evaluate one unit.
 * @param ctx.rate          percent assumed for pending components (projection)
 * @param ctx.overrides     simulator overrides
 * @param ctx.forcePendingRate  rate applied to pending regardless of performance (target solver)
 */
export function evaluateUnit(part, grading, ctx = {}) {
  const ev = evaluateComponents(part.components, ctx.overrides);
  const official = gradeByName(part.officialGrade, grading);
  const base = {
    key: part.key,
    part: part.part,
    label: part.label,
    subjectId: part.subjectId,
    credits: part.credits,
    evaluation: ev,
    totalWeight: ev.totalWeight,
  };

  if (official && !ctx.ignoreOfficial) {
    return { ...base, grade: official, points: Number(official.points), percent: null, source: 'official', confidence: 1, failReason: null };
  }
  if (!ev.totalWeight) {
    return { ...base, grade: null, points: null, percent: null, source: 'empty', confidence: 0, failReason: null };
  }

  const ownRate = performanceRate(ev);
  const baseRate = isNum(ctx.forcePendingRate) ? ctx.forcePendingRate : ownRate ?? ctx.rate ?? grading.pendingFixedPercent ?? 65;
  const rate = clamp(baseRate + (Number(ctx.rateOffset) || 0), 0, 100);
  const projectedC = ev.knownC + (ev.pendingW * rate) / 100;
  const percent = (projectedC / ev.totalWeight) * 100;

  const isConfirmed = ev.buckets.confirmed.w >= ev.totalWeight - 1e-9;
  const hasSim = ev.buckets.simulated.w > 0;
  let source = 'projected';
  if (isConfirmed) source = 'confirmed';
  else if (hasSim) source = 'simulated';

  // Minimum-passing rules on individual components (e.g. 35% in end-sem).
  let failReason = null;
  for (const row of ev.rows) {
    if (!isNum(row.minPassPercent)) continue;
    const p = row.percent ?? (source !== 'confirmed' ? rate : null);
    if (isNum(p) && p < row.minPassPercent) {
      failReason = `${row.name} below minimum ${row.minPassPercent}%`;
      break;
    }
  }
  let grade = gradeForPercent(percent, grading);
  if (failReason) grade = failGrade(grading);

  return {
    ...base,
    grade,
    points: grade ? Number(grade.points) : null,
    percent,
    securedPercent: (ev.buckets.confirmed.c / ev.totalWeight) * 100,
    minPercent: (ev.knownC / ev.totalWeight) * 100,
    maxPercent: ((ev.knownC + ev.pendingW) / ev.totalWeight) * 100,
    pendingShare: ev.pendingW / ev.totalWeight,
    confirmedShare: ev.buckets.confirmed.w / ev.totalWeight,
    provisionalShare: (ev.buckets.expected.w + ev.buckets.estimated.w) / ev.totalWeight,
    rateUsed: ev.pendingW > 0 ? rate : null,
    rateSource: ev.pendingW > 0 ? (isNum(ctx.forcePendingRate) ? 'scenario' : ownRate != null ? 'subject' : 'fallback') : null,
    source,
    confidence: ev.knownW / ev.totalWeight,
    failReason,
  };
}

export function evaluateSubject(subject, grading, ctx = {}) {
  return subjectParts(subject).map((p) => evaluateUnit({ ...p, subjectId: subject.id }, grading, ctx));
}

/* ------------------------------------------------------------------ */
/* Rates used to project pending components                            */
/* ------------------------------------------------------------------ */

export function computeRates(subjects, grading) {
  if (grading.pendingAssumption === 'fixed') {
    const f = grading.pendingFixedPercent ?? 65;
    return { theory: f, practical: f, overall: f };
  }
  const acc = { theory: { w: 0, c: 0 }, practical: { w: 0, c: 0 } };
  for (const s of subjects) {
    for (const c of s.components || []) {
      if (!componentHasValue(c)) continue;
      const k = c.kind === 'practical' ? 'practical' : 'theory';
      const w = Number(c.weight) || 0;
      acc[k].w += w;
      acc[k].c += (componentPercent(c) * w) / 100;
    }
  }
  const r = (b) => (b.w ? (b.c / b.w) * 100 : null);
  const overall = acc.theory.w + acc.practical.w ? ((acc.theory.c + acc.practical.c) / (acc.theory.w + acc.practical.w)) * 100 : null;
  const fallback = grading.pendingFixedPercent ?? 65;
  return { theory: r(acc.theory) ?? overall ?? fallback, practical: r(acc.practical) ?? overall ?? fallback, overall: overall ?? fallback };
}

/* ------------------------------------------------------------------ */
/* Semester                                                            */
/* ------------------------------------------------------------------ */

function weightedGpa(units, grading) {
  const counted = units.filter((u) => isNum(u.points) && u.credits > 0 && (grading.countFailedCredits || !isFail(u.grade)));
  const credits = sum(counted, (u) => u.credits);
  const creditPoints = sum(counted, (u) => u.credits * u.points);
  return { gpa: credits ? creditPoints / credits : null, credits, creditPoints };
}

/**
 * @param opts.mode       'projected' (default) or 'confirmed'
 * @param opts.overrides  simulator overrides
 */
export function evaluateSemester(semester, subjects, grading, opts = {}) {
  const semSubjects = subjects.filter((s) => s.semesterId === semester.id && !s.archived);
  const rates = opts.rates || computeRates(semSubjects, grading);
  const units = semSubjects.flatMap((s) =>
    subjectParts(s).map((p) =>
      evaluateUnit({ ...p, subjectId: s.id }, grading, {
        rate: p.part === 'practical' ? rates.practical : rates.theory,
        overrides: opts.overrides,
        forcePendingRate: opts.forcePendingRate,
        rateOffset: opts.rateOffset,
      })
    )
  );
  const graded = units.filter((u) => u.source !== 'empty');
  const totalCredits = sum(units, (u) => u.credits);
  const all = weightedGpa(graded, grading);
  const confirmedUnits = graded.filter((u) => u.source === 'official' || u.source === 'confirmed');
  const confirmedPart = weightedGpa(confirmedUnits, grading);
  const allConfirmed = units.length > 0 && confirmedUnits.length === units.length;

  const hasOfficial = isNum(semester.officialSgpa);
  const officialCredits = isNum(semester.officialCredits) ? Number(semester.officialCredits) : totalCredits;

  // A projection needs at least some assessed marks; otherwise it would be pure assumption.
  const anyKnown = graded.some((u) => u.source === 'official' || (u.confidence || 0) > 0);

  let status = 'empty';
  if (hasOfficial) status = 'official';
  else if (allConfirmed) status = 'confirmed';
  else if (graded.length && anyKnown) status = 'in-progress';

  const confirmedSgpa = hasOfficial ? Number(semester.officialSgpa) : allConfirmed ? all.gpa : null;
  const projectedSgpa = hasOfficial ? Number(semester.officialSgpa) : anyKnown ? all.gpa : null;

  return {
    semester,
    subjects: semSubjects,
    units,
    rates,
    totalCredits: hasOfficial ? officialCredits : totalCredits,
    computedSgpa: all.gpa,
    computedCredits: all.credits,
    creditPoints: all.creditPoints,
    confirmedSgpa,
    projectedSgpa,
    partialConfirmed: { sgpa: confirmedPart.gpa, credits: confirmedPart.credits, units: confirmedUnits.length },
    status,
    isEstimate: status === 'in-progress',
    effectiveSgpa: confirmedSgpa ?? projectedSgpa,
    confidence: units.length ? sum(units, (u) => (u.confidence || 0) * u.credits) / (totalCredits || 1) : 0,
    failedUnits: graded.filter((u) => isFail(u.grade)),
  };
}

/* ------------------------------------------------------------------ */
/* Cumulative                                                          */
/* ------------------------------------------------------------------ */

function combine(entries, method) {
  const valid = entries.filter((e) => isNum(e.sgpa) && e.credits > 0);
  if (!valid.length) return { cgpa: null, credits: 0, count: 0 };
  const credits = sum(valid, (e) => e.credits);
  const cgpa = method === 'sgpa-average' ? sum(valid, (e) => e.sgpa) / valid.length : sum(valid, (e) => e.sgpa * e.credits) / credits;
  return { cgpa, credits, count: valid.length, points: sum(valid, (e) => e.sgpa * e.credits) };
}

/**
 * CGPA from semester results, ordered by semester number/start date.
 * confirmed  → only semesters with confirmed/official SGPA
 * projected  → confirmed semesters + projected SGPA for in-progress semesters (estimate)
 */
export function evaluateCumulative(semesterResults, grading) {
  const method = grading.cgpaMethod || 'credit-weighted';
  const ordered = [...semesterResults].sort(compareSemesters);
  const confirmedEntries = [];
  const projectedEntries = [];
  const series = [];
  for (const r of ordered) {
    if (isNum(r.confirmedSgpa)) {
      confirmedEntries.push({ sgpa: r.confirmedSgpa, credits: r.totalCredits });
      projectedEntries.push({ sgpa: r.confirmedSgpa, credits: r.totalCredits });
    } else if (isNum(r.projectedSgpa)) {
      projectedEntries.push({ sgpa: r.projectedSgpa, credits: r.computedCredits || r.totalCredits });
    }
    const conf = combine(confirmedEntries, method);
    const proj = combine(projectedEntries, method);
    series.push({
      id: r.semester.id,
      name: r.semester.name,
      number: r.semester.number,
      sgpa: r.effectiveSgpa,
      sgpaStatus: r.status,
      cgpa: conf.cgpa,
      projectedCgpa: proj.cgpa,
      target: r.semester.targetSgpa ?? null,
      credits: r.totalCredits,
    });
  }
  return {
    method,
    confirmed: combine(confirmedEntries, method),
    projected: combine(projectedEntries, method),
    series,
  };
}

export function compareSemesters(a, b) {
  const sa = a.semester || a;
  const sb = b.semester || b;
  const na = isNum(sa.number) ? Number(sa.number) : 999;
  const nb = isNum(sb.number) ? Number(sb.number) : 999;
  if (na !== nb) return na - nb;
  return String(sa.startDate || '').localeCompare(String(sb.startDate || ''));
}

/* ------------------------------------------------------------------ */
/* Helpers for UI                                                      */
/* ------------------------------------------------------------------ */

export function fmtGradeSource(source) {
  return (
    {
      official: 'Official',
      confirmed: 'Confirmed',
      projected: 'Projected',
      simulated: 'Simulated',
      empty: 'No assessments',
    }[source] || source
  );
}

/** Total weight of a subject's components (warn when it isn't 100). */
export function weightTotals(subject) {
  const comps = subject.components || [];
  const theory = sum(comps.filter((c) => c.kind !== 'practical'), (c) => c.weight);
  const practical = sum(comps.filter((c) => c.kind === 'practical'), (c) => c.weight);
  return { theory: round(theory, 2), practical: round(practical, 2), total: round(theory + practical, 2) };
}

/** Theory vs practical and internal vs external percentages for one subject. */
export function subjectSplits(subject, { confirmedOnly = false } = {}) {
  const bucket = () => ({ w: 0, c: 0 });
  const acc = { theory: bucket(), practical: bucket(), internal: bucket(), external: bucket() };
  for (const c of subject.components || []) {
    if (confirmedOnly && c.status !== 'confirmed') continue;
    const p = componentPercent(c);
    if (p == null) continue;
    const w = Number(c.weight) || 0;
    const k = c.kind === 'practical' ? 'practical' : 'theory';
    const e = c.evaluation === 'external' ? 'external' : 'internal';
    acc[k].w += w;
    acc[k].c += (p * w) / 100;
    acc[e].w += w;
    acc[e].c += (p * w) / 100;
  }
  const pct = (b) => (b.w ? (b.c / b.w) * 100 : null);
  return { theory: pct(acc.theory), practical: pct(acc.practical), internal: pct(acc.internal), external: pct(acc.external) };
}
