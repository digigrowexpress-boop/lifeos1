import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DataContext } from './contexts.js';
import { emptyData } from '../lib/collections.js';
import { nowISO, todayISO } from '../lib/dates.js';
import { mergeProfile } from '../logic/defaults.js';
import { buildAnalysis } from '../logic/analysis.js';
import { useToast } from '../components/ui/Feedback.jsx';
import { useSession } from './session.jsx';
import { SESSION_ENDED_CODES } from '../lib/adapters/remote.js';


/** Re-render once the calendar day changes so "today" never goes stale. */
function useToday() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const t = setInterval(() => {
      const now = todayISO();
      setToday((prev) => (prev === now ? prev : now));
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export function DataProvider({ children }) {
  const { adapter, user } = useSession();
  const toast = useToast();
  const [data, setData] = useState(emptyData);
  const [profile, setProfile] = useState(() => mergeProfile(user?.profile));
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const today = useToday();
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const all = await adapter.loadAll();
      setData({ ...emptyData(), ...all });
      setStatus('ready');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, [adapter]);

  useEffect(() => {
    setProfile(mergeProfile(user?.profile));
    load();
  }, [load, user]);

  const fail = useCallback(
    (e) => {
      // When the session ended, the sign-in screen explains why — no extra toast.
      if (!SESSION_ENDED_CODES.has(e?.code)) toast(e?.message || 'Something went wrong', 'critical');
      throw e;
    },
    [toast]
  );

  const actions = useMemo(() => {
    const apply = (col, fn) => setData((d) => ({ ...d, [col]: fn(d[col]) }));

    const applyCascade = (result) => {
      setData((d) => {
        const next = { ...d };
        for (const [col, ids] of Object.entries(result.removed || {})) {
          const gone = new Set(ids);
          next[col] = next[col].filter((x) => !gone.has(x.id));
        }
        for (const [col, docs] of Object.entries(result.updated || {})) {
          const byId = Object.fromEntries(docs.map((x) => [x.id, x]));
          next[col] = next[col].map((x) => byId[x.id] || x);
        }
        return next;
      });
    };

    return {
      async create(col, doc) {
        try {
          const saved = await adapter.create(col, doc);
          apply(col, (list) => [...list, saved]);
          return saved;
        } catch (e) {
          return fail(e);
        }
      },
      async bulkCreate(col, items) {
        if (!items.length) return [];
        try {
          const saved = await adapter.bulkCreate(col, items);
          apply(col, (list) => [...list, ...saved]);
          return saved;
        } catch (e) {
          return fail(e);
        }
      },
      /** Optimistic update; rolls back if the server rejects it. */
      async update(col, id, patch) {
        let previous;
        apply(col, (list) =>
          list.map((x) => {
            if (x.id !== id) return x;
            previous = x;
            return { ...x, ...patch };
          })
        );
        try {
          const saved = await adapter.update(col, id, patch);
          apply(col, (list) => list.map((x) => (x.id === id ? saved : x)));
          return saved;
        } catch (e) {
          if (previous) apply(col, (list) => list.map((x) => (x.id === id ? previous : x)));
          return fail(e);
        }
      },
      async remove(col, id) {
        try {
          const result = await adapter.remove(col, id);
          applyCascade(result);
          return result;
        } catch (e) {
          return fail(e);
        }
      },
      async saveProfile(patch) {
        const prev = profileRef.current;
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        setProfile(next);
        try {
          await adapter.saveProfile(next);
          return next;
        } catch (e) {
          setProfile(prev);
          return fail(e);
        }
      },
      /** Timeline entry for things not derivable from records (marks entered, grade changes). */
      logEvent(type, title, detail = '', refCollection = '', refId = null) {
        adapter
          .create('events', { at: nowISO(), type, title, detail, refCollection, refId })
          .then((saved) => apply('events', (list) => [...list, saved]))
          .catch(() => {});
      },
      exportData: () => adapter.exportAll(),
      async importData(payload, mode) {
        await adapter.importAll(payload, mode);
        const all = await adapter.loadAll();
        setData({ ...emptyData(), ...all });
        if (mode === 'replace' && payload.profile) setProfile(mergeProfile(payload.profile));
      },
      async wipeData() {
        await adapter.wipeData();
        setData(emptyData());
      },
      reload: load,
    };
  }, [adapter, fail, load]);

  const analysis = useMemo(() => (status === 'ready' ? buildAnalysis(data, profile, today) : null), [data, profile, today, status]);

  const value = useMemo(
    () => ({ data, profile, analysis, status, error, today, mode: adapter?.mode, user, adapter, ...actions }),
    [data, profile, analysis, status, error, today, adapter, user, actions]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
