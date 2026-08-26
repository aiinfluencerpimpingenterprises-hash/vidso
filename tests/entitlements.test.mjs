import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DURATION_PRESETS,
  ENTITLEMENTS,
  GATED_FEATURES,
  UNLIMITED,
  durationPresets,
  entitlementsFor,
  formatMinutes,
  isUnlimited,
  quotaWindow,
  secondsFromDurationId,
} from '../lib/entitlements.js'
import { FEATURE_ROWS, rowIncluded } from '../lib/pricing.js'
import {
  evaluateFeature,
  evaluateGeneration,
  evaluateLength,
  evaluateQuota,
  resolveAccess,
} from '../lib/enforce.js'
import {
  durationFromBody,
  generationKindFromSeconds,
  parseUsageCounts,
  quotaView,
  ROUTE_POLICY,
  SHORT_FORM_MAX_SECONDS,
} from '../lib/quota.js'
import { incrementUsage, readUsage, _resetStoreForTests } from '../lib/usage-store.js'
import { resolveWhopPlan, WHOP_PLAN_ENV_DEFAULTS, expectedPrice } from '../lib/whop-map.js'

const plusUser = { plan_status: 'active', plan: 'plus' }
const proUser = { plan_status: 'active', plan: 'pro' }
const studioUser = { plan_status: 'active', plan: 'studio' }

function user(tier, extra = {}) {
  return { plan_status: 'active', plan: tier, ...extra }
}

