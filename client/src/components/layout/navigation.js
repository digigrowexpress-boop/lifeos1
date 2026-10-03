import {
  BarChart3,
  Bot,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Crosshair,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  History,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Orbit,
  PenLine,
  Sparkles,
  Target,
} from 'lucide-react';

/** Sidebar structure. `module` hides an item when that tracking module is turned off. */
export const NAV = [
  {
    items: [
      { to: '/', label: 'Command Center', icon: LayoutDashboard, end: true },
      { to: '/orbit', label: 'Life Orbit 3D', icon: Orbit, module: 'orbit' },
    ],
  },
  {
    section: 'Academics',
    items: [
      { to: '/academics', label: 'Semesters & Subjects', icon: GraduationCap },
      { to: '/targets', label: 'Target Calculator', icon: Crosshair },
      { to: '/simulator', label: 'What-If Simulator', icon: FlaskConical },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck, module: 'attendance' },
      { to: '/assignments', label: 'Submissions', icon: ClipboardCheck, module: 'assignments', count: 'assignments' },
      { to: '/exams', label: 'Exams', icon: PenLine, module: 'exams', count: 'exams' },
    ],
  },
  {
    section: 'Growth',
    items: [
      { to: '/study', label: 'Study Tracker', icon: BookOpen },
      { to: '/goals', label: 'Goals', icon: Target },
      { to: '/tasks', label: 'Tasks', icon: ListChecks, module: 'tasks', count: 'tasks' },
    ],
  },
  {
    section: 'Life',
    items: [
      { to: '/logbook', label: 'Daily Logbook', icon: NotebookPen, module: 'logbook' },
      { to: '/lifestyle', label: 'Lifestyle', icon: HeartPulse, module: 'lifestyle' },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { to: '/insights', label: 'Insights & Predictions', icon: Sparkles, count: 'insights' },
      { to: '/coach', label: 'AI Coach', icon: Bot },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/timeline', label: 'Timeline', icon: History },
    ],
  },
];
