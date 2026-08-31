import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkoutPayload, conversionEventId, META_PIXEL_ID, pixelTrack } from '../lib/meta-pixel.js'

test('pixel id matches the snippet on Vidso pages', () => {
  assert.equal(META_PIXEL_ID, '4458410001098183')
})

test('checkout payload uses live Whop yearly totals', () => {
  const plus = checkoutPayload('plus', 'annual')
  assert.equal(plus.content_name, 'Plus')
  assert.equal(plus.currency, 'USD')
  assert.equal(plus.value, 179)
  assert.equal(checkoutPayload('starter', 'monthly').value, 70)
  assert.equal(checkoutPayload('creator', 'yearly').value, 299)
  assert.equal(checkoutPayload('studio', 'annual').value, 359)
})

test('conversion event ids stay stable so pixel and CAPI can dedupe', () => {
  assert.equal(conversionEventId('Purchase', 'User-1', 'pro'), 'vidso:Purchase:user-1:pro')
  assert.equal(conversionEventId('CompleteRegistration', 'A@x.com'), 'vidso:CompleteRegistration:a@x.com')
})

test('pixel track passes eventID as the fourth fbq argument', () => {
  const calls = []
  globalThis.fbq = (...args) => calls.push(args)
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
  try {
    pixelTrack('InitiateCheckout', { value: 99, currency: 'USD' }, { eventID: 'vidso:InitiateCheckout:pro' })
    assert.equal(calls[0][0], 'track')
    assert.equal(calls[0][1], 'InitiateCheckout')
    assert.equal(calls[0][2].value, 99)
    assert.equal(calls[0][3].eventID, 'vidso:InitiateCheckout:pro')
  } finally {
    delete globalThis.fbq
    globalThis.fetch = origFetch
  }
})
