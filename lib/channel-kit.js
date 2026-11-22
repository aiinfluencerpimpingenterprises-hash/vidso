/**
 * Channel kit: script angles, bring-your-own-script parsing, YouTube chapters
 * and brand profiles. Pure helpers shared by the dashboard, the Agents chat
 * and tests (no DOM, no network).
 */
import { resolveStyleId } from './visual-styles.js'

export const WORDS_PER_MINUTE = 150

/** Script angles the creator can pick (sent with the script brief). */
export const ANGLES = [
  { id: 'auto', name: 'Auto', brief: '' },
  { id: 'story', name: 'Story-driven', brief: 'Angle: story-driven. Tell it as one continuous story with a central person or group, rising stakes and a turning point, in chronological scenes.' },
  { id: 'explainer', name: 'Explainer', brief: 'Angle: explainer. Answer one clear question step by step, from the simple version to the surprising one, with a concrete example in every section.' },
  { id: 'first_person', name: 'First person', brief: 'Angle: first person. Narrate as "I", a guide speaking straight to "you" about what they would see and feel. Do not pretend to be a real, named person.' },
  { id: 'motivational', name: 'Motivational', brief: 'Angle: motivational. Speak to "you", build each section around one real example, and end on a clear lesson and one thing to do today. No hype words.' },
  { id: 'tutorial', name: 'Tutorial', brief: 'Angle: tutorial. Teach how to do it in clear, numbered steps, with the reason behind each step and the most common mistake to avoid.' },
]
const ANGLE_BY_ID = Object.fromEntries(ANGLES.map((a) => [a.id, a]))
export const angleById = (id) => ANGLE_BY_ID[id] || ANGLE_BY_ID.auto
export const angleBrief = (id) => angleById(id).brief

export function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

/** "1,240 words · about 8 min" for a pasted script. */
export function scriptEstimate(text) {
  const words = countWords(text)
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60)
  return { words, seconds, label: words ? `${words.toLocaleString('en-US')} words · about ${formatMinutes(seconds)}` : '' }
}

export function formatMinutes(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  if (s < 90) return `${s} sec`
  const m = s / 60
  return (m < 10 ? m.toFixed(1).replace(/\.0$/, '') : String(Math.round(m))) + ' min'
}

/** Nearest Vidso length preset for a script of this many seconds. */
export function nearestDuration(seconds) {
  const presets = [['long_180', 180], ['long_300', 300], ['long_600', 600], ['long_900', 900], ['long_1800', 1800]]
  let best = presets[0]
  for (const p of presets) if (Math.abs(p[1] - seconds) < Math.abs(best[1] - seconds)) best = p
  return { id: best[0], seconds: best[1] }
}

/**
 * Turn a pasted script into Vidso's script shape. Paragraphs become sections;
 * very long scripts are grouped so there are at most `maxSections`, and
 * markdown headings ("## The fall") become section headings.
 */
export function scriptFromText(text, { title = '', maxSections = 16 } = {}) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim()
  if (!raw) return null
  const blocks = []
  let heading = ''
  for (const part of raw.split(/\n\s*\n/)) {
    const lines = part.trim().split('\n')
    if (/^#{1,4}\s+/.test(lines[0])) {
      heading = lines.shift().replace(/^#{1,4}\s+/, '').trim()
      if (!lines.join(' ').trim()) continue
    }
    const body = lines.join(' ').replace(/\s+/g, ' ').trim()
    if (body) { blocks.push({ heading, text: body }); heading = '' }
  }
  if (!blocks.length) return null
  const per = Math.ceil(blocks.length / maxSections)
  const sections = []
  for (let i = 0; i < blocks.length; i += per) {
    const group = blocks.slice(i, i + per)
    sections.push({
      id: 's' + (sections.length + 1),
      heading: group.find((g) => g.heading)?.heading || (sections.length === 0 ? 'Hook' : 'Part ' + (sections.length + 1)),
      text: group.map((g) => g.text).join(' '),
    })
  }
  const firstLine = sections[0].text.split(/(?<=[.!?])\s+/)[0].slice(0, 90)
  return {
    title: String(title || '').trim() || firstLine,
    sections,
    full_script: sections.map((s) => s.text).join('\n\n'),
    own_script: true,
  }
}

function stamp(sec) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/**
 * YouTube chapters from script sections, timed by word share of the narration.
 * YouTube needs the first at 0:00, at least 3 chapters and 10+ seconds each,
 * so short sections are merged into the one before and the list is dropped
 * when the rules can't be met.
 */
export function buildChapters(sections, durationSec) {
  const list = (Array.isArray(sections) ? sections : []).filter((s) => String(s?.text || '').trim())
  const total = Number(durationSec) || 0
  const words = list.map((s) => countWords(s.text))
  const sum = words.reduce((a, b) => a + b, 0)
  if (!list.length || !sum || total < 30) return []
  let t = 0
  const raw = list.map((s, i) => {
    const at = t
    t += (words[i] / sum) * total
    return { at, title: String(s.heading || 'Part ' + (i + 1)).replace(/\s+/g, ' ').trim().slice(0, 60) }
  })
  const merged = []
  for (const c of raw) {
    const prev = merged[merged.length - 1]
    if (prev && c.at - prev.at < 10) {
      // The previous section is too short to be its own chapter: fold it into this one
      // (the opening chapter keeps its own title so the list still starts at 0:00).
      if (merged.length > 1) merged[merged.length - 1] = { at: prev.at, title: c.title }
      continue
    }
    merged.push(c)
  }
  if (merged.length && total - merged[merged.length - 1].at < 10) merged.pop()
  if (merged.length < 3) return []
  merged[0] = { ...merged[0], at: 0 }
  return merged.map((c) => ({ time: stamp(c.at), title: c.title }))
}

export function chaptersText(chapters) {
  return (chapters || []).map((c) => `${c.time} ${c.title}`).join('\n')
}

// ── Brand profiles ───────────────────────────────────────────────────────────

export const PROFILE_DEFAULTS = {
  name: 'My channel',
  niche: '',
  voiceId: '',
  voiceLabel: '',
  captions: '',
  durationId: 'long_600',
  aspect: '16:9',
  angle: 'auto',
  visualStyle: 'cartoon',
  visualMode: 'cheapest',
  scenePace: 'normal',
  characterUrl: '',
  characterDesc: '',
}

export function normalizeProfile(p = {}) {
  const out = { ...PROFILE_DEFAULTS, ...p }
  out.id = String(p.id || 'p' + Math.random().toString(36).slice(2, 9))
  out.name = String(out.name || PROFILE_DEFAULTS.name).trim().slice(0, 40) || PROFILE_DEFAULTS.name
  out.aspect = out.aspect === '9:16' ? '9:16' : '16:9'
  out.angle = ANGLE_BY_ID[out.angle] ? out.angle : 'auto'
  out.visualStyle = resolveStyleId(out.visualStyle)
  out.durationId = /^(long|shorts)_\d+$/.test(String(out.durationId)) ? out.durationId : PROFILE_DEFAULTS.durationId
  return out
}
