/**
 * Visual styles for AI-generated scenes. Each style is a prompt fragment that
 * every scene image in a video shares, so the whole video looks like one piece.
 * Sample images live in /home/img/styles/<id>.jpg (same subject in each style).
 */

/**
 * Only looks that big faceless channels actually use: 86 channels were checked from
 * frames inside their videos (Nov 2026), and a look stays when a faceless channel
 * using it gets a 200K+ median on its recent uploads.
 */
export const VISUAL_STYLES = [
  // Drawn
  { id: 'stick', name: 'Stick figure', group: 'Drawn', prompt: 'simple stick figure doodle, black marker lines on an off-white paper background, minimal flat color accents, hand-drawn explainer style, clean composition' },
  { id: 'doodle', name: 'Crude doodle', group: 'Drawn', prompt: 'friendly hand-drawn doodle illustration, thick black outlines, flat bright colors, simple shapes, whiteboard explainer style' },
  { id: 'flat_whiteboard', name: 'Whiteboard', group: 'Drawn', prompt: 'whiteboard drawing with flat pastel color fills inside black marker outlines, clean and minimal' },
  // Animated
  { id: 'flat', name: 'Flat vector', group: 'Animated', prompt: 'flat vector illustration, geometric shapes, limited modern color palette, no outlines, clean editorial style' },
  { id: 'cartoon', name: '2D cartoon', group: 'Animated', prompt: 'classic TV cartoon style, bold outlines, flat bright colors, exaggerated expressions' },
  { id: 'cutout', name: 'Paper cutout', group: 'Animated', prompt: 'construction paper cutout animation style, crude simple shapes, flat colors' },
  { id: '3d', name: '3D animated', group: 'Animated', prompt: '3D animated film style, soft global illumination, appealing stylized characters, warm colors, high detail render' },
  { id: 'map', name: 'Map animation', group: 'Animated', prompt: 'clean animated political map, satellite terrain relief, colored territories with bold borders, arrows showing movement, documentary map graphic' },
  // Painted
  { id: 'oil', name: 'Historical painting', group: 'Painted', prompt: 'historical oil painting, museum masterpiece, dramatic lighting, rich brushwork, figures in period dress' },
  { id: 'dark_fantasy', name: 'Dark fantasy painting', group: 'Painted', prompt: 'dark fantasy painting, gothic atmosphere, fog, deep shadows and cold moonlight' },
  // Real
  { id: 'archive', name: 'Archive photos', group: 'Real', prompt: 'old archive photograph, faded colors, dust and scratches, historical record feel' },
  { id: 'anamorphic', name: 'Cinematic realism', group: 'Real', prompt: 'anamorphic widescreen film still, oval bokeh, horizontal lens flares, teal and orange grade' },
  { id: 'cosmic', name: 'Space CGI', group: 'Real', prompt: 'photoreal space CGI render, planets and moons lit by a distant star, deep black space, NASA-style visualization, crisp detail' },
  { id: 'unreal', name: 'Game engine 3D', group: 'Real', prompt: 'photorealistic real-time game engine render, ray-traced lighting, epic detail' },
  { id: 'vhs', name: 'VHS found footage', group: 'Real', prompt: '1980s VHS tape still, scan lines, color bleed, soft blurry analog video' },
]

const BY_ID = Object.fromEntries(VISUAL_STYLES.map((s) => [s.id, s]))
export const DEFAULT_STYLE = 'cartoon'

