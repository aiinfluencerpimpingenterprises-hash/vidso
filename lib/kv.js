// Durable key/value storage over Upstash's HTTP REST API. Server-only.
//
// Vercel gives every lambda its own `/tmp` and wipes it on cold start, so
// anything we need to remember between requests — above all who has paid —
// cannot live on disk or in process memory. This is that memory.
//
// Reads and writes are best-effort by design: if the store is unreachable the
// caller falls back to its in-process copy. A KV outage must never be able to
// tell a paying customer they are on the free plan.

const TIMEOUT_MS = 2500

// `UPSTASH_*` is what Upstash hands you directly; `KV_REST_API_*` is what the
// Vercel Upstash integration injects. Accept either so setup cannot be wrong.
export function kvConfig(env) {
  const read = (name) => {
    if (env && env[name]) return String(env[name]).trim()
    try {
      if (typeof process !== 'undefined' && process.env?.[name]) return String(process.env[name]).trim()
    } catch (_) {}
    return ''
  }
  return {
    url: (read('UPSTASH_REDIS_REST_URL') || read('KV_REST_API_URL')).replace(/\/+$/, ''),
    token: read('UPSTASH_REDIS_REST_TOKEN') || read('KV_REST_API_TOKEN'),
  }
}

export function kvConfigured(env) {
  const { url, token } = kvConfig(env)
  return !!(url && token)
}

/** Run one Redis command. Returns `null` on any failure, never throws. */
async function command(args, env) {
  const { url, token } = kvConfig(env)
  if (!url || !token) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data || data.error) return null
    return data.result ?? null
  } catch (_) {
    return null
  }
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

export async function kvSetJson(key, value, env) {
  const raw = JSON.stringify(value)
  return (await command(['SET', key, raw], env)) !== null
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

export const _kvInternals = { command }
