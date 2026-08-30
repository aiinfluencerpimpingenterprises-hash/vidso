// Look up a live Whop membership for a Vidso account. Server-only.
//
// Param names must match Whop's stable API exactly (statuses[], user_ids[],
// plan_ids[]). Whop ignores unknown filters instead of erroring, so a typo here
// silently returns the wrong page of memberships and every buyer looks unpaid.

import { emailKeys, emailsFromUser, emailsMatch } from './comped.js'
import { loadWhopPlans, resolveWhopPlan } from './whop-map.js'
import { PAID_MEMBERSHIP_STATUSES, TIER_RANK } from './paid-grant.js'

export const WHOP_COMPANY_ID = 'biz_1rGZhPBGkczqgF'
const WHOP_API = 'https://api.whop.com/api/v1'
const LOOKUP_CACHE_MS = 10 * 60 * 1000
const MISS_CACHE_MS = 60 * 1000
const PAGE_SIZE = 100
// The gate route runs on every request, so it stays shallow. Only the explicit
// billing sync sweeps far enough to find an older membership.
const SHALLOW_PAGES = 2
const DEEP_PAGES = 8

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

function normId(value) {
  return String(value || '').trim()
}

function cacheKey(emails, userId) {
  return emails.join(',') + '|' + normId(userId).toLowerCase()
}

/** Whop is Rails-backed: repeated values must be sent as `name[]=`. */
function buildQuery(params) {
  const parts = []
  for (const [name, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null || item === '') continue
        parts.push(encodeURIComponent(name) + '[]=' + encodeURIComponent(item))
      }
      continue
    }
    parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(value))
  }
  return parts.join('&')
}

export function membershipUserIds(membership) {
  if (!membership || typeof membership !== 'object') return []
  const meta = membership.metadata && typeof membership.metadata === 'object' ? membership.metadata : {}
  return [
    membership.user?.id,
    membership.user_id,
    typeof membership.user === 'string' ? membership.user : '',
    meta.whop_user_id,
  ].map(normId).filter(Boolean)
}

export function membershipMatchesUser(membership, identity = {}) {
  if (!membership || typeof membership !== 'object') return false
  const wantEmails = [].concat(identity.emails || [], identity.email || [])
    .map(normEmail)
    .filter(Boolean)
  const wantIds = [].concat(identity.userId || [], identity.userIds || []).map(normId).filter(Boolean)
  const wantWhopIds = [].concat(identity.whopUserIds || [], identity.whopUserId || []).map(normId).filter(Boolean)
  const meta = membership.metadata && typeof membership.metadata === 'object' ? membership.metadata : {}

  // A membership pulled back by a user_ids[] filter belongs to this buyer even
  // when the API key cannot read emails.
  if (wantWhopIds.length && membershipUserIds(membership).some((id) => wantWhopIds.includes(id))) return true

  const emails = [
    membership.user?.email,
    membership.email,
    membership.user_email,
    meta.email,
    meta.user_email,
  ].flatMap(emailKeys)
  if (wantEmails.length && emails.some((email) => wantEmails.some((want) => emailsMatch(want, email)))) return true

  const ids = [meta.user_id, meta.userId, meta.vidso_user_id].map(normId).filter(Boolean)
  if (wantIds.length && ids.some((id) => wantIds.includes(id))) return true
  return false
}

export function grantFromMembership(membership, env) {
  if (!membership || typeof membership !== 'object') return null
  const status = String(membership.status || '').trim().toLowerCase()
  if (!PAID_MEMBERSHIP_STATUSES.has(status)) return null
  const planId = membership.plan?.id
    || membership.plan_id
    || membership.planId
    || (typeof membership.plan === 'string' ? membership.plan : '')
    || ''
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
  // A mapped tier beats a legacy membership we cannot price.
  hits.sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0))
  return hits[0]
}

async function whopGet(path, apiKey) {
  return whopSend('GET', path, apiKey)
}

async function whopSend(method, path, apiKey, body) {
  const res = await fetch(WHOP_API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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

export async function whopPost(path, apiKey, body) {
  return whopSend('POST', path, apiKey, body)
}

export async function retrieveMembership(id, env) {
  const { apiKey } = whopConfig(env)
  const memId = String(id || '').trim()
  if (!apiKey || !memId) return null
  try {
    return await whopGet('/memberships/' + encodeURIComponent(memId), apiKey)
  } catch {
    return null
  }
}

function rowsFrom(data) {
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data)) return data
  return []
}

function nextCursor(data) {
  const info = data?.page_info || data?.pagination
  if (!info || info.has_next_page === false) return ''
  return normId(info.end_cursor || info.next_cursor)
}

function ourPlanIds(env) {
  return loadWhopPlans(env).map((row) => row.planId).filter(Boolean)
}

function reasonFor(err) {
  if (err?.status === 401) return 'bad_key'
  if (err?.status === 403) return 'missing_permission'
  return 'whop_error'
}

/**
 * Page the membership list. `exhausted` reports whether we reached the end;
 * a truncated page budget means "not seen yet", never "this buyer never paid".
 */
