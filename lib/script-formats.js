/**
 * Script recipes per video format, for the Script agent.
 *
 * Built from a transcript study of 21 faceless, narrated YouTube breakouts
 * (2025-2026 uploads at 11x to 3,754x their channel's median views) across
 * history, true crime, mystery, business, finance, psychology, philosophy,
 * space, nature, war, engineering, health and ranked "explained" lists.
 * Each recipe is the opening, body, re-hook and ending pattern those videos
 * share, written as instructions for narration that a voice reads aloud.
 *
 * Format detection reuses the thumbnail agent's topic formats, so the script
 * and the thumbnail for one video read the topic the same way.
 */
import { detectThumbnailFormats } from './thumbnail-styles.js'

export const SCRIPT_FORMATS = [
  {
    id: 'cold-case',
    name: 'Cold case',
    formats: ['true-crime'],
    opening: 'Open on the human stake with a real date and name ("After <date>, <name> stopped answering their phone."), then age and job, then the evidence as concrete nouns (what was found, where). Quote one real line from a record or interview if the topic provides one. End the hook on what is still unresolved.',
    body: 'Tell it in order after the cold open. Each section adds one piece of evidence or one decision someone made. Bring back the cold-open detail midway ("the answer you heard at the start").',
    ending: 'Close on where the case stands today, then a last human line. Call unproven claims allegations and say charged people are presumed innocent.',
    you: 'low',
  },
  {
    id: 'mystery-file',
    name: 'Mystery file',
    formats: ['mystery'],
    match: /\b(myster\w*|unexplained|unsolved|paranormal|haunted|vanish\w*|disappear\w*|no one can explain)\b/i,
    opening: 'No intro. Cold-open on the strongest, most visual case and describe it in exact physical detail (time, place, what is seen), then name the one detail nobody can explain. Move to the next case within a minute.',
    body: 'Each case: its name, year and place, what happened, the unexplained detail, the usual explanation and why it falls short. Save the strongest case for last and tease it early.',
    ending: 'End on the last case, then ask viewers which case they cannot explain, as a comment question.',
    you: 'low',
  },
  {
    id: 'flash-forward',
    name: 'Flash-forward history',
    formats: ['history', 'war', 'disaster'],
    opening: 'Open at the most dramatic moment near the end of the story, as a present-tense image with a date and place ("A narrow ladder on a rooftop in Saigon. April 29th, 1975."). Contrast it with how it began, then ask the question the video answers ("So how did the strongest army on Earth end up on this roof?"). Then rewind.',
    body: 'Tell it in order from the rewind, one turning point per section, each starting with a date or a named person. Present tense for scenes.',
    ending: 'Return to the opening image, answer the question in two or three plain sentences, and close on something from the story that still exists today.',
    you: 'low',
  },
  {
    id: 'you-are-there',
    name: 'You are there',
    formats: [],
    match: /\b((what|how) did (ancient |medieval |early |prehistoric |ordinary )?(humans|people|romans|vikings|egyptians|peasants|kids|children|soldiers|sailors)|daily life|a day in the life|what was it like|for pleasure)\b/i,
    opening: 'Put the viewer in the scene in second person and present tense ("You are sitting by a fire. It is 40,000 years ago."), or start from their own present ("Tonight, when the sun goes down, you will flip a switch."). Then name the common belief about the period and say it is wrong, with the real figure.',
    body: 'Each section answers one part of the question with a real finding, a named site or scholar, and one sensory detail. Keep tying it back to what the viewer does today.',
    ending: 'Close the loop to the viewer\'s present (their phone, their light switch) with one quiet line.',
    you: 'high',
  },
  {
    id: 'rise-and-fall',
    name: 'Rise and fall',
    formats: ['business'],
    opening: 'Open on the peak as a dated scene with an exact price or valuation ("On June 10th, 2025, in an auction hall in Beijing, a plush toy sold for $150,000."), compare its size to companies everyone knows, then give the fall in numbers. Rule out the obvious causes ("Nobody undercut them.") and promise the real cause.',
    body: 'Chronological. Each section turns on a new number ("But here is a quieter number."). Show the decision that caused the fall before its effects.',
    ending: 'End on the open question for what happens next, then one short line on why it matters to the viewer.',
    you: 'low',
  },
  {
    id: 'hidden-system',
    name: 'Hidden system',
    formats: ['finance'],
    match: /\b(petro\w*|\w*dollars?|currency|central bank|economics|the economy|how (money|inflation|interest rates?) works?)\b/i,
    opening: 'Name a system that quietly runs the viewer\'s life, rule out the obvious answers ("It is not the banks. It is not the stock market."), then reveal it. Or open with three outcomes that sound backwards ("why making rent cheaper creates shortages") and promise to prove each one.',
    body: 'Build from first principles. Each section is one real dated case ("Maryland, 2008"), then "here is what actually happened", then the rule, then the viewer\'s own version ("Imagine you are a country like Japan").',
    ending: 'One-line takeaway, then point to the next question the viewer should look into.',
    you: 'medium',
  },
  {
    id: 'portrait',
    name: 'Psychology portrait',
    formats: ['psychology'],
    opening: 'Open on a recognisable type of person or moment, not a named, made-up individual ("There is a certain kind of person who walks into a room and knows something is off."), give the popular view of it, flip it ("It looks like a gift. It is a trap."), then mirror the viewer ("If you are someone like this, you already know.").',
    body: 'Each section: one trait, where it comes from ("Imagine a child growing up in a house where the mood changes like the weather"), what it costs, and a line of inner voice in quotes. Use "you" often.',
    ending: 'Reassure without hype (it is not a flaw), restate the core idea as an identity line, then ask who it reminded them of.',
    you: 'high',
  },
  {
    id: 'stoic-lesson',
    name: 'Philosophy lesson',
    formats: ['philosophy'],
    opening: 'Open with a what-if that rules out the usual answers ("What if what holds you back is not a lack of discipline, but how much of yourself you give away?"), mirror the viewer\'s day in three short clauses, then bring in the philosopher as the authority and promise one practice.',
    body: 'Each section is one principle: a real quote or story from the philosopher, the modern situation where it applies, and one thing to do. Short, rhythmic sentences.',
    ending: 'End on a short imperative the viewer can repeat, and the reason to start today.',
    you: 'high',
  },
  {
    id: 'scale-explainer',
    name: 'Scale explainer',
    formats: ['space', 'science', 'geography', 'nature'],
    match: /\b(light.?years?|universe|galax\w*|planets?|black holes?|waters|deepest|how (big|small|deep|far|old|hot|cold) is)\b/i,
    opening: 'Open on the one real number at the heart of the topic and make it physical in the same breath with a comparison the viewer already knows ("Drop Mount Everest into it and its peak is still a mile underwater."), then give the common belief and flip it ("It is not peaceful."). Never ask the viewer to listen to a sound; the video has no such audio.',
    body: 'Each section is one fact made physical with a comparison at human scale ("Shrink the Sun to a marble and..."). Turn with "But there is one problem" or "And yet". Use real measured figures only.',
    ending: 'Close on what is changing or temporary, then call back to the opening flip.',
    you: 'medium',
  },
  {
    id: 'ranked-explained',
    name: 'Ranked explained',
    formats: ['list', 'versus'],
    match: /(^\s*\d+\s|\btop \d+\b|\b(all|every) .{3,40} explained\b|\branked\b|\btier list\b)/i,
    opening: 'No intro. Start with the most famous item by its name as the first words, add one dry, surprising line about it, then its real details. Say how many items there are and tease the last one.',
    body: 'Each item gets one section: name, the one human or surprising detail, what it actually does, and one wry line. Keep the strongest item for last and the second strongest first.',
    ending: 'Zoom out to all items at once, then one closing line people would quote. Optionally ask which item should be covered next.',
    you: 'low',
  },
  {
    id: 'body-timeline',
    name: 'What happens if',
    formats: ['health'],
    match: /\bwhat happens (to your body )?(if|when) you\b|\bevery day for \d+ days\b|\b\d+ (minutes?|steps|push-?ups) a day\b/i,
    opening: 'Repeat the title question, shrink the effort ("Just one minute. No gym."), state the promised result, then "Some of what you have heard is true. A lot of it is not." and give the roadmap: what happens day by day, the catch, and the mistake almost everyone makes.',
    body: 'Day one second by second, then week by week, each stage with what happens inside the body. Then the catch, then the fix as steps.',
    ending: 'Recap one line per stage, give the honest limit, then ask viewers for their own number as a comment.',
    you: 'high',
  },
  {
    id: 'build-process',
    name: 'Build process',
    formats: ['engineering'],
    match: /\bhow .{0,40}\b(was built|built|were built|is made|was made)\b|\bconstruction\b|\bmega ?project\b/i,
    opening: 'Open on the impossible condition ("This airport was built where no land existed."), list the forces against it (soft seabed, typhoons), then start at zero: "At first there was only the ocean."',
    body: 'Step by step in build order. Each step: the problem, the fix, the number that shows the scale. Re-hook with "But even then, the problem was not over."',
    ending: 'Show the finished result, then the one problem that is still being managed today.',
    you: 'low',
  },
]

