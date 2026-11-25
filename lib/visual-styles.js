/**
 * Visual styles for AI-generated scenes. Each style is a prompt fragment that
 * every scene image in a video shares, so the whole video looks like one piece.
 * Sample images live in /home/img/styles/<id>.jpg (same subject in each style).
 */

/**
 * The best looks for faceless channels, picked from 223: every stick-figure and anime/manga look, plus the top 50 and ranked best first inside
 * each group: the 15 proven on big faceless channels, then the strongest of the rest
 * (anime, comic, horror, history, explainer). Dropped looks map to the closest one below.
 */
export const VISUAL_STYLES = [
  // Drawn
  { id: 'stick', name: 'Stick figure', group: 'Drawn', prompt: 'simple stick figure doodle, black marker lines on an off-white paper background, minimal flat color accents, hand-drawn explainer style, clean composition' },
  { id: 'doodle', name: 'Crude doodle', group: 'Drawn', prompt: 'friendly hand-drawn doodle illustration, thick black outlines, flat bright colors, simple shapes, whiteboard explainer style' },
  { id: 'flat_whiteboard', name: 'Whiteboard', group: 'Drawn', prompt: 'whiteboard drawing with flat pastel color fills inside black marker outlines, clean and minimal' },
  { id: 'stickman_cartoon', name: 'Stickman cartoon', group: 'Drawn', prompt: 'expressive stickman cartoon, round heads and thin black line bodies with lively poses, flat colored props and backgrounds, clean comic explainer look, simple and funny' },
  { id: 'painted_stick', name: 'Painted stick cartoon', group: 'Drawn', prompt: 'simple stick-figure characters in a softly painted, detailed background, black line bodies with round heads, gentle painterly scenery' },
  { id: 'pencil', name: 'Pencil sketch', group: 'Drawn', prompt: 'detailed graphite pencil sketch, cross-hatching, soft shading on cream sketchbook paper' },
  { id: 'chalkboard', name: 'Chalkboard', group: 'Drawn', prompt: 'white and colored chalk drawing on a dark green chalkboard, classroom explainer look' },
  { id: 'crayon_stick', name: 'Crayon stick explainer', group: 'Drawn', prompt: 'stick figures drawn in wax crayon on white paper, bright simple color fills, childlike but clear explainer drawing' },
  { id: 'golden_stick', name: 'Golden stick cartoon', group: 'Drawn', prompt: 'clean stick-figure cartoon in warm golden-hour light, soft painted backgrounds, thin black line characters' },
  { id: 'marker_stick', name: 'Marker stick explainer', group: 'Drawn', prompt: 'black marker stick figures on clean white, a few bold color accents, quick explainer whiteboard look' },
  { id: 'stick_seminar', name: 'Stick figure seminar', group: 'Drawn', prompt: 'stick figures in a simple classroom or lecture setting, marker lines, light gray shading, clear teaching diagram feel' },
  { id: 'chalk_stick', name: 'Chalkboard stick figures', group: 'Drawn', prompt: 'white chalk stick figures on a dark green chalkboard, dusty chalk texture, smudges' },
  { id: 'inkwash_stick', name: 'Ink & wash stick figures', group: 'Drawn', prompt: 'stick figures in black ink with loose gray watercolor washes, quick and elegant' },
  { id: 'cut_paper_stick', name: 'Cut-paper stick figures', group: 'Drawn', prompt: 'stick figures made from cut colored paper, layered paper shadows, handmade craft look' },
  // Animated
  { id: 'cartoon', name: '2D cartoon', group: 'Animated', prompt: 'classic TV cartoon style, bold outlines, flat bright colors, exaggerated expressions' },
  { id: '3d', name: '3D animated', group: 'Animated', prompt: '3D animated film style, soft global illumination, appealing stylized characters, warm colors, high detail render' },
  { id: 'map', name: 'Map animation', group: 'Animated', prompt: 'clean animated political map, satellite terrain relief, colored territories with bold borders, arrows showing movement, documentary map graphic' },
  { id: 'cutout', name: 'Paper cutout', group: 'Animated', prompt: 'construction paper cutout animation style, crude simple shapes, flat colors' },
  { id: 'flat', name: 'Flat vector', group: 'Animated', prompt: 'flat vector illustration, geometric shapes, limited modern color palette, no outlines, clean editorial style' },
  { id: 'comic', name: 'Comic book', group: 'Animated', prompt: 'comic book panel, bold ink outlines, halftone dots, punchy saturated colors, dynamic composition' },
  { id: 'adult_cartoon', name: 'Adult animated sitcom', group: 'Animated', prompt: 'flat adult animated sitcom style, simple shapes, thin outlines, muted flat colors' },
  { id: 'rubber_hose', name: '1930s cartoon', group: 'Animated', prompt: '1930s rubber hose cartoon, black and white, bouncy limbs, pie-cut eyes, vintage film grain' },
  { id: 'clay', name: 'Clay', group: 'Animated', prompt: 'claymation style, handmade plasticine models, visible fingerprints and texture, miniature set lighting' },
  { id: 'kids_book', name: 'Kids picture book', group: 'Animated', prompt: 'bright children\'s picture book illustration, simple rounded shapes, cheerful colors' },
  { id: 'collage', name: 'Collage', group: 'Animated', prompt: 'mixed media collage, torn paper, vintage magazine cutouts, tape and texture' },
  { id: 'motion_graphic', name: 'Motion graphic', group: 'Animated', prompt: 'clean 2D motion graphics explainer frame, flat characters, smooth shapes, modern brand colors' },
  { id: 'infographic', name: 'Infographic', group: 'Animated', prompt: 'clean infographic illustration, simple icons and charts as shapes, flat colors, no words or numbers' },
  { id: 'isometric', name: 'Isometric', group: 'Animated', prompt: 'isometric 3D diorama, clean miniature world on a floating tile, soft shadows, bright colors' },
  { id: 'pixel', name: 'Pixel art', group: 'Animated', prompt: '16-bit pixel art scene, limited palette, crisp pixels, retro video game look' },
  { id: 'propaganda', name: 'Vintage poster', group: 'Animated', prompt: '1940s vintage poster illustration, bold heroic shapes, limited red cream and navy palette, no lettering' },
  // Anime
  { id: 'ghibli', name: 'Hand-painted anime', group: 'Anime', prompt: 'hand-painted anime film background style, lush nature, soft clouds, gentle warm light' },
  { id: 'anime', name: 'Anime', group: 'Anime', prompt: 'anime illustration, clean line art, cel shading, vibrant colors, detailed background art' },
  { id: 'manga', name: 'Manga', group: 'Anime', prompt: 'black and white manga panel, screentone shading, dynamic ink lines' },
  { id: 'retro_anime', name: 'Retro 90s anime', group: 'Anime', prompt: '1990s cel anime, hand-painted cels, slightly faded colors, film grain, retro TV look' },
  { id: 'cinematic_anime', name: 'Cinematic anime', group: 'Anime', prompt: 'cinematic anime film frame, dramatic lighting, detailed painted sky, high-end anime movie look' },
  { id: 'dark_seinen', name: 'Dark seinen ink', group: 'Anime', prompt: 'dark seinen manga ink style, heavy blacks, gritty detailed linework, serious mood' },
  { id: 'chibi', name: 'Chibi', group: 'Anime', prompt: 'cute chibi characters with big heads and small bodies, pastel colors, soft shading' },
  { id: 'anime_storybook', name: 'Anime storybook', group: 'Anime', prompt: 'soft anime storybook illustration, gentle colors, painted backgrounds, warm and calm' },
  { id: 'shonen', name: 'Shonen impact', group: 'Anime', prompt: 'action shonen anime frame, dynamic angle, speed lines, bold shading, high energy' },
  { id: 'neon_cyber_anime', name: 'Neon cyber anime', group: 'Anime', prompt: 'cyberpunk anime frame, neon city lights, rain, magenta and cyan glow' },
  { id: 'slice_of_life', name: 'Pastel slice of life', group: 'Anime', prompt: 'pastel slice-of-life anime, soft daylight, gentle everyday scene, light airy colors' },
  { id: 'anime_noir', name: 'Anime noir', group: 'Anime', prompt: 'black and white anime noir, stark shadows, rain, detective film mood' },
  { id: 'mecha', name: 'Mecha futurist', group: 'Anime', prompt: 'futuristic mecha anime design, large robots, technical panels, dramatic sky' },
  { id: 'flat_anime', name: 'Flat vector anime', group: 'Anime', prompt: 'flat vector anime illustration, clean shapes, no gradients, bold simple colors' },
  { id: 'anime_poster', name: 'Vintage anime poster', group: 'Anime', prompt: 'vintage 1980s anime movie poster style, painted, warm faded colors, dramatic composition, no text' },
  { id: 'sketchbook_anime', name: 'Sketchbook anime', group: 'Anime', prompt: 'anime characters as pencil sketches with light color, visible construction lines, sketchbook page' },
  // Painted
  { id: 'oil', name: 'Historical painting', group: 'Painted', prompt: 'historical oil painting, museum masterpiece, dramatic lighting, rich brushwork, figures in period dress' },
  { id: 'dark_fantasy', name: 'Dark fantasy painting', group: 'Painted', prompt: 'dark fantasy painting, gothic atmosphere, fog, deep shadows and cold moonlight' },
  { id: 'biblical', name: 'Biblical epic', group: 'Painted', prompt: 'biblical epic painting, divine rays of light, dramatic clouds, robed figures, old master style' },
  { id: 'mythic', name: 'Mythology', group: 'Painted', prompt: 'epic mythological painting, gods and heroes, dramatic sky, rich golden light' },
  { id: 'watercolor', name: 'Watercolor', group: 'Painted', prompt: 'delicate watercolor illustration, soft washes, paper texture, gentle colors bleeding at the edges' },
  { id: 'renaissance', name: 'Renaissance', group: 'Painted', prompt: 'Italian Renaissance painting, balanced composition, soft sfumato, rich earthy pigments, fresco-like detail' },
  { id: 'ukiyoe', name: 'Ukiyo-e', group: 'Painted', prompt: 'Japanese ukiyo-e woodblock print, flat colors, bold outlines, stylized waves and clouds' },
  // Real
  { id: 'archive', name: 'Archive photos', group: 'Real', prompt: 'old archive photograph, faded colors, dust and scratches, historical record feel' },
  { id: 'anamorphic', name: 'Cinematic realism', group: 'Real', prompt: 'anamorphic widescreen film still, oval bokeh, horizontal lens flares, teal and orange grade' },
  { id: 'cosmic', name: 'Space CGI', group: 'Real', prompt: 'photoreal space CGI render, planets and moons lit by a distant star, deep black space, NASA-style visualization, crisp detail' },
  { id: 'unreal', name: 'Game engine 3D', group: 'Real', prompt: 'photorealistic real-time game engine render, ray-traced lighting, epic detail' },
  { id: 'vhs', name: 'VHS found footage', group: 'Real', prompt: '1980s VHS tape still, scan lines, color bleed, soft blurry analog video' },
  { id: 'noir', name: 'Film noir', group: 'Real', prompt: 'black and white film noir still, hard shadows, venetian blind light, high contrast, 1940s mood' },
  { id: 'epic', name: 'Historical epic', group: 'Real', prompt: 'historical epic movie still, golden hour, huge scale, dust in the air, warm teal and orange grade' },
  { id: 'documentary', name: 'Documentary photo', group: 'Real', prompt: 'realistic documentary photograph, natural light, 35mm lens, true-to-life detail, photojournalism style' },
  { id: 'imax', name: 'Nature documentary', group: 'Real', prompt: 'big-budget nature documentary frame, breathtaking landscape, ultra sharp, golden light' },
  // Dark
  { id: 'eerie', name: 'Eerie liminal', group: 'Dark', prompt: 'eerie empty liminal space, flat fluorescent light, unsettling stillness' },
  { id: 'creepy_sketch', name: 'Creepy sketch', group: 'Dark', prompt: 'unsettling scratchy ink sketch, dark smudges, hollow eyes, old journal page, not gory' },
  { id: 'horror', name: 'Horror film', group: 'Dark', prompt: 'horror movie still, deep shadows, cold desaturated colors, unsettling atmosphere, no gore' },
  { id: 'cyberpunk', name: 'Cyberpunk', group: 'Dark', prompt: 'cyberpunk city at night, rain-soaked streets, neon reflections, dense futuristic signs with no readable text' },
  { id: 'apocalypse', name: 'Post-apocalyptic', group: 'Dark', prompt: 'post-apocalyptic world, overgrown ruins, dusty haze, muted colors' },
]

