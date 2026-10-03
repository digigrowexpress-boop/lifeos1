import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { DateField, SelectField, TextArea, TextField } from '../ui/Fields.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { goalOptions, subjectOptions } from './options.js';

const blank = (today, defaults = {}) => ({ title: '', dueDate: today, priority: 'medium', status: 'todo', goalId: null, subjectId: null, notes: '', ...defaults });

export function TaskForm({ open, onClose, task, defaults }) {
  const { data, analysis, today, create, update } = useData();
  const toast = useToast();
  const [v, set, setAll] = useFormState(blank(today));

  useEffect(() => {
    if (open) setAll(task ? { ...blank(today), ...task } : blank(today, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const submit = async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = v;
    payload.completedAt = payload.status === 'done' ? payload.completedAt || today : null;
    if (task) await update('tasks', task.id, payload);
    else await create('tasks', payload);
    toast(task ? 'Task updated' : 'Task added');
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title={task ? 'Edit task' : 'Add task'} onSubmit={submit}>
      <div className="form-grid">
        <TextField className="full" label="Task" value={v.title} onChange={set('title')} required placeholder="Revise subnetting" />
        <DateField label="Due date" value={v.dueDate} onChange={set('dueDate')} />
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
        <SelectField
          label="Status"
          value={v.status}
          onChange={set('status')}
          options={[
            { value: 'todo', label: 'To do' },
            { value: 'in-progress', label: 'In progress' },
            { value: 'done', label: 'Done' },
            { value: 'skipped', label: 'Skipped' },
          ]}
        />
        <SelectField label="Goal" value={v.goalId} onChange={set('goalId')} options={goalOptions(data)} placeholder="None" />
        <SelectField className="full" label="Subject" value={v.subjectId} onChange={set('subjectId')} options={subjectOptions(data, analysis)} placeholder="None" />
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
