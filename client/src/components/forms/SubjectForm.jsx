import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { NumberField, SelectField, TextArea, TextField } from '../ui/Fields.jsx';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { componentsFromTemplate, SUBJECT_COLORS } from '../../logic/defaults.js';
import { semesterOptions } from './options.js';

const blank = (semesterId, templateId) => ({
  semesterId,
  name: '',
  code: '',
  credits: 3,
  structure: 'theory',
  gradingMode: 'combined',
  theoryCredits: null,
  practicalCredits: null,
  faculty: '',
  category: 'Core',
  difficulty: 3,
  strength: 3,
  targetGrade: '',
  officialGrade: '',
  officialGradeTheory: '',
  officialGradePractical: '',
  notes: '',
  templateId,
});

export function SubjectForm({ open, onClose, subject, semesterId, onSaved }) {
  const { data, analysis, profile, create, update, logEvent } = useData();
  const toast = useToast();
  const defaultSem = semesterId || analysis?.currentSemester?.id || data.semesters[0]?.id || '';
  const [v, set, setAll] = useFormState(subject || blank(defaultSem, profile.templates[0]?.id));

  useEffect(() => {
    if (open) setAll(subject ? { ...blank(), ...subject } : blank(defaultSem, profile.templates[0]?.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject?.id]);

  const grades = profile.grading.scale.map((g) => ({ value: g.grade, label: `${g.grade} (${g.points})` }));
  const split = v.gradingMode === 'split';

  const submit = async () => {
    const payload = {
      semesterId: v.semesterId,
      name: v.name.trim(),
      code: v.code?.trim(),
      credits: split ? (Number(v.theoryCredits) || 0) + (Number(v.practicalCredits) || 0) : Number(v.credits) || 0,
      structure: v.structure,
      gradingMode: v.gradingMode,
      theoryCredits: split ? v.theoryCredits : null,
      practicalCredits: split ? v.practicalCredits : null,
      faculty: v.faculty,
      category: v.category,
      difficulty: v.difficulty,
      strength: v.strength,
      targetGrade: v.targetGrade || '',
      officialGrade: v.officialGrade || '',
      officialGradeTheory: v.officialGradeTheory || '',
      officialGradePractical: v.officialGradePractical || '',
      notes: v.notes,
    };
    if (!payload.semesterId) {
      toast('Create a semester first', 'critical');
      return;
    }
    let saved;
    if (subject) {
      saved = await update('subjects', subject.id, payload);
      if ((subject.officialGrade || '') !== payload.officialGrade && payload.officialGrade) {
        logEvent('grade', `Official grade: ${payload.code || payload.name} — ${payload.officialGrade}`, 'Confirmed result', 'subjects', subject.id);
      }
    } else {
      const template = profile.templates.find((t) => t.id === v.templateId);
      const used = new Set(data.subjects.filter((s) => s.semesterId === payload.semesterId).map((s) => s.color));
      saved = await create('subjects', {
        ...payload,
        structure: template?.structure || payload.structure,
        components: componentsFromTemplate(template),
        color: SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[0],
      });
    }
    toast(subject ? 'Subject updated' : 'Subject added');
    onSaved?.(saved);
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title={subject ? 'Edit subject' : 'Add subject'} onSubmit={submit} size="wide">
      <div className="form-grid three">
        <TextField className="span-2" label="Subject name" value={v.name} onChange={set('name')} required placeholder="Computer Networks" />
        <TextField label="Code / short name" value={v.code} onChange={set('code')} placeholder="CN" />
        <SelectField label="Semester" value={v.semesterId} onChange={set('semesterId')} options={semesterOptions(data)} placeholder="Select…" required />
        <SelectField
          label="Credit structure"
          value={v.gradingMode}
          onChange={set('gradingMode')}
          options={[
            { value: 'combined', label: 'One grade for the subject' },
            { value: 'split', label: 'Separate theory & practical grades' },
          ]}
        />
        {split ? (
          <div className="row">
            <NumberField label="Theory credits" value={v.theoryCredits} onChange={set('theoryCredits')} min={0} step={0.5} />
            <NumberField label="Practical credits" value={v.practicalCredits} onChange={set('practicalCredits')} min={0} step={0.5} />
          </div>
        ) : (
          <NumberField label="Credits" value={v.credits} onChange={set('credits')} min={0} max={60} step={0.5} required />
        )}
        {!subject && (
          <SelectField
            label="Assessment structure"
            value={v.templateId}
            onChange={set('templateId')}
            options={[...profile.templates.map((t) => ({ value: t.id, label: t.name })), { value: '', label: 'Empty — I’ll add components' }]}
            hint="Edit components any time on the subject page"
          />
        )}
        <TextField label="Faculty / instructor" value={v.faculty} onChange={set('faculty')} />
        <TextField label="Category" value={v.category} onChange={set('category')} placeholder="Core, Elective, Lab…" />
        <SelectField label="Target grade" value={v.targetGrade} onChange={set('targetGrade')} options={grades} placeholder="None" />
        <SelectField
          label="Difficulty"
          value={String(v.difficulty ?? '')}
          onChange={(x) => set('difficulty')(x ? Number(x) : null)}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: ['Very easy', 'Easy', 'Moderate', 'Hard', 'Very hard'][n - 1] }))}
          placeholder="—"
        />
        <SelectField
          label="Your strength"
          value={String(v.strength ?? '')}
          onChange={(x) => set('strength')(x ? Number(x) : null)}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: ['Very weak', 'Weak', 'Average', 'Strong', 'Very strong'][n - 1] }))}
          placeholder="—"
        />
        {subject &&
          (split ? (
            <>
              <SelectField label="Official theory grade" value={v.officialGradeTheory} onChange={set('officialGradeTheory')} options={grades} placeholder="Not declared" />
              <SelectField label="Official practical grade" value={v.officialGradePractical} onChange={set('officialGradePractical')} options={grades} placeholder="Not declared" />
            </>
          ) : (
            <SelectField label="Official final grade" value={v.officialGrade} onChange={set('officialGrade')} options={grades} placeholder="Not declared" hint="Set once results are out — treated as confirmed" />
          ))}
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