const BY_ID = Object.fromEntries(VISUAL_STYLES.map((s) => [s.id, s]))
export const DEFAULT_STYLE = 'cartoon'

/** Styles that were merged into a near-identical one, or that are no longer offered: old profiles get the closest. */
const RETIRED_STYLES = {
  acrylic: 'oil', airbrush_scifi: 'anamorphic', amigurumi: 'clay',   architect: 'oil', art_deco: 'flat', art_nouveau: 'flat',
  ballpoint: 'oil', baroque: 'renaissance', blue_marker: 'flat_whiteboard', blueprint: 'map', botanical: 'map',
  brick: '3d', bronze: 'oil', bw_photo: 'noir', caricature: 'cartoon', cave: 'oil',   charcoal: 'pencil', chiaroscuro: 'oil', chinese_ink: 'ukiyoe', chunky_marker: 'doodle',
  cinematic: 'anamorphic', circuit_board: 'flat', colored_pencil: 'pencil', colorful_3d: '3d',
  concept_art: 'dark_fantasy', crayon: 'kids_book', creepy: 'creepy_sketch',
  crosshatch_marker: 'stick', cyanotype: 'map', daguerreotype: 'archive',
  dark_etching: 'dark_fantasy', delft: 'cartoon', diorama: '3d', disney_classic: 'cartoon',
  double_exposure: 'anamorphic', drone: 'imax', duotone: 'flat', editorial_gouache: 'cartoon',
  editorial_motion: 'motion_graphic', eerie_liminal: 'eerie', egyptian: 'oil', embroidery: 'cartoon', etching: 'oil',
  fairy_tale: 'cartoon', felt: 'clay', film_35mm: 'archive', folk: 'cartoon', food: 'anamorphic',
  fresco: 'renaissance', frost_crystal: 'cartoon', gemstone_mosaic: 'cartoon', gilded_nouveau: 'flat', glass: '3d',
  glitch: 'vhs', golden_hour: 'documentary', gothic: 'horror', gouache: 'cartoon',
  gouache_storybook: 'cartoon', graffiti: 'flat', greek_vase: 'oil', halftone: 'comic', hand_drawn: 'oil',
  hand_tinted: 'oil', highlighter_pop: 'doodle', hologram: 'anamorphic', ice_sculpture: '3d', icon: 'oil',
  illuminated: 'oil', impasto: 'oil', impressionist: 'oil', ink: 'cartoon', ink_dotwork: 'oil',
  ink_in_water: 'cartoon', japanese_ink: 'ukiyoe', knitted: '3d',
  kodachrome: 'archive', ligne_claire: 'comic', line_art: 'pencil', linocut: 'cartoon', liquid_chrome: '3d',
  lowkey_photo: 'noir', lowpoly: 'isometric', macro: 'imax', mannequin: '3d', marble: 'oil',
  marker_metaphor: 'flat_whiteboard', mid_century: 'flat',
  miniature: '3d', misty_ink: 'watercolor', mosaic: 'flat', mystery: 'eerie', mythology: 'mythic',
  national_geo: 'imax', neon: 'cyberpunk', news: 'archive', newspaper: 'archive',
  noir_comic: 'comic', norse_runestone: 'mythic', notebook: 'doodle', origami: 'cartoon', painted: 'oil',
  paper_collage: 'collage', paper_diorama: 'cartoon', papercut: 'cutout', papercut_lightbox: 'cartoon',
  particle_flow: 'anamorphic', pastel: 'oil', pastel_flat: 'flat', persian: 'oil', polaroid: 'archive',
  pop_art: 'comic', popup_book: 'cartoon', poster_vector: 'propaganda', product: 'anamorphic', risograph: 'flat',
  romantic: 'oil', sacred_geometry: 'anamorphic', sand: 'cartoon', sand_mandala: 'cartoon', scifi: 'cyberpunk',
  screenprint: 'cartoon', scribble: 'doodle', shadow_puppet: 'cartoon', silhouette: 'flat',
  sketch: 'pencil', soft_shadow_board: 'flat_whiteboard',
  stained_glass: 'cartoon', steampunk: 'flat', storyboard: 'oil',
  storybook: 'kids_book', studio: 'anamorphic', studio_3d: '3d', sunny_marker: 'doodle', super8: 'vhs',
  surveillance: 'vhs', synthwave: 'cyberpunk', tapestry: 'anamorphic', tarot: 'oil', technicolor: 'anamorphic',
  terrarium: '3d', thermal: 'flat', tonalist: 'dark_fantasy', topographic: 'map', toy: 'clay',
  travel_poster: 'propaganda', urban_sketchbook: 'oil', van_gogh: 'oil', vaporwave: 'cyberpunk', vintage: 'archive',
  vintage_sketch: 'oil', war_film: 'epic', watercolor_chronicle: 'watercolor', wes: 'anamorphic', western: 'epic',
  wet_plate: 'archive', whiteboard: 'flat_whiteboard', wood_marquetry: 'cartoon', wood_toy: '3d', woodcut: 'oil',
  xray: 'flat',
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
  { id: 'normal', name: 'Normal', seconds: 4 },
  { id: 'rapid', name: 'Rapid', seconds: 2.5 },
]
/** 'hyper' was retired; saved channels that picked it get Rapid, the same 2.5s. */
export const scenePaceById = (id) => SCENE_PACES.find((p) => p.id === (id === 'hyper' ? 'rapid' : id)) || SCENE_PACES[0]

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

/**
 * Fill scenes whose image failed from nearby scenes that really drew, rotating
 * through the closest few so a run of failures never shows one frame repeated.
 * Filled scenes are never copied from other fills. Returns { images, filled }.
 */
export function fillSceneGaps(images) {
  const list = Array.from(images || [], (x) => x || '')
  const drawn = list.map((url, i) => (url ? i : -1)).filter((i) => i >= 0)
  const filled = new Set()
  if (!drawn.length) return { images: list, filled }
  let runIndex = 0
  for (let k = 0; k < list.length; k++) {
    if (list[k] && !filled.has(k)) { runIndex = 0; continue }
    const near = [...drawn].sort((a, b) => Math.abs(a - k) - Math.abs(b - k) || a - b).slice(0, Math.min(4, drawn.length))
    list[k] = list[near[runIndex % near.length]]
    filled.add(k)
    runIndex++
  }
  return { images: list, filled }
}
