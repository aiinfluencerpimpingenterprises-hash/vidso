import { AsyncLocalStorage } from 'node:async_hooks';
import { VIDSO_API_BASE } from './config.js';

export const authStore = new AsyncLocalStorage();

export function getVidsoToken() {
  const store = authStore.getStore();
  if (!store?.token) {
    throw new Error('Not authenticated. Connect the Vidso connector and sign in with your Vidso account.');
  }
  return store.token;
}

export class VidsoApiError extends Error {
  constructor(message, { status, code, needsPlan, data } = {}) {
    super(message);
    this.name = 'VidsoApiError';
    this.status = status;
    this.code = code;
    this.needsPlan = needsPlan;
    this.data = data;
  }
}

export async function vidsoFetch(method, path, { body, token, isFormData = false } = {}) {
  const auth = token || getVidsoToken();
  const headers = { Authorization: `Bearer ${auth}` };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(VIDSO_API_BASE + path, {
      method,
      headers,
      body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new VidsoApiError(`Cannot reach Vidso API: ${err.message}`, { status: 0 });
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') || res.status === 401 || res.status === 402 || res.status >= 400) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new VidsoApiError(data.message || data.error || `Request failed (${res.status})`, {
        status: res.status,
        code: data.error,
        needsPlan: res.status === 402,
        data,
      });
    }
    return data;
  }

  if (!res.ok) {
    throw new VidsoApiError(`Request failed (${res.status})`, { status: res.status });
  }
  return res;
}

async function publicPost(path, body) {
  const res = await fetch(VIDSO_API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new VidsoApiError(data.message || data.error || `Request failed (${res.status})`, {
      status: res.status,
      code: data.error,
      data,
    });
  }
  return data;
}

export const api = {
  login: (email, password) => publicPost('/api/auth/login', { email, password }),

  refresh: (refresh_token) => publicPost('/api/auth/refresh', { refresh_token }),

  me: (token) => vidsoFetch('GET', '/api/user/me', { token }),

  voices: () => vidsoFetch('GET', '/api/tts/voices'),

  presets: () => vidsoFetch('GET', '/api/faceless/presets'),

  createScript: (body) => vidsoFetch('POST', '/api/faceless/script', { body }),

  rewriteSection: (body) => vidsoFetch('POST', '/api/faceless/script/section', { body }),

  startMedia: (body) => vidsoFetch('POST', '/api/faceless/media', { body }),

  pollMedia: (jobId) => vidsoFetch('GET', `/api/faceless/media/${jobId}`),

  searchBroll: (body) => vidsoFetch('POST', '/api/faceless/broll/search', { body }),

  startRender: (body) => vidsoFetch('POST', '/api/faceless/render', { body }),

  pollRender: (jobId) => vidsoFetch('GET', `/api/faceless/render/${jobId}`),

  downloadUrl: (jobId, token) =>
    `${VIDSO_API_BASE}/api/faceless/render/${encodeURIComponent(jobId)}/download?token=${encodeURIComponent(token || getVidsoToken())}`,
};

export async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Poll until terminal status. Media uses ready/error; render uses done/error. */
export async function pollUntil(kind, jobId, { timeoutMs = 280000, intervalMs = 4000, onProgress } = {}) {
  const started = Date.now();
  const terminalOk = kind === 'media' ? new Set(['ready']) : new Set(['done', 'ready', 'complete', 'completed']);
  const terminalBad = new Set(['error', 'failed']);

  while (Date.now() - started < timeoutMs) {
    const data = kind === 'media' ? await api.pollMedia(jobId) : await api.pollRender(jobId);
    if (onProgress) onProgress(data);
    const status = String(data.status || '').toLowerCase();
    if (terminalOk.has(status)) return data;
    if (terminalBad.has(status)) {
      throw new VidsoApiError(data.error || data.message || `${kind} job failed`, {
        status: 500,
        data,
      });
    }
    await sleep(intervalMs);
  }
  throw new VidsoApiError(`${kind} job timed out after ${Math.round(timeoutMs / 1000)}s`, { status: 504 });
}
