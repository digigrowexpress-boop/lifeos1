import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Info, MousePointerClick } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { Ring, ToneBadge, ToneIcon, toneColor } from '../components/ui/Indicators.jsx';
import { OrbitView } from '../components/three/OrbitView.jsx';

const AREA_INSIGHTS = {
  academics: ['Academics', 'Data quality'],
  study: ['Study'],
  goals: ['Goals'],
  lifestyle: ['Lifestyle', 'Habits'],
  attendance: ['Attendance'],
  tasks: ['Deadlines', 'Exams'],
  analytics: ['Study', 'Lifestyle'],
  progress: null,
  achievements: [],
};

const AREA_HELP = {
  academics: 'Current SGPA relative to your target SGPA (or to the maximum grade point if no target).',
  study: 'Study time this week relative to your weekly study target.',
  goals: 'Share of active goals that are on pace with their timeline.',
  lifestyle: 'Sleep vs target, social media vs limit and exercise vs target over the last 7 days.',
  attendance: 'Overall attendance in the current semester.',
  tasks: 'Tasks completed in the last 2 weeks vs still open, minus overdue items.',
  analytics: 'Share of days you studied in the last 4 weeks.',
  progress: 'Falls as critical and warning insights pile up.',
  achievements: 'Share of available achievements earned.',
};

export default function OrbitPage() {
  const { analysis: a, profile } = useData();
  const [selected, setSelected] = useState(null);
  const area = a.areas.find((x) => x.key === selected);
  const cats = area ? AREA_INSIGHTS[area.key] : null;
  const related = area ? a.insights.filter((i) => (cats === null ? i.severity !== 'positive' : cats.includes(i.category))).slice(0, 5) : [];
  const prefs = profile.preferences;

  return (
    <div>
      <PageHeader
        eyebrow="Life Orbit"
        title="Your life, in orbit"
        description="Each planet is an area of your life. Colour shows its health, the ring shows its score. Drag to rotate, scroll to zoom, select a planet to dive in."
      />
      <div className="orbit-layout">
        <div className="card flush" style={{ overflow: 'hidden' }}>
          <OrbitView areas={a.areas} selected={selected} onSelect={setSelected} height="min(68vh, 640px)" reduceMotion={prefs.reduceMotion} themeKey={`${prefs.theme}-${prefs.accent}`} />
          <div className="row wrap small muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', gap: 16 }}>
            <span className="row-sm"><MousePointerClick size={14} /> Click a planet · click empty space to reset</span>
            {['good', 'warning', 'critical', 'neutral'].map((t) => (
              <span key={t} className="row-sm">
                <span className="tone-dot" style={{ background: toneColor(t) }} />
                {{ good: 'Healthy (75+)', warning: 'Watch (50–74)', critical: 'Needs attention (<50)', neutral: 'No data' }[t]}
              </span>
            ))}
          </div>
        </div>

        <div className="stack">
          <Card title={area ? area.label : 'Life areas'} sub={area ? AREA_HELP[area.key] : 'Choose an area — in 3D or from this list.'}>
            {area ? (
              <div className="stack">
                <div className="row">
                  <Ring value={area.score ?? 0} size={84} stroke={8} color={toneColor(area.tone)} label={`${area.label} score`}>
                    <div className="strong" style={{ fontSize: 20 }}>{area.score != null ? Math.round(area.score) : '—'}</div>
                  </Ring>
                  <div className="stack-xs">
                    <div className="strong" style={{ fontSize: 16 }}>{area.headline}</div>
                    <div className="small text-2">{area.sub}</div>
                    <ToneBadge tone={area.tone}>{{ good: 'Healthy', warning: 'Watch', critical: 'Needs attention', neutral: 'No data' }[area.tone]}</ToneBadge>
                  </div>
                </div>
                <Link to={area.to} className="btn btn-primary">
                  Open {area.label} <ArrowRight size={14} />
                </Link>
                {related.length > 0 && (
                  <div>
                    <div className="field-label" style={{ marginBottom: 6 }}>What’s affecting this area</div>
                    {related.map((i) => (
                      <div key={i.id} className="insight">
                        <span className="insight-icon" style={{ '--tone': toneColor(i.severity) }}>
                          <ToneIcon tone={i.severity} size={14} />
                        </span>
                        <div className="grow">
                          <div className="insight-title small">{i.title}</div>
                          <div className="insight-detail">{i.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                  Back to all areas
                </button>
              </div>
            ) : (
              <div className="orbit-area-list">
                {a.areas.map((x) => (
                  <button key={x.key} type="button" className="orbit-area-btn" aria-pressed={selected === x.key} onClick={() => setSelected(x.key)}>
                    <span className="row-sm">
                      <span className="tone-dot" style={{ background: toneColor(x.tone) }} />
                      <span className="strong truncate">{x.label}</span>
                    </span>
                    <span className="muted truncate">{x.headline}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <div className="row-sm small text-2 row-top">
              <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Scores are simple summaries of your recorded data, not judgements. Areas with no data stay grey. Turn the 3D view off any time in Settings → Tracking.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
