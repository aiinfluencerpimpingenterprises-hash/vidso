/**
 * Thumbnail director: decides what a thumbnail shows before anything is drawn.
 *
 * Built from vidIQ's 2026 study of 500 breakout thumbnails across 30 niches,
 * 1of10's outlier and face studies, Eden's 507K-video analysis, YouTube's
 * Test & Compare guidance and Google's Nano Banana Pro prompting tips:
 *  - one focal subject filling about a quarter to a third of the frame;
 *  - 0-4 words (under 25 characters) that add to the title, never repeat it;
 *  - readable at ~120px wide, high contrast, text opposite the subject,
 *    bottom-right corner clear for the duration stamp;
 *  - no collages, icon grids, charts or clutter (no lift, and the usual AI failure);
 *  - drawn in the channel's own art style so its thumbnails look like one series.
 */

/** What top faceless channels in each kind of video put on the thumbnail. */
export const THUMB_RECIPES = {
  history: {
    name: 'History',
    subject: 'one painted historical figure (a ruler, soldier or ordinary person of the time) or one ruin, mid-action or in a charged moment',
    shot: 'figure on one third, side-lit, dark background, slight low angle',
    words: '0-3',
    palette: 'warm gold and ochre light against near-black',
  },
  mystery: {
    name: 'Mystery',
    subject: 'one object or place that is wrong (an open door, a lone car, a photo, a silhouette in a window), never a gory image',
    shot: 'low-key lighting, lots of empty dark space, the wrong detail lit',
    words: '1-3',
    palette: 'desaturated cold tones with exactly one red accent',
  },
  finance: {
    name: 'Money',
    subject: 'one huge number or one object that stands for the money (a gold bar, a stack of cash, a collapsing chart line drawn as one bold stroke, a burning banknote)',
    shot: 'the number or object takes about 40% of the frame, simple background',
    words: '1-3 (a number counts as a word)',
    palette: 'green for gain or red for loss, on black or clean white',
  },
  psychology: {
    name: 'Psychology',
    subject: 'one expressive character or one classical statue face showing the feeling the video is about',
    shot: 'tight crop on the face or upper body, text on the opposite side',
    words: '2-3',
    palette: 'muted background with one bright accent colour',
  },
  science: {
    name: 'Science and space',
    subject: 'one giant thing (a planet, star, creature or machine) with a tiny figure or object beside it for scale',
    shot: 'the giant thing fills more than half the frame, horizon low',
    words: '0-3',
    palette: 'saturated cool tones against black',
  },
  story: {
    name: 'Story',
    subject: 'one character at the moment of tension, the story readable at a glance',
    shot: 'medium close-up, the character on one third',
    words: '0-3',
    palette: 'mood-driven, high contrast',
  },
  kids: {
    name: 'Kids',
    subject: 'one or two bright, friendly characters doing the fun thing from the video',
    shot: 'centred, flat bright background',
    words: '0-2',
    palette: 'primary colours with white outlines',
  },
}

/** Recipe key for a video: from its topic first (true crime, money…), then the channel kind. */
const TOPIC_RECIPES = [
  // Word starts, so "vanished", "murders" and "financial" match too.
  [/\b(murder|killer|crime|criminal|police|detective|heist|scam|fraud|cult|myster|unsolved|vanish|disappear|missing|haunt|creep|unexplain|curse|ghost|ufo)/i, 'mystery'],
  [/\b(money|financ|econom|stock|invest|bank|debt|inflation|rich|wealth|billion|million|crypto|market|compan|brand|ceo|startup|bankrupt|ftx|ponzi)/i, 'finance'],
  [/\b(space|planet|galax|universe|black hole|moon|mars|stars?\b|ocean|deep sea|volcan|physic|quantum|scien|creature|species|dinosaur|engineer|machine)/i, 'science'],
  [/\b(psycholog|brain|mind|habit|anxi|personalit|stoic|philosoph|lonel|narciss|confiden|emotion)/i, 'psychology'],
  [/\b(histor|ancient|rome|roman|egypt|mediev|empire|king|queen|pharaoh|viking|centur|war\b|battle|soldier|dynast)/i, 'history'],
]
const GROUP_RECIPE = { mystery: 'mystery', history: 'history', education: 'science', psychology: 'psychology', finance: 'finance', story: 'story', kids: 'kids' }

export function thumbRecipeKey({ topic = '', title = '', group = '' } = {}) {
  if (group === 'kids') return 'kids'
  const text = `${title} ${topic}`
  for (const [re, key] of TOPIC_RECIPES) if (re.test(text)) return key
  return GROUP_RECIPE[group] || 'story'
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or', 'for', 'is', 'are', 'was', 'how', 'why', 'what', 'who', 'you', 'your', 'it', 'this', 'that', 'with', 'from', 'at', 'by', 'be', 'do', 'don\'t', 'not'])
const norm = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9$%]/g, '')

