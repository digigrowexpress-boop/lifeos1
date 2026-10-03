import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { Card } from '../ui/Card.jsx';

/** Shared axis/grid props so every chart reads as one system. */
export const axisProps = {
  tickLine: false,
  axisLine: { stroke: 'var(--chart-axis)' },
  tick: { fill: 'var(--muted)', fontSize: 11 },
};
export const gridProps = { stroke: 'var(--chart-grid)', vertical: false };
export const BAR_RADIUS = [4, 4, 0, 0];
export const HBAR_RADIUS = [0, 4, 4, 0];

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-title">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div className="tt-row" key={p.dataKey}>
            <span className="row-sm">
              <span className="swatch" style={{ background: p.color || p.stroke || p.fill }} />
              {p.name}
            </span>
            <b>{formatter ? formatter(p.value, p.name, p) : p.value}</b>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend" aria-hidden>
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          {it.line ? (
            <span className={`legend-line ${it.dashed ? 'dashed' : ''}`} style={{ background: it.color, color: it.color }} />
          ) : (
            <span className="legend-swatch" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Card with a chart and an equivalent table view (accessibility + exact values).
 * columns: [{ key, label, format? }]
 */
export function ChartCard({ title, sub, icon, legend, rows, columns, height = 260, children, action, className = '', empty }) {
  const [view, setView] = useState('chart');
  return (
    <Card
      title={title}
      sub={sub}
      icon={icon}
      className={className}
      action={
        <div className="row-sm">
          {action}
          {rows && columns && (
            <div className="segmented" role="group" aria-label="View as">
              <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')} aria-label="Chart view">
                <BarChart3 size={13} />
              </button>
              <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} aria-label="Table view">
                <Table2 size={13} />
              </button>
            </div>
          )}
        </div>
      }
    >
      {empty ? (
        empty
      ) : view === 'chart' ? (
        <>
          {legend && <div className="mb" style={{ marginBottom: 10 }}>{legend}</div>}
          <div style={{ width: '100%', height }}>{children}</div>
        </>
      ) : (
        <div className="table-wrap" style={{ maxHeight: height + 40, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={c.key} className={i ? 'num' : ''}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={i ? 'num' : ''}>
                      {c.format ? c.format(r[c.key], r) : r[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
