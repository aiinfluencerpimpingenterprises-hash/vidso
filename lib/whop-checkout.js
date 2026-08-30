// Server-side Whop checkout session. Metadata here is copied onto the
// membership, unlike query-string metadata on a generic checkout link.

import { normalizeTier } from './entitlements.js'
import { loadWhopPlans } from './whop-map.js'
import { whopConfig, whopPost } from './whop-lookup.js'

function appOrigin(origin) {
  const raw = String(origin || '').replace(/\/+$/, '')
  if (/^https?:\/\//i.test(raw)) return raw
  return 'https://vidso.pro'
}

// 3D Secure behaviour. Whop only accepts these two values, so an unrecognised
// setting is dropped rather than sent: a 400 here would break every checkout.
const THREE_DS_LEVELS = new Set(['mandate_challenge', 'frictionless'])

/**
 * Unset by default, so Whop's account-level setting applies and checkout keeps
 * behaving as it does today.
 *
 * Set WHOP_THREE_DS_LEVEL=mandate_challenge when the processor starts declining
 * charges as high risk or suspected fraud: an authenticated payment carries
 * issuer liability, so risk engines approve it where they block an
 * unauthenticated one. It costs some checkout friction, which is why it is a
 * deliberate switch rather than the default.
 */
export function threeDsLevel(env) {
  const raw = String(
    (env && env.WHOP_THREE_DS_LEVEL)
    || (typeof process !== 'undefined' ? process.env?.WHOP_THREE_DS_LEVEL : '')
    || '',
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
