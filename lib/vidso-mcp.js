/** Claude MCP tools for Vidso generation (long-form, thumbnails, clips, etc). */

import { DURATION_PRESETS, secondsFromDurationId } from './entitlements.js'
import { DEFAULT_IMAGE_ASPECT, DEFAULT_IMAGE_QUALITY, isHistorySidecarName } from './image-gen.js'
import { falImageInput } from './fal-image.js'
import { FACELESS_CAPTION_DEFAULT_SIZE, FACELESS_CAPTION_SHADOW_CSS, FACELESS_CAPTION_STROKE_DEFAULT_COLOR, FACELESS_CAPTION_STROKE_DEFAULT_WIDTH } from './faceless-preview.js'
import { recoverScriptData } from './json-repair.js'
import { railwayList } from './railway-files.js'
import { runGatedApi, usageBody } from './gate-run.js'
import { hydrateUsage, incrementStudioCredits } from './usage-store.js'
import { quotaView } from './quota.js'
import { withCompedPlan } from './comped.js'
import { evaluateFeature, evaluatePlan, evaluateStudioCredits, toHttp } from './enforce.js'
import { creditCharge } from './studio-credits.js'
import { pickDefaultVoiceId } from './studio-voice.js'
import { fileKind, fileKindLabel, sortFilesNewest } from './files-gallery.js'

export const MCP_OPEN_TOOLS = new Set(['youtube_status', 'youtube_connect_url', 'vidso_account', 'vidso_catalog'])

const ASPECTS = ['16:9', '9:16', '1:1']
const POLL_KINDS = ['media', 'render', 'clip', 'captions', 'ranking', 'commentary', 'reframe', 'thumbnail']

const ALL_PRESETS = DURATION_PRESETS.long.concat(DURATION_PRESETS.shorts)

export const DEFAULT_LONGFORM_CAPTION = {
  font: 'Bangers, cursive',
  size: FACELESS_CAPTION_DEFAULT_SIZE,
  color: '#ffffff',
  highlight: '#FACC15',
  letterSpacing: 0,
  weight: 700,
  shadow: true,
  textShadow: FACELESS_CAPTION_SHADOW_CSS,
  stroke: true,
  strokeColor: FACELESS_CAPTION_STROKE_DEFAULT_COLOR,
  strokeWidth: FACELESS_CAPTION_STROKE_DEFAULT_WIDTH,
  outline: FACELESS_CAPTION_STROKE_DEFAULT_COLOR,
  outlineWidth: FACELESS_CAPTION_STROKE_DEFAULT_WIDTH,
}

function mcpText(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }] }
}

function fail(message, extra) {
  const err = new Error(message)
  if (extra && extra.status) err.status = extra.status
  if (extra && extra.code) err.code = extra.code
  throw err
}

function assertOk(out) {
  if (!out || out.status >= 400) {
    const body = out?.body || {}
    fail(body.message || body.error || 'Request failed', { status: out?.status, code: body.code })
  }
  return out.body
}

export function resolveDurationSpec(args = {}) {
  const idRaw = String(args.duration_id || args.durationId || '').trim()
  if (idRaw && secondsFromDurationId(idRaw)) {
    const id = idRaw
    const seconds = secondsFromDurationId(id)
    const hit = ALL_PRESETS.find((p) => p.id === id)
    return { id, seconds, label: hit?.label || (seconds + 's') }
  }
  const label = String(args.duration || args.length || '').trim().toLowerCase()
  if (label) {
    const byId = ALL_PRESETS.find((p) => p.id === label)
    if (byId) return byId
    const compact = label.replace(/\s+/g, '')
    const byLabel = ALL_PRESETS.find((p) => p.label.toLowerCase() === label || p.label.toLowerCase().replace(/\s+/g, '') === compact)
    if (byLabel) return byLabel
  }
  const minutes = Number(args.minutes || args.target_minutes)
  if (Number.isFinite(minutes) && minutes > 0) {
    return nearestPreset(Math.round(minutes * 60))
  }
  const seconds = Number(args.duration_seconds || args.seconds)
  if (Number.isFinite(seconds) && seconds > 0) return nearestPreset(seconds)
  return { id: 'long_180', seconds: 180, label: '3 min' }
}

