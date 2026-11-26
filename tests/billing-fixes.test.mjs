import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKENDS, installFakeUpstash } from './helpers/fake-upstash.mjs'

process.env.VIDSO_USAGE_FILE = '/nonexistent-dir/vidso-usage-fixes.json'
process.env.VIDSO_GRANTS_FILE = '/nonexistent-dir/vidso-grants-fixes.json'
process.env.VIDSO_INTENTS_FILE = '/nonexistent-dir/vidso-intents-fixes.json'

const store = await import('../lib/usage-store.js')
const grants = await import('../lib/grants.js')
const { creditCharge, creditsForUsd, falUsdForImage } = await import('../lib/studio-credits.js')
const { partialRefund, eventTime, fulfillWhopEvent } = await import('../lib/whop-webhook.js')
const { ruleFor, rememberMediaCharge, refundFailedMedia } = await import('../lib/gate-run.js')
const { WHOP_PLAN_ENV_DEFAULTS } = await import('../lib/whop-map.js')

const anchor = '2026-01-15T00:00:00Z'
const jan = new Date('2026-01-20T00:00:00Z')

test('the scene flag only discounts the scene models at their normal size', () => {
  assert.equal(creditCharge({ kind: 'image', model: 'z-image-turbo', resolution: '1K', scene: true }), 1)
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana', resolution: '1K', scene: true }), 1)
  const pro = creditCharge({ kind: 'image', model: 'nano-banana-pro', resolution: '4K', numImages: 4, scene: true })
  assert.equal(pro, creditCharge({ kind: 'image', model: 'nano-banana-pro', resolution: '4K', numImages: 4 }))
  assert.ok(pro > 4)
  const big = creditCharge({ kind: 'image', model: 'z-image-turbo', resolution: '4K', scene: true })
  assert.equal(big, creditsForUsd(falUsdForImage({ model: 'z-image-turbo', resolution: '4K' })))
})

test('rollover never gives more than the finished window granted', () => {
  // A free (or stub) window granted nothing, so nothing rolls over.
  assert.equal(store.rolloverCredits({ limit: 5000, used: 0, granted: 0 }), 0)
  assert.equal(store.rolloverCredits({ limit: 5000, used: 0, granted: 0, windowsPassed: 2 }), 0)
  // A paid window rolls over its leftovers, capped at a month.
  assert.equal(store.rolloverCredits({ limit: 300, used: 100, granted: 300 }), 200)
  // Windows recorded before `granted` existed keep the old rule.
  assert.equal(store.rolloverCredits({ limit: 300, used: 100 }), 200)
})

test('credit months start from the paid plan, not the signup date', () => {
  store._resetStoreForTests()
  const u = { id: 'anchor1', plan: 'agency', plan_status: 'active', created_at: '2026-01-05T00:00:00Z', plan_started_at: '2026-02-03T00:00:00Z' }
  const snap = store.readUsage(u, new Date('2026-02-04T00:00:00Z'))
  assert.equal(snap.windowStart.slice(0, 10), '2026-02-03')
})

for (const backend of BACKENDS) {
  test(`parallel holds can't spend past the balance (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    const u = { id: 'hold1', plan: 'plus', plan_status: 'active', created_at: anchor }
    const results = await Promise.all([1, 2, 3, 4].map(() => store.reserveStudioCredits(u, 100, 300, jan)))
    assert.equal(results.filter((r) => r.ok).length, 3)
    store._resetStoreForTests()
    assert.equal((await store.hydrateUsage(u, jan)).studio_credits_used, 300)
    await store.releaseStudioCredits(u, 100, jan)
    store._resetStoreForTests()
    assert.equal((await store.hydrateUsage(u, jan)).studio_credits_used, 200)
  })

  test(`a cancel mark gives way to a fresh paid read; a refund mark does not (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    grants._resetGrantsForTests()
    t.after(() => { kv.restore(); grants._resetGrantsForTests() })
    const buyer = { id: 'user-lift', email: 'lift@gmail.com' }
    const grant = (membershipId) => ({ tier: 'pro', cycle: 'monthly', planId: WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PRO_MONTHLY, membershipId, source: 'whop' })
    await grants.revokeMembership('mem_cancel_late', { reason: 'membership.deactivated' })
    const saved = await grants.saveGrant(buyer, grant('mem_cancel_late'))
    assert.equal(saved.tier, 'pro')
    assert.equal(await grants.membershipRevoked('mem_cancel_late'), null)

    await grants.revokeMembership('mem_refunded', { reason: 'refund.created' })
    await assert.rejects(() => grants.saveGrant(buyer, grant('mem_refunded')), /refunded or disputed/)
  })

  test(`a won dispute gives access back (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    grants._resetGrantsForTests()
    t.after(() => { kv.restore(); grants._resetGrantsForTests() })
    await fulfillWhopEvent({ type: 'dispute.created', data: { membership_id: 'mem_dispute' } })
    assert.ok(await grants.membershipRevoked('mem_dispute'))
    await fulfillWhopEvent({ type: 'dispute.updated', data: { membership_id: 'mem_dispute', status: 'won' } })
    grants._resetGrantsForTests()
    assert.equal(await grants.membershipRevoked('mem_dispute'), null)
  })
}

test('a partial refund keeps the membership; a full one ends it', () => {
  assert.equal(partialRefund('refund.created', { amount: 10, payment: { final_amount: 49 } }), true)
  assert.equal(partialRefund('refund.created', { amount: 49, payment: { final_amount: 49 } }), false)
  assert.equal(partialRefund('refund.created', {}), false) // no amounts: treated as full
  assert.equal(partialRefund('dispute.created', { amount: 1, payment: { final_amount: 49 } }), false)
})

test('revocations are stamped with when the event happened', () => {
  const now = Date.parse('2026-03-01T00:00:00Z')
  assert.equal(eventTime({}, { updated_at: '2026-02-01T00:00:00Z' }, now), Date.parse('2026-02-01T00:00:00Z'))
  assert.equal(eventTime({ timestamp: 1767225600 }, {}, now), 1767225600 * 1000)
  assert.equal(eventTime({}, {}, now), now)
  assert.equal(eventTime({}, { created_at: '2027-01-01T00:00:00Z' }, now), now) // never in the future
})

test('a failed voice job gives its credits back once, after Railway confirms', async (t) => {
  store._resetStoreForTests()
  const real = globalThis.fetch
  let jobStatus = 'processing'
  globalThis.fetch = async () => ({ status: 200, text: async () => JSON.stringify({ status: jobStatus }) })
  t.after(() => { globalThis.fetch = real })
  assert.equal(ruleFor('POST', 'faceless/media/refund').type, 'media_refund')
  const u = { id: 'voice1', plan: 'pro', plan_status: 'active', created_at: anchor }
  await store.reserveStudioCredits(u, 80, 750)
  await rememberMediaCharge(u, { jobId: 'job_abc' }, 80)

  const early = await refundFailedMedia({ token: 't', user: u, jobId: 'job_abc' })
  assert.equal(early.body.refunded, 0)
  assert.equal(early.body.reason, 'not_failed')

  jobStatus = 'error'
  const stranger = await refundFailedMedia({ token: 't', user: { id: 'someone-else' }, jobId: 'job_abc' })
  assert.equal(stranger.body.refunded, 0)

  const done = await refundFailedMedia({ token: 't', user: u, jobId: 'job_abc' })
  assert.equal(done.body.refunded, 80)
  assert.equal(store.readUsage(u).studio_credits_used, 0)
  const again = await refundFailedMedia({ token: 't', user: u, jobId: 'job_abc' })
  assert.equal(again.body.refunded, 0)
})
