/**
 * Retention rules for the Script agent: how the first 30 seconds are built,
 * how often the narration re-hooks, and how a video ends so viewers watch the
 * next one instead of leaving.
 *
 * From YouTube Help (the 30-second "intro" share mostly reflects whether the
 * opening matched the title and thumbnail), vidIQ, 1of10, OutlierKit and
 * FluxNote retention guides (2025-2026), and Mario Joos on pacing. These are
 * rules of thumb, not controlled studies.
 */

/** The hook to open with, per script format (ids from script-formats.js). */
export const HOOK_FORMULAS = {
  'cold-case': 'Cold open at the peak: the moment the case turned, in present tense, with the real date and name.',
  'mystery-file': 'Cold open at the strangest moment, in exact physical detail, then the one detail nobody can explain.',
  'flash-forward': 'Start at the most dramatic moment of the story, then say "but to understand how we got here…" and go back.',
  'you-are-there': 'Put the viewer inside the scene in the first line ("You are standing…"), with one concrete sight or sound.',
  'rise-and-fall': 'Stakes or cost: the one number or decision that shows how big the fall was, then the turn that it once looked unbeatable.',
  'hidden-system': 'Contrarian: state what most people believe, then say it is backwards, and prove it with one concrete example.',
  portrait: 'Name plus odd detail: the person, and the one strange fact about them that does not add up.',
  'stoic-lesson': "The viewer's problem: name the exact feeling or situation they are in right now, then promise the idea that fixes it.",
  'scale-explainer': 'Shocking number: the one figure that shows the scale, compared with something the viewer knows.',
  'ranked-explained': 'Proof of the title: show the most surprising item first in one line, then promise an even stranger one at the end.',
  'body-timeline': "The viewer's problem: what happens to their body or mind in the first minute, said as a concrete change.",
  'build-process': 'Time-promise roadmap: the finished result in one line, then "in the next few minutes you will see exactly how".',
  documentary: 'Proof of the title: one concrete example that proves the title is true, then the question the video answers.',
}

export const hookFormulaFor = (formatId) => HOOK_FORMULAS[formatId] || HOOK_FORMULAS.documentary

/** How many re-hooks a video of this length gets (one every 60-120 seconds). */
export function rehookCount(seconds) {
  const s = Number(seconds) || 0
  if (s < 150) return 1
  return Math.max(1, Math.round(s / 100))
}

/** The full retention brief for the narration pass. */
export function retentionBrief({ seconds = 600, formatId = 'documentary', nextTopic = '', title = '' } = {}) {
  const n = rehookCount(seconds)
  const next = String(nextTopic || '').trim().slice(0, 140)
  const promise = String(title || '').trim().slice(0, 140)
  return [
    `Hook: ${hookFormulaFor(formatId)}`,
    promise
      ? `The first two sentences must prove the title "${promise}" is true; a viewer who clicked for that title gets it in the first 10 seconds.`
      : 'The first two sentences must prove the video\'s promise is true within 10 seconds.',
    'First 30 seconds: 0-5s the hook; 5-15s restate what the viewer will get; 15-30s the stakes and a one-line roadmap; by 45s a first small payoff (a real fact or answer). No greeting, no channel name, no "in this video", no definition to open.',
    `Re-hooks: about ${n} times across the video (every 60-120 seconds of narration), end a section by teasing the next one in one line ("The next one is the one nobody could explain."). Open the next question before closing the current one.`,
    'Something new every 10-30 seconds: a fact, a name, a number, a turn. Put a reveal or counter-intuitive turn near the middle, and the strongest moment about two-thirds of the way through, not at the very end.',
    'Ending: never signal that the video is ending ("that\'s it for today", "thanks for watching", "in conclusion", "to sum up", "see you next time", "don\'t forget to subscribe"). Close the loop from the opening with new information, put any comment question before the final reveal, then end on the last beat with no wind-down.',
    next
      ? `Last 15-20 seconds: tease the next video, "${next}", in one or two spoken lines that make it sound like the natural next question (for example "But that wasn't even the strangest one. That story is next."). Do not say "link" or "click".`
      : 'Last 15-20 seconds: point to one next question the viewer will want answered, in one or two spoken lines.',
  ].join(' ')
}

/** The short version for the outline pass. */
export function retentionOutlineBrief({ formatId = 'documentary', nextTopic = '' } = {}) {
  const next = String(nextTopic || '').trim().slice(0, 140)
  return [
    `Section 1 opens with this hook: ${hookFormulaFor(formatId)}`,
    'Each section ends by teasing the next. The strongest beat sits about two-thirds through.',
    next ? `The last section ends by teasing the next video, "${next}".` : 'The last section ends on the next question, never a wrap-up line.',
  ].join(' ')
}

/** Sentences that tell viewers the video is over (they leave as soon as they hear one). */
const WRAP_UP = /^\s*(?:and\s+)?(?:so,?\s+)?(?:that'?s (?:it|all)(?: for (?:today|now|this (?:video|episode)))?|thanks? (?:you )?(?:so much )?for watching|thank you for (?:watching|listening|joining)|(?:i )?hope you (?:enjoyed|liked|learned)|see you (?:next time|in the next (?:one|video))|until next time|don'?t forget to (?:like|subscribe|comment|hit)|(?:make sure to |be sure to )?(?:like|subscribe)(?: and (?:subscribe|share|comment))?|in conclusion|to (?:sum|wrap) (?:it |things )?up|and that'?s (?:the story|how)|stay curious|catch you (?:later|next time)|peace out)\b[^.!?]*[.!?]?\s*/i

/** Remove wrap-up sentences from the end of a narration (only the last few sentences are checked). */
export function stripWrapUp(text) {
  let s = String(text || '').trim()
  if (!s) return s
  for (let i = 0; i < 4; i++) {
    const sentences = s.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [s]
    const last = sentences[sentences.length - 1] || ''
    if (sentences.length < 2 || !WRAP_UP.test(last.trim())) break
    s = sentences.slice(0, -1).join('').trim()
  }
  return s
}

/** Remove wrap-up sentences from the end of a script's last section (and full_script if present). */
export function stripScriptWrapUp(script) {
  if (!script || !Array.isArray(script.sections) || !script.sections.length) return script
  const sections = script.sections.slice()
  const i = sections.length - 1
  const cleaned = stripWrapUp(sections[i]?.text)
  if (cleaned === sections[i]?.text) return script
  sections[i] = { ...sections[i], text: cleaned }
  const out = { ...script, sections }
  if (typeof script.full_script === 'string') out.full_script = sections.map((x) => x.text).join('\n\n')
  return out
}
