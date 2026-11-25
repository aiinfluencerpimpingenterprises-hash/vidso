// Authoritative entitlement matrix for TubeOps tiers.
// Marketing cards (lib/pricing.js) and server-side enforcement (lib/enforce.js)
// both read from this object. Do not duplicate these numbers elsewhere.

export const UNLIMITED = null

/** Credits for one minute of finished video. Plans are sized in these. */
export const VIDEO_CREDITS_PER_MINUTE = 8

export const TIERS = ['plus', 'pro', 'studio', 'agency']

export const QUEUE = {
  standard: 'standard',
  priority: 'priority',
  fastest: 'fastest',
}

export const SUPPORT = {
  email: 'email',
  priority: 'priority',
}

/** Features every paid tier gets. Do not gate these. */
export const UNGATED_FEATURES = [
  'full_pipeline',
  'ai_script_writer',
  'premium_voiceover',
  'auto_broll',
  'auto_captions',
  'image_tools',
  'clipping_and_ranking',
  'commercial_usage',
]

/** Features that differ by tier. Keys match ENTITLEMENTS.*. */
export const GATED_FEATURES = [
  'video_tools',
  'viral_moment_clipping',
  'youtube_sourced_broll',
  'custom_brand_kit',
  'retention_score',
  'high_volume_workflow',
  'multi_channel_management',
  'image_4k',
]

/**
 * In-app duration chips. Caps (10 / 20 / 30 min) come from ENTITLEMENTS.
 * Do not add a length here unless it is advertised on the pricing cards.
 */
export const DURATION_PRESETS = {
  shorts: [
    { id: 'shorts_30', label: '30s', seconds: 30 },
    { id: 'shorts_45', label: '45s', seconds: 45 },
    { id: 'shorts_60', label: '60s', seconds: 60 },
  ],
  long: [
    { id: 'long_180', label: '3 min', seconds: 180 },
    { id: 'long_300', label: '5 min', seconds: 300 },
    { id: 'long_600', label: '10 min', seconds: 600 },
    { id: 'long_900', label: '15 min', seconds: 900 },
    { id: 'long_1200', label: '20 min', seconds: 1200 },
    { id: 'long_1800', label: '30 min', seconds: 1800 },
  ],
}

/**
 * Plans sell credits, not video counts. 8 credits = 1 minute of finished video
 * (script, voice, scene art, render); animation and a consistent character
 * cost extra credits (lib/studio-credits.js). Unused credits roll over for one
 * month (lib/usage-store.js).
 */
export const ENTITLEMENTS = {
  plus: {
    studio_credits_per_month: 300,
    max_video_length_seconds: 600,
    channels: 1,
    video_tools: false,
    viral_moment_clipping: false,
    youtube_sourced_broll: false,
    custom_brand_kit: false,
    render_queue_priority: QUEUE.standard,
    retention_score: false,
    high_volume_workflow: false,
    multi_channel_management: false,
    image_4k: false,
    support_tier: SUPPORT.email,
  },
  pro: {
    studio_credits_per_month: 750,
    max_video_length_seconds: 1200,
    channels: 3,
    video_tools: true,
    viral_moment_clipping: true,
    youtube_sourced_broll: true,
    custom_brand_kit: true,
    render_queue_priority: QUEUE.priority,
    retention_score: false,
    high_volume_workflow: false,
    multi_channel_management: true,
    image_4k: false,
    support_tier: SUPPORT.email,
  },
  studio: {
    studio_credits_per_month: 2000,
    max_video_length_seconds: 1800,
    channels: 10,
    video_tools: true,
    viral_moment_clipping: true,
    youtube_sourced_broll: true,
    custom_brand_kit: true,
    render_queue_priority: QUEUE.fastest,
    retention_score: true,
    high_volume_workflow: true,
    multi_channel_management: true,
    image_4k: true,
    support_tier: SUPPORT.priority,
  },
  agency: {
    studio_credits_per_month: 5000,
    max_video_length_seconds: 1800,
    channels: 25,
    video_tools: true,
    viral_moment_clipping: true,
    youtube_sourced_broll: true,
    custom_brand_kit: true,
    render_queue_priority: QUEUE.fastest,
    retention_score: true,
    high_volume_workflow: true,
    multi_channel_management: true,
    image_4k: true,
    support_tier: SUPPORT.priority,
  },
}

const TIER_ALIASES = {
  plus: 'plus',
  starter: 'plus',
  pro: 'pro',
  creator: 'pro',
  studio: 'studio',
  business: 'studio',
  agency: 'agency',
}

export function isUnlimited(value) {
  return value === UNLIMITED || value === null
}

