import { useId, useState } from 'react';

/** LifeOS emblem (raster from the brand artwork), falling back to the vector mark. */
export function BrandMark({ size = 30, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <VectorMark size={size} className={className} />;
  return (
    <img
      className={`brand-mark brand-mark-img ${className}`}
      src="/icon-192.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Vector version of the logo mark: a glowing sphere holding a ribbon "L" with a
 * leaf, circled by an orbit with a small satellite.
 */
export function VectorMark({ size = 30, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const g = `lg-${uid}`;
  const s = `sp-${uid}`;
  const glow = `gl-${uid}`;
  return (
    <svg className={`brand-mark ${className}`} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id={g} x1="8" y1="8" x2="58" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#35e3ff" />
          <stop offset="0.45" stopColor="#3d6bff" />
          <stop offset="1" stopColor="#b35cff" />
        </linearGradient>
        <radialGradient id={s} cx="0.42" cy="0.38" r="0.65">
          <stop offset="0" stopColor="#121a52" />
          <stop offset="0.72" stopColor="#1b2a9e" />
          <stop offset="1" stopColor="#5a4dff" />
        </radialGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* orbit (back half) */}
      <path d="M5.5 41.5 C 2 33, 30 18, 52 15" stroke={`url(#${g})`} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      {/* sphere */}
      <circle cx="32" cy="31" r="21" fill={`url(#${s})`} />
      <circle cx="32" cy="31" r="21" stroke={`url(#${g})`} strokeWidth="1.6" opacity="0.9" filter={`url(#${glow})`} />
      {/* ribbon L */}
      <path d="M25 13.5 C 21.5 22, 21.5 34, 24.5 41.5 C 27 46.5, 35 47, 47 43.5" stroke={`url(#${g})`} strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glow})`} />
      {/* leaf */}
      <path d="M30.5 37.5 C 31 28.5, 37.5 22, 47.5 20.5 C 43.5 26, 39.5 33, 30.5 37.5 Z" fill={`url(#${g})`} opacity="0.95" />
      {/* orbit (front half) + satellite */}
      <path d="M5.5 41.5 C 9 47.5, 40 38, 56.5 19.5" stroke={`url(#${g})`} strokeWidth="1.8" strokeLinecap="round" filter={`url(#${glow})`} />
      <circle cx="56.5" cy="18.5" r="3.2" fill="#eef2ff" filter={`url(#${glow})`} />
    </svg>
  );
}

/** "LifeOS" wordmark — "Life" in ink, "OS" in the brand gradient. */
export function BrandWordmark({ size = 18 }) {
  return (
    <span className="brand-wordmark" style={{ fontSize: size }}>
      Life<span className="brand-os">OS</span>
    </span>
  );
}

