// Whop plan ID → internal tier + billing cycle.
// IDs can be overridden with env vars on the Railway API. The frontend
// uses the defaults below (the live checkout links). Do not put IDs in
// generation or entitlement business logic — import this module.

import { ANNUAL_PER_MONTH, MONTHLY, LONG_CYCLE } from './pricing.js'
import { normalizeTier } from './entitlements.js'

const DEFAULTS = {
  WHOP_PLAN_PLUS_MONTHLY: 'plan_BQHP4JsKpws0Y',
  WHOP_PLAN_PLUS_YEARLY: 'plan_8E43QsYkb4rQQ',
  WHOP_PLAN_PRO_MONTHLY: 'plan_g9BXWHChnHyCz',
  WHOP_PLAN_PRO_YEARLY: 'plan_hJ8UkJfKUmxiR',
  WHOP_PLAN_STUDIO_MONTHLY: 'plan_2AAHUugBB97xT',
  WHOP_PLAN_STUDIO_YEARLY: 'plan_EfqB3YSTQ1v24',
  WHOP_PLAN_AGENCY_MONTHLY: 'plan_9RPGJHBpjbA8D',
  // Agency bills every 3 months for now (pricing.js LONG_CYCLE); no yearly plan yet.
  WHOP_PLAN_AGENCY_QUARTERLY: 'plan_TgrAq6gea7W37',
  WHOP_PLAN_AGENCY_YEARLY: '',
  // The extra-channel add-on has no Whop plan yet: set this env var once it exists.
  WHOP_PLAN_ADDON_CHANNEL: '',
}

// Older Whop plans that still grant their tier (anyone who bought before the switch).
const RETIRED_PLANS = {
  plan_2PQXzyYrseWZ6: { tier: 'plus', cycle: 'monthly' },
  plan_5FMFAYw0z7AbJ: { tier: 'plus', cycle: 'yearly' },
  plan_oYn5KJ7Wnv8NA: { tier: 'pro', cycle: 'monthly' },
  plan_PBiAm2SiwS0jR: { tier: 'pro', cycle: 'yearly' },
  plan_pXuKK8Tk1Aj05: { tier: 'studio', cycle: 'monthly' },
  plan_7HLlhKgRF0XfQ: { tier: 'studio', cycle: 'yearly' },
}

function readEnv(name) {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name]).trim()
    }
  } catch (_) {}
  return ''
}

export function expectedPrice(tier, cycle) {
  const key = normalizeTier(tier)
  if (!key) return null
  // Yearly is billed once: the yearly per-month price x 12. Quarterly: x 3.
  if (cycle === 'yearly' || cycle === 'annual') return ANNUAL_PER_MONTH[key] * 12
  if (cycle === 'quarterly') return ANNUAL_PER_MONTH[key] * 3
  return MONTHLY[key]
}

export function loadWhopPlans(env) {
  const get = (name) => {
    if (env && env[name]) return String(env[name]).trim()
    return readEnv(name) || DEFAULTS[name]
  }
  return [
    { envKey: 'WHOP_PLAN_PLUS_MONTHLY', planId: get('WHOP_PLAN_PLUS_MONTHLY'), tier: 'plus', cycle: 'monthly', expectedPrice: expectedPrice('plus', 'monthly') },
    { envKey: 'WHOP_PLAN_PLUS_YEARLY', planId: get('WHOP_PLAN_PLUS_YEARLY'), tier: 'plus', cycle: 'yearly', expectedPrice: expectedPrice('plus', 'yearly') },
    { envKey: 'WHOP_PLAN_PRO_MONTHLY', planId: get('WHOP_PLAN_PRO_MONTHLY'), tier: 'pro', cycle: 'monthly', expectedPrice: expectedPrice('pro', 'monthly') },
    { envKey: 'WHOP_PLAN_PRO_YEARLY', planId: get('WHOP_PLAN_PRO_YEARLY'), tier: 'pro', cycle: 'yearly', expectedPrice: expectedPrice('pro', 'yearly') },
    { envKey: 'WHOP_PLAN_STUDIO_MONTHLY', planId: get('WHOP_PLAN_STUDIO_MONTHLY'), tier: 'studio', cycle: 'monthly', expectedPrice: expectedPrice('studio', 'monthly') },
    { envKey: 'WHOP_PLAN_STUDIO_YEARLY', planId: get('WHOP_PLAN_STUDIO_YEARLY'), tier: 'studio', cycle: 'yearly', expectedPrice: expectedPrice('studio', 'yearly') },
    { envKey: 'WHOP_PLAN_AGENCY_MONTHLY', planId: get('WHOP_PLAN_AGENCY_MONTHLY'), tier: 'agency', cycle: 'monthly', expectedPrice: expectedPrice('agency', 'monthly') },
    { envKey: 'WHOP_PLAN_AGENCY_QUARTERLY', planId: get('WHOP_PLAN_AGENCY_QUARTERLY'), tier: 'agency', cycle: 'quarterly', expectedPrice: expectedPrice('agency', 'quarterly') },
    { envKey: 'WHOP_PLAN_AGENCY_YEARLY', planId: get('WHOP_PLAN_AGENCY_YEARLY'), tier: 'agency', cycle: 'yearly', expectedPrice: expectedPrice('agency', 'yearly') },
  ]
}

