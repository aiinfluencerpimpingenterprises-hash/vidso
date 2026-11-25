import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKENDS, installFakeUpstash } from './helpers/fake-upstash.mjs'

process.env.VIDSO_GRANTS_FILE = '/nonexistent-dir/vidso-grants-test.json'
process.env.VIDSO_INTENTS_FILE = '/nonexistent-dir/vidso-intents-test.json'
const { WHOP_PLAN_ENV_DEFAULTS } = await import('../lib/whop-map.js')
const grants = await import('../lib/grants.js')
const { fulfillWhopEvent, revokedMembershipId } = await import('../lib/whop-webhook.js')

const PRO_MONTHLY = WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PRO_MONTHLY
const buyer = { id: 'user-1', email: 'buyer@gmail.com' }
const proGrant = (membershipId) => ({ tier: 'pro', cycle: 'monthly', planId: PRO_MONTHLY, membershipId, source: 'whop' })

function setup(t, backend) {
  const kv = installFakeUpstash({ backend })
  grants._resetGrantsForTests()
  t.after(() => { kv.restore(); grants._resetGrantsForTests() })
  return kv
}

/** A fresh Vercel instance: local caches gone, Redis kept. */
function coldStart() {
  grants._resetGrantsForTests()
}

for (const backend of BACKENDS) {
  test(`a cancel that takes effect removes access on every instance (${backend})`, async (t) => {
    setup(t, backend)
    await grants.saveGrant(buyer, proGrant('mem_cancel'))
    assert.equal((await grants.grantFor(buyer))?.tier, 'pro')
    const out = await fulfillWhopEvent({ type: 'membership.deactivated', data: { id: 'mem_cancel', status: 'canceled' } }, {})
    assert.equal(out.revoked, 'mem_cancel')
    assert.equal(await grants.grantFor(buyer), null)
    coldStart()
    assert.equal(await grants.grantFor(buyer), null)
  })

  test(`a refund ends access now and the payment cannot be re-attached (${backend})`, async (t) => {
    setup(t, backend)
    await grants.saveGrant(buyer, proGrant('mem_refund'))
    const out = await fulfillWhopEvent({ type: 'refund.created', data: { id: 'rf_1', status: 'pending', payment: { id: 'pay_1', membership_id: 'mem_refund' } } }, {})
    assert.equal(out.revoked, 'mem_refund')
    coldStart()
    assert.equal(await grants.grantFor(buyer), null)
    await assert.rejects(grants.saveGrant(buyer, proGrant('mem_refund')), { code: 'membership_revoked' })
  })

  test(`a failed refund does not end access (${backend})`, async (t) => {
    setup(t, backend)
    await grants.saveGrant(buyer, proGrant('mem_rf_fail'))
    const out = await fulfillWhopEvent({ type: 'refund.updated', data: { status: 'failed', payment: { membership_id: 'mem_rf_fail' } } }, {})
    assert.equal(out.ignored, true)
    assert.equal((await grants.grantFor(buyer))?.tier, 'pro')
  })

  test(`a dispute revokes the membership on the payment (${backend})`, async (t) => {
    setup(t, backend)
    await grants.saveGrant(buyer, proGrant('mem_dispute'))
    await fulfillWhopEvent({ type: 'dispute.created', data: { payment: { membership: { id: 'mem_dispute' } } } }, {})
    assert.equal(await grants.grantFor(buyer), null)
  })

  test(`a later renewal payment lifts the revocation (${backend})`, async (t) => {
    setup(t, backend)
    await grants.revokeMembership('mem_back', { now: Date.parse('2026-03-01T00:00:00Z') })
    assert.equal(await grants.clearRevocation('mem_back', '2026-02-20T00:00:00Z'), false)
    assert.equal(await grants.clearRevocation('mem_back', '2026-04-01T00:00:00Z'), true)
    const rec = await grants.saveGrant(buyer, proGrant('mem_back'))
    assert.equal(rec.tier, 'pro')
  })

  test(`a Redis outage keeps the cached grant instead of locking a payer out (${backend})`, async (t) => {
    const kv = setup(t, backend)
    const now = Date.now()
    await grants.saveGrant(buyer, proGrant('mem_ok'), { now })
    kv.setDown(true)
    const later = now + grants.GRANT_CACHE_MS + 1000
    assert.equal((await grants.grantFor(buyer, { now: later }))?.tier, 'pro')
  })

  test(`a stale grant is re-checked with Whop and dropped when cancelled (${backend})`, async (t) => {
    setup(t, backend)
    const realFetch = globalThis.fetch
    let status = 'active'
    let calls = 0
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith('https://api.whop.com/')) {
        calls++
        return new Response(JSON.stringify({ id: 'mem_stale', status, plan: { id: PRO_MONTHLY } }), { status: 200 })
      }
      return realFetch(url, init)
    }
    t.after(() => { globalThis.fetch = realFetch })
    const env = { WHOP_API_KEY: 'test' }
    const t0 = Date.parse('2026-05-01T00:00:00Z')
    await grants.saveGrant(buyer, proGrant('mem_stale'), { now: t0 })
    assert.equal((await grants.grantFor(buyer, { now: t0 + 60_000, env }))?.tier, 'pro')
    assert.equal(calls, 0)
    const later = t0 + grants.GRANT_RECHECK_MS + 1
    assert.equal((await grants.grantFor(buyer, { now: later, env }))?.tier, 'pro')
    assert.equal(calls, 1)
    status = 'canceled'
    const muchLater = later + grants.GRANT_RECHECK_MS + 1
    assert.equal(await grants.grantFor(buyer, { now: muchLater, env }), null)
  })

  test(`membership id is found on refund and dispute payloads (${backend})`, () => {
    assert.equal(revokedMembershipId('membership.deactivated', { id: 'mem_a' }), 'mem_a')
    assert.equal(revokedMembershipId('refund.created', { payment: { membership_id: 'mem_b' } }), 'mem_b')
    assert.equal(revokedMembershipId('payment.refunded', { membership: { id: 'mem_c' } }), 'mem_c')
    assert.equal(revokedMembershipId('dispute.created', {}), '')
  })
}
