// Single source of truth for Vidso plan prices, quotas, and comparison rows.
// Landing, /pricing, and in-app paywalls must read from here. Do not hardcode
// dollar amounts in page markup.

export const MONTHLY = { plus: 70, pro: 99, studio: 150 }
export const ANNUAL_PER_MONTH = { plus: 14.99, pro: 24.99, studio: 29.99 }

export const TIERS = ['plus', 'pro', 'studio']

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

export const PLANS = {
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'The essentials to start creating',
    cta: 'Get Plus →',
    longForm: '10 / month',
    shortForm: '15 / month',
    highlightQuota: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For creators serious about monetizing',
    cta: 'Get Pro →',
    longForm: '25 / month',
    shortForm: '30 / month',
    highlightQuota: false,
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    tagline: 'For those who want to build an automated empire',
    cta: 'Get Studio →',
    longForm: 'Unlimited',
    shortForm: 'Unlimited',
    highlightQuota: true,
  },
}

export const FEATURE_ROWS = [
  { type: 'check', label: 'Script → voiceover → B-roll → captions', plus: true, pro: true, studio: true },
  { type: 'value', label: 'Max video length', plus: '15 min', pro: '20 min', studio: '30 min' },
  { type: 'check', label: 'AI script writer with hook engine', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Premium AI voiceover library', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Auto B-roll & footage matching', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Auto captions & subtitle styling', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Image tools (thumbnails & scene art)', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Clipping & ranking tools', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Commercial usage rights', plus: true, pro: true, studio: true },
  { type: 'check', label: 'Video tools (transitions, effects, edits)', plus: false, pro: true, studio: true },
  { type: 'check', label: 'Viral moment clipping', plus: false, pro: true, studio: true },
  { type: 'check', label: 'Custom brand kit (fonts, colors, logo)', plus: false, pro: true, studio: true },
  { type: 'value', label: 'Render queue', plus: 'Standard', pro: 'Priority', studio: 'Fastest', included: { plus: false, pro: true, studio: true } },
  { type: 'check', label: 'Retention score on long-form', plus: false, pro: false, studio: true },
  { type: 'check', label: 'High-volume publishing workflow', plus: false, pro: false, studio: true },
  { type: 'check', label: 'Multi-channel management', plus: false, pro: false, studio: true },
  { type: 'value', label: 'Support', plus: 'Email', pro: 'Email', studio: 'Priority', included: { plus: false, pro: false, studio: true } },
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
