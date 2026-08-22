/**
 * In-app tour config. Copy lives here only.
 *
 * @typedef {'welcome' | 'videogen' | 'shortform' | 'longform' | 'workspace' | 'account'} TourChapter
 * @typedef {'center' | 'top' | 'bottom' | 'left' | 'right' | 'auto'} TourPlacement
 *
 * @typedef {Object} TourStep
 * @property {string} id
 * @property {TourChapter} chapter
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} body
 * @property {string | null} target
 * @property {TourPlacement} [placement]
 * @property {string} [route]
 * @property {string} [precondition]
 * @property {boolean} [needsNav]
 * @property {'setup' | 'script' | 'media' | 'preview' | 'export'} [fvStage]
 * @property {'broll' | 'captions' | 'music'} [sideTab]
 */

/** @type {{ id: TourChapter, label: string }[]} */
export const TOUR_CHAPTERS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'videogen', label: 'Video Generation' },
  { id: 'shortform', label: 'Short form' },
  { id: 'longform', label: 'Long form' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'account', label: 'Account' },
]

/** @type {TourStep[]} */
export const TOUR_STEPS = [
  {
    id: 'welcome',
    chapter: 'welcome',
    eyebrow: 'Welcome',
    title: 'Welcome to Vidso',
    body: 'This walkthrough covers the real controls: topic, length, voice, script, media, captions, music, and export. After that, we cover the rest of the dashboard. You can skip at any time.',
    target: null,
    placement: 'center',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-nav',
    chapter: 'videogen',
    eyebrow: 'Start here',
    title: 'Video Generation',
    body: 'This is the faceless pipeline: a topic becomes a narrated short or long-form video with script, voice, B-roll, and captions.',
    target: '#nav-videogen',
    placement: 'auto',
    route: 'videogen',
    needsNav: true,
    fvStage: 'setup',
  },
  {
    id: 'vg-pipeline',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Four stages',
    body: 'You stay in this tool the whole way. Generate, edit, then render an MP4.',
    target: '#fv-stepper',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-topic',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Topic / prompt',
    body: 'Describe the video. The script writer uses this as the brief for hooks, sections, and narration.',
    target: '#fv-field-topic',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-length',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Shorts or long-form',
    body: 'Shorts are 30–60s, and long-form goes up to your plan cap (10, 15, or 30 min). Length chips only show what your plan includes.',
    target: '#fv-field-length',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-aspect',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Aspect ratio',
    body: '9:16 for Shorts, Reels, and TikTok. 16:9 for YouTube long-form.',
    target: '#fv-field-aspect',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-voice',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Narrator voice',
    body: 'Pick a narrator voice and preview it before you generate. The voice you choose is used for the whole narration.',
    target: '#fv-field-voice',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-generate',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Generate Script',
    body: 'This writes a structured script you can edit section by section, regenerate, or clear, then continue to media.',
    target: '#fv-gen-script-btn',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'vg-script',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Edit the script',
    body: 'Rewrite any section with AI or edit it yourself. Regenerate the full script, then continue to media when the narration is right.',
    target: '#fv-script-box',
    placement: 'auto',
    route: 'videogen',
    precondition: 'fv-demo',
    fvStage: 'script',
  },
  {
    id: 'vg-media',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Voiceover + B-roll',
    body: 'Media builds the voiceover, word-level captions, B-roll clips, and a timeline matched to the narration. Re-run if you want a new cut.',
    target: '#fv-media-box',
    placement: 'auto',
    route: 'videogen',
    precondition: 'fv-demo',
    fvStage: 'media',
  },
  {
    id: 'vg-preview-broll',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Preview: B-roll',
    body: 'Replace any clip, shuffle all, even out timing, search Pexels, or upload your own footage. Play the stage to preview the cut.',
    target: '#fv-side',
    placement: 'auto',
    route: 'videogen',
    precondition: 'fv-demo',
    fvStage: 'preview',
    sideTab: 'broll',
  },
  {
    id: 'vg-preview-captions',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Preview: captions',
    body: 'Style the on-screen captions: font, size, fill color, highlight color, and letter spacing. Changes show on the preview stage.',
    target: '#fv-pane-captions',
    placement: 'auto',
    route: 'videogen',
    precondition: 'fv-demo',
    fvStage: 'preview',
    sideTab: 'captions',
  },
  {
    id: 'vg-preview-music',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Preview: music',
    body: 'Add background music and set volume under the voiceover. Audition a track, then hear it with Play on the preview.',
    target: '#fv-pane-music',
    placement: 'auto',
    route: 'videogen',
    precondition: 'fv-demo',
    fvStage: 'preview',
    sideTab: 'music',
  },
  {
    id: 'vg-export',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'Render and download',
    body: 'Export burns captions and music into a final MP4. Render, download, or render again if you change the cut.',
    target: '#fv-export-box',
    placement: 'auto',
    route: 'videogen',
    precondition: 'fv-demo',
    fvStage: 'export',
  },
  {
    id: 'vg-how',
    chapter: 'videogen',
    eyebrow: 'Video Generation',
    title: 'That is the core flow',
    body: 'That covers the main pipeline. The rest of the sidebar handles clipping, ranking, thumbnails, and extra tools.',
    target: '#fv-how',
    placement: 'auto',
    route: 'videogen',
    fvStage: 'setup',
  },
  {
    id: 'clipper',
    chapter: 'shortform',
    eyebrow: 'Short form',
    title: 'Clipping',
    body: 'Paste a YouTube, TikTok, Instagram, or X link, or search and pick a video. Vidso finds viral moments and reframes them to 9:16.',
    target: '#clip-hero',
    placement: 'auto',
    route: 'clipper',
  },
  {
    id: 'clipper-discover',
    chapter: 'shortform',
    eyebrow: 'Short form',
    title: 'Or pick a video',
    body: 'Search YouTube, browse Recommended, Entertainment, Sport, or Podcasts, or upload a file. Then Vidso finds the best 9:16 moments.',
    target: '#clip-discover',
    placement: 'auto',
    route: 'clipper',
  },
  {
    id: 'ranking',
    chapter: 'shortform',
    eyebrow: 'Short form',
    title: 'Ranking',
    body: 'Build ranked short videos: pick a count, style the title, and preview in 9:16 before you export.',
    target: '#ranking-header',
    placement: 'auto',
    route: 'ranking',
  },
  {
    id: 'imagegen',
    chapter: 'longform',
    eyebrow: 'Long form',
    title: 'Thumbnail Generator',
    body: 'Type a prompt in the chatbox. Pick 16:9 or 9:16 — results show above.',
    target: '#img-prompt-pane',
    placement: 'auto',
    route: 'imagegen',
  },
  {
    id: 'tools-create',
    chapter: 'workspace',
    eyebrow: 'Workspace',
    title: 'Create tools',
    body: 'AI Captions (transcribe and burn-in), AI Voiceover (ElevenLabs), and AI Reframe (auto 9:16).',
    target: '#tools-group-create',
    placement: 'auto',
    route: 'tools',
  },
  {
    id: 'tools-edit',
    chapter: 'workspace',
    eyebrow: 'Workspace',
    title: 'Edit tools',
    body: 'Open Video Editor, Downloader, or Commentary. Commentary adds voice and captions onto an existing clip.',
    target: '#tools-group-edit',
    placement: 'auto',
    route: 'tools',
  },
  {
    id: 'tools-files',
    chapter: 'workspace',
    eyebrow: 'Workspace',
    title: 'My Files',
    body: 'Uploads and finished exports live here so you can download them later.',
    target: '#tools-group-manage',
    placement: 'auto',
    route: 'tools',
  },
  {
    id: 'dashboard',
    chapter: 'workspace',
    eyebrow: 'Workspace',
    title: 'Dashboard home',
    body: 'See your usage, shortcuts back into Video Generation, and recent files.',
    target: '#dash-quick-actions',
    placement: 'auto',
    route: 'dashboard',
  },
  {
    id: 'quota',
    chapter: 'account',
    eyebrow: 'Account',
    title: 'Monthly videos',
    body: 'Long-form and short-form remaining this billing window. These match the plan cards, not a separate credit balance.',
    target: '#credits-pill',
    placement: 'auto',
    route: 'dashboard',
  },
  {
    id: 'account',
    chapter: 'account',
    eyebrow: 'Account',
    title: 'Replay this tour',
    body: 'Open Getting started to replay this walkthrough. Use settings next to your name for billing and account.',
    target: '#user-getting-started-btn',
    placement: 'auto',
    route: 'dashboard',
    needsNav: true,
  },
]

export function tourChapterIndex(chapter) {
  return TOUR_CHAPTERS.findIndex((c) => c.id === chapter)
}

export function tourChapterLabel(chapter) {
  return TOUR_CHAPTERS.find((c) => c.id === chapter)?.label || 'Tour'
}

export function tourStepsInChapter(chapter) {
  return TOUR_STEPS.filter((s) => s.chapter === chapter)
}

/** Index of the first step in the next chapter, or steps.length if this is the last. */
export function tourNextChapterStart(stepIndex) {
  const step = TOUR_STEPS[stepIndex]
  if (!step) return TOUR_STEPS.length
  const i = tourChapterIndex(step.chapter)
  if (i < 0 || i >= TOUR_CHAPTERS.length - 1) return TOUR_STEPS.length
  const nextId = TOUR_CHAPTERS[i + 1].id
  const idx = TOUR_STEPS.findIndex((s) => s.chapter === nextId)
  return idx < 0 ? TOUR_STEPS.length : idx
}
