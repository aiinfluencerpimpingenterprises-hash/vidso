/** Public tool routes, mega-menu copy, and SEO. Descriptions come from in-app
 * headings/subtitles or existing landing/gallery copy. Do not invent features. */

export const GENERATE_HREF = '/video-generation'
export const PRICING_HREF = '/home#pricing'

export const PRIVATE_TOOL_PATHS = ['/dashboard', '/files']

export const PUBLIC_TOOL_PATHS = [
  '/video-generation',
  '/youtube-generation',
  '/image-generation',
  '/clipping',
  '/ranking',
  '/captions',
  '/voiceover',
  '/reframe',
  '/editor',
  '/downloader',
  '/commentary',
  '/tools',
]

export function normalizeAppPath(path) {
  const p = String(path || '').replace(/\/+$/, '') || '/'
  return p
}

export function isPublicToolPath(path) {
  return PUBLIC_TOOL_PATHS.includes(normalizeAppPath(path))
}

export function isPrivateToolPath(path) {
  return PRIVATE_TOOL_PATHS.includes(normalizeAppPath(path))
}

/** One-line descriptions from the tool page or existing gallery/landing copy. */
export const TOOL_MENU_ITEMS = {
  videogen: {
    name: 'Long Form Generator',
    href: '/video-generation',
    description: 'Turn a topic into a narrated short or long-form video: script, voice, B-roll, and captions.',
  },
  editor: {
    name: 'Video Editor',
    href: '/editor',
    description: 'Multi-track timeline',
    sourced: 'gallery',
  },
  commentary: {
    name: 'Video Commentary',
    href: '/commentary',
    description: 'Voice and captions on clips',
    sourced: 'gallery',
  },
  downloader: {
    name: 'Video Downloader',
    href: '/downloader',
    description: 'Download videos from YouTube, TikTok, Instagram, Twitter, Reddit and more.',
  },
  clipper: {
    name: 'Clipping',
    href: '/clipping',
    description: 'Paste a link. Vidso finds the best moments and reframes them to 9:16.',
  },
  ranking: {
    name: 'Ranking',
    href: '/ranking',
    description: 'Assemble ranked short videos with a live 9:16 preview.',
  },
  reframe: {
    name: 'AI Reframe',
    href: '/reframe',
    description: 'Auto-fit landscape footage into a vertical or square crop around the subject.',
  },
  voiceover: {
    name: 'AI Voiceover',
    href: '/voiceover',
    description: 'Choose a voice and type your script. Get a studio-quality MP3 back instantly.',
  },
  captions: {
    name: 'AI Captions',
    href: '/captions',
    description: 'Upload a video or paste a URL to auto-transcribe. Get a full SRT caption file back.',
  },
  imagegen: {
    name: 'Thumbnail Generator',
    href: '/image-generation',
    description: 'Describe a scene, a subject, a mood, or a style, and watch it come to life.',
  },
  mcp: {
    name: 'Vidso MCP',
    href: '/mcp',
    description: 'Run Vidso from Claude, ChatGPT, Cursor, or Kimi.',
  },
}

export const TOOL_MENU_COLUMNS = [
  { id: 'create', label: 'Create', items: ['videogen', 'imagegen'] },
  { id: 'short-form', label: 'Short form', items: ['clipper', 'ranking', 'reframe', 'commentary'] },
  { id: 'audio', label: 'Audio and captions', items: ['voiceover', 'captions'] },
  { id: 'edit', label: 'Edit', items: ['editor', 'downloader'] },
  { id: 'popular', label: 'Popular', items: ['videogen', 'imagegen', 'clipper', 'mcp'], popular: true },
]

export const EXCLUDED_TOOLS = [
  { name: 'Dashboard', reason: 'Stays private. Logged-out visitors redirect to login.' },
  { name: 'My Files', reason: 'Stays private. Logged-out visitors redirect to login.' },
  { name: 'Faceless Studio', reason: 'Archived in app chrome. Route falls back to Long Form Generator.' },
  { name: 'YouTube Generator', reason: 'Alias of Long Form Generator, not a separate shipped tool.' },
  { name: 'Short Form Tools gallery', reason: 'In-app /tools hub, not a generator. Items are listed in their groups instead.' },
]

export const TOOL_SEO = {
  '/video-generation': {
    title: 'Long Form Generator · Vidso',
    description: 'Turn a topic into a narrated short or long-form YouTube video: script, voice, B-roll, and captions.',
    index: true,
  },
  '/youtube-generation': {
    title: 'Long Form Generator · Vidso',
    description: 'Turn a topic into a narrated short or long-form YouTube video: script, voice, B-roll, and captions.',
    index: true,
  },
  '/image-generation': {
    title: 'Thumbnail Generator · Vidso',
    description: 'Describe a scene, a subject, a mood, or a style, and generate a YouTube thumbnail.',
    index: true,
  },
  '/clipping': {
    title: 'Clipping · Vidso',
    description: 'Paste a link. Vidso finds the best moments and reframes them to 9:16.',
    index: true,
  },
  '/ranking': {
    title: 'Ranking · Vidso',
    description: 'Assemble ranked short videos with a live 9:16 preview.',
    index: true,
  },
  '/captions': {
    title: 'AI Captions · Vidso',
    description: 'Upload a video or paste a URL to auto-transcribe and get a full SRT caption file.',
    index: true,
  },
  '/voiceover': {
    title: 'AI Voiceover · Vidso',
    description: 'Choose a voice and type your script. Get a studio-quality MP3 back instantly.',
    index: true,
  },
  '/reframe': {
    title: 'AI Reframe · Vidso',
    description: 'Auto-fit landscape footage into a vertical or square crop around the subject.',
    index: true,
  },
  '/editor': {
    title: 'Video Editor · Vidso',
    description: 'Edit on a multi-track timeline in Vidso.',
    index: true,
  },
  '/downloader': {
    title: 'Video Downloader · Vidso',
    description: 'Download videos from YouTube, TikTok, Instagram, Twitter, Reddit and more.',
    index: true,
  },
  '/commentary': {
    title: 'Video Commentary · Vidso',
    description: 'Add voice and captions on clips.',
    index: true,
  },
  '/tools': {
    title: 'Short Form Tools · Vidso',
    description: 'Every Vidso tool in one place.',
    index: true,
  },
  '/dashboard': {
    title: 'Dashboard · Vidso',
    description: 'Your usage and shortcuts in one place.',
    index: false,
  },
  '/files': {
    title: 'My Files · Vidso',
    description: 'Every video and thumbnail you generate is kept here.',
    index: false,
  },
}

export function seoForPath(path) {
  return TOOL_SEO[normalizeAppPath(path)] || null
}

export function applyToolSeo(path, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return
  const seo = seoForPath(path)
  if (!seo) return
  doc.title = seo.title
  let desc = doc.querySelector('meta[name="description"]')
  if (!desc) {
    desc = doc.createElement('meta')
    desc.setAttribute('name', 'description')
    doc.head.appendChild(desc)
  }
  desc.setAttribute('content', seo.description)
  let robots = doc.querySelector('meta[name="robots"]')
  if (!robots) {
    robots = doc.createElement('meta')
    robots.setAttribute('name', 'robots')
    doc.head.appendChild(robots)
  }
  robots.setAttribute('content', seo.index ? 'index,follow' : 'noindex,nofollow')
}