export function normalizeTier(input) {
  if (!input) return null
  const raw = String(input).trim().toLowerCase()
  if (TIER_ALIASES[raw]) return TIER_ALIASES[raw]
  if (raw.includes('agency')) return 'agency'
  if (raw.includes('studio') || raw.includes('business')) return 'studio'
  if (raw.includes('pro') || raw.includes('creator')) return 'pro'
  if (raw.includes('plus') || raw.includes('starter')) return 'plus'
  return null
}

export function entitlementsFor(tier, cycle) {
  void cycle // Annual and monthly resolve to the same limits. Billing period must not affect this.
  const key = normalizeTier(tier)
  if (!key || !ENTITLEMENTS[key]) return null
  return { ...ENTITLEMENTS[key], tier: key }
}

/** Video counts are gone: every plan makes as many videos as its credits cover. */
export function quotaLimit(tier, kind) {
  const e = entitlementsFor(tier)
  if (!e) return undefined
  if (kind === 'long_form' || kind === 'short_form') return UNLIMITED
  return undefined
}

/** Channels (brand profiles) a plan runs, plus any extra-channel add-ons. */
export function channelLimit(tier, addons = 0) {
  const e = entitlementsFor(tier)
  const base = Number(e?.channels) || 1
  return base + Math.max(0, Math.floor(Number(addons) || 0))
}

export function formatMinutes(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return ''
  const mins = n / 60
  return Number.isInteger(mins) ? mins + ' min' : mins.toFixed(1) + ' min'
}

export function formatQuotaLabel(limit) {
  if (isUnlimited(limit)) return 'Unlimited'
  return limit + ' / month'
}

export function minTierForFeature(feature) {
  for (const tier of TIERS) {
    if (ENTITLEMENTS[tier][feature] === true) return tier
  }
  return null
}

export function minTierForQuota(kind, needed) {
  for (const tier of TIERS) {
    const limit = quotaLimit(tier, kind)
    if (isUnlimited(limit) || (Number.isFinite(limit) && limit >= needed)) return tier
  }
  return 'studio'
}

export function minTierForLength(seconds) {
  for (const tier of TIERS) {
    if (ENTITLEMENTS[tier].max_video_length_seconds >= seconds) return tier
  }
  return null
}

export function secondsFromDurationId(id) {
  const key = String(id || '').trim()
  if (!key) return null
  for (const row of DURATION_PRESETS.shorts.concat(DURATION_PRESETS.long)) {
    if (row.id === key) return row.seconds
  }
  const m = key.match(/_(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Presets a tier may pick. Unknown / unpaid / unlimited cap → all advertised lengths. */
export function durationPresets(format, capSeconds) {
  const shorts = format === 'shorts' || format === 'short' || format === 'short_form'
  const list = shorts ? DURATION_PRESETS.shorts : DURATION_PRESETS.long
  if (isUnlimited(capSeconds)) return list.slice()
  const cap = Number(capSeconds)
  if (!Number.isFinite(cap) || cap <= 0) return list.slice()
  return list.filter((d) => d.seconds <= cap)
}

export function planDisplayName(tier) {
  const key = normalizeTier(tier)
  return { plus: 'Plus', pro: 'Pro', studio: 'Studio', agency: 'Agency' }[key] || 'a higher plan'
}

/**
 * Monthly quota window aligned to the subscription anniversary day,
 * not calendar month 1. Annual subscribers still get a monthly window
 * so per-month entitlements stay identical across billing cycles.
 */
export function quotaWindow(anchor, now = new Date()) {
  const startAnchor = new Date(anchor)
  const current = new Date(now)
  if (Number.isNaN(startAnchor.getTime()) || Number.isNaN(current.getTime())) {
    return null
  }
  const day = startAnchor.getUTCDate()
  let year = current.getUTCFullYear()
  let month = current.getUTCMonth()

  function utcDate(y, m, d) {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    return new Date(Date.UTC(y, m, Math.min(d, last)))
  }

  let windowStart = utcDate(year, month, day)
  if (windowStart > current) {
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
    windowStart = utcDate(year, month, day)
  }
  let endMonth = windowStart.getUTCMonth() + 1
  let endYear = windowStart.getUTCFullYear()
  if (endMonth > 11) {
    endMonth = 0
    endYear += 1
  }
  const windowEnd = utcDate(endYear, endMonth, day)
  return { start: windowStart, end: windowEnd }
}

export function inQuotaWindow(anchor, at = new Date()) {
  const w = quotaWindow(anchor, at)
  if (!w) return false
  const t = new Date(at).getTime()
  return t >= w.start.getTime() && t < w.end.getTime()
}
