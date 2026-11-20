/**
 * Studio flow: the guided "new video" screens in the Agents app (brand profile
 * setup, script, video settings, progress). Pure helpers only, so they can be
 * tested without a DOM. Each screen is hosted by the agent that owns that job.
 */

import { planScenes } from './visual-styles.js'

/** Seconds for a length preset id like "long_600". */
export function durationSeconds(id) {
  const m = /_(\d+)$/.exec(String(id || ''))
  return m ? Number(m[1]) : 600
}

/** The agents that host each setup screen, and what they say there. */
export const HOSTS = {
  style: { agent: 'agent', line: 'Pick the look. I draw every scene of your videos in this style, so the whole channel looks like one series.' },
  voice: { agent: 'voice', line: 'Pick who narrates. Press play to hear each voice before you choose.' },
  captions: { agent: 'editor', line: 'Pick how the words look on screen. I burn them in when I render.' },
  script: { agent: 'script', line: 'Tell me what the video is about and I will write it for watch time. Or paste your own script and I will hand it straight to the team.' },
  settings: { agent: 'manager', line: 'Here is the plan for the team. Change anything, then hand it over.' },
}

/** Progress steps, in the order the team works. */
export const PROGRESS_STEPS = [
  { agent: 'script', name: 'Script', note: 'Writes the narration' },
  { agent: 'title', name: 'Title', note: 'Five title options' },
  { agent: 'voice', name: 'Voiceover', note: 'Records the narration' },
  { agent: 'agent', name: 'Scenes', note: 'Draws and animates every scene' },
  { agent: 'thumbnail', name: 'Thumbnail', note: 'Designs the click' },
  { agent: 'editor', name: 'Edit and render', note: 'Captions, cuts, the MP4' },
  { agent: 'publish', name: 'Description', note: 'Description, tags, chapters' },
]

/** Steps with their state from the crew, plus overall percent and the step in focus. */
export function progressFrom(crew = {}, { delivered = false } = {}) {
  const steps = PROGRESS_STEPS.map((s) => {
    const c = crew[s.agent] || {}
    let state = c.state === 'error' ? 'stuck' : (c.state || 'idle')
    if (delivered && state !== 'stuck') state = 'done'
    return { ...s, state, text: c.text || '' }
  })
  const done = steps.filter((s) => s.state === 'done').length
  const working = steps.filter((s) => s.state === 'working').length
  const percent = Math.round(((done + working * 0.4) / steps.length) * 100)
  const focus = steps.find((s) => s.state === 'working') || steps.find((s) => s.state === 'stuck') || [...steps].reverse().find((s) => s.state === 'done') || steps[0]
  return { steps, done, percent: delivered ? 100 : Math.min(99, percent), focus, index: steps.indexOf(focus) }
}

/**
 * What the team will make: scene count, animated scenes and a rough time to
 * make it. Times are rough averages: images come back in about 10 seconds,
 * four at a time; animated clips take a few minutes each, six at a time.
 */
export function videoPlan({ seconds, pace = 'normal', mode = 'cheapest', text = '' } = {}) {
  const total = Number(seconds) || 0
  const words = String(text || '').trim() || Array.from({ length: Math.max(1, Math.round((total / 60) * 150)) }, () => 'w').join(' ')
  const scenes = planScenes({ text: words, duration: total, pace, mode })
  const animated = scenes.filter((s) => s.animate).length
  const minutes = 1 + total / 300 + (scenes.length / 4) * (10 / 60) + Math.ceil(animated / 6) * 4 + 2 + (total / 60) * 0.3
  return { scenes, count: scenes.length, animated, minutes: Math.max(2, Math.round(minutes)) }
}

/** "about 12 min" style label. */
export function makeTimeLabel(minutes) {
  const m = Math.max(1, Math.round(Number(minutes) || 0))
  if (m < 60) return `about ${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return `about ${h} h${r ? ' ' + r + ' min' : ''}`
}
