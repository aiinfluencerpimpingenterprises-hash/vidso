import test from 'node:test'
import assert from 'node:assert/strict'
import {
  openingOf,
  scoreHook,
  SCRIPT_PLAYBOOK,
} from '../lib/viral-playbook.js'
import { scriptLengthBrief, scriptOutlineBrief } from '../lib/faceless-length.js'
import { pickScriptFormat, scriptFormatBrief, SCRIPT_FORMATS } from '../lib/script-formats.js'

// Opening sentences of faceless breakout videos (11x to 3,754x their channel median).
const REAL_HOOKS = [
  'You are sitting by a fire. It is 40,000 years ago.',
  "Tonight, when the sun goes down, you're going to flip a switch. Light will flood the room and you won't think twice about it.",
  'After September 21st, 2024, Matthew Johnson stopped talking to his three children. A police affidavit would later put it plainly.',
  "Buried inside a rushed interpreter's notes from 1875 is a single mistranslated word. For 150 years, it has been erasing the real identity of one of America's most sacred landmarks.",
  "On June 10th, 2025, in an auction hall in Beijing, a mint green plush monster about four feet tall sold for 1.08 million yuan. That's roughly $150,000 for a toy.",
  'Listen to that sound. That is not a soundtrack.',
  'A narrow ladder on a rooftop in Saigon. At the top, one American helicopter with room for about a dozen people.',
  'There is a certain kind of person who is very strange. They walk into a room and almost instantly feel that something is off.',
  "What if the one thing holding you back from real clarity isn't a lack of motivation or discipline but the simple fact that you're giving too much of yourself away?",
  'This is the Drake Passage, the most violent waters on Earth. 500 miles of open ocean between South America and Antarctica.',
]
const BAD_HOOKS = [
  'Hey guys, welcome back to the channel, today we are going to talk about the Roman Empire.',
  'Hello everyone and welcome back to the channel. Today we are going to explore one of the most daring airport construction projects ever attempted.',
  'In this video we will look at the history of Saturn and some interesting facts about it.',
  'The Roman Empire was one of the largest empires in history. It lasted for many centuries.',
  'Today we are discussing the psychology of Generation X and what makes them unique.',
]

test('hook scorer separates a summary from a hook', () => {
  const summary = scoreHook('Hey guys, welcome back to the channel, today we are going to talk about the Roman Empire.')
  const hook = scoreHook('In 49 BC, one river stood between Caesar and Rome, and crossing it would cost him everything. Why did you never hear what happened next?')
  assert.equal(summary.verdict, 'WEAK')
  assert.ok(hook.score > summary.score + 20, `hook ${hook.score} vs summary ${summary.score}`)
  assert.notEqual(hook.verdict, 'WEAK')
})

test('hook scorer passes real breakout openings and flags summaries', () => {
  for (const h of REAL_HOOKS) assert.notEqual(scoreHook(h).verdict, 'WEAK', h)
  for (const h of BAD_HOOKS) assert.equal(scoreHook(h).verdict, 'WEAK', h)
})

test('hook scorer penalises hype and rewards numbers', () => {
  const hype = scoreHook('This insane, amazing, mind-blowing secret will blow your mind forever and ever.')
  const concrete = scoreHook('97% of the ships that tried this route sank before 1900, and you have sailed it.')
  assert.ok(concrete.props.specificity > hype.props.specificity)
})

test('openingOf takes the first sentences of section one', () => {
  const s = { sections: [{ text: 'First line here. Second line here. Third line.' }, { text: 'Other.' }] }
  assert.equal(openingOf(s), 'First line here. Second line here.')
  assert.equal(openingOf(null), '')
})

test('script briefs carry the retention playbook', () => {
  const brief = scriptLengthBrief({ topic: 'The fall of the Roman Republic', durationSeconds: 600, targetWords: 1500 })
  assert.ok(brief.includes(SCRIPT_PLAYBOOK))
  assert.match(brief, /no greeting/)
  assert.match(brief, /Format: Flash-forward history/)
  const outline = scriptOutlineBrief({ topic: '12 biggest airports', durationSeconds: 1800, targetWords: 4500 })
  assert.match(outline, /Make section 1 a hook/)
  assert.match(outline, /Format: Ranked explained/)
  assert.match(outline, /exactly 12 separate sections/)
})

test('script format follows the topic', () => {
  const cases = {
    'What did ancient humans do at night': 'you-are-there',
    'The murder of a small-town sheriff': 'cold-case',
    'The disappearance of flight MH370': 'mystery-file',
    'The ENTIRE History of the Vietnam War': 'flash-forward',
    'The rise and fall of Labubu': 'rise-and-fall',
    'How the petrodollar controls the world': 'hidden-system',
    'The Psychology Of Gen X': 'portrait',
    'Stoic habits for a calm mind': 'stoic-lesson',
    'A light-year is so huge your brain cannot comprehend it': 'scale-explainer',
    'All U.S. Special Operations Forces Explained': 'ranked-explained',
    'What happens if you plank 1 minute a day': 'body-timeline',
    'How Japan built an airport on the sea': 'build-process',
    'How to grow a garden': 'documentary',
  }
  for (const [topic, id] of Object.entries(cases)) assert.equal(pickScriptFormat(topic).id, id, topic)
})

test('every recipe has an opening, body and ending', () => {
  for (const f of SCRIPT_FORMATS) {
    assert.ok(f.opening && f.body && f.ending, f.id)
    assert.ok(scriptFormatBrief(f.name).length > 0)
  }
})
