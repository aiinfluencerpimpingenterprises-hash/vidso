import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ENTITLEMENTS,
  GATED_FEATURES,
  UNLIMITED,
  entitlementsFor,
  formatMinutes,
  isUnlimited,
  quotaWindow,
} from '../lib/entitlements.js'
import { FEATURE_ROWS, rowIncluded } from '../lib/pricing.js'
import {
  evaluateFeature,
  evaluateLength,
  evaluateQuota,
  resolveAccess,
} from '../lib/enforce.js'
import { resolveWhopPlan, WHOP_PLAN_ENV_DEFAULTS, expectedPrice } from '../lib/whop-map.js'

const plusUser = { plan_status: 'active', plan: 'plus' }
const proUser = { plan_status: 'active', plan: 'pro' }
const studioUser = { plan_status: 'active', plan: 'studio' }

function user(tier, extra = {}) {
  return { plan_status: 'active', plan: tier, ...extra }
}

test('max video length marketing row matches the matrix and Plus is baseline', () => {
  const row = FEATURE_ROWS.find((r) => r.label === 'Max video length')
  assert.equal(FEATURE_ROWS.length, 17)
  assert.equal(row.plus, '10 min')
  assert.equal(row.pro, '15 min')
  assert.equal(row.studio, '30 min')
  assert.equal(rowIncluded(row, 'plus'), false)
  assert.equal(rowIncluded(row, 'pro'), true)
  assert.equal(rowIncluded(row, 'studio'), true)
  assert.equal(formatMinutes(ENTITLEMENTS.plus.max_video_length_seconds), '10 min')
  assert.equal(formatMinutes(ENTITLEMENTS.pro.max_video_length_seconds), '15 min')
  assert.equal(formatMinutes(ENTITLEMENTS.studio.max_video_length_seconds), '30 min')
})

test('annual and monthly of the same tier resolve to identical entitlements', () => {
  for (const tier of ['plus', 'pro', 'studio']) {
    assert.deepEqual(entitlementsFor(tier, 'monthly'), entitlementsFor(tier, 'yearly'))
    assert.deepEqual(entitlementsFor(tier, 'monthly'), entitlementsFor(tier, 'annual'))
    const monthly = evaluateQuota({ user: { plan_status: 'active', plan: tier, billing_cycle: 'monthly' }, kind: 'long_form', used: 0 })
    const yearly = evaluateQuota({ user: { plan_status: 'active', plan: tier, billing_cycle: 'yearly' }, kind: 'long_form', used: 0 })
    assert.equal(monthly.ok, yearly.ok)
    assert.equal(monthly.limit, yearly.limit)
    assert.equal(monthly.increment, yearly.increment)
  }
})

test('unlimited is null, never a large integer', () => {
  assert.equal(ENTITLEMENTS.studio.long_form_per_month, UNLIMITED)
  assert.equal(ENTITLEMENTS.studio.short_form_per_month, UNLIMITED)
  assert.equal(isUnlimited(ENTITLEMENTS.studio.long_form_per_month), true)
  assert.equal(isUnlimited(ENTITLEMENTS.plus.long_form_per_month), false)
})

test('quota boundary: last allowed Plus long-form, then the next is refused', () => {
  const last = evaluateQuota({ user: plusUser, kind: 'long_form', used: 9 })
  assert.equal(last.ok, true)
  assert.equal(last.increment, true)
  assert.equal(last.remaining, 1)

  const next = evaluateQuota({ user: plusUser, kind: 'long_form', used: 10 })
  assert.equal(next.ok, false)
  assert.equal(next.status, 402)
  assert.equal(next.code, 'quota_exceeded')
  assert.match(next.message, /10 long-form/)
  assert.match(next.message, /Pro/)
})

test('quota boundary: last allowed Plus short-form, then the next is refused', () => {
  const last = evaluateQuota({ user: plusUser, kind: 'short_form', used: 14 })
  assert.equal(last.ok, true)
  const next = evaluateQuota({ user: plusUser, kind: 'short_form', used: 15 })
  assert.equal(next.ok, false)
  assert.match(next.message, /15 short-form/)
})

test('quota boundary: last allowed Pro long-form, then the next is refused', () => {
  const last = evaluateQuota({ user: proUser, kind: 'long_form', used: 24 })
  assert.equal(last.ok, true)
  const next = evaluateQuota({ user: proUser, kind: 'long_form', used: 25 })
  assert.equal(next.ok, false)
  assert.match(next.message, /25 long-form/)
  assert.match(next.message, /Studio/)
})

test('length cap: Plus 600s allowed, 601s rejected before compute', () => {
  const ok = evaluateLength({ user: plusUser, durationSeconds: 600 })
  assert.equal(ok.ok, true)
  const over = evaluateLength({ user: plusUser, durationSeconds: 601 })
  assert.equal(over.ok, false)
  assert.equal(over.status, 403)
  assert.equal(over.code, 'length_exceeded')
  assert.match(over.message, /10 min/)
  assert.equal(over.requiredTier, 'pro')
})

