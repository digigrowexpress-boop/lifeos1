import mongoose from 'mongoose';
import { ownedSchema, str, num, ref, isoDate } from './base.js';

const studySessionSchema = ownedSchema({
  date: { ...isoDate(), required: true, index: true },
  durationMin: { type: Number, min: 1, max: 1440, required: true },
  subjectId: ref(),
  goalId: ref(),
  // Subject inside a competitive-exam goal (e.g. GATE → Computer Networks)
  examSubjectId: { type: String, default: null },
  topic: str({ maxlength: 200 }),
  type: str({ maxlength: 40, default: 'Theory' }),
  productivity: num({ min: 1, max: 5 }),
  questionsSolved: num({ min: 0 }),
  notes: str({ maxlength: 5000 }),
});

export const StudySession = mongoose.model('StudySession', studySessionSchema);
