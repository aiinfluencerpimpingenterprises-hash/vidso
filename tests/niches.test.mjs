import test from 'node:test'
import assert from 'node:assert/strict'
import { NICHES, PAY, rankedNiches, customNiche, nicheById, breakoutLabel } from '../lib/niches.js'

test('every niche has a pay tier, a real breakout and four ideas', () => {
  for (const n of NICHES) {
    assert.ok(PAY[n.pay], n.id)
    assert.ok(n.proof.title && n.proof.channel && n.proof.x > 1, n.id)
    assert.equal(n.ideas.length, 4, n.id)
  }
})

test('ranking puts well-paying, fast-breaking niches first and lower-paying last', () => {
  const r = rankedNiches()
  assert.equal(r.length, NICHES.length)
  assert.equal(PAY[r[0].pay], PAY.high)
  assert.equal(r[r.length - 1].pay, 'low')
})

test('custom niche gets ideas; helpers work', () => {
  const c = customNiche('  anime lore ')
  assert.equal(c.name, 'anime lore')
  assert.equal(c.ideas.length, 4)
  assert.equal(customNiche(''), null)
  assert.equal(nicheById('history').name, 'History & ancient life')
  assert.equal(breakoutLabel(6731), '6,731×')
})
