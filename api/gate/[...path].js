import { handleFacelessStudio } from '../../lib/faceless-studio-api.js'
import { isStudioGatePath, studioRouteFromReq } from '../../lib/studio-gate.js'
import { resolveVidsoUser, runGatedApi } from '../../lib/gate-run.js'
import { railwayUpload } from '../../lib/railway-files.js'
import { MB, safeFetch, safeFetchAllowed } from '../../lib/safe-fetch.js'

const PART_MAX_BYTES = 25 * MB
const JOINED_MAX_BYTES = 40 * MB

export const config = { maxDuration: 300 }

async function readJson(req) {
  // On Vercel, reading req.body throws on malformed JSON; treat that as an empty body, not a 500.
  let parsed
  try { parsed = req.body } catch (_) { return {} }
  if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed)) return parsed
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

// Generating one video fires a burst of studio calls, and each one used to
// re-fetch /user/me plus a Whop entitlement lookup before doing any work.
const ME_TTL_MS = 15000
const ME_MAX = 32
const meCache = new Map()

function cachedMe(token) {
  const hit = meCache.get(token)
  if (!hit) return null
  if (Date.now() - hit.at > ME_TTL_MS) {
    meCache.delete(token)
    return null
  }
  return hit.user
}

function rememberMe(token, user) {
  if (meCache.size >= ME_MAX && !meCache.has(token)) {
    meCache.delete(meCache.keys().next().value)
  }
  meCache.set(token, { at: Date.now(), user })
}

async function concatVoiceoverParts(res, token, body) {
  const urls = Array.isArray(body?.urls) ? body.urls.map((u) => String(u || '').trim()).filter(Boolean) : []
  if (urls.length < 2) return send(res, 400, { error: 'Need at least two voiceover parts' })
  if (urls.length > 24) return send(res, 400, { error: 'Too many voiceover parts' })
  // Only our storage and provider hosts: this server must not fetch whatever URL it is handed.
  if (!urls.every(safeFetchAllowed)) return send(res, 400, { error: 'Voiceover host not allowed' })
  const parts = []
  let total = 0
  for (const url of urls) {
    // ~40MB joined upload tends to trip Railway; stop reading as soon as it would pass that.
    const room = JOINED_MAX_BYTES - total
    let got
    try {
      got = await safeFetch(url, { maxBytes: Math.min(PART_MAX_BYTES, room) })
    } catch (e) {
      if (e.code === 'too_large') return send(res, 413, { error: 'Joined voiceover is too large to upload. Try a shorter script.' })
      if (e.code === 'host_not_allowed') return send(res, 400, { error: 'Voiceover host not allowed' })
      return send(res, 502, { error: 'Could not read a voiceover part' })
    }
    if (!got.ok) return send(res, 502, { error: 'Could not read a voiceover part' })
    total += got.buffer.length
    parts.push(got.buffer)
  }
  try {
    const rec = await railwayUpload(token, {
      buffer: Buffer.concat(parts),
      filename: 'vidso-voiceover.mp3',
      mime: 'audio/mpeg',
    })
    return send(res, 200, rec)
  } catch (e) {
    const msg = e.message || 'Could not save the merged voiceover'
    return send(res, e.status || 502, {
      error: /upload failed/i.test(msg)
        ? 'Upload failed while saving the joined voiceover'
        : msg,
      code: 'voiceover_upload_failed',
      urls,
    })
  }
}

/** Same-origin proxy so the browser can byte-join CDN voiceovers without CORS. */
async function proxyVoiceoverPart(res, rawUrl) {
  const url = String(rawUrl || '').trim()
  if (!/^https?:\/\//i.test(url)) return send(res, 400, { error: 'Invalid voiceover URL' })
  // Only proxy our upstream / object-storage / provider hosts (anchored match, no IPs).
  if (!safeFetchAllowed(url)) return send(res, 400, { error: 'Voiceover host not allowed' })
  let got
  try {
    got = await safeFetch(url, { maxBytes: PART_MAX_BYTES })
  } catch (e) {
    if (e.code === 'too_large') return send(res, 413, { error: 'Voiceover part is too large' })
    if (e.code === 'host_not_allowed') return send(res, 400, { error: 'Voiceover host not allowed' })
    return send(res, 502, { error: 'Could not read voiceover part' })
  }
  if (!got.ok) return send(res, 502, { error: 'Could not read voiceover part' })
  const buf = got.buffer
  // Never pass through a type that the browser would run as a page on our origin.
  const type = String(got.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', /^(audio|video)\//.test(type) || type === 'application/octet-stream' ? type : 'audio/mpeg')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, max-age=60')
  res.setHeader('Access-Control-Allow-Origin', res.getHeader('Access-Control-Allow-Origin') || '*')
  return res.end(buf)
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-vidso-studio, x-vidso-path')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  let route
  try {
    route = studioRouteFromReq(req)
  } catch (e) {
    // A path with `..`, `.`, encoded slashes and the like: refused before any upstream call.
    return send(res, e.status || 400, { error: e.message || 'Invalid API path', code: e.code || 'invalid_path' })
  }
  const { subpath, segs, query } = route
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return send(res, 401, { error: 'Missing token' })

  // Only studio reads reuse a cached identity. Quota and usage paths always
  // re-resolve so a fresh purchase or a spent generation is never stale.
  const studioPath = isStudioGatePath(subpath)
  let user = studioPath ? cachedMe(token) : null
  if (!user) {
    try {
      user = await resolveVidsoUser(token)
      if (studioPath) rememberMe(token, user)
    } catch (e) {
      return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
    }
  }

  if (studioPath) {
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJson(req)
    try {
      const out = await handleFacelessStudio({ token, user, method: req.method, segs, query, body })
      return send(res, out.status, out.body)
    } catch (e) {
      return send(res, e.status || 500, { error: e.message || 'Studio request failed' })
    }
  }

  try {
    const path = String(subpath).replace(/^\/+|\/+$/g, '')
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJson(req)
    if (req.method === 'GET' && path === 'media/fetch') {
      return proxyVoiceoverPart(res, query.get('url') || '')
    }
    if (req.method === 'POST' && path === 'media/concat') {
      return concatVoiceoverParts(res, token, body)
    }
    const out = await runGatedApi({
      token,
      user,
      method: req.method,
      subpath: path,
      body,
      query,
    })
    return send(res, out.status, out.body)
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Request failed' })
  }
}
