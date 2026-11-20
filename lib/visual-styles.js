/**
 * Visual styles for AI-generated scenes. Each style is a prompt fragment that
 * every scene image in a video shares, so the whole video looks like one piece.
 * Sample images live in /home/img/styles/<id>.jpg (same subject in each style).
 */

export const VISUAL_STYLES = [
  // Drawn
  { id: 'stick', name: 'Stick figure', group: 'Drawn', prompt: 'simple stick figure doodle, black marker lines on an off-white paper background, minimal flat color accents, hand-drawn explainer style, clean composition' },
  { id: 'doodle', name: 'Color doodle', group: 'Drawn', prompt: 'friendly hand-drawn doodle illustration, thick black outlines, flat bright colors, simple shapes, whiteboard explainer style' },
  { id: 'crayon', name: 'Crayon', group: 'Drawn', prompt: 'crayon drawing on textured paper, waxy strokes, childlike but clear shapes, warm colors' },
  { id: 'whiteboard', name: 'Whiteboard', group: 'Drawn', prompt: 'whiteboard marker drawing, black and blue dry-erase lines on a clean white board, simple explainer sketch' },
  { id: 'pencil', name: 'Pencil sketch', group: 'Drawn', prompt: 'detailed graphite pencil sketch, cross-hatching, soft shading on cream sketchbook paper' },
  { id: 'charcoal', name: 'Charcoal', group: 'Drawn', prompt: 'expressive charcoal drawing, smudged dark tones, rough strokes, dramatic contrast on grey paper' },
  { id: 'colored_pencil', name: 'Colored pencil', group: 'Drawn', prompt: 'colored pencil illustration, visible pencil strokes, soft layered colors, textured paper' },
  { id: 'pastel', name: 'Chalk pastel', group: 'Drawn', prompt: 'soft chalk pastel drawing, powdery blended colors, textured dark paper' },
  { id: 'chalkboard', name: 'Chalkboard', group: 'Drawn', prompt: 'white and colored chalk drawing on a dark green chalkboard, classroom explainer look' },
  { id: 'ballpoint', name: 'Ballpoint pen', group: 'Drawn', prompt: 'blue ballpoint pen drawing, fine hatching lines, notebook paper texture' },
  { id: 'notebook', name: 'Notebook doodle', group: 'Drawn', prompt: 'doodles drawn in the margins of lined notebook paper, pen sketches, playful and loose' },
  { id: 'storyboard', name: 'Storyboard', group: 'Drawn', prompt: 'film storyboard sketch, quick grey marker shading, loose confident lines, cinematic framing' },
  { id: 'architect', name: 'Architect sketch', group: 'Drawn', prompt: 'architectural ink sketch with light watercolor wash, precise perspective lines, urban sketcher style' },
  { id: 'line_art', name: 'Minimal line art', group: 'Drawn', prompt: 'minimal single-weight black line art on white, elegant continuous lines, lots of empty space' },
  { id: 'scribble', name: 'Scribble', group: 'Drawn', prompt: 'energetic scribble drawing, chaotic overlapping pen lines forming clear shapes, black on white' },
  // Painted
  { id: 'painted', name: 'Painted explainer', group: 'Painted', prompt: 'loose painterly digital illustration, visible brush strokes, soft lighting, storybook explainer style, rich muted colors' },
  { id: 'oil', name: 'Oil painting', group: 'Painted', prompt: 'classical oil painting, dramatic chiaroscuro lighting, rich textures, museum masterpiece style' },
  { id: 'watercolor', name: 'Watercolor', group: 'Painted', prompt: 'delicate watercolor illustration, soft washes, paper texture, gentle colors bleeding at the edges' },
  { id: 'ink', name: 'Ink and wash', group: 'Painted', prompt: 'black ink and wash illustration, expressive brush lines, sumi-e inspired, mostly monochrome with a single accent color' },
  { id: 'woodcut', name: 'Old woodcut', group: 'Painted', prompt: 'medieval woodcut print, bold carved black lines, aged parchment background, historical manuscript illustration' },
  { id: 'gouache', name: 'Gouache', group: 'Painted', prompt: 'gouache painting, flat opaque colors, matte finish, mid-century illustration feel' },
  { id: 'acrylic', name: 'Acrylic', group: 'Painted', prompt: 'bold acrylic painting, thick bright brush strokes, vivid saturated colors on canvas' },
  { id: 'impasto', name: 'Impasto', group: 'Painted', prompt: 'thick impasto oil paint, heavy palette knife texture, sculpted paint ridges' },
  { id: 'impressionist', name: 'Impressionist', group: 'Painted', prompt: 'impressionist painting, short broken brush strokes, dappled light, soft vibrant colors' },
  { id: 'van_gogh', name: 'Swirling post-impressionist', group: 'Painted', prompt: 'post-impressionist painting with swirling expressive brush strokes, thick paint, bold blues and yellows' },
  { id: 'renaissance', name: 'Renaissance', group: 'Painted', prompt: 'Italian Renaissance painting, balanced composition, soft sfumato, rich earthy pigments, fresco-like detail' },
  { id: 'baroque', name: 'Baroque', group: 'Painted', prompt: 'baroque painting, dramatic spotlight on figures, deep black background, rich reds and golds' },
  { id: 'romantic', name: 'Romantic landscape', group: 'Painted', prompt: '19th century romantic landscape painting, vast sky, sublime light, tiny figures in grand nature' },
  { id: 'fresco', name: 'Fresco', group: 'Painted', prompt: 'ancient wall fresco, faded pigments, cracked plaster texture, flat figures' },
  { id: 'icon', name: 'Byzantine icon', group: 'Painted', prompt: 'Byzantine icon painting, gold leaf background, flat stylized figures, rich deep colors' },
  { id: 'chinese_ink', name: 'Chinese landscape', group: 'Painted', prompt: 'traditional Chinese ink landscape painting on silk scroll, misty mountains, fine brushwork, muted tones' },
  { id: 'ukiyoe', name: 'Ukiyo-e', group: 'Painted', prompt: 'Japanese ukiyo-e woodblock print, flat colors, bold outlines, stylized waves and clouds' },
  { id: 'persian', name: 'Persian miniature', group: 'Painted', prompt: 'Persian miniature painting, intricate patterns, flat perspective, jewel-toned colors, gold details' },
  { id: 'egyptian', name: 'Egyptian mural', group: 'Painted', prompt: 'ancient Egyptian tomb mural, profile figures, flat ochre and lapis colors, hieroglyph-free walls' },
  { id: 'greek_vase', name: 'Greek vase', group: 'Painted', prompt: 'ancient Greek black-figure pottery painting, black silhouettes on terracotta orange, meander borders' },
  { id: 'tapestry', name: 'Medieval tapestry', group: 'Painted', prompt: 'medieval embroidered tapestry, woven texture, flat figures in a long narrative band, faded wool colors' },
  { id: 'illuminated', name: 'Illuminated manuscript', group: 'Painted', prompt: 'medieval illuminated manuscript illustration, gold leaf, ornate borders, vivid blues and reds on vellum' },
  { id: 'folk', name: 'Folk art', group: 'Painted', prompt: 'naive folk art painting, flat bright colors, decorative patterns, charming simple figures' },
  { id: 'storybook', name: 'Storybook', group: 'Painted', prompt: 'classic children\'s storybook illustration, warm soft painting, cozy whimsical details' },
  { id: 'concept_art', name: 'Concept art', group: 'Painted', prompt: 'epic digital concept art painting, atmospheric perspective, dramatic scale, matte painting detail' },
  // Photo
  { id: 'documentary', name: 'Documentary photo', group: 'Photo', prompt: 'realistic documentary photograph, natural light, 35mm lens, true-to-life detail, photojournalism style' },
  { id: 'vintage', name: 'Vintage photo', group: 'Photo', prompt: 'vintage photograph, sepia tones, film grain, slight vignetting, early 20th century look' },
  { id: 'national_geo', name: 'Nature magazine', group: 'Photo', prompt: 'award-winning nature magazine photograph, vivid but natural colors, telephoto lens, perfect light' },
  { id: 'studio', name: 'Studio portrait', group: 'Photo', prompt: 'professional studio photograph, softbox lighting, seamless backdrop, crisp detail' },
  { id: 'polaroid', name: 'Instant photo', group: 'Photo', prompt: 'instant film photo look, washed-out colors, soft focus, light leaks, nostalgic' },
  { id: 'daguerreotype', name: 'Daguerreotype', group: 'Photo', prompt: '19th century daguerreotype photograph, silvery monochrome, soft edges, scratches and tarnish' },
  { id: 'bw_photo', name: 'Black and white photo', group: 'Photo', prompt: 'classic black and white street photograph, strong contrast, 35mm grain' },
  { id: 'film_35mm', name: '35mm film', group: 'Photo', prompt: 'shot on 35mm color film, warm Kodak tones, natural grain, candid moment' },
  { id: 'drone', name: 'Drone aerial', group: 'Photo', prompt: 'high-altitude drone aerial photograph looking down, sweeping landscape, crisp detail' },
  { id: 'macro', name: 'Macro', group: 'Photo', prompt: 'extreme macro photograph, shallow focus, tiny details made huge, soft bokeh' },
  { id: 'news', name: 'News footage', group: 'Photo', prompt: 'news photograph, on-the-scene photojournalism, flash-lit, urgent and raw' },
  { id: 'archive', name: 'Archive footage', group: 'Photo', prompt: 'old archive photograph, faded colors, dust and scratches, historical record feel' },
  { id: 'surveillance', name: 'Security camera', group: 'Photo', prompt: 'grainy security camera still, high angle, low resolution, green-tinted night vision feel, no timestamp' },
  { id: 'food', name: 'Food photo', group: 'Photo', prompt: 'appetizing food photography, soft window light, shallow depth of field, rich textures' },
  { id: 'product', name: 'Product shot', group: 'Photo', prompt: 'premium product photography, clean gradient background, glossy reflections, perfect studio light' },
  // Film
  { id: 'cinematic', name: 'Cinematic still', group: 'Film', prompt: 'cinematic film still, anamorphic lens, dramatic moody lighting, shallow depth of field, color graded like a feature film' },
  { id: 'noir', name: 'Film noir', group: 'Film', prompt: 'black and white film noir still, hard shadows, venetian blind light, high contrast, 1940s mood' },
  { id: 'epic', name: 'Historical epic', group: 'Film', prompt: 'historical epic movie still, golden hour, huge scale, dust in the air, warm teal and orange grade' },
  { id: 'western', name: 'Western', group: 'Film', prompt: 'classic western film still, dusty desert, wide landscape, warm sunburnt colors' },
  { id: 'scifi', name: 'Sci-fi film', group: 'Film', prompt: 'science fiction film still, sleek futuristic design, cool blue lighting, volumetric haze' },
  { id: 'horror', name: 'Horror film', group: 'Film', prompt: 'horror movie still, deep shadows, cold desaturated colors, unsettling atmosphere, no gore' },
  { id: 'technicolor', name: 'Technicolor', group: 'Film', prompt: '1950s Technicolor film still, saturated primary colors, glamorous studio lighting' },
  { id: 'wes', name: 'Symmetrical pastel', group: 'Film', prompt: 'perfectly symmetrical centered composition, pastel color palette, whimsical storybook film set' },
  { id: 'vhs', name: 'VHS', group: 'Film', prompt: '1980s VHS tape still, scan lines, color bleed, soft blurry analog video' },
  { id: 'super8', name: 'Super 8', group: 'Film', prompt: 'Super 8 home movie frame, heavy grain, warm faded colors, light flicker' },
  { id: 'imax', name: 'Nature documentary', group: 'Film', prompt: 'big-budget nature documentary frame, breathtaking landscape, ultra sharp, golden light' },
  { id: 'war_film', name: 'War film', group: 'Film', prompt: 'gritty war film still, desaturated colors, smoke and mud, handheld realism, no gore' },
  // 3D
  { id: '3d', name: '3D animated', group: '3D', prompt: '3D animated film style, soft global illumination, appealing stylized characters, warm colors, high detail render' },
  { id: 'clay', name: 'Clay', group: '3D', prompt: 'claymation style, handmade plasticine models, visible fingerprints and texture, miniature set lighting' },
  { id: 'lowpoly', name: 'Low poly', group: '3D', prompt: 'low poly 3D illustration, faceted geometric shapes, soft gradient lighting, minimal and clean' },
  { id: 'isometric', name: 'Isometric', group: '3D', prompt: 'isometric 3D diorama, clean miniature world on a floating tile, soft shadows, bright colors' },
  { id: 'toy', name: 'Toy figures', group: '3D', prompt: 'plastic toy figures in a tabletop scene, glossy plastic, tilt-shift miniature look' },
  { id: 'brick', name: 'Toy bricks', group: '3D', prompt: 'scene built from plastic toy building bricks, studs visible, bright primary colors' },
  { id: 'miniature', name: 'Tilt-shift miniature', group: '3D', prompt: 'tilt-shift photograph making the scene look like a tiny model, blurred edges, bright colors' },
  { id: 'unreal', name: 'Game engine', group: '3D', prompt: 'photorealistic real-time game engine render, ray-traced lighting, epic detail' },
  { id: 'felt', name: 'Felt', group: '3D', prompt: 'handmade felt and wool figures, soft fuzzy texture, cozy stop-motion set' },
  { id: 'wood_toy', name: 'Wooden toys', group: '3D', prompt: 'carved and painted wooden toy figures, simple shapes, visible wood grain, warm light' },
  { id: 'glass', name: 'Glass', group: '3D', prompt: 'everything made of glossy translucent glass, caustic light, refractions, clean background' },
  { id: 'marble', name: 'Marble statue', group: '3D', prompt: 'white marble sculpture, classical statue carving, museum lighting, soft shadows' },
  { id: 'bronze', name: 'Bronze statue', group: '3D', prompt: 'bronze sculpture with green patina, dramatic museum spotlight' },
  { id: 'diorama', name: 'Museum diorama', group: '3D', prompt: 'museum diorama behind glass, painted backdrop, miniature figures, warm display lighting' },
  // Cartoon
  { id: 'anime', name: 'Anime', group: 'Cartoon', prompt: 'anime illustration, clean line art, cel shading, vibrant colors, detailed background art' },
  { id: 'ghibli', name: 'Hand-painted anime', group: 'Cartoon', prompt: 'hand-painted anime film background style, lush nature, soft clouds, gentle warm light' },
  { id: 'manga', name: 'Manga', group: 'Cartoon', prompt: 'black and white manga panel, screentone shading, dynamic ink lines' },
  { id: 'cartoon', name: 'Saturday cartoon', group: 'Cartoon', prompt: 'classic TV cartoon style, bold outlines, flat bright colors, exaggerated expressions' },
  { id: 'rubber_hose', name: '1930s cartoon', group: 'Cartoon', prompt: '1930s rubber hose cartoon, black and white, bouncy limbs, pie-cut eyes, vintage film grain' },
  { id: 'adult_cartoon', name: 'Adult animated sitcom', group: 'Cartoon', prompt: 'flat adult animated sitcom style, simple shapes, thin outlines, muted flat colors' },
  { id: 'chibi', name: 'Chibi', group: 'Cartoon', prompt: 'cute chibi characters with big heads and small bodies, pastel colors, soft shading' },
  { id: 'kids_book', name: 'Kids picture book', group: 'Cartoon', prompt: 'bright children\'s picture book illustration, simple rounded shapes, cheerful colors' },
  { id: 'disney_classic', name: 'Classic hand-drawn', group: 'Cartoon', prompt: 'classic hand-drawn 2D animation style, painted backgrounds, expressive characters' },
  { id: 'cutout', name: 'Cutout animation', group: 'Cartoon', prompt: 'construction paper cutout animation style, crude simple shapes, flat colors' },
  { id: 'motion_graphic', name: 'Motion graphic', group: 'Cartoon', prompt: 'clean 2D motion graphics explainer frame, flat characters, smooth shapes, modern brand colors' },
  { id: 'caricature', name: 'Caricature', group: 'Cartoon', prompt: 'editorial caricature illustration, exaggerated features, ink and watercolor' },
  // Graphic
  { id: 'comic', name: 'Comic book', group: 'Graphic', prompt: 'comic book panel, bold ink outlines, halftone dots, punchy saturated colors, dynamic composition' },
  { id: 'flat', name: 'Flat vector', group: 'Graphic', prompt: 'flat vector illustration, geometric shapes, limited modern color palette, no outlines, clean editorial style' },
  { id: 'pixel', name: 'Pixel art', group: 'Graphic', prompt: '16-bit pixel art scene, limited palette, crisp pixels, retro video game look' },
  { id: 'blueprint', name: 'Blueprint', group: 'Graphic', prompt: 'technical blueprint drawing, white line art on deep blue grid paper, measurement lines, engineering diagram style' },
  { id: 'map', name: 'Old map', group: 'Graphic', prompt: 'antique illustrated map style, parchment texture, hand-drawn coastlines, compass rose, sepia ink and faded watercolor' },
  { id: 'pop_art', name: 'Pop art', group: 'Graphic', prompt: 'pop art, Ben-Day dots, bold flat primary colors, thick black outlines' },
  { id: 'art_deco', name: 'Art deco', group: 'Graphic', prompt: 'art deco poster, geometric elegance, gold and black, streamlined forms' },
  { id: 'art_nouveau', name: 'Art nouveau', group: 'Graphic', prompt: 'art nouveau illustration, flowing organic lines, ornamental floral frame, muted pastel colors' },
  { id: 'propaganda', name: 'Vintage poster', group: 'Graphic', prompt: '1940s vintage poster illustration, bold heroic shapes, limited red cream and navy palette, no lettering' },
  { id: 'travel_poster', name: 'Travel poster', group: 'Graphic', prompt: 'retro travel poster, flat layered landscape, warm sunset gradient, no lettering' },
  { id: 'infographic', name: 'Infographic', group: 'Graphic', prompt: 'clean infographic illustration, simple icons and charts as shapes, flat colors, no words or numbers' },
  { id: 'silhouette', name: 'Silhouette', group: 'Graphic', prompt: 'black silhouettes against a vivid gradient sky, strong simple shapes' },
  { id: 'duotone', name: 'Duotone', group: 'Graphic', prompt: 'bold duotone graphic, two colors only, high contrast photo-illustration' },
  { id: 'synthwave', name: 'Synthwave', group: 'Graphic', prompt: 'synthwave retro-futuristic scene, neon pink and cyan grid, sunset, 80s glow' },
  { id: 'vaporwave', name: 'Vaporwave', group: 'Graphic', prompt: 'vaporwave aesthetic, pastel pink and teal, classical statues, glitchy retro computer graphics' },
  { id: 'glitch', name: 'Glitch', group: 'Graphic', prompt: 'digital glitch art, RGB split, pixel sorting, corrupted data stripes' },
  { id: 'neon', name: 'Neon', group: 'Graphic', prompt: 'glowing neon tube light art on a dark wall, vibrant electric colors' },
  { id: 'xray', name: 'X-ray', group: 'Graphic', prompt: 'x-ray scan look, glowing blue-white translucent forms on black' },
  { id: 'thermal', name: 'Thermal camera', group: 'Graphic', prompt: 'thermal imaging camera look, heat map colors from purple to yellow' },
  { id: 'hologram', name: 'Hologram', group: 'Graphic', prompt: 'futuristic holographic projection, glowing cyan wireframes, floating light particles' },
  { id: 'tarot', name: 'Tarot card', group: 'Graphic', prompt: 'ornate tarot card illustration, symbolic figures, gold border, mystical colors, no lettering' },
  { id: 'stained_glass', name: 'Stained glass', group: 'Graphic', prompt: 'cathedral stained glass window, lead lines, glowing jewel-colored glass' },
  { id: 'mosaic', name: 'Mosaic', group: 'Graphic', prompt: 'ancient Roman mosaic made of small stone tiles, earthy colors' },
  // Craft
  { id: 'papercut', name: 'Paper cutout', group: 'Craft', prompt: 'layered paper cutout art, cut paper shapes with soft drop shadows, craft texture, depth through layers' },
  { id: 'origami', name: 'Origami', group: 'Craft', prompt: 'folded origami paper models, crisp creases, soft studio light' },
  { id: 'collage', name: 'Collage', group: 'Craft', prompt: 'mixed media collage, torn paper, vintage magazine cutouts, tape and texture' },
  { id: 'linocut', name: 'Linocut', group: 'Craft', prompt: 'linocut print, bold carved shapes, two-color ink on paper, rough texture' },
  { id: 'screenprint', name: 'Screen print', group: 'Craft', prompt: 'risograph screen print, grainy ink, slightly misaligned color layers, limited palette' },
  { id: 'embroidery', name: 'Embroidery', group: 'Craft', prompt: 'hand embroidery on linen, colorful thread stitches, hoop texture' },
  { id: 'knitted', name: 'Knitted', group: 'Craft', prompt: 'everything knitted from yarn, cozy wool texture, soft colors' },
  { id: 'sand', name: 'Sand art', group: 'Craft', prompt: 'sand animation art on a lit glass table, warm glowing sand shapes' },
  { id: 'shadow_puppet', name: 'Shadow puppets', group: 'Craft', prompt: 'shadow puppet theatre, black cutout silhouettes on a glowing warm screen' },
  { id: 'cave', name: 'Cave painting', group: 'Craft', prompt: 'prehistoric cave painting, ochre and charcoal figures on rough rock wall' },
  { id: 'etching', name: 'Engraving', group: 'Craft', prompt: '19th century copperplate engraving, fine line hatching, black ink on cream paper, encyclopedia illustration' },
  { id: 'botanical', name: 'Scientific plate', group: 'Craft', prompt: 'vintage scientific illustration plate, precise detailed drawing, soft hand coloring, aged paper' },
  { id: 'newspaper', name: 'Newspaper print', group: 'Craft', prompt: 'old newspaper halftone print illustration, black ink dots on yellowed newsprint, no headlines' },
  // Dark
  { id: 'dark_fantasy', name: 'Dark fantasy', group: 'Dark', prompt: 'dark fantasy painting, gothic atmosphere, fog, deep shadows and cold moonlight' },
  { id: 'gothic', name: 'Gothic', group: 'Dark', prompt: 'gothic illustration, ornate dark architecture, candlelight, deep purples and blacks' },
  { id: 'eerie', name: 'Eerie liminal', group: 'Dark', prompt: 'eerie empty liminal space, flat fluorescent light, unsettling stillness' },
  { id: 'creepy_sketch', name: 'Creepy sketch', group: 'Dark', prompt: 'unsettling scratchy ink sketch, dark smudges, hollow eyes, old journal page, not gory' },
  { id: 'mystery', name: 'Mystery', group: 'Dark', prompt: 'mysterious night scene, single light source, thick fog, long shadows, muted blue tones' },
  { id: 'apocalypse', name: 'Post-apocalyptic', group: 'Dark', prompt: 'post-apocalyptic world, overgrown ruins, dusty haze, muted colors' },
  { id: 'cosmic', name: 'Cosmic', group: 'Dark', prompt: 'vast cosmic space scene, nebulae, stars, deep purples and blues, sense of awe' },
  { id: 'biblical', name: 'Biblical epic', group: 'Dark', prompt: 'biblical epic painting, divine rays of light, dramatic clouds, robed figures, old master style' },
  { id: 'mythic', name: 'Mythology', group: 'Dark', prompt: 'epic mythological painting, gods and heroes, dramatic sky, rich golden light' },
  { id: 'cyberpunk', name: 'Cyberpunk', group: 'Dark', prompt: 'cyberpunk city at night, rain-soaked streets, neon reflections, dense futuristic signs with no readable text' },
  { id: 'steampunk', name: 'Steampunk', group: 'Dark', prompt: 'steampunk illustration, brass gears, Victorian machines, warm sepia tones' },
]

const BY_ID = Object.fromEntries(VISUAL_STYLES.map((s) => [s.id, s]))
export const visualStyleById = (id) => BY_ID[id] || null
export const DEFAULT_STYLE = 'painted'
export const STYLE_GROUPS = [...new Set(VISUAL_STYLES.map((s) => s.group))]
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
