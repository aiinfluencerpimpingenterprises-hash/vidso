import { withCompedPlan, emailsFromUser } from '../../lib/comped.js'
import { applyPaidGrant } from '../../lib/paid-grant.js'
import { membershipOwnedByOther, saveGrant, withStoredGrant } from '../../lib/grants.js'
import { lookupPaidMembership, retrieveMembership, whopConfig } from '../../lib/whop-lookup.js'
import { hydrateIntent, intentFor, mayAttachOffEmail, membershipCreatedMs, offEmailClaimAllowed } from '../../lib/checkout-intents.js'

const SUPPORT_MESSAGE = 'We could not confirm this payment belongs to this account. Contact support with your receipt.'

/**
 * A membership that matched only the typed receipt email. It is attached only
 * when this account started a checkout for that tier before the membership was
 * created (and within 3 hours of it), and no other TubeOps account holds it.
 */
async function offEmailClaimOk(user, hit) {
  if (!hit?.membershipId || !hit.tier) return false
  const membership = await retrieveMembership(hit.membershipId)
  if (!membership) return false
  // Checkout from another TubeOps account stamps that account's id on the membership.
  const meta = membership.metadata && typeof membership.metadata === 'object' ? membership.metadata : {}
  const ownId = String(user?.id || user?.user_id || '').trim()
  const stamped = [meta.user_id, meta.vidso_user_id].map((v) => String(v || '').trim()).filter(Boolean)
  if (stamped.length && !stamped.includes(ownId)) return false
  if (await membershipOwnedByOther(user, hit.membershipId)) return false
  return offEmailClaimAllowed({ intent: intentFor(user), tier: hit.tier, createdAt: membershipCreatedMs(membership) }).ok
}

export const config = { maxDuration: 30 }

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
  // On Vercel, reading req.body throws on malformed JSON; treat that as an empty body, not a 500.
  let parsed
  try { parsed = req.body } catch (_) { return {} }
  if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed)) return parsed
  const chunks = []
  for await (const c of req) chunks.push(c)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

async function requireUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    const err = new Error('Missing token')
    err.status = 401
    throw err
  }
  const res = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    err.body = data
    throw err
  }
  return withCompedPlan({ ...data, email: data.email || emailFromJwt(token) })
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  let user
  try {
    user = await requireUser(req)
  } catch (e) {
    return send(res, e.status || 401, e.body || { error: e.message || 'Unauthorized' })
  }

  const stored = await withStoredGrant(user)
  if (stored.plan_status === 'active' && stored.plan && stored.plan !== 'free') {
    return send(res, 200, {
      active: true,
      tier: stored.plan || stored.plan_tier,
      cycle: stored.plan_interval || null,
      source: grantSource(user, stored),
      configured: !!whopConfig().apiKey,
    })
  }

  const { apiKey } = whopConfig()
  if (!apiKey) {
    return send(res, 200, {
      active: false,
      configured: false,
      reason: 'missing_key',
      message: 'WHOP_API_KEY is not set on this deployment.',
    })
  }

  if (!emailsFromUser(user).length) {
    return send(res, 200, {
      active: false,
      configured: true,
      reason: 'missing_identity',
      message: 'This account has no email to match against Whop.',
    })
  }

  const body = await readJson(req).catch(() => ({}))
  const paidEmail = String(body.paidEmail || '').trim().toLowerCase()
  const ownEmails = emailsFromUser(user)
  const offEmail = paidEmail && paidEmail.includes('@') && !ownEmails.includes(paidEmail) ? paidEmail : ''
  if (offEmail) await hydrateIntent(user)
  if (offEmail && !mayAttachOffEmail(user, offEmail)) {
    return send(res, 200, {
      active: false,
      configured: true,
      reason: 'need_checkout',
      message: 'Start checkout from this signed-in account first, then enter the email on the Whop receipt. That keeps someone else from claiming your payment.',
    })
  }
  // This account's own emails and id first; that path is unchanged.
  let hit = await lookupPaidMembership(user, undefined, {
    force: !!body.force,
    deep: true,
    extraEmails: [],
  })
  if (!hit.active && offEmail) {
    hit = await lookupPaidMembership(user, undefined, {
      force: !!body.force,
      deep: true,
      extraEmails: [offEmail],
    })
    if (hit.active && !(await offEmailClaimOk(user, hit))) {
      return send(res, 200, {
        active: false,
        configured: true,
        reason: 'contact_support',
        message: SUPPORT_MESSAGE,
      })
    }
  }
  if (!hit.active) {
    return send(res, 200, {
      active: false,
      configured: true,
      reason: hit.reason || 'not_found',
      message: hit.message || syncMessage(hit.reason, user),
    })
  }

  let grant
  try {
    grant = await saveGrant(user, hit)
  } catch (e) {
    return send(res, 200, {
      active: false,
      configured: true,
      reason: e.code || 'grant_failed',
      message: e.message || 'Could not attach this payment.',
    })
  }
  const overlay = applyPaidGrant(user, grant)
  return send(res, 200, {
    active: true,
    tier: overlay.plan,
    cycle: overlay.plan_interval,
    planId: grant.planId,
    source: 'whop',
    configured: true,
    legacy: !!hit.legacy,
  })
}

function grantSource(user, stored) {
  if (stored.plan_status === 'active' && (user.plan_status === 'active' || user.active === true)) return 'clipzo'
  return 'grant'
}

function syncMessage(reason, user) {
  const email = emailsFromUser(user)[0] || 'this account'
  if (reason === 'bad_key') return 'The Whop API key on this deployment was rejected.'
  if (reason === 'missing_permission') return 'The Whop API key is missing the member:email:read permission, so payments cannot be matched to an email.'
  if (reason === 'whop_error') return 'Whop could not be reached to confirm the payment.'
  if (reason === 'need_checkout') {
    return 'Start checkout from this TubeOps account first, then enter the email on your Whop receipt.'
  }
  if (reason === 'membership_taken') {
    return 'That payment is already attached to another TubeOps account. Sign in there, or contact support.'
  }
  return `No active Whop membership is attached to ${email} yet.`
}
