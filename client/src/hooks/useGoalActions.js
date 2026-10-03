import { useMemo } from 'react';
import { useData } from '../store/data.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { nowISO } from '../lib/dates.js';

/** Status changes and deletion for goals, shared by the list and detail pages. */
export function useGoalActions() {
  const { update, remove } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  return useMemo(
    () => ({
      complete: (g) => update('goals', g.id, { status: 'completed', completedAt: nowISO() }).then(() => toast(`“${g.title}” completed`)),
      reopen: (g) => update('goals', g.id, { status: 'active', completedAt: null }),
      pause: (g) => update('goals', g.id, { status: 'paused' }),
      resume: (g) => update('goals', g.id, { status: 'active' }),
      archive: (g) => update('goals', g.id, { status: 'archived' }),
      async del(g) {
        const ok = await confirm({
          title: `Delete “${g.title}”?`,
          message: 'Milestones and the exam tracker are deleted. Linked study sessions, tasks and exams are kept but unlinked.',
          confirmLabel: 'Delete goal',
          danger: true,
        });
        if (!ok) return false;
        await remove('goals', g.id);
        toast('Goal deleted');
        return true;
      },
    }),
    [update, remove, confirm, toast]
  );
}