test('length cap: Pro 900s allowed, 901s rejected', () => {
  assert.equal(evaluateLength({ user: proUser, durationSeconds: 900 }).ok, true)
  const over = evaluateLength({ user: proUser, durationSeconds: 901 })
  assert.equal(over.ok, false)
  assert.equal(over.requiredTier, 'studio')
})

test('length cap: Studio 1800s allowed, 1801s rejected', () => {
  assert.equal(evaluateLength({ user: studioUser, durationSeconds: 1800 }).ok, true)
  assert.equal(evaluateLength({ user: studioUser, durationSeconds: 1801 }).ok, false)
})

test('gated features per tier', () => {
  const expected = {
    plus: {
      video_tools: false,
      viral_moment_clipping: false,
      custom_brand_kit: false,
      retention_score: false,
      high_volume_workflow: false,
      multi_channel_management: false,
    },
    pro: {
      video_tools: true,
      viral_moment_clipping: true,
      custom_brand_kit: true,
      retention_score: false,
      high_volume_workflow: false,
      multi_channel_management: false,
    },
    studio: {
      video_tools: true,
      viral_moment_clipping: true,
      custom_brand_kit: true,
      retention_score: true,
      high_volume_workflow: true,
      multi_channel_management: true,
    },
  }
  for (const feature of GATED_FEATURES) {
    for (const tier of ['plus', 'pro', 'studio']) {
      const result = evaluateFeature({ user: user(tier), feature })
      if (expected[tier][feature]) {
        assert.equal(result.ok, true, `${tier} should have ${feature}`)
      } else {
        assert.equal(result.ok, false, `${tier} should not have ${feature}`)
        assert.equal(result.status, 403)
        assert.equal(result.code, 'feature_locked')
        assert.ok(result.requiredTier)
      }
    }
  }
})

test('ungated tools are not 403-gated', () => {
  const r = evaluateFeature({ user: plusUser, feature: 'image_tools' })
  assert.equal(r.ok, true)
  assert.equal(r.gated, false)
})

test('unlimited Studio is not capped and does not increment a counter', () => {
  const q = evaluateQuota({ user: studioUser, kind: 'long_form', used: 100000 })
  assert.equal(q.ok, true)
  assert.equal(q.increment, false)
  assert.equal(q.logUsage, true)
  assert.equal(q.limit, null)
})

test('quota window resets on the anniversary day, not calendar month 1', () => {
  const anchor = new Date('2026-01-15T12:00:00Z')
  const before = quotaWindow(anchor, new Date('2026-02-14T23:59:59Z'))
  const onDay = quotaWindow(anchor, new Date('2026-02-15T00:00:00Z'))
  assert.equal(before.start.toISOString().slice(0, 10), '2026-01-15')
  assert.equal(before.end.toISOString().slice(0, 10), '2026-02-15')
  assert.equal(onDay.start.toISOString().slice(0, 10), '2026-02-15')
  assert.equal(onDay.end.toISOString().slice(0, 10), '2026-03-15')
})

test('mapped Whop IDs resolve to tier + cycle; unknown IDs are legacy', () => {
  const plusMo = resolveWhopPlan(WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PLUS_MONTHLY)
  assert.equal(plusMo.status, 'mapped')
  assert.equal(plusMo.tier, 'plus')
  assert.equal(plusMo.cycle, 'monthly')
  assert.equal(plusMo.expectedPrice, 70)

  const plusYr = resolveWhopPlan(WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PLUS_YEARLY)
  assert.equal(plusYr.tier, 'plus')
  assert.equal(plusYr.cycle, 'yearly')
  assert.equal(plusYr.expectedPrice, expectedPrice('plus', 'yearly'))

  const unknown = resolveWhopPlan('plan_legacy_old_sku')
  assert.equal(unknown.status, 'unmapped')
  assert.equal(unknown.legacy, true)
})

test('legacy unmapped subscribers keep access and are not auto-migrated', () => {
  const legacyUser = {
    plan_status: 'active',
    whop_plan_id: 'plan_legacy_old_sku',
  }
  const access = resolveAccess(legacyUser)
  assert.equal(access.legacy, true)
  const q = evaluateQuota({ user: legacyUser, kind: 'long_form', used: 999 })
  assert.equal(q.ok, true)
  assert.equal(q.legacy, true)
  assert.equal(q.increment, false)
})

test('env override remaps a plan id without changing business logic', () => {
  const env = { WHOP_PLAN_PLUS_MONTHLY: 'plan_new_plus_mo' }
  const hit = resolveWhopPlan('plan_new_plus_mo', env)
  assert.equal(hit.tier, 'plus')
  const old = resolveWhopPlan(WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PLUS_MONTHLY, env)
  assert.equal(old.legacy, true)
})
