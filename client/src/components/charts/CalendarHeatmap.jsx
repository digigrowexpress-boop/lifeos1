import { useMemo, useState } from 'react';
import { addDaysISO, fmtDate, weekStartISO } from '../../lib/dates.js';

/**
 * GitHub-style heatmap. values: { 'yyyy-MM-dd': number }.
 * Sequential single-hue ramp; levels by quantiles of non-zero values.
 */
export function CalendarHeatmap({ values, end, weeks = 26, format = (v) => v, label = 'Activity', onSelect }) {
  const [hover, setHover] = useState(null);
  const { cells, thresholds } = useMemo(() => {
    const start = weekStartISO(addDaysISO(end, -7 * (weeks - 1)));
    const nonZero = Object.values(values).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] ?? 0;
    const th = nonZero.length ? [q(0.2), q(0.4), q(0.6), q(0.8)] : [1, 2, 3, 4];
    const out = [];
    for (let i = 0; i < weeks * 7; i += 1) {
      const date = addDaysISO(start, i);
      const v = values[date] || 0;
      let level = 0;
      if (v > 0) level = v <= th[0] ? 1 : v <= th[1] ? 2 : v <= th[2] ? 3 : v <= th[3] ? 4 : 5;
      out.push({ date, v, level, future: date > end });
    }
    return { cells: out, thresholds: th };
  }, [values, end, weeks]);

  return (
    <div>
      <div className="heatmap" role="img" aria-label={`${label} heatmap for the last ${weeks} weeks`}>
        {cells.map((c) =>
          c.future ? (
            <span key={c.date} className="heat-cell empty-cell" />
          ) : (
            <button
              key={c.date}
              type="button"
              className="heat-cell"
              data-l={c.level}
              style={{ border: 0, padding: 0 }}
              aria-label={`${fmtDate(c.date)}: ${format(c.v)}`}
              onMouseEnter={() => setHover(c)}
              onFocus={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(c.date)}
            />
          )
        )}
      </div>
      <div className="row between mt-sm wrap">
        <span className="small text-2" aria-live="polite">
          {hover ? `${fmtDate(hover.date, 'EEE, d MMM yyyy')} — ${format(hover.v)}` : 'Hover a day for details'}
        </span>
        <span className="heat-legend">
          Less
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <span key={l} className="heat-cell" data-l={l} title={l ? `≤ ${format(thresholds[l - 1] ?? thresholds[3])}` : 'None'} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
