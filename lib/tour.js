/**
 * In-app tour config. Copy lives here only.
 *
 * @typedef {'center' | 'top' | 'bottom' | 'left' | 'right' | 'auto'} TourPlacement
 *
 * @typedef {Object} TourStep
 * @property {string} id
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} body
 * @property {string | null} target
 * @property {TourPlacement} [placement]
 * @property {string} [route]
 * @property {string} [precondition]
 * @property {boolean} [needsNav]
 * @property {boolean} [needsSidebar]
 * @property {'setup' | 'script' | 'media' | 'preview' | 'export'} [fvStage]
 * @property {'broll' | 'captions' | 'music'} [sideTab]
 *
 * @typedef {Object} TourDef
 * @property {string} id
 * @property {string} label
 * @property {string} [panel]
 * @property {TourStep[]} steps
 */

/** @type {TourStep} */
function step(partial) {
  return {
    placement: 'auto',
    target: null,
    ...partial,
  }
}

/** @type {TourDef[]} */
export const TOURS = [
  {
    id: 'core',
    label: 'Long Form Generator',
    panel: 'videogen',
    steps: [
      step({
        id: 'welcome',
        eyebrow: 'Welcome',
        title: 'Welcome to Vidso',
        body: 'This walkthrough covers the Long Form Generator: topic, length, voice, script, media, and export. When you finish, pick another tool or play the full tutorial.',
        target: null,
        placement: 'center',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-nav',
        eyebrow: 'Start here',
        title: 'Long Form Generator',
        body: 'This is the faceless pipeline: a topic becomes a narrated short or long-form video with script, voice, B-roll, and captions.',
        target: '[data-panel="videogen"]',
        route: 'videogen',
        needsNav: true,
        fvStage: 'setup',
      }),
      step({
        id: 'vg-pipeline',
        eyebrow: 'Long Form Generator',
        title: 'Four stages',
        body: 'You stay in this tool the whole way. Generate, edit, then render an MP4.',
        target: '#fv-stepper',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-topic',
        eyebrow: 'Long Form Generator',
        title: 'Topic / prompt',
        body: 'Describe the video. The script writer uses this as the brief for hooks, sections, and narration.',
        target: '#fv-field-topic',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-length',
        eyebrow: 'Long Form Generator',
        title: 'Shorts or long-form',
        body: 'Shorts are 30–60s, and long-form goes up to your plan cap (10, 15, or 30 min). Length chips only show what your plan includes.',
        target: '#fv-field-length',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-aspect',
        eyebrow: 'Long Form Generator',
        title: 'Aspect ratio',
        body: '9:16 for Shorts, Reels, and TikTok. 16:9 for YouTube long-form.',
        target: '#fv-field-aspect',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-voice',
        eyebrow: 'Long Form Generator',
        title: 'Narrator voice',
        body: 'Pick a narrator, then set stability, similarity, style, and speed. Those ElevenLabs settings apply when the voiceover is generated.',
        target: '#fv-field-voice',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-generate',
        eyebrow: 'Long Form Generator',
        title: 'Generate Script',
        body: 'This writes a structured script once with AI. After that, edit it by hand or clear to start a new video, then continue to media.',
        target: '#fv-gen-script-btn',
        route: 'videogen',
        fvStage: 'setup',
      }),
      step({
        id: 'vg-script',
        eyebrow: 'Long Form Generator',
        title: 'Edit the script',
        body: 'Edit any section by hand, then continue to media when the narration is right. AI writes the script only once per video.',
        target: '#fv-script-box',
        route: 'videogen',
        precondition: 'fv-demo',
        fvStage: 'script',
      }),
      step({
        id: 'vg-media',
        eyebrow: 'Long Form Generator',
        title: 'Voiceover + B-roll',
        body: 'Media builds the voiceover, word-level captions, B-roll clips, and a timeline matched to the narration. Re-run if you want a new cut.',
        target: '#fv-media-box',
        route: 'videogen',
        precondition: 'fv-demo',
        fvStage: 'media',
      }),
      step({
        id: 'vg-export',
        eyebrow: 'Long Form Generator',
        title: 'Render and publish',
        body: 'Export burns captions and music into a final MP4. Download it, or upload straight to a connected YouTube channel. Turn on Upload after export in Account settings to do it automatically.',
        target: '#fv-export-box',
        route: 'videogen',
        precondition: 'fv-demo',
        fvStage: 'export',
      }),
      step({
        id: 'core-map',
        eyebrow: 'Everything else',
        title: 'The top bar is the map',
        body: 'Every other tool lives in this navigation: thumbnails, clipping, ranking, captions, voiceover, editor, and more. Open Getting started from your avatar menu anytime to replay a tour.',
        target: '#app-topnav',
        route: 'videogen',
        needsNav: true,
        fvStage: 'setup',
      }),
    ],
  },
  {
    id: 'clipper',
    label: 'Clipping',
    panel: 'clipper',
    steps: [
      step({
        id: 'clipper',
        eyebrow: 'Clipping',
        title: 'Paste a link',
        body: 'Paste a YouTube, TikTok, Instagram, or X link, or search and pick a video. Vidso finds viral moments and reframes them to 9:16.',
        target: '#clip-hero',
        route: 'clipper',
      }),
      step({
        id: 'clipper-discover',
        eyebrow: 'Clipping',
        title: 'Or pick a video',
        body: 'Search YouTube, browse Recommended, Entertainment, Sport, or Podcasts, or upload a file. Then Vidso finds the best 9:16 moments.',
        target: '#clip-discover',
        route: 'clipper',
      }),
    ],
  },
  {
    id: 'captions',
    label: 'AI Captions',
    panel: 'captions',
    steps: [
      step({
        id: 'cap-source',
        eyebrow: 'AI Captions',
        title: 'Add a video',
        body: 'Upload a video file or paste a public URL. Vidso transcribes it and hands back a full SRT caption file.',
        target: '#cap-source',
        route: 'captions',
      }),
      step({
        id: 'cap-transcribe',
        eyebrow: 'AI Captions',
        title: 'Transcribe',
        body: 'Hit Transcribe and the caption file appears when the job finishes. Download it or bring it into the editor.',
        target: '#cap-btn',
        route: 'captions',
      }),
    ],
  },
  {
    id: 'voiceover',
    label: 'AI Voiceover',
    panel: 'voiceover',
    steps: [
      step({
        id: 'vo-voices',
        eyebrow: 'AI Voiceover',
        title: 'Pick a voice',
        body: 'Pick a voice from the library. Each one has a short descriptor so you can match the tone to your video.',
        target: '#voices-grid',
        route: 'voiceover',
      }),
      step({
        id: 'vo-script',
        eyebrow: 'AI Voiceover',
        title: 'Write the script',
        body: 'Paste or type your narration in the script box, up to 5000 characters per generation.',
        target: '#tts-text',
        route: 'voiceover',
      }),
      step({
        id: 'vo-controls',
        eyebrow: 'AI Voiceover',
        title: 'Stability and speed',
        body: 'Stability controls how consistent the delivery is, speed adjusts the pace. The defaults work for most narration.',
        target: '#vo-controls',
        route: 'voiceover',
      }),
      step({
        id: 'vo-library',
        eyebrow: 'AI Voiceover',
        title: 'Voice Library',
        body: 'Every voiceover you generate is saved to the Voice Library. Play, download, or delete any of them later.',
        target: '#voice-library',
        route: 'voiceover',
        precondition: 'voice-library',
      }),
    ],
  },
  {
    id: 'reframe',
    label: 'AI Reframe',
    panel: 'reframe',
    steps: [
      step({
        id: 'rf-url',
        eyebrow: 'AI Reframe',
        title: 'Paste a link',
        body: 'Paste a YouTube, TikTok, Instagram, X, or Reddit link, or any direct video URL.',
        target: '#rf-url-row',
        route: 'reframe',
      }),
      step({
        id: 'rf-crop',
        eyebrow: 'AI Reframe',
        title: 'Auto crop',
        body: 'Vidso detects the main subject and crops around it, turning landscape footage into vertical or square. No manual reframing.',
        target: '#rf-intro',
        route: 'reframe',
      }),
    ],
  },
  {
    id: 'editor',
    label: 'Video Editor',
    panel: 'editor',
    steps: [
      step({
        id: 'ed-intro',
        eyebrow: 'Video Editor',
        title: 'Multi-track editor',
        body: 'A full multi-track editor for anything you want to assemble by hand.',
        target: '#ed-wrap',
        placement: 'center',
        route: 'editor',
      }),
      step({
        id: 'ed-import',
        eyebrow: 'Video Editor',
        title: 'Import media',
        body: 'Import files from your computer or straight from a URL. Files up to 1GB.',
        target: '#ve-import-files',
        route: 'editor',
      }),
      step({
        id: 'ed-rail',
        eyebrow: 'Video Editor',
        title: 'Tool rail',
        body: 'Voiceover, sounds, script, captions, effects, and stickers each open their own panel in this rail.',
        target: '#ed-rail',
        route: 'editor',
      }),
      step({
        id: 'ed-timeline',
        eyebrow: 'Video Editor',
        title: 'Timeline tracks',
        body: 'The timeline has separate tracks for captions, B-roll, voiceover, stickers, and music. Add more tracks as you need them.',
        target: '#ed-tracks',
        route: 'editor',
      }),
      step({
        id: 'ed-tools',
        eyebrow: 'Video Editor',
        title: 'Timeline tools',
        body: 'Undo, redo, split at the playhead, and zoom. Fit snaps the timeline to the full project length.',
        target: '#ed-tl-tools',
        route: 'editor',
      }),
      step({
        id: 'ed-export',
        eyebrow: 'Video Editor',
        title: 'Name and export',
        body: 'Name the project at the top, then export when the timeline is ready.',
        target: '#ed-top',
        route: 'editor',
      }),
    ],
  },
  {
    id: 'downloader',
    label: 'Video Downloader',
    panel: 'downloader',
    steps: [
      step({
        id: 'dl-fetch',
        eyebrow: 'Video Downloader',
        title: 'Fetch a video',
        body: 'Paste any public video URL from YouTube, TikTok, Instagram, Twitter, or Reddit, then hit Fetch.',
        target: '#dl-source',
        route: 'downloader',
      }),
    ],
  },
  {
    id: 'commentary',
    label: 'Video Commentary',
    panel: 'commentary',
    steps: [
      step({
        id: 'cm-stages',
        eyebrow: 'Video Commentary',
        title: 'Five stages',
        body: 'Five stages: upload, script, subtitle, shape, then audio.',
        target: '#cm-stepper',
        route: 'commentary',
      }),
      step({
        id: 'cm-upload',
        eyebrow: 'Video Commentary',
        title: 'Add a clip',
        body: 'Drop a file, paste a link, or pick something you already uploaded to My Files.',
        target: '#cm-uploader',
        route: 'commentary',
      }),
      step({
        id: 'cm-preview',
        eyebrow: 'Video Commentary',
        title: 'Live preview',
        body: 'The preview on the right updates as you move through the stages.',
        target: '#cm-preview',
        route: 'commentary',
      }),
    ],
  },
  {
    id: 'files',
    label: 'My Files',
    panel: 'files',
    steps: [
      step({
        id: 'files-library',
        eyebrow: 'My Files',
        title: 'Your library',
        body: 'Everything you upload or generate lands here: video, image, and audio.',
        target: '#files-card',
        route: 'files',
      }),
      step({
        id: 'files-reuse',
        eyebrow: 'My Files',
        title: 'Reuse later',
        body: 'Download anything later, or pull it into Commentary and the editor without uploading again.',
        target: '#files-list',
        route: 'files',
        precondition: 'files-list',
      }),
    ],
  },
  {
    id: 'ranking',
    label: 'Ranking',
    panel: 'ranking',
    steps: [
      step({
        id: 'rank-setup',
        eyebrow: 'Ranking',
        title: 'Setup',
        body: 'Setup: choose how many videos go into the ranking.',
        target: '#vr-sec-setup',
        route: 'ranking',
      }),
      step({
        id: 'rank-title',
        eyebrow: 'Ranking',
        title: 'Title style',
        body: 'Title style: set the font, size, color, and stroke. Toggle drag title to position it by hand.',
        target: '#vr-sec-title',
        route: 'ranking',
      }),
      step({
        id: 'rank-general',
        eyebrow: 'Ranking',
        title: 'General settings',
        body: 'General settings: video height, background color, and an optional caption track.',
        target: '#vr-sec-general',
        route: 'ranking',
      }),
      step({
        id: 'rank-order',
        eyebrow: 'Ranking',
        title: 'Playback order',
        body: 'Playback order: leave it automatic, or turn on custom order to control the sequence yourself.',
        target: '#vr-sec-order',
        route: 'ranking',
      }),
      step({
        id: 'rank-videos',
        eyebrow: 'Ranking',
        title: 'Video ranks',
        body: 'Add your videos under Video ranks, check the live 9:16 preview, then generate.',
        target: '#vr-sec-ranks',
        route: 'ranking',
      }),
    ],
  },
  {
    id: 'thumbnails',
    label: 'Thumbnail Generator',
    panel: 'imagegen',
    steps: [
      step({
        id: 'img-prompt',
        eyebrow: 'Thumbnail Generator',
        title: 'Describe the look',
        body: 'Describe the thumbnail you want in the bar at the bottom.',
        target: '#img-prompt',
        route: 'imagegen',
      }),
      step({
        id: 'img-tools',
        eyebrow: 'Thumbnail Generator',
        title: 'Model and size',
        body: 'Pick a model, aspect ratio, quality, and how many images to generate.',
        target: '#img-chat-tools',
        route: 'imagegen',
      }),
      step({
        id: 'img-results',
        eyebrow: 'Thumbnail Generator',
        title: 'Your thumbnails',
        body: 'New thumbnails land in the grid. Click one to open details, download, or recreate it.',
        target: '#img-results-pane',
        route: 'imagegen',
      }),
    ],
  },
  {
    id: 'tools',
    label: 'Short Form Tools',
    panel: 'tools',
    steps: [
      step({
        id: 'tools-map',
        eyebrow: 'Short Form Tools',
        title: 'The short-form menu',
        body: 'Open Short Form Tools in the top bar for Clipping, Ranking, captions, and the rest. The gallery still lists every tool in one place.',
        target: '#nav-tools-btn',
        route: 'tools',
        needsNav: true,
      }),
      step({
        id: 'tools-generate',
        eyebrow: 'Short Form Tools',
        title: 'Generate',
        body: 'Thumbnail Generator, Long Form Generator, Clipping, and Ranking start new work from a prompt or a link.',
        target: '#tools-group-generate',
        route: 'tools',
      }),
      step({
        id: 'tools-create',
        eyebrow: 'Short Form Tools',
        title: 'Create',
        body: 'AI Captions transcribes a video, AI Voiceover turns a script into narration, and AI Reframe crops landscape footage to vertical or square.',
        target: '#tools-group-create',
        route: 'tools',
      }),
      step({
        id: 'tools-edit',
        eyebrow: 'Short Form Tools',
        title: 'Edit',
        body: 'Open Video Editor, Video Downloader, or Video Commentary. Commentary adds voice and captions onto an existing clip.',
        target: '#tools-group-edit',
        route: 'tools',
      }),
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    panel: 'dashboard',
    steps: [
      step({
        id: 'dash-home',
        eyebrow: 'Dashboard',
        title: 'Dashboard home',
        body: 'See your usage, shortcuts back into Long Form Generator, and recent files.',
        target: '#dash-quick-actions',
        route: 'dashboard',
      }),
      step({
        id: 'quota',
        eyebrow: 'Account',
        title: 'Monthly videos',
        body: 'This badge is your monthly video allowance. Unlimited plans stay open; other plans show long-form and short-form remaining this billing window.',
        target: '#credits-pill',
        route: 'dashboard',
      }),
      step({
        id: 'getting-started',
        eyebrow: 'Workspace',
        title: 'Getting started',
        body: 'Open your avatar menu anytime to replay a tour, jump into settings, or sign out.',
        target: '#user-getting-started-btn',
        route: 'dashboard',
        needsAvatarMenu: true,
      }),
    ],
  },
]

const TOUR_INDEX = Object.fromEntries(TOURS.map((t) => [t.id, t]))

/** Long Form Generator first, then the rest of the app. */
const TOUR_PLAY_IDS = [
  'core', 'thumbnails', 'clipper', 'ranking', 'captions', 'voiceover',
  'reframe', 'editor', 'downloader', 'commentary', 'tools', 'files',
]

export function toursInPlayOrder() {
  return TOUR_PLAY_IDS.map((id) => TOUR_INDEX[id]).filter(Boolean)
}

export function tourPlayIds() {
  return toursInPlayOrder().map((t) => t.id)
}

export function tourById(id) {
  return TOUR_INDEX[id] || null
}

export function tourStepsOf(id) {
  return tourById(id)?.steps || []
}

export function tourLabel(id) {
  return tourById(id)?.label || 'Tour'
}

/** Panel id → tour id for first-visit auto start. */
export const TOUR_BY_PANEL = Object.fromEntries(
  TOURS.filter((t) => t.panel && t.id !== 'core').map((t) => [t.panel, t.id])
)

export function tourIdForPanel(panel) {
  return TOUR_BY_PANEL[panel] || null
}

/** @deprecated use tourStepsOf(tourId). Kept so old imports fail loudly if missed. */
export const TOUR_STEPS = TOURS.flatMap((t) => t.steps)
