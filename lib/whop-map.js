// Whop plan ID → internal tier + billing cycle.
// IDs can be overridden with env vars on the Railway API. The frontend
// uses the defaults below (the live checkout links). Do not put IDs in
// generation or entitlement business logic — import this module.

import { MONTHLY } from './pricing.js'
import { normalizeTier } from './entitlements.js'

const DEFAULTS = {
  WHOP_PLAN_PLUS_MONTHLY: 'plan_2PQXzyYrseWZ6',
  WHOP_PLAN_PLUS_YEARLY: 'plan_5FMFAYw0z7AbJ',
  WHOP_PLAN_PRO_MONTHLY: 'plan_oYn5KJ7Wnv8NA',
  WHOP_PLAN_PRO_YEARLY: 'plan_PBiAm2SiwS0jR',
  WHOP_PLAN_STUDIO_MONTHLY: 'plan_pXuKK8Tk1Aj05',
  WHOP_PLAN_STUDIO_YEARLY: 'plan_7HLlhKgRF0XfQ',
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
  // Live Whop yearly charges are whole dollars (179 / 299 / 359), set by hand.
  if (cycle === 'yearly' || cycle === 'annual') return { plus: 179, pro: 299, studio: 359 }[key]
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
  ]
}

export function whopMapById(env) {
  const map = Object.create(null)
  for (const row of loadWhopPlans(env)) {
    if (row.planId) map[row.planId] = row
  }
  return map
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
  const key = normalizeTier(tier)
  const interval = cycle === 'annual' || cycle === 'yearly' ? 'yearly' : 'monthly'
  const row = loadWhopPlans().find((p) => p.tier === key && p.cycle === interval)
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
}

export { DEFAULTS as WHOP_PLAN_ENV_DEFAULTS }
