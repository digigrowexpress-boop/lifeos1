import mongoose from 'mongoose';
import { ownedSchema, str, num, isoDate } from './base.js';

const goalSchema = ownedSchema({
  title: str({ required: true, maxlength: 200 }),
  description: str({ maxlength: 5000 }),
  category: str({ maxlength: 40, default: 'personal' }),
  startDate: isoDate(),
  targetDate: isoDate(),
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['active', 'paused', 'completed', 'archived'], default: 'active' },
  // How progress is measured: { type, target, current, unit, semesterId }
  metric: { type: mongoose.Schema.Types.Mixed, default: { type: 'manual', target: 100, current: 0, unit: '%' } },
  // [{ id, title, dueDate, done, doneAt }]
  milestones: { type: [mongoose.Schema.Types.Mixed], default: [] },
  relatedSubjectIds: { type: [String], default: [] },
  weeklyHoursTarget: num({ min: 0, max: 168 }),
  // Competitive exam tracker (GATE etc.): { name, date, subjects: [...], mocks: [...] }
  exam: { type: mongoose.Schema.Types.Mixed, default: null },
  notes: str({ maxlength: 10000 }),
  completedAt: { type: String, default: null },
});

export const Goal = mongoose.model('Goal', goalSchema);
