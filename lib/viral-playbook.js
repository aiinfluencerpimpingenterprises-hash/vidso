/**
 * Viral playbook for the Script agent.
 *
 * Script side of the viral playbook (thumbnails live in thumbnail-styles.js).
 * Distilled from open-source YouTube agent skills (all MIT licensed):
 *  - Jake Schincariol, youtube-agent-skill (yt-script hook formulas + hook scoring,
 *    yt-package title/thumbnail pairing): https://github.com/Jakeschincariol/youtube-agent-skill
 *  - AgriciDaniel, claude-youtube (retention scripting + thumbnail CTR guides):
 *    https://github.com/AgriciDaniel/claude-youtube
 *  - Albisourous, mrbeast-thumbnail-skill (packaging rules + image-prompt skeleton):
 *    https://github.com/Albisourous/mrbeast-thumbnail-skill
 * The rules are rewritten for faceless, narrated long-form (TTS reads every word,
 * so no stage directions). The hook scorer was recalibrated on the openings of
 * 21 faceless breakout videos; per-format recipes live in script-formats.js.
 */

// ── Script ─────────────────────────────────────────────────────────────────────

/** Retention rules sent with every script request (full narration). Checked
 *  against 21 faceless breakout transcripts (see script-formats.js). */
export const SCRIPT_PLAYBOOK = [
  'Retention rules (this narration is read aloud by a voice, so write only spoken words, no stage directions, no brackets, no markdown):',
  '1) Hook, first 2-3 sentences: no greeting, no "welcome back", no "in this video", no "today we will", no channel intro, and never open with a definition ("X was one of the largest..."). Open on one concrete thing: a dated scene, an exact number, a named person or object, or an image the viewer can picture. Then turn it with "but", "not" or "still" so something does not add up. Keep the first sentence under 15 words. If you are not sure of an exact date or figure, open on a scene without one rather than invent it.',
  '2) By the third sentence, open a loop: ask the question the whole video answers, or promise a specific reveal ("and the cause was one decision any business textbook would recommend"), and say the answer is coming. Hold the full answer for later, and start the story within the first minute.',
  '3) Re-hook about every 150 to 250 words: a new number, a new name, or a turn ("Here is the part nobody mentions.", "But there is one problem.", "And yet."). Never two sections in a row without one.',
  '4) Make abstract things physical: compare sizes, amounts and times to things the viewer knows (a marble, a football field, a single day). Rule out the obvious explanation before giving the real one.',
  '5) Reach the requested word count; spend the extra words on more real detail per section, not on summary. Sentences average 8 to 16 words; mix very short lines with longer, flowing ones and never stack more than three short sentences in a row. Present tense for scenes. One idea per beat. No "let\'s dive in" or "here is why" filler transitions.',
  '6) Ending: answer the opening question with new information. You may echo one image from the opening in a single short clause, but never repeat or paraphrase the opening sentences. Stop within a few sentences of the payoff.',
  '7) Calls to action are optional. If used: one line after the hook about what the channel covers, or one comment question at the end tied to the topic. Never before the hook.',
  '8) Avoid hype words (amazing, insane, crazy, mind-blowing, ultimate, epic) and filler (basically, actually, just). Never invent statistics, quotes, studies, dates or sources; if a figure is uncertain, say "around" or leave it out.',
].join(' ')

/** Short version for the outline pass (each section is a few dozen words). */
export const SCRIPT_OUTLINE_PLAYBOOK =
  'Make section 1 a hook: one concrete dated scene, number, name or image from the topic, then a turn that raises the question the video answers; no greeting, channel intro or definition. ' +
  'Start each later section with a new fact, date or name. Save the strongest reveal for the last sections; the last section pays off the opening question with something new and never restates the hook. Never invent statistics or sources.'

/** Instruction for rewriting a weak opening (sent through the section-rewrite endpoint). */
export function hookRewriteInstruction(topic) {
  return [
    'Rewrite ONLY the first 2-3 sentences of this section as a stronger hook for a YouTube video about: ' + String(topic || '').slice(0, 300) + '.',
    'Delete any greeting, channel intro, "in this video" line or definition.',
    'Open on one concrete thing from the topic: a dated scene in present tense, an exact number, a named person or object, or an image the viewer can picture. Keep the first sentence under 15 words.',
    'Then turn it with "but", "not" or "still" so something does not add up, and raise the question the video answers.',
    'No hype words. Do not invent statistics, dates or sources. Keep the rest of the section as it is.',
  ].join(' ')
}

