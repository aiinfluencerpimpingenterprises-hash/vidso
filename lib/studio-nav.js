/** Studio sidebar, catalog, and placeholder media. Routes and copy come from
 * shipped tools. Do not invent names, limits, or capabilities here. */

import { DURATION_PRESETS } from './entitlements.js'
import { featuredModels, modelSlug } from './vidso-models.js'
import { HERO_PROMPTS, MCP_AGENT_LOGOS, R2, VOICEOVER_SCRIPT, mcpAgentFallback, mcpAgentLogo } from './landing-media.js'
import { TOOL_MENU_ITEMS } from './public-tools.js'
import { TOOL_GALLERY } from './tools-gallery.js'

export const APP_R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/app'

export const SIDEBAR_COLLAPSE_KEY = 'vidso_sidebar_collapsed'
export const SIDEBAR_SECS_KEY = 'vidso_sidebar_secs'
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
  mcp: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M8 7v4M16 7v4M7 11h10v2a5 5 0 01-10 0z"/><path d="M12 18v3"/></svg>',
  pin: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3L8 3z"/></svg>',
  agents: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M6 19a6 6 0 0112 0"/><path d="M16.5 7.2a2.4 2.4 0 11.2 4.4"/></svg>',
  tools: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 015.4-5.4z"/></svg>',
  plus: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  mic: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>',
  send: '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  chev: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  play: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  grid: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  check: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
  upload: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/></svg>',
  share: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  spark: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.2l1.15 5.4 5.4 1.15-5.4 1.15L12 15.3l-1.15-5.4-5.4-1.15 5.4-1.15L12 2.2zm7.2 9.4l.7 3.2 3.2.7-3.2.7-.7 3.2-.7-3.2-3.2-.7 3.2-.7.7-3.2zM4.1 14.2l.55 2.4 2.4.55-2.4.55-.55 2.4-.55-2.4-2.4-.55 2.4-.55.55-2.4z"/></svg>',
  bell: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M6 9a6 6 0 1112 0c0 7 2 7 2 9H4c0-2 2-2 2-9z"/><path d="M10 20a2 2 0 004 0"/></svg>',
  info: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none"/></svg>',
  mail: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  doc: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6"/></svg>',
  user: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 19a7 7 0 0114 0"/></svg>',
  panel: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="3.2"/><path d="M9.5 5v14"/></svg>',
  card: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>',
  gear: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"/></svg>',
  coins: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v4c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 11v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"/></svg>',
  logout: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M10 7V5a2 2 0 012-2h7v18h-7a2 2 0 01-2-2v-2"/><path d="M4 12h10M11 8l4 4-4 4"/></svg>',
}

/** Page-copy descriptions. Prefer the tool page subtitle, then TOOL_MENU_ITEMS. */
export const STUDIO_TOOL_COPY = {
  videogen: {
    id: 'videogen',
    name: 'Long Form Generator',
    short: 'Long-form',
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
    short: 'Thumbnail',
    href: '/image-generation',
    slug: 'thumbnail-generator',
    description: 'Describe a scene, a subject, a mood, or a style, and watch it come to life.',
    source: 'dashboard #img-empty-sub',
    icon: ICO.imagegen,
    categories: ['popular', 'thumbnails'],
    prefill: 'prompt',
  },
  facelessstudio: {
    id: 'facelessstudio',
    name: 'Faceless Studio',
    short: 'Faceless',
    href: '/faceless-studio',
    slug: 'faceless-studio',
    description: 'Prompt to a faceless explainer video',
    source: 'TOOL_GALLERY facelessstudio',
    icon: ICO.videogen,
    categories: ['popular', 'long-form'],
    prefill: 'topic',
  },
  clipper: {
    id: 'clipper',
    name: 'Clipping',
    short: 'Clipping',
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
    short: 'Ranking',
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
    short: 'Captions',
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
    short: 'Voiceover',
    href: '/voiceover',
    slug: 'ai-voiceover',
    description: TOOL_MENU_ITEMS.voiceover.description,
    source: 'dashboard #panel-voiceover intro / TOOL_MENU_ITEMS.voiceover',
    icon: ICO.voiceover,
    categories: ['popular', 'audio'],
    prefill: 'script',
  },
  reframe: {
    id: 'reframe',
    name: 'AI Reframe',
    short: 'Reframe',
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
    short: 'Commentary',
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
    short: 'Editor',
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
    short: 'Downloader',
    href: '/downloader',
    slug: 'video-downloader',
    description: TOOL_MENU_ITEMS.downloader.description,
    source: 'dashboard #panel-downloader intro / TOOL_MENU_ITEMS.downloader',
    icon: ICO.downloader,
    categories: ['editing'],
    prefill: null,
  },
  mcp: {
    id: 'mcp',
    name: 'MCP / CLI',
    short: 'MCP',
    href: '/mcp',
    slug: 'mcp-cli',
    description: TOOL_MENU_ITEMS.mcp.description,
    source: 'TOOL_MENU_ITEMS.mcp',
    icon: ICO.mcp,
    categories: ['popular'],
    prefill: null,
    badge: 'NEW',
    external: true,
  },
}

