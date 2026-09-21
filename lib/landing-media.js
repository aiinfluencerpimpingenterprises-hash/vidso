/** R2 media for the marketing landing page.
 * Blank cards stay blank until the matching public file exists.
 * Do not add media files to the repo.
 */
export const R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'
export const LANDING_R2 = R2 + '/landing'

export const HERO_VIDEO_SRC = R2 + '/VidsoHeroVideo.mp4'
export const HERO_VIDEO_POSTER = '/home/vidso-hero-poster.jpg'

/** Preferred PNG slots on /landing. Fallback is the file already in the bucket root. */
export const MCP_AGENT_LOGOS = [
  { file: 'agent-logo-claude.png', fallback: 'claude-ai-icon.webp', client: 'Claude', place: 'key-left, tab, strip' },
  { file: 'agent-logo-chatgpt.png', fallback: 'openai-icon.svg', client: 'ChatGPT', place: 'key-inner-left, tab, strip' },
  { file: 'agent-logo-cursor.png', fallback: 'cursor-ai-code-icon.svg', client: 'Cursor', place: 'key-inner-right, tab, strip' },
  { file: 'agent-logo-kimi.png', fallback: 'kimi-ai-icon.svg', client: 'Kimi', place: 'key-right, tab, strip' },
  { file: 'agent-logo-grok-bot.png', fallback: 'grokbotlogo.jpg', client: 'Grok Bot', place: 'tab, strip' },
  { file: 'agent-logo-claude-code.png', fallback: 'claude-code-icon.png', client: 'Claude Code', place: 'tab, strip' },
  { file: 'agent-logo-openclaw.png', fallback: 'OpenClaw Logo - Colored - zonalogo.com.png', client: 'OpenClaw', place: 'tab, strip' },
  { file: 'agent-logo-hermes.png', fallback: 'Hermes Agent Logo - Black - zonalogo.com.svg', client: 'Hermes', place: 'tab, strip' },
  { file: 'agent-logo-other.png', fallback: '', client: 'Other MCP agents', place: 'tab, strip' },
]

export function mcpAgentLogo(file) {
  return LANDING_R2 + '/' + file
}

export function mcpAgentFallback(file) {
  return file ? R2 + '/' + file : ''
}

/** Placeholder CLI commands. The installer is not in this repo yet. */
export const VIDSO_CLI = {
  unix: 'curl -fsSL https://www.vidso.pro/install.sh | sh',
  windows: 'irm https://www.vidso.pro/install.ps1 | iex',
  login: 'vidso login',
  generate: 'vidso video "12 airport secrets airlines hide" --length 12 --aspect 16:9',
}

/** Prompt pasted into Claude Code, OpenClaw, or Hermes. Uses the real Vidso CLI only. */
export const VIDSO_AGENT_SETUP_PROMPT = `Set up Vidso for me so I can generate YouTube videos from here.
1. Install the CLI: run \`${VIDSO_CLI.unix}\`.
2. Authenticate: run \`${VIDSO_CLI.login}\` and complete the sign-in in the browser it opens.
Once that's done, let me know it's ready.`

/** Setup-card screenshots. Root bucket files first; /landing names stay as fallbacks. */
export const MCP_SETUP_SHOTS = [
  { file: 'Chatgptmcp1', ext: 'png', tab: 'chatgpt' },
  { file: 'Chatgptmcp2', ext: 'png', tab: 'chatgpt' },
  { file: 'Chatgptmcp3', ext: 'png', tab: 'chatgpt' },
  { file: 'kimimcp1', ext: 'png', tab: 'kimi' },
  { file: 'kimimcp2', ext: 'png', tab: 'kimi' },
  { file: 'kimimcp3', ext: 'png', tab: 'kimi' },
]

export const MCP_FEATURE_MEDIA = [
  { file: 'mcp-feature-longform-01', ext: 'mp4', tab: 'longform' },
  { file: 'mcp-shorts-01', ext: 'mp4', tab: 'clips' },
  { file: 'mcp-shorts-02', ext: 'mp4', tab: 'clips' },
  { file: 'mcp-shorts-03', ext: 'mp4', tab: 'clips' },
  { file: 'mcp-thumb-01', ext: 'jpg', tab: 'thumbs' },
  { file: 'mcp-thumb-02', ext: 'jpg', tab: 'thumbs' },
  { file: 'mcp-thumb-03', ext: 'jpg', tab: 'thumbs' },
  { file: 'mcp-thumb-04', ext: 'jpg', tab: 'thumbs' },
  { file: 'mcp-voice-01', ext: 'mp4', tab: 'audio' },
  { file: 'mcp-files-01', ext: 'jpg', tab: 'files' },
  { file: 'mcp-files-02', ext: 'jpg', tab: 'files' },
  { file: 'mcp-files-03', ext: 'jpg', tab: 'files' },
  { file: 'mcp-files-04', ext: 'jpg', tab: 'files' },
  { file: 'mcp-files-05', ext: 'jpg', tab: 'files' },
  { file: 'mcp-files-06', ext: 'jpg', tab: 'files' },
]

