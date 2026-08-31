// Browser Meta Pixel helpers. The snippet in each HTML page still inits
// fbq and sends PageView. These fire the conversion events Ads needs.

import { normalizeTier, planDisplayName } from './entitlements.js'
import { expectedPrice } from './whop-map.js'

export const META_PIXEL_ID = '4458410001098183'

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

function storageSet(store, key) {
  try { store.setItem(key, '1') } catch (_) {}
}

function once(store, key) {
  const full = 'vidso_px_' + key
  if (storageGet(store, full)) return false
  storageSet(store, full)
  return true
}

export function pixelIdentify(email) {
  const fn = fbqSafe()
  const em = String(email || '').trim().toLowerCase()
  if (!fn || !em.includes('@')) return
  try { fn('init', META_PIXEL_ID, { em }) } catch (_) {}
}

export function pixelTrack(event, params) {
  const fn = fbqSafe()
  if (!fn || !event) return false
  try {
    if (params && Object.keys(params).length) fn('track', event, params)
    else fn('track', event)
    return true
  } catch (_) {
    return false
  }
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

export function trackCompleteRegistration() {
  if (!once(localStorage, 'reg')) return false
  return pixelTrack('CompleteRegistration', { status: 'submitted', currency: 'USD', value: 0 })
}

export function trackInitiateCheckout(tier, cycle) {
  const key = normalizeTier(tier) || String(tier || 'plus')
  if (!once(sessionStorage, 'ic:' + key + ':' + (cycle || ''))) return false
  return pixelTrack('InitiateCheckout', checkoutPayload(tier, cycle))
}

export function trackPurchase(tier, cycle, userId) {
  const key = (normalizeTier(tier) || 'plus') + ':' + String(userId || 'anon')
  if (!once(localStorage, 'buy:' + key)) return false
  return pixelTrack('Purchase', checkoutPayload(tier, cycle))
}

export function trackViewContent(name) {
  return pixelTrack('ViewContent', { content_name: name || 'Paywall' })
}
