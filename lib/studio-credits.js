// Faceless Studio / thumbnail Fal metering.
// 1 credit = $0.01 of Fal list price, rounded up. Prices from fal.ai (Aug 2026).
// Video is billed per second of output; images per successful image.
// Estimates (Seedance 480p/4K, FLUX.2 Max, GPT Image 2) are padded high on purpose.

import { ENTITLEMENTS, entitlementsFor, normalizeTier, planDisplayName } from './entitlements.js'
import { imageModelById, imageSizeForAspect } from './fal-image.js'
import { clipDurationFor, isFalVideoModel, videoModelById } from './fal-video.js'
import { planIsActive, withCompedPlan } from './comped.js'
import { resolveUserPlan } from './whop-map.js'

export const CREDIT_USD = 0.01

/** Fal USD per second of video. Audio rates apply only when the model has an audio toggle. */
export const VIDEO_USD_PER_SECOND = {
  'kling-3-pro': { silent: 0.112, audio: 0.168 },
  'veo-3.1': {
    '720p': { silent: 0.20, audio: 0.40 },
    '1080p': { silent: 0.20, audio: 0.40 },
    '4k': { silent: 0.40, audio: 0.60 },
  },
  'seedance-2': {
    '480p': 0.15,
    '720p': 0.3034,
    '1080p': 0.682,
    '4k': 1.20,
  },
  'wan-2.7': { '720p': 0.10, '1080p': 0.15 },
  'sora-2': 0.10,
  'hailuo-02': 0.08,
}

/** Fal USD per image. FLUX.2 Pro is computed from megapixels in falUsdForImage. */
export const IMAGE_USD = {
  'nano-banana': 0.039,
  'nano-banana-pro': { '1K': 0.15, '2K': 0.15, '4K': 0.30 },
  'flux-2-pro': { firstMp: 0.03, extraMp: 0.015 },
  'flux-2-max': 0.07,
  'gpt-image-2': 0.16,
  'seedream-4.5': 0.04,
  'seedream-5-lite': 0.035,
  'seedream-5-pro': { under1536: 0.0675, over1536: 0.135 },
}

export function creditsForUsd(usd) {
  const n = Number(usd)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.max(1, Math.ceil(n / CREDIT_USD - 1e-9))
}

