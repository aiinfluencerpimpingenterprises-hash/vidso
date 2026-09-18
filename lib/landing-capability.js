/** Live-tool landing config. Sections for tools we do not ship stay behind ROADMAP_SECTIONS. */

import { TOOL_MENU_ITEMS } from './public-tools.js'

const LANDING_R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/landing'

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Off: gated rows stay in the DOM but never render. */
export const ROADMAP_SECTIONS = false

export function applyRoadmapSections(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return
  root.querySelectorAll('[data-roadmap]').forEach((el) => {
    if (ROADMAP_SECTIONS) {
      el.hidden = false
      return
    }
    el.hidden = true
    el.setAttribute('hidden', '')
    el.style.display = 'none'
  })
}

export function formatCardSrc(slug) {
  return LANDING_R2 + '/format-card-' + slug + '.mp4'
}

export function formatCardPoster(slug) {
  return LANDING_R2 + '/format-card-' + slug + '.jpg'
}

export function ugcCardSrc(n) {
  return LANDING_R2 + '/ugc-card-' + pad2(n) + '.mp4'
}

export function ugcCardPoster(n) {
  return LANDING_R2 + '/ugc-card-' + pad2(n) + '.jpg'
}

export function studioToolSrc(slug) {
  return LANDING_R2 + '/studio-tool-' + slug + '.jpg'
}

export function featMediaSrc(id) {
  return LANDING_R2 + '/feat-' + String(id || '').replace(/^feat-/, '').replace(/^connect-/, '') + '.jpg'
}

/** Icon tiles on One platform. Every href is a live tool or its home. */
export const WORKFLOW_TILES = [
  { id: 'script', label: 'Script', href: '/video-generation', icon: 'script' },
  { id: 'voiceover', label: 'Voiceover', href: '/voiceover', icon: 'voice' },
  { id: 'footage', label: 'Footage', href: '/video-generation', icon: 'film' },
  { id: 'captions', label: 'Captions', href: '/captions', icon: 'captions' },
  { id: 'thumbnails', label: 'Thumbnails', href: '/image-generation', icon: 'image' },
  { id: 'clipping', label: 'Clipping', href: '/clipping', icon: 'clip' },
  { id: 'editor', label: 'Editor', href: '/editor', icon: 'editor' },
  { id: 'export', label: 'Export', href: '/video-generation', icon: 'export' },
]

/** Formats carousel. Media stays blank until format-card-<slug> exists. */
export const FORMAT_CARDS = [
  { slug: 'long-form', category: 'Long-form', icon: 'film' },
  { slug: 'shorts', category: 'Shorts', icon: 'phone' },
  { slug: 'ads', category: 'Ads', icon: 'cam' },
  { slug: 'ugc', category: 'UGC', icon: 'phone' },
  { slug: 'explainers', category: 'Explainers', icon: 'book' },
  { slug: 'product-videos', category: 'Product videos', icon: 'film' },
  { slug: 'talking-head', category: 'Talking head', icon: 'cam' },
  { slug: 'listicles', category: 'Listicles', icon: 'list' },
  { slug: 'documentary', category: 'Documentary', icon: 'film' },
].map((c) => ({
  ...c,
  src: formatCardSrc(c.slug),
  poster: formatCardPoster(c.slug),
}))

export const UGC_CARDS = [1, 2, 3, 4].map((n) => ({
  n,
  src: ugcCardSrc(n),
  poster: ugcCardPoster(n),
}))

const STUDIO_ORDER = [
  'videogen',
  'imagegen',
  'clipper',
  'voiceover',
  'captions',
  'editor',
  'ranking',
  'reframe',
  'commentary',
  'downloader',
  'mcp',
]

export const STUDIO_TOOLS = STUDIO_ORDER.map((id) => {
  const tool = TOOL_MENU_ITEMS[id]
  return {
    id,
    name: tool.name,
    href: tool.href,
    description: tool.description,
    src: studioToolSrc(id),
  }
})

export const LIVE_FEATURE_ROWS = [
  'connect-claude',
  'feat-longform',
  'feat-shorts',
  'feat-thumbs',
  'feat-voice',
  'feat-editor',
]

export const GATED_FEATURE_ROWS = [
  { id: 'feat-ranking', reason: 'Ranking core is live. Number, size, voiceover, transition, and sound FX tabs are stubs.' },
  { id: 'feat-faceless-studio', reason: 'Faceless Studio is archived. Route falls back to Long Form.' },
  { id: 'feat-ads-gen', reason: 'No dedicated ads generator is shipped.' },
  { id: 'feat-ugc-studio', reason: 'No dedicated UGC studio is shipped.' },
]

export const PLACEHOLDER_FILES = {
  formats: FORMAT_CARDS.map((c) => 'format-card-' + c.slug + '.mp4'),
  formatPosters: FORMAT_CARDS.map((c) => 'format-card-' + c.slug + '.jpg'),
  ugc: UGC_CARDS.map((c) => 'ugc-card-' + String(c.n).padStart(2, '0') + '.mp4'),
  ugcPosters: UGC_CARDS.map((c) => 'ugc-card-' + String(c.n).padStart(2, '0') + '.jpg'),
  studio: STUDIO_TOOLS.map((t) => 'studio-tool-' + t.id + '.jpg'),
  feats: ['mcp', 'longform', 'shorts', 'thumbs', 'voice', 'editor', 'ranking', 'faceless-studio', 'ads-gen', 'ugc-studio'].map((id) => 'feat-' + id + '.jpg'),
}
