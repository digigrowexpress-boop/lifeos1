import { compareSemesters } from '../../logic/academics.js';

/** Subjects grouped by semester for <SelectField>. Current semester first. */
export function subjectOptions(data, analysis, { currentOnly = false } = {}) {
  const currentId = analysis?.currentSemester?.id;
  const sems = [...data.semesters].sort(compareSemesters).reverse();
  const ordered = currentId ? [...sems.filter((s) => s.id === currentId), ...sems.filter((s) => s.id !== currentId)] : sems;
  const groups = ordered
    .filter((sem) => !currentOnly || sem.id === currentId)
    .map((sem) => ({
      group: sem.name + (sem.id === currentId ? ' (current)' : ''),
      options: data.subjects
        .filter((s) => s.semesterId === sem.id && !s.archived)
        .map((s) => ({ value: s.id, label: s.code ? `${s.code} — ${s.name}` : s.name })),
    }))
    .filter((g) => g.options.length);
  return groups;
}

export function goalOptions(data, { activeOnly = true } = {}) {
  return data.goals.filter((g) => !activeOnly || g.status === 'active' || g.status === 'paused').map((g) => ({ value: g.id, label: g.title }));
}

export function semesterOptions(data) {
  return [...data.semesters].sort(compareSemesters).map((s) => ({ value: s.id, label: s.name }));
}
