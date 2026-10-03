import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check as CheckIcon, Plus, Trash2, Upload, Rocket } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useSession } from '../store/session.jsx';
import { useToast } from '../components/ui/Feedback.jsx';
import { DateField, NumberField, SelectField, TextField, ToggleRow } from '../components/ui/Fields.jsx';
import { Callout } from '../components/ui/Card.jsx';
import { BrandMark, BrandWordmark } from '../components/layout/Brand.jsx';
import { GRADING_PRESETS, MODULES, componentsFromTemplate, SUBJECT_COLORS, GATE_CS_SUBJECTS } from '../logic/defaults.js';
import { uid } from '../lib/ids.js';
import { addDaysISO } from '../lib/dates.js';
import { Info } from 'lucide-react';

const STEPS = ['You', 'University & grading', 'Semesters', 'Subjects', 'Targets & goals', 'Tracking'];

const GOAL_IDEAS = [
  { key: 'gate', title: 'GATE 2027', category: 'competitive' },
  { key: 'cgpa', title: 'Reach my CGPA target', category: 'academic' },
  { key: 'dsa', title: 'Complete DSA', category: 'skill' },
  { key: 'project', title: 'Build a portfolio project', category: 'project' },
  { key: 'ds', title: 'Learn Data Science', category: 'course' },
];

