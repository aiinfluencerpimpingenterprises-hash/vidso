/** Studio sidebar, catalog, and placeholder media. Routes and copy come from
 * shipped tools. Do not invent names, limits, or capabilities here. */

import { DURATION_PRESETS } from './entitlements.js'
import { MCP_AGENT_LOGOS, mcpAgentFallback, mcpAgentLogo } from './landing-media.js'
import { TOOL_MENU_ITEMS } from './public-tools.js'
import { TOOL_GALLERY } from './tools-gallery.js'

export const APP_R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/app'

export const SIDEBAR_COLLAPSE_KEY = 'vidso_sidebar_collapsed'
export const PINNED_TOOLS_KEY = 'vidso_pinned_tools'

export const STUDIO_LENGTH = {
  shorts: DURATION_PRESETS.shorts.slice(),
  long: DURATION_PRESETS.long.slice(),
}

const ICO = {
  home: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"/></svg>',
  videogen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 19V5h12l4 4v10H4z"/><path d="M16 5v4h4"/><path d="M8 13h8M8 17h5"/></svg>',
  imagegen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  clipper: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  ranking: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 01-10 0V4z"/></svg>',
  captions: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h14"/></svg>',
  voiceover: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  reframe: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6"/></svg>',
  commentary: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  editor: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h14"/><circle cx="18" cy="12" r="2"/></svg>',
  downloader: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  files: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  brandkit: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  templates: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>',
  tutorials: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l6 3-6 3V9z"/></svg>',
  pin: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3L8 3z"/></svg>',
}

/** Page-copy descriptions. Prefer the tool page subtitle, then TOOL_MENU_ITEMS. */
export const STUDIO_TOOL_COPY = {
  videogen: {
    id: 'videogen',
    name: 'Long Form Generator',
    href: '/video-generation',
    slug: 'long-form-generator',
    description: TOOL_MENU_ITEMS.videogen.description,
    source: 'dashboard #fv-page-sub / TOOL_MENU_ITEMS.videogen',
    icon: ICO.videogen,
    categories: ['popular', 'long-form'],
    prefill: 'topic',
  },
  imagegen: {
    id: 'imagegen',
    name: 'Thumbnail Generator',
    href: '/image-generation',
    slug: 'thumbnail-generator',
    description: 'Describe a scene, a subject, a mood, or a style, and watch it come to life.',
    source: 'dashboard #img-empty-sub',
    icon: ICO.imagegen,
    categories: ['popular', 'thumbnails'],
    prefill: 'prompt',
  },
  clipper: {
    id: 'clipper',
    name: 'Clipping',
    href: '/clipping',
    slug: 'clipping',
    description: TOOL_MENU_ITEMS.clipper.description,
    source: 'dashboard clipper page header / TOOL_MENU_ITEMS.clipper',
    icon: ICO.clipper,
    categories: ['popular', 'shorts'],
    prefill: null,
  },
  ranking: {
    id: 'ranking',
    name: 'Ranking',
    href: '/ranking',
    slug: 'ranking',
    description: TOOL_MENU_ITEMS.ranking.description,
    source: 'dashboard #ranking-header / TOOL_MENU_ITEMS.ranking',
    icon: ICO.ranking,
    categories: ['shorts'],
    prefill: null,
  },
  captions: {
    id: 'captions',
    name: 'AI Captions',
    href: '/captions',
    slug: 'ai-captions',
    description: 'Upload a video or paste a URL to auto-transcribe. Get a full SRT caption file back.',
    source: 'dashboard #panel-captions intro',
    icon: ICO.captions,
    categories: ['audio'],
    prefill: null,
  },
  voiceover: {
    id: 'voiceover',
    name: 'AI Voiceover',
    href: '/voiceover',
    slug: 'ai-voiceover',
    description: TOOL_MENU_ITEMS.voiceover.description,
    source: 'dashboard #panel-voiceover intro / TOOL_MENU_ITEMS.voiceover',
    icon: ICO.voiceover,
    categories: ['popular', 'audio'],
    prefill: null,
  },
  reframe: {
    id: 'reframe',
    name: 'AI Reframe',
    href: '/reframe',
    slug: 'ai-reframe',
    description: TOOL_MENU_ITEMS.reframe.description,
    source: 'dashboard #rf-intro / TOOL_MENU_ITEMS.reframe',
    icon: ICO.reframe,
    categories: ['shorts'],
    prefill: null,
  },
  commentary: {
    id: 'commentary',
    name: 'Video Commentary',
    href: '/commentary',
    slug: 'video-commentary',
    description: 'Add voice and captions on clips.',
    source: 'TOOL_SEO /commentary',
    icon: ICO.commentary,
    categories: ['shorts'],
    prefill: null,
  },
  editor: {
    id: 'editor',
    name: 'Video Editor',
    href: '/editor',
    slug: 'video-editor',
    description: 'Edit on a multi-track timeline in Vidso.',
    source: 'TOOL_SEO /editor',
    icon: ICO.editor,
    categories: ['editing'],
    prefill: null,
  },
  downloader: {
    id: 'downloader',
    name: 'Video Downloader',
    href: '/downloader',
    slug: 'video-downloader',
    description: TOOL_MENU_ITEMS.downloader.description,
    source: 'dashboard #panel-downloader intro / TOOL_MENU_ITEMS.downloader',
    icon: ICO.downloader,
    categories: ['editing'],
    prefill: null,
  },
}

