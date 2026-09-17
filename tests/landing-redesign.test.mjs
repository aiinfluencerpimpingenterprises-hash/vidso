import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CREATE_HREF, HERO_CARDS, HERO_TRANSITION, HERO_VIDEO_SRC, HOW_PANEL_SRC, SHORTS_CARDS, SHORTS_PROMPTS, SHOWCASE_CARDS, THUMBNAIL_DEMO_SRC, landingPoster, landingVideo } from '../lib/landing-media.js'

const html = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')

test('hero video constant stays on R2', () => {
  assert.equal(HERO_VIDEO_SRC, 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/VidsoHeroVideo.mp4')
  assert.equal(CREATE_HREF, '/signup')
  assert.equal(THUMBNAIL_DEMO_SRC, '')
})

test('hero cards use landing placeholder URLs and keep a long/short mix', () => {
  assert.ok(HERO_CARDS.length >= 8)
  assert.ok(HERO_CARDS.every((c) => c.src && c.poster && c.file))
  const longs = HERO_CARDS.filter((c) => c.type === 'long')
  const shorts = HERO_CARDS.filter((c) => c.type === 'short')
  assert.ok(longs.length >= 5)
  assert.ok(shorts.length >= 3)
  assert.ok(HERO_CARDS.every((c) => /\/landing\/hero-card-\d\d\.mp4$/.test(c.src)))
  assert.ok(HERO_CARDS.every((c) => /\/landing\/hero-card-\d\d\.jpg$/.test(c.poster)))
  assert.equal(landingVideo('hero-card', 1), HERO_CARDS[0].src)
  assert.equal(landingPoster('hero-card', 1), HERO_CARDS[0].poster)
})

test('showcase is long-form only and shorts cards stay blank-ready', () => {
  assert.ok(SHORTS_CARDS.length >= 9)
  assert.ok(SHORTS_CARDS.every((c) => c.src && c.poster && c.category))
  assert.ok(SHORTS_CARDS.every((c) => /\/landing\/shorts-card-\d\d\.mp4$/.test(c.src)))
  assert.ok(SHOWCASE_CARDS.length >= 4)
  assert.ok(SHOWCASE_CARDS.every((c) => /videocarousel\d+\.mp4$/.test(c.src)))
  assert.ok(SHOWCASE_CARDS.every((c) => c.prompt && c.prompt.length > 12))
  assert.ok(SHOWCASE_CARDS.every((c) => c.category !== 'SHORT'))
  assert.equal(SHOWCASE_CARDS[0].category, 'DOCUMENTARY')
  assert.equal(SHORTS_PROMPTS.length, 8)
  assert.ok(SHORTS_PROMPTS.every((s) => s.length > 8 && /[a-zA-Z]$/.test(s)))
  assert.equal(HOW_PANEL_SRC, '')
})

test('hero transition timing stays in range', () => {
  assert.equal(HERO_TRANSITION.pinVh, 240)
  assert.equal(HERO_TRANSITION.pinVhMobile, 160)
  assert.ok(HERO_TRANSITION.aEnd < HERO_TRANSITION.bEnd)
  assert.ok(HERO_TRANSITION.bEnd < HERO_TRANSITION.cEnd)
  assert.ok(HERO_TRANSITION.cEnd < 1)
})

test('landing keeps SEO, one H1, and nav anchors', () => {
  assert.match(html, /<meta name="description"/)
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1)
  for (const id of ['why-vidso', 'how', 'connect-claude', 'pricing', 'faq', 'ideas']) {
    assert.ok(html.includes(`id="${id}"`), id)
  }
  assert.ok(html.includes('Choose the plan for you.'))
  assert.ok(html.includes('What is Vidso?'))
  assert.ok(html.includes('Generate a Video Now'))
  assert.match(html, /Make any YouTube video[\s\S]{0,80}from a single idea/)
  assert.ok(html.includes('Your faceless YouTube'))
  assert.ok(html.includes('empire starts here'))
  assert.ok(!html.includes('Script to final cut'))
  assert.ok(html.includes('id="hero-pin"'))
  assert.ok(!html.includes('Turn any idea into a video'))
  assert.ok(html.includes('Shorts from the same idea'))
  assert.ok(html.includes('Long-form'))
  assert.ok(html.includes('Does Vidso support Shorts?'))
  assert.ok(html.includes('Vidso MCP'))
  assert.ok(html.includes('Run your YouTube workflow from Claude'))
  assert.ok(html.includes('Works with Claude'))
  assert.ok(html.includes('https://www.vidso.pro/mcp'))
  assert.ok(!html.includes('Claude AI video generator'))
  assert.ok(!html.includes('id="connect-stack"'))
  assert.ok(!html.includes('ChatGPT'))
  assert.ok(!html.includes('Kimi'))
  assert.ok(!html.includes('&amp; CLI'))
  assert.ok(!html.includes('class="h1-swoosh"'))
  assert.ok(!html.includes('coming soon'))
  assert.ok(!html.includes('topo-bg'))
  assert.ok(!html.includes('demo-mute'))
  assert.ok(!html.includes('OpenArt'))
  assert.ok(!html.includes('10M+ creators'))
  assert.ok(!html.includes('Featured on'))
})
