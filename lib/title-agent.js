/**
 * Title agent: writes title options for a long-form faceless video.
 *
 * What the November 2026 study found (3,071 recent long-form videos on 134
 * channels, each scored against its own channel's median views):
 *  - Inside one channel, surface tricks barely moved views: question marks +4
 *    points, superlatives +3, "!" -2, everything else within 2 points.
 *  - The same wording can do 833x on one channel and 0.34x on another
 *    ("The Psychology of Gen X"), so wording alone does not decide a breakout.
 *  - On 55 held-out breakout-vs-flop pairs from 89 unseen channels, three
 *    models picked the real breakout 51-60% of the time, and giving them title
 *    rules did not help (49-55%). Nobody can call a breakout from the title.
 * So the agent does not claim to predict views. It writes clean, specific
 * titles on genuinely different angles, in shapes that broke out on several
 * channels, and the creator picks or tests them.
 *
 * Pure module: no keys. The server route passes the fal key to runTitleAgent.
 */
import { pickScriptFormat } from './script-formats.js'

export const TITLE_RULES = [
  '1) Give each title a different angle on the topic: a different question it answers or a different group it is for, so the options are real alternatives and not rewordings.',
  '2) Put one concrete specific in each title: a named person, place or object, a number, or a year.',
  '3) Make the subject clear in two seconds of scrolling: someone should know what the video is about from the title alone.',
  '4) Keep it under 60 characters when you can, key words first. No "!", no hype words (insane, crazy, shocking, mind-blowing, unbelievable), no first person, at most one word in capitals, no emoji, no channel name.',
  '5) Never promise something the video does not deliver. Use only numbers, names and dates that appear in the script or are common knowledge about the topic; never invent a statistic, a time ("in 7 seconds"), an age or a count. If you are unsure of a figure, use a named place or object instead of a number. Do not state a contested theory as fact.',
].join(' ')

/** Title shapes that broke out, per script format (same ids as script-formats.js). */
export const TITLE_PATTERNS = {
  'you-are-there': ['What Did Ancient Humans Do For Pleasure?', 'What Did Ancient Humans Actually Do All Day?', "Why You Wouldn't Survive a Winter on a Royal Navy Ship (1805)"],
  'flash-forward': ['The German Major Who Saw D-Day First', 'The Commander Who Watched His Fleet Die in 6 Minutes', 'Where Did Mansa Musa Get So Much Gold?', 'The ENTIRE History of the Vietnam War in 17 Minutes'],
  'cold-case': ['"Friendly" Cop Has No Idea Police Already Matched Her DNA After 23 Years', 'Girl Disappears. 29 Years Later, Cops Check This Footage Again', 'The Father Who Executed His Entire Family During Lockdown'],
  'mystery-file': ["The Most Disturbing Scientific Anomalies We Can't Explain", '49 Mysterious Events That No One Can Explain', 'Something Weird Is Happening On Europa'],
  'rise-and-fall': ['The Rise and Fall of Starbucks | Why America Is Turning Away', 'WTF Happened to Labubu?'],
  'hidden-system': ["Once You Understand Economics, You Can't Be Manipulated Anymore", 'Which Rich Country Goes Bankrupt First?', "If You Don't Understand the Petrodollar, You Don't Understand Geopolitics"],
  portrait: ['The Psychology of Gen X (Raised Without Applause)', 'The Psychology of People Who Cut Everyone Off', 'Psychology Facts About People Who Stay Up Late'],
  'stoic-lesson': ['Focus on Yourself and Stay Silent | Stoicism', 'Why Are We Afraid of Death? 14 Philosophers Respond', 'Game Theory: A Simple Strategy That Will Change Your Life'],
  'scale-explainer': ["A Light-Year Is So Huge Your Brain Can't Comprehend It", 'The Darkness That Swallows the Universe: TON 618 (The Largest Black Hole)', "Why Almost Nobody Lives on Australia's West Coast", "Why We Can Reach Pluto But Can't Fly Above the Sun"],
  'ranked-explained': ['All U.S. Special Operations Forces Explained', 'Every Unexplored Place on Earth Explained', 'How Every Tudor Died', 'The Most Forbidden Places on Earth Explained'],
  'body-timeline': ['What Happens to Your Body When You Eat Once a Day (Hour By Hour)', 'What Happens to Your Body If You Plank 1 Minute a Day'],
  'build-process': ["Inside the Impossible Kansai Airport: Japan's $20B Floating Mega Project", 'How Starlink Actually Works'],
  documentary: ["Something About Wyoming's Devils Tower No Longer Makes Sense", 'How HIV Started a Century Before Anyone Noticed'],
}

