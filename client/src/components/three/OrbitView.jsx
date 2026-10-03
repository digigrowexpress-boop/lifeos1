import { Component, lazy, Suspense, useMemo } from 'react';
import { Orbit } from 'lucide-react';

const LifeOrbit = lazy(() => import('./LifeOrbit.jsx'));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

class OrbitBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Flat, accessible fallback used when WebGL is unavailable or while loading. */
export function OrbitFallback({ areas, selected, onSelect, height, note }) {
  return (
    <div className="orbit-fallback" style={{ minHeight: height }}>
      {note && <p className="small muted center" style={{ marginBottom: 12 }}>{note}</p>}
      <div className="orbit-fallback-grid">
        {areas.map((a) => (
          <button key={a.key} type="button" className={`orbit-fallback-node tone-${a.tone}`} aria-pressed={selected === a.key} onClick={() => onSelect(selected === a.key ? null : a.key)}>
            <span className="tone-dot" style={{ background: 'var(--tone)' }} />
            <strong>{a.label}</strong>
            <span className="small muted">{a.score != null ? Math.round(a.score) : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lazy-loaded 3D orbit with graceful fallbacks; never blocks the rest of the app. */
export function OrbitView(props) {
  const supported = useMemo(webglAvailable, []);
  const fallback = <OrbitFallback {...props} note="3D view unavailable on this device — showing the flat view." />;
  if (!supported) return fallback;
  return (
    <OrbitBoundary fallback={fallback}>
      <Suspense
        fallback={
          <div className="orbit-canvas orbit-loading" style={{ height: props.height }}>
            <Orbit className="spin" size={28} aria-hidden />
            <span className="small muted">Loading 3D view…</span>
          </div>
        }
      >
        <LifeOrbit {...props} />
      </Suspense>
    </OrbitBoundary>
  );
}