function nearestPreset(seconds) {
  return ALL_PRESETS.reduce((best, row) => (
    Math.abs(row.seconds - seconds) < Math.abs(best.seconds - seconds) ? row : best
  ))
}

function resolveAspect(args, fallback = '16:9') {
  const raw = String(args?.aspect || args?.aspect_ratio || fallback).trim()
  return ASPECTS.includes(raw) ? raw : fallback
}

function unwrapScript(raw) {
  const recovered = recoverScriptData(raw, raw && raw.raw)
  if (recovered) return recovered
  if (raw && raw.script && typeof raw.script === 'object') return raw.script
  return raw
}

function voicesFrom(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.voices)) return data.voices
  return []
}

function publicVoice(v) {
  return {
    id: String(v?.id || v?.voice_id || ''),
    name: String(v?.name || v?.label || v?.id || ''),
    preview: v?.preview_url || v?.preview || '',
  }
}

function jobIdOf(data) {
  return String(data?.jobId || data?.job_id || data?.id || '').trim()
}

async function gated(ctx, method, subpath, body, query) {
  return assertOk(await runGatedApi({
    token: ctx.token,
    user: ctx.user,
    method,
    subpath,
    body,
    query,
  }))
}

async function pickVoice(ctx, requested) {
  const want = String(requested || '').trim()
  const data = await gated(ctx, 'GET', 'tts/voices')
  const list = voicesFrom(data)
  const id = pickDefaultVoiceId(list, want)
  if (!id) fail('No narrator voices are available.')
  return { voice_id: id, voices: list.map(publicVoice).filter((v) => v.id).slice(0, 40) }
}

function scriptSummary(script) {
  if (!script || typeof script !== 'object') return {}
  const sections = Array.isArray(script.sections) ? script.sections : []
  return {
    title: script.title || '',
    topic: script.topic || '',
    hook: String(script.hook || '').slice(0, 400),
    section_count: sections.length,
    sections: sections.map((s) => ({
      heading: s?.heading || s?.title || '',
      words: String(s?.text || '').trim().split(/\s+/).filter(Boolean).length,
    })),
    full_script: script.full_script || sections.map((s) => s?.text || '').filter(Boolean).join('\n\n'),
  }
}

function mediaRenderBody(media, extras = {}) {
  const parts = []
  if (Array.isArray(media?.voiceover_urls)) {
    for (const u of media.voiceover_urls) {
      if (String(u || '').trim()) parts.push(String(u).trim())
    }
  }
  const one = String(media?.voiceover_url || '').trim()
  if (one && !parts.includes(one)) parts.unshift(one)
  if (!parts.length) fail('Media job has no voiceover yet. Keep polling with kind=media.')
  return {
    voiceover_url: parts[0],
    voiceover_urls: parts.length > 1 ? parts : undefined,
    duration: media.duration,
    duration_id: extras.duration_id,
    duration_seconds: extras.duration_seconds,
    words: media.words || [],
    timeline: media.timeline || [],
    aspect: extras.aspect || media.aspect || '16:9',
    caption: extras.caption || DEFAULT_LONGFORM_CAPTION,
    music: extras.music || null,
  }
}

function pollPath(kind, id) {
  if (kind === 'media') return 'faceless/media/' + id
  if (kind === 'render') return 'faceless/render/' + id
  if (kind === 'clip') return 'autoclip/' + id
  if (kind === 'captions') return 'transcribe/' + id
  if (kind === 'ranking') return 'ranking/' + id
  if (kind === 'commentary') return 'commentary/' + id
  if (kind === 'reframe') return 'reframe/' + id
  return ''
}

