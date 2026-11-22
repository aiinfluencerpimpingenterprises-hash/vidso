/**
 * Channel agent: names a new channel and suggests its first episodes, from the
 * genre and what the user says the channel is about. Used by the Manager's
 * setup right after signup. The model returns JSON that is validated here.
 */

export const CHANNEL_GENRES = ['education', 'history', 'storytelling', 'mystery', 'documentary', 'kids']

export function channelPrompt({ genre, about, niche, reference = [] } = {}) {
  return [
    'You help someone start a long-form faceless YouTube channel.',
    genre ? `Genre: ${String(genre).slice(0, 40)}.` : '',
    `What the channel is about, in their words: """${String(about || '').slice(0, 300)}"""`,
    niche ? `Niche: ${String(niche).slice(0, 60)}.` : '',
    reference.length ? `They want a channel like one with these recent titles. Match their format and tone, but never copy a title or the channel's name:\n${reference.slice(0, 8).map((t) => '- ' + String(t).slice(0, 140)).join('\n')}` : '',
    'Name: 2 to 3 words, memorable, easy to say and spell, fits the genre, no emoji, no hashtags, no "TV" or "Channel", not the name of an existing famous channel or brand.',
    'Topics: 4 first-episode video titles for this channel, each 4 to 12 words, specific and curiosity-driven, varied (not four of the same kind), no clickbait words like "shocking" or "insane", no emoji, no ALL CAPS, no claims you cannot back up.',
    `genre: the format that fits best, one of ${CHANNEL_GENRES.join(', ')} (education explains, history tells the past, storytelling tells one story per video, mystery covers cases and the unexplained, documentary shows real places, nature and engineering, kids is for children).`,
    'Return JSON only, no markdown: {"name":"...","genre":"...","topics":["...","...","...","..."]}',
  ].filter(Boolean).join('\n')
}

export function parseChannelResponse(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let data
  try { data = JSON.parse(m[0]) } catch { return null }
  const clean = (t, max) => String(t || '').replace(/[#\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim().replace(/^["“']|["”']$/g, '').slice(0, max)
  const name = clean(data?.name, 40)
  const seen = new Set()
  const topics = []
  for (const t of Array.isArray(data?.topics) ? data.topics : []) {
    const x = clean(t, 120)
    if (x.length < 8 || seen.has(x.toLowerCase())) continue
    seen.add(x.toLowerCase())
    topics.push(x)
    if (topics.length >= 4) break
  }
  if (!name || topics.length < 2) return null
  const genre = CHANNEL_GENRES.includes(String(data?.genre || '').toLowerCase()) ? String(data.genre).toLowerCase() : ''
  return { name, genre, topics }
}

export const CHANNEL_MODEL = 'anthropic/claude-sonnet-4.5'
export const CHANNEL_FALLBACK_MODEL = 'anthropic/claude-haiku-5.5'

export async function runChannelAgent({ genre, about, niche, reference = [], falKey, model, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Channel agent is not configured on this deployment.')
  if (String(about || '').trim().length < 3) throw new Error('Say what the channel is about.')
  const prompt = channelPrompt({ genre, about, niche, reference })
  let lastError = null
  for (const m of [model || CHANNEL_MODEL, CHANNEL_FALLBACK_MODEL].filter((x, i, a) => a.indexOf(x) === i)) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.output) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Channel model returned nothing')
      const out = parseChannelResponse(data.output)
      if (out) return { ...out, model: m }
      lastError = new Error('Channel model returned no usable name')
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Channel agent failed')
}
