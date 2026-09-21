/** Public model catalog for the marketing site.
 * Only names that are wired in this repo and safe to show. */

import { IMAGE_MODELS } from './fal-image.js'
import { VIDEO_MODELS } from './fal-video.js'
import { LANDING_R2, R2 } from './landing-media.js'

export const MODELS_HREF = '/models'
export const MODELS_PROMO = LANDING_R2 + '/models-promo.jpg'
export const MODELS_HERO = R2 + '/' + encodeURIComponent('c6d278eb-f6c7-4ae6-8d46-4e1bb406261a.png')
export const MODELS_HERO_VIDEO = R2 + '/' + encodeURIComponent('HERO SECTION VIDEO_720p.mp4')

/** Root-bucket clips uploaded with their original names. Only mapped when the filename names the model. */
export const CATALOG_CLIP_FILES = {
  'gemini-omni-flash': 'geminiomni_flash.mp4',
  'nano-banana-2-5': 'nanobanan2.5',
  'kling-ai-video': 'klingaivideo.mp4',
  'gpt-image-2-5': 'gptimage2.5',
  'minimax-h3': 'minimaxh3.mp4',
  'kling-3-motion-control': 'kling3.0motioncontrol',
  'wan-3-0': 'wan3.0',
  'nano-banana-2-lite': 'nanobanana2lite.mp4',
  'sora-2': 'sora2update.mp4',
  'seedance-2-5': 'seedance2.5',
  'seedance-2': 'seedance2.0',
  'grok-imagine': 'grokimagine.mp4',
  'qwen-image-3-0': 'qwenimage3.0',
  'flux-3': 'flux3.mp4',
  'seedream-5-pro': 'seedream5.0pro',
  'veo-3': 'veo3.mp4',
  'hailuo': 'hailuo.mp4',
  'nano-banana-2': 'nanobanana2.mp4',
  'pixverse': 'pixverse.mp4',
  'happyhorse': 'happyhorse.mp4',
  'switchx': 'switchx.mp4',
  'ltx-2-3': 'ltx2.3',
  'gpt-image-2': 'gptimage2.mp4',
  'wan-2-7-image': 'wan2.7image',
  'recraft-v4': 'recraftv4.mp4',
  'wan-2.7': 'wan2.7aivideogen',
  'kling-3-pro': 'klingaivideo.mp4',
  'veo-3.1': 'veo3.mp4',
  'hailuo-02': 'hailuo.mp4',
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

/** Play only this many seconds of the named clip, then loop from the start. */
export const CATALOG_CLIP_LOOP_SECONDS = {
  'seedream-5-pro': 5,
}

export function catalogClipLoopSeconds(id) {
  const slug = modelSlug(id)
  const n = Number(CATALOG_CLIP_LOOP_SECONDS[id] || CATALOG_CLIP_LOOP_SECONDS[slug] || 0)
  return n > 0 ? n : 0
}

export function bindCatalogClipLoop(video, seconds) {
  if (!video || !(seconds > 0)) return
  const play = () => {
    try {
      const p = video.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch (_) {}
  }
  const restart = () => {
    if (video.currentTime >= seconds) {
      try { video.currentTime = 0.05 } catch (_) {}
      play()
    }
  }
  video.addEventListener('timeupdate', restart)
  video.addEventListener('ended', () => {
    try { video.currentTime = 0 } catch (_) {}
    play()
  })
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

/** Browse-page cards. OpenArt catalog first, then Vidso-only extras. Nav stays on VIDSO_MODELS. */
export const CATALOG_MODELS = [
  {
    id: 'gemini-omni-flash',
    name: 'Gemini Omni Flash',
    group: 'video',
    blurb: 'Create and edit 4K clips from image, text, or video. Fast, lower-cost Gemini Omni Flash 1.1.',
  },
  {
    id: 'nano-banana-2-5',
    name: 'Nano Banana 2.5',
    group: 'image',
    blurb: 'Photoreal stills with stable faces, tight prompt follow-through, and up to 4K output.',
  },
  {
    id: 'kling-ai-video',
    name: 'Kling AI Video Generator',
    group: 'video',
    blurb: 'Native 4K clips up to 15 seconds with first and last frame control and physics-true motion.',
  },
  {
    id: 'gpt-image-2-5',
    name: 'GPT Image 2.5',
    group: 'image',
    blurb: 'Stills with Flare for speed or Sunburst for max quality. Crisp on-image text and clean backgrounds.',
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    group: 'video',
    blurb: '2K video with synced audio, up to 15 seconds, plus image, video, and audio references.',
  },
  {
    id: 'kling-3-motion-control',
    name: 'Kling 3.0 Motion Control',
    group: 'video',
    blurb: 'Motion-controlled clips. Steer camera moves, subject paths, and dynamic shot design.',
  },
  {
    id: 'wan-3-0',
    name: 'Wan 3.0',
    group: 'video',
    blurb: '1080p video with audio up to 30 seconds, and character look held across the clip.',
  },
  {
    id: 'nano-banana-2-lite',
    name: 'Nano Banana 2 Lite',
    group: 'image',
    blurb: 'Fast, sharp stills with clean on-image text, multi-reference input, and precise edits.',
  },
  {
    id: 'sora-2',
    name: 'Sora 2 Update',
    group: 'video',
    blurb: 'Clips up to 20 seconds at 1080p, with stable multi-character scenes and synced audio.',
  },
  {
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    group: 'video',
    blurb: '30-second 1080p clips with native audio, up to 50 references, and tighter prompt accuracy.',
  },
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    group: 'video',
    blurb: '4K multi-modal clips from image, video, audio, and text inputs, with native audio.',
  },
  {
    id: 'grok-imagine',
    name: 'Grok Imagine',
    group: 'video',
    blurb: 'Stills plus text-to-video, image-to-video, or reference-to-video at 1080p with synced audio.',
  },
  {
    id: 'qwen-image-3-0',
    name: 'Qwen Image 3.0',
    group: 'image',
    blurb: 'Dense-layout stills with 4,500-token prompts and on-image text rendered down to 10px.',
  },
  {
    id: 'flux-3',
    name: 'FLUX 3',
    group: 'video',
    blurb: 'Video up to 20 seconds with native audio. Animate stills and edit backgrounds, characters, and styles.',
  },
  {
    id: 'seedream-5-pro',
    name: 'Seedream 5.0 Pro',
    group: 'image',
    blurb: 'Layered, editable stills with region-grounded edits, dense layouts, and native text in 14 languages.',
  },
  {
    id: 'veo-3',
    name: 'Veo 3',
    group: 'video',
    blurb: 'Cinematic 4K clips with synced audio, lifelike physics, and dialogue locked to the picture.',
  },
  {
    id: 'hailuo',
    name: 'Hailuo',
    group: 'video',
    blurb: 'Expressive 1080p cinematic clips with lifelike physics, from a prompt or a still.',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    group: 'image',
    blurb: 'Fast, polished stills with stronger prompt reading and style control (Gemini 3.1 Flash Image).',
  },
  {
    id: 'pixverse',
    name: 'PixVerse',
    group: 'video',
    blurb: 'Cinematic video and stills. Up to 15 second 1080p clips with native audio and 3D-style animation.',
  },
  {
    id: 'happyhorse',
    name: 'HappyHorse',
    group: 'video',
    blurb: 'Cinematic clips with synced audio, realistic motion, and a fast iterate loop.',
  },
  {
    id: 'switchx',
    name: 'SwitchX',
    group: 'video',
    blurb: 'Swap backgrounds, relight a scene, and edit regions while the original subject stays in place.',
  },
  {
    id: 'ltx-2-3',
    name: 'LTX-2.3',
    group: 'video',
    blurb: 'Up to 20 second 4K clips with natural synced audio, precise motion, and a fast iterate loop.',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    group: 'image',
    blurb: 'High-quality stills with accurate on-image text, fast generation, and precise editing.',
  },
  {
    id: 'wan-2-7-image',
    name: 'Wan 2.7 Image',
    group: 'image',
    blurb: 'Generate and edit stills with thinking mode, 4K output, text rendering, and consistent image sets.',
  },
  {
    id: 'recraft-v4',
    name: 'Recraft V4',
    group: 'image',
    blurb: 'Editable SVGs and type for logos, vectors, mockups, and brand assets with tight prompt follow-through.',
  },
  {
    id: 'wan-2.7',
    name: 'Wan 2.7',
    group: 'video',
    blurb: 'Realistic clips from image, video, and audio references, with motion control and multi-shot generation.',
  },
  {
    id: 'kling-3-pro',
    name: 'Kling 3.0 Pro',
    group: 'video',
    blurb: 'Cinematic B-roll from 3 to 15 seconds, with start-frame control and native audio.',
  },
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    group: 'video',
    blurb: '4 to 8 second AI footage, including up to 4K clips with synced audio for long-form B-roll.',
  },
  {
    id: 'hailuo-02',
    name: 'Hailuo 02',
    group: 'video',
    blurb: '6 or 10 second 1080p footage clips, built for cinematic B-roll in long-form videos.',
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    group: 'image',
    blurb: 'Default Thumbnail Generator model. 2K stills with strong on-image text and tight prompt follow-through.',
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    group: 'image',
    blurb: 'Faster Thumbnail Generator stills with strong on-image text, for quick thumbnail passes.',
  },
  {
    id: 'flux-2-pro',
    name: 'FLUX.2 Pro',
    group: 'image',
    blurb: 'Photoreal thumbnail stills. Accepts a reference image when you need a match.',
  },
  {
    id: 'flux-2-max',
    name: 'FLUX.2 Max',
    group: 'image',
    blurb: 'Highest-quality FLUX stills in the Thumbnail Generator, for detailed photoreal thumbnails.',
  },
  {
    id: 'seedream-4.5',
    name: 'Seedream 4.5',
    group: 'image',
    blurb: 'Cinematic Thumbnail Generator stills with a film look from a short text prompt.',
  },
  {
    id: 'seedream-5-lite',
    name: 'Seedream 5.0 Lite',
    group: 'image',
    blurb: 'Faster Seedream 5 stills in the Thumbnail Generator, for quick drafts at lower wait time.',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    group: 'voice',
    blurb: 'Narrates Long Form videos and AI Voiceover. Stability, similarity, style, and speed apply at generate time.',
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    group: 'voice',
    blurb: 'Transcribes captions and clip audio for Clipping and Ranking so viral moments start from a clean transcript.',
  },
  {
    id: 'claude',
    name: 'Claude',
    group: 'script',
    blurb: 'Scores viral moments in Clipping and Ranking so the best hooks rise to the top.',
  },
]

/** MCP "latest models" strip. Same order as OpenArt's MCP page, mapped to CATALOG_MODELS ids. */
export const MCP_LATEST_MODEL_IDS = [
  'seedance-2-5',
  'seedance-2',
  'minimax-h3',
  'gemini-omni-flash',
  'wan-3-0',
  'veo-3.1',
  'pixverse',
  'kling-3-pro',
  'gpt-image-2-5',
  'nano-banana-2-lite',
  'seedream-5-pro',
  'wan-2-7-image',
  'grok-imagine',
]

export function mcpLatestModels() {
  return MCP_LATEST_MODEL_IDS.map((id) => CATALOG_MODELS.find((m) => m.id === id)).filter(Boolean)
}

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
    { file: 'c6d278eb-f6c7-4ae6-8d46-4e1bb406261a.png', place: '/models hero backdrop' },
    { file: 'HERO SECTION VIDEO_720p.mp4', place: '/models hero video · bucket root' },
    ...Object.entries(CATALOG_CLIP_FILES).map(([id, file]) => ({ file, place: '/models card clip · ' + id })),
    ...VIDSO_MODELS.map((m) => ({ file: 'model-tile-' + modelSlug(m.id) + '.jpg', place: 'Landing top-models tile · ' + m.name })),
    ...CATALOG_MODELS.map((m) => ({ file: 'model-card-' + modelSlug(m.id) + '.jpg', place: '/models grid card · ' + m.name })),
    ...CATALOG_MODELS.map((m) => ({ file: 'model-card-' + modelSlug(m.id) + '.mp4', place: '/models and /mcp card clip · ' + m.name })),
  ]
}
