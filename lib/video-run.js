/**
 * Server-side video runs: the Agents pipeline as a step-by-step state machine,
 * so a video keeps being made after the tab is closed.
 *
 * A run is a plain JSON record. `advanceRun(run, io)` does one bounded piece of
 * work (each well under a serverless time limit), moves `run.stage` on, and
 * records what the team did in `run.log` / `run.crew`. The caller saves the
 * record and schedules the next step. All network goes through `io.call`, so
 * the engine is testable without a server.
 *
 * Stages: script → expand → hook → title → media → scenes_plan → scenes_draw
 *         → scenes_animate → compose → render → save → done  (or 'error')
 */

import {
  capScriptToTarget,
  facelessMediaPayloadExtras,
  facelessScriptPayload,
  mergeMediaJobs,
  mergeNewSections,
  needsMoreSections,
  packScriptRequest,
  padListSections,
  rebuildFullScript,
  scriptTimeoutMs,
  scriptWordCount,
  sectionNeedsExpand,
  splitScriptForMedia,
  stitchSectionText,
  trimSpokenText,
  wordsPerSection,
  countSpokenWords,
} from './faceless-length.js'
import { TTS_CHUNK_CHARS, voiceoverPlaylist } from './faceless-media-fallback.js'
import { recoverScriptData, parseScriptResponse } from './json-repair.js'
import { hookRewriteInstruction, openingOf, scoreHook } from './viral-playbook.js'
import { planScenes, sceneImagePrompt, visualStyleById, visualModeById } from './visual-styles.js'
import { videoModelById } from './fal-video.js'
import { angleBrief } from './channel-kit.js'

export const RUN_STAGES = ['script', 'expand', 'hook', 'title', 'media', 'scenes_plan', 'scenes_draw', 'scenes_animate', 'compose', 'render', 'save', 'done']
const AGENT_OF = { script: 'script', expand: 'script', hook: 'script', title: 'title', media: 'voice', scenes_plan: 'agent', scenes_draw: 'agent', scenes_animate: 'agent', compose: 'agent', render: 'editor', save: 'editor' }
const MAX_EXPAND_PASSES = 8
const IMAGE_BATCH = 8 // fal image jobs in flight at once
const VIDEO_BATCH = 6 // fal video jobs in flight at once
const IMAGE_TIMEOUT_MS = 4 * 60 * 1000
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000

/** A new run record from the settings the Agents chat sends. */
export function newRun({ id, owner, settings = {}, now = Date.now() } = {}) {
  const s = settings || {}
  return {
    id: String(id || ''),
    owner: String(owner || ''),
    created: now,
    updated: now,
    stage: s.script?.text ? 'title' : 'script',
    status: 'running', // running | done | error | cancelled
    error: '',
    steps: 0,
    settings: {
      topic: String(s.topic || '').trim().slice(0, 500),
      channel: String(s.channel || ''),
      durationId: String(s.durationId || 'long_600'),
      durationSeconds: Number(s.durationSeconds) || 600,
      aspect: s.aspect === '9:16' ? '9:16' : '16:9',
      angle: String(s.angle || 'auto'),
      voiceId: String(s.voiceId || ''),
      voiceSettings: s.voiceSettings && typeof s.voiceSettings === 'object' ? s.voiceSettings : {},
      visual: {
        style: String(s.visual?.style || ''),
        mode: String(s.visual?.mode || 'cheapest'),
        pace: String(s.visual?.pace || 'normal'),
        characterUrl: String(s.visual?.characterUrl || ''),
        characterDesc: String(s.visual?.characterDesc || ''),
      },
      caption: s.caption && typeof s.caption === 'object' ? s.caption : null,
      music: s.music && s.music.url ? { url: String(s.music.url), volume: Number(s.music.volume ?? 0.25) } : null,
    },
    // Own script (skips writing): the Agents "paste my script" flow sends it ready-made.
    script: s.script?.text ? s.script.built || null : null,
    payload: null,
    expandPasses: 0,
    hookScore: null,
    media: null,
    mediaChunks: null,
    mediaIdx: 0,
    mediaJobs: [],
    mediaJobId: '',
    scenes: null,
    videoModel: '',
    timeline: null,
    renderJobId: '',
    renderProgress: 0,
    videoUrl: '',
    crew: {},
    log: [],
    startedAt: now,
    finishedAt: 0,
  }
}

