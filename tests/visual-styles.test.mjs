import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { VISUAL_STYLES, planScenes, sceneImagePrompt, MAX_SCENES } from '../lib/visual-styles.js'
import { parseScenes } from '../lib/scene-agent.js'
import { routeManagerMessage as route } from '../lib/agents-chat.js'

const words = (n) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ')

test('every style has a prompt and a sample image', () => {
  for (const s of VISUAL_STYLES) {
    assert.ok(s.prompt.length > 30, s.id)
    assert.ok(fs.existsSync(new URL('../home/img/styles/' + s.id + '.jpg', import.meta.url)), s.id + ' sample')
  }
})

test('scenes cover the narration end to end at the chosen pace', () => {
  const sc = planScenes({ text: words(300), duration: 120, pace: 'rapid', mode: 'balanced' })
  assert.equal(sc.length, 30)
  assert.equal(sc[0].start, 0)
  assert.equal(sc.at(-1).end, 120)
  assert.ok(sc.every((x) => x.text.length))
  assert.deepEqual(sc.filter((x) => x.animate).map((x) => x.i).slice(0, 3), [0, 3, 6])
  assert.ok(planScenes({ text: words(5000), duration: 1800, pace: 'hyper' }).length <= MAX_SCENES)
  assert.ok(planScenes({ text: words(100), duration: 60, mode: 'cheapest' }).every((x) => !x.animate))
})

test('scene prompts add the style, the character and no-text rules', () => {
  const p = sceneImagePrompt({ scene: 'A man at a counter', style: 'stick', character: 'a bald man with glasses' })
  assert.match(p, /stick figure/)
  assert.match(p, /bald man with glasses/)
  assert.match(p, /No text/)
})

test('planner output is parsed per scene and unknown ids are dropped', () => {
  const out = parseScenes('{"scenes":[{"i":0,"prompt":"A store"},{"i":9,"prompt":"x"},{"i":1,"prompt":""}]}', new Set([0, 1]))
  assert.deepEqual(out, { 0: 'A store' })
})

test('asking about art style opens the visuals settings', () => {
  assert.equal(route('make it a stick figure video', true).type, 'visuals')
  assert.equal(route('change the art style', true).type, 'visuals')
})
