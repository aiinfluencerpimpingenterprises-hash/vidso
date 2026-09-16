/** R2 media for the marketing landing page. Empty `src` / `poster` skips a card
 * or falls back to a coded UI mock. Fill with public Cloudflare URLs later.
 * Do not add media files to the repo.
 */
export const R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'

export const HERO_VIDEO_SRC = R2 + '/VidsoHeroVideo.mp4'
export const HERO_VIDEO_POSTER = '/home/vidso-hero-poster.jpg'

/** Hero → demo scroll timing. Keep in sync with `--hero-pin-vh` in home/landing-redesign.css.
 * pinVh = sticky-stage outer height in vh. aEnd / bEnd / cEnd are 0-1 progress cuts:
 * 0→aEnd hero exits, aEnd→bEnd dark beat, bEnd→cEnd video reveal, cEnd→1 settle. */
export const HERO_TRANSITION = {
  pinVh: 320,
  pinVhMobile: 180,
  aEnd: 0.40,
  bEnd: 0.50,
  cEnd: 0.78,
}

/** Thumbnail Generator demo panel. Empty until a demo MP4 is uploaded to R2. */
export const THUMBNAIL_DEMO_SRC = ''
export const THUMBNAIL_DEMO_POSTER = R2 + '/claudemcpthumbnail.png'

/** Long-form feature panel. Empty until a dedicated demo MP4 is uploaded to R2. */
export const LONGFORM_DEMO_SRC = ''
export const LONGFORM_DEMO_POSTER = '/home/vidso-hero-poster.jpg'

export const CLAUDE_THUMB = R2 + '/claudemcpthumbnail.png'
export const CLAUDE_ICON = R2 + '/claude-ai-icon.webp'

const CAROUSEL = (n) => R2 + '/videocarousel' + n + '.mp4'

/** Cards with media only. Shorts reuse the hero clip at different in-points. */
export const HERO_CARDS = [
  { type: 'long', src: CAROUSEL(1), poster: '' },
  { type: 'short', src: HERO_VIDEO_SRC, poster: HERO_VIDEO_POSTER, start: 3 },
  { type: 'long', src: CAROUSEL(2), poster: '' },
  { type: 'long', src: CAROUSEL(3), poster: '' },
  { type: 'short', src: HERO_VIDEO_SRC, poster: HERO_VIDEO_POSTER, start: 9 },
  { type: 'long', src: CAROUSEL(4), poster: '' },
  { type: 'short', src: HERO_VIDEO_SRC, poster: HERO_VIDEO_POSTER, start: 15 },
  { type: 'long', src: CAROUSEL(5), poster: '' },
  { type: 'long', src: CAROUSEL(6), poster: '' },
  { type: 'short', src: CLAUDE_THUMB, poster: CLAUDE_THUMB },
]

/** Formats the long-form generator actually ships. */
export const IDEA_CARDS = [
  { category: 'Explainer', icon: 'book', aspect: 'long', poster: '', src: CAROUSEL(4) },
  { category: 'Listicle', icon: 'list', aspect: 'long', poster: '', src: CAROUSEL(1) },
  { category: 'Story / Documentary', icon: 'film', aspect: 'long', poster: '', src: CAROUSEL(2) },
  { category: 'Top 10', icon: 'rank', aspect: 'long', poster: '', src: CAROUSEL(6) },
  { category: 'History', icon: 'clock', aspect: 'long', poster: '', src: CAROUSEL(5) },
  { category: 'True Crime', icon: 'search', aspect: 'long', poster: '', src: CAROUSEL(3) },
  { category: 'Science', icon: 'atom', aspect: 'long', poster: '', src: CAROUSEL(7) },
  { category: 'Finance', icon: 'chart', aspect: 'long', poster: '', src: CAROUSEL(10) },
  { category: 'Shorts', icon: 'phone', aspect: 'short', poster: '', src: CAROUSEL(8) },
]

export const SHOWCASE_CARDS = [
  { category: 'NEWS', prompt: 'Make a video on 11 U.S. scientists who went missing or died', src: CAROUSEL(1), poster: '' },
  { category: 'HISTORY', prompt: 'Make a video on how cities were planned in the early 1980s', src: CAROUSEL(2), poster: '' },
  { category: 'EXPLAINER', prompt: 'Make a video on how airports and flight routes keep the world moving', src: CAROUSEL(4), poster: '' },
  { category: 'DOCUMENTARY', prompt: 'Make a video on how cargo ships keep global trade running', src: CAROUSEL(5), poster: '' },
  { category: 'SHORT', prompt: 'Make a 60 second Short on a tiny habit that changes your day', src: CAROUSEL(8), poster: '' },
]

/** How-it-works panel uses a coded mock. Empty so a third-party title clip is never shown. */
export const HOW_PANEL_SRC = ''
export const HOW_PANEL_POSTER = '/home/vidso-hero-poster.jpg'

export const PROMPT_IDEAS = [
  'Make a 12 minute video on airport secrets airlines hide from travelers',
  'Top 10 true stories that sound completely made up',
  'A 60 second Short on the weirdest law still active in the US',
  'The rise and fall of the most expensive failed product ever',
  'Explain how the stock market actually works in 15 minutes',
  '5 abandoned places nobody is allowed to visit',
  'A Short on a psychology trick that makes people trust you',
  'The untold story behind a famous historic heist',
  'What happens to your body if you stop sleeping',
  '10 ancient inventions that were ahead of their time',
]

export const CREATE_HREF = '/signup'

export const VOICEOVER_SCRIPT =
  'Airport security is designed to look thorough. The fees travelers never see coming do more of the work, from bag checks to boarding groups.'
