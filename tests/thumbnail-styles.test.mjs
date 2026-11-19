import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStylePrompt,
  detectThumbnailFormats,
  looksArtDirected,
  pickThumbnailStyles,
  THUMBNAIL_STYLES,
  thumbnailStyleById,
} from '../lib/thumbnail-styles.js'

test('fifteen styles, each with a full recipe', () => {
  assert.equal(THUMBNAIL_STYLES.length, 15)
  const ids = new Set()
  for (const s of THUMBNAIL_STYLES) {
    for (const k of ['id', 'name', 'look', 'concept', 'text', 'palette']) assert.ok(s[k], `${s.id} missing ${k}`)
    ids.add(s.id)
  }
  assert.equal(ids.size, 15)
})

test('topics pick the styles that broke out in their format', () => {
  const first = (t) => pickThumbnailStyles(t)[0]
  assert.equal(first('The lighthouse keepers who vanished'), 'found-footage')
  assert.equal(first('Psychology of Gen Z'), 'doodle')
  assert.equal(first('Stoic rules to stop caring'), 'marble-statue')
  assert.equal(first('Why nobody lives in this part of Australia'), 'map-graphic')
  assert.equal(first('Delta Force vs Navy SEALs'), 'lineup')
  assert.equal(first('My boss stole my idea'), 'storytime-comic')
  assert.equal(first('How the jet engine works'), 'object-hero')
  assert.equal(first("Why the Titanic's sister ship sank too"), 'doc-titlecard')
  assert.ok(detectThumbnailFormats('They hid $2 billion inside a mountain').includes('finance'))
})

test('every ranking has at least three styles and only real ids', () => {
  for (const t of ['', 'cats', 'The fall of Rome', 'How money works']) {
    const r = pickThumbnailStyles(t)
    assert.ok(r.length >= 3)
    for (const id of r) assert.ok(thumbnailStyleById(id), id)
  }
})

test('style prompt carries title, recipe and the no-repeat text rule', () => {
  const p = buildStylePrompt({ styleId: 'found-footage', title: 'The lighthouse keepers who vanished', hook: 'In December 1900, three men vanished.' })
  assert.match(p, /^YouTube thumbnail, 16:9, for a video titled "The lighthouse keepers who vanished"\./)
  assert.match(p, /Style: Found footage\./)
  assert.match(p, /must not reuse the main words of the title/)
  assert.match(p, /The video opens with: "In December 1900/)
  assert.match(p, /No real celebrities/)
  assert.match(buildStylePrompt({ styleId: 'nope', title: 'x' }), /Style: Documentary title card\./)
})

test('detailed prompts are left alone', () => {
  assert.equal(looksArtDirected('a cat'), false)
  assert.equal(looksArtDirected('close-up of a cat, rim light, 16:9'), true)
})
