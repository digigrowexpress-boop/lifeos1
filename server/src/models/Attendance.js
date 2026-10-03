import mongoose from 'mongoose';
import { ownedSchema, str, ref, isoDate } from './base.js';

const attendanceSchema = ownedSchema({
  date: { ...isoDate(), required: true, index: true },
  subjectId: { ...ref(), required: true },
  slotType: { type: String, enum: ['lecture', 'lab', 'tutorial'], default: 'lecture' },
  status: { type: String, enum: ['present', 'absent', 'cancelled'], default: 'present' },
  // Number of periods this entry represents (e.g. a 2-hour lab = 2)
  count: { type: Number, min: 1, max: 8, default: 1 },
  time: str({ maxlength: 20 }),
  topic: str({ maxlength: 200 }),
  faculty: str({ maxlength: 160 }),
  reason: str({ maxlength: 500 }),
});

export const Attendance = mongoose.model('Attendance', attendanceSchema);
