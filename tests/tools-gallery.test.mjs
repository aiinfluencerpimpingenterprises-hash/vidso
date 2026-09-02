import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CREATIVE_FILTERS, toolsForFilter, TOOL_GALLERY } from '../lib/tools-gallery.js'

test('creative filters match the dashboard rail', () => {
  assert.deepEqual(CREATIVE_FILTERS.map((f) => f.id), [
    'all', 'video', 'images', 'audio', 'utilities', 'shorts', 'scripts',
  ])
})

test('All lists live tools and hides archived Faceless Studio', () => {
  const ids = toolsForFilter('all').map((t) => t.id)
  assert.ok(ids.includes('videogen'))
  assert.ok(ids.includes('imagegen'))
  assert.equal(ids.includes('facelessstudio'), false)
})

test('topic filters only return matching tools', () => {
  assert.deepEqual(toolsForFilter('images').map((t) => t.id), ['imagegen'])
  assert.ok(toolsForFilter('video').every((t) => t.topics.includes('video')))
  assert.ok(toolsForFilter('scripts').some((t) => t.id === 'videogen'))
})

test('dashboard cards use the Cloudflare tool shots except AI Captions', () => {
  const byId = Object.fromEntries(TOOL_GALLERY.map((t) => [t.id, t.image]))
  assert.match(byId.videogen, /01_Long_Form_Generator\.png$/)
  assert.match(byId.imagegen, /02_Thumbnail_Generator\.png$/)
  assert.match(byId.clipper, /03_Clipping\.png$/)
  assert.match(byId.ranking, /04_Ranking\.png$/)
  assert.match(byId.voiceover, /05_AI_Voiceover\.png$/)
  assert.match(byId.reframe, /06_AI_Reframe\.png$/)
  assert.match(byId.editor, /07_Video_Editor\.png$/)
  assert.match(byId.downloader, /08_Video_Downloader\.png$/)
  assert.match(byId.commentary, /09_Video_Commentary\.png$/)
  assert.match(byId.files, /10_My_Files\.png$/)
  assert.match(byId.captions, /Script\.png$/)
})

test('every public tool has a topic so it can appear in the rail', () => {
  for (const tool of TOOL_GALLERY) {
    if (tool.id === 'facelessstudio') continue
    assert.ok((tool.topics || []).length, tool.id + ' needs topics')
  }
})
