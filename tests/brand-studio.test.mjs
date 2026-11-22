import test from 'node:test'
import assert from 'node:assert/strict'
import { BRAND_STEPS, styleFromLook, captionSummary } from '../lib/brand-studio.js'
import { AGENTS } from '../lib/agents-chat.js'

test('brand steps are hosted by real agents, in order', () => {
  const ids = new Set(AGENTS.map((a) => a.id))
  assert.deepEqual(BRAND_STEPS.map((s) => s.id), ['genre', 'style', 'voice', 'captions', 'video'])
  for (const s of BRAND_STEPS) assert.ok(ids.has(s.agent), s.agent)
})

test('a preset look becomes the renderer caption style', () => {
  const fonts = [{ label: 'Arial Black', css: "'Arial Black', Arial, sans-serif" }]
  const look = { id: 'bold', name: 'Bold yellow', size: 64, font: 'Arial Black', base: '#ffffff', hl: '#ffd400', stroke: '#000000', strokeW: 4, shadow: false }
  const s = styleFromLook(look, fonts)
  assert.deepEqual(s, { font: "'Arial Black', Arial, sans-serif", size: 64, color: '#ffffff', highlight: '#ffd400', stroke: true, strokeColor: '#000000', strokeWidth: 4, shadow: false })
  assert.equal(captionSummary(s, fonts), 'Arial Black · 64px · outline')
  assert.equal(styleFromLook(null), null)
})