export const STUDIO_PAGES = {
  dashboard: { id: 'dashboard', name: 'Home', href: '/dashboard', icon: ICO.home, badge: '' },
  files: { id: 'files', name: 'My Files', href: '/files', icon: ICO.files, badge: '' },
  brandkit: { id: 'brandkit', name: 'Brand kit', href: '/brand-kit', icon: ICO.brandkit, badge: '' },
  templates: { id: 'templates', name: 'Templates', href: '/templates', icon: ICO.templates, badge: '' },
  tutorials: { id: 'tutorials', name: 'Tutorials', href: '/tutorials', icon: ICO.tutorials, badge: '' },
  tools: { id: 'tools', name: 'Tools', href: '/tools', icon: ICO.templates, badge: '' },
}

export const SIDEBAR_SECTIONS = [
  {
    id: 'home',
    label: '',
    items: [{ ...STUDIO_PAGES.dashboard }],
  },
  {
    id: 'create',
    label: 'Create',
    items: [STUDIO_TOOL_COPY.videogen, STUDIO_TOOL_COPY.imagegen].map(navTool),
  },
  {
    id: 'short-form',
    label: 'Short form',
    items: [
      STUDIO_TOOL_COPY.clipper,
      STUDIO_TOOL_COPY.ranking,
      STUDIO_TOOL_COPY.captions,
      STUDIO_TOOL_COPY.voiceover,
      STUDIO_TOOL_COPY.reframe,
      STUDIO_TOOL_COPY.commentary,
    ].map(navTool),
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [STUDIO_TOOL_COPY.editor, STUDIO_TOOL_COPY.downloader].map(navTool),
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [STUDIO_PAGES.files, STUDIO_PAGES.brandkit],
  },
  {
    id: 'inspire',
    label: 'Inspire',
    items: [STUDIO_PAGES.templates, STUDIO_PAGES.tutorials],
  },
  {
    id: 'pinned',
    label: 'Pinned',
    items: [],
    pinned: true,
  },
]

export const CATALOG_TABS = [
  { id: 'popular', label: 'Popular' },
  { id: 'long-form', label: 'Long-form' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'thumbnails', label: 'Thumbnails' },
  { id: 'audio', label: 'Audio' },
  { id: 'editing', label: 'Editing' },
]

export const HOME_PROMPT_MODES = [
  { id: 'long', label: 'Long-form', panel: 'videogen', format: 'long' },
  { id: 'shorts', label: 'Shorts', panel: 'videogen', format: 'shorts' },
  { id: 'thumbnail', label: 'Thumbnail', panel: 'imagegen', format: null },
]

export const HOME_CHIPS = [
  '12 airport secrets airlines hide',
  'Top 10 true stories that sound made up',
  'Clip my last upload',
  'Make a thumbnail for this title',
]

export const WHATS_NEW = [
  {
    id: 'seedream-5-pro',
    title: 'Seedream 5.0 Pro',
    blurb: 'Now available in the Thumbnail Generator.',
    tag: 'New',
    href: '/image-generation',
    panel: 'imagegen',
    image: 'whats-new-01.jpg',
  },
  { id: 'whats-new-02', title: '', blurb: '', tag: '', href: '', panel: '', image: 'whats-new-02.jpg' },
  { id: 'whats-new-03', title: '', blurb: '', tag: '', href: '', panel: '', image: 'whats-new-03.jpg' },
  { id: 'whats-new-04', title: '', blurb: '', tag: '', href: '', panel: '', image: 'whats-new-04.jpg' },
]

export const TEMPLATE_CATEGORIES = [
  { id: 'explainers', label: 'Faceless explainers', panel: 'videogen' },
  { id: 'lists', label: 'Lists and countdowns', panel: 'videogen' },
  { id: 'stories', label: 'Stories and documentaries', panel: 'videogen' },
  { id: 'shorts', label: 'Shorts', panel: 'videogen' },
  { id: 'thumbnails', label: 'Thumbnails', panel: 'imagegen' },
]

