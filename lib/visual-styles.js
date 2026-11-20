/**
 * Visual styles for AI-generated scenes. Each style is a prompt fragment that
 * every scene image in a video shares, so the whole video looks like one piece.
 * Sample images live in /home/img/styles/<id>.jpg (same subject in each style).
 */

export const VISUAL_STYLES = [
  { id: 'stick', name: 'Stick figure', group: 'Drawn', prompt: 'simple stick figure doodle, black marker lines on an off-white paper background, minimal flat color accents, hand-drawn explainer style, clean composition' },
  { id: 'doodle', name: 'Color doodle', group: 'Drawn', prompt: 'friendly hand-drawn doodle illustration, thick black outlines, flat bright colors, simple shapes, whiteboard explainer style' },
  { id: 'crayon', name: 'Crayon', group: 'Drawn', prompt: 'crayon drawing on textured paper, waxy strokes, childlike but clear shapes, warm colors' },
  { id: 'painted', name: 'Painted explainer', group: 'Painted', prompt: 'loose painterly digital illustration, visible brush strokes, soft lighting, storybook explainer style, rich muted colors' },
  { id: 'oil', name: 'Oil painting', group: 'Painted', prompt: 'classical oil painting, dramatic chiaroscuro lighting, rich textures, museum masterpiece style' },
  { id: 'watercolor', name: 'Watercolor', group: 'Painted', prompt: 'delicate watercolor illustration, soft washes, paper texture, gentle colors bleeding at the edges' },
  { id: 'ink', name: 'Ink and wash', group: 'Painted', prompt: 'black ink and wash illustration, expressive brush lines, sumi-e inspired, mostly monochrome with a single accent color' },
  { id: 'woodcut', name: 'Old woodcut', group: 'Painted', prompt: 'medieval woodcut print, bold carved black lines, aged parchment background, historical manuscript illustration' },
  { id: 'documentary', name: 'Documentary photo', group: 'Realistic', prompt: 'realistic documentary photograph, natural light, 35mm lens, true-to-life detail, photojournalism style' },
  { id: 'cinematic', name: 'Cinematic still', group: 'Realistic', prompt: 'cinematic film still, anamorphic lens, dramatic moody lighting, shallow depth of field, color graded like a feature film' },
  { id: 'vintage', name: 'Vintage photo', group: 'Realistic', prompt: 'vintage photograph, sepia tones, film grain, slight vignetting, early 20th century look' },
  { id: 'noir', name: 'Film noir', group: 'Realistic', prompt: 'black and white film noir still, hard shadows, venetian blind light, high contrast, 1940s mood' },
  { id: '3d', name: '3D animated', group: '3D', prompt: '3D animated film style, soft global illumination, appealing stylized characters, warm colors, high detail render' },
  { id: 'clay', name: 'Clay', group: '3D', prompt: 'claymation style, handmade plasticine models, visible fingerprints and texture, miniature set lighting' },
  { id: 'lowpoly', name: 'Low poly', group: '3D', prompt: 'low poly 3D illustration, faceted geometric shapes, soft gradient lighting, minimal and clean' },
  { id: 'anime', name: 'Anime', group: 'Graphic', prompt: 'anime illustration, clean line art, cel shading, vibrant colors, detailed background art' },
  { id: 'comic', name: 'Comic book', group: 'Graphic', prompt: 'comic book panel, bold ink outlines, halftone dots, punchy saturated colors, dynamic composition' },
  { id: 'flat', name: 'Flat vector', group: 'Graphic', prompt: 'flat vector illustration, geometric shapes, limited modern color palette, no outlines, clean editorial style' },
  { id: 'papercut', name: 'Paper cutout', group: 'Graphic', prompt: 'layered paper cutout art, cut paper shapes with soft drop shadows, craft texture, depth through layers' },
  { id: 'pixel', name: 'Pixel art', group: 'Graphic', prompt: '16-bit pixel art scene, limited palette, crisp pixels, retro video game look' },
  { id: 'blueprint', name: 'Blueprint', group: 'Graphic', prompt: 'technical blueprint drawing, white line art on deep blue grid paper, annotations and measurement lines, engineering diagram style' },
  { id: 'map', name: 'Old map', group: 'Graphic', prompt: 'antique illustrated map style, parchment texture, hand-drawn coastlines, compass rose, sepia ink and faded watercolor' },
]

const BY_ID = Object.fromEntries(VISUAL_STYLES.map((s) => [s.id, s]))
export const visualStyleById = (id) => BY_ID[id] || null
export const styleSample = (id) => `/home/img/styles/${id}.jpg`

/** Visual modes: how many scenes get animated. */
export const VISUAL_MODES = [
  { id: 'cheapest', name: 'Cheapest', note: 'Still images', animateEvery: 0 },
  { id: 'balanced', name: 'Balanced', note: 'Images, every third scene animated', animateEvery: 3 },
  { id: 'cinematic', name: 'Cinematic', note: 'Every scene animated', animateEvery: 1 },
]
export const visualModeById = (id) => VISUAL_MODES.find((m) => m.id === id) || VISUAL_MODES[0]

/** Scene pace: seconds on screen per scene. */
export const SCENE_PACES = [
  { id: 'normal', name: 'Normal', seconds: 7 },
  { id: 'rapid', name: 'Rapid', seconds: 4 },
  { id: 'hyper', name: 'Hyper', seconds: 2.5 },
]
export const scenePaceById = (id) => SCENE_PACES.find((p) => p.id === id) || SCENE_PACES[0]

export const MAX_SCENES = 160

/**
 * Split the narration into timed scenes. Without word timings, words are
 * spread evenly over the narration, which matches TTS pacing closely.
 * Animated scenes are snapped to 5 seconds (what the video models make).
 */
export function planScenes({ text, duration, pace = 'normal', mode = 'cheapest' } = {}) {
  const total = Number(duration) || 0
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!total || !words.length) return []
  const per = scenePaceById(pace).seconds
  const animateEvery = visualModeById(mode).animateEvery
  let count = Math.max(1, Math.round(total / per))
  if (count > MAX_SCENES) count = MAX_SCENES
  const len = total / count
  const scenes = []
  for (let i = 0; i < count; i++) {
    const start = i * len
    const end = i === count - 1 ? total : (i + 1) * len
    const a = Math.floor((start / total) * words.length)
    const b = Math.max(a + 1, Math.floor((end / total) * words.length))
    scenes.push({
      i,
      start: +start.toFixed(2),
      end: +end.toFixed(2),
      text: words.slice(a, b).join(' '),
      animate: animateEvery > 0 && i % animateEvery === 0,
    })
  }
  return scenes
}

/** Final image prompt for one scene. */
export function sceneImagePrompt({ scene, style, character, aspect = '16:9' } = {}) {
  const s = visualStyleById(style)
  return [
    String(scene || '').trim(),
    s ? 'Style: ' + s.prompt + '.' : '',
    character ? 'The main character is the person in the reference image; keep their face, hair and clothes the same: ' + String(character).slice(0, 200) + '.' : '',
    `Full-bleed image with no borders, frames or letterboxing. No text, no captions, no watermarks, no logos. ${aspect === '9:16' ? 'Vertical 9:16' : 'Wide 16:9'} composition.`,
  ].filter(Boolean).join(' ')
}
