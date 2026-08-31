/**
 * Stock search ranks common visuals over rare ones. "cub" and even
 * "honey badger cub" pull lion cubs because Pexels is full of them.
 * Bind generic life-stage words to the section's subject, and drop those
 * modifiers from stock queries so the species is what gets searched.
 */

const GENERIC = 'cubs?|pups?|cal(?:f|ves)|kits?|bab(?:y|ies)|young|newborns?|juveniles?|hatchlings?|chicks?|foals?|offspring|mothers?|mama|mom|fathers?|nests?|dens?'
const GENERIC_ONLY_RE = new RegExp('^(?:' + GENERIC + ')$', 'i')
const STOP = new Set([
  'the', 'a', 'an', 'her', 'his', 'their', 'its', 'this', 'that', 'these', 'those',
  'and', 'or', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'as', 'by',
  'close', 'stays', 'stay', 'near', 'around', 'small', 'little', 'one', 'two',
  'then', 'when', 'while', 'into', 'onto', 'over', 'under', 'about',
  'vs', 'versus', 'v',
])

export function stripGenericTerms(query) {
  return String(query || '').replace(new RegExp('\\b(?:' + GENERIC + ')\\b', 'gi'), ' ').replace(/\s+/g, ' ').trim()
}

export function isGenericBrollQuery(query) {
  const raw = String(query || '').replace(/\s+/g, ' ').trim()
  if (!raw) return false
  if (GENERIC_ONLY_RE.test(raw)) return true
  const leftover = stripGenericTerms(raw)
  const content = leftover.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()))
  return !content.length
}

export function topicSubjects(topic) {
  return String(topic || '')
    .split(/\s+(?:vs\.?|versus|v\.|and|&|\/)\s+/i)
    .map((part) => part.replace(/^\d{1,2}\s+/, '').replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 3 && !isGenericBrollQuery(part))
}

/** Noun immediately before a life-stage word: "honey badger cub" → "honey badger". */
export function speciesNearGeneric(text) {
  const src = String(text || '')
  if (!src) return ''
  const re = new RegExp('([A-Za-z][A-Za-z\\-]*(?:\\s+[A-Za-z][A-Za-z\\-]*){0,10})\\s+\\b(?:' + GENERIC + ')\\b', 'gi')
  let best = ''
  let m
  while ((m = re.exec(src))) {
    const toks = m[1].trim().split(/\s+/)
    const kept = []
    for (let i = toks.length - 1; i >= 0; i--) {
      const k = toks[i].toLowerCase()
      if (STOP.has(k) || GENERIC_ONLY_RE.test(k)) {
        if (kept.length) break
        continue
      }
      kept.unshift(toks[i])
      if (kept.length >= 3) break
    }
    const phrase = kept.join(' ')
    if (phrase.length > best.length) best = phrase
  }
  return best
}

export function boundBrollQuery({ query = '', heading = '', text = '', topic = '', stock = false } = {}) {
  const raw = String(query || heading || '').replace(/\s+/g, ' ').trim()
  const scene = [heading, text].filter(Boolean).join(' ')
  const nearby = speciesNearGeneric(scene) || speciesNearGeneric(topic)
  const subjects = [nearby, ...topicSubjects(topic)].filter(Boolean)
  const hay = (scene + ' ' + topic).toLowerCase()
  const picked = subjects.find((s) => hay.includes(s.toLowerCase())) || subjects[0] || ''

  if (isGenericBrollQuery(raw)) {
    if (!picked) return raw
    if (stock) return picked
    const life = raw.split(/\s+/).filter((w) => GENERIC_ONLY_RE.test(w)).join(' ') || stripGenericTerms(raw) || raw
    if (life.toLowerCase().includes(picked.toLowerCase())) return life
    return (picked + ' ' + life).replace(/\s+/g, ' ').trim()
  }

  if (stock) {
    const stripped = stripGenericTerms(raw)
    if (stripped && stripped.toLowerCase() !== raw.toLowerCase()) return stripped
  }

  return raw
}

export function boundBrollKeywords(keywords, { topic = '', sections = [], stock = true } = {}) {
  const scene = (Array.isArray(sections) ? sections : []).map((s) => s.text || s.heading || '').join(' ')
  const fromKw = (Array.isArray(keywords) ? keywords : []).map((k) => boundBrollQuery({
    query: k, topic, text: scene, stock,
  }))
  const fromSections = (Array.isArray(sections) ? sections : []).map((sec) => boundBrollQuery({
    query: sec.visual || sec.broll || sec.heading || '',
    heading: sec.heading || '',
    text: sec.text || '',
    topic,
    stock,
  }))
  const seen = new Set()
  const out = []
  for (const q of fromKw.concat(fromSections)) {
    const key = String(q || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

export function brollScriptBrief() {
  return 'B-roll keywords must name the exact species or object. Never use cub, baby, mother, or nest alone — stock search will match the wrong animal.'
}
