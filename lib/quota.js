// Option 1 quota accounting: two per-type monthly counters.
// Never derive remaining videos from a credit balance.

import {
  entitlementsFor,
  formatQuotaLabel,
  isUnlimited,
  normalizeTier,
  planDisplayName,
  secondsFromDurationId,
} from './entitlements.js'
import { resolveUserPlan } from './whop-map.js'
import { planIsActive, withCompedPlan } from './comped.js'

/** Shorts are 60s and under. Everything longer counts as long-form. */
export const SHORT_FORM_MAX_SECONDS = 60

export function generationKindFromSeconds(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return null
  return n <= SHORT_FORM_MAX_SECONDS ? 'short_form' : 'long_form'
}

export function generationKindFromFormat(format) {
  return format === 'shorts' || format === 'short' || format === 'short_form'
    ? 'short_form'
    : 'long_form'
}

export function durationFromBody(body) {
  if (!body || typeof body !== 'object') return null
  const nested = body.script && typeof body.script === 'object' ? body.script : {}
  const explicit = Number(body.duration_seconds ?? body.durationSeconds ?? nested.duration_seconds)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const id = body.duration_id || body.durationId || nested.duration_id || nested.durationId
  const fromId = secondsFromDurationId(id)
  if (fromId) return fromId
  const mins = Number(body.target_minutes)
  if (Number.isFinite(mins) && mins > 0) return Math.round(mins * 60)
  const direct = Number(body.duration)
  if (Number.isFinite(direct) && direct > 0) return direct
  return null
}

function firstFinite(obj, keys) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    const n = Number(obj[key])
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n))
  }
  return null
}

/**
 * Read long/short counters from /api/user/me or /api/user/usage.
 * Ignores `credits` so the UI cannot contradict advertised video counts.
 */
export function parseUsageCounts(...sources) {
  let known = false
  let long_form_used = 0
  let short_form_used = 0
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const nested = source.usage && typeof source.usage === 'object' ? source.usage : source
    const lf = firstFinite(nested, ['long_form_used', 'longFormUsed', 'long_form'])
    const sf = firstFinite(nested, ['short_form_used', 'shortFormUsed', 'short_form'])
    if (lf != null) { long_form_used = lf; known = true }
    if (sf != null) { short_form_used = sf; known = true }
  }
  return { long_form_used, short_form_used, known }
}

function accessFromUser(user) {
  if (!user) return { active: false, tier: null, legacy: false, entitlements: null }
  const granted = withCompedPlan(user)
  const active = planIsActive(granted)
  const resolved = resolveUserPlan(granted)
  return {
    active,
    tier: resolved.tier,
    legacy: resolved.legacy,
    entitlements: entitlementsFor(resolved.tier, resolved.cycle),
  }
}

export function quotaView(user, usage) {
  const access = accessFromUser(user)
  const counts = parseUsageCounts(user, usage)
  if (!access.active) {
    return {
      compact: 'No plan',
      longText: 'No active plan',
      unlimited: false,
      legacy: false,
      remainingLong: 0,
      remainingShort: 0,
    }
  }
  if (access.legacy) {
    return {
      compact: 'Active',
      longText: 'Legacy plan — existing access kept',
      unlimited: false,
      legacy: true,
      remainingLong: null,
      remainingShort: null,
    }
  }
  const e = access.entitlements
  if (!e) {
    return {
      compact: 'Active',
      longText: 'Plan active',
      unlimited: false,
      legacy: false,
      remainingLong: null,
      remainingShort: null,
    }
  }
  const name = planDisplayName(access.tier)
  if (isUnlimited(e.long_form_per_month) && isUnlimited(e.short_form_per_month)) {
    return {
      compact: 'Unlimited',
      longText: name + ' · unlimited videos',
      unlimited: true,
      legacy: false,
      remainingLong: null,
      remainingShort: null,
      tier: access.tier,
    }
  }
  const usedL = counts.long_form_used
  const usedS = counts.short_form_used
  const remL = Math.max(0, e.long_form_per_month - usedL)
  const remS = Math.max(0, e.short_form_per_month - usedS)
  const compact = counts.known
    ? remL + ' LF · ' + remS + ' SF'
    : e.long_form_per_month + ' LF · ' + e.short_form_per_month + ' SF'
  const longText = counts.known
    ? remL + ' of ' + e.long_form_per_month + ' long-form · ' + remS + ' of ' + e.short_form_per_month + ' short-form this month'
    : name + ' · ' + formatQuotaLabel(e.long_form_per_month) + ' long-form · ' + formatQuotaLabel(e.short_form_per_month) + ' short-form'
  return {
    compact,
    longText,
    unlimited: false,
    legacy: false,
    remainingLong: remL,
    remainingShort: remS,
    usedLong: usedL,
    usedShort: usedS,
    known: counts.known,
    tier: access.tier,
  }
}

export function unlockCopy(user) {
  const v = quotaView(user)
  if (v.unlimited) return 'unlimited videos'
  if (v.legacy) return 'your plan'
  const e = entitlementsFor(normalizeTier(user?.plan || user?.plan_tier || v.tier))
  if (!e) return 'your plan'
  return e.long_form_per_month + ' long-form and ' + e.short_form_per_month + ' short-form videos'
}

/**
 * Which Railway routes consume a video count vs only need an active plan.
 * Count a faceless video once, at render — not at script or media.
 */
export const ROUTE_POLICY = {
  consumeQuota: {
    'POST /api/faceless/render': { kind: 'from_duration', incrementOn: 'start' },
  },
  checkLength: [
    'POST /api/faceless/script',
    'POST /api/faceless/media',
    'POST /api/faceless/render',
  ],
  featureGate: {
    'POST /api/download/analyze': 'viral_moment_clipping',
    'POST /api/autoclip': 'viral_moment_clipping',
  },
  activePlanOnly: [
    'POST /api/caption/burn',
    'POST /api/reframe',
    'POST /api/reframe/:id/render',
    'POST /api/commentary',
    'POST /api/generate/image',
    'POST /api/tts/generate',
    'POST /api/ranking',
    'GET /api/download/clip',
    'POST /api/upload',
  ],
}
