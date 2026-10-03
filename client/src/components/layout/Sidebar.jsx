import { NavLink, Link } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { NAV } from './navigation.js';
import { useData } from '../../store/data.jsx';
import { useSession } from '../../store/session.jsx';
import { initials } from '../../lib/format.js';
import { addDaysISO } from '../../lib/dates.js';
import { BrandMark, BrandWordmark } from './Brand.jsx';

export function Sidebar({ open, onNavigate }) {
  const { profile, analysis, data, today } = useData();
  const { logout } = useSession();
  const modules = profile.preferences.modules || {};

  const counts = {
    assignments: analysis?.upcomingAssignments.filter((a) => a.dueDate <= addDaysISO(today, 7)).length || 0,
    assignmentsAlert: analysis?.upcomingAssignments.some((a) => a.dueDate < today),
    exams: analysis?.examsThisWeek.length || 0,
    tasks: data.tasks.filter((t) => (t.status === 'todo' || t.status === 'in-progress') && t.dueDate && t.dueDate <= today).length,
    insights: analysis?.insights.filter((i) => i.severity === 'critical').length || 0,
    insightsAlert: true,
  };

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Link to="/" className="brand" onClick={onNavigate}>
          <BrandMark size={34} />
          <div>
            <BrandWordmark size={18} />
            <small>Personal intelligence</small>
          </div>
        </Link>
        <nav className="nav">
          {NAV.map((group, gi) => {
            const items = group.items.filter((it) => !it.module || modules[it.module] !== false);
            if (!items.length) return null;
            return (
              <div key={group.section || gi}>
                {group.section && <div className="nav-section">{group.section}</div>}
                {items.map((it) => {
                  const count = it.count ? counts[it.count] : 0;
                  return (
                    <NavLink key={it.to} to={it.to} end={it.end} className="nav-link" onClick={onNavigate}>
                      <it.icon size={17} aria-hidden />
                      {it.label}
                      {count > 0 && <span className={`nav-count ${counts[`${it.count}Alert`] ? 'alert' : ''}`}>{count}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/settings" className="nav-link" onClick={onNavigate}>
            <Settings size={17} aria-hidden /> Settings
          </NavLink>
          <div className="row-sm mt-sm">
          <Link to="/settings" className="profile-chip grow" onClick={onNavigate}>
            <span className="avatar">{initials(profile.name)}</span>
            <span className="grow">
              <span className="strong truncate" style={{ display: 'block' }}>
                {profile.name || 'Your profile'}
              </span>
              <span className="tiny muted truncate" style={{ display: 'block' }}>
                {[profile.university?.degree, analysis?.currentSemester?.name].filter(Boolean).join(' · ') || 'Set up your profile'}
              </span>
            </span>
          </Link>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
          </div>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={onNavigate} aria-hidden />
    </>
  );
}
