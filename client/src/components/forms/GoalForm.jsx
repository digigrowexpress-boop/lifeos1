import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { Check, DateField, Field, NumberField, SelectField, TextArea, TextField } from '../ui/Fields.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { GATE_CS_SUBJECTS, GOAL_CATEGORIES, GOAL_METRICS, PRIORITIES } from '../../logic/defaults.js';
import { uid } from '../../lib/ids.js';
import { semesterOptions } from './options.js';

const blank = (today, defaults = {}) => ({
  title: '',
  description: '',
  category: 'personal',
  startDate: today,
  targetDate: null,
  priority: 'medium',
  status: 'active',
  metricType: 'manual',
  metricTarget: 100,
  metricCurrent: 0,
  metricStart: null,
  metricUnit: '%',
  metricSemesterId: null,
  weeklyHoursTarget: null,
  relatedSubjectIds: [],
  notes: '',
  milestonesText: '',
  examName: '',
  examDate: null,
  syllabusDeadline: null,
  prefillGate: true,
  ...defaults,
});

export function GoalForm({ open, onClose, goal, defaults, onSaved }) {
  const { data, analysis, profile, today, create, update } = useData();
  const toast = useToast();
  const [v, set, setAll] = useFormState(blank(today));

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setAll({
        ...blank(today),
        ...goal,
        metricType: goal.metric?.type || 'manual',
        metricTarget: goal.metric?.target ?? 100,
        metricCurrent: goal.metric?.current ?? 0,
        metricStart: goal.metric?.start ?? null,
        metricUnit: goal.metric?.unit || '',
        metricSemesterId: goal.metric?.semesterId || null,
        examName: goal.exam?.name || '',
        examDate: goal.exam?.date || null,
        syllabusDeadline: goal.exam?.syllabusDeadline || null,
      });
    } else setAll(blank(today, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);

  const setMetricType = (type) =>
    setAll((s) => {
      const next = { ...s, metricType: type };
      if (type === 'cgpa') {
        next.metricTarget = profile.targets?.cgpa ?? s.metricTarget;
        next.metricStart = analysis?.cumulative.confirmed.cgpa != null ? Number(analysis.cumulative.confirmed.cgpa.toFixed(2)) : null;
        next.metricUnit = 'CGPA';
      } else if (type === 'sgpa') {
        next.metricTarget = profile.targets?.sgpa ?? s.metricTarget;
        next.metricSemesterId = analysis?.currentSemester?.id || null;
        next.metricStart = null;
        next.metricUnit = 'SGPA';
      } else if (type === 'study-hours') {
        next.metricUnit = 'h';
        next.metricStart = null;
      } else if (type === 'exam-prep') {
        next.category = 'competitive';
        next.metricStart = null;
      } else if (type === 'manual') {
        next.metricStart = null;
      }
      return next;
    });

  const isExam = v.metricType === 'exam-prep' || v.category === 'competitive';
  const currentSubjects = data.subjects.filter((s) => s.semesterId === analysis?.currentSemester?.id);

  const submit = async () => {
    const metric = {
      type: v.metricType,
      target: v.metricTarget,
      current: v.metricCurrent,
      start: v.metricStart,
      unit: v.metricUnit,
      semesterId: v.metricType === 'sgpa' ? v.metricSemesterId : null,
    };
    const payload = {
      title: v.title.trim(),
      description: v.description,
      category: v.category,
      startDate: v.startDate,
      targetDate: v.targetDate,
      priority: v.priority,
      status: v.status,
      metric,
      weeklyHoursTarget: v.weeklyHoursTarget,
      relatedSubjectIds: v.relatedSubjectIds,
      notes: v.notes,
    };
    if (isExam) {
      payload.exam = {
        ...(goal?.exam || { subjects: [], mocks: [] }),
        name: v.examName || v.title,
        date: v.examDate || v.targetDate,
        syllabusDeadline: v.syllabusDeadline,
      };
      if (!goal && v.prefillGate && /gate/i.test(`${v.title} ${v.examName}`)) {
        payload.exam.subjects = GATE_CS_SUBJECTS.map((s) => ({ id: uid('es_'), name: s.name, weight: s.weight, topics: [], lecturesTotal: null, lecturesDone: 0, questionsSolved: 0, revisions: 0, weeklyHoursTarget: null, notes: '' }));
      }
    }
    let saved;
    if (goal) {
      saved = await update('goals', goal.id, payload);
    } else {
      const milestones = v.milestonesText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((title) => ({ id: uid('m_'), title, dueDate: null, done: false, doneAt: null }));
      saved = await create('goals', { ...payload, milestones, completedAt: null, exam: payload.exam || null });
    }
    toast(goal ? 'Goal updated' : 'Goal created');
    onSaved?.(saved);
    onClose();
  };

  const metricHint = GOAL_METRICS.find((m) => m.value === v.metricType)?.hint;

  return (
    <FormModal open={open} onClose={onClose} title={goal ? 'Edit goal' : 'New goal'} onSubmit={submit} size="wide">
      <div className="form-grid three">
        <TextField className="span-2" label="Goal" value={v.title} onChange={set('title')} required placeholder="GATE 2027, CGPA 8.5, Learn Data Science…" />
        <SelectField label="Category" value={v.category} onChange={set('category')} options={GOAL_CATEGORIES} />
        <TextArea className="full" label="Description" value={v.description} onChange={set('description')} rows={2} />
        <DateField label="Start date" value={v.startDate} onChange={set('startDate')} />
        <DateField label="Target date" value={v.targetDate} onChange={set('targetDate')} />
        <SelectField label="Priority" value={v.priority} onChange={set('priority')} options={PRIORITIES} />

        <SelectField label="Measure progress by" value={v.metricType} onChange={setMetricType} options={GOAL_METRICS} hint={metricHint} />
        {['manual', 'study-hours', 'cgpa', 'sgpa'].includes(v.metricType) && (
          <NumberField label={v.metricType === 'study-hours' ? 'Target hours' : 'Target value'} value={v.metricTarget} onChange={set('metricTarget')} step="any" />
        )}
        {v.metricType === 'manual' && <NumberField label="Current value" value={v.metricCurrent} onChange={set('metricCurrent')} step="any" />}
        {v.metricType === 'manual' && <TextField label="Unit" value={v.metricUnit} onChange={set('metricUnit')} placeholder="%, questions, chapters…" />}
        {v.metricType === 'cgpa' && <NumberField label="Starting CGPA" value={v.metricStart} onChange={set('metricStart')} step={0.01} hint="Progress is measured from here" />}
        {v.metricType === 'sgpa' && <SelectField label="Semester" value={v.metricSemesterId} onChange={set('metricSemesterId')} options={semesterOptions(data)} placeholder="Select…" />}
        <NumberField label="Weekly hours target" value={v.weeklyHoursTarget} onChange={set('weeklyHoursTarget')} min={0} max={168} step={0.5} hint="Optional — compared with linked study sessions" />
        {goal && (
          <SelectField
            label="Status"
            value={v.status}
            onChange={set('status')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        )}

        {isExam && (
          <>
            <TextField label="Exam name" value={v.examName} onChange={set('examName')} placeholder="GATE CSE" />
            <DateField label="Exam date" value={v.examDate} onChange={set('examDate')} />
            <DateField label="Finish syllabus by" value={v.syllabusDeadline} onChange={set('syllabusDeadline')} />
            {!goal && (
              <div className="full">
                <Check checked={v.prefillGate} onChange={set('prefillGate')} label="If this is GATE, pre-fill GATE CSE subjects with marks weightage (editable)" />
              </div>
            )}
          </>
        )}

        {currentSubjects.length > 0 && (
          <Field label="Related subjects" className="full">
            <div className="chips">
              {currentSubjects.map((s) => {
                const on = v.relatedSubjectIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => set('relatedSubjectIds')(on ? v.relatedSubjectIds.filter((x) => x !== s.id) : [...v.relatedSubjectIds, s.id])}
                  >
                    {s.code || s.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        {!goal && <TextArea className="full" label="Milestones (one per line, optional)" value={v.milestonesText} onChange={set('milestonesText')} rows={3} placeholder={'Finish first pass of syllabus\nFirst full-length mock\nRevision round 1'} />}
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