export const TEMPLATES = [
  { id: 'template-01', file: 'template-01.jpg', title: 'Faceless explainer 01', category: 'explainers', panel: 'videogen' },
  { id: 'template-02', file: 'template-02.jpg', title: 'Faceless explainer 02', category: 'explainers', panel: 'videogen' },
  { id: 'template-03', file: 'template-03.jpg', title: 'Faceless explainer 03', category: 'explainers', panel: 'videogen' },
  { id: 'template-04', file: 'template-04.jpg', title: 'List 01', category: 'lists', panel: 'videogen' },
  { id: 'template-05', file: 'template-05.jpg', title: 'List 02', category: 'lists', panel: 'videogen' },
  { id: 'template-06', file: 'template-06.jpg', title: 'Countdown 01', category: 'lists', panel: 'videogen' },
  { id: 'template-07', file: 'template-07.jpg', title: 'Story 01', category: 'stories', panel: 'videogen' },
  { id: 'template-08', file: 'template-08.jpg', title: 'Documentary 01', category: 'stories', panel: 'videogen' },
  { id: 'template-09', file: 'template-09.jpg', title: 'Short 01', category: 'shorts', panel: 'videogen' },
  { id: 'template-10', file: 'template-10.jpg', title: 'Short 02', category: 'shorts', panel: 'videogen' },
  { id: 'template-11', file: 'template-11.jpg', title: 'Thumbnail 01', category: 'thumbnails', panel: 'imagegen' },
  { id: 'template-12', file: 'template-12.jpg', title: 'Thumbnail 02', category: 'thumbnails', panel: 'imagegen' },
]

export const TUTORIAL_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'long-form', label: 'Long-form' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'thumbnails', label: 'Thumbnails' },
  { id: 'audio', label: 'Audio' },
]

export const TUTORIALS = [
  { id: 'tutorial-01', file: 'tutorial-01.jpg', title: 'Tutorial 01', duration: '0:00', category: 'long-form' },
  { id: 'tutorial-02', file: 'tutorial-02.jpg', title: 'Tutorial 02', duration: '0:00', category: 'long-form' },
  { id: 'tutorial-03', file: 'tutorial-03.jpg', title: 'Tutorial 03', duration: '0:00', category: 'shorts' },
  { id: 'tutorial-04', file: 'tutorial-04.jpg', title: 'Tutorial 04', duration: '0:00', category: 'shorts' },
  { id: 'tutorial-05', file: 'tutorial-05.jpg', title: 'Tutorial 05', duration: '0:00', category: 'thumbnails' },
  { id: 'tutorial-06', file: 'tutorial-06.jpg', title: 'Tutorial 06', duration: '0:00', category: 'thumbnails' },
  { id: 'tutorial-07', file: 'tutorial-07.jpg', title: 'Tutorial 07', duration: '0:00', category: 'audio' },
  { id: 'tutorial-08', file: 'tutorial-08.jpg', title: 'Tutorial 08', duration: '0:00', category: 'audio' },
]

export const PLACEHOLDER_FILES = {
  tools: Object.values(STUDIO_TOOL_COPY).map((t) => `tool-thumb-${t.slug}.jpg`),
  templates: TEMPLATES.map((t) => t.file),
  tutorials: TUTORIALS.map((t) => t.file),
  whatsNew: WHATS_NEW.map((t) => t.image),
}

export function appMedia(file) {
  return APP_R2 + '/' + file
}

export function toolThumb(slug) {
  return appMedia('tool-thumb-' + slug + '.jpg')
}

export function catalogTools(tab = 'popular') {
  return Object.values(STUDIO_TOOL_COPY).filter((t) => t.categories.includes(tab))
}

export function allStudioTools() {
  return Object.values(STUDIO_TOOL_COPY)
}

export function studioToolById(id) {
  return STUDIO_TOOL_COPY[id] || null
}

export function mcpStripLogos() {
  return MCP_AGENT_LOGOS.filter((row) => row.client !== 'Other MCP agents').map((row) => ({
    client: row.client,
    src: mcpAgentLogo(row.file),
    fallback: mcpAgentFallback(row.fallback),
  }))
}

export function readPinned() {
  try {
    const raw = JSON.parse(localStorage.getItem(PINNED_TOOLS_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((id) => STUDIO_TOOL_COPY[id])
  } catch (_) {
    return []
  }
}

export function writePinned(ids) {
  try { localStorage.setItem(PINNED_TOOLS_KEY, JSON.stringify(ids)) } catch (_) {}
}

export function togglePinned(id) {
  if (!STUDIO_TOOL_COPY[id]) return readPinned()
  const cur = readPinned()
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id)
  writePinned(next)
  return next
}

export function readCollapsed() {
  try { return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1' } catch (_) { return false }
}

export function writeCollapsed(on) {
  try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, on ? '1' : '0') } catch (_) {}
}

export function galleryIcon(id) {
  return TOOL_GALLERY.find((t) => t.id === id)?.icon || ICO[id] || ''
}

function navTool(tool) {
  return {
    id: tool.id,
    name: tool.name,
    href: tool.href,
    icon: tool.icon,
    badge: tool.badge || '',
  }
}

export { ICO }