function nextAfterPoll(kind, job) {
  const status = String(job?.status || '')
  const done = status === 'done' || status === 'ready' || status === 'complete' || status === 'completed'
  const pending = status === 'queued' || status === 'processing' || status === 'running' || !status
  if (kind === 'media' && done) {
    return 'Media is ready. Call longform_render_start with this media_job_id to burn captions and export the MP4.'
  }
  if (kind === 'render' && done) {
    return 'Render is ready. Call youtube_upload with render_job_id and a title to publish, or open My Files in Vidso.'
  }
  if (pending) return 'Still working. Call vidso_poll again with the same kind and job_id.'
  return ''
}

export const VIDSO_MCP_INSTRUCTIONS = [
  'Vidso MCP for the signed-in account: generate videos and thumbnails, then publish to YouTube.',
  'For a long-form faceless YouTube video: invent a specific topic if needed, then call longform_make_video (default 3 min, 16:9).',
  'That writes the script and starts voice + B-roll. Poll with vidso_poll kind=media until done, then longform_render_start, then vidso_poll kind=render.',
  'When the MP4 is ready, youtube_upload accepts render_job_id.',
  'Call vidso_account to see plan quota. Call vidso_catalog for the other tools (thumbnails, clips, captions, voiceover, ranking, commentary, reframe, downloader, files).',
  'If YouTube is not connected, call youtube_status then youtube_connect_url for a Google link the user must open in a browser.',
].join(' ')

