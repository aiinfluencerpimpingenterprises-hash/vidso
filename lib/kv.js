// Durable key/value storage for the server: Supabase or Upstash. Server-only.
//
// Vercel gives every lambda its own `/tmp` and wipes it on cold start, so
// anything we need to remember between requests — above all who has paid and
// how many credits they have used — cannot live on disk or in process memory.
// This is that memory.
//
// Two backends speak the same small set of Redis commands:
// - Supabase: the public.tubeops_kv(cmd, args) function from
//   docs/supabase-kv.sql, called over REST with the service role key.
// - Upstash Redis over its REST API (used instead when its variables are set).
//
// Reads and writes are best-effort by design: if the store is unreachable the
// caller falls back to its in-process copy. A store outage must never be able
// to tell a paying customer they are on the free plan.

const TIMEOUT_MS = 2500
const SUPABASE_PROJECT_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'

function readEnv(env, name) {
  if (env && env[name]) return String(env[name]).trim()
  try {
    if (typeof process !== 'undefined' && process.env?.[name]) return String(process.env[name]).trim()
  } catch (_) {}
  return ''
}

// `UPSTASH_*` is what Upstash hands you directly; `KV_REST_API_*` is what the
// Vercel Upstash integration injects. Supabase needs only the service role key
// (new `sb_secret_…` keys and legacy JWT keys both work).
export function kvConfig(env) {
  const read = (name) => readEnv(env, name)
  const upstashUrl = (read('UPSTASH_REDIS_REST_URL') || read('KV_REST_API_URL')).replace(/\/+$/, '')
  const upstashToken = read('UPSTASH_REDIS_REST_TOKEN') || read('KV_REST_API_TOKEN')
  if (upstashUrl && upstashToken) return { kind: 'upstash', url: upstashUrl, token: upstashToken }
  const supaKey = read('SUPABASE_SERVICE_ROLE_KEY') || read('SUPABASE_SECRET_KEY')
  if (supaKey) {
    const base = (read('SUPABASE_URL') || SUPABASE_PROJECT_URL).replace(/\/+$/, '')
    return { kind: 'supabase', url: base + '/rest/v1/rpc/tubeops_kv', token: supaKey }
  }
  return { kind: '', url: '', token: '' }
}

export function kvConfigured(env) {
  const { url, token } = kvConfig(env)
  return !!(url && token)
}

/** One command against the store: `{ ok, result }`, never throws. */
async function run(args, env) {
  const { kind, url, token } = kvConfig(env)
  if (!url || !token) return { ok: false, result: null }
  try {
    const supabase = kind === 'supabase'
    const headers = { 'Content-Type': 'application/json' }
    if (supabase) {
      headers.apikey = token
      // Legacy service_role keys are JWTs and go in Authorization too.
      if (token.startsWith('eyJ')) headers.Authorization = 'Bearer ' + token
    } else {
      headers.Authorization = 'Bearer ' + token
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(supabase ? { cmd: String(args[0]), args: args.slice(1).map((a) => (typeof a === 'number' ? a : String(a))) } : args),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, result: null }
    const data = await res.json().catch(() => undefined)
    if (data === undefined) return { ok: false, result: null }
    if (supabase) return { ok: true, result: data ?? null }
    if (!data || data.error) return { ok: false, result: null }
    return { ok: true, result: data.result ?? null }
  } catch (_) {
    return { ok: false, result: null }
  }
}

/** Run one command. Returns `null` on any failure, never throws. */
async function command(args, env) {
  const { ok, result } = await run(args, env)
  return ok ? result : null
}

export async function kvGetJson(key, env) {
  const raw = await command(['GET', key], env)
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

/** Like kvGetJson, but `undefined` when the store could not be read (vs `null` for missing). */
export async function kvReadJson(key, env) {
  const { ok, result } = await run(['GET', key], env)
  if (!ok) return undefined
  if (typeof result !== 'string' || !result) return null
  try { return JSON.parse(result) } catch (_) { return null }
}

export async function kvSetJson(key, value, env) {
  const raw = JSON.stringify(value)
  return (await command(['SET', key, raw], env)) !== null
}

/** SET with an expiry in seconds (records that clean themselves up). */
export async function kvSetJsonTtl(key, value, seconds, env) {
  return (await command(['SET', key, JSON.stringify(value), 'EX', String(Math.max(1, Math.round(seconds)))], env)) !== null
}

/** Take a short lock: true only for the caller that set it. Expires by itself. */
export async function kvLock(key, seconds, env) {
  return (await command(['SET', key, String(Date.now()), 'NX', 'EX', String(Math.max(1, Math.round(seconds)))], env)) === 'OK'
}

export async function kvDel(key, env) {
  return (await command(['DEL', key], env)) !== null
}

/** Add members to a set. Used to track every key a record is filed under. */
export async function kvSetAdd(key, members, env) {
  const list = [].concat(members).filter(Boolean)
  if (!list.length) return false
  return (await command(['SADD', key, ...list], env)) !== null
}

export async function kvSetMembers(key, env) {
  const raw = await command(['SMEMBERS', key], env)
  return Array.isArray(raw) ? raw.map(String) : []
}

/** Atomically add to one field of a hash. Returns the new value, or null when the store is down. */
export async function kvHashIncr(key, field, by, env) {
  const raw = await command(['HINCRBY', key, field, String(Math.trunc(Number(by) || 0))], env)
  const n = Number(raw)
  return raw === null || !Number.isFinite(n) ? null : n
}

/** Every field of a hash as numbers-or-strings; {} when missing, null when the store is down. */
export async function kvHashGetAll(key, env) {
  const raw = await command(['HGETALL', key], env)
  if (raw === null) return null
  const out = {}
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = raw[i + 1]
  } else if (raw && typeof raw === 'object') {
    Object.assign(out, raw)
  }
  return out
}

/** Set a hash field only if it is not there yet (first writer wins). */
export async function kvHashSetNx(key, field, value, env) {
  return (await command(['HSETNX', key, field, String(value)], env)) === 1
}

/** SET only if the key is missing; returns the value that ends up stored. */
export async function kvSetNxGet(key, value, seconds, env) {
  const args = ['SET', key, String(value), 'NX', 'GET']
  if (seconds) args.push('EX', String(Math.max(1, Math.round(seconds))))
  const prior = await command(args, env)
  return prior === null ? String(value) : String(prior)
}

export async function kvExpire(key, seconds, env) {
  return (await command(['EXPIRE', key, String(Math.max(1, Math.round(seconds)))], env)) !== null
}

export async function kvGet(key, env) {
  const raw = await command(['GET', key], env)
  return raw === null ? null : String(raw)
}

export async function kvSet(key, value, env) {
  return (await command(['SET', key, String(value)], env)) !== null
}

export const _kvInternals = { command, run }
