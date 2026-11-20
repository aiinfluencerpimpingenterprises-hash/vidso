/**
 * Scene agent: turns slices of narration into visual scene descriptions, then
 * joins finished scene images and clips into MP4s with fal's hosted ffmpeg.
 * Server-side only (takes the fal key).
 */

const MAX_PER_CALL = 30

export function scenePrompt({ scenes, topic, styleName, character } = {}) {
  return [
    'You are the art director for a narrated faceless YouTube video. For each numbered narration chunk, write ONE visual scene for an illustrator.',
    topic ? `Video topic: ${String(topic).slice(0, 200)}` : '',
    styleName ? `Art style (do not describe it, it is added later): ${styleName}.` : '',
    character ? `Recurring main character: ${String(character).slice(0, 200)}. Put them in scenes where a person fits, doing what the narration describes.` : '',
    'Rules: show exactly what that chunk is about, as one concrete moment: who or what, doing what, where, from what camera angle. 15 to 40 words each. Vary the shots (wide, close-up, overhead, detail) so consecutive scenes do not look alike. Keep people, places and eras consistent with the topic. No text, signs, captions, logos or real brand marks in the image. Never depict gore or anything unsafe for YouTube ads.',
    'Narration chunks:',
    ...scenes.map((s) => `${s.i}: ${String(s.text || '').slice(0, 400)}`),
    'Return JSON only, no markdown: {"scenes":[{"i":0,"prompt":"..."}]}',
  ].filter(Boolean).join('\n')
}

export function parseScenes(raw, wanted) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return {}
  let data
  try { data = JSON.parse(m[0]) } catch { return {} }
  const out = {}
  for (const s of Array.isArray(data?.scenes) ? data.scenes : []) {
    const i = Number(s?.i)
    const prompt = String(s?.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 400)
    if (Number.isInteger(i) && wanted.has(i) && prompt) out[i] = prompt
  }
  return out
}

async function llm(falKey, prompt, fetchImpl) {
  for (const model of ['anthropic/claude-sonnet-4.5', 'anthropic/claude-haiku-5.5']) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.output) return data.output
    } catch (_) {}
  }
  return ''
}

/** Scene descriptions for every chunk; chunks the model skips fall back to their own narration. */
export async function runScenePlanner({ scenes, topic, styleName, character, falKey, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Scene agent is not configured on this deployment.')
  const list = (Array.isArray(scenes) ? scenes : []).slice(0, 200).map((s, k) => ({ i: Number.isInteger(s?.i) ? s.i : k, text: String(s?.text || '') }))
  const batches = []
  for (let k = 0; k < list.length; k += MAX_PER_CALL) batches.push(list.slice(k, k + MAX_PER_CALL))
  const results = await Promise.all(batches.map(async (b) => parseScenes(await llm(falKey, scenePrompt({ scenes: b, topic, styleName, character }), fetchImpl), new Set(b.map((s) => s.i)))))
  const merged = Object.assign({}, ...results)
  return list.map((s) => ({ i: s.i, prompt: merged[s.i] || ('An illustration of: ' + s.text.slice(0, 220)) }))
}

/** Join scene images/clips into one MP4 (fal ffmpeg compose). */
export async function runCompose({ segments, falKey, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Compose is not configured on this deployment.')
  const list = (Array.isArray(segments) ? segments : []).filter((s) => /^https:\/\//.test(String(s?.url || '')) && Number(s?.ms) > 0).slice(0, 80)
  if (!list.length) throw new Error('No scenes to join.')
  let t = 0
  const keyframes = list.map((s) => {
    const k = { url: s.url, timestamp: Math.round(t), duration: Math.round(s.ms) }
    t += s.ms
    return k
  })
  const res = await fetchImpl('https://fal.run/fal-ai/ffmpeg-api/compose', {
    method: 'POST',
    headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
    // An image track holds each still for its duration; a video track would show one frame each.
    body: JSON.stringify({ tracks: [{ id: '1', type: 'image', keyframes }] }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.video_url) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Could not join the scenes')
  return { url: data.video_url, ms: Math.round(t) }
}
