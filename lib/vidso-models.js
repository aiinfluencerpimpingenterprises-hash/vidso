/** Public model catalog for the marketing site.
 * Only names that are wired in this repo and safe to show. */

import { IMAGE_MODELS } from './fal-image.js'
import { VIDEO_MODELS } from './fal-video.js'
import { LANDING_R2, R2 } from './landing-media.js'

export const MODELS_HREF = '/models'
export const MODELS_PROMO = LANDING_R2 + '/models-promo.jpg'
export const MODELS_HERO = LANDING_R2 + '/models-hero.jpg'
export const MODELS_HERO_VIDEO = R2 + '/' + encodeURIComponent('HERO SECTION VIDEO_720p.mp4')

/** Root-bucket clips uploaded with their original names. Only mapped when the filename names the model. */
export const CATALOG_CLIP_FILES = {
  'gemini-omni-flash': 'geminiomniflash.mp4',
  'nano-banana-2-5': 'nanobanana2.5.mp4',
  'kling-ai-video': 'klingaivideo.mp4',
  'gpt-image-2-5': 'gptimage2.5.mp4',
  'minimax-h3': 'minimaxh3.mp4',
  'kling-3-motion-control': 'kling3.0motioncontrol.mp4',
  'wan-3-0': 'wan3.0.mp4',
  'nano-banana-2-lite': 'nanobanana2lite.mp4',
  'sora-2': 'sora2update.mp4',
  'seedance-2-5': 'seedance2.5.mp4',
  'seedance-2': 'seedance2.0.mp4',
  'grok-imagine': 'grokimagine.mp4',
  'qwen-image-3-0': 'qwenimage3.0.mp4',
  'flux-3': 'flux3.mp4',
  'seedream-5-pro': 'seedream5.0pro.mp4',
  'veo-3': 'veo3.mp4',
  'hailuo': 'hailuo.mp4',
  'nano-banana-2': 'nanobanana2.mp4',
  'pixverse': 'pixverse.mp4',
  'happyhorse': 'happyhorse.mp4',
  'switchx': 'switchx.mp4',
  'ltx-2-3': 'ltx2.3.mp4',
  'gpt-image-2': 'gptimage2.mp4',
  'wan-2-7-image': 'wan2.7imagegen.mp4',
  'recraft-v4': 'recraftv4.mp4',
  'wan-2.7': 'wan2.7aivideogen.mp4',
}

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
  const slug = modelSlug(id)
  const named = CATALOG_CLIP_FILES[id] || CATALOG_CLIP_FILES[slug]
  if (named) return R2 + '/' + encodeURIComponent(named)
  return LANDING_R2 + '/model-card-' + slug + '.mp4'
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

