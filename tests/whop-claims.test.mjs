import test from 'node:test'
import assert from 'node:assert/strict'

process.env.VIDSO_GRANTS_FILE = '/nonexistent-dir/vidso-grants-claims.json'
process.env.VIDSO_INTENTS_FILE = '/nonexistent-dir/vidso-intents-claims.json'

const { WHOP_PLAN_ENV_DEFAULTS } = await import('../lib/whop-map.js')
const { createCheckoutSession } = await import('../lib/whop-checkout.js')
const { _resetWhopCacheForTests } = await import('../lib/whop-lookup.js')
const { _resetGrantsForTests } = await import('../lib/grants.js')
const { saveIntent, offEmailClaimAllowed, membershipCreatedMs, _resetIntentsForTests } = await import('../lib/checkout-intents.js')
const { default: syncHandler } = await import('../api/billing/sync.js')

const PRO_MONTHLY = WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PRO_MONTHLY

test('a server checkout session gets past the metadata line and tags the tier', async (t) => {
  const real = globalThis.fetch
  const posts = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    if (init.method === 'POST' && u.endsWith('/checkout_configurations')) {
      posts.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ id: 'ch_1', purchase_url: 'https://whop.com/checkout/ch_1' }), { status: 200 })
    }
    // Plan read / patch for orchestration: answer OK.
    return new Response(JSON.stringify({ id: PRO_MONTHLY }), { status: 200 })
  }
  t.after(() => { globalThis.fetch = real })
  const out = await createCheckoutSession({ tier: 'pro', cycle: 'monthly', email: 'buyer@example.com', userId: 'u-1', origin: 'https://www.tubeops.pro' }, { WHOP_API_KEY: 'k' })
  assert.equal(out.source, 'session', out.message)
  assert.match(out.url, /^https:\/\/whop\.com\/checkout\/ch_1/)
  assert.equal(posts[0].metadata.tier, 'pro')
  assert.equal(posts[0].metadata.user_id, 'u-1')
})

test('an off-email membership needs a same-tier checkout from this account shortly before it', () => {
  const at = Date.parse('2026-11-28T10:00:00Z')
  const intent = { at: new Date(at).toISOString(), tier: 'pro' }
  assert.equal(offEmailClaimAllowed({ intent, tier: 'pro', createdAt: at + 10 * 60 * 1000 }).ok, true)
  assert.equal(offEmailClaimAllowed({ intent, tier: 'pro', createdAt: at - 60 * 1000 }).ok, false) // bought before the checkout
  assert.equal(offEmailClaimAllowed({ intent, tier: 'pro', createdAt: at + 4 * 3600 * 1000 }).ok, false) // too long after
  assert.equal(offEmailClaimAllowed({ intent, tier: 'studio', createdAt: at + 60 * 1000 }).ok, false) // other tier
  assert.equal(offEmailClaimAllowed({ intent: null, tier: 'pro', createdAt: at }).ok, false)
  assert.equal(offEmailClaimAllowed({ intent, tier: 'pro', createdAt: NaN }).ok, false)
  // An earlier checkout still counts after Buy was clicked again.
  const again = { at: new Date(at + 5 * 3600 * 1000).toISOString(), tier: 'pro', history: [intent] }
  assert.equal(offEmailClaimAllowed({ intent: again, tier: 'pro', createdAt: at + 30 * 60 * 1000 }).ok, true)
  assert.equal(membershipCreatedMs({ created_at: '2026-11-28T10:00:00Z' }), at)
  assert.equal(membershipCreatedMs({ created_at: at / 1000 }), at)
})

function syncCall(body) {
  const req = { method: 'POST', headers: { authorization: 'Bearer tok', host: 'www.tubeops.pro' }, body }
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    end(b) { this.body = b || '' },
  }
  return syncHandler(req, res).then(() => ({ status: res.statusCode, json: JSON.parse(res.body) }))
}

function fakeWhop(t, { me, membership }) {
  const real = globalThis.fetch
  const prevKey = process.env.WHOP_API_KEY
  process.env.WHOP_API_KEY = 'test-key'
  globalThis.fetch = async (url) => {
    const u = String(url)
    const json = (data) => new Response(JSON.stringify(data), { status: 200 })
    if (u.endsWith('/api/user/me')) return json(me)
    if (u.includes('/members?')) {
      const q = decodeURIComponent(u)
      return json({ data: q.includes(membership.user.email) ? [{ user: membership.user }] : [] })
    }
    if (u.includes('/memberships/' + membership.id)) return json(membership)
    if (u.includes('/memberships?')) return json({ data: [membership], page_info: { has_next_page: false } })
    return json({})
  }
  t.after(() => {
    globalThis.fetch = real
    if (prevKey === undefined) delete process.env.WHOP_API_KEY
    else process.env.WHOP_API_KEY = prevKey
  })
}

function reset() {
  _resetWhopCacheForTests()
  _resetGrantsForTests()
  _resetIntentsForTests()
}

test("a free checkout intent can't claim someone else's earlier membership by email", async (t) => {
  reset()
  t.after(reset)
  const victim = {
    id: 'mem_victim',
    status: 'active',
    plan: { id: PRO_MONTHLY },
    user: { id: 'user_victim', email: 'victim@example.com' },
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    metadata: {},
  }
  const attacker = { id: 'attacker-1', email: 'attacker@example.com' }
  fakeWhop(t, { me: attacker, membership: victim })
  saveIntent(attacker, { tier: 'pro' }) // a free checkout started just now
  const out = await syncCall({ paidEmail: 'victim@example.com', force: true })
  assert.equal(out.json.active, false)
  assert.equal(out.json.reason, 'contact_support')
  assert.match(out.json.message, /Contact support with your receipt/)
})

test("a membership stamped with another TubeOps account's id is refused", async (t) => {
  reset()
  t.after(reset)
  const attacker = { id: 'attacker-2', email: 'attacker2@example.com' }
  saveIntent(attacker, { tier: 'pro', at: new Date(Date.now() - 20 * 60 * 1000).toISOString() })
  const victim = {
    id: 'mem_victim2',
    status: 'active',
    plan: { id: PRO_MONTHLY },
    user: { id: 'user_victim2', email: 'victim2@example.com' },
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    metadata: { user_id: 'victim-tubeops-id' },
  }
  fakeWhop(t, { me: attacker, membership: victim })
  const out = await syncCall({ paidEmail: 'victim2@example.com', force: true })
  assert.equal(out.json.active, false)
  assert.equal(out.json.reason, 'contact_support')
})

test('a receipt email that matches a checkout from this account just before is attached', async (t) => {
  reset()
  t.after(reset)
  const buyer = { id: 'buyer-1', email: 'buyer@gmail.com' }
  saveIntent(buyer, { tier: 'pro', at: new Date(Date.now() - 30 * 60 * 1000).toISOString() })
  const own = {
    id: 'mem_own',
    status: 'active',
    plan: { id: PRO_MONTHLY },
    user: { id: 'user_receipt', email: 'receipt@icloud.com' },
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    metadata: {},
  }
  fakeWhop(t, { me: buyer, membership: own })
  const out = await syncCall({ paidEmail: 'receipt@icloud.com', force: true })
  assert.equal(out.json.active, true, JSON.stringify(out.json))
  assert.equal(out.json.tier, 'pro')
})
