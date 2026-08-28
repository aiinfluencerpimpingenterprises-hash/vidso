/**
 * Faceless Studio sample showcase. Ten R2 clips, in upload order,
 * with the prompts that go with each style.
 */
import { VIDSO_R2_BASE } from '/lib/brand-assets.js'

const R2 = VIDSO_R2_BASE

function clip(file) {
  return R2 + '/' + file
}

export const STUDIO_SAMPLES = [
  {
    id: 'cinematic-chess',
    file: 'facelessstudio.mp4',
    video: clip('facelessstudio.mp4'),
    name: 'Faceless Video',
    sub: 'Explain strategy through cinematic storytelling',
    prompt: 'Create a cinematic animated faceless video showing how one decisive chess move changes the entire game',
    process: 'I will build a cinematic faceless piece around one turning point. Open on the board under pressure, show the move that flips the position, then land the takeaway so the strategy is impossible to miss.',
    ready: 'Your chess faceless video is ready. One bold move, a clear shift in strategy, and a memorable final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'cartoon-odysseus',
    file: 'facelessstudio1.mp4',
    video: clip('facelessstudio1.mp4'),
    name: 'Cartoon Faceless Video',
    sub: 'Make everyday concepts easy with playful cartoon scenes',
    prompt: 'Create a stickman cartoon faceless video showing Odysseus\'s journey to Troy and back home',
    process: 'I will build a stickman cartoon of the trip to Troy, the war, the detours, the monsters, the gods, and the long road home, so a first-time viewer can follow the whole arc.',
    ready: 'Your stickman Odysseus faceless video is ready. The war, detours, monsters, gods, and long road home are easy to follow.',
    length: 'long_300',
    aspect: '16:9',
    duration: '5 min',
    runtime: '5 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'pixel-art',
    file: 'facelessstudio2.mp4',
    video: clip('facelessstudio2.mp4'),
    name: 'Pixel Art',
    sub: 'Turn any topic into a Pixel Art explainer',
    prompt: 'An explainer video in retro 8-bit pixel-art style, chunky pixelated characters and props on a colorful grid background, crisp dithered shading and smooth pixel animation.',
    process: 'I will build a Pixel Art explainer: open on the core idea, walk the steps in order, then close on the takeaway. The structure stays tight so the idea reads clearly from the first shot to the last.',
    ready: 'Your Pixel Art explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'claymotion',
    file: 'facelessstudio3.mp4',
    video: clip('facelessstudio3.mp4'),
    name: 'Claymotion',
    sub: 'Turn any topic into a Claymotion explainer',
    prompt: 'An explainer video in claymation stop-motion style, handmade clay characters with soft fingerprint textures, tactile molded shapes and playful frame-by-frame movement.',
    process: 'I will build a Claymotion explainer: open on the core idea, walk the steps in order, then close on the takeaway. Handmade clay motion keeps every beat easy to follow.',
    ready: 'Your Claymotion explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'mixed-media',
    file: 'facelessstudio4.mp4',
    video: clip('facelessstudio4.mp4'),
    name: 'Mixed Media',
    sub: 'Turn any topic into a Mixed Media explainer',
    prompt: 'An explainer video in mixed-media collage style, layered paper cutouts, photo scraps, hand-drawn marks and textured backgrounds combined into lively animated scenes.',
    process: 'I will build a Mixed Media explainer: open on the core idea, walk the steps in order, then close on the takeaway. Collage layers keep the story punchy and readable.',
    ready: 'Your Mixed Media explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'illustrator-2d',
    file: 'facelessstudio5.mp4',
    video: clip('facelessstudio5.mp4'),
    name: '2D Illustrator',
    sub: 'Turn any topic into a 2D Illustrator explainer',
    prompt: 'An explainer video in clean 2D flat-illustration style, bold outlines, bright modern color palette and smooth vector characters with simple friendly motion.',
    process: 'I will build a 2D Illustrator explainer: open on the core idea, walk the steps in order, then close on the takeaway. Flat color and clear motion keep the lesson simple.',
    ready: 'Your 2D Illustrator explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'whiteboard-doodle',
    file: 'facelessstudio6.mp4',
    video: clip('facelessstudio6.mp4'),
    name: 'Whiteboard Doodle',
    sub: 'Turn any topic into a Whiteboard Doodle explainer',
    prompt: 'An explainer video in hand-drawn whiteboard doodle style, black marker sketches drawn live on a white board, simple line icons and playful animated annotations.',
    process: 'I will build a Whiteboard Doodle explainer: sketch the idea live, annotate each step, then circle the takeaway so it feels taught, not narrated over stock.',
    ready: 'Your Whiteboard Doodle explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'low-poly',
    file: 'facelessstudio7.mp4',
    video: clip('facelessstudio7.mp4'),
    name: 'Low Poly',
    sub: 'Turn any topic into a Low Poly explainer',
    prompt: 'An explainer video in low-poly 3D style, faceted geometric characters and environments with flat shaded triangles, clean soft lighting and minimal color gradients.',
    process: 'I will build a Low Poly explainer: open on the core idea, walk the steps in order, then close on the takeaway. Faceted shapes keep the world readable at a glance.',
    ready: 'Your Low Poly explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'isometric-flat',
    file: 'facelessstudio8.mp4',
    video: clip('facelessstudio8.mp4'),
    name: 'Isometric Flat Vector',
    sub: 'Turn any topic into an Isometric Flat Vector explainer',
    prompt: 'An explainer video in isometric flat-vector style, tidy 2.5D scenes and diagrams at a fixed isometric angle, crisp geometry, muted modern palette and orderly motion.',
    process: 'I will build an Isometric Flat Vector explainer: lock a 2.5D camera, lay out the system in clean diagrams, then close on the takeaway.',
    ready: 'Your Isometric Flat Vector explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
  {
    id: 'fluffy-toy',
    file: 'facelessstudio9.mp4',
    video: clip('facelessstudio9.mp4'),
    name: 'Fluffy Toy',
    sub: 'Turn any topic into a Fluffy Toy explainer',
    prompt: 'An explainer video in fluffy plush-toy style, soft felt and fuzzy fabric characters with stitched details and button eyes, cozy pastel scenes and cute bouncy movement.',
    process: 'I will build a Fluffy Toy explainer: open on the core idea, walk the steps in order, then close on the takeaway. Soft characters keep the lesson friendly without losing clarity.',
    ready: 'Your Fluffy Toy explainer is ready. The idea reads clearly from the first shot to the final takeaway.',
    length: 'shorts_30',
    aspect: '16:9',
    duration: '20s',
    runtime: '12 min',
    category: 'Marketing',
    kind: 'Skill',
  },
]

export const STUDIO_FILTERS = []

export const STUDIO_SECTIONS = [
  {
    id: 'samples',
    title: 'FACELESS STUDIO',
    accentWords: 2,
    sub: 'Turn any topic into a clear, visual explainer video',
    cards: STUDIO_SAMPLES.map((s) => ({
      id: s.id,
      name: s.name,
      image: '',
      video: s.video,
      length: s.length,
      aspect: s.aspect,
      scaffold: s.prompt,
      prompt: s.prompt,
    })),
  },
]

export function studioPresetsAll() {
  return STUDIO_SAMPLES.map((s) => ({
    ...s,
    image: s.video,
    scaffold: s.prompt,
    section: 'samples',
  }))
}

export function studioPresetById(id) {
  return studioPresetsAll().find((c) => c.id === id) || null
}

export function studioSectionsForFilter() {
  return STUDIO_SECTIONS
}

export function studioHeadingHtml(title, accentWords, esc) {
  const parts = String(title || '').trim().split(/\s+/).filter(Boolean)
  const n = Math.max(1, Math.min(Number(accentWords) || 1, parts.length))
  const head = parts.slice(0, n).join(' ')
  const rest = parts.slice(n).join(' ')
  return `<span class="accent">${esc(head)}</span>${rest ? ' ' + esc(rest) : ''}`
}

export function studioSampleById(id) {
  return STUDIO_SAMPLES.find((s) => s.id === id) || null
}

export function studioSampleIndex(id) {
  const i = STUDIO_SAMPLES.findIndex((s) => s.id === id)
  return i < 0 ? 0 : i
}
