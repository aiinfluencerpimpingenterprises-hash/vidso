import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  FORMAT_CARDS,
  GATED_FEATURE_ROWS,
  LIVE_FEATURE_ROWS,
  PLACEHOLDER_FILES,
  ROADMAP_SECTIONS,
  STUDIO_TOOLS,
  UGC_CARDS,
  WORKFLOW_TILES,
} from '../lib/landing-capability.js'
import { HERO_CARDS, SHOWCASE_CARDS, SHORTS_CARDS } from '../lib/landing-media.js'

const html = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')

test('roadmap sections stay off and gated ids exist in the markup', () => {
  assert.equal(ROADMAP_SECTIONS, false)
  assert.deepEqual(GATED_FEATURE_ROWS.map((r) => r.id), [
    'feat-ranking',
    'feat-faceless-studio',
    'feat-ads-gen',
    'feat-ugc-studio',
  ])
  for (const row of GATED_FEATURE_ROWS) {
    assert.ok(html.includes(`id="${row.id}"`), row.id)
    assert.ok(html.includes(`id="${row.id}" data-roadmap`), row.id + ' flag')
  }
  for (const id of LIVE_FEATURE_ROWS) {
    assert.ok(html.includes(`id="${id}"`), id)
    assert.ok(!html.includes(`id="${id}" data-roadmap`), id + ' must stay live')
  }
})

test('workflow tiles and studio tools come from live routes', () => {
  assert.equal(WORKFLOW_TILES.length, 8)
  assert.ok(WORKFLOW_TILES.every((t) => t.href.startsWith('/')))
  assert.ok(STUDIO_TOOLS.some((t) => t.id === 'videogen' && t.href === '/video-generation'))
  assert.ok(STUDIO_TOOLS.some((t) => t.id === 'mcp' && t.href === '/mcp'))
  assert.ok(!STUDIO_TOOLS.some((t) => t.id === 'facelessstudio'))
})

test('format and ugc placeholders use slug filenames', () => {
  assert.equal(FORMAT_CARDS.length, 9)
  assert.deepEqual(FORMAT_CARDS.map((c) => c.category), [
    'Long-form', 'Shorts', 'Ads', 'UGC', 'Explainers', 'Product videos', 'Talking head', 'Listicles', 'Documentary',
  ])
  assert.ok(FORMAT_CARDS.every((c) => c.src.endsWith('/format-card-' + c.slug + '.mp4')))
  assert.equal(SHORTS_CARDS, FORMAT_CARDS)
  assert.equal(UGC_CARDS.length, 4)
  assert.ok(PLACEHOLDER_FILES.studio.includes('studio-tool-videogen.jpg'))
  assert.ok(PLACEHOLDER_FILES.feats.includes('feat-longform.jpg'))
})

test('hero and showcase labels are no longer YouTube-only', () => {
  assert.deepEqual(HERO_CARDS.map((c) => c.label), [
    'Long-form', 'Short', 'Ad', 'UGC', 'Explainer', 'Product', 'Thumbnail', 'Voiceover',
  ])
  assert.deepEqual(SHOWCASE_CARDS.map((c) => c.category), ['DOCUMENTARY', 'AD', 'UGC', 'PRODUCT'])
  assert.ok(html.includes('Every kind of video'))
  assert.ok(html.includes('id="studio-tools"'))
  assert.ok(html.includes('id="ugc"'))
  assert.ok(html.includes('id="how"'))
  assert.ok(!html.includes('id="results-root"'))
  assert.ok(!html.includes('Channels that already print'))
  assert.ok(!html.includes('Featured on'))
  assert.ok(!html.includes('faceless channel automation'))
  assert.ok(!html.includes('—'))
})
