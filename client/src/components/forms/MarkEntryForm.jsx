import { useEffect, useMemo } from 'react';
import { FormModal } from '../ui/Modal.jsx';
import { DateField, NumberField, SelectField } from '../ui/Fields.jsx';
import { Callout } from '../ui/Card.jsx';
import { Info } from 'lucide-react';
import { useFormState } from '../../hooks/useFormState.js';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { subjectOptions } from './options.js';
import { useSaveComponents } from '../../hooks/useSaveComponents.js';

/** Quick mark entry for one assessment component of a subject. */
export function MarkEntryForm({ open, onClose, subjectId: initialSubject, componentId: initialComponent }) {
  const { data, analysis, today } = useData();
  const toast = useToast();
  const saveComponents = useSaveComponents();
  const [v, set, setAll] = useFormState({ subjectId: null, componentId: null, obtained: null, status: 'confirmed', date: today });

  useEffect(() => {
    if (open) setAll({ subjectId: initialSubject || null, componentId: initialComponent || null, obtained: null, status: 'confirmed', date: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const subject = data.subjects.find((s) => s.id === v.subjectId);
  const component = subject?.components?.find((c) => c.id === v.componentId);
  const compOptions = useMemo(
    () => (subject?.components || []).map((c) => ({ value: c.id, label: `${c.name} (/${c.maxMarks})${c.status !== 'pending' && c.obtained != null ? ` — ${c.obtained} ${c.status}` : ''}` })),
    [subject]
  );

  useEffect(() => {
    if (component) setAll((s) => ({ ...s, obtained: component.obtained ?? null, status: component.status === 'pending' ? 'confirmed' : component.status, date: component.date || s.date }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.componentId]);

  const submit = async () => {
    if (!subject || !component) return;
    if (v.status !== 'pending' && (v.obtained == null || v.obtained < 0 || v.obtained > component.maxMarks)) {
      toast(`Enter marks between 0 and ${component.maxMarks}`, 'critical');
      return;
    }
    const components = subject.components.map((c) =>
      c.id === component.id ? { ...c, obtained: v.status === 'pending' ? null : v.obtained, status: v.status, date: v.date } : c
    );
    await saveComponents(subject, components);
    toast('Marks saved');
    onClose();
  };

  return (
    <FormModal open={open} onClose={onClose} title="Enter marks" onSubmit={submit}>
      <div className="form-grid">
        <SelectField className="full" label="Subject" value={v.subjectId} onChange={(x) => setAll((s) => ({ ...s, subjectId: x, componentId: null }))} options={subjectOptions(data, analysis)} placeholder="Select…" required />
        <SelectField className="full" label="Assessment" value={v.componentId} onChange={set('componentId')} options={compOptions} placeholder={subject ? 'Select…' : 'Pick a subject first'} required />
        <NumberField label={component ? `Marks obtained (out of ${component.maxMarks})` : 'Marks obtained'} value={v.obtained} onChange={set('obtained')} min={0} max={component?.maxMarks} step="any" />
        <SelectField
          label="These marks are"
          value={v.status}
          onChange={set('status')}
          options={[
            { value: 'confirmed', label: 'Confirmed (official)' },
            { value: 'expected', label: 'Expected (awaiting result)' },
            { value: 'estimated', label: 'Estimated (rough guess)' },
            { value: 'pending', label: 'Pending (clear marks)' },
          ]}
        />
        <DateField label="Assessment date" value={v.date} onChange={set('date')} />
        <div className="full">
          <Callout tone="info" icon={Info}>
            Only <b>confirmed</b> marks count toward confirmed SGPA/CGPA. Expected and estimated marks are used for projections and are always labelled.
          </Callout>
        </div>
      </div>
    </FormModal>
  );
}
