/**
 * Cloud adapter: talks to the LifeOS API (Express + MongoDB Atlas).
 *
 * Authentication uses an HttpOnly session cookie set by the server, so no
 * credential or token is ever readable by JavaScript or kept in browser storage.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Codes meaning "you are no longer signed in" — the app returns to the sign-in screen. */
export const SESSION_ENDED_CODES = new Set(['NO_SESSION', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'ACCOUNT_NOT_FOUND', 'ACCOUNT_PENDING', 'ACCOUNT_REJECTED', 'ACCOUNT_SUSPENDED']);
export const AUTH_EVENT = 'lifeos:session-ended';

export class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

// Remove the bearer token kept by earlier versions (sessions now live in an HttpOnly cookie).
try {
  localStorage.removeItem('lifeos.token');
} catch {
  /* storage unavailable */
}

const OFFLINE_MESSAGE = 'Can’t reach the LifeOS API server. Make sure it is running (npm run dev) and check its terminal for errors.';

/** The API (or its database) is still starting: the request never reached a route, so any method can be retried. */
const STARTING_CODES = new Set(['API_STARTING', 'DB_CONNECTING']);
/** Waits between attempts while the API starts or restarts (~20 s in total). */
const RETRY_DELAYS_MS = [400, 800, 1200, 1600, 2000, 2500, 3000, 3000, 3000, 3000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(path, method, headers, body) {
  for (let attempt = 0; ; attempt += 1) {
    const canRetry = attempt < RETRY_DELAYS_MS.length;
    let res;
    try {
      res = await fetch(`${BASE}/api${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      // Network failure: only reads are retried — a write may already have been applied.
      if (canRetry && method === 'GET') {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ApiError(0, OFFLINE_MESSAGE);
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.status === 503 && STARTING_CODES.has(json?.code) && canRetry) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    return { res, json };
  }
}

async function request(path, { method = 'GET', body, quietAuth = false } = {}) {
  // The custom header is required by the server's CSRF protection.
  const headers = { Accept: 'application/json', 'X-LifeOS-Client': '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const { res, json } = await send(path, method, headers, body);
  if (!res.ok) {
    if (json?.code === 'API_STARTING') throw new ApiError(res.status, OFFLINE_MESSAGE, undefined, 'API_STARTING');
    // A non-JSON error (e.g. 502 from the dev proxy) means the API itself isn't answering.
    if (json === null && res.status >= 500) throw new ApiError(res.status, OFFLINE_MESSAGE);
    const code = json?.code;
    // A protected call found the session gone (expired, logged out elsewhere, suspended…).
    if (!quietAuth && SESSION_ENDED_CODES.has(code)) {
      window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { code, message: json?.error } }));
    }
    const detail = json?.details && typeof json.details === 'object' && Object.keys(json.details).length > 1 ? Object.values(json.details).join(' ') : '';
    throw new ApiError(res.status, [json?.error || `Request failed (${res.status})`, detail].filter(Boolean).join(' '), json?.details, code);
  }
  return json;
}

export function createRemoteAdapter() {
  return {
    mode: 'cloud',

    /** The signed-in account for the current session cookie, or null. */
    async restore() {
      const { user } = await request('/auth/session', { quietAuth: true });
      return user || null;
    },
    /** Creates a registration request; it stays pending until the administrator approves it. */
    register: ({ name, email, password }) => request('/auth/register', { method: 'POST', body: { name, email, password }, quietAuth: true }),
    async login({ email, password }) {
      const { user } = await request('/auth/login', { method: 'POST', body: { email, password }, quietAuth: true });
      return user;
    },
    async logout() {
      await request('/auth/logout', { method: 'POST', quietAuth: true }).catch(() => {});
    },
    changePassword: (currentPassword, newPassword) =>
      request('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } }),

    loadAll: () => request('/data'),
    saveProfile: (profile) => request('/account/profile', { method: 'PUT', body: profile }),

    create: (collection, doc) => request(`/data/${collection}`, { method: 'POST', body: doc }),
    bulkCreate: (collection, items) => request(`/data/${collection}/bulk`, { method: 'POST', body: { items } }),
    update: (collection, id, patch) => request(`/data/${collection}/${id}`, { method: 'PUT', body: patch }),
    remove: (collection, id) => request(`/data/${collection}/${id}`, { method: 'DELETE' }),

    exportAll: () => request('/account/export'),
    importAll: (payload, mode = 'replace') => request(`/account/import?mode=${mode}`, { method: 'POST', body: payload }),
    wipeData: () => request('/account/data', { method: 'DELETE' }),
    aiStatus: () => request('/ai/status'),
    aiChat: (messages, context) => request('/ai/chat', { method: 'POST', body: { messages, context } }),

    deleteAccount: (password) => request('/account', { method: 'DELETE', body: { password } }),

    // Administrator console (the server rejects these for every non-admin session).
    admin: {
      summary: () => request('/admin/summary'),
      users: (status = 'all', q = '') => request(`/admin/users?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`),
      history: () => request('/admin/history'),
      act: (id, action, note) => request(`/admin/users/${id}/${action}`, { method: 'POST', body: { note } }),
      remove: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    },
  };
}
