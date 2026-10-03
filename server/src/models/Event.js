import mongoose from 'mongoose';
import { ownedSchema, str } from './base.js';

/** Timeline entries: marks entered, grade changes, goals created/completed, ... */
const eventSchema = ownedSchema({
  at: { type: String, required: true, index: true }, // ISO timestamp
  type: str({ required: true, maxlength: 40 }),
  title: str({ required: true, maxlength: 300 }),
  detail: str({ maxlength: 1000 }),
  refCollection: str({ maxlength: 40 }),
  refId: { type: String, default: null },
});

export const Event = mongoose.model('Event', eventSchema);
