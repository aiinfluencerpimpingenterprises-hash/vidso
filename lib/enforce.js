// Server-side entitlement checks. Import these at generation endpoints.
// Client-side copies are UX only and must not be the gate.
//
// Quota accounting (Option 1, pending approval): pass long_form_used /
// short_form_used for the current anniversary window. Do not increment
// counters for unlimited tiers; still return logUsage: true.

import {
  ENTITLEMENTS,
  GATED_FEATURES,
  entitlementsFor,
  formatMinutes,
  formatQuotaLabel,
  isUnlimited,
  minTierForFeature,
  minTierForLength,
  minTierForQuota,
  normalizeTier,
  planDisplayName,
  quotaLimit,
} from './entitlements.js'
import { resolveWhopPlan } from './whop-map.js'

export function denial(status, code, message, extra = {}) {
  return {
    ok: false,
    status,
    code,
    message,
    ...extra,
  }
}

export function allow(extra = {}) {
  return { ok: true, ...extra }
}

export function resolveAccess(user, env) {
  if (!user) {
    return { active: false, tier: null, cycle: null, legacy: false, entitlements: null }
  }
  const active = user.plan_status === 'active' || user.active === true
  const fromId = resolveWhopPlan(user.whop_plan_id || user.plan_id, env)
  let tier = fromId.status === 'mapped' ? fromId.tier : normalizeTier(user.plan || user.plan_tier || user.tier)
  const cycle = fromId.status === 'mapped' ? fromId.cycle : (user.billing_cycle || user.interval || null)
  const legacy = fromId.legacy === true && !tier
  return {
    active,
    tier,
    cycle: cycle === 'annual' ? 'yearly' : cycle,
    legacy,
    planId: fromId.planId || null,
    entitlements: entitlementsFor(tier, cycle),
  }
}

function kindLabel(kind) {
  return kind === 'short_form' ? 'short-form' : 'long-form'
}

export function evaluatePlan(user, env) {
  const access = resolveAccess(user, env)
  if (!access.active) {
    return denial(402, 'no_active_plan', 'An active Vidso plan is required.')
  }
  if (access.legacy) {
    return allow({
      legacy: true,
      increment: false,
      logUsage: true,
      access,
      message: 'Legacy plan: keep existing access. New per-type quotas are not applied.',
    })
  }
  if (!access.tier || !access.entitlements) {
    return denial(402, 'no_active_plan', 'An active Vidso plan is required.')
  }
  return allow({ access, legacy: false })
}

export function evaluateQuota({ user, kind, used = 0, env } = {}) {
  const plan = evaluatePlan(user, env)
  if (!plan.ok) return plan
  if (plan.legacy) return plan
  if (kind !== 'long_form' && kind !== 'short_form') {
    return denial(400, 'invalid_kind', 'Generation kind must be long_form or short_form.')
  }
  const limit = quotaLimit(plan.access.tier, kind)
  const name = planDisplayName(plan.access.tier)
  if (isUnlimited(limit)) {
    return allow({
      access: plan.access,
      increment: false,
      logUsage: true,
      used,
      limit: null,
    })
  }
  const usedCount = Math.max(0, Number(used) || 0)
  const remaining = Math.max(0, limit - usedCount)
  if (usedCount >= limit) {
    const lift = minTierForQuota(kind, limit + 1)
    return denial(402, 'quota_exceeded',
      name + ' includes ' + limit + ' ' + kindLabel(kind) + ' videos per month. Upgrade to ' +
      planDisplayName(lift) + ' (' + formatQuotaLabel(quotaLimit(lift, kind)) + ') to continue.',
      {
        limit,
        used,
        remaining: 0,
        kind,
        tier: plan.access.tier,
        requiredTier: lift,
      })
  }
  return allow({
    access: plan.access,
    increment: true,
    logUsage: true,
    used,
    limit,
    remaining,
  })
}

export function evaluateLength({ user, durationSeconds, env } = {}) {
  const plan = evaluatePlan(user, env)
  if (!plan.ok) return plan
  if (plan.legacy) return plan
  const cap = plan.access.entitlements.max_video_length_seconds
  const seconds = Number(durationSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return denial(400, 'invalid_duration', 'A video duration is required.')
  }
  if (seconds > cap) {
    const lift = minTierForLength(seconds)
    const liftLabel = lift ? planDisplayName(lift) + ' (' + formatMinutes(ENTITLEMENTS[lift].max_video_length_seconds) + ')' : 'a higher plan'
    return denial(403, 'length_exceeded',
      planDisplayName(plan.access.tier) + ' allows videos up to ' + formatMinutes(cap) +
      '. This request is ' + formatMinutes(seconds) + '. Upgrade to ' + liftLabel + ' to continue.',
      {
        capSeconds: cap,
        requestedSeconds: seconds,
        tier: plan.access.tier,
        requiredTier: lift,
      })
  }
  return allow({ access: plan.access, capSeconds: cap, requestedSeconds: seconds, logUsage: false })
}

export function evaluateFeature({ user, feature, env } = {}) {
  const plan = evaluatePlan(user, env)
  if (!plan.ok) return plan
  if (plan.legacy) return plan
  if (!GATED_FEATURES.includes(feature)) {
    return allow({ access: plan.access, feature, gated: false })
  }
  if (plan.access.entitlements[feature]) {
    return allow({ access: plan.access, feature, gated: true })
  }
  const lift = minTierForFeature(feature)
  return denial(403, 'feature_locked',
    planDisplayName(plan.access.tier) + ' does not include this feature. Upgrade to ' +
    planDisplayName(lift) + ' to continue.',
    {
      feature,
      tier: plan.access.tier,
      requiredTier: lift,
    })
}

export function toHttp(result) {
  if (result.ok) return { status: 200, body: { ok: true } }
  return {
    status: result.status,
    body: {
      ok: false,
      error: result.code,
      message: result.message,
      requiredTier: result.requiredTier || undefined,
      limit: result.limit,
      kind: result.kind,
      capSeconds: result.capSeconds,
      feature: result.feature,
    },
  }
}

/** Express-style helper: call next() or send the denial. */
export function sendDenial(res, result) {
  const http = toHttp(result)
  return res.status(http.status).json(http.body)
}