export function vidsoMcpTools() {
  const durationProp = {
    type: 'string',
    description: 'Length chip: 30s, 45s, 60s, 3 min, 5 min, 10 min, 15 min, 30 min, or a duration_id like long_180 / shorts_60. Default 3 min.',
  }
  const aspectProp = {
    type: 'string',
    enum: ASPECTS,
    description: 'Frame. 16:9 for YouTube long-form, 9:16 for Shorts. Default 16:9.',
  }
  return [
    {
      name: 'vidso_account',
      description: 'Show this Vidso plan, remaining long-form and short-form videos, and Faceless Studio credits.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'vidso_catalog',
      description: 'List Vidso tools Claude can run over MCP, with which function to call for each.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'longform_make_video',
      description: 'Long Form Generator: invent or take a topic, write the narration, and start voice + stock B-roll. Then poll kind=media and call longform_render_start. Default 3 minutes, 16:9.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Specific video topic or title. Required.' },
          duration: durationProp,
          duration_id: { type: 'string' },
          aspect: aspectProp,
          voice_id: { type: 'string', description: 'ElevenLabs voice id from vidso_voices. Omit to use the default narrator.' },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
    {
      name: 'longform_script',
      description: 'Write a Long Form Generator narration only (no voice or B-roll). Use longform_make_video when the user wants a finished video.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          duration: durationProp,
          duration_id: { type: 'string' },
          aspect: aspectProp,
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
    {
      name: 'vidso_voices',
      description: 'List narrator voices for long-form and AI Voiceover.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'longform_media_start',
      description: 'Start voiceover + B-roll for an existing long-form script JSON from longform_script.',
      inputSchema: {
        type: 'object',
        properties: {
          script: { type: 'object', description: 'Script object returned by longform_script / longform_make_video.' },
          voice_id: { type: 'string' },
          duration_id: { type: 'string' },
          aspect: aspectProp,
        },
        required: ['script'],
        additionalProperties: false,
      },
    },
    {
      name: 'longform_render_start',
      description: 'Export the long-form MP4 with burned-in captions. Pass media_job_id after vidso_poll kind=media is done.',
      inputSchema: {
        type: 'object',
        properties: {
          media_job_id: { type: 'string' },
          duration_id: { type: 'string' },
          aspect: aspectProp,
        },
        required: ['media_job_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'vidso_poll',
      description: 'Poll an async Vidso job started by another tool.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: POLL_KINDS },
          job_id: { type: 'string' },
          status_url: { type: 'string', description: 'For kind=thumbnail, the statusUrl from thumbnail_generate.' },
          response_url: { type: 'string', description: 'For kind=thumbnail, the responseUrl from thumbnail_generate.' },
        },
        required: ['kind'],
        additionalProperties: false,
      },
    },
    {
      name: 'thumbnail_generate',
      description: 'Thumbnail Generator: start a YouTube thumbnail from a prompt. Poll with vidso_poll kind=thumbnail using the returned URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          aspect: { type: 'string', description: 'Default 16:9. Also 9:16, 1:1, 4:3, etc.' },
          model: { type: 'string', description: 'Optional model id. Default nano-banana-pro.' },
          resolution: { type: 'string', enum: ['1K', '2K', '4K'] },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
    },
    {
      name: 'voiceover_generate',
      description: 'AI Voiceover: narrate a script with a Vidso voice. Returns an audio URL.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          voice_id: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
    {
      name: 'captions_transcribe',
      description: 'AI Captions: start transcription of a public video or audio URL.',
      inputSchema: {
        type: 'object',
        properties: {
          file_url: { type: 'string', description: 'https URL of the video or audio to transcribe.' },
        },
        required: ['file_url'],
        additionalProperties: false,
      },
    },
    {
      name: 'clip_analyze',
      description: 'Clipping: analyze a public video URL for viral moments. Pro+ feature.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
        additionalProperties: false,
      },
    },
    {
      name: 'clip_start',
      description: 'Clipping: start autoclip on a public file URL. Poll with vidso_poll kind=clip.',
      inputSchema: {
        type: 'object',
        properties: {
          file_url: { type: 'string' },
          count: { type: 'integer', minimum: 1, maximum: 12 },
        },
        required: ['file_url'],
        additionalProperties: false,
      },
    },
    {
      name: 'ranking_start',
      description: 'Ranking: assemble a ranked short from clip URLs. Poll with vidso_poll kind=ranking.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          videos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                rank: { type: 'integer' },
                start: { type: 'number' },
                end: { type: 'number' },
                clipTitle: { type: 'string' },
              },
              required: ['url'],
            },
          },
        },
        required: ['videos'],
        additionalProperties: false,
      },
    },
    {
      name: 'commentary_script',
      description: 'Video Commentary: write a spoken script for a reaction/commentary clip.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          tone: { type: 'string' },
          length: { type: 'string' },
          hook: { type: 'string' },
          cta: { type: 'string' },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
    {
      name: 'commentary_start',
      description: 'Video Commentary: burn voice and captions onto a clip. Poll with vidso_poll kind=commentary.',
      inputSchema: {
        type: 'object',
        properties: {
          file_url: { type: 'string' },
          script: { type: 'string' },
          aspect: aspectProp,
        },
        required: ['file_url', 'script'],
        additionalProperties: false,
      },
    },
    {
      name: 'reframe_start',
      description: 'AI Reframe: start subject tracking on a landscape URL so it can be cropped to 9:16. Poll with vidso_poll kind=reframe. Finish the crop in the Vidso app.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
        additionalProperties: false,
      },
    },
    {
      name: 'download_info',
      description: 'Video Downloader: fetch title and formats for a public video URL.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
        additionalProperties: false,
      },
    },
    {
      name: 'download_search',
      description: 'Video Downloader: search for videos to download.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['q'],
        additionalProperties: false,
      },
    },
    {
      name: 'broll_search',
      description: 'Search stock B-roll clips for a query (used inside Long Form Generator).',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          aspect: aspectProp,
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'files_list',
      description: 'My Files: list recent generated videos, thumbnails, and uploads.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  ]
}

