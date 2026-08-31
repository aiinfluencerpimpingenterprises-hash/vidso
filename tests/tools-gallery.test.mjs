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

test('every public tool has a topic so it can appear in the rail', () => {
  for (const tool of TOOL_GALLERY) {
    if (tool.id === 'facelessstudio') continue
    assert.ok((tool.topics || []).length, tool.id + ' needs topics')
  }
})
