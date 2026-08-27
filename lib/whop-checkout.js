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
    const data = await whopPost('/checkout_configurations', apiKey, {
      account_id: companyId,
      plan_id: row.planId,
      mode: 'payment',
      redirect_url: redirect,
      metadata: checkoutMetadata({ userId, email, tier: key }),
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