function catalog() {
  return {
    tools: [
      { name: 'Long Form Generator', mcp: 'longform_make_video', href: '/video-generation' },
      { name: 'Thumbnail Generator', mcp: 'thumbnail_generate', href: '/image-generation' },
      { name: 'Clipping', mcp: 'clip_analyze then clip_start', href: '/clipping' },
      { name: 'Ranking', mcp: 'ranking_start', href: '/ranking' },
      { name: 'AI Captions', mcp: 'captions_transcribe', href: '/captions' },
      { name: 'AI Voiceover', mcp: 'voiceover_generate', href: '/voiceover' },
      { name: 'AI Reframe', mcp: 'reframe_start', href: '/reframe' },
      { name: 'Video Commentary', mcp: 'commentary_script then commentary_start', href: '/commentary' },
      { name: 'Video Downloader', mcp: 'download_info / download_search', href: '/downloader' },
      { name: 'My Files', mcp: 'files_list', href: '/files' },
      { name: 'YouTube', mcp: 'youtube_status, youtube_upload', href: '/home' },
      { name: 'Video Editor', mcp: null, href: '/editor', note: 'Timeline editor is in the Vidso app only.' },
    ],
    longform_flow: [
      'longform_make_video',
      'vidso_poll kind=media',
      'longform_render_start',
      'vidso_poll kind=render',
      'youtube_upload render_job_id',
    ],
  }
}

async function accountSnapshot(user) {
  const granted = withCompedPlan(user)
  const usage = await hydrateUsage(granted)
  const quota = quotaView(granted, usage)
  const plan = evaluatePlan(granted)
  return {
    plan: granted.plan || granted.plan_tier || null,
    plan_status: granted.plan_status,
    plan_ok: !!plan.ok,
    quota: quota.longText,
    remaining_long_form: quota.remainingLong,
    remaining_short_form: quota.remainingShort,
    ...usageBody(granted, usage),
  }
}

async function runScript(ctx, args) {
  const topic = String(args.topic || '').trim()
  if (!topic) fail('Give a topic for the video.')
  const picked = resolveDurationSpec(args)
  const aspect = resolveAspect(args)
  const raw = await gated(ctx, 'POST', 'faceless/script', {
    topic,
    aspect,
    duration_id: picked.id,
    duration_seconds: picked.seconds,
    duration: picked.seconds / 60,
  })
  const script = unwrapScript(raw)
  if (!script || typeof script !== 'object') fail('Script generation returned nothing.')
  script.topic = script.topic || topic
  script.aspect = script.aspect || aspect
  script.duration_id = picked.id
  script.duration_seconds = picked.seconds
  return { picked, aspect, script, summary: scriptSummary(script) }
}

async function startMedia(ctx, script, args) {
  const picked = resolveDurationSpec({
    duration_id: args.duration_id || script.duration_id,
    duration_seconds: args.duration_seconds || script.duration_seconds,
    duration: args.duration,
  })
  const aspect = resolveAspect({ aspect: args.aspect || script.aspect })
  const voice = await pickVoice(ctx, args.voice_id || script.voice_id)
  const data = await gated(ctx, 'POST', 'faceless/media', {
    script: {
      ...script,
      aspect,
      voice_id: voice.voice_id,
      duration_id: picked.id,
      duration_seconds: picked.seconds,
    },
    voice_id: voice.voice_id,
    aspect,
    duration_id: picked.id,
    duration_seconds: picked.seconds,
  })
  const media_job_id = jobIdOf(data)
  if (!media_job_id) fail('Media job did not return an id.')
  return { media_job_id, voice_id: voice.voice_id, duration_id: picked.id, aspect }
}

function falKey() {
  return String(process.env.FAL_KEY || process.env.FAL_API_KEY || '').replace(/^Key\s+/i, '').trim()
}

function isQueueUrl(url) {
  try {
    const u = new URL(String(url || ''))
    return u.protocol === 'https:' && u.hostname === 'queue.fal.run'
  } catch {
    return false
  }
}

