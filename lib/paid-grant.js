// Overlay a verified paid membership onto a Clipzo user object.
// Browser-safe. Do not import Node fs modules here.

export const TIER_RANK = { plus: 1, pro: 2, studio: 3 }

export const PAID_MEMBERSHIP_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'canceling',
])

export function applyPaidGrant(user, grant) {
  if (!user || typeof user !== 'object' || !grant || !grant.tier) return user
  return {
    ...user,
    plan: grant.tier,
    plan_tier: grant.tier,
    plan_status: 'active',
    plan_interval: grant.cycle || user.plan_interval,
    active: true,
    whop_plan_id: grant.planId || user.whop_plan_id,
  }
}
