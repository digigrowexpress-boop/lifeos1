import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Info, RotateCcw } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { useToast, useConfirm } from '../ui/Feedback.jsx';
import { Callout, Card } from '../ui/Card.jsx';
import { NumberField, SelectField, TextArea, TextField, ToggleRow } from '../ui/Fields.jsx';
import { ASSESSMENT_TYPES, DEFAULT_TEMPLATES, GRADING_PRESETS } from '../../logic/defaults.js';
import { uid } from '../../lib/ids.js';

function TemplateEditor({ template, onChange, onRemove }) {
  const comps = template.components || [];
  const setComp = (i, patch) => onChange({ ...template, components: comps.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const total = comps.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  return (
    <Card>
      <div className="row between wrap mb">
        <div className="row-sm grow" style={{ minWidth: 220 }}>
          <input className="input" value={template.name} aria-label="Template name" onChange={(e) => onChange({ ...template, name: e.target.value })} />
          <select className="select" style={{ width: 150 }} value={template.structure} aria-label="Structure" onChange={(e) => onChange({ ...template, structure: e.target.value })}>
            <option value="theory">Theory</option>
            <option value="practical">Practical</option>
            <option value="integrated">Integrated</option>
          </select>
        </div>
        <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}><Trash2 size={13} /> Remove</button>
      </div>
      <div className="table-wrap">
        <table className="table comp-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Part</th>
              <th>Type</th>
              <th>Int / Ext</th>
              <th className="num">Max marks</th>
              <th className="num">Weight</th>
              <th className="num">Min %</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i}>
                <td className="w-name"><input className="input" value={c.name} aria-label="Component name" onChange={(e) => setComp(i, { name: e.target.value })} /></td>
                <td>
                  <select className="select" value={c.kind} aria-label="Part" onChange={(e) => setComp(i, { kind: e.target.value })}>
                    <option value="theory">Theory</option>
                    <option value="practical">Practical</option>
                  </select>
                </td>
                <td className="w-sel">
                  <select className="select" value={c.assessmentType} aria-label="Type" onChange={(e) => setComp(i, { assessmentType: e.target.value })}>
                    {ASSESSMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </td>
                <td>
                  <select className="select" value={c.evaluation} aria-label="Internal or external" onChange={(e) => setComp(i, { evaluation: e.target.value })}>
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                  </select>
                </td>
                <td className="w-num"><input className="input" type="number" min={0} value={c.maxMarks ?? ''} aria-label="Maximum marks" onChange={(e) => setComp(i, { maxMarks: Number(e.target.value) })} /></td>
                <td className="w-num"><input className="input" type="number" min={0} step="any" value={c.weight ?? ''} aria-label="Weight" onChange={(e) => setComp(i, { weight: Number(e.target.value) })} /></td>
                <td className="w-num"><input className="input" type="number" min={0} max={100} value={c.minPassPercent ?? ''} placeholder="—" aria-label="Minimum pass percent" onChange={(e) => setComp(i, { minPassPercent: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                <td><button type="button" className="icon-btn sm danger" aria-label="Remove component" onClick={() => onChange({ ...template, components: comps.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row between mt-sm">
        <button type="button" className="btn btn-sm" onClick={() => onChange({ ...template, components: [...comps, { name: 'New component', kind: 'theory', assessmentType: 'other', evaluation: 'internal', maxMarks: 10, weight: 10, minPassPercent: null }] })}>
          <Plus size={13} /> Component
        </button>
        <span className="small" style={{ color: Math.abs(total - 100) > 0.5 ? 'var(--warning)' : 'var(--text-2)' }}>Weights total {total}{Math.abs(total - 100) > 0.5 ? ' (will be scaled to 100)' : ''}</span>
      </div>
    </Card>
  );
}

export function GradingSettings() {
  const { profile, saveProfile } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [uni, setUni] = useState(profile.university);
  const [g, setG] = useState(profile.grading);
  const [templates, setTemplates] = useState(profile.templates);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setUni(profile.university);
    setG(profile.grading);
    setTemplates(profile.templates);
    setDirty(false);
  }, [profile.university, profile.grading, profile.templates]);

  const upG = (patch) => {
    setG((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setScale = (i, patch) => upG({ scale: g.scale.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const save = async () => {
    const names = g.scale.map((x) => x.grade.trim());
    if (names.some((n) => !n) || new Set(names).size !== names.length) return toast('Grade names must be unique and not empty', 'critical');
    await saveProfile((p) => ({ ...p, university: uni, grading: { ...g, scale: [...g.scale].sort((a, b) => b.min - a.min) }, templates }));
    toast('Grading rules saved — all results recalculated');
  };

  return (
    <div className="stack">
      <Card title="University & program">
        <div className="form-grid three">
          <TextField className="span-2" label="University / college" value={uni.name} onChange={(v) => { setUni({ ...uni, name: v }); setDirty(true); }} />
          <TextField label="Degree" value={uni.degree} onChange={(v) => { setUni({ ...uni, degree: v }); setDirty(true); }} />
          <TextField className="span-2" label="Program / branch" value={uni.program} onChange={(v) => { setUni({ ...uni, program: v }); setDirty(true); }} />
          <NumberField label="Program duration (years)" value={uni.durationYears} onChange={(v) => { setUni({ ...uni, durationYears: v }); setDirty(true); }} min={1} max={10} step={0.5} />
          <NumberField label="Total semesters" value={uni.semesterCount} onChange={(v) => { setUni({ ...uni, semesterCount: v }); setDirty(true); }} min={1} max={20} step={1} hint="Used for CGPA target planning" />
        </div>
      </Card>

      <Card title="Grading scale" sub="Grade names, minimum percentage and grade points — exactly as your university defines them">
        <div className="row wrap mb">
          <SelectField
            label="Start from a preset"
            value=""
            placeholder="Choose preset…"
            onChange={async (k) => {
              if (!k) return;
              if (await confirm({ title: `Apply “${GRADING_PRESETS[k].label}”?`, message: 'This replaces the grade table below (not saved until you press Save).', confirmLabel: 'Apply' })) {
                const p = GRADING_PRESETS[k];
                upG({ preset: k, maxPoint: p.maxPoint, passingPercent: p.passingPercent, scale: p.scale.map((x) => ({ ...x })) });
              }
            }}
            options={Object.entries(GRADING_PRESETS).map(([k, p]) => ({ value: k, label: p.label }))}
          />
        </div>
        <div className="grid-2">
          <div className="table-wrap">
            <table className="table scale-table">
              <thead>
                <tr><th>Grade</th><th className="num">Min %</th><th className="num">Points</th><th /></tr>
              </thead>
              <tbody>
                {g.scale.map((x, i) => (
                  <tr key={i}>
                    <td><input className="input sm" style={{ maxWidth: 100 }} value={x.grade} aria-label="Grade" onChange={(e) => setScale(i, { grade: e.target.value })} /></td>
                    <td className="num"><input className="input sm" type="number" style={{ maxWidth: 90, marginLeft: 'auto' }} value={x.min} aria-label="Minimum percent" onChange={(e) => setScale(i, { min: Number(e.target.value) })} /></td>
                    <td className="num"><input className="input sm" type="number" step="0.1" style={{ maxWidth: 90, marginLeft: 'auto' }} value={x.points} aria-label="Grade points" onChange={(e) => setScale(i, { points: Number(e.target.value) })} /></td>
                    <td><button type="button" className="icon-btn sm danger" aria-label="Remove grade" onClick={() => upG({ scale: g.scale.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm mt-sm" onClick={() => upG({ scale: [...g.scale, { grade: 'New', min: 0, points: 0 }] })}><Plus size={13} /> Grade</button>
          </div>
          <div className="form-grid">
            <NumberField label="Maximum grade point" value={g.maxPoint} onChange={(v) => upG({ maxPoint: v })} min={1} step={0.1} />
            <NumberField label="Minimum passing %" value={g.passingPercent} onChange={(v) => upG({ passingPercent: v })} min={0} max={100} hint="Below this a subject gets the lowest (fail) grade" />
            <div className="field full">
              <span className="field-label">SGPA rule</span>
              <div className="small">Σ (credits × grade points) ÷ Σ credits</div>
              <div className="hint">Theory and practical parts can carry separate credits — set this per subject (“Separate theory & practical grades”).</div>
            </div>
            <SelectField
              className="full"
              label="CGPA rule"
              value={g.cgpaMethod}
              onChange={(v) => upG({ cgpaMethod: v })}
              options={[
                { value: 'credit-weighted', label: 'Credit-weighted average of semester SGPAs' },
                { value: 'sgpa-average', label: 'Simple average of semester SGPAs' },
              ]}
            />
            <NumberField label="Decimals shown" value={g.decimals} onChange={(v) => upG({ decimals: v })} min={0} max={4} step={1} />
            <NumberField label="Attendance requirement %" value={g.attendanceThreshold} onChange={(v) => upG({ attendanceThreshold: v })} min={0} max={100} />
            <div className="full">
              <ToggleRow title="Count credits of failed subjects" description="If off, failed subjects are excluded from the SGPA/CGPA credit total" checked={g.countFailedCredits} onChange={(v) => upG({ countFailedCredits: v })} />
            </div>
            <SelectField
              className="full"
              label="Projection for pending assessments"
              value={g.pendingAssumption}
              onChange={(v) => upG({ pendingAssumption: v })}
              options={[
                { value: 'performance', label: 'Assume my current performance continues' },
                { value: 'fixed', label: 'Assume a fixed percentage' },
              ]}
            />
            <NumberField label={g.pendingAssumption === 'fixed' ? 'Fixed %' : 'Fallback %'} value={g.pendingFixedPercent} onChange={(v) => upG({ pendingFixedPercent: v })} min={0} max={100} hint="Also used when nothing has been assessed yet" />
          </div>
        </div>
        <TextArea className="mt" label="Other rules / notes" value={g.notes} onChange={(v) => upG({ notes: v })} rows={2} placeholder="e.g. grace marks policy, re-exam rules, credit caps…" />
      </Card>

      <Card title="Assessment structures" sub="Templates for new subjects: mid-sems, assignments, quizzes, attendance marks, practicals, viva, projects, MOOC and more. Existing subjects keep their own structure.">
        <Callout tone="info" icon={Info}>
          Weight = share of the subject’s final score. Max marks = what the assessment is marked out of. “Min %” enforces minimum passing marks in a component (e.g. 35% in the end-sem exam).
        </Callout>
        <div className="stack mt">
          {templates.map((t, i) => (
            <TemplateEditor
              key={t.id}
              template={t}
              onChange={(nt) => { setTemplates(templates.map((x, j) => (j === i ? nt : x))); setDirty(true); }}
              onRemove={() => { setTemplates(templates.filter((_, j) => j !== i)); setDirty(true); }}
            />
          ))}
          <div className="row-sm">
            <button type="button" className="btn btn-sm" onClick={() => { setTemplates([...templates, { id: uid('tpl_'), name: 'New structure', structure: 'theory', components: [] }]); setDirty(true); }}><Plus size={13} /> New structure</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTemplates(DEFAULT_TEMPLATES.map((t) => ({ ...t, components: t.components.map((c) => ({ ...c })) }))); setDirty(true); }}><RotateCcw size={13} /> Restore defaults</button>
          </div>
        </div>
      </Card>

      <div className="row end" style={{ position: 'sticky', bottom: 16 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty} style={{ boxShadow: 'var(--shadow-lg)' }}>
          <Save size={15} /> Save university & grading
        </button>
      </div>
    </div>
  );
}
