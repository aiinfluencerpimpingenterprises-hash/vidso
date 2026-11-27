import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DURATION_PRESETS,
  ENTITLEMENTS,
  GATED_FEATURES,
  channelLimit,
  durationPresets,
  entitlementsFor,
  formatMinutes,
  isUnlimited,
  quotaLimit,
  quotaWindow,
  secondsFromDurationId,
} from '../lib/entitlements.js'
import { FEATURE_ROWS, rowIncluded } from '../lib/pricing.js'
import {
  evaluateFeature,
  evaluateGeneration,
  evaluateLength,
  evaluateQuota,
  evaluateStudioCredits,
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
import { addSceneAllowance, incrementUsage, incrementStudioCredits, readUsage, rolloverCredits, takeSceneAllowance, _resetStoreForTests } from '../lib/usage-store.js'
import { resolveWhopPlan, WHOP_PLAN_ENV_DEFAULTS, expectedPrice } from '../lib/whop-map.js'

const plusUser = { plan_status: 'active', plan: 'plus' }
const proUser = { plan_status: 'active', plan: 'pro' }
const studioUser = { plan_status: 'active', plan: 'studio' }
const plusAnchor = '2026-01-15T00:00:00Z'

function user(tier, extra = {}) {
  return { plan_status: 'active', plan: tier, ...extra }
}

test('max video length marketing row matches the matrix and is included on every tier', () => {
  const row = FEATURE_ROWS.find((r) => r.label === 'Max video length')
  assert.equal(FEATURE_ROWS.length, 20)
  assert.equal(row.plus, '10 min')
  assert.equal(row.pro, '20 min')
  assert.equal(row.studio, '30 min')
  assert.equal(row.agency, '30 min')
  for (const tier of ['plus', 'pro', 'studio', 'agency']) assert.equal(rowIncluded(row, tier), true)
  assert.equal(formatMinutes(ENTITLEMENTS.plus.max_video_length_seconds), '10 min')
  assert.equal(formatMinutes(ENTITLEMENTS.pro.max_video_length_seconds), '20 min')
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

test('plans sell credits; video counts are never capped', () => {
  assert.equal(ENTITLEMENTS.plus.studio_credits_per_month, 300)
  assert.equal(ENTITLEMENTS.pro.studio_credits_per_month, 750)
  assert.equal(ENTITLEMENTS.studio.studio_credits_per_month, 2000)
  assert.equal(ENTITLEMENTS.agency.studio_credits_per_month, 5000)
  for (const tier of ['plus', 'pro', 'studio', 'agency']) {
    assert.equal(isUnlimited(quotaLimit(tier, 'long_form')), true)
    assert.equal(isUnlimited(ENTITLEMENTS[tier].studio_credits_per_month), false)
  }
  assert.deepEqual([1, 2, 3, 4], ['plus', 'pro', 'studio', 'agency'].map((t) => channelLimit(t)))
  assert.equal(channelLimit('plus', 2), 3)
})

test('no plan refuses a video for count: credits decide', () => {
  for (const u of [plusUser, proUser, studioUser]) {
    const q = evaluateQuota({ user: u, kind: 'long_form', used: 100000 })
    assert.equal(q.ok, true)
    assert.equal(q.increment, false)
  }
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

test('length cap: Pro 1200s allowed, 1201s rejected', () => {
  assert.equal(evaluateLength({ user: proUser, durationSeconds: 1200 }).ok, true)
  const over = evaluateLength({ user: proUser, durationSeconds: 1201 })
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
      youtube_sourced_broll: false,
      custom_brand_kit: false,
      retention_score: false,
      high_volume_workflow: false,
      multi_channel_management: false,
      image_4k: false,
    },
    pro: {
      video_tools: true,
      viral_moment_clipping: true,
      youtube_sourced_broll: true,
      custom_brand_kit: true,
      retention_score: false,
      high_volume_workflow: false,
      multi_channel_management: true,
      image_4k: false,
    },
    studio: {
      video_tools: true,
      viral_moment_clipping: true,
      youtube_sourced_broll: true,
      custom_brand_kit: true,
      retention_score: true,
      high_volume_workflow: true,
      multi_channel_management: true,
      image_4k: true,
    },
  }
  expected.agency = expected.studio
  for (const feature of GATED_FEATURES) {
    for (const tier of ['plus', 'pro', 'studio', 'agency']) {
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
  assert.equal(plusMo.expectedPrice, 49)

  const plusYr = resolveWhopPlan(WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PLUS_YEARLY)
  assert.equal(plusYr.tier, 'plus')
  assert.equal(plusYr.cycle, 'yearly')
  assert.equal(plusYr.expectedPrice, expectedPrice('plus', 'yearly'))

  const unknown = resolveWhopPlan('plan_legacy_old_sku')
  assert.equal(unknown.status, 'unmapped')
  assert.equal(unknown.legacy, true)
})

test('new checkout plans are live; the old plans still grant their tier', () => {
  const live = {
    WHOP_PLAN_PLUS_MONTHLY: 'plan_BQHP4JsKpws0Y',
    WHOP_PLAN_PLUS_YEARLY: 'plan_8E43QsYkb4rQQ',
    WHOP_PLAN_PRO_MONTHLY: 'plan_g9BXWHChnHyCz',
    WHOP_PLAN_PRO_YEARLY: 'plan_hJ8UkJfKUmxiR',
    WHOP_PLAN_STUDIO_MONTHLY: 'plan_2AAHUugBB97xT',
    WHOP_PLAN_STUDIO_YEARLY: 'plan_EfqB3YSTQ1v24',
  }
  for (const [key, id] of Object.entries(live)) assert.equal(WHOP_PLAN_ENV_DEFAULTS[key], id)
  const retired = [
    ['plan_2PQXzyYrseWZ6', 'plus', 'monthly'], ['plan_5FMFAYw0z7AbJ', 'plus', 'yearly'],
    ['plan_oYn5KJ7Wnv8NA', 'pro', 'monthly'], ['plan_PBiAm2SiwS0jR', 'pro', 'yearly'],
    ['plan_pXuKK8Tk1Aj05', 'studio', 'monthly'], ['plan_7HLlhKgRF0XfQ', 'studio', 'yearly'],
  ]
  for (const [id, tier, cycle] of retired) {
    const hit = resolveWhopPlan(id)
    assert.equal(hit.status, 'mapped')
    assert.equal(hit.tier, tier)
    assert.equal(hit.cycle, cycle)
  }
})

test('Agency: monthly plan, and the yearly toggle buys the quarterly plan', async () => {
  const { WHOP_CHECKOUT, planRowFor } = await import('../lib/whop-map.js')
  const { longCycleLabel } = await import('../lib/pricing.js')
  assert.equal(WHOP_CHECKOUT.agency_monthly, 'https://whop.com/checkout/plan_9RPGJHBpjbA8D')
  assert.equal(WHOP_CHECKOUT.agency_yearly, 'https://whop.com/checkout/plan_TgrAq6gea7W37')
  assert.equal(planRowFor('agency', 'annual').cycle, 'quarterly')
  assert.equal(planRowFor('pro', 'annual').cycle, 'yearly')
  const q = resolveWhopPlan('plan_TgrAq6gea7W37')
  assert.equal(q.tier, 'agency')
  assert.equal(q.cycle, 'quarterly')
  assert.equal(q.expectedPrice, 1437)
  assert.equal(resolveWhopPlan('plan_9RPGJHBpjbA8D').expectedPrice, 599)
  assert.equal(longCycleLabel('agency'), 'Billed every 3 months')
  assert.equal(longCycleLabel('studio'), 'Billed annually')
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

test('quota display shows credits and minutes of video', () => {
  const view = quotaView({ plan_status: 'active', plan: 'plus' })
  assert.equal(view.compact, '300 cr')
  assert.match(view.longText, /about 37 min of video/)
  const left = quotaView({ plan_status: 'active', plan: 'plus' }, { studio_credits_used: 100, credits_carry: 50 })
  assert.equal(left.compact, '250 cr')
  assert.match(left.longText, /50 rolled over/)
})

test('credits: last one allowed, then refused; rollover and up-front need count', () => {
  const last = evaluateStudioCredits({ user: plusUser, cost: 50, used: 250 })
  assert.equal(last.ok, true)
  assert.equal(last.remaining, 0)
  const over = evaluateStudioCredits({ user: plusUser, cost: 50, used: 251 })
  assert.equal(over.ok, false)
  assert.equal(over.code, 'credits_exhausted')
  assert.equal(over.requiredTier, 'pro')
  const carried = evaluateStudioCredits({ user: plusUser, cost: 50, used: 251, carry: 100 })
  assert.equal(carried.ok, true)
  const needs = evaluateStudioCredits({ user: plusUser, cost: 50, used: 0, need: 400 })
  assert.equal(needs.ok, false)
  assert.match(needs.message, /This video needs 400 credits/)
  const agencyOut = evaluateStudioCredits({ user: user('agency'), cost: 1, used: 5000 })
  assert.equal(agencyOut.ok, false)
  assert.equal(agencyOut.requiredTier, undefined)
})

test('faceless render is the only quota consumer; captions are plan-only', () => {
  assert.ok(ROUTE_POLICY.consumeQuota['POST /api/faceless/render'])
  assert.equal(ROUTE_POLICY.consumeQuota['POST /api/caption/burn'], undefined)
  assert.ok(ROUTE_POLICY.activePlanOnly.includes('POST /api/caption/burn'))
  assert.equal(ROUTE_POLICY.featureGate['POST /api/autoclip'], 'viral_moment_clipping')
})

test('evaluateGeneration refuses Plus only over length', () => {
  const ok = evaluateGeneration({ user: plusUser, durationSeconds: 600, kind: 'long_form', used: 300 })
  assert.equal(ok.ok, true)
  assert.equal(ok.kind, 'long_form')
  const overLen = evaluateGeneration({ user: plusUser, durationSeconds: 901, kind: 'long_form', used: 0 })
  assert.equal(overLen.ok, false)
  assert.equal(overLen.code, 'length_exceeded')
})

test('Whop charges match the plan prices', () => {
  assert.deepEqual(['plus', 'pro', 'studio', 'agency'].map((t) => expectedPrice(t, 'monthly')), [49, 99, 249, 599])
  assert.deepEqual(['plus', 'pro', 'studio', 'agency'].map((t) => expectedPrice(t, 'yearly')), [468, 948, 2388, 5748])
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

test('in-app duration chips match advertised 10 / 20 / 30 min caps', () => {
  assert.deepEqual(durationPresets('long', ENTITLEMENTS.plus.max_video_length_seconds).map((d) => d.seconds), [180, 300, 600])
  assert.deepEqual(durationPresets('long', ENTITLEMENTS.pro.max_video_length_seconds).map((d) => d.seconds), [180, 300, 600, 900, 1200])
  assert.deepEqual(durationPresets('long', ENTITLEMENTS.studio.max_video_length_seconds).map((d) => d.seconds), [180, 300, 600, 900, 1200, 1800])
  assert.deepEqual(durationPresets('long', null).map((d) => d.seconds), [180, 300, 600, 900, 1200, 1800])
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
  assert.equal(evaluateLength({ user: nested, durationSeconds: 1200 }).ok, true)
  assert.equal(evaluateLength({ user: nested, durationSeconds: 1201 }).ok, false)
})

test('usage store increments and resets on the anniversary window', async () => {
  _resetStoreForTests()
  const user = { id: 'u1', created_at: '2026-01-15T00:00:00Z' }
  incrementUsage(user, 'long_form', new Date('2026-01-20T00:00:00Z'))
  incrementUsage(user, 'long_form', new Date('2026-01-20T00:00:00Z'))
  assert.equal(readUsage(user, new Date('2026-01-20T00:00:00Z')).long_form_used, 2)
  await incrementStudioCredits(user, 56, new Date('2026-01-20T00:00:00Z'))
  assert.equal(readUsage(user, new Date('2026-01-20T00:00:00Z')).studio_credits_used, 56)
  const nextMonth = readUsage(user, new Date('2026-02-15T00:00:00Z'))
  assert.equal(nextMonth.long_form_used, 0)
  assert.equal(nextMonth.studio_credits_used, 0)
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
  assert.equal(access.entitlements.studio_credits_per_month, 2000)
  const q = quotaView(gifted)
  assert.equal(q.compact, '2000 cr')
  const stranger = resolveAccess({ email: 'someone@example.com', plan_status: 'inactive' }, off)
  assert.equal(stranger.active, false)
  const nested = resolveAccess({
    user: { email: 'stormdecoded@gmail.com' },
    plan: 'free',
    plan_status: 'inactive',
  }, off)
  assert.equal(nested.active, true)
  assert.equal(nested.tier, 'studio')
  const xenon = resolveAccess({
    email: 'xenonforyou@gmail.com',
    plan: 'free',
    plan_status: 'inactive',
  }, off)
  assert.equal(xenon.active, true)
  assert.equal(xenon.tier, 'studio')
  assert.equal(xenon.entitlements.studio_credits_per_month, 2000)
  const rishav = resolveAccess({
    email: 'rishavvashisht347@gmail.com',
    plan: 'free',
    plan_status: 'inactive',
  }, off)
  assert.equal(rishav.active, true)
  assert.equal(rishav.tier, 'studio')
  const paidClipzo = resolveAccess({
    email: 'payer@example.com',
    plan: 'studio',
    plan_status: 'active',
  }, off)
  assert.equal(paidClipzo.active, true)
  assert.equal(paidClipzo.tier, 'studio')
})

test('paid Pro email is granted when Whop has not provisioned yet', () => {
  const off = { PAYWALL_BYPASS: '0' }
  for (const email of ['ntuamassoma@gmail.com', 'faisalym3@gmail.com', 'margik2803@gmail.com', 'subramaniamvishwak@gmail.com', 'subramaniam.vishwak@gmail.com']) {
    const paid = {
      email,
      plan: 'free',
      plan_status: 'inactive',
    }
    const access = resolveAccess(paid, off)
    assert.equal(access.active, true)
    assert.equal(access.tier, 'pro')
    assert.equal(access.entitlements.studio_credits_per_month, 750)
    const q = quotaView(paid)
    assert.equal(q.unlimited, false)
    assert.equal(q.tier, 'pro')
  }
})




test('unused credits roll over one month, capped at a month\'s worth', async () => {
  assert.equal(rolloverCredits({ limit: 300, used: 100 }), 200)
  assert.equal(rolloverCredits({ limit: 300, carry: 200, used: 50 }), 300)
  assert.equal(rolloverCredits({ limit: 300, carry: 100, used: 500 }), 0)
  assert.equal(rolloverCredits({ limit: 300, used: 300, windowsPassed: 3 }), 300)
  _resetStoreForTests()
  const u = { id: 'roll1', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
  await incrementStudioCredits(u, 120, new Date('2026-01-20T00:00:00Z'))
  const feb = readUsage(u, new Date('2026-02-16T00:00:00Z'))
  assert.equal(feb.studio_credits_used, 0)
  assert.equal(feb.credits_carry, 180)
})

test('a paid video hands out free scenes, one at a time', async () => {
  _resetStoreForTests()
  const u = { id: 'scene1', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
  const now = new Date('2026-01-20T00:00:00Z')
  await addSceneAllowance(u, 2, now)
  assert.equal(await takeSceneAllowance(u, now), true)
  assert.equal(await takeSceneAllowance(u, now), true)
  assert.equal(await takeSceneAllowance(u, now), false)
})
