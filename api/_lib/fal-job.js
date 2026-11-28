// A fal job's billing handle: who started it, what it held, and fal's request id.
// Sealed so the client can't read or change the amount, and checked against the
// caller so only the owner's poll can give the credits back.

import { openPayload, sealPayload } from '../../lib/youtube.js'
import { kvConfigured, kvLock } from '../../lib/kv.js'

const HANDLE_TTL_MS = 3 * 24 * 60 * 60 * 1000
const REFUND_NS = 'vidso:falrefund:'
const refundedLocal = globalThis.__vidsoFalRefunds || (globalThis.__vidsoFalRefunds = new Set())

export function falOwnerKey(user) {
  return String(user?.id || user?.user_id || user?.email || '').trim().toLowerCase()
}

export function falJobHandle({ user, requestId, charge = 0, free = false }, env = process.env) {
  const rid = String(requestId || '').trim()
  const uid = falOwnerKey(user)
  if (!rid || !uid) return ''
  try {
    return sealPayload({
      typ: 'fal_job',
      uid,
      rid,
      charge: Math.max(0, Math.floor(Number(charge) || 0)),
      free: free ? 1 : 0,
      exp: Date.now() + HANDLE_TTL_MS,
    }, env)
  } catch (_) {
    return '' // no secret configured: the job still runs, it just can't be refunded
  }
}

/** The handle's contents, or null when it is missing, forged, expired or someone else's. */
export function readFalJobHandle(handle, user, env = process.env) {
  if (!handle) return null
  try {
    const p = openPayload(handle, env)
    if (p.typ !== 'fal_job' || !p.rid || p.uid !== falOwnerKey(user)) return null
    return p
  } catch (_) {
    return null
  }
}

/** fal's request id from a queue status URL (…/requests/<id>/status). */
export function requestIdFromQueueUrl(url) {
  try {
    const m = new URL(String(url || '')).pathname.match(/\/requests\/([^/]+)(?:\/status)?\/?$/)
    return m ? decodeURIComponent(m[1]) : ''
  } catch (_) {
    return ''
  }
}

/** True only for the first caller for this request id, across instances when KV is set. */
export async function claimFalRefund(rid) {
  const id = String(rid || '').trim()
  if (!id) return false
  if (kvConfigured()) return kvLock(REFUND_NS + id, HANDLE_TTL_MS / 1000)
  if (refundedLocal.has(id)) return false
  refundedLocal.add(id)
  return true
}

export function _resetFalRefundsForTests() {
  refundedLocal.clear()
}
