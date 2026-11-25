/**
 * Studio: the manual side of TubeOps. Every step the agents do, laid out in
 * order, each showing where the current video stands and opening the tool to
 * do that step by hand (or handing it back to the agent).
 *
 * The step list and status text are pure (tested); initStudioHub renders into
 * the Studio panel and talks to the dashboard through window bridges.
 */

import { AGENTS, agentSvg } from './agents-chat.js'
import { VISUAL_STYLES, VISUAL_MODES, SCENE_PACES, styleSample, visualStyleById } from './visual-styles.js'
import { progressFrom, videoPlan, makeTimeLabel, durationSeconds } from './studio-flow.js'

const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]))

export const MANUAL_STEPS = [
  { id: 'script', agent: 'script', name: 'Script', does: 'Describe the video or paste your own script, then read it section by section.', tool: 'Script' },
  { id: 'title', agent: 'title', name: 'Title', does: 'Pick one of five title options or write your own.', tool: 'Title options' },
  { id: 'voice', agent: 'voice', name: 'Voiceover', does: 'Pick the narrator and listen to the narration.', tool: 'Voice' },
  { id: 'scenes', agent: 'agent', name: 'Scenes', does: 'Pick the art style, then redraw or animate any scene on the timeline.', tool: 'Scene editor' },
  { id: 'thumbnail', agent: 'thumbnail', name: 'Thumbnail', does: 'Design the thumbnail yourself, from a prompt or your own image.', tool: 'Thumbnail Generator' },
  { id: 'edit', agent: 'editor', name: 'Captions, music and render', does: 'Set the caption style and music in the editor, then render the MP4.', tool: 'Scene editor' },
  { id: 'publish', agent: 'publish', name: 'Publish', does: 'Edit the description, tags and chapters, then upload to YouTube.', tool: 'My YouTube Channel' },
]

export const MORE_TOOLS = [
  { panel: 'editor', name: 'Video Editor', note: 'Multi-track editing for any clip' },
  { panel: 'voiceover', name: 'AI Voiceover', note: 'Record narration from any text' },
  { panel: 'captions', name: 'AI Captions', note: 'Burn captions into a video' },
  { panel: 'reframe', name: 'AI Reframe', note: 'Turn 16:9 into 9:16' },
  { panel: 'clipper', name: 'Clipping', note: 'Cut highlights from long videos' },
  { panel: 'ranking', name: 'Ranking', note: 'Find the moments worth clipping' },
  { panel: 'downloader', name: 'Video Downloader', note: 'Save a video from a link' },
  { panel: 'commentary', name: 'Video Commentary', note: 'Add a voice over someone\'s clip' },
  { panel: 'files', name: 'My Files', note: 'Everything you have made' },
]

export const LENGTHS = [['long_180', '3 min'], ['long_300', '5 min'], ['long_600', '10 min'], ['long_900', '15 min'], ['long_1800', '30 min']]

