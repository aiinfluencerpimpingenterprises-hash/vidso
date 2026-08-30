// Server-side Whop checkout session. Metadata here is copied onto the
// membership, unlike query-string metadata on a generic checkout link.

import { normalizeTier } from './entitlements.js'
import { loadWhopPlans } from './whop-map.js'
import { retrievePlan, whopConfig, whopPatch, whopPost } from './whop-lookup.js'

const orchestrationCache = globalThis.__vidsoOrchestration
  || (globalThis.__vidsoOrchestration = new Map())

/**
 * Checkout settings that recover the declines we can actually move: 3DS for
 * fraud holds, adaptive pricing for cross-border flags, and Whop's platform
 * payment methods so a blocked card can still pay another way. Prices and
 * billing intervals stay untouched.
 *
 * Billing address is not in this patch — Whop's hosted checkout always
 * collects it. Insufficient-funds retries are also Whop's, not a plan flag.
 */
export function orchestrationPatch() {
  return {
    adaptive_pricing_enabled: true,
    three_ds_level: 'mandate_challenge',
    payment_method_configuration: {
      include_platform_defaults: true,
      enabled: ['card'],
      disabled: [],
    },
  }
}

export function planHasOrchestration(plan) {
  if (!plan || typeof plan !== 'object') return false
  if (plan.adaptive_pricing_enabled !== true) return false
  if (plan.three_ds_level !== 'mandate_challenge') return false
  const pmc = plan.payment_method_configuration
  // null means the plan already inherits Whop's platform defaults.
  if (pmc == null) return true
  return pmc.include_platform_defaults === true
}

export async function ensurePlanOrchestration(planId, env) {
  const id = String(planId || '').trim()
  if (!id) return { ok: false, reason: 'missing_plan' }
  if (orchestrationCache.get(id) === 'ok') return { ok: true, already: true }
  const { apiKey } = whopConfig(env)
  if (!apiKey) return { ok: false, reason: 'missing_key' }
  try {
    const current = await retrievePlan(id, env)
    if (planHasOrchestration(current)) {
      orchestrationCache.set(id, 'ok')
      return { ok: true, already: true }
    }
    await whopPatch('/plans/' + encodeURIComponent(id), apiKey, orchestrationPatch())
    orchestrationCache.set(id, 'ok')
    return { ok: true, already: false }
  } catch (e) {
    return {
      ok: false,
      reason: e.status === 403 ? 'missing_permission' : 'whop_error',
      message: e.message || 'Could not enable orchestration on this plan.',
    }
  }
}

export async function enableVidsoOrchestration(env) {
  const results = []
  for (const row of loadWhopPlans(env)) {
    if (!row.planId) continue
    const hit = await ensurePlanOrchestration(row.planId, env)
    results.push({ planId: row.planId, tier: row.tier, cycle: row.cycle, ...hit })
  }
  return results
}

export function _resetOrchestrationCacheForTests() {
  orchestrationCache.clear()
}

function appOrigin(origin) {
  const raw = String(origin || '').replace(/\/+$/, '')
  if (/^https?:\/\//i.test(raw)) return raw
  return 'https://vidso.pro'
}

// 3D Secure behaviour. Whop only accepts these two values, so an unrecognised
// setting is dropped rather than sent: a 400 here would break every checkout.
const THREE_DS_LEVELS = new Set(['mandate_challenge', 'frictionless'])

/**
 * Force the 3DS challenge by default. Authenticated charges carry issuer
 * liability, which is what clears `suspected_fraud` / high-risk holds.
 * Set WHOP_THREE_DS_LEVEL=frictionless to trade that back for less checkout
 * friction, or `off` to inherit the Whop account default.
 */
export function threeDsLevel(env) {
  const raw = String(
    (env && env.WHOP_THREE_DS_LEVEL)
    || (typeof process !== 'undefined' ? process.env?.WHOP_THREE_DS_LEVEL : '')
    || 'mandate_challenge',
  ).trim().toLowerCase()
  return THREE_DS_LEVELS.has(raw) ? raw : null
}

export function checkoutMetadata({ userId, email, tier } = {}) {
  const meta = {}
  if (userId) {
    meta.user_id = String(userId)
    meta.vidso_user_id = String(userId)
  }
  if (email) meta.email = String(email).trim().toLowerCase()
  if (tier) meta.tier = String(tier)
  return meta
}

export async function createCheckoutSession({ tier, cycle, email, userId, origin } = {}, env) {
  const interval = cycle === 'yearly' || cycle === 'annual' ? 'yearly' : 'monthly'
  const key = normalizeTier(tier)
  const row = loadWhopPlans(env).find((p) => p.tier === key && p.cycle === interval)
  if (!row?.planId) return { url: '', source: 'missing_plan' }

  const { apiKey, companyId } = whopConfig(env)
  const redirect = appOrigin(origin) + '/video-generation?billing=success'
  if (!apiKey) return { url: '', source: 'missing_key' }

  try {
    // Best-effort: a missing plan:update scope must not block checkout.
    await ensurePlanOrchestration(row.planId, env)
    const level = threeDsLevel(env)
    const data = await whopPost('/checkout_configurations', apiKey, {
      account_id: companyId,
      plan_id: row.planId,
      mode: 'payment',
      redirect_url: redirect,
      metadata: checkoutMetadata({ userId, email, tier: key }),
      ...(level ? { three_ds_level: level } : {}),
    })
    let url = String(data.purchase_url || data.purchaseUrl || '').trim()
    if (!url) return { url: '', source: 'no_purchase_url' }
    const u = new URL(url)
    if (email) {
      u.searchParams.set('email', email)
      u.searchParams.set('email.disabled', '1')
    }
    return { url: u.toString(), source: 'session', checkoutId: data.id || null }
  } catch (e) {
    return { url: '', source: 'error', message: e.message || 'checkout_failed' }
  }
}
