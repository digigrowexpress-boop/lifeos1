import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Menu, Moon, Plus, Search, Sun, HardDrive, BookOpen, PenLine, ClipboardCheck, ListChecks, Target, NotebookPen, Percent } from 'lucide-react';
import { Sidebar } from './Sidebar.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { NotificationCenter } from './NotificationCenter.jsx';
import { DeviceDataBanner } from './DeviceDataBanner.jsx';
import { useData } from '../../store/data.jsx';
import { useQuickForms } from '../../store/quick.jsx';
import { useApplyTheme } from '../../hooks/useTheme.js';

function QuickAdd() {
  const openForm = useQuickForms();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const items = [
    ['study', 'Study session', BookOpen],
    ['marks', 'Marks', Percent],
    ['assignment', 'Assignment', ClipboardCheck],
    ['exam', 'Exam', PenLine],
    ['task', 'Task', ListChecks],
    ['goal', 'Goal', Target],
  ];
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="btn btn-primary btn-sm" aria-label="Add new" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Plus size={15} /> <span className="hide-mobile">Add</span>
      </button>
      {open && (
        <div className="popover" style={{ width: 230 }} role="menu">
          <div className="menu">
            {items.map(([kind, label, Icon]) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  openForm(kind);
                }}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
            <Link to="/logbook" role="menuitem" onClick={() => setOpen(false)}>
              <NotebookPen size={15} /> Today’s log
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { profile, saveProfile, mode } = useData();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const resolvedDark = useApplyTheme(profile.preferences) === 'dark';
  const toggleTheme = () => saveProfile((p) => ({ ...p, preferences: { ...p.preferences, theme: resolvedDark ? 'light' : 'dark' } }));

  return (
    <div className="app-shell">
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-toggle" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <Menu size={19} />
          </button>
          <button type="button" className="search-trigger" aria-label="Search or jump to (Ctrl+K)" onClick={() => setPaletteOpen(true)}>
            <Search size={15} aria-hidden />
            <span className="truncate">
              Search<span className="label-long"> or jump to…</span>
            </span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <QuickAdd />
            <button type="button" className="icon-btn" aria-label={`Switch to ${resolvedDark ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
              {resolvedDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationCenter />
          </div>
        </header>
        {mode === 'device' && (
          <div className="mode-banner">
            <HardDrive size={13} aria-hidden /> Device mode — data is stored only in this browser.{' '}
            <Link to="/settings?tab=data">Export or move to a cloud account</Link>
          </div>
        )}
        <DeviceDataBanner />
        <main id="main" className="page" key={profile.onboarded ? 'app' : 'setup'}>
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
