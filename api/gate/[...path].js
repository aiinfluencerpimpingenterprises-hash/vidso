import { evaluateFeature, evaluateGeneration, evaluateLength, toHttp } from '../../lib/enforce.js'
import { durationFromBody, generationKindFromSeconds } from '../../lib/quota.js'
import { incrementUsage, readUsage } from '../../lib/usage-store.js'

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
  return data
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
  return { status: res.status, data }
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
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

  const body = req.method === 'GET' ? {} : await readJson(req)
  const seconds = durationFromBody(body)
  const kind = generationKindFromSeconds(seconds)

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

  const upstream = await forward(req, subpath, body)
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
