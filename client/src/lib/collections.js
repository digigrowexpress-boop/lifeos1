/** Every record collection LifeOS stores. Kept in sync with server/src/models/index.js. */
export const COLLECTIONS = [
  'semesters',
  'subjects',
  'studySessions',
  'dailyLogs',
  'attendance',
  'assignments',
  'exams',
  'goals',
  'tasks',
  'events',
];

export const COLLECTION_LABELS = {
  semesters: 'Semesters',
  subjects: 'Subjects',
  studySessions: 'Study sessions',
  dailyLogs: 'Daily logs',
  attendance: 'Attendance records',
  assignments: 'Assignments & submissions',
  exams: 'Exams',
  goals: 'Goals',
  tasks: 'Tasks',
  events: 'Timeline events',
};

export const emptyData = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

export const EXPORT_FORMAT = 'lifeos-export';
