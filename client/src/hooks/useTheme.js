import { useEffect, useState } from 'react';

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** Applies theme / accent / motion preferences to <html>. Pass null to only read the resolved theme. */
export function useApplyTheme(preferences) {
  const theme = preferences?.theme || 'system';
  const accent = preferences?.accent || 'blue';
  const reduceMotion = Boolean(preferences?.reduceMotion);
  const [systemDark, setSystemDark] = useState(() => media()?.matches ?? true);

  useEffect(() => {
    const m = media();
    if (!m) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  const active = preferences !== null;
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.accent = accent;
    if (reduceMotion) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0a0d13' : '#f3f5f9');
  }, [active, resolved, accent, reduceMotion]);

  return resolved;
}
