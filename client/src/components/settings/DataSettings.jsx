import { useRef, useState } from 'react';
import { Cloud, Database, Download, HardDrive, KeyRound, LogOut, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { useSession } from '../../store/session.jsx';
import { useConfirm, useToast } from '../ui/Feedback.jsx';
import { Callout, Card } from '../ui/Card.jsx';
import { Segmented, TextField, ToggleRow } from '../ui/Fields.jsx';
import { COLLECTIONS, COLLECTION_LABELS } from '../../lib/collections.js';
import { downloadFile } from '../../lib/format.js';
import { todayISO } from '../../lib/dates.js';

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\n');
}

export function DataSettings() {
  const { data, profile, saveProfile, exportData, importData, wipeData, mode, adapter, user } = useData();
  const session = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [importMode, setImportMode] = useState('merge');
  const [csvCol, setCsvCol] = useState('studySessions');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [delPw, setDelPw] = useState('');
  const [busy, setBusy] = useState(false);
  const counts = COLLECTIONS.map((c) => [c, data[c].length]);

  const exportJson = async () => {
    try {
      const payload = await exportData();
      downloadFile(`lifeos-export-${todayISO()}.json`, JSON.stringify(payload, null, 2));
      toast('Export downloaded');
    } catch (e) {
      toast(e.message, 'critical');
    }
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const ok = await confirm({
        title: importMode === 'replace' ? 'Replace all your data with this file?' : 'Merge this file into your data?',
        message: importMode === 'replace' ? 'Everything currently stored is deleted first, including your settings. This cannot be undone — export first if unsure.' : 'Records from the file are added alongside your existing records.',
        confirmLabel: importMode === 'replace' ? 'Replace everything' : 'Merge',
        danger: importMode === 'replace',
        requireText: importMode === 'replace' ? 'replace' : undefined,
      });
      if (!ok) return;
      setBusy(true);
      await importData(payload, importMode);
      toast('Import complete');
    } catch (e) {
      toast(e.message || 'Could not import this file', 'critical');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const wipe = async () => {
    const ok = await confirm({ title: 'Delete all tracked data?', message: 'Semesters, subjects, marks, study sessions, logs, attendance, assignments, exams, goals, tasks and history are permanently deleted. Your account and settings stay.', confirmLabel: 'Delete all data', danger: true, requireText: 'delete' });
    if (!ok) return;
    await wipeData();
    await saveProfile((p) => ({ ...p, currentSemesterId: null }));
    toast('All tracked data deleted');
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await adapter.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      toast('Password changed');
    } catch (err) {
      toast(err.message, 'critical');
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: mode === 'cloud' ? 'Delete your account permanently?' : 'Delete this device workspace?',
      message: mode === 'cloud' ? 'Your account and every record are permanently erased from the database. This cannot be undone.' : 'All LifeOS data in this browser is erased. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      danger: true,
      requireText: 'delete',
    });
    if (!ok) return;
    try {
      await adapter.deleteAccount(delPw);
      session.forget();
    } catch (err) {
      toast(err.message, 'critical');
    }
  };

  return (
    <div className="stack">
      <div className="grid-2">
        <Card title="Your data" icon={Database}>
          <div className="stack-sm">
            <Callout tone="info" icon={mode === 'cloud' ? Cloud : HardDrive}>
              {mode === 'cloud' ? (
                <>Stored in your LifeOS account ({user?.email}) on the LifeOS server’s MongoDB database, accessible only with your login.</>
              ) : (
                <>Stored only in this browser on this device. Clearing browser data removes it — export regularly or move to a cloud account.</>
              )}
            </Callout>
            <div className="small text-2">
              LifeOS stores only what you enter: your profile and grading rules, academic records (semesters, subjects, marks, attendance, assignments, exams), study sessions, goals and tasks, daily logs and a history of key events. It is used to calculate your results, analytics, predictions and recommendations — nothing is sold and there are no third-party trackers. The only data that leaves LifeOS is the summary the optional AI Coach sends to the AI provider when you ask it something (off until you enable it).
            </div>
            <table className="table">
              <tbody>
                {counts.map(([c, n]) => (
                  <tr key={c}>
                    <td className="small">{COLLECTION_LABELS[c]}</td>
                    <td className="num small">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Privacy" icon={ShieldCheck}>
            <ToggleRow title="Use lifestyle data in insights" description="Sleep, screen time and social media patterns in recommendations" checked={profile.privacy?.useLifestyleInInsights !== false} onChange={(v) => saveProfile((p) => ({ ...p, privacy: { ...p.privacy, useLifestyleInInsights: v } }))} />
            <ToggleRow title="AI Coach" description="Lets the coach send a summary of your data (never your name, email or notes) to the AI provider when you ask a question" checked={Boolean(profile.privacy?.aiConsent)} onChange={(v) => saveProfile((p) => ({ ...p, privacy: { ...p.privacy, aiConsent: v } }))} />
            <ToggleRow title="Include lifestyle averages in AI summaries" checked={profile.privacy?.aiIncludeLifestyle !== false} onChange={(v) => saveProfile((p) => ({ ...p, privacy: { ...p.privacy, aiIncludeLifestyle: v } }))} />
          </Card>
          <Card title="Export" icon={Download} sub="Your data, any time, in open formats">
            <div className="stack-sm">
              <button type="button" className="btn" onClick={exportJson}><Download size={15} /> Export everything (JSON)</button>
              <div className="row-sm">
                <select className="select sm grow" value={csvCol} onChange={(e) => setCsvCol(e.target.value)} aria-label="Collection to export">
                  {COLLECTIONS.map((c) => <option key={c} value={c}>{COLLECTION_LABELS[c]}</option>)}
                </select>
                <button type="button" className="btn btn-sm" disabled={!data[csvCol].length} onClick={() => downloadFile(`lifeos-${csvCol}-${todayISO()}.csv`, toCsv(data[csvCol]), 'text/csv')}>
                  <Download size={13} /> CSV
                </button>
              </div>
            </div>
          </Card>
          <Card title="Import" icon={Upload} sub="Restore or move data from a LifeOS JSON export">
            <div className="row wrap">
              <Segmented label="Import mode" value={importMode} onChange={setImportMode} options={[{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace everything' }]} />
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={13} /> {busy ? 'Importing…' : 'Choose file'}</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
            </div>
            {mode === 'device' && <p className="small muted mt-sm">To move to the cloud: export here, sign out, create an account, then import the file with “Replace everything”.</p>}
          </Card>
        </div>
      </div>

      <div className="grid-2">
        <Card title="Account" icon={KeyRound}>
          <div className="stack">
            <div className="small text-2">{mode === 'cloud' ? `Signed in as ${user?.email}` : 'Device mode — no account'}</div>
            {mode === 'cloud' && (
              <form className="form-grid" onSubmit={changePassword}>
                <TextField label="Current password" type="password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} autoComplete="current-password" required />
                <TextField label="New password" type="password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" minLength={8} required hint="At least 8 characters" />
                <div className="full"><button type="submit" className="btn btn-sm">Change password</button></div>
              </form>
            )}
            <button type="button" className="btn" onClick={session.logout}><LogOut size={15} /> Sign out</button>
          </div>
        </Card>
        <Card title="Danger zone" icon={Trash2}>
          <div className="stack">
            <div className="row between wrap">
              <div>
                <div className="strong">Delete all tracked data</div>
                <div className="small muted">Keeps your account and settings</div>
              </div>
              <button type="button" className="btn btn-danger" onClick={wipe}>Delete data</button>
            </div>
            <div className="divider" style={{ margin: 0 }} />
            <div className="stack-sm">
              <div>
                <div className="strong">{mode === 'cloud' ? 'Delete account' : 'Delete device workspace'}</div>
                <div className="small muted">Permanently erases everything</div>
              </div>
              {mode === 'cloud' && <TextField label="Password" type="password" value={delPw} onChange={setDelPw} autoComplete="current-password" />}
              <div><button type="button" className="btn btn-danger" disabled={mode === 'cloud' && !delPw} onClick={deleteAccount}>Delete permanently</button></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
