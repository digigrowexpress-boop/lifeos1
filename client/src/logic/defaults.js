import { uid } from '../lib/ids.js';

/* ------------------------------------------------------------------ */
/* Grading presets — starting points only; every value is editable.    */
/* ------------------------------------------------------------------ */

export const GRADING_PRESETS = {
  'ten-point': {
    label: '10-point (O / A+ / A …)',
    maxPoint: 10,
    passingPercent: 40,
    scale: [
      { grade: 'O', min: 90, points: 10 },
      { grade: 'A+', min: 80, points: 9 },
      { grade: 'A', min: 70, points: 8 },
      { grade: 'B+', min: 60, points: 7 },
      { grade: 'B', min: 50, points: 6 },
      { grade: 'C', min: 45, points: 5 },
      { grade: 'P', min: 40, points: 4 },
      { grade: 'F', min: 0, points: 0 },
    ],
  },
  'ten-point-letter-pairs': {
    label: '10-point (AA / AB / BB …)',
    maxPoint: 10,
    passingPercent: 35,
    scale: [
      { grade: 'AA', min: 85, points: 10 },
      { grade: 'AB', min: 75, points: 9 },
      { grade: 'BB', min: 65, points: 8 },
      { grade: 'BC', min: 55, points: 7 },
      { grade: 'CC', min: 45, points: 6 },
      { grade: 'CD', min: 40, points: 5 },
      { grade: 'DD', min: 35, points: 4 },
      { grade: 'FF', min: 0, points: 0 },
    ],
  },
  'four-point': {
    label: '4.0 scale (A / A- / B+ …)',
    maxPoint: 4,
    passingPercent: 60,
    scale: [
      { grade: 'A', min: 93, points: 4 },
      { grade: 'A-', min: 90, points: 3.7 },
      { grade: 'B+', min: 87, points: 3.3 },
      { grade: 'B', min: 83, points: 3 },
      { grade: 'B-', min: 80, points: 2.7 },
      { grade: 'C+', min: 77, points: 2.3 },
      { grade: 'C', min: 73, points: 2 },
      { grade: 'C-', min: 70, points: 1.7 },
      { grade: 'D', min: 60, points: 1 },
      { grade: 'F', min: 0, points: 0 },
    ],
  },
};

export const ASSESSMENT_TYPES = [
  { value: 'mid', label: 'Mid-semester exam' },
  { value: 'final', label: 'End-semester / university exam' },
  { value: 'internal', label: 'Internal exam' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'attendance', label: 'Attendance marks' },
  { value: 'practical', label: 'Practical exam' },
  { value: 'lab', label: 'Internal practical / lab work' },
  { value: 'viva', label: 'Viva' },
  { value: 'project', label: 'Project' },
  { value: 'mooc', label: 'NPTEL / MOOC' },
  { value: 'other', label: 'Other' },
];

const comp = (name, kind, assessmentType, evaluation, maxMarks, weight, extra = {}) => ({
  name,
  kind,
  assessmentType,
  evaluation,
  maxMarks,
  weight,
  minPassPercent: null,
  ...extra,
});

/** Assessment structures a subject can start from. Users can edit them in Settings. */
export const DEFAULT_TEMPLATES = [
  {
    id: 'theory',
    name: 'Theory subject',
    structure: 'theory',
    components: [
      comp('Mid-semester 1', 'theory', 'mid', 'internal', 20, 10),
      comp('Mid-semester 2', 'theory', 'mid', 'internal', 20, 10),
      comp('Assignments', 'theory', 'assignment', 'internal', 10, 5),
      comp('Attendance', 'theory', 'attendance', 'internal', 5, 5),
      comp('End-semester exam', 'theory', 'final', 'external', 70, 70, { minPassPercent: 35 }),
    ],
  },
  {
    id: 'practical',
    name: 'Practical / lab subject',
    structure: 'practical',
    components: [
      comp('Lab work & record', 'practical', 'lab', 'internal', 25, 25),
      comp('Practical exam', 'practical', 'practical', 'external', 50, 50),
      comp('Viva', 'practical', 'viva', 'external', 25, 25),
    ],
  },
  {
    id: 'integrated',
    name: 'Theory + practical (integrated)',
    structure: 'integrated',
    components: [
      comp('Mid-semester 1', 'theory', 'mid', 'internal', 20, 7.5),
      comp('Mid-semester 2', 'theory', 'mid', 'internal', 20, 7.5),
      comp('Quizzes', 'theory', 'quiz', 'internal', 10, 5),
      comp('End-semester exam', 'theory', 'final', 'external', 70, 50, { minPassPercent: 35 }),
      comp('Internal practical', 'practical', 'lab', 'internal', 20, 10),
      comp('Practical exam', 'practical', 'practical', 'external', 30, 15),
      comp('Viva', 'practical', 'viva', 'external', 10, 5),
    ],
  },
];