/** Thumbnail words: at most 4 words / 25 characters, and never the title again. '' means no text. */
export function cleanThumbText(text, title = '') {
  let t = String(text || '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()
  if (!t || /^(none|no text|n\/a|-)$/i.test(t)) return ''
  const words = t.split(' ').slice(0, 4)
  t = words.join(' ')
  while (t.length > 25 && t.includes(' ')) t = t.split(' ').slice(0, -1).join(' ')
  if (t.length > 25) return ''
  // Repeating the title adds nothing: drop text that is all title words.
  const titleWords = new Set(String(title).split(/\s+/).map(norm).filter((w) => w && !STOP.has(w)))
  const own = t.split(' ').map(norm).filter((w) => w && !STOP.has(w))
  if (own.length && own.every((w) => titleWords.has(w))) return ''
  return t.toUpperCase()
}

/** The brief for the director model. */
export function thumbnailDirectorPrompt({ title = '', topic = '', hook = '', artStyle = '', recipeKey = 'story', avoid = '', note = '' } = {}) {
  const r = THUMB_RECIPES[recipeKey] || THUMB_RECIPES.story
  return [
    'You art-direct YouTube thumbnails for a faceless channel. Decide what ONE thumbnail shows.',
    `Video title: "${String(title).slice(0, 140)}".`,
    topic && topic !== title ? `Topic: ${String(topic).slice(0, 300)}.` : '',
    hook ? `The video opens with: "${String(hook).slice(0, 300)}".` : '',
    artStyle ? `Every image on this channel is drawn in this art style: ${String(artStyle).slice(0, 200)}. The thumbnail uses it too.` : '',
    `What works for ${r.name} thumbnails: ${r.subject}; ${r.shot}; ${r.words} words; ${r.palette}.`,
    'Rules: exactly one focal subject that fills about a quarter to a third of the frame and reads at 120px wide; a curiosity gap the video pays off; the text adds information or emotion the title does not have (a number, a short claim, a feeling) and never repeats title words; often the best thumbnail has no text at all.',
    'Never: collages, grids of icons, infographics, charts with axes, split screens, more than one subject, arrows, circles, emoji, logos, real celebrities, gore.',
    avoid ? `Make it clearly different from the last thumbnail, which showed: ${String(avoid).slice(0, 200)}.` : '',
    note ? `The creator asked for: ${String(note).slice(0, 300)}.` : '',
    'Return JSON only, no markdown: {"subject":"what is shown, concrete and visual, one sentence","emotion":"the one feeling","shot":"camera and lighting in a few words","side":"left or right (where the subject sits)","background":"simple background in a few words","text":"0 to 4 words, or empty","palette":"2-3 named colours"}',
  ].filter(Boolean).join('\n')
}

export function parseDirectorResponse(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let d
  try { d = JSON.parse(m[0]) } catch { return null }
  const s = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n)
  const subject = s(d.subject, 260)
  if (subject.length < 8) return null
  return {
    subject,
    emotion: s(d.emotion, 60),
    shot: s(d.shot, 120),
    side: /left/i.test(d.side) ? 'left' : 'right',
    background: s(d.background, 120),
    text: s(d.text, 60),
    palette: s(d.palette, 80),
  }
}

/** A concept without the director (model down): the recipe's subject for this title. */
export function fallbackConcept({ title = '', recipeKey = 'story' } = {}) {
  const r = THUMB_RECIPES[recipeKey] || THUMB_RECIPES.story
  return { subject: `${r.subject}, for a video titled "${String(title).slice(0, 120)}"`, emotion: 'tension', shot: r.shot, side: 'right', background: 'simple and dark', text: '', palette: r.palette }
}

/** The image prompt for Nano Banana Pro, written as a shot brief. */
export function thumbnailImagePrompt({ concept, title = '', artStyle = '', hasRefs = false } = {}) {
  const c = concept || fallbackConcept({ title })
  const text = cleanThumbText(c.text, title)
  const other = c.side === 'left' ? 'right' : 'left'
  return [
    '16:9 YouTube thumbnail, 1920x1080, one subject.',
    hasRefs ? 'Draw it in exactly the same art style, line work, colours and character design as the attached reference image(s); do not copy their layout.' : '',
    artStyle ? `Art style: ${String(artStyle).slice(0, 220)}.` : '',
    `Subject: ${c.subject}. Emotion: ${c.emotion || 'tension'}.`,
    `Shot: ${c.shot || 'close-up'}; the subject sits on the ${c.side} third and fills about a third of the frame; strong light on the subject, ${c.background || 'simple dark background'} kept soft and uncluttered.`,
    text
      ? `Text: the words '${text}' exactly once, spelled exactly, in a heavy bold sans-serif, one line, very large (readable at phone size), white or bright with a thick dark outline, in the empty ${other} side, never over the subject.`
      : 'No text, no letters, no words anywhere in the image.',
    `Palette: ${c.palette || 'high contrast'}, with a strong light-dark contrast between the subject and the background.`,
    'Keep the bottom-right corner empty (the video length covers it) and keep everything important away from the edges.',
    'No icons, no infographic, no charts, no collage, no grid, no split screen, no arrows, no circles, no emoji, no logos, no watermark, no border, no UI, no extra text, no real celebrities.',
  ].filter(Boolean).join(' ')
}

export const DIRECTOR_MODEL = 'anthropic/claude-sonnet-4.5'
export const DIRECTOR_FALLBACK_MODEL = 'google/gemini-2.5-flash'

/** Server side: one fal any-llm call with a fallback model. */
export async function runThumbnailDirector({ title, topic, hook, artStyle, recipeKey, avoid, note, falKey, model, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Thumbnail director is not configured on this deployment.')
  if (!String(title || topic || '').trim()) throw new Error('A title is required.')
  const prompt = thumbnailDirectorPrompt({ title, topic, hook, artStyle, recipeKey, avoid, note })
  let lastError = null
  for (const m of [model || DIRECTOR_MODEL, DIRECTOR_FALLBACK_MODEL].filter((x, i, a) => a.indexOf(x) === i)) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.output) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Thumbnail model returned nothing')
      const concept = parseDirectorResponse(data.output)
      if (concept) return { concept: { ...concept, text: cleanThumbText(concept.text, title) }, model: m }
      lastError = new Error('Thumbnail model returned no usable concept')
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Thumbnail director failed')
}