function clock(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/**
 * Where a step stands for the current video: { state: 'done'|'working'|'stuck'|'todo', text }.
 * `st` is window.fvAgentsState(), `proj` is window.fvSceneProject().
 */
export function stepStatus(step, st, proj) {
  const crew = st?.crew?.[step.agent] || {}
  if (crew.state === 'working') return { state: 'working', text: crew.text || `${BY_ID[step.agent]?.name || 'The agent'} is on it` }
  if (crew.state === 'stuck' || crew.state === 'error') return { state: 'stuck', text: crew.text || 'Stopped' }
  const s = st?.script
  switch (step.id) {
    case 'script':
      return s ? { state: 'done', text: `${Number(s.words || 0).toLocaleString('en-US')} words${s.title ? ` · “${s.title}”` : ''}` } : { state: 'todo', text: 'Not started' }
    case 'title':
      return s?.options?.length ? { state: 'done', text: `Using “${s.title}” · ${s.options.length} options` } : { state: 'todo', text: s ? 'No options yet' : 'Needs a script' }
    case 'voice':
      return st?.media?.voiceover ? { state: 'done', text: `Recorded · ${clock(st.media.duration)}` } : { state: 'todo', text: s ? 'Not recorded' : 'Needs a script' }
    case 'scenes':
      if (proj?.scenes?.length) return { state: 'done', text: `${proj.scenes.length} scenes in ${proj.styleName || 'your style'} · ${proj.scenes.filter((x) => x.clip).length} animated` }
      if (st?.media?.clips) return { state: 'done', text: `${st.media.clips} clips placed` }
      return { state: 'todo', text: st?.media ? 'No scenes yet' : 'Needs the narration' }
    case 'thumbnail':
      return st?.thumb?.url ? { state: 'done', text: st.thumb.style ? `Designed · ${st.thumb.style}` : 'Designed' } : { state: 'todo', text: 'Not designed' }
    case 'edit':
      if (st?.renderUrl) return { state: 'done', text: 'Rendered' }
      return { state: 'todo', text: st?.hasMedia ? 'Ready to render' : 'Needs the narration and scenes' }
    case 'publish':
      if (st?.publish?.description) return { state: 'done', text: `Description and ${(st.publish.tags || []).length} tags ready` }
      return { state: 'todo', text: st?.renderUrl ? 'Ready to publish' : 'After the render' }
    default:
      return { state: 'todo', text: '' }
  }
}

const CSS = `
.cf{--cf-ink:#f2f2f1;--cf-mute:rgba(242,242,241,.56);--cf-line:rgba(255,255,255,.08);--cf-card:#161617;--cf-card2:#1d1d1e;--cf-acc:#ff3040;max-width:1320px;margin:0 auto;padding:4px 4px 48px;color:var(--cf-ink);font-family:Inter,system-ui,-apple-system,sans-serif}
.cf-steps{display:flex;align-items:center;gap:10px;margin:2px 0 26px;font-size:.84rem;color:var(--cf-mute)}
.cf-step{display:inline-flex;align-items:center;gap:8px;border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0}
.cf-step i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:.72rem;font-weight:700;background:#262627;color:var(--cf-mute)}
.cf-step.is-on{color:var(--cf-ink)}.cf-step.is-on i{background:var(--cf-acc);color:#fff}
.cf-step.is-done i{background:#22b864;color:#fff}
.cf-sep{width:28px;height:1px;background:var(--cf-line)}
.cf-kicker{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--cf-acc);font-weight:600;margin:0 0 8px}
.cf-h1{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(2rem,3.6vw,3rem);letter-spacing:-.015em;line-height:1.05}
.cf-h1 em{font-style:normal;color:var(--cf-acc)}
.cf-lead{margin:10px 0 24px;color:var(--cf-mute);font-size:.98rem;max-width:640px;line-height:1.5}
.cf-cols{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:22px;align-items:start}
.cf-card{background:var(--cf-card);border:1px solid var(--cf-line);border-radius:20px;padding:18px}
.cf-label{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px;font-size:.78rem;color:var(--cf-mute)}
.cf-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:#202021;margin-bottom:14px}
.cf-tab{height:34px;padding:0 16px;border-radius:999px;border:0;background:none;color:var(--cf-mute);font:inherit;font-size:.86rem;cursor:pointer}
.cf-tab.is-on{background:#fff;color:#141414;font-weight:600}
.cf-text,.cf-input{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--cf-line);background:#101011;color:var(--cf-ink);font:inherit;font-size:.95rem;line-height:1.6;padding:14px 16px}
.cf-text{resize:vertical;min-height:300px}
.cf-text:focus,.cf-input:focus{outline:none;border-color:rgba(255,255,255,.32)}
.cf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--cf-line);background:#232324;color:var(--cf-ink);font:inherit;font-size:.92rem;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.cf-btn:hover{background:#2c2c2d}
.cf-btn.is-primary{background:var(--cf-acc);border-color:var(--cf-acc);color:#fff;font-weight:600}
.cf-btn.is-primary:hover{filter:brightness(1.08)}
.cf-btn[disabled]{opacity:.45;cursor:default;filter:none}
.cf-btn:focus-visible,.cf-tab:focus-visible,.cf-brand:focus-visible,.cf-opt:focus-visible,.cf-chip:focus-visible{outline:2px solid #fff;outline-offset:2px}
.cf-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px}
.cf-hint{font-size:.82rem;color:var(--cf-mute)}
.cf-err{margin-top:12px;padding:10px 14px;border-radius:12px;background:rgba(245,165,36,.12);color:#fbbf24;font-size:.88rem}
.cf-chips{display:flex;flex-wrap:wrap;gap:6px}
.cf-chip{height:32px;padding:0 13px;border-radius:999px;border:1px solid var(--cf-line);background:#1f1f20;color:var(--cf-ink);font:inherit;font-size:.82rem;cursor:pointer}
.cf-chip.is-on{background:#fff;color:#141414;border-color:#fff;font-weight:600}
.cf-brands{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.cf-brand{display:flex;flex-direction:column;border-radius:18px;border:1px solid var(--cf-line);background:var(--cf-card);overflow:hidden;color:var(--cf-ink);font:inherit;text-align:left;cursor:pointer;padding:0}
.cf-brand:hover{border-color:rgba(255,255,255,.22)}
.cf-brand.is-on{border-color:var(--cf-acc);box-shadow:0 0 0 1px var(--cf-acc)}
.cf-brand img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#0c0c0c}
.cf-brand-b{padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px}
.cf-brand-b b{font-size:1rem}
.cf-tags{display:flex;flex-wrap:wrap;gap:6px}
.cf-tags span{font-size:.74rem;padding:3px 9px;border-radius:999px;background:#242425;color:var(--cf-mute)}
.cf-new{display:flex;align-items:center;justify-content:center;gap:8px;min-height:200px;border-radius:18px;border:1px dashed rgba(255,255,255,.18);background:none;color:var(--cf-mute);font:inherit;cursor:pointer}
.cf-new:hover{color:var(--cf-ink);border-color:rgba(255,255,255,.35)}
.cf-side .cf-brand{cursor:default}
.cf-voice{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px 12px;border-radius:14px;background:#202021}
.cf-play{flex:0 0 32px;width:32px;height:32px;border-radius:50%;border:0;background:var(--cf-acc);color:#fff;display:grid;place-items:center;cursor:pointer}
.cf-voice span{font-size:.86rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cf-set{display:grid;grid-template-columns:330px minmax(0,1fr);gap:22px;align-items:start}
.cf-opt{display:flex;flex-direction:column;gap:2px;width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--cf-line);background:#1b1b1c;color:var(--cf-ink);font:inherit;text-align:left;cursor:pointer;margin-bottom:8px}
.cf-opt b{font-size:.9rem}.cf-opt span{font-size:.78rem;color:var(--cf-mute)}
.cf-opt.is-on{border-color:var(--cf-acc);background:rgba(255,48,64,.08)}
.cf-sub{margin:18px 0 8px;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--cf-mute)}
.cf-dir{max-height:420px;overflow:auto;font-size:.92rem;line-height:1.65;color:#dcdcda;padding-right:6px}
.cf-dir b{display:block;color:var(--cf-ink);margin:12px 0 2px;font-size:.86rem}
.cf-shape{display:flex;gap:4px;margin-top:10px;overflow:hidden}
.cf-shape i{flex:1;height:30px;border-radius:5px;background:#26262a}
.cf-shape i.is-anim{background:rgba(255,48,64,.45)}
.cf-stats{display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-size:.84rem;color:var(--cf-mute)}
.cf-stats b{color:var(--cf-ink)}
.cf-run{display:grid;grid-template-columns:330px minmax(0,1fr);gap:22px;align-items:start}
.cf-pct{display:flex;align-items:baseline;justify-content:space-between}
.cf-pct b{font-size:2rem;font-weight:700}
.cf-bar{height:6px;border-radius:6px;background:#26262a;margin:10px 0 14px;overflow:hidden}
.cf-bar i{display:block;height:100%;background:var(--cf-acc);border-radius:inherit;transition:width .6s}
.cf-pipe{display:flex;flex-direction:column;gap:2px}
.cf-p{display:flex;gap:11px;align-items:flex-start;padding:9px 8px;border-radius:12px}
.cf-p.is-now{background:#212122}
.cf-p .ag-blob{width:28px;height:28px;flex:0 0 28px}
.cf-p[data-state=idle] .ag-blob{opacity:.3;filter:grayscale(1)}
.cf-p[data-state=working] .ag-blob{animation:agHop 1s ease-in-out infinite}
.cf-p-t{display:flex;flex-direction:column;min-width:0;flex:1}
.cf-p-t b{font-size:.9rem}.cf-p-t span{font-size:.76rem;color:var(--cf-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cf-p em{font-style:normal;font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;align-self:center}
.cf-p em.ok{color:#4ade80}.cf-p em.turn{background:var(--cf-acc);color:#fff}.cf-p em.stuck{color:#fbbf24}
.cf-live{border-radius:18px;background:repeating-linear-gradient(135deg,#151516 0 14px,#19191a 14px 28px);border:1px solid var(--cf-line);min-height:360px;padding:16px;display:flex;flex-direction:column;gap:12px}
.cf-live-tag{align-self:flex-start;font-size:.72rem;font-weight:700;letter-spacing:.08em;padding:4px 10px;border-radius:999px;background:#0e0e0f;color:#fff}
.cf-live-tag i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--cf-acc);margin-right:6px;animation:cfPulse 1.2s infinite}
.cf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.cf-grid img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;background:#111}
.cf-media{width:100%;border-radius:14px;background:#000;display:block}
.cf-turn{padding:16px;border-radius:16px;border:1px solid var(--cf-acc);background:rgba(255,48,64,.07)}
.cf-turn b{display:block;font-size:1.02rem;margin-bottom:4px}
.cf-using{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:.8rem;color:var(--cf-mute);margin:6px 0 16px}
.cf-using span{padding:4px 10px;border-radius:999px;background:#202021;color:var(--cf-ink)}
.cf-more{margin-top:40px}
.cf-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.cf-tool{display:flex;flex-direction:column;gap:3px;padding:14px;border-radius:16px;background:var(--cf-card);border:1px solid var(--cf-line);color:var(--cf-ink);font:inherit;text-align:left;cursor:pointer}
.cf-tool b{font-size:.9rem}.cf-tool span{font-size:.78rem;color:var(--cf-mute)}
@keyframes cfPulse{50%{opacity:.3}}
@media (max-width:980px){.cf-cols,.cf-set,.cf-run{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){.cf-p .ag-blob,.cf-live-tag i{animation:none!important}}
`

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const call = (name, ...args) => { try { return window[name]?.(...args) } catch (e) { return e?.message || 'Something went wrong.' } }
/** Lengths this user's plan allows (falls back to the full list before the app is ready). */
const lengthChoices = () => { try { const c = window.fvDurationChoices?.(); return Array.isArray(c) && c.length ? c : LENGTHS } catch (_) { return LENGTHS } }
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length

/** The live pipeline, in channel.farm's order, built from the crew state. */
export function pipeline(st, proj) {
  const crew = st?.crew || {}
  const pr = progressFrom(crew, { delivered: !!st?.renderUrl })
  const by = Object.fromEntries(pr.steps.map((x) => [x.agent, x]))
  const mediaDone = !!(st?.media?.voiceover || st?.hasMedia)
  const scenesDone = !!(proj?.scenes?.length || st?.media?.clips)
  const rendering = by.editor?.state === 'working'
  const turn = mediaDone && scenesDone && !st?.renderUrl && !rendering && by.editor?.state !== 'stuck'
  const rows = [
    { id: 'script', agent: 'script', name: 'Script', state: by.script.state === 'idle' && st?.script ? 'done' : by.script.state, text: st?.script ? `${Number(st.script.words || 0).toLocaleString('en-US')} words` : by.script.text || 'Waiting' },
    { id: 'voice', agent: 'voice', name: 'Voiceover', state: mediaDone ? 'done' : by.voice.state, text: by.voice.text || (mediaDone ? 'Narration recorded' : 'Reads the script aloud') },
    { id: 'visuals', agent: 'agent', name: 'Visuals', state: scenesDone ? 'done' : by.agent.state, text: by.agent.text || (st?.scenes ? `${st.scenes.drawn || 0} of ${st.scenes.total || '?'} scenes drawn` : 'One scene for every line') },
    { id: 'thumbnail', agent: 'thumbnail', name: 'Thumbnail', state: st?.thumb?.url ? 'done' : by.thumbnail.state, text: by.thumbnail.text || (st?.thumb?.url ? 'Designed' : 'Designs the click') },
    { id: 'editor', agent: 'editor', name: 'Timeline editor', state: turn ? 'turn' : rendering || st?.renderUrl ? 'done' : 'idle', text: turn ? 'Check the scenes, then render' : 'Your review before the cut' },
    { id: 'render', agent: 'editor', name: 'Assembly + audio', state: st?.renderUrl ? 'done' : rendering ? 'working' : by.editor.state === 'stuck' ? 'stuck' : 'idle', text: rendering ? by.editor.text || 'Rendering' : st?.renderUrl ? 'Your MP4 is ready' : 'Captions, music, the MP4' },
    { id: 'publish', agent: 'publish', name: 'Description', state: st?.publish?.description ? 'done' : by.publish.state, text: st?.publish?.description ? 'Description and tags ready' : 'Title, tags and chapters' },
  ]
  const done = rows.filter((r) => r.state === 'done').length
  return { rows, percent: st?.renderUrl ? 100 : Math.round(((done + rows.filter((r) => r.state === 'working').length * 0.4) / rows.length) * 100), turn }
}

export function initStudioHub({ root } = {}) {
  if (!root) return null
  if (!document.getElementById('sh-style')) {
    const el = document.createElement('style')
    el.id = 'sh-style'
    el.textContent = CSS
    document.head.appendChild(el)
  }
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  const project = () => { try { return window.fvSceneProject?.() || null } catch (_) { return null } }
  const profiles = () => { try { return window.agentsChat?.profiles?.list() || [] } catch (_) { return [] } }
  const activeId = () => { try { return window.agentsChat?.profiles?.activeId() || '' } catch (_) { return '' } }

  let view = ''          // '' = decide from the video's state | 'brand' | 'script' | 'settings' | 'run'
  let mode = 'write'     // script: 'write' | 'paste'
  let topic = ''
  let paste = ''
  let secDraft = {}
  const err = {}
  let audio = null
  let playing = ''
  let started = false
  let showStyles = false
  let styleGroup = ''

  function viewNow(st) {
    if (view) return view
    if (st?.renderUrl || st?.running || st?.media?.voiceover || started) return 'run'
    if (st?.script) return 'settings'
    return profiles().length > 1 && !activeId() ? 'brand' : 'script'
  }
  const go = (v) => { view = v; render(); try { root.scrollIntoView({ block: 'start' }) } catch (_) {} }
  const stepper = (v) => {
    const order = [['brand', 'Brand'], ['script', 'Script'], ['settings', 'Video settings'], ['run', 'Make it']]
    const at = order.findIndex(([k]) => k === v)
    return `<nav class="cf-steps" aria-label="Steps">${order.map(([k, l], i) => `${i ? '<span class="cf-sep"></span>' : ''}<button type="button" class="cf-step${k === v ? ' is-on' : i < at ? ' is-done' : ''}" data-cf-go="${k}"><i>${i < at ? '✓' : i + 1}</i>${l}</button>`).join('')}</nav>`
  }
  const errHtml = (k) => (err[k] ? `<div class="cf-err">${esc(err[k] === 'SIGN_IN' ? 'Sign in to make a video.' : err[k])}</div>` : '')

  function brandCard(p, st, { pick = false } = {}) {
    const style = visualStyleById(p?.visualStyle) || visualStyleById(st?.visual?.style) || VISUAL_STYLES[0]
    const voice = (st?.voices || []).find((v) => v.id === (p?.voiceId || st?.voiceId))
    const tag = pick ? 'button type="button"' : 'div'
    const close = pick ? 'button' : 'div'
    return `<${tag} class="cf-brand${pick && p?.id === activeId() ? ' is-on' : ''}"${pick ? ` data-cf-brand="${esc(p.id)}"` : ''}><img src="${esc(styleSample(style.id))}" alt="" loading="lazy"><span class="cf-brand-b"><b>${esc(p?.name || 'This video')}</b><span class="cf-tags"><span>${esc(style.name)}</span>${voice ? `<span>${esc(voice.name)}</span>` : ''}<span>${esc(p?.aspect || st?.aspect || '16:9')}</span></span></span></${close}>`
  }

  function brandView(st) {
    const list = profiles()
    return `<p class="cf-kicker">New video · pick a brand</p><h1 class="cf-h1">Which <em>brand</em> is this video for?</h1>
      <p class="cf-lead">The brand sets the channel, voice, visual style and captions. Everything else comes next.</p>
      <div class="cf-brands">${list.map((p) => brandCard(p, st, { pick: true })).join('')}<button type="button" class="cf-new" data-cf-newbrand>+ Create a new brand profile</button></div>
      ${list.length ? '' : '<p class="cf-hint" style="margin-top:14px">No brand yet. You can skip this and use the default look.</p>'}
      <div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-go="script">Continue to the script →</button></div>`
  }

  function scriptView(st) {
    const sc = st?.script
    const working = st?.busyScript || st?.crew?.script?.state === 'working'
    const p = profiles().find((x) => x.id === activeId())
    const voice = (st?.voices || []).find((v) => v.id === st?.voiceId)
    let main
    if (working) {
      main = `<div class="cf-card"><div class="cf-label"><span>Writing your script</span></div><div class="cf-hint">${esc(st?.crew?.script?.text || 'The Script agent is writing it now…')}</div></div>`
    } else if (sc) {
      const total = sc.sections.reduce((n, x, i) => n + words(secDraft[i] ?? x.text), 0)
      main = `<div class="cf-card"><div class="cf-label"><span>Your script · edit anything</span><span>${total.toLocaleString('en-US')} words · ~${Math.max(1, Math.round(total / 150))} min</span></div>
        ${sc.sections.map((x, i) => `<div class="cf-label" style="margin-top:12px"><span>${esc(x.heading || 'Part ' + (i + 1))}</span></div><textarea class="cf-text" style="min-height:120px" rows="5" data-cf-sec="${i}">${esc(secDraft[i] ?? x.text)}</textarea>`).join('')}
        ${errHtml('script')}
        <div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-go="settings">Continue to video settings →</button><button type="button" class="cf-btn" data-cf-fresh>Start over</button></div></div>`
    } else {
      main = `<div class="cf-card"><div class="cf-tabs" role="tablist"><button type="button" class="cf-tab${mode === 'write' ? ' is-on' : ''}" data-cf-mode="write">Write with AI</button><button type="button" class="cf-tab${mode === 'paste' ? ' is-on' : ''}" data-cf-mode="paste">Paste script</button></div>
        ${mode === 'write'
          ? `<div class="cf-label"><span>What's the video about?</span></div><textarea class="cf-text" id="cf-topic" style="min-height:140px" placeholder="The rise and fall of Blockbuster">${esc(topic)}</textarea>
            <div class="cf-label" style="margin-top:14px"><span>Length</span></div><div class="cf-chips">${lengthChoices().map(([id, l]) => `<button type="button" class="cf-chip${st?.durationId === id ? ' is-on' : ''}" data-cf-len="${id}">${l}</button>`).join('')}</div>
            ${errHtml('script')}<div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-write>Write the script</button><span class="cf-hint">You can edit every line after.</span></div>`
          : `<div class="cf-label"><span>Paste your script</span><span>${words(paste).toLocaleString('en-US')} words · ~${Math.max(1, Math.round(words(paste) / 150))} min</span></div><textarea class="cf-text" id="cf-paste" placeholder="Paste your narration. Blank lines split it into parts.">${esc(paste)}</textarea>
            ${errHtml('script')}<div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-paste>Continue to video settings →</button><span class="cf-hint">Length, scenes and time are worked out from the script.</span></div>`}
      </div>`
    }
    return `<p class="cf-kicker">New video</p><h1 class="cf-h1">Start with the <em>script</em></h1>
      <p class="cf-lead">Length, scene count and cost are all worked out from the script, so it comes first.</p>
      <div class="cf-cols"><div>${main}</div>
        <aside class="cf-side"><div class="cf-label"><span>Brand</span><button type="button" class="cf-chip" data-cf-go="brand">Change</button></div>${brandCard(p, st)}
          ${voice ? `<div class="cf-voice">${voice.preview ? `<button type="button" class="cf-play" data-cf-play="${esc(voice.preview)}" aria-label="Play ${esc(voice.name)}">${playing === voice.preview ? '■' : '▶'}</button>` : ''}<span><b>${esc(voice.name)}</b> · narrator</span></div>` : ''}</aside></div>`
  }

  function settingsView(st, proj) {
    const sc = st?.script
    if (!sc) return `<h1 class="cf-h1">Your <em>video</em></h1><p class="cf-lead">Write or paste the script first.</p><div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-go="script">Go to the script</button></div>`
    const v = st?.visual || {}
    const secs = Math.round((Number(sc.words || 0) / 150) * 60) || durationSeconds(st?.durationId)
    const plan = (() => { try { return videoPlan({ seconds: secs, pace: v.pace || 'normal', mode: v.mode || 'cheapest', text: sc.sections.map((x) => x.text).join(' ') }) } catch (_) { return null } })()
    const style = visualStyleById(v.style) || VISUAL_STYLES[0]
    const looks = call('fvCaptionLooks') || []
    // Title options come back as { title, ... } objects; show their text.
    const opts = [...new Set([sc.title, ...(sc.options || []).map((o) => (typeof o === 'string' ? o : o?.title || ''))].map((t) => String(t || '').trim()).filter(Boolean))]
    return `<p class="cf-kicker">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${Number(sc.words || 0).toLocaleString('en-US')} words</p><h1 class="cf-h1">Your <em>video</em></h1>
      <p class="cf-lead">Pick how it looks and moves. Nothing is made until you press Generate.</p>
      <div class="cf-set">
        <aside class="cf-card">
          <div class="cf-sub" style="margin-top:0">Video settings</div>
          ${VISUAL_MODES.map((m) => `<button type="button" class="cf-opt${(v.mode || 'cheapest') === m.id ? ' is-on' : ''}" data-cf-vmode="${esc(m.id)}"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></button>`).join('')}
          <div class="cf-sub">Scene pacing</div><div class="cf-chips">${SCENE_PACES.map((p) => `<button type="button" class="cf-chip${(v.pace || 'normal') === p.id ? ' is-on' : ''}" data-cf-pace="${esc(p.id)}">${esc(p.name)} · ${p.seconds}s</button>`).join('')}</div>
          <div class="cf-sub">Visual style</div>
          <div style="display:flex;gap:10px;align-items:center"><img src="${esc(styleSample(style.id))}" alt="" style="width:110px;aspect-ratio:16/9;object-fit:cover;border-radius:10px"><div><b style="font-size:.9rem">${esc(style.name)}</b><div class="cf-hint">${esc(style.group)}</div></div></div>
          <div class="cf-row" style="margin-top:8px"><button type="button" class="cf-chip" data-cf-styles>Change style</button></div>
          <div class="cf-sub">Captions</div><div class="cf-chips">${(Array.isArray(looks) ? looks : []).slice(0, 8).map((l) => `<button type="button" class="cf-chip${st?.captionLook === l.id ? ' is-on' : ''}" data-cf-cap="${esc(l.id)}">${esc(l.name)}</button>`).join('')}</div>
          <div class="cf-sub">Frame</div><div class="cf-chips">${['16:9', '9:16'].map((a) => `<button type="button" class="cf-chip${(st?.aspect || '16:9') === a ? ' is-on' : ''}" data-cf-aspect="${a}">${a === '16:9' ? '16:9 YouTube' : '9:16 Shorts'}</button>`).join('')}</div>
        </aside>
        <div>
          ${showStyles ? `<div class="cf-card" style="margin-bottom:14px"><div class="cf-label"><span>Visual style · ${VISUAL_STYLES.length} looks</span><button type="button" class="cf-chip" data-cf-styles>Done</button></div>
            <div class="cf-chips" style="margin-bottom:10px"><button type="button" class="cf-chip${styleGroup ? '' : ' is-on'}" data-cf-sgroup="">All</button>${[...new Set(VISUAL_STYLES.map((x) => x.group))].map((g) => `<button type="button" class="cf-chip${styleGroup === g ? ' is-on' : ''}" data-cf-sgroup="${esc(g)}">${esc(g)}</button>`).join('')}</div>
            <div class="cf-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));max-height:420px;overflow:auto">${VISUAL_STYLES.filter((x) => !styleGroup || x.group === styleGroup).map((x) => `<button type="button" class="cf-opt${x.id === style.id ? ' is-on' : ''}" style="padding:6px;margin:0" data-cf-style="${esc(x.id)}"><img src="${esc(styleSample(x.id))}" alt="" loading="lazy" style="border-radius:8px"><b style="font-size:.78rem;margin-top:4px">${esc(x.name)}</b></button>`).join('')}</div></div>` : ''}
          <div class="cf-card"><div class="cf-label"><span>Title</span></div><div class="cf-chips">${opts.map((t) => `<button type="button" class="cf-chip${t === sc.title ? ' is-on' : ''}" data-cf-title="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
          <div class="cf-card" style="margin-top:14px"><div class="cf-label"><span>Visual direction</span><button type="button" class="cf-chip" data-cf-go="script">Edit script</button></div>
            <div class="cf-dir">${sc.sections.map((x, i) => `<b>${esc(x.heading || 'Part ' + (i + 1))}</b>${esc(x.text)}`).join('')}</div></div>
          <div class="cf-card" style="margin-top:14px"><div class="cf-label"><span>Likely shape</span></div>
            ${plan ? `<div class="cf-shape" aria-hidden="true">${plan.scenes.slice(0, 60).map((x) => `<i class="${x.animate ? 'is-anim' : ''}"></i>`).join('')}</div>
            <div class="cf-stats"><span><b>${plan.count}</b> scenes</span><span><b>${plan.animated}</b> animated</span><span>about <b>${esc(makeTimeLabel(plan.minutes).replace('about ', ''))}</b> to make</span></div>` : '<div class="cf-hint">Worked out once the script is in.</div>'}
          </div>
          ${errHtml('generate')}
          <div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-generate>Generate video</button><span class="cf-hint">Narration and scenes first; you review the timeline before the final cut.</span></div>
        </div>
      </div>`
  }

  function runView(st, proj) {
    const pl = pipeline(st, proj)
    const now = pl.rows.find((r) => r.state === 'working' || r.state === 'turn' || r.state === 'stuck') || pl.rows.find((r) => r.state !== 'done') || pl.rows[pl.rows.length - 1]
    const mins = st?.startedAt ? Math.max(0, Math.round((Date.now() - st.startedAt) / 60000)) : 0
    const style = visualStyleById(st?.visual?.style)
    const voice = (st?.voices || []).find((v) => v.id === st?.voiceId)
    const p = profiles().find((x) => x.id === activeId())
    let live = ''
    if (st?.renderUrl) {
      live = `<video class="cf-media" controls playsinline preload="metadata" src="${esc(st.renderUrl)}"></video>
        <div class="cf-row" style="margin-top:0"><a class="cf-btn is-primary" href="${esc(st.renderUrl)}" download target="_blank" rel="noopener">Download video</a><button type="button" class="cf-btn" data-cf-editor="captions">Edit this video</button><button type="button" class="cf-btn" data-cf-upload>${st?.youtubeConnected === false ? 'Connect YouTube to upload' : 'Upload to YouTube'}</button>${st?.publish?.description ? '' : '<button type="button" class="cf-btn" data-cf-publish>Write description</button>'}</div>${err.upload ? `<div class="cf-hint" style="margin-top:8px">${esc(err.upload)}</div>` : ''}`
    } else if (st?.crew?.editor?.state === 'stuck' && (st?.media?.voiceover || st?.hasMedia)) {
      live = `<div class="cf-turn"><b>The render stopped</b><span class="cf-hint">${esc(st.crew.editor.text || 'Something went wrong while rendering.')}</span>
        <div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-retry>Try again</button><button type="button" class="cf-btn" data-cf-editor="scenes">Open the timeline editor</button></div>${errHtml('render')}</div>`
    } else if (pl.turn) {
      live = `<div class="cf-turn"><b>Your turn: check the timeline</b><span class="cf-hint">Redraw or animate any scene, change music or captions, then render the final cut.</span>
        <div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-render>Render the video</button><button type="button" class="cf-btn" data-cf-editor="scenes">Open the timeline editor</button></div>${errHtml('render')}</div>`
      if (proj?.scenes?.length) live += `<div class="cf-grid">${proj.scenes.slice(0, 24).map((x) => `<img src="${esc(x.image)}" alt="" loading="lazy">`).join('')}</div>`
      if (st?.media?.voiceover) live += `<audio class="cf-media" controls preload="none" src="${esc(st.media.voiceover)}"></audio>`
    } else {
      const imgs = st?.scenes?.images || []
      live = `<span class="cf-live-tag"><i></i>LIVE · ${esc(now.name)}</span><div class="cf-hint">${esc(now.text)}</div>
        ${imgs.length ? `<div class="cf-grid">${imgs.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}
        ${st?.media?.voiceover ? `<audio class="cf-media" controls preload="none" src="${esc(st.media.voiceover)}"></audio>` : ''}${errHtml('generate')}`
    }
    return `<div class="cf-run">
      <aside class="cf-card">
        <div class="cf-pct"><b>${pl.percent}%</b><span class="cf-hint">${st?.renderUrl ? 'Done' : mins ? '~' + mins + ' min so far' : 'Starting'}</span></div>
        <div class="cf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pl.percent}" aria-label="Video progress"><i style="width:${pl.percent}%"></i></div>
        <div class="cf-sub" style="margin-top:0">Pipeline</div>
        <div class="cf-pipe">${pl.rows.map((r) => `<div class="cf-p${r === now ? ' is-now' : ''}" data-state="${esc(r.state)}">${agentSvg(r.agent)}<span class="cf-p-t"><b>${esc(r.name)}</b><span>${esc(r.text)}</span></span>${r.state === 'done' ? '<em class="ok">✓</em>' : r.state === 'turn' ? '<em class="turn">Your turn</em>' : r.state === 'stuck' ? '<em class="stuck">Needs you</em>' : ''}</div>`).join('')}</div>
        <div class="cf-row"><button type="button" class="cf-btn" data-cf-new>New video</button></div>
      </aside>
      <section>
        <p class="cf-kicker">${esc(now.name)}</p><h1 class="cf-h1" style="font-size:clamp(1.6rem,2.6vw,2.2rem)">${esc(st?.script?.title || 'Draft')}</h1>
        <div class="cf-using">Using: ${p ? `<span>${esc(p.name)}</span>` : ''}${style ? `<span>${esc(style.name)}</span>` : ''}${voice ? `<span>${esc(voice.name)}</span>` : ''}</div>
        <div class="cf-live">${live}</div>
      </section></div>`
  }

  function render() {
    const st = state()
    const proj = project()
    const v = viewNow(st)
    const act = document.activeElement
    const focusId = act && root.contains(act) ? (act.id || (act.dataset.cfSec != null ? 'sec:' + act.dataset.cfSec : '')) : ''
    const sel = focusId && 'selectionStart' in act ? [act.selectionStart, act.selectionEnd] : null
    const body = v === 'brand' ? brandView(st) : v === 'script' ? scriptView(st) : v === 'settings' ? settingsView(st, proj) : runView(st, proj)
    root.innerHTML = `<div class="cf">${stepper(v)}${body}</div>`
    if (focusId) {
      const el = focusId.startsWith('sec:') ? root.querySelector(`[data-cf-sec="${focusId.slice(4)}"]`) : root.querySelector('#' + focusId)
      if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]) } catch (_) {} }
    }
    bind(v)
  }

  async function run(key, fn) {
    err[key] = ''
    render()
    const out = await fn()
    err[key] = typeof out === 'string' ? out : ''
    if (err[key] === 'SIGN_IN') { try { window.vidsoOpenSignup?.() } catch (_) {} }
    render()
    return !err[key]
  }
  const openEditor = (tab) => { try { window.switchPanel('edit', document.getElementById('nav-edit')) } catch (_) {} ; try { window.videoEditor?.open(tab) } catch (_) {} }

  function bind(v) {
    const $ = (q) => root.querySelector(q)
    const on = (q, fn) => root.querySelectorAll(q).forEach((b) => b.addEventListener('click', () => fn(b)))
    on('[data-cf-go]', (b) => go(b.dataset.cfGo))
    on('[data-cf-brand]', (b) => { try { window.agentsChat?.profiles?.use(b.dataset.cfBrand) } catch (_) {} ; go('script') })
    on('[data-cf-newbrand]', () => { try { window.switchPanel('brand', document.getElementById('nav-brand')) } catch (_) {} })
    on('[data-cf-mode]', (b) => { mode = b.dataset.cfMode; err.script = ''; render() })
    on('[data-cf-len]', (b) => { call('fvSetDuration', b.dataset.cfLen); render() })
    $('#cf-topic')?.addEventListener('input', (e) => { topic = e.target.value })
    $('#cf-paste')?.addEventListener('input', (e) => { paste = e.target.value; const lab = e.target.previousElementSibling?.lastElementChild; if (lab) lab.textContent = `${words(paste).toLocaleString('en-US')} words · ~${Math.max(1, Math.round(words(paste) / 150))} min` })
    on('[data-cf-write]', () => run('script', () => call('fvStudioWriteScript', topic)))
    on('[data-cf-paste]', async () => { if (await run('script', () => call('fvStudioUseScript', { text: paste, title: paste.trim().split('\n')[0].slice(0, 80) }))) go('settings') })
    on('[data-cf-fresh]', () => { call('fvAgentsReset'); secDraft = {}; started = false; go('script') })
    root.querySelectorAll('[data-cf-sec]').forEach((t) => {
      t.addEventListener('input', () => { secDraft[t.dataset.cfSec] = t.value })
      t.addEventListener('change', () => { const i = Number(t.dataset.cfSec); call('fvStudioEditSection', i, t.value); delete secDraft[i] })
    })
    on('[data-cf-play]', (b) => {
      const src = b.dataset.cfPlay
      try { audio?.pause() } catch (_) {}
      if (playing === src) { playing = ''; return render() }
      audio = new Audio(src); playing = src
      audio.onended = () => { playing = ''; render() }
      audio.play().catch(() => { playing = ''; render() })
      render()
    })
    on('[data-cf-vmode]', (b) => { call('fvSetVisual', { mode: b.dataset.cfVmode }); render() })
    on('[data-cf-pace]', (b) => { call('fvSetVisual', { pace: b.dataset.cfPace }); render() })
    on('[data-cf-styles]', () => { showStyles = !showStyles; render() })
    on('[data-cf-sgroup]', (b) => { styleGroup = b.dataset.cfSgroup; render() })
    on('[data-cf-style]', (b) => { call('fvSetVisual', { style: b.dataset.cfStyle }); showStyles = false; render() })
    on('[data-cf-cap]', (b) => { call('fvSetCaptionLook', b.dataset.cfCap); render() })
    on('[data-cf-aspect]', (b) => { call('fvSetAspect', b.dataset.cfAspect); render() })
    on('[data-cf-title]', (b) => { call('fvStudioSetTitle', b.dataset.cfTitle); render() })
    on('[data-cf-generate]', async () => {
      started = true
      view = 'run'
      // Narration and scenes, plus the thumbnail alongside; the cut waits for the user's review.
      if (await run('generate', () => call('fvStudioMakeMedia'))) call('fvStudioThumbnail', '')
      else { started = false; view = 'settings'; render() }
    })
    on('[data-cf-render]', async () => { if (await run('render', () => call('fvStudioRender'))) setTimeout(() => call('fvPublishAgain'), 1500) })
    on('[data-cf-publish]', () => { call('fvPublishAgain'); render() })
    on('[data-cf-retry]', async () => { await run('render', () => call('fvResumeRender')) })
    on('[data-cf-upload]', async (b) => {
      if (state()?.youtubeConnected === false) { try { window.switchPanel('youtube') } catch (_) {} ; return }
      b.disabled = true; b.textContent = 'Uploading…'
      try { await window.fvUploadToYoutube?.() } catch (_) {}
      err.upload = document.querySelector('[data-yt-status]')?.textContent?.trim() || 'Upload started.'
      render()
    })
    on('[data-cf-editor]', (b) => openEditor(b.dataset.cfEditor))
    on('[data-cf-tool]', (b) => window.switchPanel(b.dataset.cfTool))
    on('[data-cf-new]', () => { if (!state()?.script || confirm('Start a new video? A finished one stays in My Files.')) { call('fvAgentsReset'); secDraft = {}; topic = ''; paste = ''; started = false; view = ''; go(profiles().length > 1 ? 'brand' : 'script') } })
    if (v === 'script') call('fvAgentsLoadVoices')
  }

  let queued = 0
  const onChange = () => {
    if (queued) return
    queued = setTimeout(() => {
      queued = 0
      // Don't redraw under the user's typing on the script and settings pages.
      const typing = root.contains(document.activeElement) && /TEXTAREA|INPUT/.test(document.activeElement.tagName)
      if (!typing && root.isConnected && root.closest('.panel')?.classList.contains('active')) render()
    }, 150)
  }
  window.addEventListener('vidso:agents', onChange)
  render()
  return { render }
}
