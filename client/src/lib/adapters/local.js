/**
 * Device adapter: keeps everything in this browser's localStorage.
 * Useful for trying LifeOS without an account or for fully offline use.
 * Mirrors the server's cascade rules (server/src/utils/cascade.js).
 */
import { COLLECTIONS, EXPORT_FORMAT, emptyData } from '../collections.js';
import { newRecordId } from '../ids.js';

const STORE_KEY = 'lifeos.device.v1';

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { profile: parsed.profile || {}, data: { ...emptyData(), ...(parsed.data || {}) }, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function write(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    throw new Error('This device is out of storage space for LifeOS. Export your data or switch to a cloud account.', { cause: e });
  }
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const stamp = () => new Date().toISOString();

export function createLocalAdapter() {
  let state = read();

  const persist = () => write(state);
  const ensure = () => {
    if (!state) throw new Error('No device workspace. Start one from the sign-in screen.');
    return state;
  };

  function cascade(collection, id) {
    const s = ensure();
    const removed = {};
    const updatedIds = {};
    const mark = (bucket, col, ids) => {
      if (!ids.length) return;
      bucket[col] = [...new Set([...(bucket[col] || []), ...ids])];
    };
    const removeWhere = (col, pred) => {
      const gone = s.data[col].filter(pred).map((d) => d.id);
      s.data[col] = s.data[col].filter((d) => !pred(d));
      mark(removed, col, gone);
    };
    const patchWhere = (col, pred, patch) => {
      const ids = [];
      s.data[col] = s.data[col].map((d) => {
        if (!pred(d)) return d;
        ids.push(d.id);
        return { ...d, ...patch(d), updatedAt: stamp() };
      });
      mark(updatedIds, col, ids);
    };

    const deleteSubject = (subjectId) => {
      const subject = s.data.subjects.find((x) => x.id === subjectId);
      for (const col of ['attendance', 'assignments', 'exams']) removeWhere(col, (d) => d.subjectId === subjectId);
      patchWhere('studySessions', (d) => d.subjectId === subjectId, () => ({ subjectId: null }));
      patchWhere('tasks', (d) => d.subjectId === subjectId, () => ({ subjectId: null }));
      patchWhere(
        'goals',
        (g) => (g.relatedSubjectIds || []).includes(subjectId),
        (g) => ({ relatedSubjectIds: g.relatedSubjectIds.filter((x) => x !== subjectId) })
      );
      if (subject) {
        patchWhere(
          'semesters',
          (sem) =>
            sem.id === subject.semesterId &&
            Object.values(sem.timetable || {}).some((slots) => (slots || []).some((sl) => sl.subjectId === subjectId)),
          (sem) => ({
            timetable: Object.fromEntries(
              Object.entries(sem.timetable || {}).map(([day, slots]) => [day, (slots || []).filter((sl) => sl.subjectId !== subjectId)])
            ),
          })
        );
      }
      removeWhere('subjects', (d) => d.id === subjectId);
    };

    if (collection === 'semesters') {
      s.data.subjects.filter((x) => x.semesterId === id).forEach((x) => deleteSubject(x.id));
      removeWhere('semesters', (d) => d.id === id);
    } else if (collection === 'subjects') {
      deleteSubject(id);
    } else if (collection === 'goals') {
      patchWhere('studySessions', (d) => d.goalId === id, () => ({ goalId: null, examSubjectId: null }));
      patchWhere('tasks', (d) => d.goalId === id, () => ({ goalId: null }));
      patchWhere('exams', (d) => d.goalId === id, () => ({ goalId: null }));
      removeWhere('goals', (d) => d.id === id);
    } else {
      removeWhere(collection, (d) => d.id === id);
    }

    const updated = {};
    for (const [col, ids] of Object.entries(updatedIds)) {
      const live = s.data[col].filter((d) => ids.includes(d.id));
      if (live.length) updated[col] = clone(live);
    }
    return { removed, updated };
  }

  return {
    mode: 'device',
    hasSession: () => Boolean(state),

    async restore() {
      state = read();
      return state ? { id: 'device', email: null, profile: state.profile } : null;
    },
    async start({ name } = {}) {
      state = read() || { profile: name ? { name } : {}, data: emptyData(), createdAt: stamp() };
      persist();
      return { id: 'device', email: null, profile: state.profile };
    },
    async logout() {
      /* Device data stays on the device until explicitly deleted. */
    },

    async loadAll() {
      return clone(ensure().data);
    },
    async saveProfile(profile) {
      ensure().profile = clone(profile);
      persist();
      return clone(profile);
    },

    async create(collection, doc) {
      const s = ensure();
      if (!COLLECTIONS.includes(collection)) throw new Error(`Unknown collection ${collection}`);
      if (collection === 'dailyLogs' && s.data.dailyLogs.some((l) => l.date === doc.date)) {
        throw new Error('A log for this date already exists.');
      }
      const now = stamp();
      const record = { ...clone(doc), id: newRecordId(), createdAt: now, updatedAt: now };
      s.data[collection].push(record);
      persist();
      return clone(record);
    },
    async bulkCreate(collection, items) {
      const out = [];
      for (const it of items) out.push(await this.create(collection, it));
      return out;
    },
    async update(collection, id, patch) {
      const s = ensure();
      const idx = s.data[collection].findIndex((d) => d.id === id);
      if (idx < 0) throw new Error('Record not found');
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = clone(patch);
      s.data[collection][idx] = { ...s.data[collection][idx], ...rest, updatedAt: stamp() };
      persist();
      return clone(s.data[collection][idx]);
    },
    async remove(collection, id) {
      const result = cascade(collection, id);
      persist();
      return result;
    },

    async exportAll() {
      const s = ensure();
      return { format: EXPORT_FORMAT, version: 1, exportedAt: stamp(), account: { email: null, mode: 'device' }, profile: clone(s.profile), data: clone(s.data) };
    },
    async importAll(payload, mode = 'replace') {
      if (!payload || payload.format !== EXPORT_FORMAT || typeof payload.data !== 'object') {
        throw new Error('This file is not a LifeOS export.');
      }
      const s = ensure();
      const incoming = { ...emptyData(), ...payload.data };
      if (mode === 'replace') {
        s.data = clone(incoming);
        s.profile = clone(payload.profile || {});
      } else {
        for (const col of COLLECTIONS) {
          const existing = new Set(s.data[col].map((d) => d.id));
          s.data[col].push(...clone(incoming[col] || []).filter((d) => !existing.has(d.id)));
        }
      }
      persist();
      return { ok: true };
    },
    // The AI coach runs on the LifeOS server, which device mode doesn't use.
    async aiStatus() {
      return { enabled: false, reason: 'device' };
    },
    async aiChat() {
      throw new Error('The AI coach needs a LifeOS account (cloud mode).');
    },
    async wipeData() {
      ensure().data = emptyData();
      persist();
    },
    async deleteAccount() {
      state = null;
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
