import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyDecline,
  fetchRecentPayments,
  paymentsVerdict,
  summarizePayments,
} from '../lib/whop-payments.js'

function failed(code, extra = {}) {
  return { id: 'pay_' + Math.random(), status: 'failed', decline_code: code, ...extra }
}

function paid() {
  return { id: 'pay_ok' + Math.random(), status: 'paid', paid_at: '2026-08-30T00:00:00Z' }
}

test('decline codes are sorted into who can actually fix them', () => {
  // Ours: live checkout wired to test credentials fails every real card.
  assert.deepEqual(classifyDecline('test_mode_decline'), { bucket: 'config', ours: true })
  assert.deepEqual(classifyDecline('currency_not_supported'), { bucket: 'config', ours: true })
  assert.deepEqual(classifyDecline('high_risk'), { bucket: 'config', ours: true })
  // Ours: a 3D Secure challenge the buyer never finished.
  assert.equal(classifyDecline('three_d_secure_timeout').bucket, 'three_ds')
  assert.equal(classifyDecline('three_d_secure_rejected_by_bank').ours, true)
  assert.equal(classifyDecline('authentication_required').bucket, 'three_ds')
  // Not ours: the buyer's bank said no.
  assert.deepEqual(classifyDecline('insufficient_funds'), { bucket: 'issuer', ours: false })
  assert.equal(classifyDecline('expired_card').ours, false)
  assert.equal(classifyDecline('sepa_invalid_iban').bucket, 'bank_rails')
  assert.equal(classifyDecline('bank_account_closed').bucket, 'bank_rails')
  assert.equal(classifyDecline('processing_error').bucket, 'processor')
  assert.deepEqual(classifyDecline(''), { bucket: 'unknown', ours: false })
})

test('test-mode declines are called out above everything else', () => {
  const out = summarizePayments([failed('test_mode_decline'), failed('insufficient_funds'), paid()])
  assert.match(out.verdict, /test credentials/)
})

test('a wall of issuer declines is reported as a pricing problem, not a bug', () => {
  const rows = [
    ...Array.from({ length: 9 }, () => failed('insufficient_funds')),
    paid(),
  ]
  const out = summarizePayments(rows)
  assert.equal(out.failed, 9)
  assert.equal(out.paid, 1)
  assert.equal(out.failureRate, 90)
  assert.equal(out.byBucket.issuer, 9)
  assert.equal(out.ourFailures, 0)
  assert.match(out.verdict, /adaptive pricing/)
})

test('3D Secure friction is separated from real card declines', () => {
  const out = summarizePayments([
    failed('three_d_secure_timeout'),
    failed('three_d_secure_failed'),
    failed('insufficient_funds'),
    paid(),
  ])
  assert.equal(out.byBucket.three_ds, 2)
  assert.equal(out.ourFailures, 2)
  assert.match(out.verdict, /frictionless/)
})

test('declines are ranked so the dominant cause leads the report', () => {
  const out = summarizePayments([
    failed('generic_decline'),
    failed('generic_decline'),
    failed('generic_decline'),
    failed('expired_card'),
  ])
  assert.equal(out.declines[0].code, 'generic_decline')
  assert.equal(out.declines[0].count, 3)
  assert.equal(out.declines[0].ours, false)
})

test('an empty window blames traffic rather than cards', () => {
  assert.match(paymentsVerdict({ attempted: 0, failed: 0, byBucket: {}, byCode: {} }), /Nobody reached checkout/)
  assert.match(summarizePayments([paid(), paid()]).verdict, /Every payment/)
})

test('a payment carrying a decline code counts as failed whatever its status says', () => {
  // Whop marks recoverable failures past_due, not failed.
  const out = summarizePayments([
    { status: 'past_due', decline_code: 'insufficient_funds' },
    { status: 'open', decline_code: 'expired_card' },
  ])
  assert.equal(out.failed, 2)
})

test('a missing payments permission is reported, not read as "no payments"', async () => {
  const got = await fetchRecentPayments(
    async () => ({ ok: false, status: 403, reason: 'missing_permission', message: 'nope' }),
    'biz_1',
    () => 'q=1',
  )
  assert.deepEqual(got.rows, [])
  assert.equal(got.error.reason, 'missing_permission')
})

