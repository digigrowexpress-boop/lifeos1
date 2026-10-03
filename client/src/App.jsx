import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoaderCircle, CloudOff } from 'lucide-react';
import { SessionProvider, useSession } from './store/session.jsx';
import { DataProvider, useData } from './store/data.jsx';
import { QuickFormsProvider } from './store/quick.jsx';
import { FeedbackProvider } from './components/ui/Feedback.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { useApplyTheme } from './hooks/useTheme.js';
import AuthPage from './pages/AuthPage.jsx';
import Onboarding from './pages/Onboarding.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const OrbitPage = lazy(() => import('./pages/OrbitPage.jsx'));
const Academics = lazy(() => import('./pages/Academics.jsx'));
const SemesterDetail = lazy(() => import('./pages/SemesterDetail.jsx'));
const SubjectDetail = lazy(() => import('./pages/SubjectDetail.jsx'));
const Targets = lazy(() => import('./pages/Targets.jsx'));
const Simulator = lazy(() => import('./pages/Simulator.jsx'));
const Attendance = lazy(() => import('./pages/Attendance.jsx'));
const Assignments = lazy(() => import('./pages/Assignments.jsx'));
const Exams = lazy(() => import('./pages/Exams.jsx'));
const Study = lazy(() => import('./pages/Study.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const GoalDetail = lazy(() => import('./pages/GoalDetail.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Logbook = lazy(() => import('./pages/Logbook.jsx'));
const Lifestyle = lazy(() => import('./pages/Lifestyle.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Timeline = lazy(() => import('./pages/Timeline.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Coach = lazy(() => import('./pages/Coach.jsx'));
const AdminOnly = lazy(() => import('./pages/AdminOnly.jsx'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));

function FullScreenMessage({ icon: Icon = LoaderCircle, spin = true, title, children }) {
  return (
    <div className="loading-screen">
      <div className="stack-sm center" style={{ alignItems: 'center' }}>
        <Icon size={28} className={spin ? 'spin' : ''} style={{ color: 'var(--accent)' }} aria-hidden />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

const PageFallback = () => (
  <div className="stack">
    <div className="skeleton" style={{ height: 40, width: 280 }} />
    <div className="skeleton" style={{ height: 180 }} />
    <div className="skeleton" style={{ height: 260 }} />
  </div>
);

function AppRoutes() {
  const { status, error, reload, profile } = useData();
  useApplyTheme(profile.preferences);
  if (status === 'loading') return <FullScreenMessage title="Loading your LifeOS…" />;
  if (status === 'error') {
    return (
      <FullScreenMessage icon={CloudOff} spin={false} title="Couldn’t load your data">
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-primary mt-sm" onClick={reload}>
          Try again
        </button>
      </FullScreenMessage>
    );
  }
  if (!profile.onboarded) return <Onboarding />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <Suspense fallback={<PageFallback />}>
              <Dashboard />
            </Suspense>
          }
        />
        {[
          ['orbit', OrbitPage],
          ['academics', Academics],
          ['academics/semesters/:id', SemesterDetail],
          ['academics/subjects/:id', SubjectDetail],
          ['targets', Targets],
          ['simulator', Simulator],
          ['attendance', Attendance],
          ['assignments', Assignments],
          ['exams', Exams],
          ['study', Study],
          ['goals', Goals],
          ['goals/:id', GoalDetail],
          ['tasks', Tasks],
          ['logbook', Logbook],
          ['lifestyle', Lifestyle],
          ['insights', Insights],
          ['coach', Coach],
          ['admin/*', AdminOnly],
          ['analytics', Analytics],
          ['timeline', Timeline],
          ['search', SearchPage],
          ['settings', Settings],
        ].map(([path, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <Suspense fallback={<PageFallback />}>
                <Page />
              </Suspense>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const session = useSession();
  useApplyTheme(session.status === 'ready' ? null : { theme: 'system' });
  if (session.status === 'loading') return <FullScreenMessage title="Starting LifeOS…" />;
  if (session.status === 'error') {
    return (
      <FullScreenMessage icon={CloudOff} spin={false} title="Can’t reach the LifeOS server">
        <p className="muted">{session.error}</p>
        <p className="small muted">Retrying automatically every few seconds…</p>
        <div className="row mt-sm" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={() => session.retry()}>
            Retry
          </button>
          <button type="button" className="btn" onClick={session.logout}>
            Sign out
          </button>
        </div>
      </FullScreenMessage>
    );
  }
  if (session.status !== 'ready') return <AuthPage />;
  // The administrator gets the account-management console only — no personal LifeOS workspace.
  if (session.user?.role === 'admin') {
    return (
      <Suspense fallback={<FullScreenMessage title="Opening the admin console…" />}>
        <AdminApp />
      </Suspense>
    );
  }
  return (
    <DataProvider key={session.user?.id}>
      <QuickFormsProvider>
        <AppRoutes />
      </QuickFormsProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <FeedbackProvider>
        <Gate />
      </FeedbackProvider>
    </SessionProvider>
  );
}
