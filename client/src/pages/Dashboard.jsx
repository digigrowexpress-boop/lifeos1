import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  GraduationCap,
  HeartPulse,
  History,
  ListChecks,
  NotebookPen,
  PenLine,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { Card, Empty } from '../components/ui/Card.jsx';
import { PaceBadge, ProgressBar, Ring, StateChip, ToneIcon, toneColor, scoreTone } from '../components/ui/Indicators.jsx';
import { ChartTooltip, axisProps, gridProps, BAR_RADIUS } from '../components/charts/ChartKit.jsx';
import { OrbitView } from '../components/three/OrbitView.jsx';
import { fmtDuration, fmtGpa, fmtPct, isNum } from '../lib/format.js';
import { fmtDate, fmtShort, relativeDay, subDaysISO } from '../lib/dates.js';
import { dailySeries } from '../logic/study.js';
import { buildTimeline } from '../logic/timeline.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const FOCUS_ICON = { task: ListChecks, assignment: ClipboardCheck, study: BookOpen, exam: PenLine, log: NotebookPen };

function Metric({ label, value, unit, foot, chip }) {
  return (
    <div className="metric-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="stat-foot">
        {chip}
        {foot}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, profile, analysis: a, today, update } = useData();
  const openForm = useQuickForms();
  const navigate = useNavigate();
  const [selectedArea, setSelectedArea] = useState(null);
  const prefs = profile.preferences;
  const widgets = prefs.dashboardWidgets || {};
  const mod = prefs.modules || {};
  const dec = profile.grading.decimals ?? 2;
  const tf = prefs.timeFormat;
  const cur = a.current;

  const studySeries = useMemo(
    () => dailySeries(data.studySessions, subDaysISO(today, 13), today).map((d) => ({ ...d, hours: d.minutes / 60, label: fmtShort(d.date) })),
    [data.studySessions, today]
  );
  const activity = useMemo(() => buildTimeline(a, data, profile).slice(0, 6), [a, data, profile]);

  const cgpaConfirmed = a.cumulative.confirmed.cgpa;
  const cgpaProjected = a.cumulative.projected.cgpa;
  const sgpa = cur?.effectiveSgpa;
  const sgpaState = cur?.status === 'official' ? 'official' : cur?.status === 'confirmed' ? 'confirmed' : 'projected';
  const activeGoals = a.goals.filter((g) => g.goal.status === 'active');
  const area = a.areas.find((x) => x.key === selectedArea);
  const ls = a.lifestyle.summary;

  return (
    <div>
      <section className="hero">
        <div className="card glow hero-greeting">
          <div className="row between wrap">
            <div>
              <div className="small muted">{fmtDate(today, 'EEEE, d MMMM yyyy')}</div>
              <h1 className="mt-sm">
                {greeting()}
                {profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-2 mt-sm">
                {[a.currentSemester?.name, profile.university?.program || profile.university?.degree, profile.university?.name].filter(Boolean).join(' · ') || 'Add your current semester to get started'}
              </p>
            </div>
            <div className="row-sm">
              <button type="button" className="btn btn-sm" onClick={() => openForm('study')}>
                <BookOpen size={14} /> Log study
              </button>
              <Link className="btn btn-sm" to="/logbook">
                <NotebookPen size={14} /> Today’s log
              </Link>
            </div>
          </div>

          <div className="hero-metrics">
            <Metric
              label="Current CGPA"
              value={fmtGpa(cgpaConfirmed ?? cgpaProjected, dec)}
              chip={cgpaConfirmed != null ? <StateChip state="confirmed" /> : cgpaProjected != null ? <StateChip state="projected" /> : null}
              foot={profile.targets?.cgpa ? `Target ${profile.targets.cgpa}` : ''}
            />
            <Metric
              label={`SGPA · ${a.currentSemester?.name || '—'}`}
              value={fmtGpa(sgpa, dec)}
              chip={isNum(sgpa) ? <StateChip state={sgpaState} /> : null}
              foot={a.targets.sgpaTarget ? `Target ${a.targets.sgpaTarget}` : ''}
            />
            <Metric
              label="Projected CGPA"
              value={fmtGpa(cgpaProjected, dec)}
              chip={cgpaProjected != null && cur?.status === 'in-progress' ? <StateChip state="projected" label="Estimate" /> : null}
              foot={a.predictions.cgpa?.low != null ? `${fmtGpa(a.predictions.cgpa.low, 2)}–${fmtGpa(a.predictions.cgpa.high, 2)}` : ''}
            />
            <Metric
              label="Studied today"
              value={fmtDuration(a.study.today, tf)}
              foot={a.study.dailyTargetMin ? `of ${fmtDuration(a.study.dailyTargetMin, tf)} target` : ''}
            />
            <Metric label="This week" value={fmtDuration(a.study.thisWeek, tf)} foot={a.study.weeklyTargetMin ? `of ${fmtDuration(a.study.weeklyTargetMin, tf)}` : `${a.study.streak.current}-day streak`} />
            {mod.attendance !== false ? (
              <Metric
                label="Attendance"
                value={a.attendance.overall.total ? fmtPct(a.attendance.overall.percent) : '—'}
                foot={a.attendance.overall.total ? `${a.attendance.overall.present}/${a.attendance.overall.total} classes` : 'No records yet'}
              />
            ) : (
              <Metric label="Goals on track" value={`${activeGoals.length - a.goalsOverview.behind}/${activeGoals.length}`} />
            )}
          </div>
        </div>

        {widgets.orbit !== false && mod.orbit !== false ? (
          <div className="card flush" style={{ overflow: 'hidden' }}>
            <OrbitView areas={a.areas} selected={selectedArea} onSelect={setSelectedArea} height={300} compact reduceMotion={prefs.reduceMotion} themeKey={`${prefs.theme}-${prefs.accent}`} />
            <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)' }}>
              {area ? (
                <div className="row between">
                  <div className="row-sm">
                    <span style={{ color: toneColor(area.tone) }}>
                      <ToneIcon tone={area.tone} />
                    </span>
                    <div>
                      <div className="strong">{area.label} · {area.headline}</div>
                      <div className="small muted">{area.sub}</div>
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => navigate(area.to)}>
                    Open <ArrowRight size={13} />
                  </button>
                </div>
              ) : (
                <div className="row between">
                  <span className="small muted">Select a planet to inspect an area of your life.</span>
                  <Link to="/orbit" className="card-link">
                    Full 3D view <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Card title="Life areas" icon={Activity}>
            <div className="stack-sm">
              {a.areas.map((x) => (
                <Link key={x.key} to={x.to} className="row between" style={{ color: 'var(--text)' }}>
                  <span className="row-sm">
                    <span className={`tone-dot tone-${x.tone}`} style={{ background: 'var(--tone)' }} />
                    {x.label}
                  </span>
                  <span className="small muted">{x.headline}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>

      <div className="dash-grid">
        {widgets.focus !== false && (
          <Card title="Recommended for today" icon={Zap} sub="Built from deadlines, exams and where effort pays most">
            {a.focus.length === 0 ? (
              <Empty icon={CheckCircle2} title="You’re clear for today">Add subjects, tasks or deadlines and LifeOS will plan your day.</Empty>
            ) : (
              <div>
                {a.focus.slice(0, 7).map((f) => {
                  const Icon = FOCUS_ICON[f.kind] || Zap;
                  return (
                    <div key={f.id} className="focus-item">
                      {f.taskId ? (
                        <button
                          type="button"
                          className="icon-btn sm"
                          aria-label={`Mark ${f.title} done`}
                          onClick={() => update('tasks', f.taskId, { status: 'done', completedAt: today })}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      ) : (
                        <span className="list-icon" style={{ width: 28, height: 28 }}>
                          <Icon size={14} aria-hidden />
                        </span>
                      )}
                      <Link to={f.to} className="grow" style={{ color: 'var(--text)', minWidth: 0 }}>
                        <div className="truncate strong small">{f.title}</div>
                        <div className="truncate tiny muted">{f.detail}</div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {widgets.academics !== false && (
          <Card className="w8" title="Academic status" icon={GraduationCap} link={{ to: '/targets', label: 'Targets' }} sub={cur ? `${cur.semester.name} · ${cur.totalCredits} credits · ${Math.round((cur.confidence || 0) * 100)}% of marks assessed` : undefined}>
            {!cur || !cur.subjects.length ? (
              <Empty icon={GraduationCap} title="No subjects yet" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => openForm('subject')}><Plus size={14} /> Add subject</button>}>
                Add your subjects and credits to see SGPA projections, risks and targets.
              </Empty>
            ) : (
              <div className="grid-2">
                <div className="stack-sm">
                  {isNum(a.targets.sgpaTarget) && isNum(cur.projectedSgpa) && (
                    <div className="stack-xs">
                      <div className="row between small">
                        <span className="text-2">
                          Projected SGPA <b style={{ color: 'var(--text)' }}>{fmtGpa(cur.projectedSgpa, dec)}</b> vs target {a.targets.sgpaTarget}
                        </span>
                        {cur.projectedSgpa >= a.targets.sgpaTarget ? <span className="badge badge-good"><TrendingUp size={12} /> On track</span> : <span className="badge badge-warning"><TrendingDown size={12} /> Gap {(a.targets.sgpaTarget - cur.projectedSgpa).toFixed(2)}</span>}
                      </div>
                      <ProgressBar value={cur.projectedSgpa} max={profile.grading.maxPoint} marker={(a.targets.sgpaTarget / profile.grading.maxPoint) * 100} label="Projected SGPA vs target" />
                      {a.targets.uniform?.status === 'reachable' && (
                        <div className="tiny muted">Needs ≈{fmtPct(a.targets.uniform.percent)} on all remaining assessments (estimate).</div>
                      )}
                    </div>
                  )}
                  <div className="field-label mt-sm">Subjects (projected %, target marker)</div>
                  {a.subjectStats.map((s) => (
                    <Link key={s.subject.id} to={`/academics/subjects/${s.subject.id}`} className="stack-xs" style={{ color: 'var(--text)' }}>
                      <div className="row between small">
                        <span className="truncate">
                          <span className="swatch" style={{ background: s.subject.color || 'var(--accent)', marginRight: 6 }} />
                          {s.subject.code || s.subject.name} <span className="muted">· {s.credits} cr</span>
                        </span>
                        <span className="row-sm">
                          <b>{s.grade?.grade ?? '—'}</b>
                          <span className="muted tabular">{fmtPct(s.percent)}</span>
                        </span>
                      </div>
                      <ProgressBar value={s.percent ?? 0} size="thin" tone={scoreTone(s.percent == null ? null : s.percent >= (s.targetPercent ?? 75) ? 80 : s.percent >= 50 ? 60 : 40)} marker={s.targetPercent} />
                    </Link>
                  ))}
                </div>
                <div className="stack-sm">
                  {widgets.subjects !== false && (
                    <>
                      <div className="field-label">Strong subjects</div>
                      {a.strong.length ? (
                        a.strong.map((s) => (
                          <div key={s.subject.id} className="row-sm small">
                            <span className="badge badge-good"><TrendingUp size={12} />{s.grade?.grade}</span>
                            <span className="truncate">{s.subject.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="small muted">Not enough marks yet.</div>
                      )}
                      <div className="field-label mt-sm">Needs attention</div>
                      {a.weak.length ? (
                        a.weak.map((s) => (
                          <div key={s.subject.id} className="row-sm small">
                            <span className="badge badge-warning"><TrendingDown size={12} />{s.grade?.grade}</span>
                            <span className="truncate">{s.subject.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="small muted">No weak subjects detected.</div>
                      )}
                    </>
                  )}
                  <div className="field-label mt-sm">Risk areas</div>
                  {a.predictions.subjects.filter((r) => r.level !== 'low').length === 0 ? (
                    <div className="small muted">No academic risks detected from current data.</div>
                  ) : (
                    a.predictions.subjects
                      .filter((r) => r.level !== 'low')
                      .slice(0, 4)
                      .map((r) => (
                        <div key={r.unit.key} className="row-sm small row-top">
                          <span style={{ color: toneColor(r.level === 'high' ? 'critical' : 'warning') }}>
                            <ToneIcon tone={r.level === 'high' ? 'critical' : 'warning'} size={14} />
                          </span>
                          <span>
                            <b>{r.subject.code || r.subject.name}</b> <span className="text-2">{r.reason}</span>
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {widgets.study !== false && (
          <Card title="Study hours" icon={BookOpen} link={{ to: '/study', label: 'Tracker' }} sub={`Last 14 days · ${fmtDuration(a.study.last7, tf)} this past week`}>
            <div style={{ height: 170 }}>
              <ResponsiveContainer>
                <BarChart data={studySeries} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} interval={2} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip formatter={(v) => fmtDuration(v * 60, tf)} />} />
                  {a.study.dailyTargetMin > 0 && <ReferenceLine y={a.study.dailyTargetMin / 60} stroke="var(--muted)" strokeDasharray="4 4" />}
                  <Bar dataKey="hours" name="Study" fill="var(--series-1)" radius={BAR_RADIUS} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="row between small mt-sm">
              <span className="text-2">
                Streak <b>{a.study.streak.current}d</b> · best {a.study.streak.longest}d
              </span>
              <span className="text-2">Consistency {fmtPct(a.study.consistency14)}</span>
            </div>
          </Card>
        )}

        {widgets.goals !== false && (
          <Card title="Goals" icon={Target} link={{ to: '/goals', label: 'All goals' }} sub={activeGoals.length ? `${activeGoals.length} active · avg ${fmtPct(a.goalsOverview.avgPercent)} complete` : undefined}>
            {activeGoals.length === 0 ? (
              <Empty icon={Target} title="No active goals" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => openForm('goal')}><Plus size={14} /> New goal</button>} />
            ) : (
              <div className="stack">
                {activeGoals.slice(0, 4).map((g) => (
                  <Link key={g.goal.id} to={`/goals/${g.goal.id}`} className="stack-xs" style={{ color: 'var(--text)' }}>
                    <div className="row between small">
                      <span className="strong truncate">{g.goal.title}</span>
                      <PaceBadge pace={g.pace} />
                    </div>
                    <ProgressBar value={g.percent} marker={g.expected} tone={g.pace === 'at-risk' || g.pace === 'overdue' ? 'critical' : g.pace === 'behind' ? 'warning' : undefined} />
                    <div className="tiny muted row between">
                      <span>{Math.round(g.percent)}%{g.daysLeft != null ? ` · ${g.daysLeft >= 0 ? `${g.daysLeft} days left` : 'past target date'}` : ''}</span>
                      {g.likelihood && <span>Likelihood: {g.likelihood} (est.)</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {widgets.deadlines !== false && (mod.assignments !== false || mod.exams !== false) && (
          <Card title="Deadlines & exams" icon={CalendarCheck} link={{ to: '/assignments', label: 'Submissions' }}>
            {a.upcomingAssignments.length === 0 && a.upcomingExams.length === 0 ? (
              <Empty icon={CheckCircle2} title="Nothing pending">No open submissions or upcoming exams.</Empty>
            ) : (
              <div className="list">
                {[
                  ...(mod.exams !== false ? a.upcomingExams.slice(0, 3).map((e) => ({ id: e.id, kind: 'exam', title: e.title, date: e.date, sub: `${a.subjectById[e.subjectId]?.code || e.type} · prep ${e.preparation || 0}%`, to: '/exams' })) : []),
                  ...(mod.assignments !== false ? a.upcomingAssignments.slice(0, 5).map((x) => ({ id: x.id, kind: 'asg', title: x.title, date: x.dueDate, sub: `${a.subjectById[x.subjectId]?.code || 'Submission'} · ${x.status.replace('-', ' ')}`, to: '/assignments' })) : []),
                ]
                  .sort((x, y) => x.date.localeCompare(y.date))
                  .slice(0, 6)
                  .map((it) => {
                    const overdue = it.date < today;
                    const soon = !overdue && it.date <= subDaysISO(today, -2);
                    const tone = overdue ? 'critical' : soon ? 'warning' : 'info';
                    return (
                      <Link key={`${it.kind}-${it.id}`} to={it.to} className="list-item" style={{ color: 'var(--text)' }}>
                        <span className="list-icon" style={{ '--tone': toneColor(tone) }}>
                          {it.kind === 'exam' ? <PenLine size={15} /> : <ClipboardCheck size={15} />}
                        </span>
                        <div className="li-main">
                          <div className="li-title small">{it.title}</div>
                          <div className="li-sub">{it.sub}</div>
                        </div>
                        <span className={`badge ${overdue ? 'badge-critical' : soon ? 'badge-warning' : ''}`}>{relativeDay(it.date, today)}</span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </Card>
        )}

        {widgets.attendance !== false && mod.attendance !== false && (
          <Card title="Attendance" icon={CalendarCheck} link={{ to: '/attendance', label: 'Mark today' }}>
            {a.attendance.overall.total === 0 ? (
              <Empty icon={CalendarCheck} title="No attendance yet">Mark lectures you attend to track subject-wise attendance and risk.</Empty>
            ) : (
              <div className="row row-top" style={{ gap: 16 }}>
                <Ring value={a.attendance.overall.percent} size={92} stroke={9} color={toneColor(a.attendance.overall.risk === 'safe' ? 'good' : a.attendance.overall.risk)} label={`Overall attendance ${fmtPct(a.attendance.overall.percent)}`}>
                  <div>
                    <div className="strong" style={{ fontSize: 18 }}>{fmtPct(a.attendance.overall.percent)}</div>
                    <div className="tiny muted">overall</div>
                  </div>
                </Ring>
                <div className="grow stack-xs">
                  {a.attendance.bySubject
                    .filter((s) => s.total)
                    .sort((x, y) => x.percent - y.percent)
                    .slice(0, 5)
                    .map((s) => (
                      <div key={s.subject.id} className="row between small">
                        <span className="truncate">{s.subject.code || s.subject.name}</span>
                        <span className="row-sm">
                          <span className="tabular">{fmtPct(s.percent)}</span>
                          {s.risk !== 'safe' && <span style={{ color: toneColor(s.risk) }}><ToneIcon tone={s.risk} size={13} /></span>}
                        </span>
                      </div>
                    ))}
                  <div className="tiny muted mt-sm">Requirement {a.attendance.threshold}%</div>
                </div>
              </div>
            )}
          </Card>
        )}

        {widgets.lifestyle !== false && mod.lifestyle !== false && (
          <Card title="Lifestyle · last 7 days" icon={HeartPulse} link={{ to: '/lifestyle', label: 'Trends' }}>
            {a.lifestyle.summary.daysLogged7 === 0 ? (
              <Empty icon={HeartPulse} title="Nothing logged this week" action={<Link className="btn btn-sm" to="/logbook">Open logbook</Link>}>Log sleep, screen time and exercise to see patterns.</Empty>
            ) : (
              <div className="stack-sm">
                {[
                  ['Sleep', ls.last7.sleep, prefs.sleepTargetHours, 'h', 'higher'],
                  ['Screen time', ls.last7.screen, prefs.screenLimitHours, 'h', 'lower'],
                  ['Social media', ls.last7.social, prefs.socialLimitHours, 'h', 'lower'],
                  ['Exercise', ls.last7.exercise, prefs.exerciseTargetMin, 'min', 'higher'],
                ].map(([label, value, target, unit, better]) => {
                  const ok = value == null ? null : better === 'higher' ? value >= target * 0.9 : value <= target;
                  return (
                    <div key={label} className="stack-xs">
                      <div className="row between small">
                        <span className="text-2">{label}</span>
                        <span className="row-sm">
                          <b className="tabular">{value == null ? '—' : `${value.toFixed(1)}${unit}`}</b>
                          <span className="tiny muted">/ {better === 'higher' ? 'target' : 'limit'} {target}{unit}</span>
                        </span>
                      </div>
                      <ProgressBar value={value ?? 0} max={Math.max(target * 1.5, value ?? 0)} size="thin" tone={ok == null ? undefined : ok ? 'good' : 'warning'} marker={(target / Math.max(target * 1.5, value ?? 0)) * 100} />
                    </div>
                  );
                })}
                <div className="tiny muted">{ls.daysLogged7} of 7 days logged</div>
              </div>
            )}
          </Card>
        )}

        {widgets.insights !== false && (
          <Card className="w8" title="Insights" icon={Sparkles} action={<Link to="/coach" className="card-link">Ask AI Coach <ArrowRight size={13} aria-hidden /></Link>} link={{ to: '/insights', label: 'All insights' }} sub="Generated from your recorded data — estimates are labelled">
            {a.insights.length === 0 ? (
              <Empty icon={Sparkles} title="Insights will appear as you add data">Add marks, study sessions and logs — LifeOS will surface what matters.</Empty>
            ) : (
              <div>
                {a.insights.slice(0, 5).map((i) => (
                  <div key={i.id} className="insight">
                    <span className="insight-icon" style={{ '--tone': toneColor(i.severity) }}>
                      <ToneIcon tone={i.severity} />
                    </span>
                    <div className="grow">
                      <div className="insight-title">{i.title}</div>
                      <div className="insight-detail">{i.detail}</div>
                    </div>
                    {i.action && (
                      <Link to={i.action.to} className="btn btn-ghost btn-sm hide-mobile">
                        {i.action.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {widgets.achievements !== false && (
          <Card title="Recent achievements" icon={Award}>
            {a.achievements.earned.length === 0 ? (
              <Empty icon={Award} title="First badge is close">Study 10 hours or log 7 days to earn your first achievement.</Empty>
            ) : (
              <div className="list">
                {a.achievements.earned.slice(0, 4).map((x) => (
                  <div key={x.id} className="list-item">
                    <span className="list-icon" style={{ '--tone': 'var(--warning)' }}>
                      <Award size={15} />
                    </span>
                    <div className="li-main">
                      <div className="li-title small">{x.title}</div>
                      <div className="li-sub">{x.detail}</div>
                    </div>
                    <span className="tiny muted nowrap">{fmtShort(x.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {widgets.activity !== false && (
          <Card title="Recent activity" icon={History} link={{ to: '/timeline', label: 'Timeline' }}>
            {activity.length === 0 ? (
              <Empty icon={History} title="No activity yet" />
            ) : (
              <div className="list">
                {activity.map((x) => (
                  <div key={x.id} className="list-item">
                    <div className="li-main">
                      <div className="li-title small">{x.title}</div>
                      <div className="li-sub">{x.detail}</div>
                    </div>
                    <span className="tiny muted nowrap">{relativeDay(x.date, today)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card title="Quick actions" icon={Crosshair} className="w4">
          <div className="grid-2" style={{ gap: 8 }}>
            {[
              ['study', 'Log study', BookOpen],
              ['marks', 'Enter marks', GraduationCap],
              ['assignment', 'Add submission', ClipboardCheck],
              ['exam', 'Add exam', PenLine],
              ['task', 'Add task', ListChecks],
              ['goal', 'New goal', Target],
            ].map(([kind, label, Icon]) => (
              <button key={kind} type="button" className="btn btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => openForm(kind)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