/** Prompt for one LLM call that returns title options (one per angle) as JSON. */
export function titleBrief({ topic, hook = '', script = '', scriptTitle = '', thumbnailText = '', count = 5 } = {}) {
  const t = String(topic || '').trim().slice(0, 600)
  const format = pickScriptFormat(t)
  const examples = TITLE_PATTERNS[format.id] || TITLE_PATTERNS.documentary
  return [
    'You write titles for a long-form faceless YouTube video (a narrated documentary, 8 to 30 minutes).',
    `Video topic: ${t}`,
    hook ? `The narration opens with: "${String(hook).slice(0, 300)}"` : '',
    script ? `Script (the only source of facts you may use): """${String(script).slice(0, 4000)}"""` : '',
    scriptTitle ? `Working title from the script writer: "${String(scriptTitle).slice(0, 120)}"` : '',
    thumbnailText ? `The thumbnail text is "${String(thumbnailText).slice(0, 60)}"; do not repeat its words in the title.` : '',
    `Format: ${format.name}. Title shapes that broke out on several channels in this format: ${examples.map((e) => `"${e}"`).join('; ')}. Use them as shapes, not as text to copy.`,
    'Rules:',
    TITLE_RULES,
    `First list ${count} different angles on the topic and who each one is for. Then write one title per angle, ${count} in total. Put first the one you would publish.`,
    'Return JSON only, no markdown: {"angles":["..."],"titles":[{"title":"...","angle":"...","why":"one short reason"}]}',
  ].filter(Boolean).join('\n')
}

const HYPE = /\b(insane|crazy|shocking|unbelievable|mind-?blowing|incredible|amazing|epic|ultimate|must watch)\b/i
const FIRST_PERSON = /\b(I|I'm|I've|my|me|we|our)\b/
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

/** Guard rails from the study. Returns the problems found (empty = fine). */
export function titleIssues(title) {
  const t = String(title || '').trim()
  const issues = []
  if (t.length < 15) issues.push('too short')
  if (t.length > 80) issues.push('too long')
  if (/!/.test(t)) issues.push('exclamation mark')
  if (HYPE.test(t)) issues.push('hype word')
  if (FIRST_PERSON.test(t)) issues.push('first person')
  if (EMOJI.test(t)) issues.push('emoji')
  const caps = t.match(/\b[A-Z]{3,}\b/g) || []
  const acronyms = caps.filter((w) => /^(USA|US|UK|NASA|CIA|FBI|KGB|WWII|WWI|WW2|AI|CEO|USSR|NATO|ADHD|DNA|MIT|BBC|EU|UFO|UFOS|IQ|ENTIRE|WTF)$/.test(w))
  if (caps.length - acronyms.length > 1) issues.push('too many capitals')
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) issues.push('all capitals')
  return issues
}

/** Parse the model's JSON (tolerates code fences and stray text). */
export function parseTitleResponse(raw) {
  const text = String(raw || '')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return []
  let data
  try { data = JSON.parse(m[0]) } catch { return [] }
  const list = Array.isArray(data?.titles) ? data.titles : []
  const seen = new Set()
  return list
    .map((x) => (typeof x === 'string' ? { title: x } : x))
    .map((x) => ({ title: String(x?.title || '').replace(/\s+/g, ' ').trim().replace(/^"|"$/g, ''), angle: String(x?.angle || '').trim(), why: String(x?.why || '').trim() }))
    .filter((x) => x.title && !seen.has(x.title.toLowerCase()) && seen.add(x.title.toLowerCase()))
}

/** Keep the model's order (its first is the default pick), drop titles that break the guard rails unless none pass. */
export function rankTitles(list, limit = 5) {
  const clean = list.filter((x) => !titleIssues(x.title).length)
  return (clean.length ? clean : list).slice(0, limit)
}

export const TITLE_MODEL = 'anthropic/claude-sonnet-4.5'
export const TITLE_FALLBACK_MODEL = 'google/gemini-2.5-flash'

/** Server-side: one fal any-llm call, with one fallback model. */
export async function runTitleAgent({ topic, hook, script, scriptTitle, thumbnailText, falKey, model, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Title agent is not configured on this deployment.')
  if (!String(topic || '').trim()) throw new Error('A topic is required.')
  const prompt = titleBrief({ topic, hook, script, scriptTitle, thumbnailText })
  const models = [model || TITLE_MODEL, TITLE_FALLBACK_MODEL].filter((m, i, a) => a.indexOf(m) === i)
  let lastError = null
  for (const m of models) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.output) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Title model returned nothing')
      const titles = rankTitles(parseTitleResponse(data.output))
      if (titles.length) return { titles, model: m, format: pickScriptFormat(topic).id }
      lastError = new Error('Title model returned no usable titles')
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Title agent failed')
}
