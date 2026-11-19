/**
 * Thumbnail agent: 15 styles that top YouTube videos used in 2026, and how to pick one.
 *
 * Built from a study of 703 long-form videos across 22 formats (top by views this
 * year plus this month's uploads), re-ranked by how far each beat its own channel's
 * median views. Styles are written for faceless channels: no real people's faces.
 * Each recipe is turned into one Nano Banana Pro prompt that lets the model design
 * the concrete image and the 1-4 word hook inside the style's rules.
 */

export const THUMBNAIL_STYLES = [
  {
    id: 'doc-titlecard', name: 'Documentary title card',
    look: 'Prestige streaming-documentary key art: a wide or aerial photoreal cinematic still at the most dramatic moment of the story, film grain, rich colour grade.',
    concept: 'Pick the single most epic, awe-inspiring moment or place in this story and frame it like the opening shot of a big-budget documentary.',
    text: '3 to 5 words in a refined serif, white, small, very widely letter-spaced, centred in the lower third. It can be a short evocative title that adds mood rather than repeating the video title.',
    palette: 'Muted cinematic grade with one warm light source.',
  },
  {
    id: 'minimal-object', name: 'Minimal object',
    look: 'Clean, minimal science-explainer look: one real object on a plain white or plain black seamless background, crisp studio product photography, soft shadow, lots of empty space.',
    concept: 'Show one ordinary object doing something that seems impossible or strange, the visual question at the heart of the video.',
    text: 'A short spoken reaction (2 to 4 words) in an elegant serif or neat handwriting, sentence case, black on white or white on black, in the empty half. Something like a surprised remark, not a headline.',
    palette: 'Near monochrome; the object carries the only colour.',
  },
  {
    id: 'found-footage', name: 'Found footage',
    look: 'Looks like a real CCTV, bodycam, doorbell or trail-camera still: grain, fisheye distortion, compression noise, night vision or washed-out daylight.',
    concept: 'Freeze the moment just before something goes wrong, with one detail in frame that is clearly off (an open door, a figure, a shadow, an object that should not be there). No identifiable real person.',
    text: 'Camera overlay like a real device (camera number, timestamp, small red REC dot) plus at most 2 small lowercase words in clean white.',
    palette: 'Black and white or sickly green; warm light only on the wrong detail.',
  },
  {
    id: 'circled-detail', name: 'Circled detail',
    look: 'A believable real-world photo (archive photo, satellite view, trail cam or snapshot) with one hand-drawn red circle or a bold red arrow around a small strange detail.',
    concept: 'Hide the strangest detail of the story inside an otherwise normal-looking photo, and circle it so the viewer has to look closer.',
    text: '1 to 3 words in heavy white uppercase sans-serif with a subtle dark shadow, placed away from the circle.',
    palette: 'Natural photo colours; red is used only for the circle or arrow.',
  },
  {
    id: 'editorial-collage', name: 'Editorial collage',
    look: 'Modern finance-documentary collage on a dark charcoal paper texture: a black-and-white archival-style cutout figure or object with a thin white sticker border and drop shadow, plus one symbol (a crashing chart, a stamp, a brand-like object).',
    concept: 'Use an anonymous archival-style figure or a key object as the cutout, paired with one symbol of what went right or wrong.',
    text: '3 to 4 words in heavy condensed white uppercase sans-serif, with exactly one key word in white on a solid red box.',
    palette: 'Charcoal, white and one red.',
  },
  {
    id: 'data-graphic', name: 'Data graphic',
    look: 'Sleek data visualisation on a near-black background with a faint grid: one glowing line or bar that breaks its pattern dramatically, a small dot marking now.',
    concept: 'Turn the core claim of the video into one chart line that does something shocking (spikes, collapses, splits).',
    text: 'A bold condensed white uppercase headline of 2 to 4 words at the top left, plus one tiny chart label next to the dot.',
    palette: 'Black with one neon line: green for money and growth, red for danger and collapse.',
  },
  {
    id: 'map-graphic', name: 'Map graphic',
    look: 'Realistic satellite map from space with one region outlined in a thick glowing red border and one bold red arrow.',
    concept: 'Show the place the video is about and mark the one area that raises the question.',
    text: 'The viewer\'s question in 2 to 4 heavy white uppercase words with a thin black shadow, well inside the frame, not touching any edge.',
    palette: 'Natural satellite colours with red as the only accent.',
  },
  {
    id: 'object-hero', name: 'Object hero',
    look: 'High-end product shot of one machine, vehicle or device on pure black: studio rim light, razor sharp, optionally an exploded view with parts floating in alignment.',
    concept: 'Make the machine at the centre of the video look powerful, with one glowing part that matters.',
    text: 'One big spec or number as the hook (for example a speed, temperature or price) in bold white sans-serif, large enough to read at phone size, near the glowing part.',
    palette: 'Black and metal with one hot accent (orange heat, blue electric).',
  },
  {
    id: 'scale-comparison', name: 'Scale comparison',
    look: 'Photoreal cinematic scene where something colossal sits next to something tiny and familiar for scale. Bright enough to read at phone size.',
    concept: 'Show the biggest, deepest or most extreme thing in the video beside a small human, boat or object so the scale is instantly obvious. The subject is clearly lit.',
    text: 'One short question or one number in bold white sans-serif at the top.',
    palette: 'Deep natural tones with the tiny object in a bright contrasting colour.',
  },
  {
    id: 'doodle', name: 'Doodle character',
    look: 'Hand-drawn doodle cartoon with thick black outlines and flat colours: a simple round-headed character with one big, clear emotion in a simple scene.',
    concept: 'Put a simple character in the funniest or most relatable situation from the video.',
    text: '2 to 3 huge chunky black uppercase words on a solid bright yellow block (or another bold flat colour block).',
    palette: 'Bright flat colours; this style is allowed to be loud.',
  },
  {
    id: 'icon-grid', name: 'Icon grid',
    look: 'Clean infographic poster: a tidy grid of 6 to 10 small, colourful, consistent flat illustrations or icons, each a different example from the video, on a solid colour background.',
    concept: 'Lay out the set of things the video covers as a grid of little illustrated icons so it promises a complete overview.',
    text: 'A huge 1 to 3 word title across the top in bold rounded sans-serif, one word highlighted in a contrasting colour. Optional tiny labels under icons.',
    palette: 'One solid background colour (deep green, navy or white) with bright icons.',
  },
  {
    id: 'lineup', name: 'Labelled lineup',
    look: 'Side-by-side lineup of 2 or 3 subjects (people as anonymous figures, animals, vehicles, versions) shown in the same pose and scale, crisp illustration or photoreal, clean background.',
    concept: 'Show the things being compared side by side so the difference is obvious at a glance.',
    text: 'A short bold white uppercase label above each subject (1 to 2 words each). No other headline.',
    palette: 'Neutral background, each subject in its own colour.',
  },
  {
    id: 'marble-statue', name: 'Marble statue',
    look: 'Moody philosophy style: a white marble classical bust or statue on a black background, dramatic side light, one striking change (a crack with light leaking out, a tear, a glow).',
    concept: 'Use a classical statue as the face of the idea, with one detail that expresses the emotion of the video.',
    text: '2 to 5 words of advice or command in bold white serif uppercase on the empty side, with one key word in gold or yellow.',
    palette: 'Black, white marble and one gold accent.',
  },
  {
    id: 'flat-vector', name: 'Flat vector',
    look: 'Polished flat vector illustration with soft gradients and gentle glow, bold saturated colours, cinematic composition, one large subject.',
    concept: 'Show a familiar thing with one big strange change, drawn large enough to read at phone size.',
    text: '1 to 2 rounded bold white words at the top centre.',
    palette: 'Rich purples, blues and one warm highlight.',
  },
  {
    id: 'storytime-comic', name: 'Storytime comic',
    look: 'Glossy webcomic illustration with bold outlines and vivid colours: two characters at the peak moment of conflict, exaggerated expressions, emphasis lines.',
    concept: 'Freeze the most dramatic or unfair moment of the story between the two main characters.',
    text: 'The line someone shouts, 1 to 3 words, in big rounded bold white letters with a thick dark outline.',
    palette: 'Bright and saturated.',
  },
]

