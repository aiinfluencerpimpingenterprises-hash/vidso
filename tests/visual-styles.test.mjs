import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { VISUAL_STYLES, STYLE_GROUPS, DEFAULT_STYLE, visualStyleById, planScenes, sceneImagePrompt, MAX_SCENES, styleSample } from '../lib/visual-styles.js'
import { normalizeProfile } from '../lib/channel-kit.js'
import { parseScenes } from '../lib/scene-agent.js'
import { routeManagerMessage as route } from '../lib/agents-chat.js'

const words = (n) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ')

test('a short list of proven faceless styles, unique ids, every group used, a real default', () => {
  assert.equal(VISUAL_STYLES.length, 67)
  assert.equal(new Set(VISUAL_STYLES.map((s) => s.id)).size, VISUAL_STYLES.length)
  for (const g of STYLE_GROUPS) assert.ok(VISUAL_STYLES.some((s) => s.group === g), g)
  assert.ok(visualStyleById(DEFAULT_STYLE))
})

test('profiles saved with stock footage move to the default AI style', () => {
  assert.equal(normalizeProfile({ visualStyle: 'stock' }).visualStyle, DEFAULT_STYLE)
  assert.equal(normalizeProfile({}).visualStyle, DEFAULT_STYLE)
  assert.equal(normalizeProfile({ visualStyle: 'cartoon' }).visualStyle, 'cartoon')
  // Styles no longer offered map to the closest kept one, including older retired ids.
  assert.equal(normalizeProfile({ visualStyle: 'ghibli' }).visualStyle, 'ghibli')
  assert.equal(normalizeProfile({ visualStyle: 'shonen' }).visualStyle, 'shonen')
  assert.equal(normalizeProfile({ visualStyle: 'golden_stick' }).visualStyle, 'golden_stick')
  assert.equal(normalizeProfile({ visualStyle: 'pop_art' }).visualStyle, 'comic')
  assert.equal(normalizeProfile({ visualStyle: 'vintage_sketch' }).visualStyle, 'oil')
  assert.equal(normalizeProfile({ visualStyle: 'whiteboard' }).visualStyle, 'flat_whiteboard')
  assert.equal(normalizeProfile({ visualStyle: 'painted' }).visualStyle, 'oil')
  assert.equal(normalizeProfile({ visualStyle: 'wet_plate' }).visualStyle, 'archive')
  assert.equal(normalizeProfile({ visualStyle: 'biblical' }).visualStyle, 'biblical')
  assert.equal(normalizeProfile({ visualStyle: 'war_film' }).visualStyle, 'epic')
  assert.equal(normalizeProfile({ visualStyle: 'no-such-style' }).visualStyle, DEFAULT_STYLE)
})

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

test('style samples: one image per style, the same in every genre', () => {
  assert.equal(styleSample('archive'), '/home/img/styles/archive.jpg')
  assert.equal(styleSample('archive', 'mystery'), '/home/img/styles/archive.jpg')
  assert.equal(styleSample('whiteboard'), '/home/img/styles/flat_whiteboard.jpg')
})