export const MCP_CHAT_MEDIA = [
  { file: 'mcp-chat-longform-01', ext: 'mp4', item: 'longform' },
  { file: 'mcp-chat-thumbs-01', ext: 'jpg', item: 'thumbs' },
  { file: 'mcp-chat-clips-01', ext: 'mp4', item: 'clips' },
  { file: 'mcp-chat-voice-01', ext: 'mp4', item: 'voice' },
  { file: 'mcp-chat-files-01', ext: 'jpg', item: 'files' },
  { file: 'mcp-chat-account-01', ext: 'jpg', item: 'account' },
]

export const MCP_CONNECT_TOOLS = [
  'longform_make_video',
  'longform_render_start',
  'thumbnail_generate',
  'clip_analyze',
  'clip_start',
  'voiceover_generate',
  'captions_transcribe',
  'files_list',
  'vidso_account',
  'vidso_catalog',
  'youtube_upload',
  'ranking_start',
]

export const MCP_CONNECT_LABELS = {
  longform_make_video: 'Long-form video',
  longform_render_start: 'Captions and render',
  thumbnail_generate: 'Thumbnails',
  clip_analyze: 'Find clip moments',
  clip_start: 'Start clipping',
  voiceover_generate: 'Voiceover',
  captions_transcribe: 'Captions',
  files_list: 'My Files',
  vidso_account: 'Plan and quota',
  vidso_catalog: 'Available tools',
  youtube_upload: 'YouTube upload',
  ranking_start: 'Rank clips',
}

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
  { file: 'hero-card-01', type: 'long', aspect: '16:9', label: 'Long-form', src: landingVideo('hero-card', 1), poster: landingPoster('hero-card', 1) },
  { file: 'hero-card-02', type: 'short', aspect: '9:16', label: 'Short', src: landingVideo('hero-card', 2), poster: landingPoster('hero-card', 2) },
  { file: 'hero-card-03', type: 'short', aspect: '9:16', label: 'Ad', src: landingVideo('hero-card', 3), poster: landingPoster('hero-card', 3) },
  { file: 'hero-card-04', type: 'short', aspect: '9:16', label: 'UGC', src: landingVideo('hero-card', 4), poster: landingPoster('hero-card', 4) },
  { file: 'hero-card-05', type: 'long', aspect: '16:9', label: 'Explainer', src: landingVideo('hero-card', 5), poster: landingPoster('hero-card', 5) },
  { file: 'hero-card-06', type: 'long', aspect: '16:9', label: 'Product', src: landingVideo('hero-card', 6), poster: landingPoster('hero-card', 6) },
  { file: 'hero-card-07', type: 'long', aspect: '16:9', label: 'Thumbnail', src: landingVideo('hero-card', 7), poster: landingPoster('hero-card', 7) },
  { file: 'hero-card-08', type: 'long', aspect: '16:9', label: 'Voiceover', src: landingVideo('hero-card', 8), poster: landingPoster('hero-card', 8) },
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
  'A 30 second product ad for a wireless headphone launch',
]

/** Formats carousel. Imported from capability so the filename table stays in one place. */
export { FORMAT_CARDS as SHORTS_CARDS } from './landing-capability.js'

/** @deprecated Use SHORTS_CARDS. Kept so older tests/imports keep resolving. */
export { FORMAT_CARDS as IDEA_CARDS } from './landing-capability.js'

export const SHOWCASE_CARDS = [
  { category: 'DOCUMENTARY', prompt: 'Make a 12 minute video on how cargo ships keep global trade running', src: CAROUSEL(5), poster: '' },
  { category: 'AD', prompt: 'Make a 30 second product ad for a wireless headphone launch', src: CAROUSEL(4), poster: '' },
  { category: 'UGC', prompt: 'Make a vertical UGC clip reviewing a kitchen gadget', src: CAROUSEL(1), poster: '' },
  { category: 'PRODUCT', prompt: 'Make a product video that walks through a new camera in 8 minutes', src: CAROUSEL(2), poster: '' },
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
export { APP_HOME_HREF as GENERATE_HREF } from './public-tools.js'

/** Landing announcement bar. Change this object to swap a future banner. */
export const LANDING_ANNOUNCE = {
  key: 'announce_seedream5pro_v2',
  text: 'Seedream 5.0 Pro is now available in the Thumbnail Generator.',
  textMobile: 'Seedream 5.0 Pro now in Thumbnail Generator',
  cta: 'Try it now ›',
  href: '/dashboard',
}

export const VOICEOVER_SCRIPT =
  'Airport security is designed to look thorough. The fees travelers never see coming do more of the work, from bag checks to boarding groups.'
