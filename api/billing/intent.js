import { withCompedPlan, emailsFromUser } from '../../lib/comped.js'
import { saveIntent } from '../../lib/checkout-intents.js'
import { createCheckoutSession } from '../../lib/whop-checkout.js'

export const config = { maxDuration: 15 }

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
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

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return send(res, 401, { error: 'Missing token' })
  const meRes = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token } })
  const data = await meRes.json().catch(() => ({}))
  if (!meRes.ok) return send(res, meRes.status, data)
  const user = withCompedPlan({ ...data, email: data.email || emailFromJwt(token) })
  if (!emailsFromUser(user).length) return send(res, 400, { error: 'This account has no email.' })

  const body = await readJson(req).catch(() => ({}))
  const rec = saveIntent(user, { tier: body.tier, cycle: body.cycle })
  const origin = String(body.origin || req.headers.origin || 'https://vidso.pro')
  const session = await createCheckoutSession({
    tier: body.tier,
    cycle: body.cycle,
    email: emailsFromUser(user)[0],
    userId: user.id || user.user_id,
    origin,
  })
  return send(res, 200, { ok: true, at: rec.at, url: session.url || '', source: session.source })
}
