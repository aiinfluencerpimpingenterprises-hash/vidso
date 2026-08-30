// Owner-only billing diagnostics. Answers "why is this buyer locked out?"
// without exposing the API key or other customers' emails.

import { withCompedPlan, emailsFromUser, COMPED_STUDIO_EMAILS } from '../../lib/comped.js'
import { PAID_MEMBERSHIP_STATUSES } from '../../lib/paid-grant.js'
import { resolveWhopPlan } from '../../lib/whop-map.js'
import { kvConfigured } from '../../lib/kv.js'
import { fetchRecentPayments, summarizePayments } from '../../lib/whop-payments.js'
import { enableVidsoOrchestration } from '../../lib/whop-checkout.js'
import {
  lookupPaidMembership,
  whopConfig,
  whopProbe,
  membershipUserIds,
  _internals,
} from '../../lib/whop-lookup.js'

export const config = { maxDuration: 30 }

const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body, null, 2))
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

async function requireOwner(req) {
  const adminKey = String(process.env.VIDSO_ADMIN_KEY || '').trim()
  const given = String(req.headers['x-admin-key'] || req.query?.admin_key || '').trim()
  if (adminKey && given && given === adminKey) return { email: 'admin-key', owner: true }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    const err = new Error('Sign in as the account owner, or pass x-admin-key.')
    err.status = 401
    throw err
  }
  const res = await fetch(UPSTREAM + '/api/user/me', { headers: { Authorization: 'Bearer ' + token } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    throw err
  }
  const user = withCompedPlan({ ...data, email: data.email || emailFromJwt(token) })
  const isOwner = emailsFromUser(user).some((email) => COMPED_STUDIO_EMAILS.includes(email))
  if (!isOwner) {
    const err = new Error('Owner access required.')
    err.status = 403
    throw err
  }
  return user
}

function summarizeMemberSearch(probe, email) {
  if (!probe.ok) {
    return { ok: false, status: probe.status, reason: probe.reason, message: probe.message }
  }
  const rows = _internals.rowsFrom(probe.data)
  const withEmail = rows.filter((row) => row?.user?.email).length
  const matched = rows.filter((row) => String(row?.user?.email || '').trim().toLowerCase() === email)
  // Mirror findWhopUserIds so the report reflects what the lookup really used.
  const ids = []
  for (const row of rows) {
    const id = String(row?.user?.id || '').trim()
    if (!id || ids.includes(id)) continue
    const got = String(row?.user?.email || '').trim().toLowerCase()
    if (got ? got === email : rows.length === 1) ids.push(id)
  }
  return {
    ok: true,
    rows: rows.length,
    emailsReadable: withEmail,
    // Null emails on every row is the signature of a missing member:email:read.
    emailReadable: rows.length ? withEmail > 0 : null,
    exactEmailMatches: matched.length,
    whopUserIds: ids,
    matchedBy: ids.length ? (withEmail ? 'email' : 'single_query_hit') : null,
  }
}

function summarizeMemberships(probe) {
  if (!probe.ok) {
    return { ok: false, status: probe.status, reason: probe.reason, message: probe.message }
  }
  const rows = _internals.rowsFrom(probe.data)
  const ours = new Set(_internals.ourPlanIds())
  const planIds = rows.map((row) => row?.plan?.id || row?.plan_id || (typeof row?.plan === 'string' ? row.plan : '')).filter(Boolean)
  const statuses = [...new Set(rows.map((row) => String(row?.status || '').toLowerCase()).filter(Boolean))]
  const unmapped = [...new Set(planIds.filter((id) => resolveWhopPlan(id).status !== 'mapped'))]
  return {
    ok: true,
    rows: rows.length,
    // If a filter were being ignored we would see foreign plans or dead statuses.
    statusFilterHonored: rows.length ? statuses.every((s) => PAID_MEMBERSHIP_STATUSES.has(s)) : null,
    planFilterHonored: planIds.length ? planIds.every((id) => ours.has(id)) : null,
    statusesSeen: statuses,
    unmappedPlanIds: unmapped,
    rowsCarryingUserId: rows.filter((row) => membershipUserIds(row).length).length,
    hitPageLimit: rows.length >= _internals.PAGE_SIZE,
  }
}

function verdict({ configured, member, memberships, lookup }) {
  if (!configured) return 'WHOP_API_KEY is not set on this deployment. Add it in Vercel and redeploy.'
  if (member.reason === 'bad_key' || memberships.reason === 'bad_key') {
    return 'Whop rejected the API key. It was revoked or belongs to a different business.'
  }
  if (member.reason === 'missing_permission' || memberships.reason === 'missing_permission') {
    return 'The API key is missing member:basic:read. Grant it in Whop under Developer, Company API Keys.'
  }
  // A resolved membership is the headline even when a permission is missing:
  // the warnings list carries anything that still needs tightening.
  if (lookup.active) {
    const tier = lookup.tier ? lookup.tier + (lookup.cycle ? ' ' + lookup.cycle : '') : 'a legacy plan'
    return `Whop confirms an active membership on ${tier}. This account should be unlocked.`
  }
  if (member.ok && member.rows > 0 && member.emailReadable === false && !member.whopUserIds.length) {
    return 'The API key is missing member:email:read, and the search returned too many members to match one without emails. Grant it in Whop under Developer, Company API Keys.'
  }
  if (lookup.reason === 'inconclusive') {
    return 'Whop has more memberships than this lookup can page through, so this buyer was never actually checked. Grant member:email:read so the buyer can be found by email directly instead of by scanning the company.'
  }
  if (member.ok && member.rows === 0) {
    return 'Whop has no member matching this email. The buyer paid with a different email, or the purchase is on another business.'
  }
  if (memberships.ok && memberships.rows === 0) {
    return 'The buyer exists on Whop but has no membership on a Vidso plan. Check whether the charge actually completed.'
  }
  if (memberships.unmappedPlanIds?.length) {
    return 'Memberships were found on plan IDs that are not in lib/whop-map.js, so the tier cannot be resolved: ' + memberships.unmappedPlanIds.join(', ')
  }
  if (member.ok && member.exactEmailMatches === 0) {
    return 'Whop found members for this search but none with an exact email match. The buyer likely checked out under a different Whop account email.'
  }
  return 'No active membership resolved. See the raw sections below.'
}

