import mongoose from 'mongoose';
import { ownedSchema, str, num, ref, isoDate } from './base.js';

const DATA_STATES = ['confirmed', 'expected', 'estimated', 'pending'];

/** One assessment component (Mid-sem 1, Practical exam, Viva, ...) with its marks. */
const componentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: str({ required: true, maxlength: 120 }),
    kind: { type: String, enum: ['theory', 'practical'], default: 'theory' },
    assessmentType: str({ maxlength: 40 }),
    evaluation: { type: String, enum: ['internal', 'external'], default: 'internal' },
    maxMarks: { type: Number, min: 0, required: true },
    weight: { type: Number, min: 0, required: true },
    obtained: num({ min: 0 }),
    status: { type: String, enum: DATA_STATES, default: 'pending' },
    minPassPercent: num({ min: 0, max: 100 }),
    date: isoDate(),
    notes: str({ maxlength: 2000 }),
  },
  { _id: false }
);

const subjectSchema = ownedSchema({
  semesterId: { ...ref(), required: true },
  name: str({ required: true, maxlength: 160 }),
  code: str({ maxlength: 40 }),
  credits: { type: Number, min: 0, max: 60, default: 3 },
  structure: { type: String, enum: ['theory', 'practical', 'integrated'], default: 'theory' },
  // combined: one grade for the whole subject. split: separate theory & practical grades.
  gradingMode: { type: String, enum: ['combined', 'split'], default: 'combined' },
  theoryCredits: num({ min: 0, max: 60 }),
  practicalCredits: num({ min: 0, max: 60 }),
  faculty: str({ maxlength: 160 }),
  category: str({ maxlength: 80 }),
  difficulty: num({ min: 1, max: 5 }),
  strength: num({ min: 1, max: 5 }),
  targetGrade: str({ maxlength: 10 }),
  officialGrade: str({ maxlength: 10 }),
  officialGradeTheory: str({ maxlength: 10 }),
  officialGradePractical: str({ maxlength: 10 }),
  components: { type: [componentSchema], default: [] },
  color: str({ maxlength: 20 }),
  notes: str({ maxlength: 10000 }),
  archived: { type: Boolean, default: false },
});

export const Subject = mongoose.model('Subject', subjectSchema);
