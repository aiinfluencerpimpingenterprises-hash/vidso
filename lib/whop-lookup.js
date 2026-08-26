// Look up a live Whop membership for a Vidso account. Server-only.

import { emailsFromUser } from './comped.js'
import { loadWhopPlans, resolveWhopPlan } from './whop-map.js'
import { PAID_MEMBERSHIP_STATUSES, TIER_RANK } from './paid-grant.js'

export const WHOP_COMPANY_ID = 'biz_1rGZhPBGkczqgF'
const WHOP_API = 'https://api.whop.com/api/v1'
const LOOKUP_CACHE_MS = 10 * 60 * 1000
const MISS_CACHE_MS = 45 * 1000

const cache = globalThis.__vidsoWhopCache || (globalThis.__vidsoWhopCache = new Map())

function envVal(env, name, fallback = '') {
  if (env && env[name]) return String(env[name]).trim()
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name]).trim()
    }
  } catch (_) {}
  return fallback
}

export function whopConfig(env) {
  return {
    apiKey: envVal(env, 'WHOP_API_KEY') || envVal(env, 'WHOP_API_TOKEN'),
    companyId: envVal(env, 'WHOP_COMPANY_ID', WHOP_COMPANY_ID) || WHOP_COMPANY_ID,
  }
}

function normEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function cacheKey(email, userId) {
  return normEmail(email) + '|' + String(userId || '').trim().toLowerCase()
}

export function membershipMatchesUser(membership, { email, userId } = {}) {
  if (!membership || typeof membership !== 'object') return false
  const wantEmail = normEmail(email)
  const wantId = String(userId || '').trim()
  const meta = membership.metadata && typeof membership.metadata === 'object' ? membership.metadata : {}
  const emails = [
    membership.user?.email,
    membership.email,
    meta.email,
    meta.user_email,
  ].map(normEmail).filter(Boolean)
  if (wantEmail && emails.includes(wantEmail)) return true
  const ids = [meta.user_id, meta.userId, meta.vidso_user_id].map((v) => String(v || '').trim()).filter(Boolean)
  if (wantId && ids.includes(wantId)) return true
  return false
}

export function grantFromMembership(membership, env) {
  if (!membership || typeof membership !== 'object') return null
  const status = String(membership.status || '').trim().toLowerCase()
  if (!PAID_MEMBERSHIP_STATUSES.has(status)) return null
  const planId = membership.plan?.id || membership.plan_id || membership.planId || ''
  const mapped = resolveWhopPlan(planId, env)
  if (mapped.status !== 'mapped') {
    return {
      active: true,
      legacy: true,
      tier: null,
      cycle: null,
      planId: planId || null,
      membershipId: membership.id || null,
      source: 'whop',
    }
  }
  return {
    active: true,
    legacy: false,
    tier: mapped.tier,
    cycle: mapped.cycle,
    planId: mapped.planId,
    membershipId: membership.id || null,
    source: 'whop',
  }
}

export function pickBestGrant(memberships, identity, env) {
  const hits = []
  for (const row of memberships || []) {
    if (!membershipMatchesUser(row, identity)) continue
    const grant = grantFromMembership(row, env)
    if (grant?.active) hits.push(grant)
  }
  if (!hits.length) return null
  hits.sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0))
  return hits[0]
}

async function whopGet(path, apiKey) {
  const res = await fetch(WHOP_API + path, {
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error?.message || data.message || data.error || ('Whop ' + res.status))
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

function rowsFrom(data) {
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data)) return data
  return []
}

function planIdParams(env) {
  const ids = loadWhopPlans(env).map((row) => row.planId).filter(Boolean)
  return ids.map((id) => 'plan_ids[]=' + encodeURIComponent(id)).join('&')
}

async function listMemberships(apiKey, companyId, extraQuery, env) {
  const qs = [
    'company_id=' + encodeURIComponent(companyId),
    'first=50',
    planIdParams(env),
    extraQuery,
  ].filter(Boolean).join('&')
  const data = await whopGet('/memberships?' + qs, apiKey)
  return rowsFrom(data)
}

export async function lookupPaidMembership(user, env) {
  const { apiKey, companyId } = whopConfig(env)
  if (!apiKey) {
    return { active: false, configured: false, reason: 'missing_key' }
  }
  const email = emailsFromUser(user)[0] || ''
  const userId = String(user?.id || user?.user_id || '').trim()
  if (!email && !userId) {
    return { active: false, configured: true, reason: 'missing_identity' }
  }

  const key = cacheKey(email, userId)
  const cached = cache.get(key)
  if (cached && cached.until > Date.now()) return cached.value

  let grant = null
  try {
    const memberQs = new URLSearchParams({
      company_id: companyId,
      query: email || userId,
      first: '10',
    })
    const members = rowsFrom(await whopGet('/members?' + memberQs.toString(), apiKey))
    const member = members.find((row) => {
      const got = normEmail(row?.user?.email)
      return email && got === normEmail(email)
    })
    const whopUserId = member?.user?.id
    const queries = [
      'status=active',
      'status=trialing',
      'status=past_due',
      'status=canceling',
    ]
    if (whopUserId) {
      for (const extra of queries) {
        const rows = await listMemberships(apiKey, companyId, extra + '&user_id=' + encodeURIComponent(whopUserId), env)
        grant = pickBestGrant(rows, { email, userId }, env)
        if (grant) break
      }
    }
    if (!grant) {
      for (const extra of ['status=active', 'status=trialing']) {
        const rows = await listMemberships(apiKey, companyId, extra, env)
        grant = pickBestGrant(rows, { email, userId }, env)
        if (grant) break
      }
    }
  } catch (e) {
    return {
      active: false,
      configured: true,
      reason: 'whop_error',
      message: e.message || 'Whop lookup failed',
    }
  }

  const value = grant
    ? { ...grant, configured: true }
    : { active: false, configured: true, reason: 'not_found' }
  cache.set(key, {
    until: Date.now() + (value.active ? LOOKUP_CACHE_MS : MISS_CACHE_MS),
    value,
  })
  return value
}

export function _resetWhopCacheForTests() {
  cache.clear()
}
