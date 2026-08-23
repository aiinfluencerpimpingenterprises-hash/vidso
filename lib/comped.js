// Gifted Studio accounts. Vidso-side grant — Clipzo does not expose a plan admin API.
// Keep this list in sync with the dashboard boot script (cannot import modules there).

export const COMPED_STUDIO_EMAILS = [
  'stormdecoded@gmail.com',
]

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

export function isCompedEmail(email) {
  return COMPED_STUDIO_EMAILS.includes(String(email || '').trim().toLowerCase())
}

export function isCompedStudio(user) {
  return emailsFromUser(user).some(isCompedEmail)
}

function rawPlanStatus(user) {
  if (!user) return ''
  return String(user.plan_status || '').trim().toLowerCase()
}

export function planIsActive(user) {
  if (!user) return false
  if (isCompedStudio(user)) return true
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
  if (!isCompedStudio(mapped)) return mapped
  return {
    ...mapped,
    plan: 'studio',
    plan_tier: 'studio',
    plan_status: 'active',
    plan_interval: mapped.plan_interval || 'yearly',
    active: true,
  }
}
