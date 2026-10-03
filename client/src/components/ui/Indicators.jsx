import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Sparkles, MinusCircle } from 'lucide-react';
import { DATA_STATES } from '../../logic/defaults.js';
import { PACE_META } from '../../logic/goals.js';
import { clamp } from '../../lib/format.js';

/** Data-state chip: confirmed / expected / estimated / pending / hypothetical / projected / official. */
export function StateChip({ state, label }) {
  const meta = DATA_STATES[state] || { label: state };
  const color = {
    confirmed: 'var(--st-confirmed)',
    official: 'var(--st-confirmed)',
    expected: 'var(--st-expected)',
    estimated: 'var(--st-estimated)',
    pending: 'var(--st-pending)',
    hypothetical: 'var(--st-hypothetical)',
    simulated: 'var(--st-hypothetical)',
    projected: 'var(--st-projected)',
  }[state];
  const dashed = ['projected', 'hypothetical', 'simulated', 'estimated'].includes(state);
  return (
    <span className={`state-chip ${dashed ? 'dashed' : ''}`} style={{ '--chip': color }} title={meta.hint}>
      {label || meta.label || (state === 'simulated' ? 'Hypothetical' : state)}
    </span>
  );
}

const TONE_ICON = {
  good: CheckCircle2,
  positive: Sparkles,
  warning: AlertTriangle,
  critical: OctagonAlert,
  info: Info,
  neutral: MinusCircle,
};

export function ToneIcon({ tone, size = 15 }) {
  const Icon = TONE_ICON[tone] || Info;
  return <Icon size={size} aria-hidden />;
}

/** Status badge: always icon + label, never color alone. */
export function ToneBadge({ tone = 'neutral', children, icon = true }) {
  const cls = { good: 'badge-good', positive: 'badge-good', warning: 'badge-warning', critical: 'badge-critical', info: 'badge-info' }[tone] || '';
  return (
    <span className={`badge ${cls}`}>
      {icon && <ToneIcon tone={tone} size={12} />}
      {children}
    </span>
  );
}

export function PaceBadge({ pace }) {
  const meta = PACE_META[pace] || { label: pace, tone: 'neutral' };
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

export function RiskBadge({ level }) {
  const map = {
    high: ['critical', 'High risk'],
    overdue: ['critical', 'Overdue'],
    critical: ['critical', 'At risk'],
    medium: ['warning', 'Medium'],
    warning: ['warning', 'Watch'],
    low: ['good', 'Low'],
    safe: ['good', 'Safe'],
    none: ['neutral', 'No data'],
  };
  const [tone, label] = map[level] || ['neutral', level];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}

export function ProgressBar({ value, max = 100, tone, color, marker, className = '', label, size = '' }) {
  const pct = max ? clamp((Number(value) || 0) / max, 0, 1) * 100 : 0;
  const fill = color || (tone ? `var(--${tone === 'positive' ? 'good' : tone})` : undefined);
  return (
    <div
      className={`progress ${size} ${className}`}
      style={fill ? { '--fill': fill } : undefined}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      {marker != null && <div className="progress-marker" style={{ left: `calc(${clamp(marker, 0, 100)}% - 1px)` }} title="Expected by now" />}
    </div>
  );
}

export function Ring({ value, max = 100, size = 64, stroke = 7, color = 'var(--accent)', children, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? clamp((Number(value) || 0) / max, 0, 1) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export const toneColor = (tone) =>
  ({ good: 'var(--good)', positive: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical)', info: 'var(--info)' })[tone] || 'var(--muted)';

/** Tone for a percent score (≥75 good, ≥50 warning, else critical). */
export const scoreTone = (score) => (score == null ? 'neutral' : score >= 75 ? 'good' : score >= 50 ? 'warning' : 'critical');
