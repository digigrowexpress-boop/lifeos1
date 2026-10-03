import { Semester } from './Semester.js';
import { Subject } from './Subject.js';
import { StudySession } from './StudySession.js';
import { DailyLog } from './DailyLog.js';
import { Attendance } from './Attendance.js';
import { Assignment } from './Assignment.js';
import { Exam } from './Exam.js';
import { Goal } from './Goal.js';
import { Task } from './Task.js';
import { Event } from './Event.js';

export { User, ROLES, STATUSES } from './User.js';
export { Session } from './Session.js';

/** Collection name (as used by the client & API) → Mongoose model. */
export const collections = {
  semesters: Semester,
  subjects: Subject,
  studySessions: StudySession,
  dailyLogs: DailyLog,
  attendance: Attendance,
  assignments: Assignment,
  exams: Exam,
  goals: Goal,
  tasks: Task,
  events: Event,
};

export const collectionNames = Object.keys(collections);
