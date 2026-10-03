import { useEffect, useState } from 'react';
import { Bell, BellRing, Monitor, Moon, Plus, Save, Sun, Trash2 } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { Card } from '../ui/Card.jsx';
import { NumberField, Segmented, SelectField, TextField, ToggleRow } from '../ui/Fields.jsx';
import { DASHBOARD_WIDGETS, MODULES, STUDY_TYPES } from '../../logic/defaults.js';
import { compareSemesters } from '../../logic/academics.js';

/** Helper: immediately save one nested preference. */
function usePref() {
  const { saveProfile } = useData();
  return (section, key, value) => saveProfile((p) => ({ ...p, [section]: { ...p[section], [key]: value } }));
}

export function ProfileSettings() {
  const { profile, data, saveProfile, user, mode } = useData();
  const toast = useToast();
  const [v, setV] = useState({ name: profile.name, tagline: profile.tagline, currentSemesterId: profile.currentSemesterId, sgpa: profile.targets?.sgpa, cgpa: profile.targets?.cgpa });
  useEffect(() => setV({ name: profile.name, tagline: profile.tagline, currentSemesterId: profile.currentSemesterId, sgpa: profile.targets?.sgpa, cgpa: profile.targets?.cgpa }), [profile]);
  const save = async () => {
    await saveProfile((p) => ({ ...p, name: v.name, tagline: v.tagline, currentSemesterId: v.currentSemesterId, targets: { ...p.targets, sgpa: v.sgpa, cgpa: v.cgpa } }));
    toast('Profile saved');
  };
  return (
    <Card title="Profile">
      <div className="form-grid">
        <TextField label="Name" value={v.name} onChange={(x) => setV({ ...v, name: x })} />
        <TextField label="Email (sign-in)" value={mode === 'cloud' ? user?.email : 'Device mode — no account'} onChange={() => {}} readOnly disabled hint={mode === 'cloud' ? 'Your account email. Your profile and data are private to this account.' : undefined} />
        <TextField className="full" label="Headline" value={v.tagline} onChange={(x) => setV({ ...v, tagline: x })} placeholder="CSE · aiming for GATE 2027" />
        <SelectField label="Current semester" value={v.currentSemesterId} onChange={(x) => setV({ ...v, currentSemesterId: x })} placeholder="Auto (latest ongoing)" options={[...data.semesters].sort(compareSemesters).map((s) => ({ value: s.id, label: s.name }))} />
        <div />
        <NumberField label="Default target SGPA" value={v.sgpa} onChange={(x) => setV({ ...v, sgpa: x })} min={0} max={profile.grading.maxPoint} step={0.01} hint="A semester’s own target overrides this" />
        <NumberField label="Target CGPA" value={v.cgpa} onChange={(x) => setV({ ...v, cgpa: x })} min={0} max={profile.grading.maxPoint} step={0.01} />
      </div>
      <div className="row end mt">
        <button type="button" className="btn btn-primary" onClick={save}><Save size={15} /> Save profile</button>
      </div>
    </Card>
  );
}

