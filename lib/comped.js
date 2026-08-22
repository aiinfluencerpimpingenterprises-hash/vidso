// Gifted Studio accounts. Vidso-side grant — Clipzo does not expose a plan admin API.

export const COMPED_STUDIO_EMAILS = [
  'stormdecoded@gmail.com',
]

export function isCompedStudio(user) {
  const email = String(user?.email || '').trim().toLowerCase()
  return COMPED_STUDIO_EMAILS.includes(email)
}

export function withCompedPlan(user) {
  if (!user || !isCompedStudio(user)) return user
  return {
    ...user,
    plan: 'studio',
    plan_tier: 'studio',
    plan_status: 'active',
    plan_interval: 'yearly',
    active: true,
  }
}
