import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKENDS, installFakeUpstash } from './helpers/fake-upstash.mjs'

process.env.VIDSO_USAGE_FILE = '/nonexistent-dir/vidso-usage-test.json'
const store = await import('../lib/usage-store.js')

const plusAnchor = '2026-01-15T00:00:00Z'
const jan = new Date('2026-01-20T00:00:00Z')

for (const backend of BACKENDS) {
  test(`credit spend survives a cold start when Redis is on (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    const u = { id: 'cold1', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
    await store.incrementStudioCredits(u, 40, jan)
    store.incrementUsage(u, 'long_form', jan)
    await store.settleUsageWrites()
    store._resetStoreForTests() // a fresh Vercel instance: memory gone
    const after = await store.hydrateUsage(u, jan)
    assert.equal(after.studio_credits_used, 40)
    assert.equal(after.long_form_used, 1)
  })

  test(`two instances spending at once both count (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    const u = { id: 'race1', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
    await Promise.all([
      store.incrementStudioCredits(u, 10, jan),
      store.incrementStudioCredits(u, 15, jan),
      store.incrementStudioCredits(u, 5, jan),
    ])
    store._resetStoreForTests()
    assert.equal((await store.hydrateUsage(u, jan)).studio_credits_used, 30)
  })

  test(`leftover credits carry into the next window from Redis (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    const u = { id: 'carry1', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
    await store.incrementStudioCredits(u, 120, jan)
    store._resetStoreForTests()
    const feb = await store.hydrateUsage(u, new Date('2026-02-16T00:00:00Z'))
    assert.equal(feb.studio_credits_used, 0)
    const limit = (await import('../lib/studio-credits.js')).creditsLimitForUser(u)
    assert.equal(feb.credits_carry, Math.min(limit, Math.max(0, limit - 120)))
  })

  test(`free scenes are handed out once across instances (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    const u = { id: 'scene-r', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
    await store.addSceneAllowance(u, 1, jan)
    store._resetStoreForTests()
    const takes = await Promise.all([store.takeSceneAllowance(u, jan), store.takeSceneAllowance(u, jan)])
    assert.deepEqual(takes.sort(), [false, true])
  })

  test(`users without a billing date share one anchor across instances (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    const u = { id: 'noanchor' }
    await store.incrementStudioCredits(u, 7, jan)
    store._resetStoreForTests()
    const later = new Date('2026-01-25T00:00:00Z')
    assert.equal((await store.hydrateUsage(u, later)).studio_credits_used, 7)
  })

  test(`a Redis outage falls back to memory instead of failing (${backend})`, async (t) => {
    const kv = installFakeUpstash({ backend })
    t.after(() => kv.restore())
    store._resetStoreForTests()
    kv.setDown(true)
    const u = { id: 'down1', plan: 'plus', plan_status: 'active', created_at: plusAnchor }
    const snap = await store.incrementStudioCredits(u, 9, jan)
    assert.equal(snap.studio_credits_used, 9)
  })
}