test('max video length marketing row matches the matrix and is included on every tier', () => {
  const row = FEATURE_ROWS.find((r) => r.label === 'Max video length')
  assert.equal(FEATURE_ROWS.length, 17)
  assert.equal(row.plus, '10 min')
  assert.equal(row.pro, '15 min')
  assert.equal(row.studio, '30 min')
  assert.equal(rowIncluded(row, 'plus'), true)
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
      image_4k: false,
    },
    pro: {
      video_tools: true,
      viral_moment_clipping: true,
      custom_brand_kit: true,
      retention_score: false,
      high_volume_workflow: false,
      multi_channel_management: false,
      image_4k: false,
    },
    studio: {
      video_tools: true,
      viral_moment_clipping: true,
      custom_brand_kit: true,
      retention_score: true,
      high_volume_workflow: true,
      multi_channel_management: true,
      image_4k: true,
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

test('60s is short-form, 61s is long-form', () => {
  assert.equal(SHORT_FORM_MAX_SECONDS, 60)
  assert.equal(generationKindFromSeconds(60), 'short_form')
  assert.equal(generationKindFromSeconds(61), 'long_form')
  assert.equal(generationKindFromSeconds(1800), 'long_form')
})

test('usage parser never treats credits as video counts', () => {
  const parsed = parseUsageCounts({ credits: 300, videos_remaining: 30 })
  assert.equal(parsed.known, false)
  assert.equal(parsed.long_form_used, 0)
  const withCounters = parseUsageCounts({ credits: 300, long_form_used: 3, short_form_used: 4 })
  assert.equal(withCounters.known, true)
  assert.equal(withCounters.long_form_used, 3)
  assert.equal(withCounters.short_form_used, 4)
})

test('quota display matches advertised counts, not credits', () => {
  const view = quotaView({ plan_status: 'active', plan: 'plus', credits: 300 })
  assert.equal(view.compact, '10 LF · 15 SF')
  assert.doesNotMatch(view.compact, /300/)
  assert.doesNotMatch(view.longText, /credit/i)
  const remaining = quotaView(
    { plan_status: 'active', plan: 'plus' },
    { long_form_used: 3, short_form_used: 5 },
  )
  assert.equal(remaining.compact, '7 LF · 10 SF')
})

test('faceless render is the only quota consumer; captions are plan-only', () => {
  assert.ok(ROUTE_POLICY.consumeQuota['POST /api/faceless/render'])
  assert.equal(ROUTE_POLICY.consumeQuota['POST /api/caption/burn'], undefined)
  assert.ok(ROUTE_POLICY.activePlanOnly.includes('POST /api/caption/burn'))
  assert.equal(ROUTE_POLICY.featureGate['POST /api/autoclip'], 'viral_moment_clipping')
})

test('evaluateGeneration refuses Plus over length or over quota', () => {
  const ok = evaluateGeneration({ user: plusUser, durationSeconds: 600, kind: 'long_form', used: 9 })
  assert.equal(ok.ok, true)
  assert.equal(ok.kind, 'long_form')
  const overQuota = evaluateGeneration({ user: plusUser, durationSeconds: 600, kind: 'long_form', used: 10 })
  assert.equal(overQuota.ok, false)
  assert.equal(overQuota.code, 'quota_exceeded')
  const overLen = evaluateGeneration({ user: plusUser, durationSeconds: 901, kind: 'long_form', used: 0 })
  assert.equal(overLen.ok, false)
  assert.equal(overLen.code, 'length_exceeded')
})

test('Whop yearly charges match the live whole-dollar prices', () => {
  assert.equal(expectedPrice('plus', 'yearly'), 179)
  assert.equal(expectedPrice('pro', 'yearly'), 299)
  assert.equal(expectedPrice('studio', 'yearly'), 359)
})

test('duration_id long_600 is 600 seconds', () => {
  assert.equal(durationFromBody({ duration_id: 'long_600' }), 600)
  assert.equal(durationFromBody({ duration: 45 }), 45)
  assert.equal(durationFromBody({ duration: 612, duration_id: 'long_600' }), 600)
  assert.equal(durationFromBody({ script: { duration_id: 'long_900' } }), 900)
  assert.equal(secondsFromDurationId('long_1200'), 1200)
  assert.equal(secondsFromDurationId('long_420'), 420)
  assert.equal(secondsFromDurationId('shorts_45'), 45)
})

test('in-app duration chips match advertised 10 / 15 / 30 min caps', () => {
  assert.equal(DURATION_PRESETS.long.some((d) => d.seconds === 1200), false)
  assert.deepEqual(durationPresets('long', ENTITLEMENTS.plus.max_video_length_seconds).map((d) => d.seconds), [180, 300, 600])
  assert.deepEqual(durationPresets('long', ENTITLEMENTS.pro.max_video_length_seconds).map((d) => d.seconds), [180, 300, 600, 900])
  assert.deepEqual(durationPresets('long', ENTITLEMENTS.studio.max_video_length_seconds).map((d) => d.seconds), [180, 300, 600, 900, 1800])
})

test('Whop plan ID alone resolves the same length cap as plan name', () => {
  const plusById = {
    plan_status: 'active',
    whop_plan_id: WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PLUS_MONTHLY,
  }
  assert.equal(resolveAccess(plusById).tier, 'plus')
  assert.equal(evaluateLength({ user: plusById, durationSeconds: 600 }).ok, true)
  assert.equal(evaluateLength({ user: plusById, durationSeconds: 601 }).ok, false)
  const nested = {
    plan_status: 'active',
    membership: { plan_id: WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PRO_YEARLY },
  }
  assert.equal(resolveAccess(nested).tier, 'pro')
  assert.equal(evaluateLength({ user: nested, durationSeconds: 900 }).ok, true)
  assert.equal(evaluateLength({ user: nested, durationSeconds: 901 }).ok, false)
})

test('usage store increments and resets on the anniversary window', () => {
  _resetStoreForTests()
  const user = { id: 'u1', created_at: '2026-01-15T00:00:00Z' }
  incrementUsage(user, 'long_form', new Date('2026-01-20T00:00:00Z'))
  incrementUsage(user, 'long_form', new Date('2026-01-20T00:00:00Z'))
  assert.equal(readUsage(user, new Date('2026-01-20T00:00:00Z')).long_form_used, 2)
  assert.equal(readUsage(user, new Date('2026-02-15T00:00:00Z')).long_form_used, 0)
})

test('comped Studio email keeps top-tier access when paywall is on', () => {
  const off = { PAYWALL_BYPASS: '0' }
  const gifted = {
    email: 'stormdecoded@gmail.com',
    plan: 'free',
    plan_status: 'inactive',
  }
  const access = resolveAccess(gifted, off)
  assert.equal(access.active, true)
  assert.equal(access.tier, 'studio')
  assert.equal(access.entitlements.long_form_per_month, UNLIMITED)
  const q = quotaView(gifted)
  assert.equal(q.unlimited, true)
  const stranger = resolveAccess({ email: 'someone@example.com', plan_status: 'inactive' }, off)
  assert.equal(stranger.active, false)
  const nested = resolveAccess({
    user: { email: 'stormdecoded@gmail.com' },
    plan: 'free',
    plan_status: 'inactive',
  }, off)
  assert.equal(nested.active, true)
  assert.equal(nested.tier, 'studio')
  const paidClipzo = resolveAccess({
    email: 'payer@example.com',
    plan: 'studio',
    plan_status: 'active',
  }, off)
  assert.equal(paidClipzo.active, true)
  assert.equal(paidClipzo.tier, 'studio')
})



