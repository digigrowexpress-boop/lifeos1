import mongoose from 'mongoose';
import { ownedSchema, str, num, ref, isoDate } from './base.js';

const assignmentSchema = ownedSchema({
  subjectId: ref(),
  title: str({ required: true, maxlength: 200 }),
  description: str({ maxlength: 5000 }),
  dueDate: isoDate(),
  submittedDate: isoDate(),
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'submitted', 'late', 'missed'],
    default: 'not-started',
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  marks: num({ min: 0 }),
  maxMarks: num({ min: 0 }),
  reference: str({ maxlength: 1000 }),
  notes: str({ maxlength: 5000 }),
  archived: { type: Boolean, default: false },
});

export const Assignment = mongoose.model('Assignment', assignmentSchema);
