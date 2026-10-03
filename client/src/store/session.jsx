import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionContext } from './contexts.js';
import { AUTH_EVENT, createRemoteAdapter } from '../lib/adapters/remote.js';
import { createLocalAdapter } from '../lib/adapters/local.js';

const MODE_KEY = 'lifeos.mode';

/**
 * Device mode (data only in this browser, no account) bypasses admin approval,
 * so it is off unless the deployment explicitly enables it.
 */
export const DEVICE_MODE_ALLOWED = import.meta.env.VITE_ALLOW_DEVICE_MODE === 'true';

const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
};
const writeMode = (m) => {
  try {
    if (m) localStorage.setItem(MODE_KEY, m);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* ignore */
  }
};

/** Per-tab working data (e.g. AI chat) must not survive a sign-out on a shared computer. */
function clearSessionScratch() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('lifeos.'))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

const SIGNED_OUT = { status: 'signed-out', adapter: null, user: null, error: null };

/**
 * Who is signed in and which storage backend is active:
 *  - cloud  → LifeOS API + MongoDB Atlas, behind an approved account and an HttpOnly session cookie
 *  - device → this browser only (only when VITE_ALLOW_DEVICE_MODE=true)
 */
export function SessionProvider({ children }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', adapter: null, user: null, error: null });
  const [notice, setNotice] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /** @param silent re-check in the background without showing the loading screen */
  const restore = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, status: 'loading', error: null }));
    if (readMode() === 'device' && DEVICE_MODE_ALLOWED) {
      const adapter = createLocalAdapter();
      const user = await adapter.restore();
      setState(user ? { status: 'ready', adapter, user, error: null } : SIGNED_OUT);
      return;
    }
    const adapter = createRemoteAdapter();
    try {
      const user = await adapter.restore();
      if (user) {
        writeMode('cloud');
        setState({ status: 'ready', adapter, user, error: null });
      } else {
        setState(SIGNED_OUT);
      }
    } catch (err) {
      setState({ status: 'error', adapter: null, user: null, error: err.message });
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  // If the API couldn't be reached (e.g. still starting), keep checking quietly.
  useEffect(() => {
    if (state.status !== 'error') return undefined;
    let busy = false;
    const t = setInterval(async () => {
      if (busy) return;
      busy = true;
      await restore({ silent: true }).catch(() => {});
      busy = false;
    }, 5000);
    return () => clearInterval(t);
  }, [state.status, restore]);

  // A protected request found the session gone (expired, revoked, account suspended…).
  useEffect(() => {
    const onEnded = (e) => {
      const s = stateRef.current;
      if (s.status !== 'ready' || s.adapter?.mode !== 'cloud') return;
      clearSessionScratch();
      setNotice({ tone: e.detail?.code === 'ACCOUNT_SUSPENDED' ? 'critical' : 'warning', message: e.detail?.message || 'Your session has ended. Please sign in again.' });
      setState(SIGNED_OUT);
    };
    window.addEventListener(AUTH_EVENT, onEnded);
    return () => window.removeEventListener(AUTH_EVENT, onEnded);
  }, []);

  const api = useMemo(
    () => ({
      ...state,
      notice,
      clearNotice: () => setNotice(null),
      deviceModeAllowed: DEVICE_MODE_ALLOWED,
      retry: restore,
      async login(credentials) {
        const adapter = createRemoteAdapter();
        const user = await adapter.login(credentials);
        writeMode('cloud');
        setNotice(null);
        navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
        setState({ status: 'ready', adapter, user, error: null });
      },
      /** Submits a registration request. The account stays pending until approved — no sign-in happens. */
      register: (details) => createRemoteAdapter().register(details),
      async startDevice(details) {
        if (!DEVICE_MODE_ALLOWED) throw new Error('Device mode is not available on this LifeOS server.');
        const adapter = createLocalAdapter();
        const user = await adapter.start(details);
        writeMode('device');
        setState({ status: 'ready', adapter, user, error: null });
      },
      async logout() {
        await state.adapter?.logout();
        clearSessionScratch();
        writeMode(null);
        navigate('/', { replace: true });
        setNotice({ tone: 'good', message: 'You have been signed out.' });
        setState(SIGNED_OUT);
      },
      /** Called after the account (or device workspace) was deleted. */
      forget() {
        clearSessionScratch();
        writeMode(null);
        navigate('/', { replace: true });
        setNotice({ tone: 'good', message: 'Your account and its data were deleted.' });
        setState(SIGNED_OUT);
      },
    }),
    [state, notice, restore, navigate]
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
