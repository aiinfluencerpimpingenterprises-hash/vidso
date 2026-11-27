/**
 * What each kind of channel sounds and looks like by default: the narrator to
 * suggest, how that voice is set (stability, style, speed), the caption look,
 * the camera move for animated scenes, and the art styles to lead with.
 *
 * From a 2025-2026 look at successful faceless channels per genre (ElevenLabs'
 * faceless-channel voice guides and default-voice table, vidIQ, channel case
 * studies). Voices are matched by name first, then by their ElevenLabs labels
 * (description, accent, gender, use case), so library voices rank too.
 */

/** One entry per kind of channel. `names` are voices to try first, best first. */
export const VOICE_GROUPS = {
  mystery: {
    label: 'Mystery',
    names: ['Bill', 'Brian', 'Adam', 'Callum', 'George', 'Daniel'],
    traits: /\b(deep|dark|raspy|gravel|weathered|ominous|mysterious|husky|low|intense|dramatic|narrat)/i,
    gender: 'male',
    settings: { stability: 0.45, similarity_boost: 0.75, style: 0.15, speed: 0.92 },
    captions: 'neon',
    camera: 'Slow push-in toward the subject, low light, a slight drift; tense and quiet.',
  },
  history: {
    label: 'History',
    names: ['George', 'Daniel', 'Bill', 'Brian', 'Callum', 'Adam'],
    traits: /\b(british|measured|serious|authoritative|mature|old|middle.aged|documentary|narrat|warm|deep)/i,
    gender: 'male',
    settings: { stability: 0.7, similarity_boost: 0.75, style: 0, speed: 0.95 },
    captions: 'cinematic',
    camera: 'Slow pan across the scene like a documentary camera over a painting.',
  },
  education: {
    label: 'Education',
    names: ['Liam', 'Brian', 'Matilda', 'Chris', 'Eric', 'Will', 'Sarah'],
    traits: /\b(clear|friendly|curious|articulate|young|upbeat|confident|narrat|educat|explain)/i,
    gender: '',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0, speed: 1.0 },
    captions: 'karaoke',
    camera: 'Gentle zoom in on the key object, clean and steady.',
  },
  psychology: {
    label: 'Psychology',
    names: ['Lily', 'Matilda', 'George', 'Charlotte', 'Alice', 'Sarah'],
    traits: /\b(warm|calm|soft|gentle|soothing|intimate|smooth|british|narrat)/i,
    gender: '',
    settings: { stability: 0.6, similarity_boost: 0.8, style: 0.1, speed: 0.95 },
    captions: 'minimal',
    camera: 'Slow, calm zoom in on the character, soft focus at the edges.',
  },
  finance: {
    label: 'Finance',
    names: ['Brian', 'Adam', 'Daniel', 'Eric', 'Chris', 'Roger'],
    traits: /\b(confident|trustworthy|professional|authoritative|news|crisp|deep|american|narrat)/i,
    gender: 'male',
    settings: { stability: 0.6, similarity_boost: 0.75, style: 0, speed: 1.02 },
    captions: 'hormozi',
    camera: 'Quick push-in on the number or chart, then hold.',
  },
  story: {
    label: 'Storytelling',
    names: ['Brian', 'George', 'Adam', 'Callum', 'Charlotte', 'Lily'],
    traits: /\b(warm|storytell|narrat|engaging|expressive|deep|smooth|captivating)/i,
    gender: '',
    settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, speed: 0.97 },
    captions: 'bold',
    camera: 'Cinematic dolly toward the main character.',
  },
  kids: {
    label: 'Kids',
    names: ['Matilda', 'Lily', 'Sarah', 'Jessica', 'Charlotte', 'Alice', 'Liam'],
    traits: /\b(bright|cheer|playful|friendly|young|sweet|upbeat|animated|child|soft|gentle)/i,
    gender: 'female',
    settings: { stability: 0.4, similarity_boost: 0.75, style: 0.3, speed: 0.92 },
    captions: 'kids',
    camera: 'Bouncy, playful zoom with the characters moving.',
  },
}

