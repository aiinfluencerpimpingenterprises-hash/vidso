import test from 'node:test'
import assert from 'node:assert/strict'
import { SETUP_STEPS, GENRES, genreById, fallbackChannel, setupQuestion, stylesForNiche, pickVoices, profileFromSetup } from '../lib/onboarding.js'
import { NICHES } from '../lib/niches.js'
import { visualStyleById } from '../lib/visual-styles.js'
import { normalizeProfile } from '../lib/channel-kit.js'

test('setup asks for the genre first, by name', () => {
  assert.deepEqual(SETUP_STEPS, ['genre', 'episode', 'style', 'voice', 'captions', 'video'])
  for (const s of SETUP_STEPS) assert.ok(setupQuestion(s).length > 20, s)
  assert.match(setupQuestion('genre', { name: 'Rishav' }), /^Hi Rishav! I'm the Manager.*genre/)
  assert.match(setupQuestion('episode', { niche: 'Physics Unlocked' }), /Physics Unlocked/)
  assert.match(setupQuestion('style', { niche: 'History' }), /History/)
})

test('each genre brings real styles, an angle and a caption look', () => {
  for (const g of GENRES) {
    assert.equal(g.styles.length, 6, g.id)
    for (const id of [...g.styles, g.image]) assert.ok(visualStyleById(id), `${g.id}: ${id}`)
    assert.ok(['explainer', 'story'].includes(g.angle))
  }
  assert.equal(genreById('history').name, 'History')
})

test('fallback channel name and topics come from what it is about', () => {
  const f = fallbackChannel({ about: 'Channel about physics' })
  assert.equal(f.name, 'Physics Explained')
  assert.equal(f.topics.length, 4)
  assert.deepEqual(fallbackChannel({ about: 'x', ideas: ['a', 'b', 'c', 'd', 'e'] }).topics, ['a', 'b', 'c', 'd'])
})

test('every niche gets six real styles', () => {
  for (const n of NICHES) {
    const ids = stylesForNiche(n.id)
    assert.equal(ids.length, 6, n.id)
    for (const id of ids) assert.ok(visualStyleById(id), `${n.id}: ${id}`)
  }
  assert.equal(stylesForNiche('custom').length, 6)
})

test('voices with a preview come first', () => {
  const v = [{ id: 'a' }, { id: 'b', preview: 'x' }, { id: 'c', preview: 'y' }]
  assert.deepEqual(pickVoices(v, 2).map((x) => x.id), ['b', 'c'])
})

test('genre and channel name flow into the profile', () => {
  const p = normalizeProfile(profileFromSetup({ genre: 'history', channelName: 'Rome Unrolled', style: 'oil' }, 'History'))
  assert.equal(p.name, 'Rome Unrolled')
  assert.equal(p.angle, 'story')
  assert.equal(p.captions, 'cinematic') // history channels default to the cinematic serif captions
})

test('answers become a brand profile', () => {
  const p = normalizeProfile(profileFromSetup({ niche: 'psychology', style: 'stick', voiceId: 'v1', voiceLabel: 'Roger', captions: 'bold', durationId: 'long_300', aspect: '9:16' }, 'Psychology'))
  assert.equal(p.name, 'Psychology channel')
  assert.equal(p.visualStyle, 'stick')
  assert.equal(p.voiceId, 'v1')
  assert.equal(p.captions, 'bold')
  assert.equal(p.durationId, 'long_300')
  assert.equal(p.aspect, '9:16')
  assert.equal(normalizeProfile(profileFromSetup({}, '')).name, 'My channel')
})

test('every genre has a cover image', async () => {
  const fs = await import('node:fs')
  for (const g of GENRES) assert.ok(fs.existsSync(new URL('../home/img/genres/' + g.id + '.jpg', import.meta.url)), g.id)
})
