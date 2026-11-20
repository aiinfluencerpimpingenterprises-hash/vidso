import test from 'node:test'
import assert from 'node:assert/strict'
import { MANUAL_STEPS, stepStatus } from '../lib/studio-hub.js'
import { AGENTS } from '../lib/agents-chat.js'

test('every manual step belongs to a real agent, in pipeline order', () => {
  const ids = new Set(AGENTS.map((a) => a.id))
  for (const s of MANUAL_STEPS) assert.ok(ids.has(s.agent), s.agent)
  assert.deepEqual(MANUAL_STEPS.map((s) => s.id), ['script', 'title', 'voice', 'scenes', 'thumbnail', 'edit', 'publish'])
})

test('step status reads the current video', () => {
  const by = Object.fromEntries(MANUAL_STEPS.map((s) => [s.id, s]))
  assert.equal(stepStatus(by.script, {}, null).state, 'todo')
  const st = {
    script: { words: 1512, title: 'Why night owls think differently', options: [{ title: 'a' }, { title: 'b' }] },
    media: { voiceover: 'https://x/v.mp3', duration: 184, clips: 3 },
    hasMedia: true,
    crew: { thumbnail: { state: 'working', text: 'Designing' } },
  }
  assert.deepEqual(stepStatus(by.script, st, null), { state: 'done', text: '1,512 words · “Why night owls think differently”' })
  assert.equal(stepStatus(by.voice, st, null).text, 'Recorded · 3:04')
  assert.deepEqual(stepStatus(by.thumbnail, st, null), { state: 'working', text: 'Designing' })
  assert.equal(stepStatus(by.edit, st, null).text, 'Ready to render')
  const proj = { styleName: 'Whiteboard', scenes: [{ clip: '' }, { clip: 'x' }] }
  assert.equal(stepStatus(by.scenes, st, proj).text, '2 scenes in Whiteboard · 1 animated')
  assert.equal(stepStatus(by.edit, { ...st, crew: { editor: { state: 'error', text: 'Render failed' } } }, null).state, 'stuck')
})
