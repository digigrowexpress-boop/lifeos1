import { collections } from '../models/index.js';

/**
 * Deletes a record and everything that only makes sense together with it, so
 * removed data never keeps affecting calculations.
 *
 *  semester → its subjects (and everything that cascades from them)
 *  subject  → its attendance, assignments and exams; study sessions & tasks are
 *             kept (the time was really spent) but unlinked
 *  goal     → study sessions, tasks and exams are kept but unlinked
 *
 * Returns { removed: { collection: [ids] }, updated: { collection: [docs] } }.
 * The same rules are mirrored in client/src/lib/adapters/local.js.
 */
export async function cascadeDelete(userId, collection, id) {
  const removed = {};
  const updatedIds = {};
  const note = (bucket, col, ids) => {
    if (!ids.length) return;
    bucket[col] = [...new Set([...(bucket[col] || []), ...ids.map(String)])];
  };

  async function removeWhere(col, filter) {
    const Model = collections[col];
    const docs = await Model.find({ userId, ...filter }, { _id: 1 }).lean();
    if (!docs.length) return [];
    const ids = docs.map((d) => d._id);
    await Model.deleteMany({ userId, _id: { $in: ids } });
    note(removed, col, ids);
    return ids;
  }

  async function unlink(col, field, value, extraUnset = {}) {
    const Model = collections[col];
    const docs = await Model.find({ userId, [field]: value }, { _id: 1 }).lean();
    if (!docs.length) return;
    await Model.updateMany({ userId, [field]: value }, { $set: { [field]: null, ...extraUnset } });
    note(updatedIds, col, docs.map((d) => d._id));
  }

  async function deleteSubject(subjectId) {
    const subject = await collections.subjects.findOne({ userId, _id: subjectId });
    for (const col of ['attendance', 'assignments', 'exams']) {
      await removeWhere(col, { subjectId: String(subjectId) });
    }
    await unlink('studySessions', 'subjectId', String(subjectId));
    await unlink('tasks', 'subjectId', String(subjectId));

    const goals = await collections.goals.find({ userId, relatedSubjectIds: String(subjectId) }, { _id: 1 }).lean();
    if (goals.length) {
      await collections.goals.updateMany({ userId, relatedSubjectIds: String(subjectId) }, { $pull: { relatedSubjectIds: String(subjectId) } });
      note(updatedIds, 'goals', goals.map((g) => g._id));
    }

    if (subject?.semesterId) {
      const semester = await collections.semesters.findOne({ userId, _id: subject.semesterId });
      if (semester?.timetable && typeof semester.timetable === 'object') {
        let changed = false;
        const timetable = {};
        for (const [day, slots] of Object.entries(semester.timetable)) {
          const kept = Array.isArray(slots) ? slots.filter((s) => s?.subjectId !== String(subjectId)) : [];
          if (Array.isArray(slots) && kept.length !== slots.length) changed = true;
          timetable[day] = kept;
        }
        if (changed) {
          semester.timetable = timetable;
          semester.markModified('timetable');
          await semester.save();
          note(updatedIds, 'semesters', [semester._id]);
        }
      }
    }
    await removeWhere('subjects', { _id: subjectId });
  }

  async function deleteSemester(semesterId) {
    const subjects = await collections.subjects.find({ userId, semesterId: String(semesterId) }, { _id: 1 }).lean();
    for (const s of subjects) await deleteSubject(s._id);
    await removeWhere('semesters', { _id: semesterId });
  }

  async function deleteGoal(goalId) {
    await unlink('studySessions', 'goalId', String(goalId), { examSubjectId: null });
    await unlink('tasks', 'goalId', String(goalId));
    await unlink('exams', 'goalId', String(goalId));
    await removeWhere('goals', { _id: goalId });
  }

  if (collection === 'semesters') await deleteSemester(id);
  else if (collection === 'subjects') await deleteSubject(id);
  else if (collection === 'goals') await deleteGoal(id);
  else await removeWhere(collection, { _id: id });

  // Never report a record as both removed and updated.
  const updated = {};
  for (const [col, ids] of Object.entries(updatedIds)) {
    const live = ids.filter((x) => !(removed[col] || []).includes(x));
    if (!live.length) continue;
    const docs = await collections[col].find({ userId, _id: { $in: live } });
    updated[col] = docs.map((d) => d.toJSON());
  }
  return { removed, updated };
}
