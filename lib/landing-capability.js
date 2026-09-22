/** Live-tool landing config. Sections for tools we do not ship stay behind ROADMAP_SECTIONS. */

import { APP_HOME_HREF, TOOL_MENU_ITEMS } from './public-tools.js'

const R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'
const LANDING_R2 = R2 + '/landing'

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
  return R2 + '/ugcad' + n + '.mp4'
}

export function studioToolSrc(slug) {
  return LANDING_R2 + '/studio-tool-' + slug + '.jpg'
}

export function featMediaSrc(id) {
  return LANDING_R2 + '/feat-' + String(id || '').replace(/^feat-/, '').replace(/^connect-/, '') + '.jpg'
}

/** Icon tiles on One platform. Every href is a live tool or its home. */
export const WORKFLOW_TILES = [
  { id: 'script', label: 'Script', href: APP_HOME_HREF, icon: 'script' },
  { id: 'voiceover', label: 'Voiceover', href: APP_HOME_HREF, icon: 'voice' },
  { id: 'footage', label: 'Footage', href: APP_HOME_HREF, icon: 'film' },
  { id: 'captions', label: 'Captions', href: APP_HOME_HREF, icon: 'captions' },
  { id: 'thumbnails', label: 'Thumbnails', href: APP_HOME_HREF, icon: 'image' },
  { id: 'clipping', label: 'Clipping', href: APP_HOME_HREF, icon: 'clip' },
  { id: 'editor', label: 'Editor', href: APP_HOME_HREF, icon: 'editor' },
  { id: 'export', label: 'Export', href: APP_HOME_HREF, icon: 'export' },
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
    href: id === 'mcp' ? tool.href : APP_HOME_HREF,
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
  ugc: UGC_CARDS.map((c) => 'ugcad' + c.n + '.mp4'),
  studio: STUDIO_TOOLS.map((t) => 'studio-tool-' + t.id + '.jpg'),
  feats: ['mcp', 'longform', 'shorts', 'thumbs', 'voice', 'editor', 'ranking', 'faceless-studio', 'ads-gen', 'ugc-studio'].map((id) => 'feat-' + id + '.jpg'),
  nav: ['models-promo.jpg', 'features-promo.jpg'],
}
