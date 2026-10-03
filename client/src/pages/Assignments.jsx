import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ClipboardCheck, Pencil, Plus, Search, Trash2, ExternalLink } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useQuickForms } from '../store/quick.jsx';
import { useConfirm, useToast } from '../components/ui/Feedback.jsx';
import { Card, Empty, PageHeader, StatTile } from '../components/ui/Card.jsx';
import { ToneBadge } from '../components/ui/Indicators.jsx';
import { ASSIGNMENT_STATUSES } from '../logic/defaults.js';
import { isOpenAssignment } from '../logic/insights.js';
import { addDaysISO, fmtDate, relativeDay } from '../lib/dates.js';
import { fmtPct } from '../lib/format.js';
import { subjectOptions } from '../components/forms/options.js';

const FILTERS = [
  { value: 'open', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Due this week' },
  { value: 'done', label: 'Submitted' },
  { value: 'missed', label: 'Late / missed' },
  { value: 'all', label: 'All' },
  { value: 'archived', label: 'Archived' },
];

export default function Assignments() {
  const { data, analysis: a, today, update, remove } = useData();
  const openForm = useQuickForms();
  const confirm = useConfirm();
  const toast = useToast();
  const [filter, setFilter] = useState('open');
  const [subjectId, setSubjectId] = useState('');
  const [q, setQ] = useState('');

  const all = data.assignments;
  const open = all.filter(isOpenAssignment);
  const overdue = open.filter((x) => x.dueDate && x.dueDate < today);
  const week = open.filter((x) => x.dueDate && x.dueDate >= today && x.dueDate <= addDaysISO(today, 7));
  const submitted = all.filter((x) => x.status === 'submitted' || x.status === 'late');
  const onTime = all.filter((x) => x.status === 'submitted' && (!x.dueDate || !x.submittedDate || x.submittedDate <= x.dueDate));
  const marked = all.filter((x) => x.marks != null && x.maxMarks > 0);
  const avgMarks = marked.length ? (marked.reduce((s, x) => s + x.marks / x.maxMarks, 0) / marked.length) * 100 : null;

  const list = useMemo(() => {
    let l = all;
    if (filter === 'archived') l = l.filter((x) => x.archived);
    else {
      l = l.filter((x) => !x.archived);
      if (filter === 'open') l = l.filter(isOpenAssignment);
      if (filter === 'overdue') l = l.filter((x) => isOpenAssignment(x) && x.dueDate && x.dueDate < today);
      if (filter === 'week') l = l.filter((x) => isOpenAssignment(x) && x.dueDate && x.dueDate >= today && x.dueDate <= addDaysISO(today, 7));
      if (filter === 'done') l = l.filter((x) => x.status === 'submitted');
      if (filter === 'missed') l = l.filter((x) => x.status === 'late' || x.status === 'missed');
    }
    if (subjectId) l = l.filter((x) => x.subjectId === subjectId);
    if (q.trim()) {
      const t = q.toLowerCase();
      l = l.filter((x) => `${x.title} ${x.description} ${x.notes}`.toLowerCase().includes(t));
    }
    const done = filter === 'done' || filter === 'all' || filter === 'archived';
    return [...l].sort((x, y) => (done ? String(y.dueDate || '').localeCompare(String(x.dueDate || '')) : String(x.dueDate || '9999').localeCompare(String(y.dueDate || '9999'))));
  }, [all, filter, subjectId, q, today]);

  const setStatus = async (x, status) => {
    const patch = { status };
    if ((status === 'submitted' || status === 'late') && !x.submittedDate) patch.submittedDate = today;
    await update('assignments', x.id, patch);
  };

  const del = async (x) => {
    if (!(await confirm({ title: `Delete “${x.title}”?`, confirmLabel: 'Delete', danger: true }))) return;
    await remove('assignments', x.id);
    toast('Submission deleted');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Submissions"
        title="Assignments & submissions"
        description="Everything you need to hand in — with deadlines, status and marks."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openForm('assignment')}>
            <Plus size={15} /> Add
          </button>
        }
      />
      <div className="grid-4 mb">
        <StatTile label="Pending" value={open.length} foot={`${week.length} due in the next 7 days`} />
        <StatTile label="Overdue" value={overdue.length} foot={overdue.length ? <ToneBadge tone="critical">Act now</ToneBadge> : 'Nothing overdue'} />
        <StatTile label="On-time rate" value={submitted.length ? fmtPct((onTime.length / submitted.length) * 100) : '—'} foot={`${submitted.length} submitted`} />
        <StatTile label="Average marks" value={fmtPct(avgMarks)} foot={`${marked.length} graded`} />
      </div>

      <Card>
        <div className="row wrap between mb">
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="row-sm wrap">
            <div className="row-sm" style={{ position: 'relative' }}>
              <Search size={14} className="muted" style={{ position: 'absolute', left: 10 }} />
              <input className="input sm" style={{ paddingLeft: 30, width: 190 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search submissions" />
            </div>
            <select className="select sm" style={{ width: 190 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Filter by subject">
              <option value="">All subjects</option>
              {subjectOptions(data, a).map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {list.length === 0 ? (
          <Empty icon={ClipboardCheck} title={filter === 'open' ? 'No pending submissions' : 'Nothing here'} action={<button type="button" className="btn btn-sm" onClick={() => openForm('assignment')}><Plus size={14} /> Add submission</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="num">Marks</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const late = isOpenAssignment(x) && x.dueDate && x.dueDate < today;
                  const soon = isOpenAssignment(x) && x.dueDate && !late && x.dueDate <= addDaysISO(today, 2);
                  return (
                    <tr key={x.id}>
                      <td>
                        <div className="strong small">
                          {x.title} {x.priority === 'high' && <span className="badge badge-warning">High</span>}
                        </div>
                        <div className="tiny muted">
                          {a.subjectById[x.subjectId]?.name || 'No subject'}
                          {x.reference && (
                            <>
                              {' · '}
                              {/^https?:\/\//.test(x.reference) ? (
                                <a href={x.reference} target="_blank" rel="noreferrer noopener">
                                  link <ExternalLink size={10} style={{ display: 'inline' }} />
                                </a>
                              ) : (
                                x.reference
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="nowrap">
                        <div className="small">{x.dueDate ? fmtDate(x.dueDate, 'd MMM') : '—'}</div>
                        {x.dueDate && isOpenAssignment(x) && <span className={`badge ${late ? 'badge-critical' : soon ? 'badge-warning' : ''}`}>{relativeDay(x.dueDate, today)}</span>}
                        {x.submittedDate && <div className="tiny muted">submitted {fmtDate(x.submittedDate, 'd MMM')}</div>}
                      </td>
                      <td>
                        <select className="select sm" style={{ width: 140 }} value={x.status} onChange={(e) => setStatus(x, e.target.value)} aria-label={`Status of ${x.title}`}>
                          {ASSIGNMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="num small">{x.marks != null ? `${x.marks}${x.maxMarks ? `/${x.maxMarks}` : ''}` : x.maxMarks ? `—/${x.maxMarks}` : '—'}</td>
                      <td className="right nowrap">
                        <button type="button" className="icon-btn sm" aria-label={`Edit ${x.title}`} onClick={() => openForm('assignment', { assignment: x })}><Pencil size={14} /></button>
                        <button type="button" className="icon-btn sm" aria-label={x.archived ? 'Unarchive' : 'Archive'} title={x.archived ? 'Unarchive' : 'Archive'} onClick={() => update('assignments', x.id, { archived: !x.archived })}>
                          {x.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </button>
                        <button type="button" className="icon-btn sm danger" aria-label={`Delete ${x.title}`} onClick={() => del(x)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