/** Browse-page cards. OpenArt catalog first, then Vidso-only extras. Nav and footer stay on VIDSO_MODELS. */
export const CATALOG_MODELS = [
  {
    id: 'gemini-omni-flash',
    name: 'Gemini Omni Flash',
    group: 'video',
    blurb: 'Chat to create and edit 4K clips with Gemini Omni Flash 1.1. Fast, lower-cost video from image, text, and video references.',
    isNew: false,
  },
  {
    id: 'nano-banana-2-5',
    name: 'Nano Banana 2.5',
    group: 'image',
    blurb: 'Build photoreal stills with stable faces, tight prompt follow-through, and up to 4K output using Nano Banana 2.5.',
    isNew: false,
  },
  {
    id: 'kling-ai-video',
    name: 'Kling AI Video Generator',
    group: 'video',
    blurb: 'Shoot native 4K clips up to 15 seconds with first and last frame control, plus physics-true motion from Kling 3.0 and 3.0 Omni.',
    isNew: false,
  },
  {
    id: 'gpt-image-2-5',
    name: 'GPT Image 2.5',
    group: 'image',
    blurb: 'Generate stills with GPT Image 2.5. Use Flare for speed or Sunburst for max quality, with crisp on-image text and clean backgrounds.',
    isNew: false,
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    group: 'video',
    blurb: 'MiniMax H3 (Hailuo 3.0) makes 2K video with synced audio, up to 15 seconds per run, plus image, video, and audio references and edit-by-instruction.',
    isNew: false,
  },
  {
    id: 'kling-3-motion-control',
    name: 'Kling 3.0 Motion Control',
    group: 'video',
    blurb: 'Direct motion-controlled clips with Kling 3.0. Steer camera moves, subject paths, and dynamic shot design.',
    isNew: false,
  },
  {
    id: 'wan-3-0',
    name: 'Wan 3.0',
    group: 'video',
    blurb: 'Wan 3.0 outputs 1080p video with audio up to 30 seconds and holds character look across the clip.',
    isNew: false,
  },
  {
    id: 'nano-banana-2-lite',
    name: 'Nano Banana 2 Lite',
    group: 'image',
    blurb: 'Get fast, sharp stills from Nano Banana 2 Lite, with clean on-image text, multi-reference input, and precise edits.',
    isNew: false,
  },
  {
    id: 'sora-2',
    name: 'Sora 2 Update',
    group: 'video',
    blurb: 'Make longer clips with Sora 2 Update: up to 20 seconds, 1080p, and stable multi-character scenes.',
    isNew: false,
  },
  {
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    group: 'video',
    blurb: 'Seedance 2.5 makes 30-second 1080p clips with native audio, up to 50 references, and tighter prompt accuracy.',
    isNew: false,
  },
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    group: 'video',
    blurb: 'Create 4K clips with Seedance 2.0, a multi-modal video model that takes image, video, audio, and text inputs.',
    isNew: true,
  },
  {
    id: 'grok-imagine',
    name: 'Grok Imagine',
    group: 'video',
    blurb: 'Generate and edit stills with Grok Imagine Image 2.0, then go text-to-video, image-to-video, or reference-to-video at 1080p with synced audio.',
    isNew: false,
  },
  {
    id: 'qwen-image-3-0',
    name: 'Qwen Image 3.0',
    group: 'image',
    blurb: 'Qwen Image 3.0 is Alibaba\'s dense-layout image model, with 4,500-token prompts and text rendered down to 10px.',
    isNew: false,
  },
  {
    id: 'flux-3',
    name: 'FLUX 3',
    group: 'video',
    blurb: 'FLUX 3 generates video up to 20 seconds with native audio, animates stills, and edits backgrounds, characters, and styles.',
    isNew: false,
  },
  {
    id: 'seedream-5-pro',
    name: 'Seedream 5.0 Pro',
    group: 'image',
    blurb: 'Build layered, editable stills with Seedream 5.0 Pro. Region-grounded edits, dense infographic layouts, and native text in 14 languages.',
    isNew: true,
  },
  {
    id: 'veo-3',
    name: 'Veo 3',
    group: 'video',
    blurb: 'Make cinematic clips with synced audio using Veo 3. Native 4K, lifelike physics, and dialogue that stays locked to the picture.',
    isNew: false,
  },
  {
    id: 'hailuo',
    name: 'Hailuo',
    group: 'video',
    blurb: 'Make expressive cinematic clips with Hailuo. Native 1080p, lifelike physics, and fluid motion from a prompt or a still.',
    isNew: false,
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    group: 'image',
    blurb: 'Create fast, polished stills with Nano Banana 2 (Gemini 3.1 Flash Image), with stronger prompt reading and style control.',
    isNew: false,
  },
  {
    id: 'pixverse',
    name: 'PixVerse',
    group: 'video',
    blurb: 'Generate cinematic video and stills with PixVerse V6 and C1. Up to 15 second 1080p clips with native audio and 3D-style animation.',
    isNew: false,
  },
  {
    id: 'happyhorse',
    name: 'HappyHorse',
    group: 'video',
    blurb: 'Make cinematic clips with HappyHorse, with synced audio, realistic motion, and a fast iterate loop.',
    isNew: false,
  },
  {
    id: 'switchx',
    name: 'SwitchX',
    group: 'video',
    blurb: 'Swap video backgrounds, relight a scene, and edit selected regions while SwitchX keeps the original subject in place.',
    isNew: false,
  },
  {
    id: 'ltx-2-3',
    name: 'LTX-2.3',
    group: 'video',
    blurb: 'Generate up to 20 second 4K clips with LTX-2.3, with natural synced audio, precise motion, and a fast iterate loop.',
    isNew: false,
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    group: 'image',
    blurb: 'OpenAI\'s GPT Image 2 builds high-quality stills with accurate text, fast generation, and precise editing.',
    isNew: false,
  },
  {
    id: 'wan-2-7-image',
    name: 'Wan 2.7 Image',
    group: 'image',
    blurb: 'Generate and edit stills with Wan 2.7 Image, including thinking mode, 4K output, text rendering, and consistent image sets.',
    isNew: false,
  },
  {
    id: 'recraft-v4',
    name: 'Recraft V4',
    group: 'image',
    blurb: 'Create editable SVGs and type with Recraft V4. Logos, vectors, mockups, and brand assets with tight prompt follow-through.',
    isNew: false,
  },
  {
    id: 'wan-2.7',
    name: 'Wan 2.7',
    group: 'video',
    blurb: 'Create realistic clips with Wan 2.7. Use image, video, and audio references with precise motion control, editing, and multi-shot generation.',
    isNew: false,
  },
  {
    id: 'kling-3-pro',
    name: 'Kling 3.0 Pro',
    group: 'video',
    blurb: 'Generate cinematic AI footage for long-form B-roll with Kling 3.0 Pro, from 3 to 15 seconds, with start-frame control and native audio.',
    isNew: false,
  },
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    group: 'video',
    blurb: 'Generate 4 to 8 second AI footage with Veo 3.1, including up to 4K clips and synced audio for long-form B-roll.',
    isNew: false,
  },
  {
    id: 'hailuo-02',
    name: 'Hailuo 02',
    group: 'video',
    blurb: 'Generate 6 or 10 second 1080p footage clips with Hailuo 02, built for cinematic B-roll in long-form videos.',
    isNew: false,
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    group: 'image',
    blurb: 'Default Thumbnail Generator model. Builds 2K stills with strong on-image text and tight prompt follow-through.',
    isNew: false,
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    group: 'image',
    blurb: 'Faster Thumbnail Generator stills with strong on-image text, built for quick thumbnail passes.',
    isNew: false,
  },
  {
    id: 'flux-2-pro',
    name: 'FLUX.2 Pro',
    group: 'image',
    blurb: 'Photoreal thumbnail stills with FLUX.2 Pro. Accepts a reference image when you need a match.',
    isNew: false,
  },
  {
    id: 'flux-2-max',
    name: 'FLUX.2 Max',
    group: 'image',
    blurb: 'Highest-quality FLUX stills in the Thumbnail Generator, for detailed photoreal thumbnails.',
    isNew: false,
  },
  {
    id: 'seedream-4.5',
    name: 'Seedream 4.5',
    group: 'image',
    blurb: 'Cinematic stills in the Thumbnail Generator, with a film look from a short text prompt.',
    isNew: false,
  },
  {
    id: 'seedream-5-lite',
    name: 'Seedream 5.0 Lite',
    group: 'image',
    blurb: 'Faster Seedream 5 stills in the Thumbnail Generator, for quick thumbnail drafts at lower wait time.',
    isNew: false,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    group: 'voice',
    blurb: 'Narrates Long Form videos and AI Voiceover. Stability, similarity, style, and speed apply at generate time.',
    isNew: false,
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    group: 'voice',
    blurb: 'Transcribes captions and clip audio for Clipping and Ranking, so viral moments start from a clean transcript.',
    isNew: false,
  },
  {
    id: 'claude',
    name: 'Claude',
    group: 'script',
    blurb: 'Scores viral moments in Clipping and Ranking, ranking hooks so the best clips rise to the top.',
    isNew: false,
  },
]

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
  const slug = modelSlug(key)
  return CATALOG_MODELS.find((m) => m.id === key || modelSlug(m.id) === slug)
    || VIDSO_MODELS.find((m) => m.id === key || modelSlug(m.id) === slug)
    || null
}