async function listMembershipsPaged(apiKey, companyId, extra, env, maxPages = SHALLOW_PAGES) {
  const rows = []
  let after = ''
  // 0: our filters + `extra`. 1: `extra` only. 2: bare list, matched locally.
  // Dropping straight to bare would discard `user_ids[]`, which is the one
  // filter that makes this query precise, so shed the coarse filters first.
  let stage = 0
  let exhausted = false
  for (let page = 0; page < maxPages; page++) {
    const base = { company_id: companyId, first: PAGE_SIZE, after: after || undefined }
    const query = stage === 0
      ? { ...base, statuses: [...PAID_MEMBERSHIP_STATUSES], plan_ids: ourPlanIds(env), ...extra }
      : stage === 1
        ? { ...base, ...extra }
        : base
    let data
    try {
      data = await whopGet('/memberships?' + buildQuery(query), apiKey)
    } catch (e) {
      // A rejected filter must not lock every buyer out.
      if (e.status !== 400 || stage >= 2) throw e
      stage++
      page--
      continue
    }
    rows.push(...rowsFrom(data))
    after = nextCursor(data)
    if (!after) {
      exhausted = true
      break
    }
  }
  return { rows, exhausted }
}

/** Resolve Whop user IDs for a Vidso account by searching company members. */
async function findWhopUserIds(apiKey, companyId, emails) {
  const ids = []
  for (const email of emails) {
    const rows = rowsFrom(await whopGet('/members?' + buildQuery({
      company_id: companyId,
      query: email,
      first: 20,
    }), apiKey))
    for (const row of rows) {
      const id = normId(row?.user?.id)
      if (!id || ids.includes(id)) continue
      const got = normEmail(row?.user?.email)
      // Without member:email:read the email comes back null; a single hit on an
      // exact email query is still safe to trust. Compare through emailsMatch so
      // a buyer whose Whop email is the dotted Gmail form still resolves here,
      // not just later when matching membership rows.
      if (got ? emailsMatch(got, email) : rows.length === 1) ids.push(id)
    }
  }
  return ids
}

export async function lookupPaidMembership(user, env, opts = {}) {
  const { apiKey, companyId } = whopConfig(env)
  if (!apiKey) {
    return { active: false, configured: false, reason: 'missing_key' }
  }
  const emails = emailsFromUser(user)
  const extraEmails = [].concat(opts.extraEmails || []).map(normEmail).filter(Boolean)
  const userId = normId(user?.id || user?.user_id)
  if (!emails.length && !extraEmails.length && !userId) {
    return { active: false, configured: true, reason: 'missing_identity' }
  }

  const searchEmails = [...emails]
  for (const email of extraEmails) {
    if (!searchEmails.includes(email)) searchEmails.push(email)
  }

  const key = cacheKey(searchEmails, userId)
  if (!opts.force) {
    const cached = cache.get(key)
    if (cached && cached.until > Date.now()) return cached.value
  }

  let grant = null
  let whopUserIds = []
  let searchError = null
  try {
    whopUserIds = await findWhopUserIds(apiKey, companyId, searchEmails)
  } catch (e) {
    // The member search needs member:email:read. Keep going: the membership
    // list can still match on checkout metadata.
    searchError = e
  }

  const identity = { emails: searchEmails, userId, whopUserIds }
  // Whether we searched far enough to trust a miss. A `user_ids[]` query returns
  // only this buyer's rows, so it can be paged out cheaply; the unfiltered
  // company list cannot, and it grows with every new customer.
  let searchedFully = false
  try {
    if (whopUserIds.length) {
      const got = await listMembershipsPaged(apiKey, companyId, { user_ids: whopUserIds }, env, DEEP_PAGES)
      grant = pickBestGrant(got.rows, identity, env)
      searchedFully = got.exhausted
    }
    if (!grant) {
      const got = await listMembershipsPaged(apiKey, companyId, {}, env, opts.deep ? DEEP_PAGES : SHALLOW_PAGES)
      grant = pickBestGrant(got.rows, identity, env)
      if (got.exhausted) searchedFully = true
    }
  } catch (e) {
    return {
      active: false,
      configured: true,
      reason: reasonFor(e),
      message: e.message || 'Whop lookup failed',
    }
  }

  if (!grant && searchError) {
    return {
      active: false,
      configured: true,
      reason: reasonFor(searchError),
      message: searchError.message || 'Whop member search failed',
    }
  }

  // We never saw the end of the list, so this buyer may simply be deeper in it.
  // Reporting `not_found` here is what silently unpaid a real customer once the
  // company outgrew the page budget, so say "unknown" and do not cache it.
  if (!grant && !searchedFully) {
    return {
      active: false,
      configured: true,
      reason: 'inconclusive',
      message: 'Whop has more memberships than this lookup reads. Run a deep billing sync for this account.',
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

/** Raw Whop call for the diagnostics route. Never returns the API key. */
export async function whopProbe(path, env) {
  const { apiKey } = whopConfig(env)
  if (!apiKey) return { ok: false, status: 0, reason: 'missing_key' }
  try {
    return { ok: true, status: 200, data: await whopGet(path, apiKey) }
  } catch (e) {
    return {
      ok: false,
      status: e.status || 0,
      reason: reasonFor(e),
      message: e.message || 'Whop request failed',
    }
  }
}

export function _resetWhopCacheForTests() {
  cache.clear()
}

export const _internals = {
  buildQuery,
  findWhopUserIds,
  listMembershipsPaged,
  ourPlanIds,
  rowsFrom,
  PAGE_SIZE,
}
