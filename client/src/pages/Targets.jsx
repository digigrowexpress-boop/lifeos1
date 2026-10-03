import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Crosshair, Flame, GraduationCap, Info, Save, Sigma, TrendingUp } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useToast } from '../components/ui/Feedback.jsx';
import { Callout, Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { ProgressBar, StateChip, ToneBadge } from '../components/ui/Indicators.jsx';
import { NumberField } from '../components/ui/Fields.jsx';
import { cgpaRequirement, gradePlan, impactRanking, minimumGrades, subjectTargetStatus, uniformRequirement } from '../logic/targets.js';
import { fmtGpa, fmtPct, isNum } from '../lib/format.js';

export default function Targets() {
  const { data, profile, analysis: a, update, saveProfile } = useData();
  const toast = useToast();
  const grading = profile.grading;
  const dec = grading.decimals ?? 2;
  const cur = a.current;
  const [sgpaT, setSgpaT] = useState(a.targets.sgpaTarget);
  const [cgpaT, setCgpaT] = useState(a.targets.cgpaTarget);
  useEffect(() => setSgpaT(a.targets.sgpaTarget), [a.targets.sgpaTarget]);
  useEffect(() => setCgpaT(a.targets.cgpaTarget), [a.targets.cgpaTarget]);

  const calc = useMemo(() => {
    if (!cur || !cur.units.length) return null;
    const t = isNum(sgpaT) ? Number(sgpaT) : null;
    return {
      uniform: t != null ? uniformRequirement(cur.semester, data.subjects, grading, t) : null,
      plan: t != null ? gradePlan(cur, grading, t) : null,
      minimum: t != null ? minimumGrades(cur, grading, t) : [],
      impact: impactRanking(cur, grading),
    };
  }, [cur, data.subjects, grading, sgpaT]);

  const cgpaCalc = useMemo(
    () => (isNum(cgpaT) ? cgpaRequirement({ semesterResults: a.semesterResults, grading, programSemesters: profile.university?.semesterCount, target: Number(cgpaT) }) : null),
    [a.semesterResults, grading, profile.university?.semesterCount, cgpaT]
  );

  const open = cur && cur.status === 'in-progress';

  return (
    <div>
      <PageHeader
        eyebrow="Target calculator"
        title="What do I need to score?"
        description="Calculated from the marks you have entered. Expected and estimated marks are assumed to hold; pending assessments are what you can still influence."
      />

      {!cur ? (
        <Card>
          <Empty icon={Crosshair} title="Add a current semester with subjects">Targets are calculated from your subjects, credits and assessment structure.</Empty>
        </Card>
      ) : (
        <div className="stack">
          <Card title={`Target SGPA · ${cur.semester.name}`} icon={Crosshair} glow>
            <div className="grid-4">
              <div className="stack-sm">
                <NumberField label="Target SGPA" value={sgpaT} onChange={setSgpaT} min={0} max={grading.maxPoint} step={0.01} />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!isNum(sgpaT) || sgpaT === cur.semester.targetSgpa}
                  onClick={async () => {
                    await update('semesters', cur.semester.id, { targetSgpa: sgpaT });
                    toast('Saved as semester target');
                  }}
                >
                  <Save size={14} /> Save as semester target
                </button>
              </div>
              <StatTile label="Projected SGPA" value={fmtGpa(cur.projectedSgpa, dec)} foot={<StateChip state={open ? 'projected' : cur.status} label={open ? 'Estimate' : undefined} />} />
              <StatTile label="Lowest possible" value={fmtGpa(calc?.uniform?.min, dec)} foot="0% on everything pending" />
              <StatTile label="Highest possible" value={fmtGpa(calc?.uniform?.max, dec)} foot="100% on everything pending" />
            </div>
            {calc?.uniform && (
              <div className="mt">
                {calc.uniform.status === 'secured' && <Callout tone="good" icon={TrendingUp}>Target {sgpaT} is already secured by your current marks — even with zero on the remaining work.</Callout>}
                {calc.uniform.status === 'unreachable' && <Callout tone="critical" icon={AlertTriangle}>Target {sgpaT} can’t be reached this semester: the maximum possible is {fmtGpa(calc.uniform.max, dec)}. Consider a revised target or plan for CGPA over the coming semesters.</Callout>}
                {calc.uniform.status === 'reachable' && (
                  <Callout tone={calc.uniform.percent > (cur.rates?.overall ?? 0) + 10 ? 'warning' : 'info'} icon={Info}>
                    Score about <b>{fmtPct(calc.uniform.percent, 1)}</b> on <i>every</i> remaining assessment to reach SGPA {sgpaT}. Your average so far is {fmtPct(cur.rates?.overall)}. The plan below spreads the effort more efficiently by credits.
                  </Callout>
                )}
                {calc.uniform.status === 'no-data' && <Callout tone="info" icon={Info}>Add assessment components to your subjects to calculate requirements.</Callout>}
              </div>
            )}
          </Card>

          {calc?.plan && (
            <Card title="Efficient grade plan" icon={Sigma} sub={calc.plan.reached ? `Reaches SGPA ${fmtGpa(calc.plan.plannedSgpa, dec)} — the lowest-effort combination found, favouring high-credit subjects` : `Even the best combination reaches only ${fmtGpa(calc.plan.plannedSgpa, dec)}`}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th className="num">Credits</th>
                      <th>Projected</th>
                      <th>Aim for</th>
                      <th className="num">Needed on remaining</th>
                      <th className="num">Your rate</th>
                      <th>Minimum (if others max out)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.plan.rows.map((r) => {
                      const min = calc.minimum.find((m) => m.unit.key === r.unit.key);
                      const hard = r.aboveCurrentRate != null && r.aboveCurrentRate > 10;
                      return (
                        <tr key={r.unit.key}>
                          <td>
                            <Link to={`/academics/subjects/${r.unit.subjectId}`}>{r.unit.label}</Link>
                          </td>
                          <td className="num">{r.unit.credits}</td>
                          <td>{r.projectedGrade?.grade ?? '—'}</td>
                          <td>
                            <b>{r.targetGrade?.grade ?? '—'}</b> {r.upgrade > 0 && <span className="badge badge-accent">+{r.upgrade}</span>}
                            {r.locked && <span className="tiny muted"> locked</span>}
                          </td>
                          <td className="num">{r.locked ? '—' : r.requiredOnRemaining === 0 ? <span className="delta-up">Secured</span> : fmtPct(r.requiredOnRemaining)}</td>
                          <td className="num">
                            {r.unit.rateUsed != null ? fmtPct(r.unit.rateUsed) : '—'}
                            {hard && <div className="tiny" style={{ color: 'var(--warning)' }}>+{Math.round(r.aboveCurrentRate)} pts stretch</div>}
                          </td>
                          <td>{min ? (min.impossible ? <ToneBadge tone="critical">Target out of reach</ToneBadge> : min.anyPass ? <span className="muted small">Any pass</span> : <b>{min.grade?.grade}</b>) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="grid-2">
            <Card title="High-impact subjects" icon={Flame} sub="SGPA change from one grade step — credits make the difference">
              {calc?.impact?.length ? (
                <div className="stack">
                  {calc.impact.map((x) => (
                    <div key={x.unit.key} className="stack-xs">
                      <div className="row between small">
                        <span className="strong truncate">{x.unit.label}</span>
                        <span className="tabular">+{x.sgpaPerGrade.toFixed(2)} SGPA / grade</span>
                      </div>
                      <ProgressBar value={x.sgpaPerGrade} max={calc.impact[0].sgpaPerGrade || 1} size="thin" />
                      <div className="tiny muted">
                        {x.unit.credits} credits · {Math.round(x.remainingShare * 100)}% still pending
                        {x.open && x.nextGrade && x.requiredForNext != null && x.requiredForNext <= 100 ? ` · ${x.nextGrade.grade} needs ${fmtPct(x.requiredForNext)} on rest` : x.open && x.nextGrade ? ` · ${x.nextGrade.grade} no longer reachable` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="No graded subjects yet" />
              )}
            </Card>

            <Card title="Subject target grades" icon={GraduationCap} sub="Set target grades on each subject’s page">
              {a.subjectStats.length === 0 ? (
                <Empty title="No subjects" />
              ) : (
                <div className="list">
                  {a.subjectStats.map((s) => {
                    const unit = s.units.find((u) => u.part === 'combined');
                    const st = unit ? subjectTargetStatus(unit, s.subject, grading) : null;
                    return (
                      <div key={s.subject.id} className="list-item">
                        <div className="li-main">
                          <div className="li-title small">{s.subject.name}</div>
                          <div className="li-sub">
                            Now {s.grade?.grade ?? '—'} ({fmtPct(s.percent)}){st ? ` · target ${st.target.grade}` : ' · no target set'}
                          </div>
                        </div>
                        {st ? (
                          st.locked ? (
                            <ToneBadge tone={st.achieved ? 'good' : 'critical'}>{st.achieved ? 'Achieved' : 'Missed'}</ToneBadge>
                          ) : !st.feasible ? (
                            <ToneBadge tone="critical">Out of reach</ToneBadge>
                          ) : st.required === 0 ? (
                            <ToneBadge tone="good">Secured</ToneBadge>
                          ) : (
                            <span className="badge">{fmtPct(st.required)} on rest</span>
                          )
                        ) : (
                          <Link className="btn btn-ghost btn-sm" to={`/academics/subjects/${s.subject.id}`}>Set</Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Card className="mt" title="Target CGPA" icon={TrendingUp} sub={grading.cgpaMethod === 'sgpa-average' ? 'Using average of SGPAs' : 'Using credit-weighted SGPAs'}>
        <div className="grid-4">
          <div className="stack-sm">
            <NumberField label="Target CGPA" value={cgpaT} onChange={setCgpaT} min={0} max={grading.maxPoint} step={0.01} />
            <button
              type="button"
              className="btn btn-sm"
              disabled={!isNum(cgpaT) || cgpaT === profile.targets?.cgpa}
              onClick={async () => {
                await saveProfile((p) => ({ ...p, targets: { ...p.targets, cgpa: cgpaT } }));
                toast('CGPA target saved');
              }}
            >
              <Save size={14} /> Save target
            </button>
          </div>
          <StatTile label="Confirmed CGPA" value={fmtGpa(cgpaCalc?.currentCgpa ?? a.cumulative.confirmed.cgpa, dec)} foot={`${cgpaCalc?.doneCredits ?? a.cumulative.confirmed.credits} credits · ${cgpaCalc?.doneSemesters ?? a.cumulative.confirmed.count} semesters`} />
          <StatTile label="Remaining" value={cgpaCalc ? cgpaCalc.remainingSemesters : '—'} unit="semesters" foot={cgpaCalc?.remainingCredits ? `≈${Math.round(cgpaCalc.remainingCredits)} credits (est.)` : ''} />
          <StatTile
            label="Needed average SGPA"
            value={cgpaCalc?.requiredSgpa != null ? fmtGpa(Math.max(0, cgpaCalc.requiredSgpa), dec) : '—'}
            foot={
              cgpaCalc?.status === 'unreachable' ? (
                <ToneBadge tone="critical">Above max {grading.maxPoint}</ToneBadge>
              ) : cgpaCalc?.status === 'secured' ? (
                <ToneBadge tone="good">Secured</ToneBadge>
              ) : cgpaCalc?.status === 'complete' ? (
                'All semesters complete'
              ) : (
                'across remaining semesters'
              )
            }
          />
        </div>
        {cgpaCalc && cgpaCalc.status === 'reachable' && cgpaCalc.remainingSemesters > 1 && open && (
          <div className="table-wrap mt">
            <table className="table">
              <thead>
                <tr>
                  <th>If {cur.semester.name} ends at SGPA…</th>
                  <th className="num">…you then need on average</th>
                </tr>
              </thead>
              <tbody>
                {[...new Set([cur.projectedSgpa, sgpaT, cgpaCalc.requiredSgpa, grading.maxPoint * 0.9].filter(isNum).map((v) => Number(Number(v).toFixed(2))))]
                  .sort((x, y) => x - y)
                  .map((s) => {
                    const credits = cur.totalCredits || cgpaCalc.avgCredits;
                    const restCredits = cgpaCalc.remainingCredits - credits;
                    const restSem = cgpaCalc.remainingSemesters - 1;
                    const need =
                      grading.cgpaMethod === 'sgpa-average'
                        ? (cgpaT * (cgpaCalc.doneSemesters + cgpaCalc.remainingSemesters) - (cgpaCalc.currentCgpa ?? 0) * cgpaCalc.doneSemesters - s) / restSem
                        : (cgpaT * (cgpaCalc.doneCredits + cgpaCalc.remainingCredits) - (cgpaCalc.currentCgpa ?? 0) * cgpaCalc.doneCredits - s * credits) / restCredits;
                    return (
                      <tr key={s}>
                        <td>
                          {s.toFixed(2)} {Math.abs(s - cur.projectedSgpa) < 0.005 && <StateChip state="projected" label="current projection" />}
                        </td>
                        <td className="num">{need > grading.maxPoint ? <span style={{ color: 'var(--critical)' }}>{need.toFixed(2)} (not possible)</span> : need <= 0 ? 'Secured' : need.toFixed(2)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
        <p className="tiny muted mt-sm">Future semesters’ credits are estimated from your average credits per semester ({cgpaCalc ? cgpaCalc.avgCredits.toFixed(1) : '—'}). Update the total semester count in Settings.</p>
      </Card>
    </div>
  );
}
