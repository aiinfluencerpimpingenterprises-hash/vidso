/** Public model catalog for the marketing site.
 * Only names that are wired in this repo and safe to show. */

import { IMAGE_MODELS } from './fal-image.js'
import { VIDEO_MODELS } from './fal-video.js'
import { LANDING_R2 } from './landing-media.js'

export const MODELS_HREF = '/models'
export const MODELS_PROMO = LANDING_R2 + '/models-promo.jpg'
export const MODELS_HERO = LANDING_R2 + '/models-hero.jpg'

export function modelSlug(id) {
  return String(id || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function modelTileSrc(id) {
  return LANDING_R2 + '/model-tile-' + modelSlug(id) + '.jpg'
}

export function modelCardSrc(id) {
  return LANDING_R2 + '/model-card-' + modelSlug(id) + '.jpg'
}

export function modelCardClipSrc(id) {
  return LANDING_R2 + '/model-card-' + modelSlug(id) + '.mp4'
}

/** Wired in code, but not listed on the public models page. */
export const EXCLUDED_MODELS = [
  { name: 'Fal', reason: 'Gateway SDK, not a public model name', file: 'lib/fal-image.js, lib/fal-video.js' },
  { name: 'Pexels / Stock footage', reason: 'Stock library, not an AI model', file: 'lib/fal-video.js STOCK_VIDEO_MODEL, lib/studio-shell.js' },
  { name: 'YouTube B-roll', reason: 'Source library, not an AI model', file: 'dashboard/index.html fvAttachYoutubeBroll' },
  { name: 'Long Form script LLM', reason: 'Railway POST /api/faceless/script does not name a model in this repo', file: 'lib/gate-run.js, lib/vidso-mcp.js' },
  { name: 'ChatGPT / Cursor / Kimi', reason: 'MCP clients, not generation models', file: 'lib/landing-media.js MCP_AGENT_LOGOS' },
]

export const MODEL_GROUPS = [
  { id: 'video', label: 'Video and footage', nav: 'Video and footage' },
  { id: 'image', label: 'Image and thumbnails', nav: 'Image and thumbnails' },
  { id: 'voice', label: 'Voice and audio', nav: 'Voice and audio' },
  { id: 'script', label: 'Script', nav: 'Script' },
]

const IMAGE_BLURB = {
  'nano-banana-pro': 'Default Thumbnail Generator model. Builds 2K stills with strong on-image text.',
  'nano-banana': 'Faster Thumbnail Generator stills with strong on-image text.',
  'flux-2-pro': 'Photoreal thumbnail stills. Accepts a reference image when you need a match.',
  'flux-2-max': 'Highest-quality FLUX stills in the Thumbnail Generator.',
  'gpt-image-2': 'Instruction-following thumbnail stills from a text prompt.',
  'seedream-4.5': 'Cinematic stills in the Thumbnail Generator.',
  'seedream-5-lite': 'Faster Seedream 5 stills in the Thumbnail Generator.',
  'seedream-5-pro': 'Latest Seedream stills in the Thumbnail Generator.',
}

const IMAGE_SOURCE = {
  'nano-banana-pro': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'nano-banana': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'flux-2-pro': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'flux-2-max': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'gpt-image-2': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'seedream-4.5': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'seedream-5-lite': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js',
  'seedream-5-pro': 'lib/fal-image.js IMAGE_MODELS, lib/image-workspace.js, lib/landing-media.js LANDING_ANNOUNCE',
}

const VIDEO_BLURB = {
  'kling-3-pro': 'Generates cinematic AI footage for long-form B-roll, 3 to 15 seconds.',
  'veo-3.1': 'Generates 4 to 8 second AI footage, including up to 4K clips.',
  'seedance-2': 'Generates 4 to 15 second AI footage with native audio.',
  'wan-2.7': 'Generates short 5 second scene clips for B-roll.',
  'sora-2': 'Generates detailed AI clips with audio, 4 to 12 seconds.',
  'hailuo-02': 'Generates 6 or 10 second 1080p footage clips.',
}

const VIDEO_SOURCE = 'lib/fal-video.js VIDEO_MODELS, dashboard/index.html fvApplyFalBroll'

const EXTRA_MODELS = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    provider: 'ElevenLabs',
    group: 'voice',
    powers: 'Voiceover and Long Form narration',
    blurb: 'Narrates Long Form videos and AI Voiceover. Stability, similarity, style, and speed apply at generate time.',
    source: 'lib/voice-settings.js, dashboard/index.html, lib/vidso-mcp.js vidso_voices',
    isNew: false,
    featured: true,
    slot: 9,
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    provider: 'AssemblyAI',
    group: 'voice',
    powers: 'Captions and clipping transcription',
    blurb: 'Transcribes captions and clip audio for Clipping and Ranking.',
    source: 'dashboard/index.html Find Viral Moments comment, /api/transcribe via lib/vidso-mcp.js captions_transcribe',
    isNew: false,
    featured: false,
    slot: 0,
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    group: 'script',
    powers: 'Clip scoring in Clipping and Ranking',
    blurb: 'Scores viral moments in Clipping and Ranking.',
    source: 'dashboard/index.html Claude scoring prompt, Find Viral Moments comment',
    isNew: false,
    featured: true,
    slot: 10,
  },
]

