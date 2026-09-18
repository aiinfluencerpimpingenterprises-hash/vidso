/** R2 media for the marketing landing page.
 * Blank cards stay blank until the matching public file exists.
 * Do not add media files to the repo.
 */
export const R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'
export const LANDING_R2 = R2 + '/landing'

export const HERO_VIDEO_SRC = R2 + '/VidsoHeroVideo.mp4'
export const HERO_VIDEO_POSTER = '/home/vidso-hero-poster.jpg'

/** Agent marks already in the public R2 bucket root. Missing files stay blank. */
export const MCP_AGENT_LOGOS = [
  { file: 'claude-ai-icon.webp', client: 'Claude', place: 'key-left, tab, strip' },
  { file: 'openai-icon.svg', client: 'ChatGPT', place: 'key-inner-left, tab, strip' },
  { file: 'cursor-ai-code-icon.svg', client: 'Cursor', place: 'key-inner-right, tab, strip' },
  { file: 'kimi-ai-icon.svg', client: 'Kimi', place: 'key-right, tab, strip' },
]

export function mcpAgentLogo(file) {
  return R2 + '/' + file
}

export const MCP_FEATURE_MEDIA = [
  { file: 'mcp-feature-01', tab: 'longform' },
  { file: 'mcp-feature-02', tab: 'clips' },
  { file: 'mcp-feature-03', tab: 'thumbs' },
  { file: 'mcp-feature-04', tab: 'audio' },
  { file: 'mcp-feature-05', tab: 'files' },
  { file: 'mcp-feature-06', tab: 'connect' },
]

export const MCP_CHAT_MEDIA = [
  { file: 'mcp-chat-01', item: 'longform' },
  { file: 'mcp-chat-02', item: 'thumbs' },
  { file: 'mcp-chat-03', item: 'clips' },
  { file: 'mcp-chat-04', item: 'voice' },
  { file: 'mcp-chat-05', item: 'files' },
  { file: 'mcp-chat-06', item: 'account' },
]

/** Thumbnail Generator demo panel. Empty until a demo MP4 is uploaded to R2. */
export const THUMBNAIL_DEMO_SRC = ''
export const THUMBNAIL_DEMO_POSTER = R2 + '/thumbnail1.png'

/** Long-form feature panel uses the existing hero pipeline clip. */
export const LONGFORM_DEMO_SRC = HERO_VIDEO_SRC
export const LONGFORM_DEMO_POSTER = '/home/vidso-hero-poster.jpg'
export const LONGFORM_DEMO_START = 12

export const CLAUDE_THUMB = R2 + '/claudemcpthumbnail.png'
export const CLAUDE_ICON = R2 + '/claude-ai-icon.webp'
export const OPENAI_ICON = R2 + '/openai-icon.svg'
export const CURSOR_ICON = R2 + '/cursor-ai-code-icon.svg'
export const KIMI_ICON = R2 + '/kimi-ai-icon.svg'

export const STILL = {
  thumb: R2 + '/thumbnail.png',
  thumb1: R2 + '/thumbnail1.png',
  thumb2: R2 + '/thumbnail2.png',
  thumb3: R2 + '/thumbnail3.png',
  script: R2 + '/Script.png',
  media: R2 + '/Media.png',
  export: R2 + '/Export.png',
  hero: HERO_VIDEO_POSTER,
  claude: CLAUDE_THUMB,
}

const CAROUSEL = (n) => R2 + '/videocarousel' + n + '.mp4'
export const carouselSrc = CAROUSEL

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function landingVideo(kind, n) {
  return LANDING_R2 + '/' + kind + '-' + pad2(n) + '.mp4'
}

export function landingPoster(kind, n) {
  return LANDING_R2 + '/' + kind + '-' + pad2(n) + '.jpg'
}

/** Hero marquee cards. Media is optional: missing files stay blank. */
export const HERO_CARDS = [
  { file: 'hero-card-01', type: 'long', aspect: '16:9', label: 'Documentary', src: landingVideo('hero-card', 1), poster: landingPoster('hero-card', 1) },
  { file: 'hero-card-02', type: 'short', aspect: '9:16', label: 'Shorts', src: landingVideo('hero-card', 2), poster: landingPoster('hero-card', 2) },
  { file: 'hero-card-03', type: 'long', aspect: '16:9', label: 'Explainer', src: landingVideo('hero-card', 3), poster: landingPoster('hero-card', 3) },
  { file: 'hero-card-04', type: 'long', aspect: '16:9', label: 'Listicle', src: landingVideo('hero-card', 4), poster: landingPoster('hero-card', 4) },
  { file: 'hero-card-05', type: 'short', aspect: '9:16', label: 'Shorts', src: landingVideo('hero-card', 5), poster: landingPoster('hero-card', 5) },
  { file: 'hero-card-06', type: 'long', aspect: '16:9', label: 'Story', src: landingVideo('hero-card', 6), poster: landingPoster('hero-card', 6) },
  { file: 'hero-card-07', type: 'long', aspect: '16:9', label: 'History', src: landingVideo('hero-card', 7), poster: landingPoster('hero-card', 7) },
  { file: 'hero-card-08', type: 'short', aspect: '9:16', label: 'Shorts', src: landingVideo('hero-card', 8), poster: landingPoster('hero-card', 8) },
]

