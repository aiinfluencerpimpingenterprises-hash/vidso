import test from 'node:test'
import assert from 'node:assert/strict'
import { CREATOR_STEPS, hueFor } from '../lib/channel-creator.js'

test('creator steps follow the reference order', () => {
  assert.deepEqual(CREATOR_STEPS.map((s) => s.id), ['topic', 'style', 'voice', 'captions'])
  for (const s of CREATOR_STEPS) assert.ok(s.say.length > 10)
})

test('voice avatar colours are stable per name', () => {
  assert.equal(hueFor('Roger'), hueFor('Roger'))
  assert.ok(hueFor('Roger') >= 0 && hueFor('Roger') < 360)
  assert.notEqual(hueFor('Roger'), hueFor('Sarah'))
})
