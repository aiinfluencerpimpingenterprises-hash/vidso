/**
 * Publish agent: writes the YouTube description and tags for a finished video.
 * Chapters are computed from the script sections (lib/channel-kit.js) and
 * added to the description by the caller, so their timings stay exact.
 *
 * Facts come only from the script; the model is told not to invent any.
 */

export function publishPrompt({ title, topic, script, niche } = {}) {
  return [
    'You write the YouTube description and tags for a long-form faceless video.',
    `Title: "${String(title || '').slice(0, 140)}"`,
    topic ? `Topic: ${String(topic).slice(0, 300)}` : '',
    niche ? `Channel niche: ${String(niche).slice(0, 60)}` : '',
    `Script (the only source of facts): """${String(script || '').slice(0, 5000)}"""`,
    'Description: 2 short paragraphs, 60 to 110 words in total. The first sentence must work on its own in search results, so put the subject and the main keyword in it. Then say what the viewer will learn or see. Plain language, no hype words, no emoji, no hashtags, no links, no timestamps (chapters are added separately), and no claims that are not in the script.',
    'Tags: 8 to 12 search phrases people would type, most specific first, each 1 to 4 words, lowercase, no "#", no duplicates, total under 400 characters.',
    'Return JSON only, no markdown: {"description":"...","tags":["..."]}',
  ].filter(Boolean).join('\n')
}

export function parsePublishResponse(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let data
  try { data = JSON.parse(m[0]) } catch { return null }
  const description = String(data?.description || '').replace(/#\w+/g, '').trim().slice(0, 1500)
  const seen = new Set()
  const tags = []
  let chars = 0
  for (const t of Array.isArray(data?.tags) ? data.tags : []) {
    const tag = String(t || '').toLowerCase().replace(/^#/, '').replace(/[<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (!tag || seen.has(tag)) continue
    if (chars + tag.length > 400) break
    seen.add(tag)
    tags.push(tag)
    chars += tag.length
    if (tags.length >= 15) break
  }
  if (!description) return null
  return { description, tags }
}

export const PUBLISH_MODEL = 'anthropic/claude-sonnet-4.5'
export const PUBLISH_FALLBACK_MODEL = 'anthropic/claude-haiku-5.5'

export async function runPublishAgent({ title, topic, script, niche, falKey, model, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Publish agent is not configured on this deployment.')
  if (!String(script || '').trim()) throw new Error('A script is required.')
  const prompt = publishPrompt({ title, topic, script, niche })
  let lastError = null
  for (const m of [model || PUBLISH_MODEL, PUBLISH_FALLBACK_MODEL].filter((x, i, a) => a.indexOf(x) === i)) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.output) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Publish model returned nothing')
      const out = parsePublishResponse(data.output)
      if (out) return { ...out, model: m }
      lastError = new Error('Publish model returned no usable description')
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Publish agent failed')
}
