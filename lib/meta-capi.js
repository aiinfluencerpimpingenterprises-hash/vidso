// Meta Conversions API. Server-only. Browser pixel still fires the same
// event_id so Events Manager can dedupe; this path is what Ads actually
// sees when the buyer pays on Whop and the pixel never loads on return.

import { createHash } from 'node:crypto'
import { META_PIXEL_ID, checkoutPayload, conversionEventId } from './meta-pixel.js'
import { normalizeTier } from './entitlements.js'

const GRAPH = 'https://graph.facebook.com/v21.0'
export const CLIENT_CAPI_EVENTS = new Set(['CompleteRegistration', 'ViewContent', 'InitiateCheckout'])
export const TEST_EVENT_RE = /^TEST[A-Z0-9]+$/i

function envVal(env, name) {
  if (env && env[name]) return String(env[name]).trim()
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name]).trim()
    }
  } catch (_) {}
  return ''
}

export function metaCapiConfig(env) {
  return {
    pixelId: envVal(env, 'META_PIXEL_ID') || META_PIXEL_ID,
    accessToken: envVal(env, 'META_CAPI_ACCESS_TOKEN') || envVal(env, 'META_PIXEL_ACCESS_TOKEN'),
    testEventCode: sanitizeTestCode(envVal(env, 'META_TEST_EVENT_CODE')),
  }
}

export function sanitizeTestCode(value) {
  const code = String(value || '').trim()
  return TEST_EVENT_RE.test(code) ? code.toUpperCase() : ''
}

export function sha256hex(value) {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return ''
  return createHash('sha256').update(s).digest('hex')
}

export function capiUserData({ email, userId, fbp, fbc, ip, ua } = {}) {
  const user_data = {}
  const em = sha256hex(email)
  const ext = sha256hex(userId)
  if (em) user_data.em = [em]
  if (ext) user_data.external_id = [ext]
  if (fbp) user_data.fbp = String(fbp)
  if (fbc) user_data.fbc = String(fbc)
  if (ip) user_data.client_ip_address = String(ip)
  if (ua) user_data.client_user_agent = String(ua)
  return user_data
}

export function purchaseEventId(identity, tier) {
  const who = String(identity?.id || identity?.userId || identity?.email || 'anon').trim().toLowerCase()
  return conversionEventId('Purchase', who, normalizeTier(tier) || 'plus')
}

export function buildCapiEvent({ eventName, eventId, eventSourceUrl, userData, customData, eventTime } = {}) {
  const row = {
    event_name: eventName,
    event_time: eventTime || Math.floor(Date.now() / 1000),
    event_id: eventId || conversionEventId(eventName),
    action_source: 'website',
    user_data: userData && typeof userData === 'object' ? userData : {},
  }
  if (eventSourceUrl) row.event_source_url = eventSourceUrl
  if (customData && Object.keys(customData).length) row.custom_data = customData
  return row
}

export async function sendMetaEvents(events, env, opts = {}) {
  const cfg = metaCapiConfig(env)
  if (!cfg.accessToken) return { skipped: 'no_token' }
  const rows = (events || []).filter(Boolean)
  if (!rows.length) return { skipped: 'empty' }
  const fetchFn = opts.fetch || globalThis.fetch
  if (typeof fetchFn !== 'function') return { skipped: 'no_fetch' }
  const body = { data: rows, access_token: cfg.accessToken }
  const testCode = sanitizeTestCode(opts.testEventCode) || cfg.testEventCode
  if (testCode) body.test_event_code = testCode
  const url = `${GRAPH}/${cfg.pixelId}/events`
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal || (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined),
    })
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok,
      status: res.status,
      events_received: json.events_received,
      fbtrace_id: json.fbtrace_id,
      error: json.error || undefined,
    }
  } catch (e) {
    return { skipped: 'capi_error', error: String(e.message || e) }
  }
}

export async function sendPurchaseEvent({ identity, tier, cycle, intent, eventSourceUrl } = {}, env, opts) {
  const key = tier || intent?.tier
  const event = buildCapiEvent({
    eventName: 'Purchase',
    eventId: intent?.eventId || purchaseEventId(identity, key),
    eventSourceUrl: eventSourceUrl || 'https://vidso.pro/video-generation',
    userData: capiUserData({
      email: identity?.email,
      userId: identity?.id || identity?.userId,
      fbp: intent?.fbp,
      fbc: intent?.fbc,
      ip: intent?.ip,
      ua: intent?.ua,
    }),
    customData: checkoutPayload(key, cycle || intent?.cycle),
  })
  return sendMetaEvents([event], env, {
    ...opts,
    testEventCode: intent?.testEventCode || opts?.testEventCode,
  })
}
