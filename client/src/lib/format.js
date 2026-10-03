export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const toNum = (v, fallback = null) => (isNum(v) ? Number(v) : fallback);
export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : null);
export const round = (n, d = 2) => (isNum(n) ? Math.round(Number(n) * 10 ** d) / 10 ** d : null);

export function fmtNum(n, d = 1) {
  if (!isNum(n)) return '—';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(d);
}

export const fmtPct = (n, d = 0) => (isNum(n) ? `${Number(n).toFixed(d)}%` : '—');
export const fmtGpa = (n, d = 2) => (isNum(n) ? Number(n).toFixed(d) : '—');

/** Minutes → "3h 20m" or "3.3h" depending on preference. */
export function fmtDuration(min, style = 'hm') {
  if (!isNum(min)) return '—';
  const m = Math.round(Number(min));
  if (style === 'decimal') return `${(m / 60).toFixed(1)}h`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const minToHours = (min) => (isNum(min) ? Number(min) / 60 : 0);

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'Me'
  );
}

export function titleCase(s = '') {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Pearson correlation of paired samples. */
export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = sum(xs) / n;
  const my = sum(ys) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (!dx || !dy) return null;
  return num / Math.sqrt(dx * dy);
}

export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = sum(arr) / arr.length;
  return Math.sqrt(sum(arr.map((x) => (x - m) ** 2)) / (arr.length - 1));
}

/** Least-squares slope of y over index (per step). */
export function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = sum(values) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : 0;
}

export function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