export const DEFAULT_SCRIPT_FORMAT = {
  id: 'documentary',
  name: 'Documentary',
  formats: [],
  opening: 'Open on the single most surprising concrete detail in the topic (a dated scene, a number, a named object), then the turn: why it is not what it seems, and the question the video answers.',
  body: 'One idea per section, each opening with a new fact, date or name, each ending pulled toward the next.',
  ending: 'Answer the opening question plainly, then return to the opening image in one line.',
  you: 'medium',
}

const BY_ID = Object.fromEntries([...SCRIPT_FORMATS, DEFAULT_SCRIPT_FORMAT].map((f) => [f.id, f]))
export const scriptFormatById = (id) => BY_ID[id] || null

/** Best script recipe for a topic. */
export function pickScriptFormat(topic) {
  const s = String(topic || '')
  const direct = SCRIPT_FORMATS.find((f) => f.match && f.match.test(s))
  if (direct) return direct
  for (const tf of detectThumbnailFormats(s)) {
    const hit = SCRIPT_FORMATS.find((f) => f.formats.includes(tf))
    if (hit) return hit
  }
  return DEFAULT_SCRIPT_FORMAT
}

const YOU_LINE = {
  high: 'Speak to the viewer as "you" often.',
  medium: 'Use "you" when it puts the viewer in the scene.',
  low: 'Narrate in third person; use "you" rarely.',
}

/** Full recipe for the narration pass. */
export function scriptFormatBrief(topic) {
  const f = pickScriptFormat(topic)
  return [
    `Format: ${f.name}.`,
    `Opening: ${f.opening}`,
    `Body: ${f.body}`,
    `Ending: ${f.ending}`,
    YOU_LINE[f.you] || '',
  ].filter(Boolean).join(' ')
}

/** Short recipe for the outline pass. */
export function scriptFormatOutlineBrief(topic) {
  const f = pickScriptFormat(topic)
  return `Format: ${f.name}. Section 1: ${f.opening} Last section: ${f.ending}`
}