export function TrackingSettings() {
  const { profile, saveProfile } = useData();
  const setPref = usePref();
  const toast = useToast();
  const prefs = profile.preferences;
  const [targets, setTargets] = useState(prefs);
  const [newType, setNewType] = useState('');
  const [field, setField] = useState({ label: '', type: 'number', unit: '', section: 'lifestyle' });
  useEffect(() => setTargets(prefs), [prefs]);

  const saveTargets = async () => {
    await saveProfile((p) => ({
      ...p,
      preferences: {
        ...p.preferences,
        dailyStudyTargetHours: targets.dailyStudyTargetHours,
        weeklyStudyTargetHours: targets.weeklyStudyTargetHours,
        sleepTargetHours: targets.sleepTargetHours,
        screenLimitHours: targets.screenLimitHours,
        socialLimitHours: targets.socialLimitHours,
        exerciseTargetMin: targets.exerciseTargetMin,
      },
    }));
    toast('Targets saved');
  };

  const addField = () => {
    if (!field.label.trim()) return;
    const key = field.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${Date.now()}`;
    if ((prefs.customFields || []).some((f) => f.key === key)) return toast('A field with this name exists', 'critical');
    setPref('preferences', 'customFields', [...(prefs.customFields || []), { ...field, key, label: field.label.trim() }]);
    setField({ label: '', type: 'number', unit: '', section: 'lifestyle' });
  };

  return (
    <div className="stack">
      <div className="grid-2">
        <Card title="Tracking modules" sub="Turn off anything you don’t want to track — it disappears from navigation, the dashboard and insights.">
          {MODULES.map((m) => (
            <ToggleRow key={m.key} title={m.label} checked={prefs.modules?.[m.key] !== false} onChange={(v) => setPref('preferences', 'modules', { ...prefs.modules, [m.key]: v })} />
          ))}
        </Card>
        <Card title="Dashboard widgets" sub="Choose what the Command Center shows">
          {DASHBOARD_WIDGETS.map((w) => (
            <ToggleRow key={w.key} title={w.label} checked={prefs.dashboardWidgets?.[w.key] !== false} onChange={(v) => setPref('preferences', 'dashboardWidgets', { ...prefs.dashboardWidgets, [w.key]: v })} />
          ))}
        </Card>
      </div>

      <Card title="Personal targets & limits" sub="Used for progress bars, insights and reminders">
        <div className="form-grid three">
          <NumberField label="Daily study target (h)" value={targets.dailyStudyTargetHours} onChange={(x) => setTargets({ ...targets, dailyStudyTargetHours: x })} min={0} max={20} step={0.5} />
          <NumberField label="Weekly study target (h)" value={targets.weeklyStudyTargetHours} onChange={(x) => setTargets({ ...targets, weeklyStudyTargetHours: x })} min={0} max={120} step={0.5} />
          <NumberField label="Sleep target (h)" value={targets.sleepTargetHours} onChange={(x) => setTargets({ ...targets, sleepTargetHours: x })} min={0} max={14} step={0.25} />
          <NumberField label="Screen-time limit (h/day)" value={targets.screenLimitHours} onChange={(x) => setTargets({ ...targets, screenLimitHours: x })} min={0} max={24} step={0.25} />
          <NumberField label="Social-media limit (h/day)" value={targets.socialLimitHours} onChange={(x) => setTargets({ ...targets, socialLimitHours: x })} min={0} max={24} step={0.25} />
          <NumberField label="Exercise target (min/day)" value={targets.exerciseTargetMin} onChange={(x) => setTargets({ ...targets, exerciseTargetMin: x })} min={0} max={600} step={5} />
        </div>
        <div className="row between mt wrap">
          <div className="row-sm">
            <span className="small text-2">Show durations as</span>
            <Segmented label="Time format" value={prefs.timeFormat} onChange={(v) => setPref('preferences', 'timeFormat', v)} options={[{ value: 'hm', label: '3h 20m' }, { value: 'decimal', label: '3.3h' }]} />
          </div>
          <button type="button" className="btn btn-primary" onClick={saveTargets}><Save size={15} /> Save targets</button>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Custom tracking fields" sub="Add your own fields to the daily logbook (e.g. water, meditation, pages read). Numeric fields get trends and pattern detection.">
          <div className="list mb">
            {(prefs.customFields || []).length === 0 && <div className="small muted">No custom fields yet.</div>}
            {(prefs.customFields || []).map((f) => (
              <div key={f.key} className="list-item">
                <div className="li-main">
                  <div className="li-title small">{f.label}</div>
                  <div className="li-sub">{f.type}{f.unit ? ` · ${f.unit}` : ''} · {f.section} section</div>
                </div>
                <button type="button" className="icon-btn sm danger" aria-label={`Remove ${f.label}`} onClick={() => setPref('preferences', 'customFields', prefs.customFields.filter((x) => x.key !== f.key))}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="form-grid">
            <TextField label="Field name" value={field.label} onChange={(x) => setField({ ...field, label: x })} placeholder="Water" />
            <SelectField label="Type" value={field.type} onChange={(x) => setField({ ...field, type: x })} options={[{ value: 'number', label: 'Number' }, { value: 'rating', label: 'Rating 1–5' }, { value: 'boolean', label: 'Yes / no' }, { value: 'text', label: 'Text' }]} />
            <TextField label="Unit" value={field.unit} onChange={(x) => setField({ ...field, unit: x })} placeholder="glasses" />
            <SelectField label="Logbook section" value={field.section} onChange={(x) => setField({ ...field, section: x })} options={[{ value: 'academic', label: 'Academic' }, { value: 'lifestyle', label: 'Lifestyle' }, { value: 'productivity', label: 'Productivity' }]} />
          </div>
          <button type="button" className="btn btn-sm mt" onClick={addField} disabled={!field.label.trim()}><Plus size={13} /> Add field</button>
        </Card>
        <Card title="Study types" sub="Categories available when logging study sessions">
          <div className="chips mb">
            {prefs.studyTypes.map((t) => (
              <span key={t} className="chip row-sm" style={{ display: 'inline-flex' }}>
                {t}
                <button type="button" className="icon-btn sm" style={{ width: 18, height: 18 }} aria-label={`Remove ${t}`} onClick={() => setPref('preferences', 'studyTypes', prefs.studyTypes.filter((x) => x !== t))}>×</button>
              </span>
            ))}
          </div>
          <form className="row-sm" onSubmit={(e) => { e.preventDefault(); if (newType.trim() && !prefs.studyTypes.includes(newType.trim())) { setPref('preferences', 'studyTypes', [...prefs.studyTypes, newType.trim()]); setNewType(''); } }}>
            <input className="input sm grow" placeholder="Add a study type" value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="New study type" />
            <button type="submit" className="btn btn-sm"><Plus size={13} /></button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPref('preferences', 'studyTypes', [...STUDY_TYPES])}>Reset</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const { profile } = useData();
  const setPref = usePref();
  const toast = useToast();
  const n = profile.notifications;
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');

  const enableBrowser = async (on) => {
    if (!on) return setPref('notifications', 'browser', false);
    if (!supported) return toast('This browser doesn’t support notifications', 'critical');
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') setPref('notifications', 'browser', true);
    else toast('Permission was not granted — you can allow it in your browser settings', 'info');
  };

  return (
    <div className="grid-2">
      <Card title="Reminders" icon={Bell} sub="In-app reminders appear under the bell icon">
        <ToggleRow title="Reminders enabled" checked={n.enabled !== false} onChange={(v) => setPref('notifications', 'enabled', v)} />
        <ToggleRow title="Task due / overdue" checked={n.tasks !== false} onChange={(v) => setPref('notifications', 'tasks', v)} />
        <ToggleRow title="Goal milestones & goals behind schedule" checked={n.goals !== false} onChange={(v) => setPref('notifications', 'goals', v)} />
        <ToggleRow title="Attendance risk" checked={n.attendance !== false} onChange={(v) => setPref('notifications', 'attendance', v)} />
        <ToggleRow title="Daily log reminder" checked={n.dailyLog !== false} onChange={(v) => setPref('notifications', 'dailyLog', v)} />
        <ToggleRow title="Daily study goal reminder (after 6 pm)" checked={n.studyGoal !== false} onChange={(v) => setPref('notifications', 'studyGoal', v)} />
      </Card>
      <div className="stack">
        <Card title="Timing">
          <div className="form-grid">
            <NumberField label="Remind about assignments (days before)" value={n.assignmentsDays} onChange={(v) => setPref('notifications', 'assignmentsDays', v ?? 0)} min={0} max={30} step={1} />
            <NumberField label="Remind about exams (days before)" value={n.examsDays} onChange={(v) => setPref('notifications', 'examsDays', v ?? 0)} min={0} max={60} step={1} />
            <NumberField label="Daily log reminder from (hour, 0–23)" value={n.dailyLogHour} onChange={(v) => setPref('notifications', 'dailyLogHour', v ?? 20)} min={0} max={23} step={1} />
          </div>
        </Card>
        <Card title="Browser notifications" icon={BellRing} sub="Pop-up alerts for urgent reminders while LifeOS is open in a tab">
          <ToggleRow title="Show browser notifications" description={perm === 'denied' ? 'Blocked in browser settings' : perm === 'unsupported' ? 'Not supported in this browser' : undefined} checked={Boolean(n.browser) && perm === 'granted'} onChange={enableBrowser} />
        </Card>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { profile } = useData();
  const setPref = usePref();
  const prefs = profile.preferences;
  const ACCENTS = [
    ['blue', '#5b8cff'],
    ['violet', '#9a7dff'],
    ['teal', '#2ec4b6'],
    ['amber', '#f2a93b'],
    ['rose', '#f06292'],
  ];
  return (
    <Card title="Appearance">
      <div className="stack">
        <div className="row wrap between">
          <div>
            <div className="strong">Theme</div>
            <div className="small muted">System follows your device setting</div>
          </div>
          <Segmented label="Theme" value={prefs.theme} onChange={(v) => setPref('preferences', 'theme', v)} options={[{ value: 'system', label: <span className="row-sm"><Monitor size={13} /> System</span> }, { value: 'dark', label: <span className="row-sm"><Moon size={13} /> Dark</span> }, { value: 'light', label: <span className="row-sm"><Sun size={13} /> Light</span> }]} />
        </div>
        <div className="row wrap between">
          <div>
            <div className="strong">Accent colour</div>
            <div className="small muted">Buttons, highlights and the 3D core</div>
          </div>
          <div className="row-sm">
            {ACCENTS.map(([k, c]) => (
              <button key={k} type="button" aria-label={`${k} accent`} aria-pressed={prefs.accent === k} onClick={() => setPref('preferences', 'accent', k)} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: prefs.accent === k ? '3px solid var(--text)' : '3px solid transparent', outline: '1px solid var(--border)' }} />
            ))}
          </div>
        </div>
        <ToggleRow title="Reduce motion" description="Stops orbit rotation and animations" checked={prefs.reduceMotion} onChange={(v) => setPref('preferences', 'reduceMotion', v)} />
      </div>
    </Card>
  );
}
