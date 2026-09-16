import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CREATE_HREF, HERO_CARDS, HERO_VIDEO_SRC, HOW_PANEL_SRC, IDEA_CARDS, PROMPT_IDEAS, SHOWCASE_CARDS, THUMBNAIL_DEMO_SRC } from '../lib/landing-media.js'

const html = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')

test('hero video constant stays on R2', () => {
  assert.equal(HERO_VIDEO_SRC, 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/VidsoHeroVideo.mp4')
  assert.equal(CREATE_HREF, '/signup')
  assert.equal(THUMBNAIL_DEMO_SRC, '')
})

test('hero longs use R2 carousel clips and shorts stay blank', () => {
  assert.equal(HERO_CARDS.length, 10)
  const longs = HERO_CARDS.filter((c) => c.type === 'long')
  const shorts = HERO_CARDS.filter((c) => c.type === 'short')
  assert.equal(longs.length, 6)
  assert.equal(shorts.length, 4)
  assert.ok(longs.every((c) => /videocarousel\d+\.mp4$/.test(c.src)))
  assert.ok(shorts.every((c) => !c.src))
})

test('showcase cards use R2 clips and prompt ideas stay complete', () => {
  assert.ok(IDEA_CARDS.length >= 9)
  assert.equal(SHOWCASE_CARDS.length, 5)
  assert.ok(SHOWCASE_CARDS.every((c) => /videocarousel\d+\.mp4$/.test(c.src)))
  assert.equal(PROMPT_IDEAS.length, 10)
  assert.ok(PROMPT_IDEAS.every((s) => s.length > 8 && /[a-zA-Z]$/.test(s)))
  assert.match(HOW_PANEL_SRC, /videocarousel9\.mp4$/)
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
  assert.ok(html.includes('Make any YouTube video from a single idea'))
  assert.ok(!html.includes('Turn any idea into a video'))
  assert.ok(!html.includes('topo-bg'))
  assert.ok(!html.includes('demo-mute'))
  assert.ok(!html.includes('OpenArt'))
  assert.ok(!html.includes('10M+ creators'))
  assert.ok(!html.includes('Featured on'))
})