async function startThumbnail(ctx, args) {
  const plan = evaluatePlan(ctx.user)
  if (!plan.ok) fail(plan.message)
  const key = falKey()
  if (!key) fail('Image generation is not configured on this deployment.')
  const prompt = String(args.prompt || '').trim()
  if (!prompt) fail('Enter a prompt')
  const quality = String(args.resolution || args.quality || DEFAULT_IMAGE_QUALITY).toUpperCase()
  if (quality === '4K') {
    const gate = evaluateFeature({ user: ctx.user, feature: 'image_4k' })
    if (!gate.ok) fail(gate.message)
  }
  const built = falImageInput(args.model, prompt, {
    aspect: args.aspect || DEFAULT_IMAGE_ASPECT,
    num_images: 1,
    resolution: quality,
  })
  const charge = creditCharge({
    kind: 'image',
    model: built.model.id,
    resolution: built.input.resolution || quality,
    numImages: 1,
    aspect: built.input.aspect_ratio || args.aspect,
    width: built.size?.width,
    height: built.size?.height,
  })
  const usage = await hydrateUsage(ctx.user)
  const credits = evaluateStudioCredits({ user: ctx.user, cost: charge, used: usage.studio_credits_used })
  if (!credits.ok) {
    const http = toHttp(credits)
    fail(http.body?.error || credits.message)
  }
  const falRes = await fetch('https://queue.fal.run/' + built.endpoint, {
    method: 'POST',
    headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(built.input),
  })
  const text = await falRes.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  if (!falRes.ok) fail(String(data.detail || data.error || data.raw || 'Image service failed').slice(0, 400))
  if (!data.request_id || !data.status_url || !data.response_url) fail('The image service did not return a request handle')
  try { await incrementStudioCredits(ctx.user, credits.charge) } catch (_) {}
  return {
    kind: 'thumbnail',
    model: built.model.id,
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
    next: 'Call vidso_poll with kind=thumbnail, status_url, and response_url until done.',
  }
}

async function pollThumbnail(args) {
  const key = falKey()
  if (!key) fail('Image generation is not configured on this deployment.')
  const statusUrl = args.status_url || args.statusUrl
  const responseUrl = args.response_url || args.responseUrl
  if (!isQueueUrl(statusUrl) || !isQueueUrl(responseUrl)) fail('Missing thumbnail status_url and response_url from thumbnail_generate.')
  const st = await fetch(statusUrl, { headers: { Authorization: 'Key ' + key } })
  const status = await st.json().catch(() => ({}))
  if (!st.ok) fail(String(status.detail || status.error || 'Image status failed').slice(0, 400))
  if (status.status === 'FAILED' || status.status === 'CANCELLED') fail(status.error || ('Generation ' + String(status.status).toLowerCase()))
  if (status.status !== 'COMPLETED') return { done: false, status: status.status || 'processing', next: 'Call vidso_poll again with the same kind=thumbnail URLs.' }
  const r = await fetch(responseUrl, { headers: { Authorization: 'Key ' + key } })
  const result = await r.json().catch(() => ({}))
  if (!r.ok) fail(String(result.detail || result.error || 'Image result failed').slice(0, 400))
  const urls = []
  if (Array.isArray(result.images)) {
    for (const img of result.images) urls.push(typeof img === 'string' ? img : img?.url)
  }
  if (result.image) urls.push(typeof result.image === 'string' ? result.image : result.image.url)
  const clean = [...new Set(urls.filter(Boolean))]
  if (!clean.length) fail('No image came back')
  return { done: true, status: 'done', urls: clean }
}

