/**
 * Manager agent: Claude reads each message in the Agents chat and decides
 * what the crew should do, choosing only from a fixed list of app actions.
 *
 * The model never touches the app directly. It returns JSON, which is
 * validated here; the chat runs the actions. Anything unknown is dropped, so
 * the Manager can't do something the app doesn't offer. The keyword router in
 * agents-chat.js stays as the backup when this call fails.
 *
 * Pure module except runManagerAgent, which takes the fal key from the server.
 */

export const MANAGER_ACTIONS = {
  new_video: 'Start a new video. Needs "topic": a clear subject for the video, rewritten from the user\'s words if needed. Only when the user clearly wants a new video on a real subject.',
  captions: 'Change the caption style and re-render the current video. Needs "style": one of the caption style ids given below, or "choose" to show the user the options.',
  titles: 'Ask the Title agent for new title options. Optional "direction": what the user wants from the titles.',
  thumbnail: 'Ask the Thumbnail agent for a new thumbnail. Optional "direction": what the user wants changed.',
  voice: 'Open the narrator voice picker. A new voice means re-recording the narration in the Long Form Generator.',
  length: 'Open the length settings. A new length means making a new cut from the same topic. Use it whenever they ask for a shorter or longer video, in any language.',
  upload: 'Upload the finished video to the user\'s YouTube channel. If the channel is not connected, this action takes them to connect it first, so still use it when they ask to upload.',
  rerender: 'Ask the Editor to render the current video again.',
  open_editor: 'Point the user to the Long Form Generator for things done there: music, swapping B-roll, editing script lines. Also use it as the closest alternative when they ask for a visual change the app cannot make.',
  change_niche: 'Let the user pick a different niche.',
}

const MAX_ACTIONS = 3
const REPLY_MAX = 600

function describe(ctx) {
  const c = ctx || {}
  const lines = []
  if (c.niche) lines.push(`Channel niche: ${c.niche}.`)
  if (c.profile) lines.push(`Brand profile in use: ${c.profile}.`)
  if (c.angle) lines.push(`Script angle: ${c.angle}.`)
  if (!c.hasVideo) lines.push('There is no video yet.')
  else {
    lines.push(`Current video topic: "${String(c.topic || '').slice(0, 200)}". Title: "${String(c.title || '').slice(0, 140)}".`)
    lines.push(`Stage: ${c.stage || 'unknown'}${c.running ? ' (agents are working right now)' : ''}. Narration recorded: ${c.hasMedia ? 'yes' : 'no'}. Finished MP4: ${c.delivered ? 'yes' : 'no'}.`)
    if (c.targetLength) lines.push(`Requested length: ${c.targetLength}.${c.actualLength ? ` Narration came out at ${c.actualLength}.` : ''}`)
    if (c.wordCount) lines.push(`Script: ${c.wordCount} words.`)
  }
  if (c.voice) lines.push(`Narrator voice: ${c.voice}.`)
  if (c.youtubeConnected != null) lines.push(`YouTube channel connected: ${c.youtubeConnected ? 'yes' : 'no'}.`)
  return lines.join(' ')
}

export function managerPrompt({ message, context, history = [], captionStyles = [] } = {}) {
  const actions = Object.entries(MANAGER_ACTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')
  const styles = captionStyles.map((s) => `${s.id} (${s.name})`).join(', ')
  const hist = history.slice(-8).map((h) => `${h.from === 'me' ? 'User' : 'Manager'}: ${String(h.text || '').slice(0, 300)}`).join('\n')
  return [
    'You are the Manager in Vidso, an app where a team of AI agents makes long-form faceless YouTube videos.',
    'The team: Script writes the narration, Title writes 5 title options, Thumbnail designs the thumbnail, Voice records the narration, Agent places B-roll, Editor renders the MP4 with captions.',
    'You read the user\'s message and decide what the team does next, using only these actions:',
    actions,
    styles ? `Caption style ids: ${styles}.` : '',
    'What the app cannot do yet: translate videos, colour grading, filters, adding the user\'s own footage, avatars or a face on screen, posting to TikTok or Instagram. Say so plainly and suggest the closest thing it can do.',
    `Situation: ${describe(context)}`,
    hist ? `Recent chat:\n${hist}` : '',
    `User's new message: """${String(message || '').slice(0, 1000)}"""`,
    'Rules: Reply in the user\'s language, briefly and plainly (1-3 sentences, no hype, no emoji). Answer questions directly using the situation above; never invent facts about their video. If the message changes the current video, use edit actions, never new_video. Use new_video only for a clear new subject; if the subject is vague, ask what the video should be about and use no action. If you are unsure what they want, ask one short question and use no action. Use several actions when they ask for several things. Never claim something is done; say what is starting.',
    'Return JSON only, no markdown: {"reply":"...","actions":[{"type":"...", ...}]}',
  ].filter(Boolean).join('\n')
}

/** Parse and validate the model's JSON. Unknown actions and fields are dropped. */
export function parseManagerResponse(raw, { captionIds = [] } = {}) {
  const m = String(raw || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let data
  try { data = JSON.parse(m[0]) } catch { return null }
  const reply = String(data?.reply || '').trim().slice(0, REPLY_MAX)
  const actions = []
  for (const a of Array.isArray(data?.actions) ? data.actions : []) {
    const type = String(a?.type || '')
    if (!MANAGER_ACTIONS[type]) continue
    if (type === 'new_video') {
      const topic = String(a.topic || '').trim().slice(0, 300)
      if (topic.length < 4) continue
      actions.push({ type, topic })
    } else if (type === 'captions') {
      const style = String(a.style || 'choose')
      actions.push({ type, style: captionIds.includes(style) ? style : 'choose' })
    } else if (type === 'titles' || type === 'thumbnail') {
      actions.push({ type, direction: String(a.direction || '').trim().slice(0, 300) })
    } else {
      actions.push({ type })
    }
    if (actions.length >= MAX_ACTIONS) break
  }
  // A new video replaces the current one, so it never rides along with edits.
  const nv = actions.find((a) => a.type === 'new_video')
  const clean = nv ? [nv] : actions
  if (!reply && !clean.length) return null
  return { reply, actions: clean }
}

export const MANAGER_MODEL = 'anthropic/claude-sonnet-4.5'
export const MANAGER_FALLBACK_MODEL = 'anthropic/claude-haiku-5.5'

export async function runManagerAgent({ message, context, history, captionStyles = [], falKey, model, fetchImpl = fetch } = {}) {
  if (!falKey) throw new Error('Manager agent is not configured on this deployment.')
  if (!String(message || '').trim()) throw new Error('Empty message')
  const prompt = managerPrompt({ message, context, history, captionStyles })
  const captionIds = captionStyles.map((s) => s.id)
  let lastError = null
  for (const m of [model || MANAGER_MODEL, MANAGER_FALLBACK_MODEL].filter((x, i, a) => a.indexOf(x) === i)) {
    try {
      const res = await fetchImpl('https://fal.run/fal-ai/any-llm', {
        method: 'POST',
        headers: { Authorization: 'Key ' + falKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, prompt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.output) throw new Error(data?.detail?.[0]?.msg || data?.error || 'Manager model returned nothing')
      const out = parseManagerResponse(data.output, { captionIds })
      if (out) return { ...out, model: m }
      lastError = new Error('Manager model returned no usable plan')
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Manager agent failed')
}