export function componentsFromTemplate(template) {
  return (template?.components || []).map((c) => ({
    id: uid('c_'),
    name: c.name,
    kind: c.kind || 'theory',
    assessmentType: c.assessmentType || 'other',
    evaluation: c.evaluation || 'internal',
    maxMarks: Number(c.maxMarks) || 0,
    weight: Number(c.weight) || 0,
    minPassPercent: c.minPassPercent ?? null,
    obtained: null,
    status: 'pending',
    date: null,
    notes: '',
  }));
}

/* ------------------------------------------------------------------ */
/* Option lists                                                        */
/* ------------------------------------------------------------------ */

export const DATA_STATES = {
  confirmed: { label: 'Confirmed', hint: 'Official / final marks' },
  expected: { label: 'Expected', hint: 'Exam done, awaiting result — your expectation' },
  estimated: { label: 'Estimated', hint: 'Your rough guess' },
  pending: { label: 'Pending', hint: 'Not assessed yet' },
  hypothetical: { label: 'Hypothetical', hint: 'What-if simulation only — never saved as marks' },
  projected: { label: 'Projected', hint: 'LifeOS estimate from your current performance' },
  official: { label: 'Official', hint: 'Declared by the university' },
};

export const STUDY_TYPES = [
  'Theory',
  'Revision',
  'Problem solving',
  'Coding',
  'DSA',
  'GATE',
  'Project',
  'Assignment',
  'Practical',
  'Reading',
  'Video lecture',
  'Mock test',
];

export const EXAM_TYPES = [
  { value: 'mid', label: 'Mid-semester' },
  { value: 'internal', label: 'Internal' },
  { value: 'practical', label: 'Practical' },
  { value: 'university', label: 'University / end-sem' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'viva', label: 'Viva' },
  { value: 'mock', label: 'Mock test' },
  { value: 'competitive', label: 'Competitive exam' },
  { value: 'other', label: 'Other' },
];

export const ASSIGNMENT_STATUSES = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'late', label: 'Late' },
  { value: 'missed', label: 'Missed' },
];

export const GOAL_CATEGORIES = [
  { value: 'academic', label: 'Academic' },
  { value: 'competitive', label: 'Competitive exam' },
  { value: 'skill', label: 'Skill' },
  { value: 'course', label: 'Course' },
  { value: 'project', label: 'Project' },
  { value: 'health', label: 'Health & lifestyle' },
  { value: 'career', label: 'Career' },
  { value: 'personal', label: 'Personal' },
];

