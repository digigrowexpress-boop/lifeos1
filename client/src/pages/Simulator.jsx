import { useMemo, useState } from 'react';
import { ArrowRight, FlaskConical, RotateCcw, Wand2 } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Card, Empty, PageHeader } from '../components/ui/Card.jsx';
import { StateChip, ToneBadge } from '../components/ui/Indicators.jsx';
import { SelectField, Check } from '../components/ui/Fields.jsx';
import { evaluateCumulative, evaluateSemester, compareSemesters } from '../logic/academics.js';
import { fmtGpa, fmtPct, isNum } from '../lib/format.js';

function Delta({ from, to, dec = 2 }) {
  if (!isNum(from) || !isNum(to)) return null;
  const d = to - from;
  if (Math.abs(d) < 0.005) return <span className="tiny muted">no change</span>;
  return <span className={`tiny strong ${d > 0 ? 'delta-up' : 'delta-down'}`}>{d > 0 ? '+' : ''}{d.toFixed(dec)}</span>;
}

export default function Simulator() {
  const { data, profile, analysis: a } = useData();
  const grading = profile.grading;
  const dec = grading.decimals ?? 2;
  const [semId, setSemId] = useState(a.currentSemester?.id || data.semesters[0]?.id || null);
  const [overrides, setOverrides] = useState({});
  const [allowConfirmed, setAllowConfirmed] = useState(false);
  const [bulk, setBulk] = useState(75);

  const semester = data.semesters.find((s) => s.id === semId);
  const subjects = data.subjects.filter((s) => s.semesterId === semId && !s.archived);

  const actual = useMemo(() => (semester ? evaluateSemester(semester, data.subjects, grading) : null), [semester, data.subjects, grading]);
  const sim = useMemo(() => (semester ? evaluateSemester(semester, data.subjects, grading, { overrides }) : null), [semester, data.subjects, grading, overrides]);
  const simCum = useMemo(() => {
    if (!sim) return null;
    return evaluateCumulative(a.semesterResults.map((r) => (r.semester.id === semId ? sim : r)), grading);
  }, [a.semesterResults, sim, semId, grading]);

  const count = Object.keys(overrides).length;
  const target = semester?.targetSgpa ?? profile.targets?.sgpa;
  const officialLocked = isNum(semester?.officialSgpa);

  const setOverride = (comp, value) => {
    setOverrides((o) => {
      const next = { ...o };
      if (value === '' || value == null) delete next[comp.id];
      else next[comp.id] = Math.max(0, Math.min(Number(comp.maxMarks), Number(value)));
      return next;
    });
  };

  const fillPending = () => {
    const next = { ...overrides };
    for (const s of subjects) {
      for (const c of s.components || []) {
        if (c.status === 'pending' || c.obtained == null) next[c.id] = Math.round(((bulk / 100) * c.maxMarks) * 10) / 10;
      }
    }
    setOverrides(next);
  };

  if (!semester) {
    return (
      <div>
        <PageHeader eyebrow="What-if" title="Academic simulator" />
        <Card>
          <Empty icon={FlaskConical} title="Add a semester with subjects to simulate scenarios" />
        </Card>
      </div>
    );
  }

  const unitsById = Object.fromEntries((sim?.units || []).map((u) => [u.key, u]));

  return (
    <div>
      <PageHeader
        eyebrow="What-if simulator"
        title="Try a scenario"
        description="Change any mark hypothetically and see the effect on grades, SGPA, CGPA and your target. Nothing here is saved or mixed with your real marks."
        actions={
          <button type="button" className="btn" onClick={() => setOverrides({})} disabled={!count}>
            <RotateCcw size={14} /> Reset ({count})
          </button>
        }
      />

      <div className="row wrap mb" style={{ gap: 16, alignItems: 'flex-end' }}>
        <SelectField label="Semester" value={semId} onChange={(v) => { setSemId(v); setOverrides({}); }} options={[...data.semesters].sort(compareSemesters).map((s) => ({ value: s.id, label: s.name }))} />
        <div className="field">
          <label className="field-label" htmlFor="bulk">Fill all pending at {bulk}%</label>
          <div className="row-sm">
            <input id="bulk" className="range" type="range" min={0} max={100} step={5} value={bulk} onChange={(e) => setBulk(Number(e.target.value))} style={{ width: 160 }} />
            <button type="button" className="btn btn-sm" onClick={fillPending}>
              <Wand2 size={14} /> Apply
            </button>
          </div>
        </div>
        <Check checked={allowConfirmed} onChange={setAllowConfirmed} label="Also let me change confirmed marks" />
        <span className="sim-badge">
          <FlaskConical size={13} /> Simulation — hypothetical only
        </span>
      </div>

      {officialLocked && (
        <div className="mb">
          <Card>
            <p className="small text-2">This semester has an official SGPA ({semester.officialSgpa}), which overrides any marks-based calculation, so scenarios won’t change its SGPA.</p>
          </Card>
        </div>
      )}

      <div className="compare mb">
        <Card>
          <div className="stat-label">SGPA</div>
          <div className="row" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="stat-value">{fmtGpa(actual?.effectiveSgpa, dec)}</span>
            <ArrowRight size={16} className="muted" />
            <span className="stat-value" style={{ color: 'var(--st-hypothetical)' }}>{fmtGpa(sim?.effectiveSgpa, dec)}</span>
            <Delta from={actual?.effectiveSgpa} to={sim?.effectiveSgpa} dec={dec} />
          </div>
          <div className="row-sm mt-sm">
            <StateChip state={actual?.status === 'in-progress' ? 'projected' : actual?.status} label="Now" />
            <StateChip state="hypothetical" label="Scenario" />
          </div>
        </Card>
        <Card>
          <div className="stat-label">CGPA (incl. this semester)</div>
          <div className="row" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="stat-value">{fmtGpa(a.cumulative.projected.cgpa, dec)}</span>
            <ArrowRight size={16} className="muted" />
            <span className="stat-value" style={{ color: 'var(--st-hypothetical)' }}>{fmtGpa(simCum?.projected.cgpa, dec)}</span>
            <Delta from={a.cumulative.projected.cgpa} to={simCum?.projected.cgpa} dec={dec} />
          </div>
          <div className="tiny muted mt-sm">Confirmed CGPA stays {fmtGpa(a.cumulative.confirmed.cgpa, dec)} — scenarios never change it.</div>
        </Card>
        <Card>
          <div className="stat-label">Target SGPA {isNum(target) ? target : '—'}</div>
          {isNum(target) ? (
            <div className="stack-sm mt-sm">
              <div className="row between small">
                <span>Now</span>
                {actual?.effectiveSgpa >= target ? <ToneBadge tone="good">Met</ToneBadge> : <ToneBadge tone="warning">Short by {(target - (actual?.effectiveSgpa || 0)).toFixed(2)}</ToneBadge>}
              </div>
              <div className="row between small">
                <span>In this scenario</span>
                {sim?.effectiveSgpa >= target ? <ToneBadge tone="good">Met</ToneBadge> : <ToneBadge tone="warning">Short by {(target - (sim?.effectiveSgpa || 0)).toFixed(2)}</ToneBadge>}
              </div>
            </div>
          ) : (
            <div className="small muted mt-sm">Set a target SGPA to compare.</div>
          )}
        </Card>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <Empty icon={FlaskConical} title="No subjects in this semester" />
        </Card>
      ) : (
        <div className="grid-2">
          {subjects.map((s) => {
            const actualUnits = actual.units.filter((u) => u.subjectId === s.id);
            return (
              <Card key={s.id} title={s.name} sub={`${s.code ? `${s.code} · ` : ''}${s.credits} credits`}>
                <div className="row wrap mb" style={{ gap: 10 }}>
                  {actualUnits.map((u) => {
                    const su = unitsById[u.key];
                    const changed = su?.grade?.grade !== u.grade?.grade;
                    return (
                      <div key={u.key} className="row-sm small">
                        {actualUnits.length > 1 && <span className="muted">{u.part}</span>}
                        <b>{u.grade?.grade ?? '—'}</b>
                        <span className="muted">({fmtPct(u.percent)})</span>
                        <ArrowRight size={12} className="muted" />
                        <b style={{ color: changed ? 'var(--st-hypothetical)' : undefined }}>{su?.grade?.grade ?? '—'}</b>
                        <span className="muted">({fmtPct(su?.percent)})</span>
                        {changed && <span className="sim-badge" style={{ padding: '0 6px' }}>changed</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Assessment</th>
                        <th>Actual</th>
                        <th className="num">What if…</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s.components || []).map((c) => {
                        const editable = allowConfirmed || c.status !== 'confirmed';
                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="small strong">{c.name}</div>
                              <div className="tiny muted">weight {c.weight}</div>
                            </td>
                            <td className="nowrap">
                              {c.status === 'pending' || c.obtained == null ? <StateChip state="pending" /> : (
                                <span className="row-sm small">
                                  {c.obtained}/{c.maxMarks} <StateChip state={c.status} />
                                </span>
                              )}
                            </td>
                            <td className="num">
                              {editable ? (
                                <div className="row-sm end">
                                  <input
                                    className={`input sm ${overrides[c.id] != null ? 'sim-input' : ''}`}
                                    type="number"
                                    min={0}
                                    max={c.maxMarks}
                                    step="any"
                                    style={{ width: 76 }}
                                    aria-label={`Hypothetical marks for ${s.name} ${c.name}`}
                                    placeholder="—"
                                    value={overrides[c.id] ?? ''}
                                    onChange={(e) => setOverride(c, e.target.value)}
                                  />
                                  <span className="tiny muted">/{c.maxMarks}</span>
                                </div>
                              ) : (
                                <span className="tiny muted">locked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
