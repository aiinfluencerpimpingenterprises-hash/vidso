// Vidso-side plan grants — Clipzo does not expose a plan admin API.
// Keep these lists in sync with the dashboard boot script (cannot import modules there).

export const COMPED_STUDIO_EMAILS = [
  'stormdecoded@gmail.com',
]

export const COMPED_PRO_EMAILS = [
  'ntuamassoma@gmail.com',
]

const DEFAULT_CYCLE = { studio: 'yearly', pro: 'monthly', plus: 'monthly' }

export function emailsFromUser(user) {
  const out = []
  const add = (value) => {
    const email = String(value || '').trim().toLowerCase()
    if (email && email.includes('@') && !out.includes(email)) out.push(email)
  }
  if (!user || typeof user !== 'object') return out
  add(user.email)
  add(user.user_email)
  add(user.user?.email)
  add(user.profile?.email)
  return out
}

export function compedTierForEmail(email) {
  const id = String(email || '').trim().toLowerCase()
  if (COMPED_STUDIO_EMAILS.includes(id)) return 'studio'
  if (COMPED_PRO_EMAILS.includes(id)) return 'pro'
  return null
}

export function compedTier(user) {
  for (const email of emailsFromUser(user)) {
    const tier = compedTierForEmail(email)
    if (tier) return tier
  }
  return null
}

export function isCompedEmail(email) {
  return !!compedTierForEmail(email)
}

export function isCompedStudio(user) {
  return compedTier(user) === 'studio'
}

function rawPlanStatus(user) {
  if (!user) return ''
  return String(user.plan_status || '').trim().toLowerCase()
}

export function planIsActive(user) {
  if (!user) return false
  if (compedTier(user)) return true
  return rawPlanStatus(user) === 'active' || user.active === true
}

export function withCompedPlan(user) {
  if (!user || typeof user !== 'object') return user
  const status = rawPlanStatus(user)
  const active = status === 'active' || user.active === true
  const plan = user.plan || user.plan_tier || user.tier
  const mapped = {
    ...user,
    plan: plan || user.plan,
    plan_tier: user.plan_tier || plan,
    plan_status: active ? 'active' : (user.plan_status || status || 'inactive'),
    active: active || user.active === true,
  }
  const tier = compedTier(mapped)
  if (!tier) return mapped
  return {
    ...mapped,
    plan: tier,
    plan_tier: tier,
    plan_status: 'active',
    plan_interval: mapped.plan_interval || DEFAULT_CYCLE[tier] || 'monthly',
    active: true,
  }
}
