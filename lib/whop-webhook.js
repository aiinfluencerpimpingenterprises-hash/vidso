// Whop Standard Webhooks (no SDK). Server-only.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { saveGrant } from './grants.js'
import { intentFor } from './checkout-intents.js'
import { sendPurchaseEvent } from './meta-capi.js'
import { grantFromMembership, retrieveMembership } from './whop-lookup.js'

const MAX_AGE_SEC = 5 * 60
const FULFILL_TYPES = new Set(['membership.activated', 'payment.succeeded'])

function header(headers, name) {
  if (!headers) return ''
  const want = String(name).toLowerCase()
  if (typeof headers.get === 'function') return String(headers.get(name) || headers.get(want) || '')
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === want) return Array.isArray(value) ? String(value[0] || '') : String(value || '')
  }
  return ''
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function verifyWhopWebhook(rawBody, headers, secret, now = Date.now()) {
  const key = String(secret || '').trim()
  const id = header(headers, 'webhook-id')
  const ts = header(headers, 'webhook-timestamp')
  const sig = header(headers, 'webhook-signature')
  if (!key || !id || !ts || !sig) {
    const err = new Error('Missing webhook signature')
    err.status = 401
    throw err
  }
  const age = Math.abs(now / 1000 - Number(ts))
  if (!Number.isFinite(Number(ts)) || age > MAX_AGE_SEC) {
    const err = new Error('Webhook timestamp too old')
    err.status = 401
    throw err
  }
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64')
  const ok = String(sig).split(/\s+/).some((part) => {
    const value = part.replace(/^v1,/i, '').trim()
    return value && safeEqual(value, expected)
  })
  if (!ok) {
    const err = new Error('Invalid webhook signature')
    err.status = 401
    throw err
  }
  return JSON.parse(rawBody)
}

/** Vidso identity we stamped on checkout — not the Whop/Apple relay email. */
export function vidsoIdentityFromWhop(obj) {
  const blobs = [obj?.metadata, obj?.membership?.metadata]
  let id = ''
  let email = ''
  for (const blob of blobs) {
    if (!blob || typeof blob !== 'object') continue
    if (!id) id = String(blob.user_id || blob.userId || blob.vidso_user_id || '').trim()
    if (!email) email = String(blob.email || blob.user_email || blob.vidso_email || '').trim()
  }
  return { id, email: email.toLowerCase() }
}

function membershipFromEvent(data) {
  if (!data || typeof data !== 'object') return null
  if (data.plan || data.plan_id || data.status) return data
  if (data.membership && typeof data.membership === 'object') return data.membership
  return {
    id: data.membership_id || data.membershipId || data.id,
    status: data.status || 'active',
    plan: data.plan || { id: data.plan_id || data.planId },
    metadata: data.metadata,
  }
}

export async function fulfillWhopEvent(event, env) {
  const type = String(event?.type || '')
  if (!FULFILL_TYPES.has(type)) return { ignored: true, type }
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  let row = membershipFromEvent(data)
  let identity = vidsoIdentityFromWhop(data)
  if ((!identity.id && !identity.email) || !grantFromMembership(row, env)?.tier) {
    const memId = data.membership_id || data.membershipId || row?.id
    if (memId) {
      const fetched = await retrieveMembership(memId, env)
      if (fetched) {
        row = fetched
        const fromMem = vidsoIdentityFromWhop(fetched)
        identity = {
          id: identity.id || fromMem.id,
          email: identity.email || fromMem.email,
        }
      }
    }
  }
  const grant = grantFromMembership(row, env)
  if (!grant?.tier) return { skipped: 'unmapped', type }
  if (!identity.id && !identity.email) return { skipped: 'no_vidso_identity', type }
  const rec = await saveGrant({ id: identity.id, email: identity.email }, grant)
  const identityUser = { id: identity.id, email: identity.email }
  let pixel = { skipped: 'unsent' }
  try {
    pixel = await sendPurchaseEvent({
      identity: identityUser,
      tier: rec.tier,
      cycle: rec.cycle,
      intent: intentFor(identityUser),
    }, env)
  } catch (e) {
    pixel = { skipped: 'capi_error', error: String(e.message || e) }
  }
  return {
    ok: true,
    type,
    tier: rec.tier,
    cycle: rec.cycle,
    membershipId: rec.membershipId,
    pixel: pixel.skipped || (pixel.ok ? 'sent' : 'failed'),
  }
}
