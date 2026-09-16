/** R2 media for the marketing landing page. Empty `src` / `poster` renders a labeled placeholder.
 * Fill these with public Cloudflare URLs later. Do not add media files to the repo.
 */
export const R2 = 'https://pub-f40c956471ff49feab622906892ec527.r2.dev'

export const HERO_VIDEO_SRC = R2 + '/VidsoHeroVideo.mp4'
export const HERO_VIDEO_POSTER = '/home/vidso-hero-poster.jpg'

/** Hero → demo scroll timing. Keep in sync with `--hero-pin-vh` in home/landing-redesign.css.
 * pinVh = sticky-stage outer height in vh. aEnd / bEnd / cEnd are 0-1 progress cuts:
 * 0→aEnd hero exits, aEnd→bEnd dark beat, bEnd→cEnd video reveal, cEnd→1 settle. */
export const HERO_TRANSITION = {
  pinVh: 280,
  pinVhMobile: 180,
  aEnd: 0.40,
  bEnd: 0.50,
  cEnd: 0.80,
}

/** Thumbnail Generator demo panel. Empty until a demo MP4 is uploaded to R2. */
export const THUMBNAIL_DEMO_SRC = ''
export const THUMBNAIL_DEMO_POSTER = ''

export const CLAUDE_THUMB = R2 + '/claudemcpthumbnail.png'
export const CLAUDE_ICON = R2 + '/claude-ai-icon.webp'

const CAROUSEL = (n) => R2 + '/videocarousel' + n + '.mp4'

/** ~60% 16:9, ~40% 9:16. Long cards use existing R2 clips; Shorts stay blank. */
export const HERO_CARDS = [
  { type: 'long', src: CAROUSEL(1), poster: '' },
  { type: 'short', src: '', poster: '' },
  { type: 'long', src: CAROUSEL(2), poster: '' },
  { type: 'long', src: CAROUSEL(3), poster: '' },
  { type: 'short', src: '', poster: '' },
  { type: 'long', src: CAROUSEL(4), poster: '' },
  { type: 'short', src: '', poster: '' },
  { type: 'long', src: CAROUSEL(5), poster: '' },
  { type: 'long', src: CAROUSEL(6), poster: '' },
  { type: 'short', src: '', poster: '' },
]

/** Formats the long-form generator actually ships. */
export const IDEA_CARDS = [
  { category: 'Explainer', icon: 'book', aspect: 'long', poster: '', src: '' },
  { category: 'Listicle', icon: 'list', aspect: 'long', poster: '', src: '' },
  { category: 'Story', icon: 'film', aspect: 'long', poster: '', src: '' },
  { category: 'Documentary', icon: 'cam', aspect: 'long', poster: '', src: '' },
  { category: 'Top 10', icon: 'rank', aspect: 'long', poster: '', src: '' },
  { category: 'History', icon: 'clock', aspect: 'long', poster: '', src: '' },
  { category: 'Shorts', icon: 'phone', aspect: 'short', poster: '', src: '' },
  { category: 'True Crime', icon: 'search', aspect: 'long', poster: '', src: '' },
  { category: 'Science', icon: 'atom', aspect: 'long', poster: '', src: '' },
  { category: 'Finance', icon: 'chart', aspect: 'long', poster: '', src: '' },
]

export const SHOWCASE_CARDS = [
  { category: 'EXPLAINER', prompt: 'Make a video on how airports make more money than airlines', src: CAROUSEL(1), poster: '' },
  { category: 'LISTICLE', prompt: 'Make a video on the top 10 scary stories that are actually true', src: CAROUSEL(2), poster: '' },
  { category: 'STORY', prompt: 'Make a video on the untold story behind a famous historic heist', src: CAROUSEL(3), poster: '' },
  { category: 'DOCUMENTARY', prompt: 'Make a video on abandoned places nobody is allowed to visit', src: CAROUSEL(7), poster: '' },
  { category: 'SHORT', prompt: 'Make a 60 second Short on the weirdest law still active in the US', src: CAROUSEL(8), poster: '' },
]

/** Background clip for the 3-step workflow panel. */
export const HOW_PANEL_SRC = CAROUSEL(9)

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
