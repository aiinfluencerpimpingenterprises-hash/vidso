import { withCompedPlan, emailsFromUser } from '../../lib/comped.js'
import { saveIntentDurable } from '../../lib/checkout-intents.js'
import {
  buildCapiEvent,
  allowViewContent,
  capiUserData,
  claimRegistrationEvent,
  CLIENT_CAPI_EVENTS,
  purchaseEventId,
  SIGNED_IN_CAPI_EVENTS,
  sanitizeTestCode,
  sendMetaEvents,
} from '../../lib/meta-capi.js'
import { createCheckoutSession } from '../../lib/whop-checkout.js'
import { bearer, requireUser } from '../_lib/http.js'

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

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return xf || String(req.headers['x-real-ip'] || '') || ''
}

function queryKind(req) {
  const q = req?.query?.kind
  return String([].concat(q || [])[0] || '')
}

async function handlePixel(req, res, body) {
  const eventName = String(body.event_name || body.event || '').trim()
  if (!CLIENT_CAPI_EVENTS.has(eventName)) return send(res, 400, { error: 'Unsupported event' })
  const ip = clientIp(req)
  let email = ''
  let userId = ''
  if (SIGNED_IN_CAPI_EVENTS.has(eventName)) {
    // Conversions count for Ads, so they need a real signed-in user, and use
    // that user's own email and id; the body's email/user_id are ignored.
    const token = bearer(req)
    if (!token) return send(res, 401, { error: 'sign_in_required' })
    let user
    try {
      ;({ user } = await requireUser(req, token))
    } catch (e) {
      const status = e.status === 503 ? 503 : 401
      return send(res, status, { error: status === 401 ? 'sign_in_required' : (e.message || 'Try again') })
    }
    email = String(user?.email || emailFromJwt(token) || '').trim()
    userId = String(user?.id || user?.user_id || '').trim()
    if (!userId && !email) return send(res, 401, { error: 'sign_in_required' })
    if (eventName === 'CompleteRegistration' && !(await claimRegistrationEvent(userId || email))) {
      return send(res, 200, { received: true, pixel: 'duplicate' })
    }
  } else if (!allowViewContent(ip)) {
    // Anonymous page views: past the per-IP cap they are dropped quietly.
    res.statusCode = 204
    return res.end()
  }
  const result = await sendMetaEvents([
    buildCapiEvent({
      eventName,
      eventId: body.event_id,
      eventSourceUrl: String(body.event_source_url || req.headers.referer || 'https://www.tubeops.pro/').slice(0, 2048),
      userData: capiUserData({
        email,
        userId,
        fbp: body.fbp,
        fbc: body.fbc,
        ip,
        ua: req.headers['user-agent'],
      }),
      customData: body.custom_data && typeof body.custom_data === 'object' ? body.custom_data : {},
    }),
  ], process.env, { testEventCode: sanitizeTestCode(body.test_event_code) })
  return send(res, 200, { received: true, pixel: result.skipped || (result.ok ? 'sent' : 'failed') })
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
  // On Vercel, reading req.body throws on malformed JSON; treat that as an empty body, not a 500.
  let parsed
  try { parsed = req.body } catch (_) { return {} }
  if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed)) return parsed
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

  const body = await readJson(req).catch(() => ({}))
  if (queryKind(req) === 'pixel' || (body.event_name && !body.tier)) {
    return handlePixel(req, res, body)
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return send(res, 401, { error: 'Missing token' })
  const meRes = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token } })
  const data = await meRes.json().catch(() => ({}))
  if (!meRes.ok) return send(res, meRes.status, data)
  const user = withCompedPlan({ ...data, email: data.email || emailFromJwt(token) })
  if (!emailsFromUser(user).length) return send(res, 400, { error: 'This account has no email.' })

  const userId = user.id || user.user_id
  const rec = await saveIntentDurable(user, {
    tier: body.tier,
    cycle: body.cycle,
    fbp: body.fbp,
    fbc: body.fbc,
    ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || ''),
    ua: req.headers['user-agent'],
    eventId: purchaseEventId({ id: userId, email: emailsFromUser(user)[0] }, body.tier),
    testEventCode: sanitizeTestCode(body.test_event_code || body.testEventCode),
  })
  const origin = String(body.origin || req.headers.origin || 'https://www.tubeops.pro')
  const session = await createCheckoutSession({
    tier: body.tier,
    cycle: body.cycle,
    email: emailsFromUser(user)[0],
    userId: user.id || user.user_id,
    origin,
  })
  return send(res, 200, { ok: true, at: rec.at, url: session.url || '', source: session.source })
}
