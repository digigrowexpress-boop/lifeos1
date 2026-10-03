import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { DateField, Field, NumberField, Rating, SelectField, TextArea, TextField } from '../ui/Fields.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { goalOptions, subjectOptions } from './options.js';

const blank = (today, defaults = {}) => ({
  date: today,
  hours: 1,
  minutes: 0,
  subjectId: null,
  goalId: null,
  examSubjectId: null,
  topic: '',
  type: 'Theory',
  productivity: null,
  questionsSolved: null,
  notes: '',
  ...defaults,
});

export function StudySessionForm({ open, onClose, session, defaults }) {
  const { data, analysis, profile, today, create, update } = useData();
  const toast = useToast();
  const [v, set, setAll] = useFormState(blank(today));

  useEffect(() => {
    if (!open) return;
    if (session) setAll({ ...blank(today), ...session, hours: Math.floor(session.durationMin / 60), minutes: session.durationMin % 60 });
    else setAll(blank(today, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  const goal = data.goals.find((g) => g.id === v.goalId);
  const examSubjects = goal?.exam?.subjects || [];
  const durationMin = (Number(v.hours) || 0) * 60 + (Number(v.minutes) || 0);

  const submit = async () => {
    if (durationMin < 1) {
      toast('Duration must be at least 1 minute', 'critical');
      return;
    }
    const payload = {
      date: v.date,
      durationMin,
      subjectId: v.subjectId || null,
      goalId: v.goalId || null,
      examSubjectId: v.goalId ? v.examSubjectId || null : null,
      topic: v.topic,
      type: v.type,
      productivity: v.productivity,
      questionsSolved: v.questionsSolved,
      notes: v.notes,
    };
    if (session) await update('studySessions', session.id, payload);
    else await create('studySessions', payload);
    toast(session ? 'Session updated' : 'Study session logged');
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title={session ? 'Edit study session' : 'Log study session'} onSubmit={submit} size="wide">
      <div className="form-grid three">
        <DateField label="Date" value={v.date} onChange={set('date')} required />
        <Field label="Duration">
          <div className="row-sm">
            <input className="input" type="number" min={0} max={23} aria-label="Hours" value={v.hours ?? ''} onChange={(e) => set('hours')(e.target.value === '' ? null : Number(e.target.value))} />
            <span className="muted small">h</span>
            <input className="input" type="number" min={0} max={59} step={5} aria-label="Minutes" value={v.minutes ?? ''} onChange={(e) => set('minutes')(e.target.value === '' ? null : Number(e.target.value))} />
            <span className="muted small">m</span>
          </div>
        </Field>
        <SelectField label="Study type" value={v.type} onChange={set('type')} options={profile.preferences.studyTypes.map((t) => ({ value: t, label: t }))} />
        <SelectField label="Academic subject" value={v.subjectId} onChange={set('subjectId')} options={subjectOptions(data, analysis)} placeholder="None" />
        <SelectField label="Goal" value={v.goalId} onChange={(x) => setAll((s) => ({ ...s, goalId: x, examSubjectId: null }))} options={goalOptions(data)} placeholder="None" />
        {examSubjects.length > 0 ? (
          <SelectField label={`${goal.title} subject`} value={v.examSubjectId} onChange={set('examSubjectId')} options={examSubjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="General" />
        ) : (
          <div className="hide-mobile" />
        )}
        <TextField className="span-2" label="Topic" value={v.topic} onChange={set('topic')} placeholder="e.g. Subnetting, Dijkstra, Normalisation" />
        <NumberField label="Questions solved" value={v.questionsSolved} onChange={set('questionsSolved')} min={0} step={1} />
        <Field label="Productivity" className="full">
          <Rating value={v.productivity} onChange={set('productivity')} max={5} label="Productivity rating" />
        </Field>
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