const IMAGE_FEATURED = {
  'nano-banana-pro': 6,
  'gpt-image-2': 7,
  'seedream-5-pro': 8,
  'flux-2-pro': 11,
}

const VIDEO_FEATURED = {
  'kling-3-pro': 1,
  'veo-3.1': 2,
  'seedance-2': 3,
  'sora-2': 4,
  'hailuo-02': 5,
}

const NEW_IDS = new Set(['seedream-5-pro', 'seedance-2'])

function imageModels() {
  return IMAGE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.group,
    group: 'image',
    powers: 'Thumbnail Generator stills',
    blurb: IMAGE_BLURB[m.id] || m.hint,
    source: IMAGE_SOURCE[m.id] || 'lib/fal-image.js IMAGE_MODELS',
    isNew: NEW_IDS.has(m.id),
    featured: IMAGE_FEATURED[m.id] > 0,
    slot: IMAGE_FEATURED[m.id] || 0,
    hint: m.hint,
  }))
}

function videoModels() {
  return VIDEO_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.group,
    group: 'video',
    powers: 'AI footage and long-form B-roll',
    blurb: VIDEO_BLURB[m.id] || m.blurb || m.hint,
    source: VIDEO_SOURCE,
    isNew: NEW_IDS.has(m.id),
    featured: VIDEO_FEATURED[m.id] > 0,
    slot: VIDEO_FEATURED[m.id] || 0,
    hint: m.hint,
  }))
}

export const VIDSO_MODELS = [...videoModels(), ...imageModels(), ...EXTRA_MODELS]

export const MODEL_FILTERS = [
  { id: 'all', label: 'All' },
  ...MODEL_GROUPS.map((g) => ({ id: g.id, label: g.label })),
]

export function modelsByGroup(groupId) {
  return VIDSO_MODELS.filter((m) => m.group === groupId)
}

export function featuredModels() {
  return VIDSO_MODELS.filter((m) => m.featured).sort((a, b) => a.slot - b.slot)
}

export function modelById(id) {
  const key = String(id || '').trim()
  return VIDSO_MODELS.find((m) => m.id === key || modelSlug(m.id) === modelSlug(key)) || null
}

export function modelHref(id) {
  return MODELS_HREF + '#' + modelSlug(id)
}

export const MODELS_PROMO_COPY = {
  caption: 'Explore the models behind Vidso',
  browse: 'Browse all models',
  secondaryLabel: 'Open Thumbnail Generator',
  secondaryHref: '/image-generation',
}

export const HERO_PROMPT_MODES = [
  { id: 'long', label: 'Long-form', href: '/video-generation', format: 'long' },
  { id: 'shorts', label: 'Shorts', href: '/video-generation', format: 'shorts' },
  { id: 'thumbnail', label: 'Thumbnail', href: '/image-generation' },
]

export function placeholderTable() {
  return [
    { file: 'models-promo.jpg', place: 'Models mega menu promo' },
    { file: 'models-hero.jpg', place: '/models hero banner' },
    ...VIDSO_MODELS.map((m) => ({ file: 'model-tile-' + modelSlug(m.id) + '.jpg', place: 'Landing top-models tile · ' + m.name })),
    ...VIDSO_MODELS.map((m) => ({ file: 'model-card-' + modelSlug(m.id) + '.jpg', place: '/models grid card · ' + m.name })),
    ...VIDSO_MODELS.map((m) => ({ file: 'model-card-' + modelSlug(m.id) + '.mp4', place: '/models hover clip · ' + m.name })),
  ]
}