function say(run, agent, state, text, now = Date.now()) {
  run.crew[agent] = { state, text: String(text || '').slice(0, 200) }
  const last = run.log[run.log.length - 1]
  if (last && last.agent === agent && last.text === text) return
  run.log.push({ at: now, agent, state, text: String(text || '').slice(0, 200) })
  if (run.log.length > 80) run.log = run.log.slice(-80)
}

function fail(run, agent, message) {
  run.status = 'error'
  run.stage = 'error'
  run.error = String(message || 'Something went wrong').slice(0, 300)
  say(run, agent, 'stuck', run.error)
}

function scriptText(script) {
  return String(script?.full_script || (script?.sections || []).map((x) => x.text).join('\n\n'))
}

function unwrapScript(raw) {
  const recovered = recoverScriptData(raw, raw && raw.raw)
  if (recovered) return recovered
  if (raw && raw.script && typeof raw.script === 'object') return raw.script
  return raw
}

async function requestScript(run, io, extra) {
  const st = run.settings
  const body = { ...run.payload, ...packScriptRequest({ topic: st.topic, brief: run.payload.brief, extra }) }
  let raw
  try {
    raw = await io.call('gate', 'POST', '/api/faceless/script', body, { timeoutMs: Math.min(scriptTimeoutMs(st.durationSeconds), 240000) })
  } catch (e) {
    raw = recoverScriptData(e.body || e.data, e.raw)
    if (!raw) throw e
  }
  let data = unwrapScript(raw)
  if (!data || typeof data !== 'object' || (!Array.isArray(data.sections) && !String(data.full_script || '').trim())) {
    data = parseScriptResponse(typeof raw === 'string' ? raw : JSON.stringify(raw || {}))
  }
  if (!data) throw new Error('The script came back empty. Try again.')
  data.voice_id = st.voiceId
  data.voice_settings = st.voiceSettings?.voice_settings || st.voiceSettings
  data.duration_id = st.durationId
  data.duration_seconds = st.durationSeconds
  data.topic = st.topic
  data.aspect = st.aspect
  return data
}

async function rewriteSection(io, body) {
  const out = await io.call('upstream', 'POST', '/api/faceless/script/section', body, { timeoutMs: 90000 })
  if (!out) return ''
  if (typeof out === 'string') return out
  const recovered = recoverScriptData(out, out.raw)
  if (recovered?.sections?.length) {
    const best = recovered.sections.reduce((a, b) => (countSpokenWords(b?.text) > countSpokenWords(a?.text) ? b : a))
    if (best?.text) return String(best.text)
  }
  return String(out.text || out.section?.text || out.rewritten || out.content || '')
}

async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => { while (next < items.length) { const k = next++; out[k] = await fn(items[k], k) } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return out
}

function videoDurationFor(model, seconds) {
  const list = Array.isArray(model?.durations) && model.durations.length ? model.durations : [5]
  return list.reduce((best, d) => (Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best), list[0])
}

