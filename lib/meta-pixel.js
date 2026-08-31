// Browser Meta Pixel helpers. The snippet in each HTML page still inits
// fbq and sends PageView. These fire the conversion events Ads needs, and
// mirror signup/checkout through /api/pixel/event when the pixel is blocked.

import { normalizeTier, planDisplayName } from './entitlements.js'
import { expectedPrice } from './whop-map.js'

export const META_PIXEL_ID = '4458410001098183'
const CAPI_BACKUP_EVENTS = new Set(['CompleteRegistration', 'ViewContent', 'InitiateCheckout'])

function fbqSafe() {
  try {
    return typeof fbq === 'function' ? fbq : null
  } catch (_) {
    return null
  }
}

function storageGet(store, key) {
  try { return store.getItem(key) } catch (_) { return null }
}

function storageSet(store, key, value = '1') {
  try { store.setItem(key, value) } catch (_) {}
}

function once(store, key) {
  const full = 'vidso_px_' + key
  if (storageGet(store, full)) return false
  storageSet(store, full)
  return true
}

function cookie(name) {
  try {
    if (typeof document === 'undefined') return ''
    const m = String(document.cookie || '').match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
    return m ? decodeURIComponent(m[1]) : ''
  } catch (_) {
    return ''
  }
}

export function conversionEventId(event, ...parts) {
  const rest = parts.map((p) => String(p || '').trim().toLowerCase()).filter(Boolean).join(':')
  return ['vidso', event, rest].filter(Boolean).join(':')
}

export function captureMetaTestCode() {
  try {
    if (typeof location === 'undefined') return storageGet(sessionStorage, 'vidso_meta_test') || ''
    const q = new URLSearchParams(location.search || '')
    const code = String(q.get('meta_test') || q.get('test_event_code') || '').trim()
    if (/^TEST[A-Z0-9]+$/i.test(code)) storageSet(sessionStorage, 'vidso_meta_test', code.toUpperCase())
    return storageGet(sessionStorage, 'vidso_meta_test') || ''
  } catch (_) {
    return ''
  }
}

export function pixelClickIds() {
  const testEventCode = captureMetaTestCode()
  const fbp = cookie('_fbp')
  let fbc = cookie('_fbc')
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search || '') : null
    const fbclid = q?.get('fbclid') || ''
    if (fbclid && !fbc) {
      fbc = 'fb.1.' + Date.now() + '.' + fbclid
      storageSet(sessionStorage, 'vidso_fbc', fbc)
    }
    if (!fbc) fbc = storageGet(sessionStorage, 'vidso_fbc') || ''
  } catch (_) {}
  return { fbp, fbc, testEventCode }
}

function sendCapiBackup(event, params, extra = {}) {
  if (!CAPI_BACKUP_EVENTS.has(event)) return
  try {
    if (typeof fetch !== 'function') return
    const ids = pixelClickIds()
    const payload = JSON.stringify({
      event_name: event,
      event_id: extra.eventID || '',
      custom_data: params || {},
      event_source_url: typeof location !== 'undefined' ? location.href : '',
      email: extra.email || '',
      user_id: extra.userId || '',
      fbp: ids.fbp,
      fbc: ids.fbc,
      test_event_code: ids.testEventCode,
    })
    fetch('/api/pixel/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch (_) {}
}

export function pixelIdentify(email) {
  const fn = fbqSafe()
  const em = String(email || '').trim().toLowerCase()
  if (!fn || !em.includes('@')) return
  try { fn('init', META_PIXEL_ID, { em }) } catch (_) {}
}

export function pixelTrack(event, params, extra = {}) {
  if (!event) return false
  const eventID = extra.eventID || conversionEventId(event, extra.userId, extra.email)
  const fn = fbqSafe()
  let pixelOk = false
  if (fn) {
    try {
      const opts = eventID ? { eventID } : undefined
      if (params && Object.keys(params).length) fn('track', event, params, opts)
      else fn('track', event, {}, opts)
      pixelOk = true
    } catch (_) {}
  }
  if (!extra.skipCapi) sendCapiBackup(event, params, { ...extra, eventID })
  return pixelOk || !extra.skipCapi
}

export function checkoutPayload(tier, cycle) {
  const key = normalizeTier(tier) || 'plus'
  const yearly = cycle === 'yearly' || cycle === 'annual'
  const value = expectedPrice(key, yearly ? 'yearly' : 'monthly')
  return {
    content_name: planDisplayName(key),
    content_ids: [key],
    content_type: 'product',
    value: Number(value) || 0,
    currency: 'USD',
    num_items: 1,
  }
}

export function trackCompleteRegistration(email) {
  if (!once(localStorage, 'reg')) return false
  const em = String(email || '').trim().toLowerCase()
  return pixelTrack('CompleteRegistration', { status: 'submitted', currency: 'USD', value: 0 }, {
    eventID: conversionEventId('CompleteRegistration', em || 'anon'),
    email: em,
  })
}

export function trackInitiateCheckout(tier, cycle, extra = {}) {
  const key = normalizeTier(tier) || String(tier || 'plus')
  if (!once(sessionStorage, 'ic:' + key + ':' + (cycle || ''))) return false
  const who = String(extra.userId || extra.email || '').trim().toLowerCase()
  return pixelTrack('InitiateCheckout', checkoutPayload(tier, cycle), {
    eventID: conversionEventId('InitiateCheckout', key, cycle || '', who),
    email: extra.email,
    userId: extra.userId,
  })
}

export function trackPurchase(tier, cycle, userId, email) {
  const who = String(userId || email || 'anon').trim().toLowerCase()
  const key = (normalizeTier(tier) || 'plus') + ':' + who
  if (!once(localStorage, 'buy:' + key)) return false
  return pixelTrack('Purchase', checkoutPayload(tier, cycle), {
    eventID: conversionEventId('Purchase', who, normalizeTier(tier) || 'plus'),
    email,
    userId,
    skipCapi: true,
  })
}

export function trackViewContent(name) {
  return pixelTrack('ViewContent', { content_name: name || 'Paywall' }, {
    eventID: conversionEventId('ViewContent', name || 'Paywall', String(Date.now())),
  })
}

try { captureMetaTestCode() } catch (_) {}
