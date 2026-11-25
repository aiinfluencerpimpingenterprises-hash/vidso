// Whop Standard Webhooks (no SDK). Server-only.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { clearRevocation, revokeMembership, saveGrant } from './grants.js'
import { hydrateIntent } from './checkout-intents.js'
import { sendPurchaseEvent } from './meta-capi.js'
import { grantFromMembership, retrieveMembership } from './whop-lookup.js'

const MAX_AGE_SEC = 5 * 60
const FULFILL_TYPES = new Set(['membership.activated', 'payment.succeeded'])
// Events that end access. `membership.deactivated` fires when a cancel takes
// effect (period end) or a membership expires; refunds and disputes end it now.
const REVOKE_TYPES = new Set([
  'membership.deactivated',
  'membership.went_invalid',
  'membership.cancelled',
  'membership.expired',
  'payment.refunded',
  'refund.created',
  'refund.updated',
  'dispute.created',
])

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

/** TubeOps identity we stamped on checkout — not the Whop/Apple relay email. */
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

function nestedMembership(data) {
  return data?.membership && typeof data.membership === 'object' ? data.membership : null
}

function membershipIdFromEvent(data) {
  return data?.membership_id
    || data?.membershipId
    || (typeof data?.membership === 'string' ? data.membership : '')
    || nestedMembership(data)?.id
    || ''
}

/** Membership behind a cancel/refund/dispute event (refunds and disputes nest a payment). */
export function revokedMembershipId(type, data) {
  if (!data || typeof data !== 'object') return ''
  if (type.startsWith('membership.')) return String(data.id || membershipIdFromEvent(data) || '')
  const payment = data.payment && typeof data.payment === 'object' ? data.payment : null
  return String(membershipIdFromEvent(data) || (payment ? membershipIdFromEvent(payment) : '') || '')
}

function refundSettled(data) {
  const status = String(data?.status || '').trim().toLowerCase()
  // A refund that failed or was cancelled leaves the payment standing.
  return !['failed', 'canceled', 'cancelled', 'rejected'].includes(status)
}

async function revokeFromEvent(type, data) {
  if (type === 'refund.updated' && !refundSettled(data)) return { ignored: true, type, reason: 'refund_not_settled' }
  const membershipId = revokedMembershipId(type, data)
  if (!membershipId) return { skipped: 'no_membership', type }
  const out = await revokeMembership(membershipId, { reason: type })
  return { ok: true, type, revoked: membershipId, accounts: out.owners.length }
}

function paidAtOf(event, data) {
  return data?.paid_at || data?.created_at || data?.renewal_period_start || event?.timestamp || ''
}

function membershipFromEvent(type, data) {
  if (!data || typeof data !== 'object') return null
  if (type !== 'payment.succeeded') return data
  // A payment also carries `plan` and `status`, but its status is `paid` and
  // its id is the payment's. Describe the membership it paid for instead.
  const mem = nestedMembership(data) || {}
  return {
    id: membershipIdFromEvent(data) || null,
    status: mem.status || 'active',
    plan: mem.plan || data.plan || { id: data.plan_id || data.planId },
    metadata: mem.metadata || data.metadata,
  }
}

export async function fulfillWhopEvent(event, env) {
  const type = String(event?.type || '')
  const data = event?.data && typeof event.data === 'object' ? event.data : {}
  if (REVOKE_TYPES.has(type)) return revokeFromEvent(type, data)
  if (!FULFILL_TYPES.has(type)) return { ignored: true, type }
  let row = membershipFromEvent(type, data)
  let identity = vidsoIdentityFromWhop(data)
  if ((!identity.id && !identity.email) || !grantFromMembership(row, env)?.tier) {
    const memId = membershipIdFromEvent(data) || row?.id
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
  if (grant.membershipId && !(await clearRevocation(grant.membershipId, paidAtOf(event, data)))) {
    return { skipped: 'membership_revoked', type, membershipId: grant.membershipId }
  }
  const rec = await saveGrant({ id: identity.id, email: identity.email }, grant)
  const identityUser = { id: identity.id, email: identity.email }
  let pixel = { skipped: 'unsent' }
  try {
    pixel = await sendPurchaseEvent({
      identity: identityUser,
      tier: rec.tier,
      cycle: rec.cycle,
      intent: await hydrateIntent(identityUser),
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