export function modelHref(id) {
  return MODELS_HREF + '#' + modelSlug(id)
}

export const MODELS_PROMO_COPY = {
  caption: 'Explore the models behind Vidso',
  browse: 'Browse all models',
  secondaryLabel: 'Open Thumbnail Generator',
  secondaryHref: '/dashboard',
}

export const HERO_PROMPT_MODES = [
  { id: 'long', label: 'Long-form', href: '/dashboard', format: 'long' },
  { id: 'shorts', label: 'Shorts', href: '/dashboard', format: 'shorts' },
  { id: 'thumbnail', label: 'Thumbnail', href: '/dashboard' },
]

export function placeholderTable() {
  return [
    { file: 'models-promo.jpg', place: 'Models mega menu promo' },
    { file: 'models-hero.jpg', place: '/models hero still' },
    { file: 'HERO SECTION VIDEO_720p.mp4', place: '/models hero video · bucket root' },
    ...Object.entries(CATALOG_CLIP_FILES).map(([id, file]) => ({ file, place: '/models card clip · ' + id })),
    ...VIDSO_MODELS.map((m) => ({ file: 'model-tile-' + modelSlug(m.id) + '.jpg', place: 'Landing top-models tile · ' + m.name })),
    ...CATALOG_MODELS.map((m) => ({ file: 'model-card-' + modelSlug(m.id) + '.jpg', place: '/models grid card · ' + m.name })),
    ...CATALOG_MODELS.map((m) => ({ file: 'model-card-' + modelSlug(m.id) + '.mp4', place: '/models hover clip · ' + m.name })),
  ]
}
