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
