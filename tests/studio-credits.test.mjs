import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  creditCharge,
  creditsForUsd,
  falUsdForImage,
  falUsdForVideo,
  studioCreditView,
} from '../lib/studio-credits.js'

test('1 credit is one cent of Fal cost, rounded up', () => {
  assert.equal(creditsForUsd(0.01), 1)
  assert.equal(creditsForUsd(0.039), 4)
  assert.equal(creditsForUsd(0.56), 56)
  assert.equal(creditsForUsd(3.2), 320)
})

test('video charges match Fal list prices', () => {
  assert.equal(creditCharge({ kind: 'video', model: 'kling-3-pro', duration: 5 }), 56)
  assert.equal(creditCharge({ kind: 'video', model: 'kling-3-pro', duration: 5, generateAudio: true }), 84)
  assert.equal(creditCharge({ kind: 'video', model: 'veo-3.1', duration: 8, resolution: '720p', generateAudio: true }), 320)
  assert.equal(creditCharge({ kind: 'video', model: 'veo-3.1', duration: 8, resolution: '4k' }), 320)
  assert.equal(creditCharge({ kind: 'video', model: 'sora-2', duration: 8 }), 80)
  assert.equal(creditCharge({ kind: 'video', model: 'wan-2.7', duration: 5 }), 50)
  assert.equal(creditCharge({ kind: 'video', model: 'hailuo-02', duration: 6 }), 48)
  const seedance = falUsdForVideo({ model: 'seedance-2', duration: 8, resolution: '720p' })
  assert.ok(Math.abs(seedance - 0.3034 * 8) < 1e-9)
  assert.equal(creditCharge({ kind: 'video', model: 'seedance-2', duration: 8, resolution: '720p' }), 243)
})

test('image charges match Fal list prices', () => {
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana' }), 4)
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana-pro', resolution: '2K' }), 15)
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana-pro', resolution: '4K' }), 30)
  assert.equal(creditCharge({ kind: 'image', model: 'flux-2-pro', width: 1280, height: 720 }), 3)
  assert.equal(creditCharge({ kind: 'image', model: 'seedream-4.5' }), 4)
  assert.equal(creditCharge({ kind: 'image', model: 'seedream-5-lite' }), 4)
  assert.equal(creditCharge({ kind: 'image', model: 'gpt-image-2' }), 16)
  assert.equal(falUsdForImage({ model: 'nano-banana-pro', resolution: '2K', numImages: 2 }), 0.30)
})

test('stock footage is not a Fal credit charge', () => {
  assert.equal(falUsdForVideo({ model: 'stock', duration: 5 }), 0)
})

test('studio credit view is independent of long-form counts', () => {
  const view = studioCreditView(
    { plan_status: 'active', plan: 'plus' },
    { long_form_used: 9, studio_credits_used: 56 },
  )
  assert.equal(view.limit, 300)
  assert.equal(view.remaining, 244)
  assert.equal(view.compact, '244 cr')
})
