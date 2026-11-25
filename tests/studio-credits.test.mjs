import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  creditCharge,
  creditsForUsd,
  estimateVideoCredits,
  sceneAllowance,
  usesSceneAllowance,
  videoCredits,
  falUsdForImage,
  falUsdForVideo,
  studioCreditView,
} from '../lib/studio-credits.js'

test('1 credit covers $0.025 of Fal cost, rounded up', () => {
  assert.equal(creditsForUsd(0.01), 1)
  assert.equal(creditsForUsd(0.039), 2)
  assert.equal(creditsForUsd(0.56), 23)
  assert.equal(creditsForUsd(3.2), 128)
})

test('video clips are H3 Max Turbo at $0.015 a second, at least 4 credits', () => {
  assert.equal(creditCharge({ kind: 'video', model: 'h3-max-turbo', duration: 4 }), 4)
  assert.equal(creditCharge({ kind: 'video', model: 'h3-max-turbo', duration: 10 }), 6)
  assert.ok(Math.abs(falUsdForVideo({ model: 'h3-max-turbo', duration: 4 }) - 0.06) < 1e-9)
  assert.equal(falUsdForVideo({ model: 'veo-3.1', duration: 8 }), 0)
})

test('image charges match Fal list prices', () => {
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana' }), 2)
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana-pro', resolution: '2K' }), 6)
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana-pro', resolution: '4K' }), 12)
  assert.equal(creditCharge({ kind: 'image', model: 'flux-2-pro', width: 1280, height: 720 }), 2)
  assert.equal(creditCharge({ kind: 'image', model: 'seedream-4.5' }), 2)
  assert.equal(creditCharge({ kind: 'image', model: 'seedream-5-lite' }), 2)
  assert.equal(creditCharge({ kind: 'image', model: 'gpt-image-2' }), 7)
  assert.equal(creditCharge({ kind: 'image', model: 'z-image-turbo' }), 1)
  assert.equal(falUsdForImage({ model: 'nano-banana-pro', resolution: '2K', numImages: 2 }), 0.30)
})

test('scene images: Z-Image comes from the allowance, a character scene costs 1 credit', () => {
  assert.equal(creditCharge({ kind: 'image', model: 'z-image-turbo', scene: true }), 1)
  assert.equal(creditCharge({ kind: 'image', model: 'nano-banana', scene: true }), 1)
  assert.equal(usesSceneAllowance({ scene: true, model: 'z-image-turbo' }), true)
  assert.equal(usesSceneAllowance({ scene: true, model: 'z-image-turbo', refs: ['https://x/y.png'] }), false)
  assert.equal(usesSceneAllowance({ scene: true, model: 'nano-banana' }), false)
  assert.equal(usesSceneAllowance({ model: 'z-image-turbo' }), false)
})

test('a video costs 8 credits a minute, plus animation and character', () => {
  assert.equal(videoCredits(600), 80)
  assert.equal(videoCredits(60), 8)
  assert.equal(videoCredits(61), 9)
  assert.equal(videoCredits(0), 0)
  assert.equal(estimateVideoCredits({ seconds: 600 }).total, 80)
  assert.equal(estimateVideoCredits({ seconds: 600, mode: 'balanced' }).total, 280)
  assert.equal(estimateVideoCredits({ seconds: 600, mode: 'cinematic' }).total, 680)
  assert.equal(estimateVideoCredits({ seconds: 600, character: true }).total, 230)
  assert.equal(sceneAllowance(600, 'normal'), 152)
  assert.equal(sceneAllowance(60, 'rapid'), 26)
})

test('stock footage is not a Fal credit charge', () => {
  assert.equal(falUsdForVideo({ model: 'stock', duration: 5 }), 0)
})

test('credit view adds last month\'s rollover', () => {
  const view = studioCreditView(
    { plan_status: 'active', plan: 'plus' },
    { studio_credits_used: 100, credits_carry: 40 },
  )
  assert.equal(view.remaining, 240)
  assert.equal(view.carry, 40)
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
