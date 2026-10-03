import mongoose from 'mongoose';
import { ownedSchema, str, ref, isoDate } from './base.js';

const taskSchema = ownedSchema({
  title: str({ required: true, maxlength: 300 }),
  dueDate: isoDate(),
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['todo', 'in-progress', 'done', 'skipped'], default: 'todo' },
  goalId: ref(),
  subjectId: ref(),
  notes: str({ maxlength: 5000 }),
  completedAt: isoDate(),
});

export const Task = mongoose.model('Task', taskSchema);