// ── stages ──────────────────────────────────────────────────────────────────
const STAGES = {
  async script(run, io) {
    const st = run.settings
    if (!st.topic) return fail(run, 'script', 'Give the agents a topic.')
    say(run, 'script', 'working', 'Writing the script')
    run.payload = facelessScriptPayload({ topic: st.topic, aspect: st.aspect, durationId: st.durationId, durationSeconds: st.durationSeconds })
    const note = angleBrief(st.angle)
    if (note) run.payload.brief = [run.payload.brief, note].filter(Boolean).join(' ')
    run.script = await requestScript(run, io)
    const target = run.payload.final_target_words || run.payload.target_words
    const short = scriptWordCount(run.script) < target * 0.9
    run.stage = short || needsMoreSections(run.script, run.payload.target_sections) ? 'expand' : 'hook'
    say(run, 'script', 'working', `${scriptWordCount(run.script).toLocaleString('en-US')} words so far`)
  },

  /** One expansion pass per step: fill missing sections first, then lengthen the thin ones. */
  async expand(run, io) {
    const target = run.payload.final_target_words || run.payload.target_words
    const want = run.payload.target_sections || 1
    let data = run.script
    run.expandPasses++
    if (needsMoreSections(data, want)) {
      const have = (data.sections || []).length
      const batch = Math.min(4, want - have)
      say(run, 'script', 'working', `Writing parts ${have + 1}–${have + batch} of ${want}`)
      const covered = (data.sections || []).map((s) => String(s?.heading || '').trim()).filter(Boolean).join('; ')
      const extra = (covered ? 'Existing headings: ' + covered + '. ' : '') + `Return valid JSON with exactly ${batch} NEW sections for items ${have + 1} through ${have + batch} of ${want} in "${run.settings.topic}". Do not repeat existing headings. Max 70 words each. Valid JSON only.`
      try {
        const chunk = await requestScript(run, io, extra)
        const added = mergeNewSections(data.sections || [], chunk.sections || [], batch)
        data.sections = (data.sections || []).concat(added)
        if (!added.length) data.sections = padListSections(data.sections, want)
      } catch (_) {
        data.sections = padListSections(data.sections || [], want)
      }
      data = rebuildFullScript(data)
    } else {
      const per = wordsPerSection(target, Math.max((data.sections || []).length, want))
      const rows = (data.sections || []).map((sec, index) => ({ sec, index })).filter((r) => sectionNeedsExpand(r.sec.text, per, 0.9)).slice(0, 4)
      say(run, 'script', 'working', `${scriptWordCount(data).toLocaleString('en-US')} words, lengthening toward ${target.toLocaleString('en-US')}`)
      await pool(rows, 2, async (row) => {
        const have = countSpokenWords(row.sec.text)
        const need = Math.max(80, per - have)
        try {
          const next = await rewriteSection(io, {
            topic: run.settings.topic + `\n\nThis is item ${row.index + 1} of ${want}. ` + (have > 40 ? `Keep every sentence already written. Then CONTINUE with about ${need} more spoken words. Do not restart. Do not recap.` : `Write about ${per} spoken words of narration. Do not summarize.`),
            section_id: row.sec.id,
            heading: row.sec.heading,
            text: row.sec.text,
            full_script: String(data.full_script || '').slice(0, 2500),
            target_words: per,
          })
          if (next) data.sections[row.index] = { ...row.sec, text: trimSpokenText(stitchSectionText(row.sec.text, next), per) }
        } catch (_) {}
      })
      data = rebuildFullScript(data)
    }
    run.script = data
    const words = scriptWordCount(data)
    if (words >= target || run.expandPasses >= MAX_EXPAND_PASSES) {
      run.script = capScriptToTarget(data, target)
      run.stage = 'hook'
    }
  },

  async hook(run, io) {
    const script = run.script
    const sec = script?.sections?.[0]
    run.stage = 'title'
    if (!sec?.text) return
    const before = scoreHook(openingOf(script))
    run.hookScore = before
    if (before.verdict !== 'WEAK') return
    say(run, 'script', 'working', 'Sharpening the opening hook')
    try {
      const next = String(await rewriteSection(io, {
        topic: run.settings.topic + '\n\n' + hookRewriteInstruction(run.settings.topic),
        section_id: sec.id, heading: sec.heading, text: sec.text,
        full_script: String(script.full_script || '').slice(0, 2500),
        target_words: countSpokenWords(sec.text),
      }) || '').trim()
      if (!next || countSpokenWords(next) < countSpokenWords(sec.text) * 0.6) return
      const candidate = rebuildFullScript({ ...script, sections: [{ ...sec, text: next }, ...script.sections.slice(1)] })
      const after = scoreHook(openingOf(candidate))
      if (after.score > before.score) { run.script = candidate; run.hookScore = after }
    } catch (_) {}
  },

  async title(run, io) {
    const s = run.script
    const hook = run.hookScore && run.hookScore.verdict !== 'WEAK' ? ` · ${String(run.hookScore.verdict).toLowerCase()} hook` : ''
    say(run, 'script', 'done', `${scriptWordCount(s).toLocaleString('en-US')} words${hook}`)
    say(run, 'title', 'working', 'Writing 5 title options from the script')
    try {
      const out = await io.call('self', 'POST', '/api/youtube/titles', { topic: run.settings.topic, hook: openingOf(s, 2), script: scriptText(s).slice(0, 6000), script_title: s.title || '' }, { timeoutMs: 30000 })
      const titles = Array.isArray(out?.titles) ? out.titles.filter((t) => t && t.title) : []
      if (titles.length) {
        run.script = { ...s, working_title: s.working_title || s.title || '', title: titles[0].title, title_options: titles }
        say(run, 'title', 'done', 'Picked: ' + titles[0].title)
      } else say(run, 'title', 'idle', "Kept the script's title")
    } catch (_) {
      say(run, 'title', 'idle', "Kept the script's title")
    }
    run.stage = 'media'
  },

  /** Narration + timing, one Railway media job per chunk (each under the TTS cap), polled within the step. */
  async media(run, io) {
    const st = run.settings
    if (!run.mediaChunks) {
      run.mediaChunks = splitScriptForMedia({ ...run.script, topic: st.topic, aspect: st.aspect, voice_id: st.voiceId }, TTS_CHUNK_CHARS)
      run.mediaIdx = 0
      run.mediaJobs = []
    }
    const extras = facelessMediaPayloadExtras(st.durationId, st.durationSeconds)
    const voiceOpts = st.voiceSettings || {}
    const budget = io.now() + (io.budgetMs || 200000)
    while (run.mediaIdx < run.mediaChunks.length && io.now() < budget) {
      const chunk = run.mediaChunks[run.mediaIdx]
      const label = run.mediaChunks.length > 1 ? `Recording the narration (part ${run.mediaIdx + 1} of ${run.mediaChunks.length})` : 'Recording the narration'
      if (!run.mediaJobId) {
        say(run, 'voice', 'working', label)
        const { jobId } = await io.call('gate', 'POST', '/api/faceless/media', {
          script: {
            title: chunk.title || run.script.title, topic: chunk.topic || st.topic, full_script: chunk.full_script,
            keywords: chunk.keywords || run.script.keywords || [], sections: chunk.sections || [], aspect: st.aspect,
            voice_id: st.voiceId, voice_settings: voiceOpts.voice_settings,
            duration_id: extras.duration_id, duration_seconds: extras.duration_seconds, target_words: extras.target_words,
          },
          voice_id: st.voiceId, aspect: st.aspect, ...extras, ...voiceOpts,
        })
        if (!jobId) throw new Error('The narration job did not start.')
        run.mediaJobId = jobId
      }
      const job = await io.call('upstream', 'GET', `/api/faceless/media/${run.mediaJobId}`)
      if (job.status === 'processing' || job.status === 'queued') {
        say(run, 'voice', 'working', job.step || label)
        await io.sleep(3000)
        continue
      }
      if (job.status === 'error') throw new Error(job.error || 'The narration failed.')
      run.mediaJobs.push(job)
      run.mediaJobId = ''
      run.mediaIdx++
    }
    if (run.mediaIdx < run.mediaChunks.length) return // keep going next step
    let ready = run.mediaJobs.length === 1 ? run.mediaJobs[0] : mergeMediaJobs(run.mediaJobs)
    const parts = voiceoverPlaylist(ready)
    if (parts.length > 1) ready = { ...ready, voiceover_url: parts[0], voiceover_urls: parts }
    run.media = ready
    run.mediaJobs = [] // merged into run.media; keep the record small
    say(run, 'voice', 'done', `Narration ready · ${Math.round(Number(ready.duration) || 0)}s`)
    run.stage = visualStyleById(st.visual.style) ? 'scenes_plan' : 'render'
  },

  async scenes_plan(run, io) {
    const vis = run.settings.visual
    const style = visualStyleById(vis.style)
    const scenes = planScenes({ text: scriptText(run.script), duration: Number(run.media?.duration) || 0, pace: vis.pace, mode: vis.mode })
    if (!style || !scenes.length) { run.stage = 'render'; return }
    say(run, 'agent', 'working', `Planning ${scenes.length} scenes in ${style.name}`)
    let prompts = {}
    try {
      const plan = await io.call('self', 'POST', '/api/youtube/scenes', { scenes: scenes.map((x) => ({ i: x.i, text: x.text })), topic: run.settings.topic || run.script?.title || '', style: style.name, character: vis.characterDesc || '' }, { timeoutMs: 120000 })
      prompts = Object.fromEntries((plan?.scenes || []).map((x) => [x.i, x.prompt]))
    } catch (_) {}
    const mode = visualModeById(vis.mode)
    run.videoModel = videoModelById(mode?.id === 'cinematic' ? 'kling-3-pro' : 'wan-2.7')?.id || 'wan-2.7'
    run.scenes = scenes.map((sc) => ({ i: sc.i, start: sc.start, end: sc.end, text: sc.text, animate: !!sc.animate, prompt: prompts[sc.i] || sc.text, image: '', clip: '', job: null, tries: 0 }))
    run.stage = 'scenes_draw'
  },

  /** Submit fal image jobs in batches and collect them; a step ends when the time budget runs out. */
  async scenes_draw(run, io) {
    const vis = run.settings.visual
    const style = visualStyleById(vis.style)
    const refs = vis.characterUrl ? [vis.characterUrl] : []
    const budget = io.now() + (io.budgetMs || 200000)
    while (io.now() < budget) {
      const pending = run.scenes.filter((s) => !s.image && s.tries < 3)
      if (!pending.length) break
      const inFlight = pending.filter((s) => s.job)
      for (const sc of pending.filter((s) => !s.job).slice(0, Math.max(0, IMAGE_BATCH - inFlight.length))) {
        try {
          const start = await io.call('self', 'POST', '/api/generate/image', {
            prompt: sceneImagePrompt({ scene: sc.prompt, style: style.id, character: vis.characterDesc, aspect: run.settings.aspect }),
            model: 'nano-banana', aspect_ratio: run.settings.aspect, quality: '1K', resolution: '1K', num_images: 1,
            ...(refs.length ? { image_urls: refs } : {}),
          }, { timeoutMs: 30000 })
          if (start?.urls?.[0]) sc.image = start.urls[0]
          else if (start?.statusUrl) sc.job = { statusUrl: start.statusUrl, responseUrl: start.responseUrl, at: io.now() }
          else sc.tries++
        } catch (e) {
          sc.tries++
          if (e?.status === 402) throw e // out of credits: stop the run with that message
        }
      }
      for (const sc of run.scenes.filter((s) => s.job && !s.image)) {
        try {
          const st = await io.call('self', 'POST', '/api/generate/image-status', sc.job, { timeoutMs: 20000 })
          if (st?.done && st.urls?.[0]) { sc.image = st.urls[0]; sc.job = null }
          else if (io.now() - sc.job.at > IMAGE_TIMEOUT_MS) { sc.job = null; sc.tries++ }
        } catch (_) { sc.job = null; sc.tries++ }
      }
      const drawn = run.scenes.filter((s) => s.image).length
      say(run, 'agent', 'working', `Drawing scene ${drawn} of ${run.scenes.length} (${style.name})`)
      if (run.scenes.some((s) => !s.image && s.tries < 3)) await io.sleep(2500)
    }
    if (run.scenes.some((s) => !s.image && s.tries < 3)) return
    // A scene whose image failed reuses the nearest good one, so the timeline has no holes.
    for (let k = 0; k < run.scenes.length; k++) if (!run.scenes[k].image) run.scenes[k].image = run.scenes[k - 1]?.image || run.scenes.find((s) => s.image)?.image || ''
    if (!run.scenes.some((s) => s.image)) throw new Error('No scene images came back.')
    run.scenes.forEach((s) => { s.tries = 0; s.job = null })
    run.stage = run.scenes.some((s) => s.animate) ? 'scenes_animate' : 'compose'
  },

  async scenes_animate(run, io) {
    const model = videoModelById(run.videoModel || 'wan-2.7')
    const todo = () => run.scenes.filter((s) => s.animate && !s.clip && s.tries < 2)
    const total = run.scenes.filter((s) => s.animate).length
    const budget = io.now() + (io.budgetMs || 200000)
    while (io.now() < budget && todo().length) {
      const inFlight = todo().filter((s) => s.job)
      for (const sc of todo().filter((s) => !s.job).slice(0, Math.max(0, VIDEO_BATCH - inFlight.length))) {
        try {
          const start = await io.call('self', 'POST', '/api/generate/image', {
            kind: 'video', model: model.id,
            prompt: sc.prompt + '. Gentle natural motion, keep the art style.',
            aspect: run.settings.aspect, duration: videoDurationFor(model, sc.end - sc.start), generate_audio: false,
            image_urls: [sc.image],
          }, { timeoutMs: 30000 })
          if (start?.urls?.[0]) sc.clip = start.urls[0]
          else if (start?.statusUrl) sc.job = { statusUrl: start.statusUrl, responseUrl: start.responseUrl, at: io.now() }
          else sc.tries++
        } catch (e) {
          sc.tries++
          if (e?.status === 402) { sc.tries = 9 } // no credits for motion: keep the still
        }
      }
      for (const sc of todo().filter((s) => s.job)) {
        try {
          const st = await io.call('self', 'POST', '/api/generate/image-status', sc.job, { timeoutMs: 20000 })
          if (st?.done && st.urls?.[0]) { sc.clip = st.urls[0]; sc.job = null }
          else if (io.now() - sc.job.at > VIDEO_TIMEOUT_MS) { sc.job = null; sc.tries++ }
        } catch (_) { sc.job = null; sc.tries++ }
      }
      say(run, 'agent', 'working', `Animating scene ${run.scenes.filter((s) => s.animate && (s.clip || s.tries >= 2)).length} of ${total}`)
      if (todo().length) await io.sleep(4000)
    }
    if (todo().length) return
    run.stage = 'compose'
  },

  /** Runs of stills become one clip each (fal ffmpeg compose); animated scenes are their own clips. */
  async compose(run, io) {
    say(run, 'agent', 'working', 'Joining the scenes')
    const timeline = []
    let block = []
    const styleName = visualStyleById(run.settings.visual.style)?.name || ''
    const flush = async () => {
      if (!block.length) return
      const out = await io.call('self', 'POST', '/api/youtube/compose', { segments: block.map((sc) => ({ url: sc.image, ms: Math.round((sc.end - sc.start) * 1000) })) }, { timeoutMs: 240000 })
      if (!out?.url) throw new Error('Joining the scenes failed.')
      timeline.push({ id: 'ai-' + timeline.length, url: out.url, preview: out.url, start: block[0].start, end: block[block.length - 1].end, clip_start: 0, provider: 'ai', query: styleName })
      block = []
    }
    for (const sc of run.scenes) {
      if (sc.clip) {
        await flush()
        timeline.push({ id: 'ai-' + timeline.length, url: sc.clip, preview: sc.clip, start: sc.start, end: sc.end, clip_start: 0, provider: 'ai', model: run.videoModel, query: styleName })
      } else if (sc.image) {
        block.push(sc)
        if (block.length >= 40) await flush()
      }
    }
    await flush()
    run.timeline = timeline
    run.media = { ...run.media, timeline, clips: timeline, broll_source: 'ai', scene_count: run.scenes.length }
    const anim = run.scenes.filter((s) => s.clip).length
    say(run, 'agent', 'done', `${run.scenes.length} scenes in ${styleName}${anim ? `, ${anim} animated` : ''}`)
    run.stage = 'render'
  },

  async render(run, io) {
    const st = run.settings
    const media = run.media || {}
    if (!run.renderJobId) {
      say(run, 'editor', 'working', 'Cutting the video together')
      let voiceoverUrl = voiceoverPlaylist(media)[0] || ''
      const parts = voiceoverPlaylist(media)
      if (!voiceoverUrl) throw new Error('The narration is missing.')
      if (parts.length > 1) {
        try {
          const merged = await io.call('gate', 'POST', '/api/media/concat', { urls: parts }, { timeoutMs: 120000 })
          voiceoverUrl = merged?.url || merged?.file?.url || merged?.public_url || voiceoverUrl
        } catch (_) {}
      }
      const { jobId } = await io.call('gate', 'POST', '/api/faceless/render', {
        voiceover_url: voiceoverUrl,
        voiceover_urls: parts.length > 1 ? parts : undefined,
        duration: media.duration,
        duration_id: st.durationId,
        duration_seconds: st.durationSeconds,
        words: media.words || [],
        timeline: media.timeline || [],
        aspect: media.aspect || st.aspect,
        caption: st.caption || undefined,
        music: st.music,
      })
      if (!jobId) throw new Error('The render did not start.')
      run.renderJobId = jobId
    }
    const budget = io.now() + (io.budgetMs || 200000)
    while (io.now() < budget) {
      const job = await io.call('upstream', 'GET', `/api/faceless/render/${run.renderJobId}`)
      run.renderProgress = Number(job.progress) || run.renderProgress
      if (job.status === 'queued' || job.status === 'processing') {
        say(run, 'editor', 'working', `${job.step || 'Rendering'}${run.renderProgress ? ` · ${Math.round(run.renderProgress)}%` : ''}`)
        await io.sleep(4000)
        continue
      }
      if (job.status === 'error') throw new Error(job.error || 'The render failed.')
      say(run, 'editor', 'working', 'Render finished, saving it to My Files')
      run.stage = 'save'
      return
    }
  },

  /** Copy the MP4 into My Files so it has a lasting link (the render download needs auth). */
  async save(run, io) {
    const title = run.script?.title || run.settings.topic || 'video'
    const url = await io.saveRender(run.renderJobId, title)
    run.videoUrl = url || ''
    run.status = 'done'
    run.stage = 'done'
    run.finishedAt = io.now()
    say(run, 'editor', 'done', url ? 'Your video is ready' : 'Rendered; open My Files for the MP4')
  },
}

