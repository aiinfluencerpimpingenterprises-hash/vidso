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
  VIDSO_MODELS,
  featuredModels,
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

test('placeholders and featured tiles stay on landing R2', () => {
  assert.equal(MODELS_HREF, '/models')
  assert.match(MODELS_PROMO, /\/landing\/models-promo\.jpg$/)
  assert.match(MODELS_HERO, /\/landing\/models-hero\.jpg$/)
  assert.match(modelTileSrc('veo-3.1'), /model-tile-veo-3-1\.jpg$/)
  assert.match(modelCardSrc('seedream-4.5'), /model-card-seedream-4-5\.jpg$/)
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
  assert.ok(modelsPage.includes('id="models-grid"'))
  assert.match(vercel, /"source": "\/models"/)
  assert.match(preview, /\/models/)
})

test('footer lists product, models, resources, account, and legal', () => {
  const html = footerInnerHtml()
  assert.match(html, /Create videos with AI/)
  assert.match(html, />Product</)
  assert.match(html, />Models</)
  assert.match(html, />Resources</)
  assert.match(html, />Account</)
  assert.match(html, />Legal</)
  assert.match(html, /Ranking/)
  assert.match(html, /Video Editor/)
  assert.match(html, /Tutorials/)
  assert.match(html, /Kling 3.0 Pro/)
  assert.match(html, /href="\/models#kling-3-pro"/)
  assert.ok(!html.includes('—'))
})