function durationSeconds(duration) {
  const n = parseFloat(String(duration ?? '').replace(/s$/i, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function normalizeRes(resolution) {
  const key = String(resolution || '').trim().toLowerCase()
  if (key === '4k' || key === '2160p') return '4k'
  if (key === '1080p' || key === '1080') return '1080p'
  if (key === '480p' || key === '480') return '480p'
  if (key === '720p' || key === '720') return '720p'
  return key
}

function pickRate(table, res, fallbackRes) {
  if (table == null) return 0
  if (typeof table === 'number') return table
  const key = normalizeRes(res)
  if (key && table[key] != null) return table[key]
  if (fallbackRes && table[fallbackRes] != null) return table[fallbackRes]
  if (table['720p'] != null) return table['720p']
  const first = Object.values(table)[0]
  return typeof first === 'number' ? first : 0
}

export function falUsdForVideo({ model, duration, resolution, generateAudio } = {}) {
  const id = String(model || '').trim()
  if (!isFalVideoModel(id)) return 0
  const seconds = clipDurationFor(id, durationSeconds(duration) || videoModelById(id)?.defaultDuration || 5)
  const res = normalizeRes(resolution)
  const audio = generateAudio === true
  if (id === 'kling-3-pro') {
    const row = VIDEO_USD_PER_SECOND[id]
    return (audio ? row.audio : row.silent) * seconds
  }
  if (id === 'veo-3.1') {
    const row = pickRate(VIDEO_USD_PER_SECOND[id], res, '720p') || VIDEO_USD_PER_SECOND[id]['720p']
    return (audio ? row.audio : row.silent) * seconds
  }
  if (id === 'seedance-2') {
    return pickRate(VIDEO_USD_PER_SECOND[id], res, '720p') * seconds
  }
  if (id === 'wan-2.7') {
    return pickRate(VIDEO_USD_PER_SECOND[id], res, '720p') * seconds
  }
  const rate = VIDEO_USD_PER_SECOND[id]
  const perSec = typeof rate === 'number' ? rate : pickRate(rate, res, '720p')
  return perSec * seconds
}

function megapixels(width, height) {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1
  return (w * h) / 1e6
}

function bananaRes(resolution) {
  const key = String(resolution || '').toUpperCase()
  if (key === '4K') return '4K'
  if (key === '2K') return '2K'
  return '1K'
}

export function falUsdForImage({ model, resolution, numImages, aspect, width, height } = {}) {
  const spec = imageModelById(model)
  const id = spec?.id || 'nano-banana-pro'
  const count = Math.max(1, Math.min(4, parseInt(numImages, 10) || 1))
  let unit = IMAGE_USD[id]
  if (id === 'nano-banana-pro') {
    unit = IMAGE_USD[id][bananaRes(resolution || spec.resolution)]
  } else if (id === 'flux-2-pro') {
    let w = Number(width)
    let h = Number(height)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      const size = imageSizeForAspect(aspect, bananaRes(resolution) === '1K' && !resolution ? '1K' : (resolution || '1K'))
      w = size.image_size.width
      h = size.image_size.height
    }
    const mp = Math.max(1, megapixels(w, h))
    unit = IMAGE_USD[id].firstMp + Math.max(0, mp - 1) * IMAGE_USD[id].extraMp
  } else if (id === 'seedream-5-pro') {
    let w = Number(width)
    let h = Number(height)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      const size = imageSizeForAspect(aspect, resolution || '2K')
      w = size.image_size.width
      h = size.image_size.height
    }
    const px = Math.max(1, w * h)
    unit = px > 1536 * 1536 ? IMAGE_USD[id].over1536 : IMAGE_USD[id].under1536
  } else if (typeof unit !== 'number') {
    unit = 0.15
  }
  return unit * count
}

export function creditCharge({
  kind,
  model,
  duration,
  resolution,
  generateAudio,
  numImages,
  aspect,
  width,
  height,
} = {}) {
  const usd = kind === 'video'
    ? falUsdForVideo({ model, duration, resolution, generateAudio })
    : falUsdForImage({ model, resolution, numImages, aspect, width, height })
  return creditsForUsd(usd)
}

export function creditsLimitForTier(tier) {
  const e = entitlementsFor(tier)
  const n = Number(e?.studio_credits_per_month)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function studioCreditView(user, usage) {
  const granted = withCompedPlan(user)
  if (!planIsActive(granted)) {
    return {
      remaining: 0,
      used: 0,
      limit: 0,
      compact: 'No plan',
      longText: 'An active plan is required for Faceless Studio credits.',
    }
  }
  const { tier } = resolveUserPlan(granted)
  const limit = creditsLimitForTier(tier) || ENTITLEMENTS.plus.studio_credits_per_month
  const nested = usage && typeof usage === 'object'
    ? (usage.usage && typeof usage.usage === 'object' ? usage.usage : usage)
    : {}
  const fromUser = Number(granted?.studio_credits_used)
  const fromUsage = Number(nested.studio_credits_used)
  const used = Math.max(0, Math.floor(
    Number.isFinite(fromUsage) ? fromUsage : (Number.isFinite(fromUser) ? fromUser : 0),
  ))
  const remaining = Math.max(0, limit - used)
  const name = planDisplayName(tier)
  return {
    remaining,
    used,
    limit,
    tier: normalizeTier(tier),
    compact: remaining + ' cr',
    longText: remaining + ' of ' + limit + ' Faceless Studio credits left this month · ' + name,
  }
}
