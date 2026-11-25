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
  assert.equal(still.count, 150) // 10 min at the 4s Normal pace
  assert.equal(still.animated, 0)
  assert.equal(anim.animated, anim.count)
  assert.ok(anim.minutes > still.minutes)
  assert.equal(durationSeconds('long_900'), 900)
  assert.equal(makeTimeLabel(75), 'about 1 h 15 min')
  assert.equal(makeTimeLabel(12), 'about 12 min')
})

test('scene and caption at a time follow the timings', async () => {
  const { sceneIndexAt, captionAt } = await import('../lib/studio-flow.js')
  const scenes = [{ start: 0, end: 7 }, { start: 7, end: 14 }, { start: 14, end: 20 }]
  assert.equal(sceneIndexAt(scenes, 0), 0)
  assert.equal(sceneIndexAt(scenes, 7.5), 1)
  assert.equal(sceneIndexAt(scenes, 99), 2)
  const words = [[0, 0.4, 'Night'], [0.4, 0.8, 'owls'], [0.8, 1.2, 'think'], [1.2, 1.6, 'very'], [1.6, 2, 'differently'], [2, 2.4, 'and']]
  assert.deepEqual(captionAt(words, 0.5), { line: ['Night', 'owls', 'think', 'very', 'differently'], hot: 1 })
  assert.deepEqual(captionAt(words, 2.1).line, ['and'])
  assert.deepEqual(captionAt([], 1), { line: [], hot: -1 })
})
