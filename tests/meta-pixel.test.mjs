import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkoutPayload, META_PIXEL_ID } from '../lib/meta-pixel.js'

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
