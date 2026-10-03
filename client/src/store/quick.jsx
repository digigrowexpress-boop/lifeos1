import { useCallback, useContext, useMemo, useState } from 'react';
import { QuickContext } from './contexts.js';
import { StudySessionForm } from '../components/forms/StudySessionForm.jsx';
import { AssignmentForm } from '../components/forms/AssignmentForm.jsx';
import { ExamForm } from '../components/forms/ExamForm.jsx';
import { TaskForm } from '../components/forms/TaskForm.jsx';
import { GoalForm } from '../components/forms/GoalForm.jsx';
import { SemesterForm } from '../components/forms/SemesterForm.jsx';
import { SubjectForm } from '../components/forms/SubjectForm.jsx';
import { MarkEntryForm } from '../components/forms/MarkEntryForm.jsx';

const FORMS = {
  study: StudySessionForm,
  assignment: AssignmentForm,
  exam: ExamForm,
  task: TaskForm,
  goal: GoalForm,
  semester: SemesterForm,
  subject: SubjectForm,
  marks: MarkEntryForm,
};


/**
 * App-wide form launcher: openForm('study', { session }) from anywhere.
 * Keeps one modal mounted at a time.
 */
export function QuickFormsProvider({ children }) {
  const [state, setState] = useState({ kind: null, props: {} });
  const openForm = useCallback((kind, props = {}) => setState({ kind, props }), []);
  const close = useCallback(() => setState((s) => ({ ...s, kind: null })), []);
  const value = useMemo(() => ({ openForm }), [openForm]);

  return (
    <QuickContext.Provider value={value}>
      {children}
      {Object.entries(FORMS).map(([kind, Form]) => (
        <Form key={kind} open={state.kind === kind} onClose={close} {...(state.kind === kind ? state.props : {})} />
      ))}
    </QuickContext.Provider>
  );
}

export const useQuickForms = () => useContext(QuickContext).openForm;
