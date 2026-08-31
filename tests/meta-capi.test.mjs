import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  buildCapiEvent,
  capiUserData,
  CLIENT_CAPI_EVENTS,
  metaCapiConfig,
  purchaseEventId,
  sanitizeTestCode,
  sendMetaEvents,
  sendPurchaseEvent,
  sha256hex,
} from '../lib/meta-capi.js'
import { fulfillWhopEvent } from '../lib/whop-webhook.js'
import { saveIntent, _resetIntentsForTests } from '../lib/checkout-intents.js'
import { _resetGrantsForTests } from '../lib/grants.js'
import { WHOP_PLAN_ENV_DEFAULTS } from '../lib/whop-map.js'

const PRO_MONTHLY = WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PRO_MONTHLY

test('CAPI hashes email the way Meta requires', () => {
  const hashed = sha256hex('Buyer@Gmail.com')
  assert.equal(hashed, createHash('sha256').update('buyer@gmail.com').digest('hex'))
  assert.equal(hashed.length, 64)
  const user = capiUserData({ email: 'Buyer@Gmail.com', userId: 'u-1', fbp: 'fb.1.1.abc' })
  assert.deepEqual(user.em, [hashed])
  assert.equal(user.fbp, 'fb.1.1.abc')
  assert.equal(user.external_id[0], sha256hex('u-1'))
})

test('Purchase event id matches the browser pixel formula', () => {
  assert.equal(purchaseEventId({ id: 'U-AUTO', email: 'buyer@gmail.com' }, 'creator'), 'vidso:Purchase:u-auto:pro')
  assert.equal(purchaseEventId({ email: 'buyer@gmail.com' }, 'plus'), 'vidso:Purchase:buyer@gmail.com:plus')
})

test('test event codes from Events Manager are accepted, junk is dropped', () => {
  assert.equal(sanitizeTestCode('TEST12345'), 'TEST12345')
  assert.equal(sanitizeTestCode('test99'), 'TEST99')
  assert.equal(sanitizeTestCode('not-a-code'), '')
  assert.equal(metaCapiConfig({ META_CAPI_ACCESS_TOKEN: 'tok' }).accessToken, 'tok')
  assert.equal(metaCapiConfig({}).accessToken, '')
  assert.ok(CLIENT_CAPI_EVENTS.has('CompleteRegistration'))
  assert.equal(CLIENT_CAPI_EVENTS.has('Purchase'), false)
})

test('sendMetaEvents is a no-op without a token and posts Purchase with one', async () => {
  assert.equal((await sendMetaEvents([{ event_name: 'Purchase' }])).skipped, 'no_token')
  const calls = []
  const fetchStub = async (url, opts) => {
    calls.push({ url, opts })
    return { ok: true, status: 200, json: async () => ({ events_received: 1 }) }
  }
  const event = buildCapiEvent({
    eventName: 'Purchase',
    eventId: 'vidso:Purchase:u-1:pro',
    eventSourceUrl: 'https://vidso.pro/video-generation',
    userData: capiUserData({ email: 'buyer@gmail.com' }),
    customData: { value: 99, currency: 'USD' },
  })
  const result = await sendMetaEvents([event], {
    META_CAPI_ACCESS_TOKEN: 'secret-token',
    META_TEST_EVENT_CODE: 'TEST999',
  }, { fetch: fetchStub })
  assert.equal(result.ok, true)
  assert.equal(result.events_received, 1)
  assert.match(calls[0].url, /graph\.facebook\.com\/v21\.0\/4458410001098183\/events/)
  const body = JSON.parse(calls[0].opts.body)
  assert.equal(body.access_token, 'secret-token')
  assert.equal(body.test_event_code, 'TEST999')
  assert.equal(body.data[0].event_name, 'Purchase')
  assert.equal(body.data[0].event_id, 'vidso:Purchase:u-1:pro')
  assert.equal(body.data[0].custom_data.value, 99)
})

test('Whop fulfillment sends a Purchase to CAPI using checkout click ids', async () => {
  _resetGrantsForTests()
  _resetIntentsForTests()
  saveIntent({ id: 'u-auto', email: 'buyer@gmail.com' }, {
    tier: 'pro',
    cycle: 'monthly',
    fbp: 'fb.1.1.click',
    fbc: 'fb.1.1.clid',
    eventId: 'vidso:Purchase:u-auto:pro',
  })
  const calls = []
  const origFetch = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts })
    return { ok: true, status: 200, json: async () => ({ events_received: 1 }) }
  }
  try {
    const result = await fulfillWhopEvent({
      type: 'membership.activated',
      data: {
        id: 'mem_capi',
        status: 'active',
        plan: { id: PRO_MONTHLY },
        metadata: { user_id: 'u-auto', email: 'buyer@gmail.com' },
      },
    }, { META_CAPI_ACCESS_TOKEN: 'secret-token' })
    assert.equal(result.ok, true)
    assert.equal(result.tier, 'pro')
    assert.equal(result.pixel, 'sent')
    assert.equal(calls.length, 1)
    const body = JSON.parse(calls[0].opts.body)
    assert.equal(body.data[0].event_name, 'Purchase')
    assert.equal(body.data[0].event_id, 'vidso:Purchase:u-auto:pro')
    assert.equal(body.data[0].user_data.fbp, 'fb.1.1.click')
    assert.equal(body.data[0].custom_data.value, 99)
  } finally {
    globalThis.fetch = origFetch
    _resetGrantsForTests()
    _resetIntentsForTests()
  }
})

test('sendPurchaseEvent uses live Whop prices', async () => {
  const calls = []
  await sendPurchaseEvent({
    identity: { id: 'u-1', email: 'a@b.com' },
    tier: 'studio',
    cycle: 'yearly',
  }, { META_CAPI_ACCESS_TOKEN: 'tok' }, {
    fetch: async (url, opts) => {
      calls.push(JSON.parse(opts.body))
      return { ok: true, status: 200, json: async () => ({ events_received: 1 }) }
    },
  })
  assert.equal(calls[0].data[0].custom_data.value, 359)
  assert.equal(calls[0].data[0].custom_data.content_name, 'Studio')
})
