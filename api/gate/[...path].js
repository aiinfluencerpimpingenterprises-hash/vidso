import { handleFacelessStudio } from '../../lib/faceless-studio-api.js'
import { isStudioGatePath, studioGateSegs } from '../../lib/studio-gate.js'
import { evaluateFeature, evaluateGeneration, evaluateLength, toHttp } from '../../lib/enforce.js'
import { enrichScriptBody, scriptUpstreamBody } from '../../lib/faceless-length.js'
import { durationFromBody, generationKindFromSeconds } from '../../lib/quota.js'
import { incrementUsage, readUsage } from '../../lib/usage-store.js'
import { withCompedPlan, planIsActive } from '../../lib/comped.js'
import { applyPaidGrant } from '../../lib/paid-grant.js'
import { saveGrant, withStoredGrant } from '../../lib/grants.js'
import { lookupPaidMembership } from '../../lib/whop-lookup.js'
import { isJsonSyntaxError, recoverScriptData } from '../../lib/json-repair.js'
import { railwayUpload } from '../../lib/railway-files.js'

export const config = { maxDuration: 60 }

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function ruleFor(method, subpath) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  if (method === 'GET' && (p === 'usage' || p === 'quota')) return { type: 'usage' }
  if (method === 'POST' && p === 'faceless/script') return { type: 'length' }
  if (method === 'POST' && p === 'faceless/media') return { type: 'length' }
  if (method === 'POST' && p === 'faceless/render') return { type: 'generate' }
  if (method === 'POST' && p === 'download/analyze') return { type: 'feature', feature: 'viral_moment_clipping' }
  if (method === 'POST' && (p === 'autoclip' || p.startsWith('autoclip/'))) return { type: 'feature', feature: 'viral_moment_clipping' }
  return { type: 'forward' }
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

function emailFromJwt(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return ''
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return String(json.email || json.user_email || '').trim()
  } catch {
    return ''
  }
}

async function railwayMe(token) {
  const res = await fetch(UPSTREAM + '/api/user/me', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    err.body = data
    throw err
  }
  let user = withStoredGrant(withCompedPlan({ ...data, email: data.email || emailFromJwt(token) }))
  if (planIsActive(user)) return user
  try {
    const hit = await lookupPaidMembership(user)
    if (hit?.active && hit.tier) {
      user = applyPaidGrant(user, saveGrant(user, hit))
    } else if (hit?.active && hit.legacy) {
      user = { ...user, plan_status: 'active', active: true }
    }
  } catch (_) {}
  return user
}

async function forward(req, subpath, body) {
  const url = UPSTREAM + '/api/' + subpath
  const headers = { Authorization: req.headers.authorization || '' }
  const method = req.method
  let payload
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body || {})
  }
  const res = await fetch(url, { method, headers, body: payload })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  return { status: res.status, data, text }
}

async function concatVoiceoverParts(res, token, body) {
  const urls = Array.isArray(body?.urls) ? body.urls.map((u) => String(u || '').trim()).filter(Boolean) : []
  if (urls.length < 2) return send(res, 400, { error: 'Need at least two voiceover parts' })
  if (urls.length > 12) return send(res, 400, { error: 'Too many voiceover parts' })
  const parts = []
  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) return send(res, 400, { error: 'Invalid voiceover URL' })
    const got = await fetch(url)
    if (!got.ok) return send(res, 502, { error: 'Could not read a voiceover part' })
    parts.push(Buffer.from(await got.arrayBuffer()))
  }
  try {
    const rec = await railwayUpload(token, {
      buffer: Buffer.concat(parts),
      filename: 'vidso-voiceover.mp3',
      mime: 'audio/mpeg',
    })
    return send(res, 200, rec)
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Could not save the merged voiceover' })
  }
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const parts = [].concat(req.query.path || [])
  const subpath = parts.join('/')
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return send(res, 401, { error: 'Missing token' })

  let user
  try {
    user = await railwayMe(token)
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const studioPath = String(subpath || '').replace(/^\/+|\/+$/g, '')
  if (isStudioGatePath(studioPath)) {
    const query = new URL(req.url, 'http://localhost').searchParams
    const segs = studioGateSegs(studioPath, query)
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJson(req)
    try {
      const out = await handleFacelessStudio({ token, user, method: req.method, segs, query, body })
      return send(res, out.status, out.body)
    } catch (e) {
      return send(res, e.status || 500, { error: e.message || 'Studio request failed' })
    }
  }

  const rule = ruleFor(req.method, subpath)
  const usage = readUsage(user)

  if (rule.type === 'usage') {
    return send(res, 200, {
      long_form_used: usage.long_form_used,
      short_form_used: usage.short_form_used,
      known: true,
      plan: user.plan || user.plan_tier,
      plan_status: user.plan_status,
    })
  }

  let body = req.method === 'GET' ? {} : await readJson(req)
  if (req.method === 'POST' && String(subpath).replace(/^\/+|\/+$/g, '') === 'media/concat') {
    return concatVoiceoverParts(res, token, body)
  }
  const seconds = durationFromBody(body)
  const kind = generationKindFromSeconds(seconds)
  if (req.method === 'POST' && String(subpath).replace(/^\/+|\/+$/g, '') === 'faceless/script') {
    body = enrichScriptBody(body, seconds)
  }

  if (rule.type === 'feature') {
    const gate = evaluateFeature({ user, feature: rule.feature })
    if (!gate.ok) {
      const http = toHttp(gate)
      return send(res, http.status, http.body)
    }
  }

  if (rule.type === 'length' || rule.type === 'generate') {
    const gate = rule.type === 'generate'
      ? evaluateGeneration({
        user,
        durationSeconds: seconds,
        kind: kind || undefined,
        used: kind === 'short_form' ? usage.short_form_used : usage.long_form_used,
      })
      : evaluateLength({ user, durationSeconds: seconds })
    if (!gate.ok) {
      const http = toHttp(gate)
      return send(res, http.status, http.body)
    }
  }

  const path = String(subpath).replace(/^\/+|\/+$/g, '')
  const forwardBody = path === 'faceless/script' ? scriptUpstreamBody(body) : body
  const upstream = await forward(req, subpath, forwardBody)
  if (path === 'faceless/script') {
    const recovered = recoverScriptData(upstream.data, upstream.text)
    if (recovered && (
      upstream.status < 400 ||
      isJsonSyntaxError(upstream.data?.error || upstream.data?.message || upstream.text)
    )) {
      upstream.status = 200
      upstream.data = recovered
    }
  }
  if (upstream.status >= 200 && upstream.status < 300 && rule.type === 'generate') {
    const g = evaluateGeneration({
      user,
      durationSeconds: seconds,
      kind: kind || undefined,
      used: kind === 'short_form' ? usage.short_form_used : usage.long_form_used,
    })
    if (g.ok && g.increment) incrementUsage(user, g.kind)
  }
  return send(res, upstream.status, upstream.data)
}
