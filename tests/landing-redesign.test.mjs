import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CREATE_HREF, HERO_CARDS, HERO_VIDEO_SRC, IDEA_CARDS, PROMPT_IDEAS, SHOWCASE_CARDS, THUMBNAIL_DEMO_SRC } from '../lib/landing-media.js'

const html = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')

test('hero video constant stays on R2', () => {
  assert.equal(HERO_VIDEO_SRC, 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/VidsoHeroVideo.mp4')
  assert.equal(CREATE_HREF, '/signup')
  assert.equal(THUMBNAIL_DEMO_SRC, '')
})

test('hero cards are placeholder-first with a 60/40 mix', () => {
  assert.equal(HERO_CARDS.length, 10)
  assert.ok(HERO_CARDS.every((c) => !c.src))
  const longs = HERO_CARDS.filter((c) => c.type === 'long').length
  const shorts = HERO_CARDS.filter((c) => c.type === 'short').length
  assert.equal(longs, 6)
  assert.equal(shorts, 4)
})

test('idea and showcase cards stay empty until R2 URLs are filled', () => {
  assert.ok(IDEA_CARDS.length >= 9)
  assert.ok(IDEA_CARDS.every((c) => !c.src))
  assert.equal(SHOWCASE_CARDS.length, 5)
  assert.ok(SHOWCASE_CARDS.every((c) => !c.src))
  assert.equal(PROMPT_IDEAS.length, 10)
})

test('landing keeps SEO, one H1, and nav anchors', () => {
  assert.match(html, /<meta name="description"/)
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1)
  for (const id of ['why-vidso', 'how', 'connect-claude', 'pricing', 'faq']) {
    assert.ok(html.includes(`id="${id}"`), id)
  }
  assert.ok(html.includes('Choose the plan for you.'))
  assert.ok(html.includes('What is Vidso?'))
  assert.ok(html.includes('Generate a Video Now'))
  assert.ok(!html.includes('OpenArt'))
  assert.ok(!html.includes('10M+ creators'))
  assert.ok(!html.includes('Featured on'))
})
