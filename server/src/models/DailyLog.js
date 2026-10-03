import mongoose from 'mongoose';
import { ownedSchema, str, num, isoDate } from './base.js';

const minutes = () => num({ min: 0, max: 1440 });

const dailyLogSchema = ownedSchema({
  date: { ...isoDate(), required: true },
  collegeAttended: { type: Boolean, default: null },
  // Lifestyle
  sleepHours: num({ min: 0, max: 24 }),
  bedTime: str({ maxlength: 5 }),
  wakeTime: str({ maxlength: 5 }),
  screenTimeMin: minutes(),
  socialMediaMin: minutes(),
  exerciseMin: minutes(),
  entertainmentMin: minutes(),
  breaksMin: minutes(),
  personalMin: minutes(),
  // Academic activity minutes not captured as study sessions
  activities: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Productivity
  tasksPlanned: num({ min: 0 }),
  tasksCompleted: num({ min: 0 }),
  tasksSkipped: num({ min: 0 }),
  plannedWork: str({ maxlength: 5000 }),
  completedWork: str({ maxlength: 5000 }),
  productivity: num({ min: 1, max: 10 }),
  mood: num({ min: 1, max: 5 }),
  notes: str({ maxlength: 10000 }),
  // Values for user-defined fields/metrics: { [fieldKey]: value }
  custom: { type: mongoose.Schema.Types.Mixed, default: {} },
});

dailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyLog = mongoose.model('DailyLog', dailyLogSchema);
