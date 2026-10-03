import { useSearchParams } from 'react-router-dom';
import { Bell, Database, GraduationCap, Palette, SlidersHorizontal, User } from 'lucide-react';
import { PageHeader, Tabs } from '../components/ui/Card.jsx';
import { GradingSettings } from '../components/settings/GradingSettings.jsx';
import { AppearanceSettings, NotificationSettings, ProfileSettings, TrackingSettings } from '../components/settings/GeneralSettings.jsx';
import { DataSettings } from '../components/settings/DataSettings.jsx';

const TABS = [
  { value: 'profile', label: 'Profile & targets', icon: User },
  { value: 'grading', label: 'University & grading', icon: GraduationCap },
  { value: 'tracking', label: 'Tracking & dashboard', icon: SlidersHorizontal },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'data', label: 'Data & privacy', icon: Database },
];

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'profile';
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Settings" description="Personalise LifeOS — your grading system, what you track, reminders, look and data." />
      <Tabs tabs={TABS} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'profile' && <ProfileSettings />}
      {tab === 'grading' && <GradingSettings />}
      {tab === 'tracking' && <TrackingSettings />}
      {tab === 'notifications' && <NotificationSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
      {tab === 'data' && <DataSettings />}
    </div>
  );
}
