/**
 * Channel setup that the Manager runs in the Agents chat right after signup:
 * niche, art style, narrator, captions and video defaults, one question at a
 * time. The answers become the user's first brand profile, so afterwards a
 * single message ("make a video about X") is enough.
 *
 * Pure helpers only (tested); the chat in agents-chat.js renders the steps.
 */

import { visualStyleById } from './visual-styles.js'

export const SETUP_STEPS = ['genre', 'episode', 'style', 'voice', 'captions', 'video']

/**
 * The genre is the first question (like Higgsfield's Faceless Studio): it sets
 * the art styles offered first, the script angle and the caption style.
 */
export const GENRES = [
  { id: 'education', name: 'Education', image: 'flat_whiteboard', angle: 'explainer', captions: 'karaoke', placeholder: 'Channel about how physics shapes everyday life', styles: ['flat_whiteboard', 'flat', 'stick', 'motion_graphic', 'cartoon', 'map'] },
  { id: 'history', name: 'History', image: 'oil', angle: 'story', captions: 'cinematic', placeholder: 'Channel about how ordinary people lived in ancient Rome', styles: ['oil', 'map', 'archive', 'cutout', 'doodle', 'anamorphic'] },
  { id: 'storytelling', name: 'Storytelling', image: '3d', angle: 'story', captions: 'bold', placeholder: 'Channel about the rise and fall of famous companies', styles: ['3d', 'anamorphic', 'cartoon', 'dark_fantasy', 'oil', 'flat'] },
  { id: 'mystery', name: 'Mystery', image: 'anamorphic', angle: 'story', captions: 'neon', placeholder: 'Channel about famous heists and unsolved cases', styles: ['anamorphic', 'anime_noir', 'archive', 'vhs', 'dark_fantasy', 'map'] },
  { id: 'documentary', name: 'Documentary', image: 'archive', angle: 'explainer', captions: 'cinematic', placeholder: 'Channel about the engineering behind megaprojects', styles: ['archive', 'anamorphic', 'map', 'cosmic', 'unreal', 'oil'] },
  { id: 'kids', name: 'Kids', image: '3d', angle: 'explainer', captions: 'kids', placeholder: 'Channel about animals and how they live', styles: ['3d', 'kids_book', 'cartoon', 'clay', 'flat', 'doodle'] },
]
export const genreById = (id) => GENRES.find((g) => g.id === id) || null

/** Channel name and first topics to use when the channel agent is unavailable. */
export function fallbackChannel({ about = '', ideas = [] } = {}) {
  const subject = String(about || '').replace(/^\s*(a\s+)?(youtube\s+)?channel\s+(about|on|for)\s+/i, '').trim()
  const words = subject.split(/\s+/).filter((w) => w.length > 2 && !/^(the|and|for|with|about|how|why|what)$/i.test(w)).slice(0, 2)
  const name = words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') + (words.length === 1 ? ' Explained' : '') : 'My Channel'
  const topics = ideas.length ? ideas.slice(0, 4) : (subject ? [`What nobody tells you about ${subject}`, `The strangest story in ${subject}`, `${subject[0].toUpperCase() + subject.slice(1)}, explained from the start`, `The biggest mistakes people make about ${subject}`] : [])
  return { name, topics }
}

/** What the Manager says when it asks each question. */
export function setupQuestion(step, { name = '', niche = '' } = {}) {
  const hi = name ? `Hi ${name}! ` : 'Hi! '
  switch (step) {
    case 'genre':
      return `${hi}I'm the Manager. I run the team of agents that makes your videos. Let's set up your channel first, then making a video is one message. Pick a genre and tell me what the channel is about.`
    case 'episode':
      return niche
        ? `Here's your channel: ${niche}. What should the first episode be about? Pick one or write your own.`
        : 'What should the first episode be about? Pick one or write your own.'
    case 'niche':
      return `${hi}I'm the Manager. What's your channel about?`
    case 'style':
      return `What should your videos look like? Every scene is drawn by AI in one style, so the channel looks like one series. These suit ${niche || 'your genre'}:`
    case 'voice':
      return 'Who narrates? Press play to hear each voice.'
    case 'captions':
      return 'How should the captions look? They are burned into the video, about four words at a time.'
    case 'video':
      return 'Last one: how long should a video be, and for which screen?'
    default:
      return ''
  }
}

/** Six art styles that suit a niche, best first. */
const NICHE_STYLES = {
  // Led by what the breakout channels in each niche use (Oversimplified, Kings and Generals, Psych2Go,
  // Kurzgesagt, Casual Finance, Academy of Ideas, MagnatesMedia…); the rest are close alternatives.
  history: ['oil', 'archive', 'stick', 'map', 'cutout', 'anamorphic'],
  military: ['map', 'oil', 'unreal', 'archive', 'anamorphic', 'flat'],
  business: ['archive', 'infographic', 'motion_graphic', 'flat', 'stick', 'anamorphic'],
  psychology: ['chibi', 'flat_whiteboard', 'flat', 'doodle', 'slice_of_life', 'stick'],
  space: ['flat', 'cosmic', 'motion_graphic', 'unreal', 'isometric', '3d'],
  philosophy: ['oil', 'renaissance', 'flat', 'stick', 'dark_fantasy', 'archive'],
  crime: ['anamorphic', 'anime_noir', 'archive', 'vhs', 'map', 'flat'],
  tech: ['flat', 'motion_graphic', 'isometric', '3d', 'flat_whiteboard', 'anamorphic'],
  finance: ['stick', 'marker_stick', 'flat_whiteboard', 'infographic', 'flat', 'archive'],
  health: ['flat', 'cartoon', 'flat_whiteboard', '3d', 'infographic', 'stick'],
  geography: ['map', 'flat', 'cosmic', 'isometric', 'archive', 'anamorphic'],
}
const DEFAULT_STYLES = ['cartoon', 'flat_whiteboard', 'anamorphic', 'oil', 'stick', 'archive']

export function stylesForNiche(nicheId) {
  const ids = (NICHE_STYLES[nicheId] || DEFAULT_STYLES).filter((id) => visualStyleById(id))
  return ids.length ? ids : DEFAULT_STYLES
}

/** Narrators to show first: voices with a preview, then the rest; at most `n`. */
export function pickVoices(voices = [], n = 6) {
  const withPreview = voices.filter((v) => v.preview)
  return [...withPreview, ...voices.filter((v) => !v.preview)].slice(0, n)
}

/** The setup answers as a brand profile (the caller normalizes it). */
export function profileFromSetup(answers = {}, nicheName = '') {
  const g = genreById(answers.genre)
  return {
    name: (answers.channelName || (nicheName ? nicheName + ' channel' : 'My channel')).slice(0, 40),
    niche: answers.niche || '',
    visualStyle: answers.style || 'cartoon',
    voiceId: answers.voiceId || '',
    voiceLabel: answers.voiceLabel || '',
    captions: answers.captions || g?.captions || '',
    durationId: answers.durationId || 'long_600',
    aspect: answers.aspect === '9:16' ? '9:16' : '16:9',
    angle: g?.angle || 'auto',
    visualMode: 'cheapest',
    scenePace: 'normal',
  }
}