/** Hero prompt typing loop. Long-form first. */
export const HERO_PROMPTS = [
  'Make a 12 minute video on airport secrets airlines hide from travelers',
  'Top 10 true stories that sound completely made up',
  'The rise and fall of the most expensive failed product ever',
  'Explain how the stock market actually works in 15 minutes',
  '5 abandoned places nobody is allowed to visit',
  'The untold story behind a famous historic heist',
  'What happens to your body if you stop sleeping',
  'A 60 second Short on the weirdest law still active in the US',
]

/** Shorts carousel. Categories stay visible; media is optional. */
export const SHORTS_CARDS = [
  { category: 'Explainer', icon: 'book', file: 'shorts-card-01', src: landingVideo('shorts-card', 1), poster: landingPoster('shorts-card', 1) },
  { category: 'Listicle', icon: 'list', file: 'shorts-card-02', src: landingVideo('shorts-card', 2), poster: landingPoster('shorts-card', 2) },
  { category: 'Story', icon: 'film', file: 'shorts-card-03', src: landingVideo('shorts-card', 3), poster: landingPoster('shorts-card', 3) },
  { category: 'Top 10', icon: 'rank', file: 'shorts-card-04', src: landingVideo('shorts-card', 4), poster: landingPoster('shorts-card', 4) },
  { category: 'History', icon: 'clock', file: 'shorts-card-05', src: landingVideo('shorts-card', 5), poster: landingPoster('shorts-card', 5) },
  { category: 'True Crime', icon: 'search', file: 'shorts-card-06', src: landingVideo('shorts-card', 6), poster: landingPoster('shorts-card', 6) },
  { category: 'Science', icon: 'atom', file: 'shorts-card-07', src: landingVideo('shorts-card', 7), poster: landingPoster('shorts-card', 7) },
  { category: 'Finance', icon: 'chart', file: 'shorts-card-08', src: landingVideo('shorts-card', 8), poster: landingPoster('shorts-card', 8) },
  { category: 'Motivation', icon: 'phone', file: 'shorts-card-09', src: landingVideo('shorts-card', 9), poster: landingPoster('shorts-card', 9) },
]

/** @deprecated Use SHORTS_CARDS. Kept so older tests/imports keep resolving. */
export const IDEA_CARDS = SHORTS_CARDS

export const SHOWCASE_CARDS = [
  { category: 'DOCUMENTARY', prompt: 'Make a video on how cargo ships keep global trade running', src: CAROUSEL(5), poster: '' },
  { category: 'EXPLAINER', prompt: 'Make a video on how airports and flight routes keep the world moving', src: CAROUSEL(4), poster: '' },
  { category: 'NEWS', prompt: 'Make a video on 11 U.S. scientists who went missing or died', src: CAROUSEL(1), poster: '' },
  { category: 'HISTORY', prompt: 'Make a video on how cities were planned in the early 1980s', src: CAROUSEL(2), poster: '' },
]

/** How-it-works panel uses a coded mock. Empty so a third-party title clip is never shown. */
export const HOW_PANEL_SRC = ''
export const HOW_PANEL_POSTER = '/home/vidso-hero-poster.jpg'

export const SHORTS_PROMPTS = [
  'A 60 second Short on the weirdest law still active in the US',
  'A Short on a psychology trick that makes people trust you',
  'A 45 second Short on a tiny habit that changes your day',
  'A Short on the most expensive mistake in history',
  'A 30 second Short on why airplane windows are round',
  'A Short on a fact about space that sounds fake',
  'A 60 second Short on the story behind a famous logo',
  'A Short on what happens to your body when you drink only water',
]

export const PROMPT_IDEAS = SHORTS_PROMPTS

export const CREATE_HREF = '/signup'
export const GENERATE_HREF = '/video-generation'

/** Landing announcement bar. Change this object to swap a future banner. */
export const LANDING_ANNOUNCE = {
  key: 'announce_seedream5pro_v2',
  text: 'Seedream 5.0 Pro is now available in the Thumbnail Generator.',
  textMobile: 'Seedream 5.0 Pro now in Thumbnail Generator',
  cta: 'Try it now ›',
  href: '/image-generation',
}

export const VOICEOVER_SCRIPT =
  'Airport security is designed to look thorough. The fees travelers never see coming do more of the work, from bag checks to boarding groups.'
