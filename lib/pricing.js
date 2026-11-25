// Prices and comparison-row copy. Tier LIMITS live in lib/entitlements.js —
// this file must derive quotas and feature flags from that object so marketing
// cards and server enforcement cannot drift.

import {
  ENTITLEMENTS,
  QUEUE,
  SUPPORT,
  TIERS,
  formatMinutes,
  VIDEO_CREDITS_PER_MINUTE,
  planDisplayName,
} from './entitlements.js'

export { TIERS, ENTITLEMENTS }

export const MONTHLY = { plus: 49, pro: 99, studio: 249, agency: 599 }
export const ANNUAL_PER_MONTH = { plus: 39, pro: 79, studio: 199, agency: 479 }

/** Tiers whose discounted plan bills every 3 months instead of yearly (no yearly Whop plan yet). */
export const LONG_CYCLE = { agency: 'quarterly' }

/** Months in the discounted billing period: 12, or 3 for quarterly tiers. */
export function longCycleMonths(tier) {
  return LONG_CYCLE[tier] === 'quarterly' ? 3 : 12
}

/** "Billed annually", or "Billed every 3 months" for quarterly tiers. */
export function longCycleLabel(tier) {
  return LONG_CYCLE[tier] === 'quarterly' ? 'Billed every 3 months' : 'Billed annually'
}

export const CHECKOUT_KEY = {
  plus: 'starter',
  pro: 'creator',
  studio: 'business',
  agency: 'agency',
}

/** Bought on top of a plan. Hidden until its Whop plan ID is configured (lib/whop-map.js). */
export const ADDONS = {
  extra_channel: { id: 'extra_channel', name: 'Extra channel', monthly: 15, note: 'One more channel with its own Manager' },
}

export function billedYearly(tier) {
  return ANNUAL_PER_MONTH[tier] * 12
}

export function annualSavings(tier) {
  return Math.round(MONTHLY[tier] * 12 - billedYearly(tier))
}

export function formatPrice(amount) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

export function formatSavingsUsd(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US')
}

export function isAnnualCycle(cycle) {
  return cycle === 'annual' || cycle === 'yearly'
}

export function popularTier(cycle) {
  void cycle
  return 'pro'
}

function flag(feature) {
  return Object.fromEntries(TIERS.map((t) => [t, !!ENTITLEMENTS[t][feature]]))
}

function each(fn) {
  return Object.fromEntries(TIERS.map((t) => [t, fn(ENTITLEMENTS[t], t)]))
}

function queueLabel(value) {
  if (value === QUEUE.fastest) return 'Fastest'
  if (value === QUEUE.priority) return 'Priority'
  return 'Standard'
}

function supportLabel(value) {
  return value === SUPPORT.priority ? 'Priority' : 'Email'
}

const TAGLINES = {
  plus: 'The essentials to start creating',
  pro: 'For creators serious about monetizing',
  studio: 'For running several channels',
  agency: 'For agencies and channel networks',
}

/** About how many 10-minute videos a month of still-image scenes. */
export function tenMinuteVideos(tier) {
  return Math.floor(ENTITLEMENTS[tier].studio_credits_per_month / (VIDEO_CREDITS_PER_MINUTE * 10))
}

export function minutesOfVideo(tier) {
  return Math.floor(ENTITLEMENTS[tier].studio_credits_per_month / VIDEO_CREDITS_PER_MINUTE)
}

export const PLANS = Object.fromEntries(TIERS.map((tier) => [tier, {
  id: tier,
  name: planDisplayName(tier),
  tagline: TAGLINES[tier],
  cta: 'Get ' + planDisplayName(tier) + ' →',
  credits: ENTITLEMENTS[tier].studio_credits_per_month.toLocaleString('en-US') + ' / month',
  minutes: minutesOfVideo(tier).toLocaleString('en-US') + ' min',
  tenMinute: tenMinuteVideos(tier),
  highlightQuota: tier === 'studio' || tier === 'agency',
}]))

export const FEATURE_ROWS = [
  { type: 'value', label: '10-min videos a month', ...each((_, t) => 'about ' + tenMinuteVideos(t)) },
  { type: 'value', label: 'Max video length', ...each((e) => formatMinutes(e.max_video_length_seconds)) },
  { type: 'value', label: 'Channels', ...each((e) => String(e.channels)) },
  { type: 'check', label: 'Script → voiceover → AI scenes → captions', ...each(() => true) },
  { type: 'check', label: '67 visual styles', ...each(() => true) },
  { type: 'check', label: 'Animate scenes (4 credits each)', ...each(() => true) },
  { type: 'check', label: 'Consistent character (1 credit a scene)', ...each(() => true) },
  { type: 'check', label: 'Unused credits roll over a month', ...each(() => true) },
  { type: 'check', label: 'AI script writer with hook engine', ...each(() => true) },
  { type: 'check', label: 'Premium AI voiceover library', ...each(() => true) },
  { type: 'check', label: 'Auto captions & subtitle styling', ...each(() => true) },
  { type: 'check', label: 'Thumbnails & image tools', ...each(() => true) },
  { type: 'check', label: 'Commercial usage rights', ...each(() => true) },
  { type: 'check', label: 'Video tools (transitions, effects, edits)', ...flag('video_tools') },
  { type: 'check', label: 'Viral moment clipping', ...flag('viral_moment_clipping') },
  { type: 'check', label: 'Custom brand kit (fonts, colors, logo)', ...flag('custom_brand_kit') },
  {
    type: 'value',
    label: 'Render queue',
    ...each((e) => queueLabel(e.render_queue_priority)),
    included: each((e) => e.render_queue_priority !== QUEUE.standard),
  },
  { type: 'check', label: 'Retention score on long-form', ...flag('retention_score') },
  { type: 'check', label: 'High-volume publishing workflow', ...flag('high_volume_workflow') },
  {
    type: 'value',
    label: 'Support',
    ...each((e) => supportLabel(e.support_tier)),
    included: each((e) => e.support_tier === SUPPORT.priority),
  },
]

export function rowIncluded(row, tier) {
  if (row.type === 'check') return !!row[tier]
  if (row.included) return !!row.included[tier]
  return true
}

export const TRUST_LINE = 'Cancel anytime. Unused credits roll over a month.'

export function planView(tier) {
  const plan = PLANS[tier]
  return {
    ...plan,
    monthly: MONTHLY[tier],
    annualPerMonth: ANNUAL_PER_MONTH[tier],
    billedYearly: billedYearly(tier),
    annualSavings: annualSavings(tier),
    savingsLabel: 'Save ' + formatSavingsUsd(annualSavings(tier)),
    checkoutKey: CHECKOUT_KEY[tier],
  }
}

export function allPlanViews() {
  return TIERS.map(planView)
}

export function jsonLdOffers() {
  return TIERS.map((tier) => {
    const p = planView(tier)
    return {
      '@type': 'Offer',
      name: p.name,
      price: formatPrice(p.annualPerMonth),
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description:
        p.name + ' plan: $' + formatPrice(p.annualPerMonth) + '/mo ' + longCycleLabel(tier).toLowerCase() + ' ($' + formatPrice(p.monthly) +
        '/mo monthly). ' + ENTITLEMENTS[tier].studio_credits_per_month + ' credits a month, about ' +
        minutesOfVideo(tier) + ' minutes of video.',
    }
  })
}