function warningsFor({ member, memberships }) {
  const out = []
  if (!kvConfigured()) {
    out.push('No durable grant store is configured, so a confirmed payment is only remembered until this lambda goes cold. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel so paid accounts survive a cold start.')
  }
  if (member.ok && member.rows > 0 && member.emailReadable === false) {
    out.push('member:email:read is not granted, so Whop hides member emails. Matching still works when an email query returns exactly one member, but it cannot tell two members apart or catch a buyer who paid under a different email. Grant it in Whop under Developer, Company API Keys.')
  }
  if (memberships.planFilterHonored === false) out.push('Whop ignored the plan_ids[] filter. Recheck the parameter names against the current API.')
  if (memberships.statusFilterHonored === false) out.push('Whop ignored the statuses[] filter. Recheck the parameter names against the current API.')
  if (memberships.hitPageLimit) out.push('The first membership page came back full, so older memberships are only reachable through deeper paging.')
  return out
}

export const _internalsForTests = { verdict, warningsFor, summarizeMemberSearch, summarizeMemberships }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Key')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  let owner
  try {
    owner = await requireOwner(req)
  } catch (e) {
    return send(res, e.status || 401, { error: e.message || 'Unauthorized' })
  }

  const { apiKey, companyId } = whopConfig()

  // ?orchestration=1 writes adaptive pricing + platform payment methods onto
  // every mapped Vidso plan. Checkout also does this lazily; this is the
  // explicit "turn it on now" path.
  if (req.query?.orchestration) {
    if (!apiKey) return send(res, 200, { key: { configured: false, companyId } })
    const plans = await enableVidsoOrchestration()
    const failed = plans.filter((row) => !row.ok)
    const missingPerm = failed.some((row) => row.reason === 'missing_permission')
    return send(res, 200, {
      key: { configured: true, companyId },
      orchestration: {
        ok: failed.length === 0,
        enabled: plans.filter((row) => row.ok).length,
        total: plans.length,
        plans,
        verdict: missingPerm
          ? 'The API key cannot update plans. Grant plan:update and plan:basic:read in Whop under Developer, Company API Keys.'
          : failed.length
            ? 'Some plans did not take the orchestration patch. See plans[].message.'
            : 'Adaptive pricing and Whop platform payment methods are on for every Vidso plan.',
      },
    })
  }

  // ?payments=1 answers "why are charges failing?" rather than "why is this one
  // buyer locked out?". It reads the decline code Whop records per payment.
  if (req.query?.payments) {
    if (!apiKey) return send(res, 200, { key: { configured: false, companyId } })
    const pages = Math.min(Math.max(Number(req.query.pages) || 3, 1), 8)
    const { rows, error } = await fetchRecentPayments(
      (path) => whopProbe(path),
      companyId,
      _internals.buildQuery,
      pages,
    )
    if (error) {
      return send(res, 200, {
        key: { configured: true, companyId },
        payments: { ok: false, ...error },
        verdict: error.reason === 'missing_permission'
          ? 'The API key cannot read payments. Grant payment:basic:read in Whop under Developer, Company API Keys.'
          : 'Whop would not return payments: ' + error.message,
      })
    }
    return send(res, 200, {
      key: { configured: true, companyId },
      payments: summarizePayments(rows),
    })
  }

  const email = String(req.query?.email || emailsFromUser(owner)[0] || '').trim().toLowerCase()
  if (!email) return send(res, 400, { error: 'Pass ?email= to diagnose an account.' })
  if (!apiKey) {
    return send(res, 200, {
      key: { configured: false, companyId },
      target: email,
      verdict: verdict({ configured: false, member: {}, memberships: {}, lookup: {} }),
    })
  }

  const memberProbe = await whopProbe('/members?' + _internals.buildQuery({
    company_id: companyId,
    query: email,
    first: 20,
  }))
  const member = summarizeMemberSearch(memberProbe, email)

  const membershipProbe = await whopProbe('/memberships?' + _internals.buildQuery({
    company_id: companyId,
    first: _internals.PAGE_SIZE,
    statuses: [...PAID_MEMBERSHIP_STATUSES],
    plan_ids: _internals.ourPlanIds(),
    user_ids: member.whopUserIds || [],
  }))
  const memberships = summarizeMemberships(membershipProbe)

  const lookup = await lookupPaidMembership({ email }, undefined, { force: true, deep: true })

  return send(res, 200, {
    key: { configured: true, companyId },
    target: email,
    verdict: verdict({ configured: true, member, memberships, lookup }),
    grantStore: kvConfigured() ? 'durable' : 'ephemeral',
    warnings: warningsFor({ member, memberships }),
    memberSearch: member,
    membershipList: memberships,
    resolved: {
      active: !!lookup.active,
      tier: lookup.tier || null,
      cycle: lookup.cycle || null,
      planId: lookup.planId || null,
      legacy: !!lookup.legacy,
      reason: lookup.reason || null,
      message: lookup.message || null,
    },
    ourPlanIds: _internals.ourPlanIds(),
  })
}
