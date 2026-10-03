import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { CalendarRange, GraduationCap, Pencil, Plus, Sigma, Star, Trash2, TrendingUp } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { StateChip } from '../components/ui/Indicators.jsx';
import { ChartCard, ChartTooltip, Legend, axisProps, gridProps, BAR_RADIUS } from '../components/charts/ChartKit.jsx';
import { fmtGpa, isNum, sum } from '../lib/format.js';
import { fmtDate } from '../lib/dates.js';

const STATUS_STATE = { official: 'official', confirmed: 'confirmed', 'in-progress': 'projected', empty: 'pending' };

export default function Academics() {
  const { data, profile, analysis: a, remove, saveProfile } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const dec = profile.grading.decimals ?? 2;
  const max = profile.grading.maxPoint || 10;
  const results = a.semesterResults;

  const chartRows = useMemo(
    () =>
      a.cumulative.series.map((s) => ({
        name: s.name.replace('Semester ', 'S'),
        fullName: s.name,
        sgpa: isNum(s.sgpa) ? Number(s.sgpa.toFixed(dec)) : null,
        estimate: s.sgpaStatus === 'in-progress',
        cgpa: isNum(s.cgpa) ? Number(s.cgpa.toFixed(dec)) : null,
        projectedCgpa: isNum(s.projectedCgpa) ? Number(s.projectedCgpa.toFixed(dec)) : null,
        target: s.target,
        credits: s.credits,
      })),
    [a.cumulative.series, dec]
  );

  const deleteSemester = async (sem) => {
    const count = data.subjects.filter((s) => s.semesterId === sem.id).length;
    const ok = await confirm({
      title: `Delete ${sem.name}?`,
      message: `This permanently removes the semester, its ${count} subject(s) and their marks, attendance, assignments and exams. Study sessions are kept but unlinked. CGPA will be recalculated.`,
      confirmLabel: 'Delete semester',
      danger: true,
      requireText: count ? 'delete' : undefined,
    });
    if (!ok) return;
    await remove('semesters', sem.id);
    if (profile.currentSemesterId === sem.id) await saveProfile({ currentSemesterId: null });
    toast('Semester deleted');
  };

  const conf = a.cumulative.confirmed;
  const proj = a.cumulative.projected;
  const completed = results.filter((r) => r.status === 'official' || r.status === 'confirmed').length;

  return (
    <div>
      <PageHeader
        eyebrow="Academics"
        title="Semesters & subjects"
        description="Your complete academic record. Confirmed results and estimates are always kept apart."
        actions={
          <>
            <button type="button" className="btn" onClick={() => openForm('semester')}>
              <Plus size={15} /> Semester
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openForm('subject')} disabled={!data.semesters.length}>
              <Plus size={15} /> Subject
            </button>
          </>
        }
      />

      <div className="grid-4 mb">
        <StatTile label="CGPA (confirmed)" value={fmtGpa(conf.cgpa, dec)} foot={<><StateChip state="confirmed" /> {conf.count} semester{conf.count === 1 ? '' : 's'}</>} icon={GraduationCap} />
        <StatTile label="CGPA incl. current estimate" value={fmtGpa(proj.cgpa, dec)} foot={<StateChip state="projected" label="Estimate" />} icon={TrendingUp} />
        <StatTile label="Credits completed" value={sum(results.filter((r) => isNum(r.confirmedSgpa)), (r) => r.totalCredits)} foot={`${sum(results, (r) => r.totalCredits)} incl. ongoing`} icon={Star} />
        <StatTile label="Semesters" value={`${completed}/${profile.university?.semesterCount || results.length}`} foot="completed" icon={CalendarRange} />
      </div>

      <div className="grid-2 mb">
        <ChartCard
          title="SGPA & CGPA progression"
          sub="Bars: SGPA per semester (striped = estimate). Line: confirmed CGPA after each semester."
          icon={TrendingUp}
          rows={chartRows}
          columns={[
            { key: 'fullName', label: 'Semester' },
            { key: 'sgpa', label: 'SGPA', format: (v, r) => (v == null ? '—' : `${v}${r.estimate ? ' (est.)' : ''}`) },
            { key: 'cgpa', label: 'CGPA', format: (v) => v ?? '—' },
            { key: 'credits', label: 'Credits' },
          ]}
          legend={<Legend items={[{ label: 'SGPA', color: 'var(--series-1)' }, { label: 'SGPA (estimate)', color: 'color-mix(in srgb, var(--series-1) 40%, transparent)' }, { label: 'CGPA', color: 'var(--series-2)', line: true }]} />}
          empty={!chartRows.length ? <Empty icon={TrendingUp} title="No semesters yet" /> : null}
        >
          <ResponsiveContainer>
            <ComposedChart data={chartRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} domain={[0, max]} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip labelFormatter={(l, p) => p?.[0]?.payload?.fullName || l} formatter={(v, n, p) => (n === 'SGPA' && p.payload.estimate ? `${v} (estimate)` : v)} />} />
              <Bar dataKey="sgpa" name="SGPA" radius={BAR_RADIUS} maxBarSize={24}>
                {chartRows.map((r) => (
                  <Cell key={r.name} fill={r.estimate ? 'color-mix(in srgb, var(--series-1) 40%, transparent)' : 'var(--series-1)'} stroke={r.estimate ? 'var(--series-1)' : 'none'} strokeDasharray={r.estimate ? '3 3' : undefined} />
                ))}
              </Bar>
              <Line dataKey="cgpa" name="CGPA" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4, fill: 'var(--series-2)', stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card title="How your CGPA is calculated" icon={Sigma} sub={a.cumulative.method === 'sgpa-average' ? 'CGPA = average of semester SGPAs' : 'CGPA = Σ (SGPA × credits) ÷ Σ credits'}>
          {results.length === 0 ? (
            <Empty icon={Sigma} title="Add a semester to begin" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Semester</th>
                    <th>Status</th>
                    <th className="num">Credits</th>
                    <th className="num">SGPA</th>
                    <th className="num">SGPA × credits</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.semester.id}>
                      <td>
                        <Link to={`/academics/semesters/${r.semester.id}`}>{r.semester.name}</Link>
                      </td>
                      <td>
                        <StateChip state={STATUS_STATE[r.status]} label={r.status === 'in-progress' ? 'Projected' : undefined} />
                      </td>
                      <td className="num">{r.totalCredits || '—'}</td>
                      <td className="num">{fmtGpa(r.effectiveSgpa, dec)}</td>
                      <td className="num">{isNum(r.effectiveSgpa) && r.totalCredits ? (r.effectiveSgpa * r.totalCredits).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Confirmed CGPA</td>
                    <td className="num">{conf.credits || '—'}</td>
                    <td className="num">{fmtGpa(conf.cgpa, dec)}</td>
                    <td className="num">{conf.points ? conf.points.toFixed(2) : '—'}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}>Incl. projected</td>
                    <td className="num">{proj.credits || '—'}</td>
                    <td className="num">{fmtGpa(proj.cgpa, dec)}</td>
                    <td className="num">{proj.points ? proj.points.toFixed(2) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="tiny muted mt-sm">Only confirmed and official results count toward confirmed CGPA. Change the method in Settings → University & grading.</p>
        </Card>
      </div>

      {results.length === 0 ? (
        <Card>
          <Empty icon={GraduationCap} title="Start with your current semester" action={<button type="button" className="btn btn-primary" onClick={() => openForm('semester')}><Plus size={15} /> Add semester</button>}>
            For past semesters you can simply enter the official SGPA and credits.
          </Empty>
        </Card>
      ) : (
        <div className="grid-auto">
          {[...results].reverse().map((r) => {
            const sem = r.semester;
            const isCurrent = a.currentSemester?.id === sem.id;
            return (
              <Card key={sem.id} glow={isCurrent}>
                <div className="row between row-top">
                  <div>
                    <Link to={`/academics/semesters/${sem.id}`} className="strong" style={{ fontSize: 16, color: 'var(--text)' }}>
                      {sem.name}
                    </Link>
                    <div className="small muted">
                      {[sem.academicYear, sem.startDate && `${fmtDate(sem.startDate, 'MMM yyyy')} – ${fmtDate(sem.endDate, 'MMM yyyy')}`].filter(Boolean).join(' · ') || sem.status}
                    </div>
                  </div>
                  <div className="row-sm">
                    <button type="button" className="icon-btn sm" aria-label={`Edit ${sem.name}`} onClick={() => openForm('semester', { semester: sem })}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="icon-btn sm danger" aria-label={`Delete ${sem.name}`} onClick={() => deleteSemester(sem)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="row between mt" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <div className="stat-value">{fmtGpa(r.effectiveSgpa, dec)}</div>
                    <div className="row-sm mt-sm">
                      <StateChip state={STATUS_STATE[r.status]} label={r.status === 'in-progress' ? 'Projected' : r.status === 'empty' ? 'No marks' : undefined} />
                      {isCurrent && <span className="badge badge-accent">Current</span>}
                    </div>
                  </div>
                  <div className="right small text-2">
                    <div>{r.totalCredits || 0} credits</div>
                    <div>{r.subjects.length} subjects</div>
                    {isNum(sem.targetSgpa) && <div>Target {sem.targetSgpa}</div>}
                  </div>
                </div>
                <div className="row-sm mt">
                  <Link to={`/academics/semesters/${sem.id}`} className="btn btn-sm grow">
                    Open
                  </Link>
                  {!isCurrent && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveProfile({ currentSemesterId: sem.id })}>
                      Set current
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