export const GOAL_METRICS = [
  { value: 'manual', label: 'Manual value', hint: 'You update the current value yourself' },
  { value: 'milestones', label: 'Milestones completed' },
  { value: 'study-hours', label: 'Study hours logged', hint: 'Sessions linked to this goal' },
  { value: 'tasks', label: 'Linked tasks completed' },
  { value: 'cgpa', label: 'CGPA', hint: 'Uses your calculated CGPA' },
  { value: 'sgpa', label: 'Semester SGPA', hint: 'Uses a semester’s calculated SGPA' },
  { value: 'exam-prep', label: 'Exam syllabus progress', hint: 'For competitive exams like GATE' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const TOPIC_STATUSES = [
  { value: 'not-started', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'done', label: 'Completed' },
  { value: 'revised', label: 'Revised' },
];

/** GATE CSE subjects with approximate marks weightage — editable once added. */
export const GATE_CS_SUBJECTS = [
  { name: 'Engineering Mathematics', weight: 13 },
  { name: 'General Aptitude', weight: 15 },
  { name: 'Digital Logic', weight: 4 },
  { name: 'Computer Organization & Architecture', weight: 8 },
  { name: 'Programming & Data Structures', weight: 10 },
  { name: 'Algorithms', weight: 8 },
  { name: 'Theory of Computation', weight: 8 },
  { name: 'Compiler Design', weight: 4 },
  { name: 'Operating Systems', weight: 9 },
  { name: 'Databases (DBMS)', weight: 8 },
  { name: 'Computer Networks', weight: 9 },
];

export const SUBJECT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

export const DASHBOARD_WIDGETS = [
  { key: 'orbit', label: '3D Life Orbit' },
  { key: 'academics', label: 'Academic status' },
  { key: 'focus', label: 'Today’s focus' },
  { key: 'study', label: 'Study hours' },
  { key: 'goals', label: 'Goals' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'deadlines', label: 'Deadlines & exams' },
  { key: 'subjects', label: 'Strong & weak subjects' },
  { key: 'insights', label: 'Insights' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'activity', label: 'Recent activity' },
];

export const MODULES = [
  { key: 'attendance', label: 'Attendance & lectures' },
  { key: 'logbook', label: 'Daily logbook' },
  { key: 'lifestyle', label: 'Lifestyle tracking' },
  { key: 'assignments', label: 'Assignments & submissions' },
  { key: 'exams', label: 'Exams' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'competitive', label: 'Competitive exam (GATE etc.)' },
  { key: 'orbit', label: '3D Life Orbit' },
];

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export function defaultProfile() {
  const preset = GRADING_PRESETS['ten-point'];
  return {
    onboarded: false,
    name: '',
    tagline: '',
    university: {
      name: '',
      degree: 'B.Tech',
      program: '',
      durationYears: 4,
      semesterCount: 8,
    },
    currentSemesterId: null,
    targets: { cgpa: null, sgpa: null },
    grading: {
      preset: 'ten-point',
      maxPoint: preset.maxPoint,
      passingPercent: preset.passingPercent,
      scale: preset.scale.map((g) => ({ ...g })),
      cgpaMethod: 'credit-weighted',
      countFailedCredits: true,
      decimals: 2,
      attendanceThreshold: 75,
      pendingAssumption: 'performance',
      pendingFixedPercent: 65,
      notes: '',
    },
    templates: DEFAULT_TEMPLATES.map((t) => ({ ...t, components: t.components.map((c) => ({ ...c })) })),
    preferences: {
      theme: 'system',
      accent: 'blue',
      timeFormat: 'hm',
      reduceMotion: false,
      dailyStudyTargetHours: 4,
      weeklyStudyTargetHours: 25,
      sleepTargetHours: 7.5,
      screenLimitHours: 4,
      socialLimitHours: 1.5,
      exerciseTargetMin: 30,
      studyTypes: [...STUDY_TYPES],
      modules: Object.fromEntries(MODULES.map((m) => [m.key, true])),
      dashboardWidgets: Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.key, true])),
      customFields: [],
    },
    notifications: {
      enabled: true,
      browser: false,
      assignmentsDays: 3,
      examsDays: 7,
      tasks: true,
      goals: true,
      attendance: true,
      dailyLog: true,
      dailyLogHour: 20,
      studyGoal: true,
    },
    privacy: {
      useLifestyleInInsights: true,
      aiConsent: false,
      aiIncludeLifestyle: true,
    },
  };
}

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Deep-merge stored profile over defaults so new settings always have a value. */
export function mergeProfile(stored) {
  const merge = (base, over) => {
    if (!isPlainObject(over)) return over === undefined ? base : over;
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) {
      out[k] = isPlainObject(base?.[k]) && isPlainObject(v) ? merge(base[k], v) : v;
    }
    return out;
  };
  return merge(defaultProfile(), stored || {});
}
