import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { DateField, NumberField, SelectField, TextArea, TextField } from '../ui/Fields.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { ASSIGNMENT_STATUSES } from '../../logic/defaults.js';
import { subjectOptions } from './options.js';

const blank = (defaults = {}) => ({
  subjectId: null,
  title: '',
  description: '',
  dueDate: null,
  submittedDate: null,
  status: 'not-started',
  priority: 'medium',
  marks: null,
  maxMarks: null,
  reference: '',
  notes: '',
  ...defaults,
});

export function AssignmentForm({ open, onClose, assignment, defaults }) {
  const { data, analysis, today, create, update } = useData();
  const toast = useToast();
  const [v, set, setAll] = useFormState(blank());

  useEffect(() => {
    if (open) setAll(assignment ? { ...blank(), ...assignment } : blank(defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignment?.id]);

  const setStatus = (status) =>
    setAll((s) => ({
      ...s,
      status,
      submittedDate: (status === 'submitted' || status === 'late') && !s.submittedDate ? today : s.submittedDate,
    }));

  const submit = async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = v;
    if (assignment) await update('assignments', assignment.id, payload);
    else await create('assignments', payload);
    toast(assignment ? 'Submission updated' : 'Submission added');
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title={assignment ? 'Edit submission' : 'Add assignment / submission'} onSubmit={submit} size="wide">
      <div className="form-grid three">
        <TextField className="span-2" label="Title" value={v.title} onChange={set('title')} required placeholder="CN Assignment 3" />
        <SelectField label="Subject" value={v.subjectId} onChange={set('subjectId')} options={subjectOptions(data, analysis)} placeholder="None" />
        <DateField label="Due date" value={v.dueDate} onChange={set('dueDate')} />
        <SelectField label="Status" value={v.status} onChange={setStatus} options={ASSIGNMENT_STATUSES} />
        <SelectField
          label="Priority"
          value={v.priority}
          onChange={set('priority')}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
        <DateField label="Submission date" value={v.submittedDate} onChange={set('submittedDate')} />
        <NumberField label="Marks" value={v.marks} onChange={set('marks')} min={0} />
        <NumberField label="Maximum marks" value={v.maxMarks} onChange={set('maxMarks')} min={0} />
        <TextField className="full" label="File / reference link" value={v.reference} onChange={set('reference')} placeholder="Drive link, repo URL, file name…" />
        <TextArea className="full" label="Description" value={v.description} onChange={set('description')} rows={2} />
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