const HYPE = /\b(amazing|incredible|insane|crazy|unbelievable|mind-?blowing|epic|ultimate|revolutionary|shocking)\b/gi
const META = /\b(hey guys|hello everyone|welcome( back)?|in (this|today'?s) video|this video|today,? we('| a)re|today we|we will (look|talk|explore|discuss)|we are going to|let'?s (talk|dive|get started)|our channel|the channel|subscribe|like and)\b/gi
const YOU = /\b(you|your|you're|you've|you'll|yourself)\b/gi
const TENSION = /\b(but|not|no|never|nothing|nobody|no one|isn'?t|wasn'?t|don'?t|doesn'?t|can'?t|stopped|still|only|almost|strange|lie|wrong|off|why|how|what if|until|except|yet|missing|vanished|disappeared|forgotten|hidden|buried|violent|deadly|trap|lose|lost|cost)\b/gi
const ANCHOR = /\b(tonight|right now|late at night|at night|this is|there is|here is|listen|imagine|picture|look at|on (january|february|march|april|may|june|july|august|september|october|november|december)|in \d{2,4}( bc| ad)?|\d{1,2}(st|nd|rd|th)?,? \d{4}|(\d[\d,]*) (years?|days?|hours?|minutes?) ago)\b/gi
const SENSORY = /\b(fire|light|lights|dark|darkness|sound|blood|ladder|roof|rooftop|camera|footage|room|wall|helicopter|sky|ocean|sea|river|water|wind|waves?|ice|snow|mummy|bones?|grave|body|face|hands?|switch|phone|screen|door|key|ship|plane|storm|auction|monster|book|photo|picture|map|coin|gold)\b/gi
const NUMBER = /(\$\s?\d[\d,.]*(\s?(trillion|billion|million|thousand|[kmb])\b)?|\b\d[\d,.]*\s?(%|k|m|x)?\b)/gi
const STOP_CAPS = /^(I|I'm|But|And|So|The|A|An|It|This|That|They|There|What|When|Why|How|In|On|At|If|No|You|Your|Then|Now)$/
const DEFINITION = /^(?!this is|there is|here is)(the |a |an )?[\w' -]{2,40}? (was|is|are|were) (one of|a|an|the|known as) /i

const count = (re, s) => (String(s).match(re) || []).length
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))

/** First 1-2 sentences of a script, the part the hook scorer judges. */
export function openingOf(script, maxSentences = 2) {
  const sec = Array.isArray(script?.sections) ? script.sections[0] : null
  const text = String(sec?.text || script?.full_script || '').trim()
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  return parts.slice(0, maxSentences).join(' ')
}

/**
 * Score a spoken hook on five properties (0-100 each). Calibrated on the opening
 * two sentences of 21 faceless breakouts (20 of 21 score 55+) against greeting,
 * summary, definition and hype openings (all under 55). Bands: STRONG >= 70,
 * WORKABLE 55-69, WEAK < 55. It catches summaries posing as hooks; it is not a
 * predictor of views.
 */
export function scoreHook(text) {
  const s = String(text || '').trim()
  if (!s) return { score: 0, verdict: 'WEAK', weakest: 'specificity', props: {} }
  const first = s.split(/(?<=[.!?])\s+/)[0] || ''
  const words = s.split(/\s+/).filter(Boolean)
  const caps = words.slice(1).filter((w) => /^[A-Z][a-z]/.test(w) && !STOP_CAPS.test(w.replace(/[^\w']/g, ''))).length
  const hype = count(HYPE, s)

  const specificity = clamp(30 + Math.min(40, count(NUMBER, s) * 20) + Math.min(24, caps * 8) + Math.min(30, count(SENSORY, s) * 12) - hype * 18)
  const tension = clamp(25 + Math.min(60, count(TENSION, s) * 18) + (/\?/.test(s) ? 15 : 0))
  const immediacy = clamp(25 + Math.min(45, count(YOU, s) * 15) + Math.min(45, count(ANCHOR, s) * 25))
  const firstWords = first.split(/\s+/).filter(Boolean).length
  const brevity = firstWords <= 14 ? 100 : Math.max(20, 100 - (firstWords - 14) * 6)
  const clean = clamp(100 - count(META, s) * 45 - (DEFINITION.test(first) ? 45 : 0) - hype * 15)

  const props = { specificity, tension, immediacy, brevity, clean }
  let score = Math.round(specificity * 0.25 + tension * 0.25 + immediacy * 0.2 + brevity * 0.1 + clean * 0.2)
  if (clean < 60) score = Math.min(score, 45)
  const low = Math.min(...Object.values(props))
  const weakest = Object.keys(props).find((k) => props[k] === low)
  const verdict = score >= 70 ? 'STRONG' : score >= 55 ? 'WORKABLE' : 'WEAK'
  return { score, verdict, weakest, props }
}