export async function runVidsoMcpTool(name, args, ctx) {
  const a = args && typeof args === 'object' ? args : {}
  const known = vidsoMcpTools().some((t) => t.name === name)
  if (!known) {
    const err = new Error('Unknown tool')
    err.code = -32601
    throw err
  }
  const user = ctx?.user
  if (!user) fail('Missing Vidso user')

  if (name === 'vidso_account') return mcpText(await accountSnapshot(user))
  if (name === 'vidso_catalog') return mcpText(catalog())

  if (name === 'longform_script') {
    const out = await runScript(ctx, a)
    return mcpText({
      duration: out.picked,
      aspect: out.aspect,
      script: out.script,
      summary: out.summary,
      next: 'Call longform_media_start with this script, or longform_make_video to do script + media in one step.',
    })
  }

  if (name === 'longform_make_video') {
    const out = await runScript(ctx, a)
    const media = await startMedia(ctx, out.script, { ...a, duration_id: out.picked.id, aspect: out.aspect })
    return mcpText({
      title: out.script.title || a.topic,
      duration: out.picked,
      aspect: out.aspect,
      voice_id: media.voice_id,
      summary: out.summary,
      script: out.script,
      media_job_id: media.media_job_id,
      next: 'Call vidso_poll with kind=media and this media_job_id until status is done, then longform_render_start.',
    })
  }

  if (name === 'vidso_voices') {
    const voice = await pickVoice(ctx, '')
    return mcpText({ default_voice_id: voice.voice_id, voices: voice.voices })
  }

  if (name === 'longform_media_start') {
    const script = a.script && typeof a.script === 'object' ? a.script : null
    if (!script) fail('Pass the script object from longform_script.')
    const media = await startMedia(ctx, script, a)
    return mcpText({
      ...media,
      next: 'Call vidso_poll with kind=media and this media_job_id until done, then longform_render_start.',
    })
  }

  if (name === 'longform_render_start') {
    const mediaId = String(a.media_job_id || a.job_id || '').trim()
    if (!mediaId) fail('Pass media_job_id from longform_make_video.')
    const media = await gated(ctx, 'GET', 'faceless/media/' + encodeURIComponent(mediaId))
    const status = String(media?.status || '')
    if (status === 'queued' || status === 'processing') {
      return mcpText({
        status,
        step: media.step || 'Media is still rendering voice and B-roll.',
        next: 'Keep calling vidso_poll kind=media until done, then longform_render_start again.',
      })
    }
    if (status === 'error') fail(media.error || 'Media job failed')
    const picked = resolveDurationSpec({
      duration_id: a.duration_id || media.duration_id,
      duration_seconds: a.duration_seconds || media.duration,
    })
    const aspect = resolveAspect({ aspect: a.aspect || media.aspect })
    const data = await gated(ctx, 'POST', 'faceless/render', mediaRenderBody(media, {
      duration_id: picked.id,
      duration_seconds: picked.seconds,
      aspect,
    }))
    const render_job_id = jobIdOf(data)
    if (!render_job_id) fail('Render job did not return an id.')
    return mcpText({
      render_job_id,
      duration: picked,
      aspect,
      next: 'Call vidso_poll with kind=render and this render_job_id until done. Then youtube_upload with render_job_id.',
    })
  }

  if (name === 'vidso_poll') {
    const kind = String(a.kind || '').trim()
    if (!POLL_KINDS.includes(kind)) fail('kind must be one of ' + POLL_KINDS.join(', '))
    if (kind === 'thumbnail') return mcpText(await pollThumbnail(a))
    const id = String(a.job_id || a.media_job_id || a.render_job_id || '').trim()
    if (!id) fail('Pass job_id')
    const query = kind === 'clip' && a.count ? { count: a.count } : undefined
    const job = await gated(ctx, 'GET', pollPath(kind, encodeURIComponent(id)), {}, query)
    const next = nextAfterPoll(kind, job)
    return mcpText({
      kind,
      job_id: id,
      ...job,
      next: next || undefined,
    })
  }

  if (name === 'thumbnail_generate') return mcpText(await startThumbnail(ctx, a))

  if (name === 'voiceover_generate') {
    const text = String(a.text || '').trim()
    if (!text) fail('Pass text to narrate.')
    const voice = await pickVoice(ctx, a.voice_id)
    const data = await gated(ctx, 'POST', 'tts/generate', { text, voice_id: voice.voice_id })
    return mcpText({
      voice_id: voice.voice_id,
      url: data.url || data.file_url || data.publicUrl || '',
      ...data,
    })
  }

  if (name === 'captions_transcribe') {
    const file_url = String(a.file_url || a.url || '').trim()
    if (!file_url) fail('Pass file_url')
    const data = await gated(ctx, 'POST', 'transcribe', { file_url })
    const job_id = jobIdOf(data)
    return mcpText({ ...data, job_id, next: job_id ? 'Call vidso_poll with kind=captions and this job_id.' : undefined })
  }

  if (name === 'clip_analyze') {
    const url = String(a.url || a.file_url || '').trim()
    if (!url) fail('Pass a video url')
    return mcpText(await gated(ctx, 'POST', 'download/analyze', { url }))
  }

  if (name === 'clip_start') {
    const file_url = String(a.file_url || a.url || '').trim()
    if (!file_url) fail('Pass file_url')
    const data = await gated(ctx, 'POST', 'autoclip', { file_url })
    const job_id = jobIdOf(data)
    return mcpText({ ...data, job_id, next: job_id ? 'Call vidso_poll with kind=clip and this job_id.' : undefined })
  }

  if (name === 'ranking_start') {
    const videos = Array.isArray(a.videos) ? a.videos : []
    if (!videos.length) fail('Pass videos: [{ url, rank, start, end, clipTitle }]')
    const titleText = String(a.title || 'Ranking').trim()
    const data = await gated(ctx, 'POST', 'ranking', {
      videos,
      title: typeof a.title === 'object' ? a.title : { text: titleText },
      settings: a.settings || { caption: true },
    })
    const job_id = jobIdOf(data)
    return mcpText({ ...data, job_id, next: job_id ? 'Call vidso_poll with kind=ranking and this job_id.' : undefined })
  }

  if (name === 'commentary_script') {
    return mcpText(await gated(ctx, 'POST', 'commentary/script', {
      topic: a.topic,
      tone: a.tone,
      length: a.length,
      hook: a.hook,
      cta: a.cta,
    }))
  }

  if (name === 'commentary_start') {
    const file_url = String(a.file_url || '').trim()
    const script = String(a.script || '').trim()
    if (!file_url || !script) fail('Pass file_url and script')
    const data = await gated(ctx, 'POST', 'commentary', {
      file_url,
      script,
      shape: { aspect: resolveAspect(a, '9:16') },
    })
    const job_id = jobIdOf(data)
    return mcpText({ ...data, job_id, next: job_id ? 'Call vidso_poll with kind=commentary and this job_id.' : undefined })
  }

  if (name === 'reframe_start') {
    const url = String(a.url || a.file_url || '').trim()
    if (!url) fail('Pass url')
    const data = await gated(ctx, 'POST', 'reframe', { url })
    const job_id = jobIdOf(data)
    return mcpText({
      ...data,
      job_id,
      next: job_id
        ? 'Call vidso_poll with kind=reframe until ready, then finish the 9:16 crop in the Vidso AI Reframe page.'
        : undefined,
    })
  }

  if (name === 'download_info') {
    const url = String(a.url || '').trim()
    if (!url) fail('Pass url')
    return mcpText(await gated(ctx, 'POST', 'download/info', { url }))
  }

  if (name === 'download_search') {
    const q = String(a.q || a.query || '').trim()
    if (!q) fail('Pass q')
    return mcpText(await gated(ctx, 'POST', 'download/search', { q, limit: a.limit }))
  }

  if (name === 'broll_search') {
    const query = String(a.query || a.q || '').trim()
    if (!query) fail('Pass query')
    return mcpText(await gated(ctx, 'POST', 'faceless/broll/search', {
      query,
      aspect: resolveAspect(a),
    }))
  }

  if (name === 'files_list') {
    const files = sortFilesNewest(await railwayList(ctx.token)).filter((f) => {
      const name = f?.original_name || f?.name || ''
      return !isHistorySidecarName(name)
    })
    const limit = Math.max(1, Math.min(50, Number(a.limit) || 20))
    return mcpText(files.slice(0, limit).map((f) => ({
      id: f.id,
      name: f.original_name || f.name,
      kind: fileKindLabel(f),
      type: fileKind(f),
      url: f.url,
      created_at: f.created_at || f.createdAt,
    })))
  }

  const err = new Error('Unknown tool')
  err.code = -32601
  throw err
}
