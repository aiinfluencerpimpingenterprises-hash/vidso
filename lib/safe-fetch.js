// Server-side fetch of a URL a client handed us (voiceover parts, generated
// images). Without limits that is an SSRF: the server would read internal
// addresses or any site for the caller. So only https on our own storage and
// provider hosts, no IP literals, every redirect re-checked, a timeout, and a
// byte cap that stops reading as soon as it is passed. Server-only.

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

// A leading dot means "this domain's subdomains"; no dot means that exact host.
export const SAFE_FETCH_HOSTS = [
  'vibrant-patience-production-a7f0.up.railway.app',
  '.supabase.co',
  '.r2.dev',
  '.r2.cloudflarestorage.com',
  'fal.media',
  '.fal.media',
  '.fal.ai',
  '.fal.run',
  '.elevenlabs.io',
  '.googleusercontent.com',
  '.amazonaws.com',
  '.cloudfront.net',
]

export const MB = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 30000
const MAX_REDIRECTS = 3

function upstreamHost() {
  try {
    const u = new URL(UPSTREAM)
    return u.protocol === 'https:' ? u.hostname.toLowerCase() : ''
  } catch (_) {
    return ''
  }
}

function isIpLiteral(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[') || /^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)
}

/** True for an https URL on an allowed host (anchored suffix match on the parsed hostname). */
export function safeFetchAllowed(value) {
  let u
  try { u = new URL(String(value || '')) } catch (_) { return false }
  if (u.protocol !== 'https:' || u.username || u.password) return false
  if (u.port && u.port !== '443') return false
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || isIpLiteral(host)) return false
  if (host === upstreamHost()) return true
  return SAFE_FETCH_HOSTS.some((entry) => (entry.startsWith('.') ? host.endsWith(entry) && host.length > entry.length : host === entry))
}

function fail(message, code, status) {
  const err = new Error(message)
  err.code = code
  err.status = status
  return err
}

/**
 * GET an allowed URL and read at most `maxBytes`.
 * Resolves { status, ok, headers, buffer }; throws with err.code one of
 * host_not_allowed | too_large | timeout | too_many_redirects | fetch_failed.
 */
export async function safeFetch(url, { maxBytes = 20 * MB, timeoutMs = DEFAULT_TIMEOUT_MS, headers, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let current = String(url || '')
    for (let hop = 0; ; hop++) {
      if (!safeFetchAllowed(current)) throw fail('URL host not allowed', 'host_not_allowed', 400)
      let res
      try {
        res = await fetchImpl(current, { headers, redirect: 'manual', signal: ctrl.signal })
      } catch (e) {
        if (ctrl.signal.aborted) throw fail('Timed out reading the file', 'timeout', 504)
        throw fail('Could not read the file', 'fetch_failed', 502)
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers?.get?.('location')
        try { await res.body?.cancel?.() } catch (_) {}
        if (!loc) throw fail('Could not read the file', 'fetch_failed', 502)
        if (hop >= MAX_REDIRECTS) throw fail('Too many redirects', 'too_many_redirects', 502)
        current = new URL(loc, current).toString()
        continue
      }
      const declared = Number(res.headers?.get?.('content-length'))
      if (Number.isFinite(declared) && declared > maxBytes) {
        try { await res.body?.cancel?.() } catch (_) {}
        throw fail('File is too large', 'too_large', 413)
      }
      const buffer = await readCapped(res, maxBytes, ctrl)
      return { status: res.status, ok: res.ok, headers: res.headers, buffer }
    }
  } finally {
    clearTimeout(timer)
  }
}

async function readCapped(res, maxBytes, ctrl) {
  const reader = res.body?.getReader?.()
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > maxBytes) throw fail('File is too large', 'too_large', 413)
    return buf
  }
  const chunks = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        try { await reader.cancel() } catch (_) {}
        throw fail('File is too large', 'too_large', 413)
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength))
    }
  } catch (e) {
    if (e.code) throw e
    if (ctrl.signal.aborted) throw fail('Timed out reading the file', 'timeout', 504)
    throw fail('Could not read the file', 'fetch_failed', 502)
  }
  return Buffer.concat(chunks, total)
}
