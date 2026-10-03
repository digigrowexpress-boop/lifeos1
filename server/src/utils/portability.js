import mongoose from 'mongoose';
import { collections, collectionNames } from '../models/index.js';
import { sanitizePayload } from './http.js';

export const EXPORT_FORMAT = 'lifeos-export';
export const EXPORT_VERSION = 1;

export async function exportUserData(user) {
  const data = {};
  for (const name of collectionNames) {
    const docs = await collections[name].find({ userId: user._id }).sort({ createdAt: 1 });
    data[name] = docs.map((d) => d.toJSON());
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    account: { email: user.email },
    profile: user.profile || {},
    data,
  };
}

/**
 * Prepare an export file for insertion into (possibly) another account.
 * Every record gets a fresh id and all cross-references are rewritten, so an
 * export can be imported into any account without id collisions.
 */
export function remapImport(payload) {
  if (!payload || payload.format !== EXPORT_FORMAT || typeof payload.data !== 'object') {
    throw new Error('This file is not a LifeOS export.');
  }
  const idMap = new Map();
  const newId = (oldId) => {
    if (!oldId) return null;
    const key = String(oldId);
    if (!idMap.has(key)) idMap.set(key, new mongoose.Types.ObjectId());
    return idMap.get(key);
  };
  const mapRef = (oldId) => (oldId && idMap.has(String(oldId)) ? String(idMap.get(String(oldId))) : null);

  // First pass: allocate ids for every record.
  for (const name of collectionNames) {
    for (const doc of payload.data[name] || []) newId(doc.id);
  }

  const out = {};
  for (const name of collectionNames) {
    out[name] = (payload.data[name] || []).map((raw) => {
      const doc = sanitizePayload(raw);
      doc._id = idMap.get(String(raw.id)) || new mongoose.Types.ObjectId();
      if ('semesterId' in doc) doc.semesterId = mapRef(doc.semesterId);
      if ('subjectId' in doc) doc.subjectId = mapRef(doc.subjectId);
      if ('goalId' in doc) doc.goalId = mapRef(doc.goalId);
      if ('refId' in doc) doc.refId = mapRef(doc.refId);
      if (Array.isArray(doc.relatedSubjectIds)) doc.relatedSubjectIds = doc.relatedSubjectIds.map(mapRef).filter(Boolean);
      if (name === 'semesters' && doc.timetable && typeof doc.timetable === 'object') {
        for (const day of Object.keys(doc.timetable)) {
          const slots = Array.isArray(doc.timetable[day]) ? doc.timetable[day] : [];
          doc.timetable[day] = slots.map((s) => ({ ...s, subjectId: mapRef(s.subjectId) })).filter((s) => s.subjectId);
        }
      }
      return doc;
    });
  }

  const profile = sanitizePayload(payload.profile || {});
  if (profile.currentSemesterId) profile.currentSemesterId = mapRef(profile.currentSemesterId);
  return { profile, data: out };
}