const STYLE_BY_ID = Object.fromEntries(THUMBNAIL_STYLES.map((s) => [s.id, s]))
export const thumbnailStyleById = (id) => STYLE_BY_ID[id] || null

/** Format detection, most specific first. Style order comes from the 2026 breakout study. */
const FORMATS = [
  { id: 'storytime', re: /\b(reddit|aita|storytime|my (boss|wife|husband|sister|brother|mom|dad|friend|boyfriend|girlfriend|roommate|neighbou?r)|revenge|cheated?)\b/i, styles: ['storytime-comic', 'doodle'] },
  { id: 'true-crime', re: /\b(murder|killer|serial|crime|police|detective|suspect|arrest|trial|prison|cartel|kidnap|heist|robbery|fbi)\b/i, styles: ['found-footage', 'circled-detail', 'editorial-collage'] },
  { id: 'mystery', re: /\b(myster|unsolved|vanish|disappear|missing|haunted|paranormal|ghost|creepy|unexplained|cursed|strange|alien|ufo|eerie)/i, styles: ['found-footage', 'circled-detail', 'minimal-object'] },
  { id: 'philosophy', re: /\b(stoic|philosoph|marcus aurelius|seneca|nietzsche|buddh|wisdom|meaning of life|virtue|ego|discipline)/i, styles: ['marble-statue', 'doodle'] },
  { id: 'psychology', re: /\b(psycholog|brain|mind|habit|anxiety|personality|self.?improve|motivation|confidence|introvert|narciss|manipulat|toxic|relationship|gen z|gen x|millennial)/i, styles: ['doodle', 'icon-grid', 'marble-statue'] },
  { id: 'versus', re: /\b(vs\.?|versus|compared|noob|pro vs|types of|every )\b/i, styles: ['lineup', 'icon-grid'] },
  { id: 'finance', re: /\b(money|financ|econom|stock|invest|bank|debt|inflation|rich|wealth|billion|million|tax|crypto|market|salary|price|recession|housing)/i, styles: ['editorial-collage', 'data-graphic', 'icon-grid'] },
  { id: 'business', re: /\b(company|companies|brand|ceo|startup|rise and fall|downfall|bankrupt|corporat|founder)/i, styles: ['editorial-collage', 'object-hero', 'data-graphic'] },
  { id: 'disaster', re: /\b(sank|sinking|shipwreck|titanic|disaster|collapse[ds]?|explosion|crash(ed)?|eruption|earthquake|tsunami|catastroph)/i, styles: ['doc-titlecard', 'circled-detail', 'found-footage'] },
  { id: 'war', re:/\b(war|military|army|soldier|navy|battle|ww2|wwii|world war|nuclear|missile|tank|special forces|seals)\b/i, styles: ['lineup', 'map-graphic', 'doc-titlecard'] },
  { id: 'geography', re: /\b(country|countries|map|border|island|desert|nobody lives|population|continent|geograph|river|mountain range)\b/i, styles: ['map-graphic', 'doc-titlecard'] },
  { id: 'space', re: /\b(space|planet|galaxy|universe|black hole|moon|mars|saturn|jupiter|nasa|voyager|light year|cosmos|asteroid)\b/i, styles: ['doc-titlecard', 'scale-comparison', 'minimal-object'] },
  { id: 'science', re: /\b(physics|quantum|science|atom|chemistry|experiment|scientists?)\b/i, styles: ['minimal-object', 'data-graphic', 'doc-titlecard'] },
  { id: 'nature', re: /\b(animal|ocean|sea|shark|whale|creature|species|wildlife|predator|insect|snake|deep sea|jungle|bird|dinosaur)/i, styles: ['scale-comparison', 'circled-detail', 'found-footage'] },
  { id: 'engineering', re: /\b(engine|engineering|machine|cars?|jet|rocket|train|bridge|megaproject|tower|invention|robot|chip|computer|technology|weapon)\b/i, styles: ['object-hero', 'minimal-object', 'doc-titlecard'] },
  { id: 'health', re: /\b(health|body|sleep|diet|eat|eating|food|sugar|coffee|fasting|disease|doctor|vitamin|muscle|workout)\b/i, styles: ['icon-grid', 'minimal-object', 'doodle'] },
  { id: 'history', re: /\b(history|historical|ancient|rome|roman|egypt|medieval|empire|king|queen|pharaoh|viking|century|civili[sz]ation|dynasty|peasant)/i, styles: ['doc-titlecard', 'doodle', 'editorial-collage'] },
  { id: 'list', re: /(^\d+\s|\btop \d+\b|\bmost (dangerous|deadly)\b|\bscariest\b|\bbiggest\b|\blargest\b|\bdeadliest\b|\bweirdest\b)/i, styles: ['scale-comparison', 'circled-detail', 'icon-grid'] },
]
const DEFAULT_STYLES = ['doc-titlecard', 'minimal-object', 'editorial-collage']