test('payments paging stops at the end of the list', async () => {
  const pages = [
    { ok: true, data: { data: [paid(), failed('expired_card')], page_info: { has_next_page: true, end_cursor: 'c1' } } },
    { ok: true, data: { data: [paid()], page_info: { has_next_page: false } } },
  ]
  const seen = []
  const got = await fetchRecentPayments(
    async (path) => { seen.push(path); return pages[seen.length - 1] },
    'biz_1',
    (q) => 'after=' + (q.after || ''),
    5,
  )
  assert.equal(got.rows.length, 3)
  assert.equal(seen.length, 2)
  assert.equal(got.error, null)
  assert.match(seen[1], /after=c1/)
})

// --- Checkout 3D Secure level: the remedy for risk-engine declines.

import {
  _resetOrchestrationCacheForTests,
  enableVidsoOrchestration,
  orchestrationPatch,
  planHasOrchestration,
  threeDsLevel,
} from '../lib/whop-checkout.js'

test('checkout forces the 3DS challenge unless asked otherwise', () => {
  // An authenticated charge is what gets past a high_risk / suspected_fraud block.
  assert.equal(threeDsLevel({}), 'mandate_challenge')
  assert.equal(threeDsLevel({ WHOP_THREE_DS_LEVEL: 'mandate_challenge' }), 'mandate_challenge')
  assert.equal(threeDsLevel({ WHOP_THREE_DS_LEVEL: 'frictionless' }), 'frictionless')
  assert.equal(threeDsLevel({ WHOP_THREE_DS_LEVEL: 'MANDATE_CHALLENGE' }), 'mandate_challenge')
})

test('an unusable 3DS setting is dropped rather than sent to Whop', () => {
  // Whop would 400 the whole checkout configuration, taking payments down.
  assert.equal(threeDsLevel({ WHOP_THREE_DS_LEVEL: 'off' }), null)
  assert.equal(threeDsLevel({ WHOP_THREE_DS_LEVEL: 'always' }), null)
  assert.equal(threeDsLevel({ WHOP_THREE_DS_LEVEL: 'true' }), null)
})

test('orchestration turns on adaptive pricing and 3DS without rewriting the price', () => {
  const patch = orchestrationPatch()
  assert.equal(patch.adaptive_pricing_enabled, true)
  assert.equal(patch.three_ds_level, 'mandate_challenge')
  assert.equal(patch.payment_method_configuration.include_platform_defaults, true)
  assert.equal(patch.initial_price, undefined)
  assert.equal(patch.renewal_price, undefined)
  assert.equal(patch.billing_period, undefined)
})

test('a plan is only done once adaptive pricing, 3DS, and platform methods are all on', () => {
  const ready = {
    adaptive_pricing_enabled: true,
    three_ds_level: 'mandate_challenge',
    payment_method_configuration: null,
  }
  assert.equal(planHasOrchestration(ready), true)
  assert.equal(planHasOrchestration({ ...ready, payment_method_configuration: { include_platform_defaults: true } }), true)
  assert.equal(planHasOrchestration({ adaptive_pricing_enabled: true, payment_method_configuration: null }), false)
  assert.equal(planHasOrchestration({ ...ready, adaptive_pricing_enabled: false }), false)
  assert.equal(planHasOrchestration({
    ...ready,
    payment_method_configuration: { include_platform_defaults: false, enabled: ['card'] },
  }), false)
})

test('enabling orchestration patches every mapped Vidso plan once', async () => {
  _resetOrchestrationCacheForTests()
  const real = globalThis.fetch
  const patched = []
  process.env.WHOP_API_KEY = 'test-key'
  globalThis.fetch = async (url, init) => {
    const path = String(url).replace('https://api.whop.com/api/v1', '')
    if (init?.method === 'PATCH') {
      patched.push(path)
      return { ok: true, status: 200, json: async () => ({ adaptive_pricing_enabled: true }) }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        adaptive_pricing_enabled: false,
        three_ds_level: null,
        payment_method_configuration: { include_platform_defaults: false },
      }),
    }
  }
  try {
    const rows = await enableVidsoOrchestration({ WHOP_API_KEY: 'test-key' })
    assert.equal(rows.length, 6)
    assert.equal(rows.every((row) => row.ok), true)
    assert.equal(patched.length, 6)
    assert.ok(patched.every((path) => path.startsWith('/plans/plan_')))
    // A second pass must not rewrite plans that the cache already marked done.
    await enableVidsoOrchestration({ WHOP_API_KEY: 'test-key' })
    assert.equal(patched.length, 6)
  } finally {
    globalThis.fetch = real
    delete process.env.WHOP_API_KEY
    _resetOrchestrationCacheForTests()
  }
})
