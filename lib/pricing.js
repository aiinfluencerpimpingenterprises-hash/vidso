// Prices and comparison-row copy. Tier LIMITS live in lib/entitlements.js —
// this file must derive quotas and feature flags from that object so marketing
// cards and server enforcement cannot drift.

import {
  ENTITLEMENTS,
  QUEUE,
  SUPPORT,
  TIERS,
  formatMinutes,
  formatQuotaLabel,
} from './entitlements.js'

export { TIERS, ENTITLEMENTS }

export const MONTHLY = { plus: 70, pro: 99, studio: 150 }
export const ANNUAL_PER_MONTH = { plus: 14.99, pro: 24.99, studio: 29.99 }

export const CHECKOUT_KEY = {
  plus: 'starter',
  pro: 'creator',
  studio: 'business',
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
  return isAnnualCycle(cycle) ? 'studio' : 'pro'
}

function flag(feature) {
  return {
    plus: !!ENTITLEMENTS.plus[feature],
    pro: !!ENTITLEMENTS.pro[feature],
    studio: !!ENTITLEMENTS.studio[feature],
  }
}

function queueLabel(value) {
  if (value === QUEUE.fastest) return 'Fastest'
  if (value === QUEUE.priority) return 'Priority'
  return 'Standard'
}

function supportLabel(value) {
  return value === SUPPORT.priority ? 'Priority' : 'Email'
}

export const PLANS = {
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'The essentials to start creating',
    cta: 'Get Plus →',
    longForm: formatQuotaLabel(ENTITLEMENTS.plus.long_form_per_month),
    shortForm: formatQuotaLabel(ENTITLEMENTS.plus.short_form_per_month),
    highlightQuota: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For creators serious about monetizing',
    cta: 'Get Pro →',
    longForm: formatQuotaLabel(ENTITLEMENTS.pro.long_form_per_month),
    shortForm: formatQuotaLabel(ENTITLEMENTS.pro.short_form_per_month),
    highlightQuota: false,
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: 'For those who want to build an automated empire',
    cta: 'Get Studio →',
    longForm: formatQuotaLabel(ENTITLEMENTS.studio.long_form_per_month),
    shortForm: formatQuotaLabel(ENTITLEMENTS.studio.short_form_per_month),
    highlightQuota: true,
  },
}

export const FEATURE_ROWS = [
  { type: 'check', label: 'Script → voiceover → B-roll → captions', plus: true, pro: true, studio: true },
  {
    type: 'value',
    label: 'Max video length',
    plus: formatMinutes(ENTITLEMENTS.plus.max_video_length_seconds),
    pro: formatMinutes(ENTITLEMENTS.pro.max_video_length_seconds),
    studio: formatMinutes(ENTITLEMENTS.studio.max_video_length_seconds),
  },
  { type: 'check', label: 'AI script writer with hook engine', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Premium AI voiceover library', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Auto B-roll & footage matching', plus: true, pro: true, studio: true },
  { type: 'check', label: 'YouTube-sourced B-roll', ...flag('youtube_sourced_broll') },
  { type: 'check', label: 'Auto captions & subtitle styling', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Image tools (thumbnails & scene art)', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Clipping & ranking tools', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Commercial usage rights', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Video tools (transitions, effects, edits)', ...flag('video_tools') },
  { type: 'check', label: 'Viral moment clipping', ...flag('viral_moment_clipping') },
  { type: 'check', label: 'Custom brand kit (fonts, colors, logo)', ...flag('custom_brand_kit') },
  {
    type: 'value',
    label: 'Render queue',
    plus: queueLabel(ENTITLEMENTS.plus.render_queue_priority),
    pro: queueLabel(ENTITLEMENTS.pro.render_queue_priority),
    studio: queueLabel(ENTITLEMENTS.studio.render_queue_priority),
    included: { plus: false, pro: true, studio: true },
  },
  { type: 'check', label: 'Retention score on long-form', ...flag('retention_score') },
  { type: 'check', label: 'High-volume publishing workflow', ...flag('high_volume_workflow') },
  { type: 'check', label: 'Multi-channel management', ...flag('multi_channel_management') },
  {
    type: 'value',
    label: 'Support',
    plus: supportLabel(ENTITLEMENTS.plus.support_tier),
    pro: supportLabel(ENTITLEMENTS.pro.support_tier),
    studio: supportLabel(ENTITLEMENTS.studio.support_tier),
    included: { plus: false, pro: false, studio: true },
  },
]

export function rowIncluded(row, tier) {
  if (row.type === 'check') return !!row[tier]
  if (row.included) return !!row.included[tier]
  return true
}

export const TRUST_LINE = 'Cancel anytime. No hidden fees.'

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
        p.name +
        ' plan: $' +
        formatPrice(p.annualPerMonth) +
        '/mo billed annually ($' +
        formatPrice(p.monthly) +
        '/mo monthly). ' +
        p.longForm.replace(' / month', '') +
        ' long-form videos, ' +
        p.shortForm.replace(' / month', '') +
        ' short-form videos.',
    }
  })
}
