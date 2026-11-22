/**
 * Studio: the manual side of TubeOps. Every step the agents do, laid out in
 * order, each showing where the current video stands and opening the tool to
 * do that step by hand (or handing it back to the agent).
 *
 * The step list and status text are pure (tested); initStudioHub renders into
 * the Studio panel and talks to the dashboard through window bridges.
 */

import { AGENTS, agentSvg } from './agents-chat.js'

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
  { panel: 'videogen', name: 'Long Form Generator (classic)', note: 'The original step-by-step page' },
]

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
.sh{--sh-ink:#f2f2f1;--sh-mute:rgba(242,242,241,.58);--sh-line:rgba(255,255,255,.08);max-width:1180px;margin:0 auto;padding:8px 4px 40px;color:var(--sh-ink);font-family:Inter,system-ui,-apple-system,sans-serif}
.sh-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 22px}
.sh-head h1{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(1.9rem,3.2vw,2.6rem);letter-spacing:-.01em}
.sh-head p{margin:6px 0 0;color:var(--sh-mute);max-width:620px;line-height:1.5}
.sh-now{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-radius:999px;background:#1c1c1d;border:1px solid var(--sh-line);font-size:.86rem;max-width:100%}
.sh-now b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.sh-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 15px;border-radius:999px;border:1px solid var(--sh-line);background:#232324;color:var(--sh-ink);font:inherit;font-size:.84rem;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.sh-btn:hover{background:#2b2b2c}
.sh-btn.is-primary{background:#fff;color:#161616;border-color:#fff;font-weight:600}
.sh-btn.is-primary:hover{background:#ececec}
.sh-btn:focus-visible,.sh-tool:focus-visible{outline:2px solid #fff;outline-offset:2px}
.sh-steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px;counter-reset:sh}
.sh-step{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:20px;background:#1c1c1d;border:1px solid var(--sh-line);min-width:0}
.sh-step-top{display:flex;align-items:center;gap:12px}
.sh-step-top .ag-blob{width:42px;height:42px;flex:0 0 42px}
.sh-num{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sh-mute)}
.sh-step h3{margin:1px 0 0;font-size:1.05rem;font-weight:600}
.sh-step p{margin:0;color:var(--sh-mute);font-size:.88rem;line-height:1.45}
.sh-status{display:flex;align-items:center;gap:8px;font-size:.84rem;min-width:0}
.sh-status span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.sh-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px;background:rgba(255,255,255,.25)}
.sh-status[data-state=done] .sh-dot{background:#4ade80}
.sh-status[data-state=working] .sh-dot{background:#fbbf24;animation:shPulse 1.2s ease-in-out infinite}
.sh-status[data-state=stuck] .sh-dot{background:#f87171}
.sh-thumb{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#111;display:block}
.sh-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}
.sh-strip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#111;display:block}
.sh-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}
.sh-sub{margin:34px 0 12px;font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sh-mute)}
.sh-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.sh-tool{display:flex;flex-direction:column;gap:3px;padding:14px;border-radius:16px;background:#1c1c1d;border:1px solid var(--sh-line);color:var(--sh-ink);font:inherit;text-align:left;cursor:pointer}
.sh-tool:hover{background:#232324}
.sh-tool b{font-size:.92rem;font-weight:600}
.sh-tool span{font-size:.8rem;color:var(--sh-mute)}
@keyframes shPulse{50%{opacity:.35}}
@media (max-width:720px){.sh{padding:4px 0 28px}.sh-steps{grid-template-columns:minmax(0,1fr)}.sh-head{margin-bottom:16px}}
@media (prefers-reduced-motion:reduce){.sh-status[data-state=working] .sh-dot{animation:none}}
`

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

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
  const toAgents = (fn) => { try { window.switchPanel('agents', document.getElementById('nav-agents')) } catch (_) {} ; try { fn?.() } catch (_) {} }

  // Each step opens the new Agents screens where one exists; only the Thumbnail
  // Generator and the YouTube page are still the classic tools.
  function open(stepId) {
    const st = state()
    const proj = project()
    const agents = (view, opts) => toAgents(() => window.agentsChat?.open(view, opts))
    if (stepId === 'script') return st?.script ? toAgents(() => window.agentsChat?.select('script')) : agents('script')
    if (stepId === 'title') return toAgents(() => window.agentsChat?.select('title'))
    if (stepId === 'voice') return proj ? agents('editor', { tab: 'voice' }) : agents('profile', { tab: 'voice' })
    if (stepId === 'scenes') return proj ? agents('editor', { tab: 'scenes' }) : agents(st?.script ? 'settings' : 'script')
    if (stepId === 'edit') return proj ? agents('editor', { tab: 'captions' }) : agents('profile', { tab: 'captions' })
    if (stepId === 'thumbnail') return window.switchPanel('imagegen')
    if (stepId === 'publish') return st?.publish?.description ? toAgents(() => window.agentsChat?.select('publish')) : window.switchPanel('youtube')
  }

  function stepHtml(step, i, st, proj) {
    const a = BY_ID[step.agent]
    const s = stepStatus(step, st, proj)
    let extra = ''
    if (step.id === 'thumbnail' && st?.thumb?.url) extra = `<img class="sh-thumb" src="${esc(st.thumb.url)}" alt="Current thumbnail" loading="lazy">`
    if (step.id === 'scenes' && proj?.scenes?.length) extra = `<div class="sh-strip">${proj.scenes.slice(0, 6).map((x) => `<img src="${esc(x.image)}" alt="" loading="lazy">`).join('')}</div>`
    if (step.id === 'voice' && st?.media?.voiceover) extra = `<audio controls preload="none" src="${esc(st.media.voiceover)}" style="width:100%"></audio>`
    return `<article class="sh-step" aria-labelledby="sh-step-${esc(step.id)}">
      <div class="sh-step-top">${agentSvg(step.agent)}<div><div class="sh-num">Step ${i + 1} · usually ${esc(a?.name || '')}</div><h3 id="sh-step-${esc(step.id)}">${esc(step.name)}</h3></div></div>
      <p>${esc(step.does)}</p>
      <div class="sh-status" data-state="${esc(s.state)}"><i class="sh-dot" aria-hidden="true"></i><span>${esc(s.text)}</span></div>
      ${extra}
      <div class="sh-actions"><button type="button" class="sh-btn is-primary" data-sh-open="${esc(step.id)}">Do it yourself</button><button type="button" class="sh-btn" data-sh-agent="${esc(step.agent)}">Ask ${esc(a?.name || 'the agent')}</button></div>
    </article>`
  }

  function render() {
    const st = state()
    const proj = project()
    const title = st?.script?.title || st?.topic || ''
    root.innerHTML = `<div class="sh">
      <header class="sh-head">
        <div><h1>Studio</h1><p>Every step the agents do, by hand. Open any step to change it yourself, or hand it back to the agent who usually does it.</p></div>
        <div class="sh-now">${title ? `<span style="color:var(--sh-mute)">Current video</span><b>${esc(title)}</b>` : '<span style="color:var(--sh-mute)">No video yet</span>'}<button type="button" class="sh-btn is-primary" data-sh-new>New video</button></div>
      </header>
      <div class="sh-steps">${MANUAL_STEPS.map((step, i) => stepHtml(step, i, st, proj)).join('')}</div>
      <div class="sh-sub">More tools</div>
      <div class="sh-tools">${MORE_TOOLS.map((t) => `<button type="button" class="sh-tool" data-sh-tool="${esc(t.panel)}"><b>${esc(t.name)}</b><span>${esc(t.note)}</span></button>`).join('')}</div>
    </div>`
    root.querySelectorAll('[data-sh-open]').forEach((b) => b.addEventListener('click', () => open(b.dataset.shOpen)))
    // Title and Thumbnail take requests in their own chats; the Manager briefs everyone else.
    root.querySelectorAll('[data-sh-agent]').forEach((b) => b.addEventListener('click', () => toAgents(() => window.agentsChat?.select(['title', 'thumbnail'].includes(b.dataset.shAgent) ? b.dataset.shAgent : 'manager'))))
    root.querySelectorAll('[data-sh-tool]').forEach((b) => b.addEventListener('click', () => window.switchPanel(b.dataset.shTool)))
    root.querySelector('[data-sh-new]')?.addEventListener('click', () => toAgents(() => window.agentsChat?.open('script', { fresh: true })))
  }

  let queued = 0
  const onChange = () => {
    if (queued) return
    queued = setTimeout(() => {
      queued = 0
      if (root.isConnected && root.closest('.panel')?.classList.contains('active')) render()
    }, 80)
  }
  window.addEventListener('vidso:agents', onChange)
  render()
  return { render }
}
