// Credits: the one balance every plan sells (lib/entitlements.js).
// - A video costs 8 credits a minute, charged when its voiceover starts. That
//   covers the script, voice, render and its scene art (a free allowance of
//   Z-Image scenes, see sceneAllowance).
// - Each animated scene costs at least 4 credits; a consistent-character
//   scene (Nano Banana with a reference) costs 1; redraws past the allowance 1.
// - Anything else (Studio images, thumbnails, video clips) costs its Fal list
//   price at $0.025 a credit, rounded up, at least 1. Prices from fal.ai (Nov 2026).

import { ENTITLEMENTS, VIDEO_CREDITS_PER_MINUTE, entitlementsFor, normalizeTier, planDisplayName } from './entitlements.js'
import { imageModelById, imageSizeForAspect } from './fal-image.js'
import { SCENE_CHARACTER_MODEL, SCENE_IMAGE_MODEL, imageModelById as imageSpec } from './fal-image.js'
import { clipDurationFor, isFalVideoModel, videoModelById } from './fal-video.js'
import { scenePaceById, visualModeById, MAX_SCENES } from './visual-styles.js'
import { planIsActive, withCompedPlan } from './comped.js'
import { resolveUserPlan } from './whop-map.js'

/** Fal cost one credit covers on standalone generations. */
export const CREDIT_USD = 0.025
export { VIDEO_CREDITS_PER_MINUTE }
export const ANIMATION_MIN_CREDITS = 4
export const CHARACTER_SCENE_CREDITS = 1
export const SCENE_IMAGE_CREDITS = 1

/** Credits for the minutes of a video: 8 a minute (1 per 7.5 seconds), at least 1. */
export function videoCredits(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.max(1, Math.ceil((n / 60) * VIDEO_CREDITS_PER_MINUTE - 1e-9))
}

export function sceneCount(seconds, pace) {
  const n = Number(seconds) || 0
  if (n <= 0) return 0
  return Math.min(MAX_SCENES, Math.max(1, Math.round(n / scenePaceById(pace).seconds)))
}

/** Free Z-Image scenes a paid video gets: one per scene plus two spare. */
export function sceneAllowance(seconds, pace) {
  const n = sceneCount(seconds, pace)
  return n ? n + 2 : 0
}

/** Everything a video will cost, so a run can be refused before anything is spent. */
export function estimateVideoCredits({ seconds, pace = 'normal', mode = 'cheapest', character = false } = {}) {
  const scenes = sceneCount(seconds, pace)
  const every = visualModeById(mode).animateEvery
  const animated = every > 0 ? Math.ceil(scenes / every) : 0
  const minutes = videoCredits(seconds)
  const motion = animated * ANIMATION_MIN_CREDITS
  const face = character ? scenes * CHARACTER_SCENE_CREDITS : 0
  return { total: minutes + motion + face, minutes, animation: motion, character: face, scenes, animated }
}

/** Fal USD per second of video. Audio rates apply only when the model has an audio toggle. */
export const VIDEO_USD_PER_SECOND = {
  'h3-max-turbo': 0.015,
}

/** Fal USD per image. FLUX.2 Pro is computed from megapixels in falUsdForImage. */
export const IMAGE_USD = {
  'nano-banana': 0.0398,
  'z-image-turbo': 0.005,
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
  scene = false,
} = {}) {
  if (kind === 'video') {
    return Math.max(ANIMATION_MIN_CREDITS, creditsForUsd(falUsdForVideo({ model, duration, resolution, generateAudio })))
  }
  // Scene pricing is for a video's own scenes only: the two scene models at their
  // normal size. Any other model or a bigger size pays its usual price, so the
  // client's `scene` flag can't make premium images cheap.
  const sceneId = imageSpec(model)?.id
  const plainSize = !resolution || String(resolution).toUpperCase() === '1K'
  if (scene && plainSize && (sceneId === SCENE_IMAGE_MODEL || sceneId === SCENE_CHARACTER_MODEL)) {
    const count = Math.max(1, Math.min(4, parseInt(numImages, 10) || 1))
    return count * (sceneId === SCENE_IMAGE_MODEL ? SCENE_IMAGE_CREDITS : CHARACTER_SCENE_CREDITS)
  }
  return creditsForUsd(falUsdForImage({ model, resolution, numImages, aspect, width, height }))
}

/** True when a scene image can come out of the video's free allowance. */
export function usesSceneAllowance({ scene, model, refs } = {}) {
  return !!scene && imageSpec(model)?.id === SCENE_IMAGE_MODEL && !(Array.isArray(refs) && refs.length)
}

export function creditsLimitForTier(tier) {
  const e = entitlementsFor(tier)
  const n = Number(e?.studio_credits_per_month)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Monthly credits for a user's plan (comped and legacy included; legacy gets Plus). */
export function creditsLimitForUser(user) {
  const granted = withCompedPlan(user)
  if (!planIsActive(granted)) return 0
  const { tier } = resolveUserPlan(granted)
  return creditsLimitForTier(tier) || ENTITLEMENTS.plus.studio_credits_per_month
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
  const carry = Math.max(0, Math.floor(Number(nested.credits_carry ?? granted?.credits_carry) || 0))
  const remaining = Math.max(0, limit + carry - used)
  const name = planDisplayName(tier)
  return {
    remaining,
    used,
    limit,
    carry,
    tier: normalizeTier(tier),
    compact: remaining + ' cr',
    longText: remaining + ' credits left' + (carry ? ' (' + carry + ' rolled over)' : '') + ' · about ' + Math.floor(remaining / VIDEO_CREDITS_PER_MINUTE) + ' min of video · ' + name,
  }
}
