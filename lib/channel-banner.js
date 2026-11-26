/**
 * Channel banners: one wide scene per channel, shown behind the Studio header
 * (like a YouTube channel banner). Made once with AI and kept on the channel.
 */
import { visualStyleById, VISUAL_STYLES } from './visual-styles.js'
import { nicheById } from './niches.js'

export const BANNER_MODEL = 'nano-banana'
export const BANNER_ASPECT = '21:9'

/** What the channel is about, in a few words. */
function subjectOf(p) {
  const about = String(p?.about || '').trim().replace(/^(a\s+)?channel\s+(about|that|explaining|on|with|for)\s+/i, '')
  if (about) return about.slice(0, 200)
  const niche = nicheById(p?.niche)?.name || String(p?.niche || '').trim()
  return niche || String(p?.name || 'stories').trim()
}

/** The prompt for a channel's banner: its subject, drawn in its own style, with no text. */
export function channelBannerPrompt(p) {
  const style = visualStyleById(p?.visualStyle) || VISUAL_STYLES[0]
  const name = String(p?.name || '').trim().slice(0, 60)
  return [
    `Wide cinematic banner artwork for a YouTube channel${name ? ` called "${name}"` : ''} about ${subjectOf(p)}.`,
    `Art style: ${style.prompt}.`,
    'A rich establishing scene that captures what the channel is about, with depth and atmosphere.',
    'Main subject toward the right, calmer open space on the left, moody low-key lighting.',
    'No text, no letters, no title, no logos, no watermark, no border, no frame.',
  ].join(' ')
}
