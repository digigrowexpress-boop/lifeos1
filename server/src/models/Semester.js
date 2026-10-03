import mongoose from 'mongoose';
import { ownedSchema, str, num, isoDate } from './base.js';

const semesterSchema = ownedSchema({
  number: num({ min: 0, max: 40 }),
  name: str({ required: true, maxlength: 120 }),
  academicYear: str({ maxlength: 40 }),
  startDate: isoDate(),
  endDate: isoDate(),
  status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'ongoing' },
  targetSgpa: num({ min: 0, max: 100 }),
  // Officially declared result. When present it is treated as confirmed and
  // overrides values computed from subject marks.
  officialSgpa: num({ min: 0, max: 100 }),
  officialCredits: num({ min: 0, max: 400 }),
  // Weekly lecture timetable: { mon: [{ id, subjectId, slotType, time }], ... }
  timetable: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes: str({ maxlength: 5000 }),
  archived: { type: Boolean, default: false },
});

export const Semester = mongoose.model('Semester', semesterSchema);
