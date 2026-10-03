import mongoose from 'mongoose';
import { ownedSchema, str, num, ref, isoDate } from './base.js';

const examSchema = ownedSchema({
  subjectId: ref(),
  goalId: ref(),
  title: str({ required: true, maxlength: 200 }),
  type: {
    type: String,
    enum: ['mid', 'practical', 'university', 'quiz', 'viva', 'internal', 'mock', 'competitive', 'other'],
    default: 'mid',
  },
  date: isoDate(),
  time: str({ maxlength: 20 }),
  venue: str({ maxlength: 200 }),
  syllabus: str({ maxlength: 5000 }),
  status: { type: String, enum: ['upcoming', 'completed', 'result'], default: 'upcoming' },
  marks: num({ min: 0 }),
  maxMarks: num({ min: 0 }),
  marksStatus: { type: String, enum: ['confirmed', 'expected', 'estimated'], default: 'confirmed' },
  preparation: { type: Number, min: 0, max: 100, default: 0 },
  notes: str({ maxlength: 5000 }),
});

export const Exam = mongoose.model('Exam', examSchema);