/** Ranked style ids for a video, best first (always 3+). */
export function pickThumbnailStyles(text) {
  const s = String(text || '')
  const score = new Map()
  let rank = 0
  for (const f of FORMATS) {
    if (!f.re.test(s)) continue
    f.styles.forEach((id, i) => score.set(id, (score.get(id) || 0) + (10 - rank) * (3 - i)))
    rank++
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  for (const id of DEFAULT_STYLES) if (!ranked.includes(id)) ranked.push(id)
  return ranked
}

/** True when a prompt already reads like an art-directed image prompt (leave it alone). */
export function looksArtDirected(prompt) {
  const p = String(prompt || '')
  return p.length > 220 || /\b(16:9|rim light|composition|photorealistic|close-?up|wide shot|lighting|thumbnail style)\b/i.test(p)
}

/** Detected format ids, for labels and logging. */
export function detectThumbnailFormats(text) {
  const s = String(text || '')
  return FORMATS.filter((f) => f.re.test(s)).map((f) => f.id)
}

const UNIVERSAL = [
  'One focal idea that reads in under a second at phone size; at most three visual elements.',
  'Professional, current 2026 YouTube thumbnail quality, not a 2019-style thumbnail: no shocked stock faces, no rainbow clutter, no arrows or circles unless the style asks for them.',
  'Render every word cleanly, spelled exactly, once; never repeat a word or duplicate the text.',
  'No real celebrities or public figures, no logos, no watermark, no borders, no YouTube interface elements.',
].join(' ')

/**
 * One Nano Banana Pro prompt for a style. The model designs the concrete image and
 * writes the hook inside the style's rules; the hook must add to the title, not repeat it.
 */
export function buildStylePrompt({ styleId, title, topic, hook } = {}) {
  const style = thumbnailStyleById(styleId) || thumbnailStyleById(DEFAULT_STYLES[0])
  const t = String(title || topic || '').trim()
  const about = String(topic || '').trim()
  const opening = String(hook || '').trim()
  return [
    `YouTube thumbnail, 16:9, for a video titled "${t.slice(0, 140)}".`,
    about && about !== t ? `What the video is about: ${about.slice(0, 400)}.` : '',
    opening ? `The video opens with: "${opening.slice(0, 240)}".` : '',
    `Style: ${style.name}. ${style.look}`,
    `Concept: ${style.concept}`,
    `Text: ${style.text} Write the words yourself: they must add curiosity and must not reuse the main words of the title.`,
    `Palette: ${style.palette}`,
    UNIVERSAL,
  ].filter(Boolean).join(' ')
}
