import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IMAGE_MODELS } from '../lib/fal-image.js'
import { VIDEO_MODELS } from '../lib/fal-video.js'
import {
  EXCLUDED_MODELS,
  HERO_PROMPT_MODES,
  MODELS_HERO,
  MODELS_HREF,
  MODELS_PROMO,
  MODELS_PROMO_COPY,
  MODEL_GROUPS,
  CATALOG_CLIP_FILES,
  CATALOG_MODELS,
  MODELS_HERO_VIDEO,
  VIDSO_MODELS,
  featuredModels,
  modelCardClipSrc,
  modelCardSrc,
  modelHref,
  modelSlug,
  modelTileSrc,
  placeholderTable,
} from '../lib/vidso-models.js'
import { footerInnerHtml } from '../lib/landing-footer.js'

const home = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')
const modelsPage = readFileSync(new URL('../models/index.html', import.meta.url), 'utf8')
const menuJs = readFileSync(new URL('../lib/landing-tools-menu.js', import.meta.url), 'utf8')
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../scripts/local-preview.mjs', import.meta.url), 'utf8')

test('public catalog is only wired models with display names', () => {
  const names = VIDSO_MODELS.map((m) => m.name)
  for (const m of IMAGE_MODELS) assert.ok(names.includes(m.name), m.name)
  for (const m of VIDEO_MODELS) assert.ok(names.includes(m.name), m.name)
  assert.ok(names.includes('ElevenLabs'))
  assert.ok(names.includes('AssemblyAI'))
  assert.ok(names.includes('Claude'))
  assert.ok(!names.includes('Fal'))
  assert.ok(!names.includes('Pexels'))
  assert.ok(!names.includes('ChatGPT'))
  assert.ok(EXCLUDED_MODELS.some((m) => m.name === 'Fal'))
  assert.ok(EXCLUDED_MODELS.some((m) => /script LLM/.test(m.name)))
  assert.equal(MODEL_GROUPS.length, 4)
  assert.ok(VIDSO_MODELS.every((m) => m.blurb && !m.blurb.includes('—') && !m.blurb.includes('–')))
  assert.ok(VIDSO_MODELS.every((m) => m.source))
})

test('browse catalog lists OpenArt models plus Vidso extras with paraphrased blurbs', () => {
  const names = CATALOG_MODELS.map((m) => m.name)
  for (const name of [
    'Gemini Omni Flash', 'Nano Banana 2.5', 'Kling AI Video Generator', 'GPT Image 2.5',
    'MiniMax H3', 'Kling 3.0 Motion Control', 'Wan 3.0', 'Nano Banana 2 Lite',
    'Sora 2 Update', 'Seedance 2.5', 'Seedance 2.0', 'Grok Imagine', 'Qwen Image 3.0',
    'FLUX 3', 'Seedream 5.0 Pro', 'Veo 3', 'Hailuo', 'Nano Banana 2', 'PixVerse',
    'HappyHorse', 'SwitchX', 'LTX-2.3', 'GPT Image 2', 'Wan 2.7 Image', 'Recraft V4',
    'Wan 2.7', 'Kling 3.0 Pro', 'Veo 3.1', 'Hailuo 02', 'Nano Banana Pro', 'ElevenLabs',
    'AssemblyAI', 'Claude',
  ]) {
    assert.ok(names.includes(name), name)
  }
  const slugs = CATALOG_MODELS.map((m) => modelSlug(m.id))
  assert.equal(new Set(slugs).size, slugs.length)
  assert.ok(CATALOG_MODELS.every((m) => m.blurb && m.blurb.length >= 70))
  assert.ok(CATALOG_MODELS.every((m) => !m.blurb.includes('—') && !m.blurb.includes('–') && !m.blurb.includes('OpenArt')))
  assert.ok(placeholderTable().some((p) => p.file === 'model-card-gemini-omni-flash.jpg'))
})

test('placeholders and featured tiles stay on landing R2', () => {
  assert.equal(MODELS_HREF, '/models')
  assert.match(MODELS_PROMO, /\/landing\/models-promo\.jpg$/)
  assert.match(MODELS_HERO, /\/landing\/models-hero\.jpg$/)
  assert.match(modelTileSrc('veo-3.1'), /model-tile-veo-3-1\.jpg$/)
  assert.match(modelCardSrc('seedream-4.5'), /model-card-seedream-4-5\.jpg$/)
  assert.match(modelCardClipSrc('gemini-omni-flash'), /Gemini%20Omni%20Video_720p\.mp4$/)
  assert.match(MODELS_HERO_VIDEO, /HERO%20SECTION%20VIDEO_720p\.mp4$/)
  assert.equal(CATALOG_CLIP_FILES['seedance-2-5'], 'Seedance 2.5_720p.mp4')
  assert.equal(modelHref('kling-3-pro'), '/models#kling-3-pro')
  assert.equal(modelSlug('veo-3.1'), 'veo-3-1')
  const files = placeholderTable().map((p) => p.file)
  assert.ok(files.includes('models-promo.jpg'))
  assert.ok(files.includes('model-tile-nano-banana-pro.jpg'))
  assert.ok(featuredModels().length >= 8)
})

test('hero modes and models nav are wired', () => {
  assert.deepEqual(HERO_PROMPT_MODES.map((m) => m.label), ['Long-form', 'Shorts', 'Thumbnail'])
  assert.match(menuJs, /nav-\$\{item\.id\}-btn/)
  assert.match(menuJs, /MODELS_NAV_PROMO/)
  assert.equal(MODELS_PROMO_COPY.browse, 'Browse all models')
  assert.equal(MODELS_PROMO_COPY.secondaryLabel, 'Open Thumbnail Generator')
  assert.ok(home.includes('Make any video'))
  assert.ok(home.includes('id="top-models"'))
  assert.ok(home.includes('id="hero-prompt-mode"'))
  assert.ok(modelsPage.includes('Vidso Models'))
  assert.ok(modelsPage.includes('Explore the latest'))
  assert.ok(modelsPage.includes('Start for Free'))
  assert.ok(modelsPage.includes('id="models-grid"'))
  assert.ok(!modelsPage.includes('final-box'))
  assert.match(vercel, /"source": "\/models"/)
  assert.match(preview, /\/models/)
})

test('footer lists start creating, models, features, resources, and company', () => {
  const html = footerInnerHtml()
  assert.match(html, /Create videos with AI/)
  assert.match(html, />Start Creating</)
  assert.match(html, />AI Models</)
  assert.match(html, />Features</)
  assert.match(html, />Resources</)
  assert.match(html, />Company</)
  assert.match(html, /Ranking/)
  assert.match(html, /Video Editor/)
  assert.match(html, /Tutorials/)
  assert.match(html, /Kling 3.0 Pro/)
  assert.match(html, /Gemini Omni Flash/)
  assert.match(html, /PixVerse/)
  assert.match(html, /ElevenLabs/)
  assert.match(html, /href="\/models#kling-3-pro"/)
  assert.ok(!html.includes('—'))
})
