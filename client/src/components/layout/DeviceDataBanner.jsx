import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { useData } from '../../store/data.jsx';
import { useToast } from '../ui/Feedback.jsx';
import { EXPORT_FORMAT } from '../../lib/collections.js';

const DEVICE_KEY = 'lifeos.device.v1';

function readDeviceWorkspace() {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const records = Object.values(parsed?.data || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
    return records ? { ...parsed, records } : null;
  } catch {
    return null;
  }
}

/**
 * Data saved in this browser by the older device mode is never deleted or
 * merged silently: the signed-in user can import it into their own account.
 */
export function DeviceDataBanner() {
  const { mode, user, importData } = useData();
  const toast = useToast();
  const handledKey = `lifeos.device.handled.${user?.id}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return Boolean(localStorage.getItem(handledKey));
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const workspace = mode === 'cloud' && !hidden ? readDeviceWorkspace() : null;
  if (!workspace) return null;

  const markHandled = () => {
    try {
      localStorage.setItem(handledKey, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const importIt = async () => {
    setBusy(true);
    try {
      await importData({ format: EXPORT_FORMAT, version: 1, profile: workspace.profile || {}, data: workspace.data }, 'merge');
      toast(`Imported ${workspace.records} records into your account`);
      markHandled();
    } catch (err) {
      toast(err.message || 'Import failed', 'critical');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mode-banner" role="status">
      <HardDrive size={13} aria-hidden /> This browser has {workspace.records} LifeOS records saved without an account.
      <button type="button" className="btn btn-sm" style={{ height: 24 }} disabled={busy} onClick={importIt}>
        {busy ? 'Importing…' : 'Import into my account'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" style={{ height: 24 }} onClick={markHandled}>
        Not now
      </button>
    </div>
  );
}
