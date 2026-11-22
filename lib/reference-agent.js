/**
 * Reference agent: the user pastes a YouTube channel they want to be like, and
 * this works out what that channel is about and how it is made, so the
 * channel setup can be filled in the same way.
 *
 * It reads only public pages: the channel page (name, description, channel id)
 * and YouTube's public RSS feed (the latest 15 video titles). No API key.
 */

const GENRE_IDS = ['education', 'history', 'storytelling', 'mystery', 'documentary', 'kids']
const NICHE_IDS = ['history', 'military', 'business', 'psychology', 'space', 'philosophy', 'crime', 'tech', 'finance', 'health', 'geography']
const ANGLE_IDS = ['auto', 'story', 'explainer', 'first_person', 'motivational', 'tutorial']

/** A pasted link or handle as a channel page URL, or null when it is not a YouTube channel. */
export function channelUrlFrom(input) {
  let s = String(input || '').trim()
  if (!s) return null
  if (/^@[\w.-]{2,}$/.test(s)) return 'https://www.youtube.com/' + s
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  let u
  try { u = new URL(s) } catch { return null }
  if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return null
  const m = u.pathname.match(/^\/(@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)/)
  return m ? 'https://www.youtube.com/' + m[1] : null
}

const unescape = (t) => String(t || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u0026/g, '&')

/** Name, description, id and recent titles from the channel's public page and feed. */
export async function fetchChannelInfo(input, { fetchImpl = fetch } = {}) {
  const url = channelUrlFrom(input)
  if (!url) throw new Error('Paste a YouTube channel link, like youtube.com/@channelname.')
  const res = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' } })
  if (!res.ok) throw new Error('Could not open that channel. Check the link.')
  const html = await res.text()
  const id = (html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/) || [])[1]
  if (!id) throw new Error('Could not find that channel. Check the link.')
  const title = unescape((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1])
  const description = unescape((html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1]).slice(0, 600)
  let titles = []
  try {
    const feed = await fetchImpl('https://www.youtube.com/feeds/videos.xml?channel_id=' + id)
    if (feed.ok) titles = [...(await feed.text()).matchAll(/<entry>[\s\S]*?<title>([^<]*)<\/title>/g)].map((m) => unescape(m[1])).slice(0, 15)
  } catch (_) {}
  return { id, url, title, description, titles }
}

export function referencePrompt(info = {}) {
  return [
    'Someone wants to start a long-form faceless YouTube channel like the one below. Work out what it is about and how it is made.',
    `Channel: ${String(info.title || '').slice(0, 120)}`,
    info.description ? `Description: """${String(info.description).slice(0, 600)}"""` : '',
    info.titles?.length ? `Latest video titles:\n${info.titles.slice(0, 15).map((t) => '- ' + String(t).slice(0, 140)).join('\n')}` : '',
    `genre: one of ${GENRE_IDS.join(', ')} (the format: education explains, history tells the past, storytelling tells one story per video, mystery covers cases and the unexplained, documentary shows real places and engineering, kids is for children).`,
    `niche: one of ${NICHE_IDS.join(', ')}, or "" if none fits.`,
    `angle: one of ${ANGLE_IDS.join(', ')}.`,
    'about: one sentence starting "Channel about", describing the subject in plain words, for a new channel in the same space. Do not use the reference channel\'s name.',
    'summary: one sentence on what the reference channel does and what makes its videos work (format, tone, typical subjects). Plain words, no hype.',
    'Return JSON only, no markdown: {"genre":"...","niche":"...","angle":"...","about":"Channel about ...","summary":"..."}',
  ].filter(Boolean).join('\n')
}

export function parseReferenceResponse(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let d
  try { d = JSON.parse(m[0]) } catch { return null }
  const about = String(d?.about || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (about.length < 8) return null
  return {
    genre: GENRE_IDS.includes(d.genre) ? d.genre : 'education',
    niche: NICHE_IDS.includes(d.niche) ? d.niche : '',
    angle: ANGLE_IDS.includes(d.angle) ? d.angle : 'auto',
    about: /^channel about/i.test(about) ? about : 'Channel about ' + about.replace(/^./, (c) => c.toLowerCase()),
    summary: String(d?.summary || '').replace(/\s+/g, ' ').trim().slice(0, 300),
  }
}

export const REFERENCE_MODEL = 'anthropic/claude-sonnet-4.5'
export const REFERENCE_FALLBACK_MODEL = 'anthropic/claude-haiku-5.5'

/** Read a reference channel and return how to set up a channel like it. */
export async function runReferenceAgent({ url, falKey, model, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Reference reading is not configured on this deployment.')
  const info = await fetchChannelInfo(url, { fetchImpl })
  const prompt = referencePrompt(info)
  let lastError = null
  for (const m of [model || REFERENCE_MODEL, REFERENCE_FALLBACK_MODEL].filter((x, i, a) => a.indexOf(x) === i)) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.output) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Reference model returned nothing')
      const out = parseReferenceResponse(data.output)
      if (out) return { ...out, channel: { title: info.title, url: info.url, titles: info.titles.slice(0, 8) }, model: m }
      lastError = new Error('Could not read that channel')
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Reference agent failed')
}