/** Which group a channel belongs to, from its genre first, then its niche. */
const GENRE_GROUP = { education: 'education', history: 'history', storytelling: 'story', mystery: 'mystery', documentary: 'history', kids: 'kids' }
const NICHE_GROUP = {
  crime: 'mystery', mystery: 'mystery', horror: 'mystery', paranormal: 'mystery', conspiracy: 'mystery',
  history: 'history', military: 'history', mythology: 'history', geography: 'history', war: 'history',
  psychology: 'psychology', philosophy: 'psychology', selfhelp: 'psychology', relationships: 'psychology', health: 'psychology',
  finance: 'finance', business: 'finance', tech: 'finance', crypto: 'finance', economics: 'finance', ai: 'finance',
  space: 'education', science: 'education', nature: 'education', animals: 'education', engineering: 'education',
  kids: 'kids', bedtime: 'kids',
  stories: 'story', storytelling: 'story', fantasy: 'story',
}
const NICHE_WORDS = [
  [/crime|murder|heist|unsolved|myster|horror|creepy|paranormal|scam|conspir|cult/i, 'mystery'],
  [/histor|ancient|empire|war|military|medieval|myth|rome|egypt|dynasty/i, 'history'],
  [/psych|mind|brain|philosoph|stoic|relationship|habit|mental|self/i, 'psychology'],
  [/financ|money|invest|business|stock|crypto|econom|wealth|startup|tech|ai\b/i, 'finance'],
  [/kid|child|bedtime|nursery|toddler/i, 'kids'],
  [/space|science|physics|planet|nature|animal|engineer|how .* work|explain/i, 'education'],
  [/story|stories|tale|legend|fantasy/i, 'story'],
]

export function voiceGroupFor({ genre = '', niche = '', about = '' } = {}) {
  const n = String(niche || '').toLowerCase()
  if (NICHE_GROUP[n]) return NICHE_GROUP[n]
  const text = `${niche} ${about}`
  for (const [re, g] of NICHE_WORDS) if (re.test(text)) return g
  return GENRE_GROUP[String(genre || '').toLowerCase()] || 'education'
}

export const voiceGroup = (key) => VOICE_GROUPS[key] || VOICE_GROUPS.education

/** How well a voice fits a group (higher is better). Voices without a preview drop a little. */
export function voiceFit(v, key) {
  const g = voiceGroup(key)
  const name = String(v?.name || v?.label || '').split(/[\s·-]/)[0].trim().toLowerCase()
  const at = g.names.findIndex((n) => n.toLowerCase() === name)
  let score = at >= 0 ? 100 - at * 8 : 0
  const text = [v?.desc, v?.description, v?.category, v?.accent, v?.label, v?.use_case, v?.age].filter(Boolean).join(' ')
  const hits = text.match(new RegExp(g.traits.source, 'gi')) || []
  score += Math.min(4, hits.length) * 9
  const gender = String(v?.gender || '').toLowerCase()
  if (g.gender && gender) score += gender === g.gender ? 6 : -6
  if (!v?.preview) score -= 3
  return score
}

/** Voices sorted best first for a group; each gets `fit` (0-100ish). Stable for ties. */
export function rankVoices(voices = [], key) {
  return (Array.isArray(voices) ? voices : [])
    .map((v, i) => ({ v, i, fit: voiceFit(v, key) }))
    .sort((a, b) => b.fit - a.fit || a.i - b.i)
    .map(({ v, fit }) => ({ ...v, fit }))
}

/** The voice to pick for a new channel in this group, or null. */
export function bestVoice(voices = [], key) {
  return rankVoices(voices, key)[0] || null
}

/** Voices that clearly fit (shown with a "Best for …" tag): the top few with a real match. */
export function bestForIds(voices = [], key, n = 3) {
  return rankVoices(voices, key).filter((v) => v.fit >= 20).slice(0, n).map((v) => v.id)
}

export const voiceSettingsFor = (key) => ({ ...voiceGroup(key).settings, use_speaker_boost: true })
export const captionLookFor = (key) => voiceGroup(key).captions
export const cameraMoveFor = (key) => voiceGroup(key).camera