/** Styles that were merged into a near-identical one, or that are no longer offered: old profiles get the closest. */
const RETIRED_STYLES = {
  documentary: 'anamorphic',
  acrylic: 'oil', adult_cartoon: 'cartoon', airbrush_scifi: 'anamorphic', amigurumi: '3d', anime: 'cartoon',
  anime_noir: 'archive', anime_poster: 'cartoon', anime_storybook: 'cartoon', apocalypse: 'unreal', architect: 'oil',
  art_deco: 'flat', art_nouveau: 'flat', ballpoint: 'oil', baroque: 'oil', biblical: 'oil', blue_marker: 'flat_whiteboard',
  blueprint: 'map', botanical: 'map', brick: '3d', bronze: 'oil', bw_photo: 'archive', caricature: 'cartoon', cave: 'oil',
  chalk_stick: 'flat_whiteboard', chalkboard: 'flat_whiteboard', charcoal: 'oil', chiaroscuro: 'oil', chibi: 'cartoon',
  chinese_ink: 'cartoon', chunky_marker: 'doodle', cinematic: 'anamorphic', cinematic_anime: 'cartoon', circuit_board: 'flat',
  clay: '3d', collage: 'cartoon', colored_pencil: 'oil', colorful_3d: '3d', comic: 'cartoon', concept_art: 'dark_fantasy',
  crayon: 'doodle', crayon_stick: 'stick', creepy_sketch: 'dark_fantasy', crosshatch_marker: 'stick', cut_paper_stick: 'stick',
  cyanotype: 'map', cyberpunk: 'unreal', daguerreotype: 'archive', dark_etching: 'dark_fantasy', dark_seinen: 'cartoon',
  delft: 'cartoon', diorama: '3d', disney_classic: 'cartoon', double_exposure: 'anamorphic', drone: 'anamorphic',
  duotone: 'flat', editorial_gouache: 'cartoon', editorial_motion: 'flat', eerie: 'vhs', egyptian: 'oil', embroidery: 'cartoon',
  epic: 'anamorphic', etching: 'oil', fairy_tale: 'cartoon', felt: '3d', film_35mm: 'archive', flat_anime: 'flat',
  folk: 'cartoon', food: 'anamorphic', fresco: 'oil', frost_crystal: 'cartoon', gemstone_mosaic: 'cartoon', ghibli: 'cartoon',
  gilded_nouveau: 'flat', glass: '3d', glitch: 'vhs', golden_hour: 'anamorphic', golden_stick: 'stick', gothic: 'dark_fantasy',
  gouache: 'cartoon', gouache_storybook: 'cartoon', graffiti: 'flat', greek_vase: 'oil', halftone: 'cartoon', hand_drawn: 'oil',
  hand_tinted: 'oil', highlighter_pop: 'doodle', hologram: 'anamorphic', horror: 'dark_fantasy', ice_sculpture: '3d', icon: 'oil',
  illuminated: 'oil', imax: 'anamorphic', impasto: 'oil', impressionist: 'oil', infographic: 'flat', ink: 'cartoon',
  ink_dotwork: 'oil', ink_in_water: 'cartoon', inkwash_stick: 'stick', isometric: '3d', japanese_ink: 'cartoon',
  kids_book: 'cartoon', knitted: '3d', kodachrome: 'archive', ligne_claire: 'cartoon', line_art: 'stick', linocut: 'cartoon',
  liquid_chrome: '3d', lowkey_photo: 'archive', lowpoly: '3d', macro: 'anamorphic', manga: 'cartoon', mannequin: '3d',
  marble: 'oil', marker_metaphor: 'flat_whiteboard', marker_stick: 'stick', mecha: 'unreal', mid_century: 'flat', miniature: '3d',
  misty_ink: 'cartoon', mosaic: 'flat', motion_graphic: 'flat', mystery: 'archive', mythic: 'oil', national_geo: 'anamorphic',
  neon: 'flat', neon_cyber_anime: 'cartoon', news: 'archive', newspaper: 'archive', noir: 'archive', noir_comic: 'cartoon',
  norse_runestone: 'oil', notebook: 'doodle', origami: 'cartoon', painted: 'oil', painted_stick: 'stick',
  paper_collage: 'cartoon', paper_diorama: 'cartoon', papercut: 'cartoon', papercut_lightbox: 'cartoon',
  particle_flow: 'anamorphic', pastel: 'oil', pastel_flat: 'flat', pencil: 'oil', persian: 'oil', pixel: 'cartoon',
  polaroid: 'archive', pop_art: 'cartoon', popup_book: 'cartoon', poster_vector: 'flat', product: 'anamorphic',
  propaganda: 'flat', renaissance: 'oil', retro_anime: 'cartoon', risograph: 'flat', romantic: 'oil', rubber_hose: 'cartoon',
  sacred_geometry: 'anamorphic', sand: 'cartoon', sand_mandala: 'cartoon', scifi: 'anamorphic', screenprint: 'cartoon',
  scribble: 'doodle', shadow_puppet: 'cartoon', shonen: 'cartoon', silhouette: 'flat', sketchbook_anime: 'cartoon',
  slice_of_life: 'cartoon', soft_shadow_board: 'flat_whiteboard', stained_glass: 'cartoon', steampunk: 'flat',
  stick_seminar: 'flat_whiteboard', stickman_cartoon: 'stick', storyboard: 'oil', storybook: 'cartoon', studio: 'anamorphic',
  studio_3d: '3d', sunny_marker: 'doodle', super8: 'vhs', surveillance: 'vhs', synthwave: 'flat', tapestry: 'anamorphic',
  tarot: 'oil', technicolor: 'anamorphic', terrarium: '3d', thermal: 'flat', tonalist: 'dark_fantasy', topographic: 'map',
  toy: '3d', travel_poster: 'flat', ukiyoe: 'cartoon', urban_sketchbook: 'oil', van_gogh: 'oil', vaporwave: 'flat',
  vintage: 'archive', vintage_sketch: 'oil', war_film: 'anamorphic', watercolor: 'cartoon', watercolor_chronicle: 'cartoon',
  wes: 'anamorphic', western: 'anamorphic', wet_plate: 'archive', whiteboard: 'flat_whiteboard', wood_marquetry: 'cartoon',
  wood_toy: '3d', woodcut: 'oil', xray: 'flat',
}
/** A saved style id as one in the list: itself, its closest replacement, or the default. */
export const resolveStyleId = (id) => BY_ID[id] ? id : (RETIRED_STYLES[id] || DEFAULT_STYLE)
export const visualStyleById = (id) => BY_ID[id] || BY_ID[RETIRED_STYLES[id]] || null
export const STYLE_GROUPS = [...new Set(VISUAL_STYLES.map((s) => s.group))]
/** One sample per style, each with its own subject that suits the style (like channel.farm's grid). */
export const styleSample = (id) => `/home/img/styles/${resolveStyleId(id)}.jpg`

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
