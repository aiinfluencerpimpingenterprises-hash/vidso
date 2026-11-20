import test from 'node:test'
import assert from 'node:assert/strict'
import { progressFrom, videoPlan, makeTimeLabel, durationSeconds, PROGRESS_STEPS, HOSTS } from '../lib/studio-flow.js'
import { AGENTS } from '../lib/agents-chat.js'

test('every host and progress step is a real agent', () => {
  const ids = new Set(AGENTS.map((a) => a.id))
  for (const h of Object.values(HOSTS)) assert.ok(ids.has(h.agent), h.agent)
  for (const s of PROGRESS_STEPS) assert.ok(ids.has(s.agent), s.agent)
})

test('progress follows the crew and focuses the working agent', () => {
  const p = progressFrom({ script: { state: 'done' }, title: { state: 'done' }, voice: { state: 'working', text: 'Recording' } })
  assert.equal(p.focus.agent, 'voice')
  assert.equal(p.done, 2)
  assert.ok(p.percent > 20 && p.percent < 50)
  assert.equal(progressFrom({}, { delivered: true }).percent, 100)
  assert.equal(progressFrom({ editor: { state: 'stuck', text: 'Render failed' } }).focus.agent, 'editor')
})

test('video plan counts scenes, animated scenes and a rough time', () => {
  const still = videoPlan({ seconds: 600, mode: 'cheapest' })
  const anim = videoPlan({ seconds: 600, mode: 'cinematic' })
  assert.equal(still.count, 86)
  assert.equal(still.animated, 0)
  assert.equal(anim.animated, anim.count)
  assert.ok(anim.minutes > still.minutes)
  assert.equal(durationSeconds('long_900'), 900)
  assert.equal(makeTimeLabel(75), 'about 1 h 15 min')
  assert.equal(makeTimeLabel(12), 'about 12 min')
})