/** Do one bounded step. Never throws: failures land in run.status = 'error'. */
export async function advanceRun(run, io) {
  if (!run || run.status !== 'running') return run
  const fn = STAGES[run.stage]
  if (!fn) { fail(run, 'manager', 'Unknown step: ' + run.stage); return run }
  try {
    await fn(run, io)
  } catch (e) {
    const agent = AGENT_OF[run.stage] || 'manager'
    if (e?.status === 401) fail(run, agent, 'Your sign-in expired. Open TubeOps and the team will pick up from here.')
    else fail(run, agent, e?.message || String(e))
  }
  run.steps++
  run.updated = io.now()
  return run
}

/** What the Agents chat needs to draw progress, without the heavy fields. */
export function publicRun(run) {
  if (!run) return null
  const drawn = run.scenes ? run.scenes.filter((s) => s.image).length : 0
  return {
    id: run.id,
    stage: run.stage,
    status: run.status,
    error: run.error,
    channel: run.settings?.channel || '',
    topic: run.settings?.topic || '',
    durationId: run.settings?.durationId || '',
    aspect: run.settings?.aspect || '16:9',
    crew: run.crew,
    log: run.log,
    script: run.script ? {
      title: run.script.title || '',
      options: Array.isArray(run.script.title_options) ? run.script.title_options : [],
      words: scriptWordCount(run.script) || 0,
      hook: run.hookScore?.verdict || '',
      sections: (run.script.sections || []).map((x) => ({ heading: x.heading || '', text: x.text || '' })),
    } : null,
    media: run.media ? { duration: Number(run.media.duration) || 0, voiceover: voiceoverPlaylist(run.media)[0] || '' } : null,
    scenes: run.scenes ? { total: run.scenes.length, drawn, animTotal: run.scenes.filter((s) => s.animate).length, animated: run.scenes.filter((s) => s.clip).length, images: run.scenes.map((s) => s.image).filter(Boolean).slice(-24) } : null,
    renderProgress: run.renderProgress,
    videoUrl: run.videoUrl,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    updated: run.updated,
  }
}