export const STUDIO_PAGES = {
  dashboard: { id: 'dashboard', name: 'Home', href: '/dashboard', icon: ICO.home, badge: '' },
  files: { id: 'files', name: 'My Files', href: '/files', icon: ICO.files, badge: '' },
  brandkit: { id: 'brandkit', name: 'Brand kit', href: '/brand-kit', icon: ICO.brandkit, badge: '' },
  templates: { id: 'templates', name: 'Templates', href: '/templates', icon: ICO.templates, badge: '' },
  tutorials: { id: 'tutorials', name: 'Tutorials', href: '/tutorials', icon: ICO.tutorials, badge: '' },
  tools: { id: 'tools', name: 'Tools', href: '/tools', icon: ICO.tools, badge: '' },
}

export const WORKSPACE_PILL = {
  label: 'My workspace',
  hint: 'This account is the only workspace. Project switching is not built yet.',
}

/** Chat Mode and Director Mode do not exist. CREATE uses the generators plus Faceless Studio. */
export const SIDEBAR_SECTIONS = [
  {
    id: 'home',
    label: '',
    items: [{ ...STUDIO_PAGES.dashboard }],
  },
  {
    id: 'create',
    label: 'Create',
    items: [STUDIO_TOOL_COPY.videogen, STUDIO_TOOL_COPY.imagegen, STUDIO_TOOL_COPY.facelessstudio].map((t) => ({ ...navTool(t), name: t.short || t.name, fullName: t.name })),
  },
  {
    id: 'tools',
    label: 'Tools',
    chips: true,
    items: [
      STUDIO_TOOL_COPY.videogen,
      STUDIO_TOOL_COPY.imagegen,
      STUDIO_TOOL_COPY.clipper,
      STUDIO_TOOL_COPY.ranking,
      STUDIO_TOOL_COPY.captions,
      STUDIO_TOOL_COPY.voiceover,
      STUDIO_TOOL_COPY.reframe,
      STUDIO_TOOL_COPY.editor,
      STUDIO_TOOL_COPY.downloader,
      STUDIO_TOOL_COPY.mcp,
      STUDIO_TOOL_COPY.commentary,
    ].map(navTool),
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

export const SIDEBAR_OMITTED = [
  { section: 'Agents', label: 'Chat Mode', reason: 'No Chat Mode route or panel ships in this repo.' },
  { section: 'Agents', label: 'Director Mode', reason: 'No Director Mode route or panel ships in this repo.' },
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
  { id: 'long', label: 'Long-form', panel: 'videogen', format: 'long', hint: 'Narrated video with B-roll and captions', icon: 'videogen' },
  { id: 'shorts', label: 'Shorts', panel: 'videogen', format: 'shorts', hint: '30 to 60 second vertical cut', icon: 'clipper' },
  { id: 'thumbnail', label: 'Thumbnail', panel: 'imagegen', format: null, hint: 'Image for a video title', icon: 'imagegen' },
  { id: 'voiceover', label: 'Voiceover', panel: 'voiceover', format: null, hint: 'Narration from a script', icon: 'voiceover' },
]

export const HOME_PROMPT_IDEAS = HERO_PROMPTS.slice()

export const ASK_BEHAVIORS = [
  { id: 'ask', label: 'Ask first', hint: 'Vidso confirms the plan before generating', icon: 'commentary' },
  { id: 'run', label: 'Just make it', hint: 'Generate immediately', icon: 'send' },
]

export const ATTACH_GROUPS = [
  {
    id: 'local',
    label: 'Upload from local',
    items: [
      { id: 'local-image', label: 'Images', accept: 'image/*', kind: 'file' },
      { id: 'local-audio', label: 'Audio', accept: 'audio/*', kind: 'file' },
      { id: 'local-video', label: 'Video', accept: 'video/*', kind: 'file' },
    ],
  },
  {
    id: 'library',
    label: 'Upload from my files',
    items: [
      { id: 'files', label: 'My Files', kind: 'go', panel: 'files' },
      { id: 'brandkit', label: 'Brand kit', kind: 'go', panel: 'brandkit' },
    ],
  },
]

export const ATTACH_MENU = ATTACH_GROUPS.flatMap((g) => g.items)

export const HOME_CHIPS = [
  { id: 'longform', label: 'Make a long-form video', icon: 'videogen', fill: HERO_PROMPTS[0], mode: 'long' },
  { id: 'thumb', label: 'Design a thumbnail', icon: 'imagegen', fill: 'A bold YouTube thumbnail for this title', mode: 'thumbnail' },
  { id: 'clip', label: 'Clip my last upload', icon: 'clipper', fill: 'Clip my last upload', mode: 'shorts' },
  { id: 'voice', label: 'Write a voiceover', icon: 'voiceover', fill: VOICEOVER_SCRIPT, mode: 'voiceover' },
]

export const HOME_CHIPS_MORE = [
  ...HERO_PROMPTS.slice(1).map((fill, i) => ({
    id: 'more-' + (i + 1),
    label: fill,
    icon: i === HERO_PROMPTS.length - 2 ? 'clipper' : 'videogen',
    fill,
    mode: i === HERO_PROMPTS.length - 2 ? 'shorts' : 'long',
  })),
  { id: 'more-thumb', label: 'A bold YouTube thumbnail for this title', icon: 'imagegen', fill: 'A bold YouTube thumbnail for this title', mode: 'thumbnail' },
]

export const START_FORMATS = [
  { id: 'long-form', label: 'Long-form', slug: 'long-form', panel: 'videogen', format: 'long', badge: '', chip: 'Long-form', ratio: '16:9', subtitle: 'Narrated video with B-roll and captions' },
  { id: 'short', label: 'Short film', slug: 'short', panel: 'videogen', format: 'shorts', badge: '', chip: 'Short film', ratio: '9:16', subtitle: '30 to 60 second vertical cut' },
  { id: 'thumbnail', label: 'Thumbnail', slug: 'thumbnail', panel: 'imagegen', format: null, badge: '', chip: 'Thumbnail', ratio: '16:9', subtitle: 'Image for a video title' },
  { id: 'clip', label: 'Clip', slug: 'clip', panel: 'clipper', format: null, badge: '', chip: 'Clip', ratio: '9:16', subtitle: 'Cut moments from a longer video' },
  { id: 'ranking', label: 'Ranking video', slug: 'ranking', panel: 'ranking', format: null, badge: '', chip: 'Ranking', ratio: '9:16', subtitle: 'Ranked shorts with a live 9:16 preview' },
  { id: 'ugc', label: 'Social content', slug: 'ugc', panel: 'videogen', format: 'shorts', badge: '', chip: 'Social content', ratio: '9:16', subtitle: 'Handheld creator-style short' },
  { id: 'explainer', label: 'Explainer', slug: 'explainer', panel: 'videogen', format: 'long', badge: '', chip: 'Explainer', ratio: '16:9', subtitle: 'How-it-works narrated video' },
  { id: 'listicle', label: 'Listicle', slug: 'listicle', panel: 'videogen', format: 'long', badge: '', chip: 'Listicle', ratio: '16:9', subtitle: 'Numbered list as a narrated video' },
]

export const WHATS_NEW = [
  {
    id: 'seedream-5-pro',
    title: 'Seedream 5.0 Pro is live in Thumbnail Generator',
    blurb: 'Now available in the Thumbnail Generator.',
    tag: 'New',
    tagTone: 'new',
    href: '/image-generation',
    panel: 'imagegen',
    image: 'home-whatsnew-01.jpg',
  },
  {
    id: 'mcp',
    title: 'Run Vidso from Claude, ChatGPT, Cursor, or Kimi',
    blurb: 'Connect the MCP server to your agent.',
    tag: 'Try now',
    tagTone: 'try',
    href: '/mcp',
    panel: '',
    image: 'home-whatsnew-02.jpg',
  },
  {
    id: 'models',
    title: 'See the models Vidso actually uses',
    blurb: 'Open the public models catalog.',
    tag: 'Catalog',
    tagTone: 'catalog',
    href: '/models',
    panel: '',
    image: 'home-whatsnew-03.jpg',
  },
  {
    id: 'longform',
    title: 'Turn a topic into a narrated long-form video',
    blurb: 'Script, voice, B-roll, and captions in one run.',
    tag: 'Try now',
    tagTone: 'try',
    href: '/video-generation',
    panel: 'videogen',
    image: 'home-whatsnew-04.jpg',
  },
  {
    id: 'seedance-2',
    title: 'Seedance 2 footage with native audio',
    blurb: 'Wired in Long Form AI footage.',
    tag: 'New',
    tagTone: 'new',
    href: '/models#seedance-2',
    panel: '',
    image: 'home-whatsnew-05.jpg',
  },
  {
    id: 'clipping',
    title: 'Clipping finds the best moments in a link',
    blurb: 'Paste a link and reframe to 9:16.',
    tag: 'Upgrade now',
    tagTone: 'upgrade',
    href: '/clipping',
    panel: 'clipper',
    image: 'home-whatsnew-06.jpg',
  },
]

export const HOME_PRESETS = [
  { id: 'preset-01', title: 'Faceless Video', file: 'home-preset-01.jpg', panel: 'videogen' },
  { id: 'preset-02', title: 'Cartoon Faceless Video', file: 'home-preset-02.jpg', panel: 'videogen' },
  { id: 'preset-03', title: 'Pixel Art', file: 'home-preset-03.jpg', panel: 'videogen' },
  { id: 'preset-04', title: 'Claymotion', file: 'home-preset-04.jpg', panel: 'videogen' },
  { id: 'preset-05', title: 'Mixed Media', file: 'home-preset-05.jpg', panel: 'videogen' },
  { id: 'preset-06', title: '2D Illustrator', file: 'home-preset-06.jpg', panel: 'videogen' },
  { id: 'preset-07', title: 'Whiteboard Doodle', file: 'home-preset-07.jpg', panel: 'videogen' },
  { id: 'preset-08', title: 'Low Poly', file: 'home-preset-08.jpg', panel: 'videogen' },
  { id: 'preset-09', title: 'Isometric Flat Vector', file: 'home-preset-09.jpg', panel: 'videogen' },
  { id: 'preset-10', title: 'Fluffy Toy', file: 'home-preset-10.jpg', panel: 'videogen' },
  { id: 'preset-11', title: 'Faceless explainer', file: 'home-preset-11.jpg', panel: 'videogen' },
  { id: 'preset-12', title: 'Countdown', file: 'home-preset-12.jpg', panel: 'videogen' },
  { id: 'preset-13', title: 'Faceless Video 02', file: 'home-preset-13.jpg', panel: 'videogen' },
  { id: 'preset-14', title: 'Cartoon Faceless Video 02', file: 'home-preset-14.jpg', panel: 'videogen' },
  { id: 'preset-15', title: 'Pixel Art 02', file: 'home-preset-15.jpg', panel: 'videogen' },
  { id: 'preset-16', title: 'Claymotion 02', file: 'home-preset-16.jpg', panel: 'videogen' },
  { id: 'preset-17', title: 'Mixed Media 02', file: 'home-preset-17.jpg', panel: 'videogen' },
  { id: 'preset-18', title: '2D Illustrator 02', file: 'home-preset-18.jpg', panel: 'videogen' },
  { id: 'preset-19', title: 'Whiteboard Doodle 02', file: 'home-preset-19.jpg', panel: 'videogen' },
  { id: 'preset-20', title: 'Low Poly 02', file: 'home-preset-20.jpg', panel: 'videogen' },
  { id: 'preset-21', title: 'Isometric Flat Vector 02', file: 'home-preset-21.jpg', panel: 'videogen' },
  { id: 'preset-22', title: 'Fluffy Toy 02', file: 'home-preset-22.jpg', panel: 'videogen' },
  { id: 'preset-23', title: 'Faceless explainer 02', file: 'home-preset-23.jpg', panel: 'videogen' },
  { id: 'preset-24', title: 'Countdown 02', file: 'home-preset-24.jpg', panel: 'videogen' },
]

export const VISUAL_STYLES = HOME_PRESETS.slice(0, 8).map((p) => ({ id: p.id, label: p.title }))

export const HELP_MENU = [
  { id: 'help-center', label: 'Help Center', href: '/home#faq', icon: 'info' },
  { id: 'feedback', label: 'Feedback', href: 'mailto:support@vidso.pro?subject=Vidso%20feedback', icon: 'commentary' },
  { id: 'email', label: 'Email Us', href: 'mailto:support@vidso.pro', icon: 'mail' },
  { id: 'terms', label: 'Terms & Policies', href: '/terms', icon: 'doc' },
]

export const AVATAR_MENU = [
  { id: 'profile', label: 'View profile', action: 'settings', icon: 'user' },
  { id: 'subs', label: 'Subscriptions', action: 'paywall', icon: 'card' },
  { id: 'account', label: 'Manage account', action: 'settings', icon: 'gear' },
  { id: 'workspace', label: 'Manage workspace', action: 'settings', icon: 'gear' },
  { id: 'credits', label: 'Credits history', action: 'settings', icon: 'coins' },
  { id: 'signout', label: 'Sign out', action: 'logout', icon: 'logout' },
]

export const INSPIRE_CATEGORIES = [
  { id: 'marketing', label: 'Marketing and Advertising', description: 'Campaign clips, product shots, and style visuals for brands and sellers.' },
  { id: 'film', label: 'Film and stories', description: 'Narrative beats, documentary frames, and story stills.' },
  { id: 'music', label: 'Music video', description: 'Performance frames and visualizer-style stills.' },
  { id: 'animation', label: 'Animation and illustration', description: 'Illustrated and motion-style frames.' },
  { id: 'ugc', label: 'UGC', description: 'Handheld product and creator-style shots.' },
  { id: 'explainer', label: 'Explainer', description: 'Diagram-style frames for how-it-works videos.' },
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
  start: START_FORMATS.map((f) => `home-start-${f.slug}.mp4`),
  whatsNew: WHATS_NEW.map((t) => t.image),
  presets: HOME_PRESETS.map((t) => t.file),
  inspire: INSPIRE_CATEGORIES.flatMap((c) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `home-inspire-${c.id}-0${n}.jpg`)),
  models: featuredModels().map((m) => `model-card-${modelSlug(m.id)}.jpg`),
  templates: TEMPLATES.map((t) => t.file),
  tutorials: TUTORIALS.map((t) => t.file),
}

export function appMedia(file) {
  return APP_R2 + '/' + file
}

export function toolThumb(slug) {
  return appMedia('tool-thumb-' + slug + '.jpg')
}

const START_LIVE = {
  'long-form': 'landingpagelongform.mp4',
  short: 'landingpageshort.mp4',
  thumbnail: 'thumbnail.png',
  clip: 'landingpageformatsshort.mp4',
  ugc: 'landingpageugc.mp4',
  explainer: 'facelessstudio1.mp4',
}

export function startMedia(slug) {
  const file = START_LIVE[slug]
  return file ? R2 + '/' + encodeURIComponent(file) : ''
}

export function inspireMedia(category, n) {
  return appMedia('home-inspire-' + category + '-' + String(n).padStart(2, '0') + '.jpg')
}

const MARKETING_CLIPS = [
  'marketing&advertising1.mp4',
  'marketing&advertising2.mp4',
  'enhanced.mp4',
  'cgt-20260807111954-75dbb.mp4',
  'cgt-20260807151156-nb9g9.mp4',
  'DTyNeUYoyWApxM8kcE2-l_sEctF05h.mp4',
  'QUGZkmX1peda29ttJc9V.mp4',
  'WKW9nnh62A7d4fF8vaMr.mp4',
  '0 (1).mp4',
  '0 (2).mp4',
  '0 (3).mp4',
  '0.mp4',
  '0217758004894090000000000000000000ffffc0a88f20abbd19.mp4',
  '0217759311483810000000000000000000ffffc0a88f207d8f97.mp4',
  '0217759729565820000000000000000000ffffc0a88f205ef6eb.mp4',
  '0217762723194640000000000000000000ffffc0a85601533128.mp4',
  '0217764234263770000000000000000000ffffc0a87c2bba90ea.mp4',
  '0217769016813690000000000000000000ffffc0a878ec749fec.mp4',
  '0217769037193710000000000000000000ffffc0a8b0d38ab6a2.mp4',
  '0217786308711890000000000000000000ffffc0a884a94805a9.mp4',
  '0217798786332840000000000000000000ffffc0a8871cc3f4d7.mp4',
  '0217803136432900000000000000000000ffffc0a8baf8f13b06.mp4',
  '0217810292584330000000000000000000ffffc0a87bec6e8848.mp4',
  '0217810303282970000000000000000000ffffc0a89a6520c641.mp4',
  '0217810642229740000000000000000000ffffc0a8871c36aaa5.mp4',
  '0217811218617590000000000000000000ffffc0a899c5ea48c3.mp4',
  '0217811221135330000000000000000000ffffc0a87bec8bff9f.mp4',
  '0217811224136330000000000000000000ffffc0a87bec371464.mp4',
  '0217811225298560000000000000000000ffffc0a8bb20ce46cb.mp4',
  '0217811230939430000000000000000000ffffc0a87c204b5097.mp4',
  '0217815481326720000000000000000000ffffc0a87852537a61.mp4',
  '4d29747fb33fbafcce8a4e88b1f72ecc-ea9ef434-5cf9-455e-ae59-54fdaf75869f.mp4',
]

const FILM_CLIPS = [
  'enhanced (1).mp4',
  'enhanced.mp4',
  'nQm3rImMePl95E44v1ly.mp4',
  'gouYzB3HE1g1I0T8Nw7j.mp4',
  '40322d6fef457ef947278d667829e7af-51ea4b51-bd0a-4104-8566-43d1cfdabf15.mp4',
  '0aa1ffa85e4d326ff97adb2d67668a8f-f5a4abea-f249-4468-b0a4-b0753ca79b50.mp4',
  '0b21f49e651c7fb98921420e849091c2-45c189fa-1449-4e7a-81ec-af2f4634f0c8.mp4',
  '17a44caf566b356c8c3dae69c82ac8c5-403d8098-c14f-4c99-9211-bd2f98bfd442.mp4',
  '0217758493953020000000000000000000ffffc0a88f2044a1d1.mp4',
  '0217759301430480000000000000000000ffffc0a88f20f93c7f.mp4',
  '0217759453792370000000000000000000ffffc0a88f2068be0c.mp4',
  '0217759486869590000000000000000000ffffc0a88f20224194.mp4',
  '0217760846967010000000000000000000ffffc0a88f20d15a79.mp4',
  '0217761082545640000000000000000000ffffc0a86cdaff2593.mp4',
  '0217762925403690000000000000000000ffffc0a878e04f6b5f.mp4',
  '0217763558351990000000000000000000ffffc0a8871ca4b064.mp4',
  '0217763739270760000000000000000000ffffc0a87c5da46d0c.mp4',
  '0217765340323850000000000000000000ffffc0a86fd02b1904.mp4',
  '0217767570711700000000000000000000ffffc0a864764d0e7b.mp4',
  '0217769929914390000000000000000000ffffc0a87bfd46b045.mp4',
  '0217770170883030000000000000000000ffffc0a8a4e03e318a.mp4',
  '0217773564087620000000000000000000ffffc0a89a4ecd38dd.mp4',
  '0217773570266020000000000000000000ffffc0a8786f429088.mp4',
  '0217783856969140000000000000000000ffffc0a87832209d7b.mp4',
  '0217788648440960000000000000000000ffffc0a87905a1b4cf.mp4',
  '0217789473021620000000000000000000ffffc0a8786731276d.mp4',
  '0217790180923810000000000000000000ffffc0a8b7d610a42a.mp4',
  '0217790326489890000000000000000000ffffc0a87bf695b0a9.mp4',
  '0217791692475770000000000000000000ffffc0a884a9a2ea2e.mp4',
  '0217791753530080000000000000000000ffffc0a8636499ff88.mp4',
  '0217791759417220000000000000000000ffffc0a89044cd36f5.mp4',
  '0217791841860340000000000000000000ffffc0a8845b248e79.mp4',
  '0217792405038970000000000000000000ffffc0a86ceafc1e2a.mp4',
  '0217794664769970000000000000000000ffffc0a88c94b3219b.mp4',
  '0217796554536140000000000000000000ffffc0a89b20a29156.mp4',
  '0217796998258570000000000000000000ffffc0a87879a329c5.mp4',
  '0217797080669800000000000000000000ffffc0a84aa54fde17.mp4',
  '0217797657673960000000000000000000ffffc0a86476a925b5.mp4',
  '0217800058259560000000000000000000ffffc0a8790a414fae.mp4',
  '0217800719505100000000000000000000ffffc0a8a141c6639c.mp4',
  '0217800966107270000000000000000000ffffc0a87ff4df97c0.mp4',
  '0217801219422560000000000000000000ffffc0a87ff49d9ae5.mp4',
  '0217801273148390000000000000000000ffffc0a8787bbaab72.mp4',
  '0217802528707920000000000000000000ffffc0a87826dec149.mp4',
  '0217804685077640000000000000000000ffffc0a8a143922363.mp4',
  '0217805433480310000000000000000000ffffc0a8a142e09186.mp4',
  '0217807002078480000000000000000000ffffc0a8aba022aed7.mp4',
]

const MUSIC_CLIPS = [
  'cgt-20260807135044-jl4cb.mp4',
  'cgt-20260808042429-r42dr.mp4',
  'cgt-20260808064211-8r9lh.mp4',
  'sample_0.mp4',
  'ssDblxbgz5C1wS4VRC6y.mp4',
  '0217765651118490000000000000000000ffffc0a885857ca316.mp4',
  '0217765666267790000000000000000000ffffc0a8792eb88c96.mp4',
  '0217786676548480000000000000000000ffffc0a87c69b5c956.mp4',
  '0217815485626240000000000000000000ffffc0a88fa1c0f922.mp4',
  '0217815502532680000000000000000000ffffc0a87ff35d31df.mp4',
  '0217815502730530000000000000000000ffffc0a8712a8e8ac3.mp4',
  '0217815527401250000000000000000000ffffc0a88c3c7c3b9a.mp4',
]

const ANIMATION_CLIPS = [
  'cgt-20260808190147-fjj55.mp4',
  'enhanced (1).mp4',
  'enhanced.mp4',
  'PuPae-05Sv0ym3inyCwbW_5otT4my4.mp4',
  'xai-video-3da86be6-1f9f-4333-bd56-4abd9c820aed.mp4',
  '0217761709635130000000000000000000ffffc0a86cdaa107eb.mp4',
  '0217763737501670000000000000000000ffffc0a89b20c3f280.mp4',
  '0217763754198280000000000000000000ffffc0a88c94242ec5.mp4',
  '0217765651118490000000000000000000ffffc0a885857ca316.mp4',
  '0217765666267790000000000000000000ffffc0a8792eb88c96.mp4',
  '0217770616659340000000000000000000ffffc0a899b5e0abbb.mp4',
  '0217778750624670000000000000000000ffffc0a89a4e4fbfd7.mp4',
  '0217780120547340000000000000000000ffffc0a8790d9dbc39.mp4',
  '0217780704487040000000000000000000ffffc0a87867681504.mp4',
  '0217780875193300000000000000000000ffffc0a89044837719.mp4',
  '0217778431646696000000000000000000ffffc0a89a57c1dc83.mp4',
  '0217778443125310000000000000000000ffffc0a87bf65f07cb.mp4',
  '0217785964194400000000000000000000ffffc0a884a9dee67d.mp4',
  '0217787812473700000000000000000000ffffc0a8845bacc0ad.mp4',
  '0217787862235370000000000000000000ffffc0a8787b7ae64c.mp4',
  '0217788723159850000000000000000000ffffc0a8845bb9ad24.mp4',
  '0217789692408550000000000000000000ffffc0a8790db46873.mp4',
  '0217792920741890000000000000000000ffffc0a8786c552bf8.mp4',
  '0217796421953930000000000000000000ffffc0a8b0cb55038c.mp4',
  '0217796423500640000000000000000000ffffc0a8b0cb98a22b.mp4',
  '0217796539274950000000000000000000ffffc0a8871b982fde.mp4',
  '0217801624038750000000000000000000ffffc0a878ecaff401.mp4',
  '0217801631751530000000000000000000ffffc0a8790acb5a31.mp4',
  '0217804070246380000000000000000000ffffc0a87ff4855f41.mp4',
  '0217804075233170000000000000000000ffffc0a8aba038d7c5.mp4',
  '0217808895582930000000000000000000ffffc0a878ec428c9f.mp4',
  '0217809525694840000000000000000000ffffc0a89a6067159e.mp4',
  '0217815485626240000000000000000000ffffc0a88fa1c0f922.mp4',
  '0217815502730530000000000000000000ffffc0a8712a8e8ac3.mp4',
  '0217815527401250000000000000000000ffffc0a88c3c7c3b9a.mp4',
  '32bd8a18ae4eefe5849ad565adb0fe09-2a958d85-c1f9-48f7-99d8-6876fd2c57d2.mp4',
  '8b5430d52bc1bac3f3becfba5f7e380f-84c26300-dddb-48ba-b96a-4977e4b09f2b.mp4',
  '8c807143ae345f22eb351e7e3f3e879b-a796696a-882f-4529-98eb-698aa9953973.mp4',
  '939ddd60ff3e6e6e91bb29311a36828f-3997dca4-3315-42e9-86b3-58a15a043b4c.mp4',
  'ae2c5de9203ba7a77e4e803889efd9d1-f3e43966-1a9b-4892-a1e9-5a76f95c3271.mp4',
  'bf11ea964aa9bd5c8ba6d09a527d9269-8eebc39a-3411-4055-a2b1-b852321cef41.mp4',
  'c7d320863c0b5319e90696cc36839e9b-e8a5ae76-42a8-4e05-b5b6-4f8e0ea30015.mp4',
  'd354f3014c52d436d548d40ec96b0f54-127e58c8-2f74-4134-9989-ef68eb993d75.mp4',
  'd4c4c0793a0b46e25680cf174246acd3-f6f97919-ec8e-4997-a336-6c7e4e6c636e.mp4',
  'db5f83d06b807bda1e866b58752dd10c-c90b7c1f-9c33-4da3-be77-f460903856ed.mp4',
  'e211a82a90c7315204420ae53c79a293-be4447bf-ffcf-4f7b-9e7a-853f4ce56704.mp4',
  'e54dee51e2fd1bf104f11da3a72122b8-273324e2-f9f6-4e7e-9671-72e1070c107c.mp4',
  'ec2bd96ec7d90ba26884b05627461ba8-74e58110-8594-4ee5-b07c-f4c270733769.mp4',
  '07675ae0f7d3f23fde3901900a2142d1-35a1cec8-3b9d-4036-93ab-e2f6547de5d3.mp4',
  '2cdfdba4ca58a5f0d01555e8a609f8ce-a0f9ff93-6361-4317-86fb-33a270776e3a.mp4',
]

const UGC_CLIPS = [
  'landingpageugc.mp4',
  'enhanced.mp4',
  '0217809415125340000000000000000000ffffc0a8790d8db6a9.mp4',
  '0217815539775300000000000000000000ffffc0a88d49fdb0e9.mp4',
  '0217815546049400000000000000000000ffffc0a86f9f755deb.mp4',
  '0217815548872790000000000000000000ffffc0a88dcd557326.mp4',
  '0217815554844180000000000000000000ffffc0a8712ae47537.mp4',
  '0217815562287740000000000000000000ffffc0a870455556d5.mp4',
]

const EXPLAINER_CLIPS = [
  'facelessstudio.mp4',
  'facelessstudio1.mp4',
  'facelessstudio2.mp4',
  'facelessstudio3.mp4',
  'facelessstudio4.mp4',
  'facelessstudio5.mp4',
  'facelessstudio6.mp4',
  'facelessstudio7.mp4',
  'facelessstudio8.mp4',
  'facelessstudio9.mp4',
]

function clipItems(cat, files) {
  return files.map((file, i) => ({
    id: cat.id + '-' + (i + 1),
    n: i + 1,
    category: cat.id,
    title: cat.label + ' ' + String(i + 1).padStart(2, '0'),
    file,
    src: R2 + '/' + encodeURIComponent(file),
    creator: 'Vidso',
    handle: '@vidso',
    brief: cat.description,
    panel: 'videogen',
  }))
}

export function inspireItems(category) {
  const cat = INSPIRE_CATEGORIES.find((c) => c.id === category) || INSPIRE_CATEGORIES[0]
  if (cat.id === 'marketing') return clipItems(cat, MARKETING_CLIPS)
  if (cat.id === 'film') return clipItems(cat, FILM_CLIPS)
  if (cat.id === 'music') return clipItems(cat, MUSIC_CLIPS)
  if (cat.id === 'animation') return clipItems(cat, ANIMATION_CLIPS)
  if (cat.id === 'ugc') return clipItems(cat, UGC_CLIPS)
  if (cat.id === 'explainer') return clipItems(cat, EXPLAINER_CLIPS)
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: cat.id + '-' + n,
    n,
    category: cat.id,
    title: cat.label + ' ' + String(n).padStart(2, '0'),
    file: 'home-inspire-' + cat.id + '-' + String(n).padStart(2, '0') + '.jpg',
    src: '',
    creator: 'Vidso',
    handle: '@vidso',
    brief: cat.description,
    panel: 'videogen',
  }))
}

export function modelCardFile(slug) {
  return appMedia('model-card-' + slug + '.jpg')
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

export function readShutSecs() {
  try {
    const raw = JSON.parse(localStorage.getItem(SIDEBAR_SECS_KEY) || '{}')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch (_) {
    return {}
  }
}

export function writeShutSecs(map) {
  try { localStorage.setItem(SIDEBAR_SECS_KEY, JSON.stringify(map || {})) } catch (_) {}
}

export function toggleShutSec(id) {
  const next = { ...readShutSecs() }
  if (next[id]) delete next[id]
  else next[id] = 1
  writeShutSecs(next)
  return next
}

export function galleryIcon(id) {
  return TOOL_GALLERY.find((t) => t.id === id)?.icon || ICO[id] || ''
}

function navTool(tool) {
  return {
    id: tool.id,
    name: tool.short || tool.name,
    href: tool.href,
    icon: tool.icon,
    badge: tool.badge || '',
    external: !!tool.external,
  }
}

export { ICO }
