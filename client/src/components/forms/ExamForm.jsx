import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { DateField, Field, NumberField, SelectField, TextArea, TextField } from '../ui/Fields.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { EXAM_TYPES } from '../../logic/defaults.js';
import { goalOptions, subjectOptions } from './options.js';

const blank = (defaults = {}) => ({
  subjectId: null,
  goalId: null,
  title: '',
  type: 'mid',
  date: null,
  time: '',
  venue: '',
  syllabus: '',
  status: 'upcoming',
  marks: null,
  maxMarks: null,
  marksStatus: 'confirmed',
  preparation: 0,
  notes: '',
  ...defaults,
});

export function ExamForm({ open, onClose, exam, defaults }) {
  const { data, analysis, create, update } = useData();
  const toast = useToast();
  const [v, set, setAll] = useFormState(blank());

  useEffect(() => {
    if (open) setAll(exam ? { ...blank(), ...exam } : blank(defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam?.id]);

  const submit = async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = v;
    if (exam) await update('exams', exam.id, payload);
    else await create('exams', payload);
    toast(exam ? 'Exam updated' : 'Exam added');
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title={exam ? 'Edit exam' : 'Add exam'} onSubmit={submit} size="wide">
      <div className="form-grid three">
        <TextField className="span-2" label="Title" value={v.title} onChange={set('title')} required placeholder="CN Mid-semester 2" />
        <SelectField label="Type" value={v.type} onChange={set('type')} options={EXAM_TYPES} />
        <SelectField label="Subject" value={v.subjectId} onChange={set('subjectId')} options={subjectOptions(data, analysis)} placeholder="None" />
        <SelectField label="Goal (mock / competitive)" value={v.goalId} onChange={set('goalId')} options={goalOptions(data)} placeholder="None" />
        <DateField label="Date" value={v.date} onChange={set('date')} />
        <TextField label="Time" type="time" value={v.time} onChange={set('time')} />
        <TextField label="Venue" value={v.venue} onChange={set('venue')} />
        <SelectField
          label="Status"
          value={v.status}
          onChange={set('status')}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'completed', label: 'Taken — awaiting result' },
            { value: 'result', label: 'Result available' },
          ]}
        />
        <Field label={`Preparation: ${v.preparation || 0}%`} className="full">
          <input className="range" type="range" min={0} max={100} step={5} value={v.preparation || 0} onChange={(e) => set('preparation')(Number(e.target.value))} />
        </Field>
        <NumberField label="Marks" value={v.marks} onChange={set('marks')} min={0} />
        <NumberField label="Maximum marks" value={v.maxMarks} onChange={set('maxMarks')} min={0} />
        <SelectField
          label="Marks are"
          value={v.marksStatus}
          onChange={set('marksStatus')}
          options={[
            { value: 'confirmed', label: 'Confirmed result' },
            { value: 'expected', label: 'Expected' },
            { value: 'estimated', label: 'Estimated' },
          ]}
        />
        <TextArea className="full" label="Syllabus" value={v.syllabus} onChange={set('syllabus')} rows={2} />
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