export default function Onboarding() {
  const { profile, saveProfile, create, bulkCreate, importData, today } = useData();
  const { logout } = useSession();
  const toast = useToast();
  const fileRef = useRef(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [me, setMe] = useState({ name: profile.name || '', tagline: profile.tagline || '' });
  const [uni, setUni] = useState({ ...profile.university });
  const [presetKey, setPresetKey] = useState(profile.grading.preset || 'ten-point');
  const [grading, setGrading] = useState({ ...profile.grading });
  const [sem, setSem] = useState({ number: 1, name: 'Semester 1', academicYear: '', startDate: today, endDate: addDaysISO(today, 140) });
  const [past, setPast] = useState([]);
  const [subjects, setSubjects] = useState([{ id: uid(), name: '', code: '', credits: 4, templateId: 'theory' }]);
  const [targets, setTargets] = useState({ sgpa: null, cgpa: null });
  const [goalPicks, setGoalPicks] = useState({});
  const [customGoal, setCustomGoal] = useState('');
  const [prefs, setPrefs] = useState({ modules: { ...profile.preferences.modules }, dailyStudyTargetHours: profile.preferences.dailyStudyTargetHours });

  const applyPreset = (key) => {
    setPresetKey(key);
    const p = GRADING_PRESETS[key];
    setGrading((g) => ({ ...g, preset: key, maxPoint: p.maxPoint, passingPercent: p.passingPercent, scale: p.scale.map((x) => ({ ...x })) }));
  };

  const setSemNumber = (n) => {
    setSem((s) => ({ ...s, number: n, name: n ? `Semester ${n}` : s.name }));
    if (n > 1) {
      setPast((rows) => {
        const existing = Object.fromEntries(rows.map((r) => [r.number, r]));
        return Array.from({ length: n - 1 }, (_, i) => existing[i + 1] || { number: i + 1, sgpa: null, credits: null });
      });
    } else setPast([]);
  };

  const finish = async () => {
    setBusy(true);
    try {
      await bulkCreate(
        'semesters',
        past
          .filter((p) => p.sgpa != null)
          .map((p) => ({ number: p.number, name: `Semester ${p.number}`, status: 'completed', officialSgpa: p.sgpa, officialCredits: p.credits, timetable: {}, notes: '' }))
      );
      const current = await create('semesters', { ...sem, status: 'ongoing', targetSgpa: targets.sgpa, timetable: {}, notes: '' });
      const subjectDocs = subjects
        .filter((s) => s.name.trim())
        .map((s, i) => {
          const template = profile.templates.find((t) => t.id === s.templateId);
          return {
            semesterId: current.id,
            name: s.name.trim(),
            code: s.code.trim(),
            credits: Number(s.credits) || 0,
            structure: template?.structure || 'theory',
            gradingMode: 'combined',
            components: componentsFromTemplate(template),
            color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
            category: 'Core',
          };
        });
      if (subjectDocs.length) await bulkCreate('subjects', subjectDocs);

      // Starting CGPA (from past results) so a CGPA goal measures real progress.
      const pastDone = past.filter((p) => p.sgpa != null && p.credits);
      const pastCredits = pastDone.reduce((s, p) => s + p.credits, 0);
      const startCgpa = pastCredits ? Number((pastDone.reduce((s, p) => s + p.sgpa * p.credits, 0) / pastCredits).toFixed(2)) : null;
      const goals = [];
      for (const idea of GOAL_IDEAS.filter((g) => goalPicks[g.key])) {
        const base = { title: idea.title, category: idea.category, startDate: today, priority: 'high', status: 'active', milestones: [], relatedSubjectIds: [], notes: '', description: '', completedAt: null, exam: null };
        if (idea.key === 'gate') {
          goals.push({
            ...base,
            targetDate: '2027-02-07',
            metric: { type: 'exam-prep', target: 100, current: 0, unit: '%' },
            exam: { name: 'GATE CSE', date: '2027-02-07', syllabusDeadline: null, mocks: [], subjects: GATE_CS_SUBJECTS.map((x) => ({ id: uid('es_'), name: x.name, weight: x.weight, topics: [], lecturesTotal: null, lecturesDone: 0, questionsSolved: 0, revisions: 0, weeklyHoursTarget: null, notes: '' })) },
          });
        } else if (idea.key === 'cgpa') {
          goals.push({ ...base, title: targets.cgpa ? `CGPA ${targets.cgpa}` : idea.title, metric: { type: 'cgpa', target: targets.cgpa || 8.5, start: startCgpa, unit: 'CGPA' } });
        } else {
          goals.push({ ...base, metric: { type: 'milestones' } });
        }
      }
      if (customGoal.trim()) goals.push({ title: customGoal.trim(), category: 'personal', startDate: today, priority: 'medium', status: 'active', metric: { type: 'manual', target: 100, current: 0, unit: '%' }, milestones: [], relatedSubjectIds: [], notes: '', description: '', completedAt: null, exam: null });
      if (goals.length) await bulkCreate('goals', goals);

      await saveProfile((p) => ({
        ...p,
        onboarded: true,
        name: me.name.trim(),
        tagline: me.tagline,
        university: uni,
        grading,
        currentSemesterId: current.id,
        targets: { sgpa: targets.sgpa, cgpa: targets.cgpa },
        preferences: { ...p.preferences, modules: prefs.modules, dailyStudyTargetHours: prefs.dailyStudyTargetHours },
      }));
      toast(`Welcome to LifeOS${me.name ? `, ${me.name.split(' ')[0]}` : ''}!`);
    } catch {
      setBusy(false);
    }
  };

  const importFile = async (file) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await importData(payload, 'replace');
      if (!payload.profile?.onboarded) await saveProfile((p) => ({ ...p, onboarded: true }));
      toast('Data imported');
    } catch (e) {
      toast(e.message || 'Could not import this file', 'critical');
    }
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="page onboarding">
      <div className="row between mb">
        <div className="row">
          <BrandMark size={38} />
          <div>
            <div className="strong" style={{ fontSize: 17 }}>Set up <BrandWordmark size={17} /></div>
            <div className="small muted">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
          Sign out
        </button>
      </div>
      <div className="steps" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? 'done' : ''} />
        ))}
      </div>

      <div className="card">
        {step === 0 && (
          <div className="stack">
            <div>
              <h2>Hi! Let’s start small.</h2>
              <p className="text-2 mt-sm">Everything here is optional and editable later. LifeOS gets smarter as you add more.</p>
            </div>
            <div className="form-grid">
              <TextField label="Your name" value={me.name} onChange={(v) => setMe({ ...me, name: v })} autoComplete="name" />
              <TextField label="Headline (optional)" value={me.tagline} onChange={(v) => setMe({ ...me, tagline: v })} placeholder="CSE student · aiming for GATE" />
            </div>
            <div className="divider" />
            <div className="row wrap between">
              <div className="small text-2">Already have a LifeOS export? Restore it instead.</div>
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Import export file
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <h2>Your university & grading system</h2>
            <div className="form-grid three">
              <TextField className="span-2" label="University / college" value={uni.name} onChange={(v) => setUni({ ...uni, name: v })} />
              <TextField label="Degree" value={uni.degree} onChange={(v) => setUni({ ...uni, degree: v })} placeholder="B.Tech" />
              <TextField className="span-2" label="Program / branch" value={uni.program} onChange={(v) => setUni({ ...uni, program: v })} placeholder="Computer Science & Engineering" />
              <NumberField label="Total semesters" value={uni.semesterCount} onChange={(v) => setUni({ ...uni, semesterCount: v, durationYears: v ? Math.ceil(v / 2) : uni.durationYears })} min={1} max={20} step={1} />
            </div>
            <div className="form-grid three">
              <SelectField label="Grading scale" value={presetKey} onChange={applyPreset} options={Object.entries(GRADING_PRESETS).map(([k, p]) => ({ value: k, label: p.label }))} />
              <NumberField label="Minimum passing %" value={grading.passingPercent} onChange={(v) => setGrading({ ...grading, passingPercent: v })} min={0} max={100} />
              <NumberField label="Attendance requirement %" value={grading.attendanceThreshold} onChange={(v) => setGrading({ ...grading, attendanceThreshold: v })} min={0} max={100} />
              <SelectField
                className="span-2"
                label="CGPA is calculated as"
                value={grading.cgpaMethod}
                onChange={(v) => setGrading({ ...grading, cgpaMethod: v })}
                options={[
                  { value: 'credit-weighted', label: 'Credit-weighted average of semesters (Σ credits × SGPA ÷ Σ credits)' },
                  { value: 'sgpa-average', label: 'Simple average of SGPAs' },
                ]}
              />
            </div>
            <div className="table-wrap">
              <table className="table scale-table">
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th className="num">Min %</th>
                    <th className="num">Grade points</th>
                  </tr>
                </thead>
                <tbody>
                  {grading.scale.map((g, i) => (
                    <tr key={i}>
                      <td>
                        <input className="input sm" style={{ maxWidth: 90 }} value={g.grade} aria-label="Grade name" onChange={(e) => setGrading({ ...grading, scale: grading.scale.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)) })} />
                      </td>
                      <td className="num">
                        <input className="input sm" type="number" style={{ maxWidth: 90, marginLeft: 'auto' }} value={g.min} aria-label="Minimum percent" onChange={(e) => setGrading({ ...grading, scale: grading.scale.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)) })} />
                      </td>
                      <td className="num">
                        <input className="input sm" type="number" step="0.1" style={{ maxWidth: 90, marginLeft: 'auto' }} value={g.points} aria-label="Grade points" onChange={(e) => setGrading({ ...grading, scale: grading.scale.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)) })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout tone="info" icon={Info}>
              Assessment structures (mid-sems, practicals, viva, internal/external weights…) and other rules can be customised later in Settings → University & grading.
            </Callout>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <h2>Your current semester</h2>
            <div className="form-grid three">
              <NumberField label="Semester number" value={sem.number} onChange={setSemNumber} min={1} max={20} step={1} />
              <TextField label="Name" value={sem.name} onChange={(v) => setSem({ ...sem, name: v })} />
              <TextField label="Academic year" value={sem.academicYear} onChange={(v) => setSem({ ...sem, academicYear: v })} placeholder="2026-27" />
              <DateField label="Start date" value={sem.startDate} onChange={(v) => setSem({ ...sem, startDate: v })} />
              <DateField label="End date" value={sem.endDate} onChange={(v) => setSem({ ...sem, endDate: v })} />
            </div>
            {past.length > 0 && (
              <>
                <div className="divider" />
                <div>
                  <h3>Previous semester results (optional)</h3>
                  <p className="small muted">Enter official SGPA and credits — enough to calculate your CGPA. Leave blank to skip.</p>
                </div>
                <div className="grid-auto">
                  {past.map((p, i) => (
                    <div key={p.number} className="row">
                      <span className="pill-num">S{p.number}</span>
                      <NumberField label="SGPA" value={p.sgpa} onChange={(v) => setPast(past.map((x, j) => (j === i ? { ...x, sgpa: v } : x)))} min={0} max={grading.maxPoint} step={0.01} />
                      <NumberField label="Credits" value={p.credits} onChange={(v) => setPast(past.map((x, j) => (j === i ? { ...x, credits: v } : x)))} min={0} step={0.5} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <div>
              <h2>Subjects in {sem.name || 'this semester'}</h2>
              <p className="small muted mt-sm">Credits drive SGPA weighting. Each subject gets an assessment structure you can adjust later.</p>
            </div>
            {subjects.map((s, i) => (
              <div key={s.id} className="subject-row">
                <TextField label={i === 0 ? 'Subject name' : undefined} aria-label="Subject name" value={s.name} onChange={(v) => setSubjects(subjects.map((x) => (x.id === s.id ? { ...x, name: v } : x)))} placeholder="Computer Networks" />
                <TextField label={i === 0 ? 'Code' : undefined} aria-label="Code" value={s.code} onChange={(v) => setSubjects(subjects.map((x) => (x.id === s.id ? { ...x, code: v } : x)))} placeholder="CN" />
                <NumberField label={i === 0 ? 'Credits' : undefined} aria-label="Credits" value={s.credits} onChange={(v) => setSubjects(subjects.map((x) => (x.id === s.id ? { ...x, credits: v } : x)))} min={0} step={0.5} />
                <SelectField label={i === 0 ? 'Structure' : undefined} aria-label="Structure" value={s.templateId} onChange={(v) => setSubjects(subjects.map((x) => (x.id === s.id ? { ...x, templateId: v } : x)))} options={profile.templates.map((t) => ({ value: t.id, label: t.name }))} />
                <button type="button" className="icon-btn danger" aria-label="Remove subject" onClick={() => setSubjects(subjects.filter((x) => x.id !== s.id))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-sm" onClick={() => setSubjects([...subjects, { id: uid(), name: '', code: '', credits: 3, templateId: 'theory' }])}>
                <Plus size={14} /> Add subject
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="stack">
            <h2>Targets & goals</h2>
            <div className="form-grid">
              <NumberField label={`Target SGPA for ${sem.name || 'this semester'}`} value={targets.sgpa} onChange={(v) => setTargets({ ...targets, sgpa: v })} min={0} max={grading.maxPoint} step={0.01} />
              <NumberField label="Target CGPA" value={targets.cgpa} onChange={(v) => setTargets({ ...targets, cgpa: v })} min={0} max={grading.maxPoint} step={0.01} />
            </div>
            <div>
              <div className="field-label mb" style={{ marginBottom: 8 }}>Pick some goals to start with</div>
              <div className="chips">
                {GOAL_IDEAS.map((g) => (
                  <button key={g.key} type="button" className="chip" aria-pressed={Boolean(goalPicks[g.key])} onClick={() => setGoalPicks({ ...goalPicks, [g.key]: !goalPicks[g.key] })}>
                    {goalPicks[g.key] && <CheckIcon size={12} style={{ display: 'inline', marginRight: 4 }} />}
                    {g.title}
                  </button>
                ))}
              </div>
            </div>
            <TextField label="Or write your own" value={customGoal} onChange={setCustomGoal} placeholder="Finish the ML specialisation" />
          </div>
        )}

        {step === 5 && (
          <div className="stack">
            <div>
              <h2>What do you want to track?</h2>
              <p className="small muted mt-sm">Turn off anything you don’t need — LifeOS never forces tracking. You can change this any time.</p>
            </div>
            <div>
              {MODULES.map((m) => (
                <ToggleRow key={m.key} title={m.label} checked={prefs.modules[m.key] !== false} onChange={(v) => setPrefs({ ...prefs, modules: { ...prefs.modules, [m.key]: v } })} />
              ))}
            </div>
            <NumberField label="Daily study target (hours)" value={prefs.dailyStudyTargetHours} onChange={(v) => setPrefs({ ...prefs, dailyStudyTargetHours: v })} min={0} max={16} step={0.5} />
            <Callout tone="info" icon={Info}>
              After launch, log a study session or today’s log and LifeOS starts building your personal history and insights.
            </Callout>
          </div>
        )}
      </div>

      <div className="row between mt">
        <button type="button" className="btn btn-ghost" onClick={back} disabled={step === 0 || busy}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="row-sm">
          {step < STEPS.length - 1 && (
            <button type="button" className="btn btn-ghost" onClick={next}>
              Skip
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish} disabled={busy}>
              <Rocket size={15} /> {busy ? 'Setting up…' : 'Launch LifeOS'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