/**
 * The Whop plan behind a pricing-card choice. The toggle only says monthly or
 * yearly; a tier with a yearly plan uses it, and a quarterly tier (LONG_CYCLE)
 * uses its quarterly plan instead.
 */
export function planRowFor(tier, cycle, env) {
  const key = normalizeTier(tier)
  const long = cycle === 'annual' || cycle === 'yearly' || cycle === 'quarterly'
  const rows = loadWhopPlans(env).filter((p) => p.tier === key && p.planId)
  if (!long) return rows.find((p) => p.cycle === 'monthly') || null
  const want = cycle === 'quarterly' ? 'quarterly' : (LONG_CYCLE[key] || 'yearly')
  return rows.find((p) => p.cycle === want) || rows.find((p) => p.cycle === 'yearly') || rows.find((p) => p.cycle === 'quarterly') || null
}

export function whopMapById(env) {
  const map = Object.create(null)
  for (const [planId, row] of Object.entries(RETIRED_PLANS)) {
    map[planId] = { envKey: null, planId, ...row, expectedPrice: null }
  }
  for (const row of loadWhopPlans(env)) {
    if (row.planId) map[row.planId] = row
  }
  return map
}

const PLAN_ID_KEYS = ['whop_plan_id', 'plan_id', 'planId', 'price_id', 'plan']
const PLAN_NAME_KEYS = ['plan', 'plan_tier', 'tier', 'plan_name', 'product_name']

function addPlanId(ids, seen, value) {
  if (typeof value !== 'string') return
  const id = value.trim()
  if (!/^plan_[A-Za-z0-9]+/.test(id) || seen.has(id)) return
  seen.add(id)
  ids.push(id)
}

export function planIdsFromUser(user) {
  const ids = []
  const seen = new Set()
  const blobs = [user, user?.subscription, user?.membership, user?.whop]
  for (const obj of blobs) {
    if (!obj || typeof obj !== 'object') continue
    for (const key of PLAN_ID_KEYS) addPlanId(ids, seen, obj[key])
  }
  return ids
}

/** Tier from a Whop plan ID, then from a plan name. */
export function resolveUserPlan(user, env) {
  if (!user) return { tier: null, cycle: null, legacy: false, planId: null }
  let mapped = null
  let unmapped = null
  for (const id of planIdsFromUser(user)) {
    const hit = resolveWhopPlan(id, env)
    if (hit.status === 'mapped') {
      mapped = hit
      break
    }
    if (hit.status === 'unmapped') unmapped = hit
  }
  let tier = mapped ? mapped.tier : null
  if (!tier) {
    for (const key of PLAN_NAME_KEYS) {
      const value = user[key]
      if (typeof value !== 'string') continue
      const raw = value.trim()
      if (!raw || raw.startsWith('plan_')) continue
      tier = normalizeTier(raw)
      if (tier) break
    }
  }
  const cycle = mapped ? mapped.cycle : (user.billing_cycle || user.interval || null)
  return {
    tier,
    cycle: cycle === 'annual' ? 'yearly' : cycle,
    legacy: !tier,
    planId: (mapped || unmapped)?.planId || null,
  }
}

/**
 * Map a Whop plan ID to an internal tier.
 * Unmapped IDs are legacy: do not rewrite the subscriber; keep current access.
 */
export function resolveWhopPlan(planId, env) {
  const id = String(planId || '').trim()
  if (!id) return { status: 'missing', legacy: true, planId: id }
  const hit = whopMapById(env)[id]
  if (!hit) {
    return { status: 'unmapped', legacy: true, planId: id }
  }
  return {
    status: 'mapped',
    legacy: false,
    planId: id,
    tier: hit.tier,
    cycle: hit.cycle,
    expectedPrice: hit.expectedPrice,
  }
}

export function checkoutUrlFor(tier, cycle) {
  const row = planRowFor(tier, cycle)
  if (!row || !row.planId) return ''
  return 'https://whop.com/checkout/' + row.planId
}

export const WHOP_CHECKOUT = {
  starter_monthly: checkoutUrlFor('plus', 'monthly'),
  starter_yearly: checkoutUrlFor('plus', 'yearly'),
  creator_monthly: checkoutUrlFor('pro', 'monthly'),
  creator_yearly: checkoutUrlFor('pro', 'yearly'),
  business_monthly: checkoutUrlFor('studio', 'monthly'),
  business_yearly: checkoutUrlFor('studio', 'yearly'),
  agency_monthly: checkoutUrlFor('agency', 'monthly'),
  agency_yearly: checkoutUrlFor('agency', 'yearly'),
}

/** Whop checkout for an add-on, or '' until its plan exists. */
export function addonCheckoutUrl(id) {
  const env = { extra_channel: 'WHOP_PLAN_ADDON_CHANNEL' }[id]
  const planId = env ? (readEnv(env) || DEFAULTS[env]) : ''
  return planId ? 'https://whop.com/checkout/' + planId : ''
}

export { DEFAULTS as WHOP_PLAN_ENV_DEFAULTS }
