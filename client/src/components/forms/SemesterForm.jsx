import { useEffect } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { DateField, NumberField, SelectField, TextArea, TextField, Field } from '../ui/Fields.jsx';
import { Callout } from '../ui/Card.jsx';
import { Info } from 'lucide-react';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';

const blank = (n) => ({
  number: n,
  name: n ? `Semester ${n}` : '',
  academicYear: '',
  startDate: null,
  endDate: null,
  status: 'ongoing',
  targetSgpa: null,
  officialSgpa: null,
  officialCredits: null,
  notes: '',
});

export function SemesterForm({ open, onClose, semester, onSaved }) {
  const { data, create, update, profile, saveProfile } = useData();
  const toast = useToast();
  const nextNumber = Math.max(0, ...data.semesters.map((s) => Number(s.number) || 0)) + 1;
  const [v, set, setAll] = useFormState(semester || blank(nextNumber));

  useEffect(() => {
    if (open) setAll(semester ? { ...blank(), ...semester } : blank(nextNumber));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, semester?.id]);

  const submit = async () => {
    const payload = {
      number: v.number,
      name: v.name?.trim() || `Semester ${v.number ?? ''}`.trim(),
      academicYear: v.academicYear,
      startDate: v.startDate,
      endDate: v.endDate,
      status: v.status,
      targetSgpa: v.targetSgpa,
      officialSgpa: v.officialSgpa,
      officialCredits: v.officialCredits,
      notes: v.notes,
    };
    const saved = semester ? await update('semesters', semester.id, payload) : await create('semesters', { ...payload, timetable: {} });
    if (!semester && (payload.status === 'ongoing' || !profile.currentSemesterId)) {
      await saveProfile({ currentSemesterId: saved.id });
    }
    toast(semester ? 'Semester updated' : 'Semester added');
    onSaved?.(saved);
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title={semester ? 'Edit semester' : 'Add semester'} onSubmit={submit}>
      <div className="form-grid">
        <NumberField label="Semester number" value={v.number} onChange={set('number')} min={0} max={40} step={1} />
        <TextField label="Name" value={v.name} onChange={set('name')} required placeholder="Semester 5" />
        <TextField label="Academic year" value={v.academicYear} onChange={set('academicYear')} placeholder="2026-27" />
        <SelectField
          label="Status"
          value={v.status}
          onChange={set('status')}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'ongoing', label: 'Ongoing' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
        <DateField label="Start date" value={v.startDate} onChange={set('startDate')} />
        <DateField label="End date" value={v.endDate} onChange={set('endDate')} />
        <NumberField label="Target SGPA" value={v.targetSgpa} onChange={set('targetSgpa')} min={0} max={profile.grading.maxPoint} step={0.01} hint="Optional — overrides your default SGPA target" />
        <div />
        <Field className="full" label="Official result (optional)">
          <Callout tone="info" icon={Info}>
            For past semesters you can enter just the declared SGPA and total credits — no subjects needed. An official SGPA is treated as confirmed and
            overrides values calculated from marks.
          </Callout>
        </Field>
        <NumberField label="Official SGPA" value={v.officialSgpa} onChange={set('officialSgpa')} min={0} max={profile.grading.maxPoint} step={0.01} />
        <NumberField label="Total credits" value={v.officialCredits} onChange={set('officialCredits')} min={0} max={400} step={0.5} hint="Used for CGPA weighting" />
        <TextArea className="full" label="Notes" value={v.notes} onChange={set('notes')} rows={2} />
      </div>
    </FormModal>
  );
}
