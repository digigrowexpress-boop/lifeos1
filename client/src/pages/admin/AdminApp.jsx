import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useSession } from '../../store/session.jsx';
import { useApplyTheme } from '../../hooks/useTheme.js';
import { BrandMark, BrandWordmark } from '../../components/layout/Brand.jsx';
import AdminDashboard from './AdminDashboard.jsx';

const THEME_KEY = 'lifeos.admin.theme';
const readTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
};

/** Shell for the administrator account: account management only, no personal LifeOS workspace. */
export default function AdminApp() {
  const { user, logout } = useSession();
  const [theme, setTheme] = useState(readTheme);
  const resolved = useApplyTheme({ theme });

  const toggleTheme = () => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="admin-shell">
      <header className="topbar admin-topbar">
        <div className="row-sm">
          <BrandMark size={32} />
          <BrandWordmark size={17} />
          <span className="badge badge-accent">
            <ShieldCheck size={12} /> Admin
          </span>
        </div>
        <div className="topbar-actions">
          <span className="small muted hide-mobile">{user?.email}</span>
          <button type="button" className="icon-btn" aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
            {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" className="btn btn-sm" onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>
      <main id="main" className="page">
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
