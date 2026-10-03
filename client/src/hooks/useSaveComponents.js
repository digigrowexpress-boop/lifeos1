import { useCallback } from 'react';
import { useData } from '../store/data.jsx';
import { evaluateSubject, componentHasValue } from '../logic/academics.js';

/**
 * Saves a subject's assessment components and records timeline events for
 * newly entered marks and for grade changes caused by them.
 */
export function useSaveComponents() {
  const { update, logEvent, profile, analysis } = useData();
  return useCallback(
    async (subject, components) => {
      const grading = profile.grading;
      const rates = analysis?.current?.rates;
      const before = evaluateSubject(subject, grading, { rate: rates?.overall });
      const saved = await update('subjects', subject.id, { components });
      const after = evaluateSubject({ ...subject, components }, grading, { rate: rates?.overall });
      const name = subject.code || subject.name;

      const prevById = Object.fromEntries((subject.components || []).map((c) => [c.id, c]));
      for (const c of components) {
        const p = prevById[c.id];
        const changed = !p || p.obtained !== c.obtained || p.status !== c.status;
        if (changed && componentHasValue(c)) {
          logEvent('marks', `Marks entered: ${name} ${c.name} — ${c.obtained}/${c.maxMarks}`, c.status === 'confirmed' ? 'Confirmed' : `${c.status[0].toUpperCase()}${c.status.slice(1)} (not official)`, 'subjects', subject.id);
        }
      }
      after.forEach((u, i) => {
        const b = before[i];
        if (b && u.grade?.grade && b.grade?.grade && u.grade.grade !== b.grade.grade) {
          const label = u.source === 'confirmed' ? 'confirmed' : 'projected';
          logEvent('grade', `${u.label}: ${label} grade ${b.grade.grade} → ${u.grade.grade}`, label === 'projected' ? 'Estimate based on current marks' : 'All components confirmed', 'subjects', subject.id);
        }
      });
      return saved;
    },
    [update, logEvent, profile.grading, analysis]
  );
}
