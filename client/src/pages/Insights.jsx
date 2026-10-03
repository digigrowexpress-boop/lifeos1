import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Brain, CalendarClock, Gauge, HelpCircle, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Callout, Card, Empty, PageHeader } from '../components/ui/Card.jsx';
import { RiskBadge, StateChip, ToneIcon, toneColor } from '../components/ui/Indicators.jsx';
import { fmtDuration, fmtGpa, fmtPct, isNum, plural } from '../lib/format.js';
import { fmtDate, relativeDay } from '../lib/dates.js';
import { impactRanking } from '../logic/targets.js';
import { Info } from 'lucide-react';

const SEVERITIES = [
  { value: '', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warnings' },
  { value: 'info', label: 'Suggestions' },
  { value: 'positive', label: 'Wins' },
];

function useAnswers() {
  const { profile, analysis: a } = useData();
  const tf = profile.preferences.timeFormat;
  const dec = profile.grading.decimals ?? 2;
  return useMemo(() => {
    const cur = a.current;
    const out = [];
    const sg = cur?.effectiveSgpa;
    out.push({
      q: 'How am I performing?',
      a: isNum(sg)
        ? `${cur.status === 'in-progress' ? 'Projected' : 'Confirmed'} SGPA ${fmtGpa(sg, dec)} in ${cur.semester.name}${a.targets.sgpaTarget ? ` (target ${a.targets.sgpaTarget})` : ''}; CGPA ${fmtGpa(a.cumulative.confirmed.cgpa ?? a.cumulative.projected.cgpa, dec)}.`
        : 'Add subjects and marks to see your academic standing.',
      to: '/academics',
    });
    const up = a.insights.filter((i) => i.severity === 'positive').slice(0, 2);
    out.push({ q: 'Where am I improving?', a: up.length ? up.map((i) => i.title).join(' · ') : 'No clear improvements detected yet — keep logging.', to: '/analytics' });
    const behind = a.insights.filter((i) => i.severity === 'critical' || i.severity === 'warning').slice(0, 3);
    out.push({ q: 'Where am I falling behind?', a: behind.length ? behind.map((i) => i.title).join(' · ') : 'Nothing flagged right now.', to: '/insights' });
    out.push({ q: 'Which subject needs attention?', a: a.weak[0] ? `${a.weak[0].subject.name} — projected ${a.weak[0].grade?.grade ?? '—'} (${fmtPct(a.weak[0].percent)})${a.weak[0].targetPercent ? `, target needs ≥${a.weak[0].targetPercent}%` : ''}.` : 'No weak subjects detected.', to: a.weak[0] ? `/academics/subjects/${a.weak[0].subject.id}` : '/academics' });
    const impact = cur ? impactRanking(cur, profile.grading).filter((x) => x.open)[0] : null;
    out.push({ q: 'Which subject has the greatest impact on my SGPA?', a: impact ? `${impact.unit.label}: one grade step moves SGPA by about ${impact.sgpaPerGrade.toFixed(2)} (${impact.unit.credits} credits).` : 'Add credits and assessments to compare impact.', to: '/targets' });
    const u = a.targets.uniform;
    out.push({
      q: 'What do I need to score to reach my target?',
      a: !a.targets.sgpaTarget ? 'Set a target SGPA to calculate this.' : u?.status === 'reachable' ? `About ${fmtPct(u.percent, 1)} on every remaining assessment for SGPA ${a.targets.sgpaTarget} (estimate).` : u?.status === 'secured' ? 'Your target is already secured.' : u?.status === 'unreachable' ? `Target not reachable this semester — max possible ${fmtGpa(u.max, dec)}.` : 'Add assessment structures to calculate.',
      to: '/targets',
    });
    out.push({ q: 'How much have I studied?', a: `${fmtDuration(a.study.thisWeek, tf)} this week, ${fmtDuration(a.study.thisMonth, tf)} this month, ${fmtDuration(a.study.total, tf)} in total.`, to: '/study' });
    const alloc = a.insights.find((i) => i.id === 'allocation');
    out.push({ q: 'Am I studying the right subjects?', a: alloc ? alloc.detail : a.subjectStats.length ? 'Your study time roughly matches where you need it most.' : 'Log subject-linked study sessions to check.', to: '/study' });
    const exam = a.goals.find((g) => g.goal.status === 'active' && g.exam);
    out.push({ q: 'Am I progressing toward GATE / my competitive exam?', a: exam ? `${exam.goal.title}: ${fmtPct(exam.exam.overall, 1)} syllabus covered${exam.exam.expected != null ? ` vs ~${fmtPct(exam.exam.expected)} expected` : ''}; weakest: ${exam.exam.weakest.map((x) => x.subject.name).join(', ') || '—'}.` : 'Create a competitive-exam goal (e.g. GATE 2027) to track it.', to: exam ? `/goals/${exam.goal.id}` : '/goals' });
    const behindGoals = a.goals.filter((g) => g.goal.status === 'active' && ['behind', 'at-risk', 'overdue'].includes(g.pace));
    out.push({ q: 'Which goals are behind schedule?', a: behindGoals.length ? behindGoals.map((g) => `${g.goal.title} (${Math.round(g.percent)}%)`).join(', ') : 'None — all active goals are on pace.', to: '/goals' });
    out.push({ q: 'How consistent am I?', a: `Studied on ${fmtPct(a.study.consistency28)} of the last 28 days; current streak ${plural(a.study.streak.current, 'day')} (best ${a.study.streak.longest}).`, to: '/analytics' });
    const ls = a.lifestyle.summary;
    out.push({
      q: 'How is my lifestyle changing?',
      a: ls.daysLogged7
        ? `Sleep ${isNum(ls.last7.sleep) ? `${ls.last7.sleep.toFixed(1)}h` : '—'} (prev. week ${isNum(ls.prev7.sleep) ? `${ls.prev7.sleep.toFixed(1)}h` : '—'}), social media ${isNum(ls.last7.social) ? `${ls.last7.social.toFixed(1)}h` : '—'}/day (prev. ${isNum(ls.prev7.social) ? `${ls.prev7.social.toFixed(1)}h` : '—'}).`
        : 'Log a few days to see lifestyle changes.',
      to: '/lifestyle',
    });
    out.push({ q: 'What should I focus on today?', a: a.focus.length ? a.focus.slice(0, 3).map((f) => f.title).join(' · ') : 'Nothing urgent — a good day to get ahead.', to: '/' });
    const hist = a.cumulative.series.filter((s) => isNum(s.sgpa));
    out.push({ q: 'How has my performance changed over semesters?', a: hist.length >= 2 ? hist.map((s) => `${s.name.replace('Semester ', 'S')}: ${fmtGpa(s.sgpa, 2)}${s.sgpaStatus === 'in-progress' ? '*' : ''}`).join(' → ') + (hist.some((s) => s.sgpaStatus === 'in-progress') ? '  (*estimate)' : '') : 'Add past semester results to compare.', to: '/academics' });
    return out;
  }, [a, profile, tf, dec]);
}

export default function Insights() {
  const { profile, analysis: a, today } = useData();
  const [severity, setSeverity] = useState('');
  const [category, setCategory] = useState('');
  const answers = useAnswers();
  const p = a.predictions;
  const dec = profile.grading.decimals ?? 2;
  const tf = profile.preferences.timeFormat;
  const categories = [...new Set(a.insights.map((i) => i.category))];
  const list = a.insights.filter((i) => (!severity || i.severity === severity) && (!category || i.category === category));

  return (
    <div>
      <PageHeader eyebrow="Intelligence" title="Insights & predictions" description="Everything here is derived from the data you recorded. Predictions are estimates — they show what is likely if current patterns continue, not guaranteed outcomes." actions={<Link to="/coach" className="btn btn-primary"><Bot size={15} /> Ask the AI Coach</Link>} />

      <Card className="mb" title="Your questions, answered" icon={HelpCircle}>
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {answers.map((x) => (
            <Link key={x.q} to={x.to} className="stat-tile" style={{ color: 'var(--text)', display: 'block' }}>
              <div className="small strong" style={{ color: 'var(--accent)' }}>{x.q}</div>
              <div className="small text-2 mt-sm">{x.a}</div>
            </Link>
          ))}
        </div>
      </Card>

      <h2 className="mb">Predictions <StateChip state="projected" label="Estimates" /></h2>
      <div className="grid-4 mb">
        <Card>
          <div className="stat-label"><Gauge size={13} /> Projected SGPA</div>
          <div className="stat-value">{fmtGpa(p.sgpa?.value, dec)}</div>
          <div className="stat-foot">{p.sgpa ? `Likely range ${fmtGpa(p.sgpa.low, dec)}–${fmtGpa(p.sgpa.high, dec)} · ${p.sgpa.confidence} confidence (${Math.round(p.sgpa.assessedShare * 100)}% assessed)` : 'No in-progress semester'}</div>
        </Card>
        <Card>
          <div className="stat-label"><TrendingUp size={13} /> Projected CGPA</div>
          <div className="stat-value">{fmtGpa(p.cgpa?.value, dec)}</div>
          <div className="stat-foot">{p.cgpa?.low != null ? `Range ${fmtGpa(p.cgpa.low, dec)}–${fmtGpa(p.cgpa.high, dec)}` : 'Based on available results'}</div>
        </Card>
        <Card>
          <div className="stat-label"><CalendarClock size={13} /> Attendance at semester end</div>
          <div className="stat-value">{p.attendance?.percent != null ? fmtPct(p.attendance.percent) : '—'}</div>
          <div className="stat-foot">{p.attendance ? `If the last 4 weeks’ ${fmtPct(p.attendance.recentRate)} continues · ${p.attendance.weeksLeft} weeks left` : 'Needs records & a semester end date'}</div>
        </Card>
        <Card>
          <div className="stat-label"><Zap size={13} /> Study this month</div>
          <div className="stat-value">{fmtDuration(p.study.monthProjectedMin, tf)}</div>
          <div className="stat-foot">At your 4-week pace of {fmtDuration(p.study.avgPerDay28, tf)}/day</div>
        </Card>
      </div>

      <div className="grid-3 mb">
        <Card title="Subject risk" sub="Estimated from marks so far">
          {p.subjects.length === 0 ? (
            <div className="small muted">No in-progress subjects with marks.</div>
          ) : (
            <div className="list">
              {p.subjects.map((r) => (
                <div key={r.unit.key} className="list-item">
                  <div className="li-main">
                    <div className="li-title small">{r.unit.label}</div>
                    <div className="li-sub" style={{ whiteSpace: 'normal' }}>{r.reason} · {r.confidence} confidence</div>
                  </div>
                  <RiskBadge level={r.level} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Deadline risk" sub="Next 14 days">
          {p.deadlines.length === 0 ? (
            <div className="small muted">No upcoming deadlines.</div>
          ) : (
            <div className="list">
              {p.deadlines.map((d) => (
                <div key={d.assignment.id} className="list-item">
                  <div className="li-main">
                    <div className="li-title small">{d.assignment.title}</div>
                    <div className="li-sub">{relativeDay(d.assignment.dueDate, today)} · {d.assignment.status.replace('-', ' ')}</div>
                  </div>
                  <RiskBadge level={d.level} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Goals & exams" sub="Completion likelihood at current pace">
          {p.goals.length + p.exams.length === 0 ? (
            <div className="small muted">Add goals with start and target dates.</div>
          ) : (
            <div className="list">
              {p.goals.map((g) => (
                <div key={g.goal.id} className="list-item">
                  <div className="li-main">
                    <div className="li-title small">{g.goal.title}</div>
                    <div className="li-sub">{Math.round(g.percent)}% now → ~{Math.round(g.projectedPercent)}% by target date</div>
                  </div>
                  <RiskBadge level={g.likelihood === 'high' ? 'safe' : g.likelihood === 'medium' ? 'medium' : 'high'} />
                </div>
              ))}
              {p.exams.map((e) => (
                <div key={`ex-${e.goal.id}`} className="list-item">
                  <div className="li-main">
                    <div className="li-title small">{e.goal.title} syllabus</div>
                    <div className="li-sub">{e.finishDate ? `At this pace: complete around ${fmtDate(e.finishDate)}${e.examDate ? ` (exam ${fmtDate(e.examDate)})` : ''}` : 'Not enough progress yet to estimate'}</div>
                  </div>
                  {e.finishDate && e.examDate && <RiskBadge level={e.finishDate <= e.examDate ? 'safe' : 'high'} />}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Areas of improvement & recommendations" icon={Brain} sub={`${a.insights.length} insights from your data`}>
        <div className="row wrap between mb">
          <div className="chips">
            {SEVERITIES.map((s) => (
              <button key={s.value} type="button" className="chip" aria-pressed={severity === s.value} onClick={() => setSeverity(s.value)}>
                {s.label} <span className="muted">{s.value ? a.insights.filter((i) => i.severity === s.value).length : a.insights.length}</span>
              </button>
            ))}
          </div>
          <select className="select sm" style={{ width: 170 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by area">
            <option value="">All areas</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {list.length === 0 ? (
          <Empty icon={Sparkles} title="Nothing to show">Insights appear as you add marks, study sessions, attendance and logs.</Empty>
        ) : (
          <div>
            {list.map((i) => (
              <div key={i.id} className="insight">
                <span className="insight-icon" style={{ '--tone': toneColor(i.severity) }}>
                  <ToneIcon tone={i.severity} />
                </span>
                <div className="grow">
                  <div className="row-sm wrap">
                    <span className="insight-title">{i.title}</span>
                    <span className="badge">{i.category}</span>
                  </div>
                  <div className="insight-detail">{i.detail}</div>
                </div>
                {i.action && <Link to={i.action.to} className="btn btn-ghost btn-sm">{i.action.label}</Link>}
              </div>
            ))}
          </div>
        )}
        <div className="mt">
          <Callout tone="info" icon={Info}>
            Recommendations weigh credits, deadlines, current performance, goal priority, remaining marks and your recent behaviour. Lifestyle data is used only if enabled in Settings → Privacy.
          </Callout>
        </div>
      </Card>
    </div>
  );
}
