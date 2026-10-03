import mongoose from 'mongoose';
import { collections } from '../models/index.js';
import { badRequest } from './http.js';

/** Fields that point at another record, and the collection they point into. */
const REF_FIELDS = { semesterId: 'semesters', subjectId: 'subjects', goalId: 'goals' };

/**
 * Ensures every record a payload references belongs to the same user, so a
 * hand-crafted request can never attach to (or reveal) someone else's records.
 * A per-request cache keeps bulk inserts fast.
 */
export function createOwnershipChecker(userId) {
  const cache = new Map();

  async function owned(collection, id) {
    if (id === null || id === undefined || id === '') return true;
    if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) return false;
    const key = `${collection}:${id}`;
    if (!cache.has(key)) cache.set(key, Boolean(await collections[collection].exists({ _id: id, userId })));
    return cache.get(key);
  }

  return async function assertOwnedRefs(collection, payload) {
    for (const [field, target] of Object.entries(REF_FIELDS)) {
      if (field in payload && !(await owned(target, payload[field]))) throw badRequest(`Unknown ${field}`);
    }
    if (Array.isArray(payload.relatedSubjectIds)) {
      for (const id of payload.relatedSubjectIds) if (!(await owned('subjects', id))) throw badRequest('Unknown subject in relatedSubjectIds');
    }
    if (collection === 'semesters' && payload.timetable && typeof payload.timetable === 'object') {
      for (const slots of Object.values(payload.timetable)) {
        for (const slot of Array.isArray(slots) ? slots : []) {
          if (!(await owned('subjects', slot?.subjectId))) throw badRequest('Unknown subject in timetable');
        }
      }
    }
    if (collection === 'events' && payload.refId) {
      const target = collections[payload.refCollection] ? payload.refCollection : null;
      if (!target || !(await owned(target, payload.refId))) payload.refId = null;
    }
    return payload;
  };
}
