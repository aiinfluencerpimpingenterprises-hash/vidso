/** R2 media for the marketing landing page.
 * Blank cards stay blank until the matching public file exists.
 * Do not add media files to the repo.
 */
export const R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'
export const LANDING_R2 = R2 + '/landing'

export const HERO_VIDEO_SRC = R2 + '/VidsoHeroVideo.mp4'
export const HERO_VIDEO_POSTER = '/home/vidso-hero-poster.jpg'

/** Hero → demo scroll timing. Keep in sync with `--hero-pin-vh` in home/landing-redesign.css.
 * pinVh = sticky-stage outer height in vh. aEnd / bEnd / cEnd are 0-1 progress cuts:
 * 0→aEnd hero exits, aEnd→bEnd dark beat, bEnd→cEnd video reveal, cEnd→1 settle. */
export const HERO_TRANSITION = {
  pinVh: 240,
  pinVhMobile: 160,
  aEnd: 0.36,
  bEnd: 0.46,
  cEnd: 0.92,
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

/** Floating hero cards. Media is optional: missing files stay blank. */
export const HERO_CARDS = [
  { file: 'hero-card-01', type: 'long', aspect: '16:9', side: 'left', y: 0.16, r: -8, src: landingVideo('hero-card', 1), poster: landingPoster('hero-card', 1) },
  { file: 'hero-card-02', type: 'short', aspect: '9:16', side: 'right', y: 0.18, r: 8, src: landingVideo('hero-card', 2), poster: landingPoster('hero-card', 2) },
  { file: 'hero-card-03', type: 'long', aspect: '16:9', side: 'left', y: 0.40, r: -6, src: landingVideo('hero-card', 3), poster: landingPoster('hero-card', 3) },
  { file: 'hero-card-04', type: 'long', aspect: '16:9', side: 'right', y: 0.42, r: 7, src: landingVideo('hero-card', 4), poster: landingPoster('hero-card', 4) },
  { file: 'hero-card-05', type: 'short', aspect: '9:16', side: 'left', y: 0.64, r: 5, src: landingVideo('hero-card', 5), poster: landingPoster('hero-card', 5) },
  { file: 'hero-card-06', type: 'long', aspect: '16:9', side: 'right', y: 0.66, r: -7, src: landingVideo('hero-card', 6), poster: landingPoster('hero-card', 6) },
  { file: 'hero-card-07', type: 'long', aspect: '16:9', side: 'left', y: 0.86, r: 6, src: landingVideo('hero-card', 7), poster: landingPoster('hero-card', 7) },
  { file: 'hero-card-08', type: 'short', aspect: '9:16', side: 'right', y: 0.86, r: -5, src: landingVideo('hero-card', 8), poster: landingPoster('hero-card', 8) },
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

/** Landing announcement bar. Change this object to swap a future banner. */
export const LANDING_ANNOUNCE = {
  key: 'announce_seedream5pro',
  text: 'Seedream 5.0 Pro is now available in the Thumbnail Generator.',
  textMobile: 'Seedream 5.0 Pro now in Thumbnail Generator',
  cta: 'Try it now ›',
  href: '/image-generation',
}

export const VOICEOVER_SCRIPT =
  'Airport security is designed to look thorough. The fees travelers never see coming do more of the work, from bag checks to boarding groups.'
