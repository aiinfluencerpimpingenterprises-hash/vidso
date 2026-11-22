/**
 * Studio: the manual side of TubeOps. Every step the agents do, laid out in
 * order, each showing where the current video stands and opening the tool to
 * do that step by hand (or handing it back to the agent).
 *
 * The step list and status text are pure (tested); initStudioHub renders into
 * the Studio panel and talks to the dashboard through window bridges.
 */

import { AGENTS, agentSvg } from './agents-chat.js'
import { VISUAL_STYLES, VISUAL_MODES, styleSample } from './visual-styles.js'

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
.sm{--sm-ink:#f2f2f1;--sm-mute:rgba(242,242,241,.58);--sm-line:rgba(255,255,255,.08);--sm-card:#1c1c1d;max-width:1240px;margin:0 auto;padding:8px 4px 40px;color:var(--sm-ink);font-family:Inter,system-ui,-apple-system,sans-serif}
.sm-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 20px}
.sm-head h1{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(1.9rem,3.2vw,2.6rem);letter-spacing:-.01em}
.sm-head p{margin:6px 0 0;color:var(--sm-mute);max-width:620px;line-height:1.5}
.sm-grid{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px;align-items:start}
.sm-rail{position:sticky;top:84px;display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:22px;background:var(--sm-card);border:1px solid var(--sm-line)}
.sm-r{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:14px;border:0;background:none;color:var(--sm-ink);font:inherit;text-align:left;cursor:pointer;min-width:0}
.sm-r:hover{background:#232324}
.sm-r.is-on{background:#2a2a2b}
.sm-r .ag-blob{width:30px;height:30px;flex:0 0 30px}
.sm-r-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.sm-r-txt b{font-size:.9rem;font-weight:600}
.sm-r-txt span{font-size:.74rem;color:var(--sm-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-r[data-state=todo] .ag-blob{opacity:.35;filter:grayscale(1)}
.sm-r[data-state=working] .ag-blob{animation:agHop 1s ease-in-out infinite}
.sm-mark{flex:0 0 18px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700;color:#fff}
.sm-r[data-state=done] .sm-mark{background:#22b864}
.sm-r[data-state=stuck] .sm-mark{background:#f5a524}
.sm-r[data-state=working] .sm-mark{border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:smSpin .8s linear infinite}
.sm-pane{padding:22px;border-radius:22px;background:var(--sm-card);border:1px solid var(--sm-line);min-width:0}
.sm-pane-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.sm-pane-head .ag-blob{width:44px;height:44px;flex:0 0 44px}
.sm-pane-head h2{margin:0;font-size:1.25rem;font-weight:600}
.sm-pane-head span{font-size:.84rem;color:var(--sm-mute)}
.sm-label{display:block;margin:16px 0 8px;font-size:.74rem;letter-spacing:.07em;text-transform:uppercase;color:var(--sm-mute)}
.sm-input,.sm-text{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid var(--sm-line);background:#141415;color:var(--sm-ink);font:inherit;font-size:.95rem;line-height:1.5}
.sm-text{resize:vertical;min-height:90px}
.sm-input:focus,.sm-text:focus{outline:none;border-color:rgba(255,255,255,.35)}
.sm-chips{display:flex;flex-wrap:wrap;gap:8px}
.sm-chip{height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--sm-line);background:#232324;color:var(--sm-ink);font:inherit;font-size:.86rem;cursor:pointer;white-space:nowrap}
.sm-chip:hover{background:#2b2b2c}
.sm-chip.is-on{background:#fff;color:#161616;border-color:#fff;font-weight:600}
.sm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:42px;padding:0 18px;border-radius:999px;border:1px solid var(--sm-line);background:#232324;color:var(--sm-ink);font:inherit;font-size:.9rem;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.sm-btn:hover{background:#2b2b2c}
.sm-btn.is-primary{background:#fff;color:#161616;border-color:#fff;font-weight:600}
.sm-btn.is-primary:hover{background:#ececec}
.sm-btn[disabled]{opacity:.45;cursor:default}
.sm-btn:focus-visible,.sm-chip:focus-visible,.sm-r:focus-visible{outline:2px solid #fff;outline-offset:2px}
.sm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;align-items:center}
.sm-note{margin-top:12px;font-size:.86rem;color:var(--sm-mute);line-height:1.5}
.sm-err{margin-top:12px;padding:10px 14px;border-radius:12px;background:rgba(245,165,36,.12);color:#fbbf24;font-size:.88rem}
.sm-busy{display:flex;align-items:center;gap:12px;margin-top:14px;padding:12px 14px;border-radius:14px;background:#232324;font-size:.9rem}
.sm-busy .ag-blob{width:32px;height:32px;animation:agHop 1s ease-in-out infinite}
.sm-sec{margin-top:12px}
.sm-sec b{display:block;margin-bottom:6px;font-size:.9rem}
.sm-titles{display:flex;flex-direction:column;gap:8px}
.sm-title{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;border:1px solid var(--sm-line);background:#141415;color:var(--sm-ink);font:inherit;font-size:.95rem;text-align:left;cursor:pointer}
.sm-title.is-on{border-color:#fff;background:#232324}
.sm-title i{flex:0 0 16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.35)}
.sm-title.is-on i{border:5px solid #fff}
.sm-voices{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;max-height:300px;overflow:auto;padding-right:4px}
.sm-voice{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;border:1px solid var(--sm-line);background:#141415;color:var(--sm-ink);font:inherit;text-align:left;cursor:pointer;min-width:0}
.sm-voice.is-on{border-color:#fff;background:#232324}
.sm-voice-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.sm-voice-txt b{font-size:.88rem}
.sm-voice-txt span{font-size:.74rem;color:var(--sm-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-play{flex:0 0 30px;width:30px;height:30px;border-radius:50%;border:0;background:#2e2e2f;color:#fff;display:grid;place-items:center;cursor:pointer}
.sm-styles{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;max-height:320px;overflow:auto;padding-right:4px}
.sm-style{display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:14px;border:1px solid var(--sm-line);background:#141415;color:var(--sm-ink);font:inherit;font-size:.78rem;cursor:pointer;text-align:left}
.sm-style img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:#0d0d0d;display:block}
.sm-style.is-on{border-color:#fff}
.sm-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
.sm-strip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#111;display:block}
.sm-media{width:100%;border-radius:14px;background:#000;display:block}
.sm-thumb{width:100%;max-width:520px;aspect-ratio:16/9;object-fit:cover;border-radius:14px;background:#111;display:block}
.sm-tags{display:flex;flex-wrap:wrap;gap:6px}
.sm-tags span{padding:4px 10px;border-radius:999px;background:#232324;font-size:.8rem}
.sm-sub{margin:34px 0 12px;font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sm-mute)}
.sm-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.sm-tool{display:flex;flex-direction:column;gap:3px;padding:14px;border-radius:16px;background:var(--sm-card);border:1px solid var(--sm-line);color:var(--sm-ink);font:inherit;text-align:left;cursor:pointer}
.sm-tool:hover{background:#232324}
.sm-tool b{font-size:.92rem;font-weight:600}
.sm-tool span{font-size:.8rem;color:var(--sm-mute)}
@keyframes smSpin{to{transform:rotate(360deg)}}
@media (max-width:860px){.sm-grid{grid-template-columns:minmax(0,1fr)}.sm-rail{position:static;flex-direction:row;overflow-x:auto;padding:6px}.sm-r{flex:0 0 auto}.sm-r-txt span{display:none}.sm-pane{padding:16px}}
@media (prefers-reduced-motion:reduce){.sm-r .ag-blob,.sm-busy .ag-blob,.sm-r[data-state=working] .sm-mark{animation:none!important}}
`

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const call = (name, ...args) => { try { return window[name]?.(...args) } catch (e) { return e?.message || 'Something went wrong.' } }

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

  let cur = ''            // the step on screen; '' = the first one not done
  let mode = 'write'      // script: 'write' | 'own'
  let topic = ''
  let own = { title: '', text: '' }
  let secDraft = {}
  let customTitle = ''
  let thumbNote = ''
  let showStyles = false
  const err = {}
  let preview = null
  let previewId = ''

  const statusOf = (st, proj) => Object.fromEntries(MANUAL_STEPS.map((x) => [x.id, stepStatus(x, st, proj)]))
  function stepNow(stats) {
    if (cur) return cur
    return (MANUAL_STEPS.find((x) => stats[x.id].state !== 'done') || MANUAL_STEPS[MANUAL_STEPS.length - 1]).id
  }
  const nextOf = (id) => MANUAL_STEPS[MANUAL_STEPS.findIndex((x) => x.id === id) + 1]
  const busyHtml = (agent, text) => `<div class="sm-busy">${agentSvg(agent)}<span><b>${esc(BY_ID[agent]?.name || '')}</b> ${esc(text)}</span></div>`
  const errHtml = (id) => (err[id] ? `<div class="sm-err">${esc(err[id] === 'SIGN_IN' ? 'Sign in to make a video.' : err[id])}</div>` : '')
  const nextBtn = (id, ok) => { const n = nextOf(id); return n ? `<button type="button" class="sm-btn${ok ? ' is-primary' : ''}" data-sm-go="${esc(n.id)}">Next: ${esc(n.name)} →</button>` : '' }

  function scriptPane(st, s) {
    if (st?.busyScript || (s.state === 'working')) return busyHtml('script', s.text || 'Writing the script')
    const sc = st?.script
    if (sc) {
      return `<div class="sm-note">${esc(Number(sc.words || 0).toLocaleString('en-US'))} words. Edit any part; changes save when you click away.</div>
        ${sc.sections.map((x, i) => `<div class="sm-sec"><b>${esc(x.heading || 'Part ' + (i + 1))}</b><textarea class="sm-text" rows="5" data-sm-sec="${i}" aria-label="${esc(x.heading || 'Part ' + (i + 1))}">${esc(secDraft[i] ?? x.text)}</textarea></div>`).join('')}
        ${errHtml('script')}
        <div class="sm-actions">${nextBtn('script', true)}<button type="button" class="sm-btn" data-sm-fresh>Start a new script</button></div>`
    }
    const len = LENGTHS.map(([id, l]) => `<button type="button" class="sm-chip${st?.durationId === id ? ' is-on' : ''}" data-sm-len="${id}">${l}</button>`).join('')
    return `<div class="sm-chips" role="tablist"><button type="button" class="sm-chip${mode === 'write' ? ' is-on' : ''}" data-sm-mode="write">Write it for me</button><button type="button" class="sm-chip${mode === 'own' ? ' is-on' : ''}" data-sm-mode="own">I have a script</button></div>
      ${mode === 'write' ? `<label class="sm-label" for="sm-topic">What's the video about?</label><textarea class="sm-text" id="sm-topic" rows="3" placeholder="The rise and fall of Blockbuster">${esc(topic)}</textarea>
        <span class="sm-label">Length</span><div class="sm-chips">${len}</div>
        ${errHtml('script')}
        <div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-write>Write the script</button></div>`
      : `<label class="sm-label" for="sm-own-title">Title</label><input class="sm-input" id="sm-own-title" value="${esc(own.title)}" placeholder="Your video title">
        <label class="sm-label" for="sm-own-text">Your script</label><textarea class="sm-text" id="sm-own-text" rows="10" placeholder="Paste your narration. Blank lines split it into parts.">${esc(own.text)}</textarea>
        ${errHtml('script')}
        <div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-own>Use my script</button></div>`}`
  }

  function titlePane(st) {
    const sc = st?.script
    if (!sc) return `<div class="sm-note">Write the script first; titles come from it.</div><div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-go="script">Go to Script</button></div>`
    const opts = [...new Set([sc.title, ...(sc.options || [])].filter(Boolean))]
    return `<div class="sm-titles">${opts.map((t) => `<button type="button" class="sm-title${t === sc.title ? ' is-on' : ''}" data-sm-title="${esc(t)}"><i></i>${esc(t)}</button>`).join('')}</div>
      <label class="sm-label" for="sm-title-own">Or write your own</label>
      <div style="display:flex;gap:8px"><input class="sm-input" id="sm-title-own" value="${esc(customTitle)}" maxlength="120" placeholder="Type a title"><button type="button" class="sm-btn" data-sm-title-own>Use</button></div>
      <div class="sm-actions">${nextBtn('title', true)}</div>`
  }

  function voicePane(st, s, stats) {
    if (s.state === 'working' || stats.scenes.state === 'working') return busyHtml(stats.scenes.state === 'working' ? 'agent' : 'voice', (stats.scenes.state === 'working' ? stats.scenes.text : s.text) || 'Recording the narration')
    const list = st?.voices || []
    const v = st?.visual || {}
    const style = VISUAL_STYLES.find((x) => x.id === v.style) || VISUAL_STYLES[0]
    const voices = list.length ? `<div class="sm-voices">${list.map((x) => `<div class="sm-voice${x.id === st.voiceId ? ' is-on' : ''}" role="button" tabindex="0" data-sm-voice="${esc(x.id)}">${x.preview ? `<button type="button" class="sm-play" data-sm-preview="${esc(x.id)}" data-src="${esc(x.preview)}" aria-label="Play ${esc(x.name)}">${previewId === x.id ? '■' : '▶'}</button>` : ''}<span class="sm-voice-txt"><b>${esc(x.name)}</b><span>${esc([x.gender, x.accent, x.desc].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div>`
      : `<div class="sm-note">${st?.voiceState === 'error' ? 'Voices load once you sign in.' : 'Loading voices…'}</div>`
    const done = !!st?.media?.voiceover
    return `${done ? `<span class="sm-label">Your narration</span><audio class="sm-media" controls preload="none" src="${esc(st.media.voiceover)}"></audio>` : ''}
      <span class="sm-label">Narrator</span>${voices}
      <span class="sm-label">Scene style</span>
      ${showStyles ? `<div class="sm-styles">${VISUAL_STYLES.map((x) => `<button type="button" class="sm-style${x.id === style.id ? ' is-on' : ''}" data-sm-style="${esc(x.id)}"><img src="${esc(styleSample(x.id))}" alt="" loading="lazy">${esc(x.name)}</button>`).join('')}</div>`
        : `<div style="display:flex;gap:12px;align-items:center"><img src="${esc(styleSample(style.id))}" alt="" style="width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:10px"><b>${esc(style.name)}</b><button type="button" class="sm-chip" data-sm-styles>Change</button></div>`}
      <span class="sm-label">Motion</span><div class="sm-chips">${VISUAL_MODES.map((m) => `<button type="button" class="sm-chip${(v.mode || 'cheapest') === m.id ? ' is-on' : ''}" data-sm-vmode="${esc(m.id)}" title="${esc(m.note)}">${esc(m.name)}</button>`).join('')}</div>
      ${errHtml('voice')}
      <div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-media ${st?.script ? '' : 'disabled'}>${done ? 'Record again and redraw scenes' : 'Record voiceover and draw scenes'}</button>${done ? nextBtn('voice', false) : ''}</div>
      <div class="sm-note">This records the narration with the voice you picked, then draws a scene for every line in your style.</div>`
  }

  function scenesPane(st, s, proj) {
    if (s.state === 'working') return busyHtml('agent', s.text) + (st?.scenes?.images?.length ? `<div class="sm-strip" style="margin-top:12px">${st.scenes.images.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : '')
    if (proj?.scenes?.length) {
      return `<div class="sm-note">${proj.scenes.length} scenes. Redraw, animate or reword any of them in the Editor.</div>
        <div class="sm-strip" style="margin-top:12px">${proj.scenes.map((x) => `<img src="${esc(x.image)}" alt="" loading="lazy">`).join('')}</div>
        <div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-editor="scenes">Edit scenes</button>${nextBtn('scenes', false)}</div>`
    }
    if (st?.media?.clips) return `<div class="sm-note">${st.media.clips} clips are placed under the narration.</div><div class="sm-actions">${nextBtn('scenes', true)}</div>`
    return `<div class="sm-note">Scenes are drawn when you record the voiceover.</div><div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-go="voice">Go to Voiceover</button></div>`
  }

  function thumbPane(st, s) {
    const t = st?.thumb
    const busy = s.state === 'working' || t?.busy
    return `${t?.url ? `<img class="sm-thumb" src="${esc(t.url)}" alt="Your thumbnail">` : ''}
      ${busy ? busyHtml('thumbnail', s.text || 'Designing the thumbnail') : `
      <label class="sm-label" for="sm-thumb-note">Anything it should show? (optional)</label>
      <input class="sm-input" id="sm-thumb-note" value="${esc(thumbNote)}" maxlength="300" placeholder="A shocked face next to a crumbling video store">
      ${errHtml('thumbnail')}
      <div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-thumb ${st?.script ? '' : 'disabled'}>${t?.url ? 'Try another design' : 'Design the thumbnail'}</button><button type="button" class="sm-btn" data-sm-tool="imagegen">Open Thumbnail Generator</button>${t?.url ? nextBtn('thumbnail', false) : ''}</div>`}`
  }

  function renderPane(st, s) {
    const looks = call('fvCaptionLooks') || []
    if (st?.renderUrl) {
      return `<video class="sm-media" controls playsinline preload="metadata" src="${esc(st.renderUrl)}"></video>
        <div class="sm-actions"><a class="sm-btn is-primary" href="${esc(st.renderUrl)}" download target="_blank" rel="noopener">Download video</a><button type="button" class="sm-btn" data-sm-editor="captions">Edit this video</button>${nextBtn('edit', false)}</div>`
    }
    if (s.state === 'working') return busyHtml('editor', s.text || 'Rendering')
    return `<span class="sm-label">Captions</span><div class="sm-chips">${(Array.isArray(looks) ? looks : []).map((l) => `<button type="button" class="sm-chip${st?.captionLook === l.id ? ' is-on' : ''}" data-sm-cap="${esc(l.id)}">${esc(l.name)}</button>`).join('')}</div>
      <div class="sm-note">Music, caption size and every scene can be fine-tuned in the Editor before or after the render.</div>
      ${errHtml('edit')}
      <div class="sm-actions"><button type="button" class="sm-btn is-primary" data-sm-render ${st?.hasMedia ? '' : 'disabled'}>Render the video</button><button type="button" class="sm-btn" data-sm-editor="music">Pick music in the Editor</button></div>
      ${st?.hasMedia ? '' : '<div class="sm-note">Record the voiceover first.</div>'}`
  }

  function publishPane(st, s) {
    const p = st?.publish
    if (s.state === 'working' || p?.busy) return busyHtml('publish', 'Writing the description and tags')
    return `${p?.description ? `<span class="sm-label">Description</span><textarea class="sm-text" rows="8" readonly>${esc(p.full || p.description)}</textarea>
      ${p.tags?.length ? `<span class="sm-label">Tags</span><div class="sm-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}` : `<div class="sm-note">Write the YouTube description, tags and chapters from your script.</div>`}
      ${p?.error ? `<div class="sm-err">${esc(p.error)}</div>` : ''}
      <div class="sm-actions"><button type="button" class="sm-btn${p?.description ? '' : ' is-primary'}" data-sm-publish ${st?.script ? '' : 'disabled'}>${p?.description ? 'Write it again' : 'Write description and tags'}</button><button type="button" class="sm-btn${p?.description ? ' is-primary' : ''}" data-sm-tool="youtube">Upload to YouTube</button></div>`
  }

  function render() {
    const st = state()
    const proj = project()
    const stats = statusOf(st, proj)
    const id = stepNow(stats)
    const step = MANUAL_STEPS.find((x) => x.id === id)
    const s = stats[id]
    const pane = { script: () => scriptPane(st, s), title: () => titlePane(st), voice: () => voicePane(st, s, stats), scenes: () => scenesPane(st, s, proj), thumbnail: () => thumbPane(st, s), edit: () => renderPane(st, s), publish: () => publishPane(st, s) }[id]()
    // Keep what the user is typing (and where) across live updates.
    const act = document.activeElement
    const focusId = act && root.contains(act) ? (act.id || (act.dataset.smSec != null ? 'sec:' + act.dataset.smSec : '')) : ''
    const sel = focusId && 'selectionStart' in act ? [act.selectionStart, act.selectionEnd] : null
    const paneScroll = root.querySelector('.sm-voices')?.scrollTop || 0
    root.innerHTML = `<div class="sm">
      <header class="sm-head"><div><h1>Studio</h1><p>Make a video yourself, one step at a time. Nothing moves on until you say so. Prefer to hand it off? Tell the Manager in Agents.</p></div>
        <button type="button" class="sm-btn" data-sm-new>New video</button></header>
      <div class="sm-grid">
        <nav class="sm-rail" aria-label="Steps">${MANUAL_STEPS.map((x, i) => `<button type="button" class="sm-r${x.id === id ? ' is-on' : ''}" data-state="${esc(stats[x.id].state)}" data-sm-go="${esc(x.id)}" aria-current="${x.id === id ? 'step' : 'false'}">${agentSvg(x.agent)}<span class="sm-r-txt"><b>${i + 1}. ${esc(x.name)}</b><span>${esc(stats[x.id].text)}</span></span><i class="sm-mark" aria-hidden="true">${stats[x.id].state === 'done' ? '✓' : stats[x.id].state === 'stuck' ? '!' : ''}</i></button>`).join('')}</nav>
        <section class="sm-pane" aria-labelledby="sm-h">
          <div class="sm-pane-head">${agentSvg(step.agent)}<div><h2 id="sm-h">${esc(step.name)}</h2><span>${esc(step.does)}</span></div></div>
          ${pane}
        </section>
      </div>
      <div class="sm-sub">More tools</div>
      <div class="sm-tools">${MORE_TOOLS.map((t) => `<button type="button" class="sm-tool" data-sm-tool="${esc(t.panel)}"><b>${esc(t.name)}</b><span>${esc(t.note)}</span></button>`).join('')}</div>
    </div>`
    const vs = root.querySelector('.sm-voices')
    if (vs) vs.scrollTop = paneScroll
    if (focusId) {
      const el = focusId.startsWith('sec:') ? root.querySelector(`[data-sm-sec="${focusId.slice(4)}"]`) : root.querySelector('#' + focusId)
      if (el) { el.focus(); if (sel) try { el.setSelectionRange(sel[0], sel[1]) } catch (_) {} }
    }
    bind()
  }

  const goTo = (id) => { cur = id; render(); root.querySelector('.sm-pane')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
  const openEditor = (tab) => { try { window.switchPanel('edit', document.getElementById('nav-edit')) } catch (_) {} ; try { window.videoEditor?.open(tab) } catch (_) {} }
  async function run(stepId, fn) {
    err[stepId] = ''
    render()
    const out = await fn()
    err[stepId] = typeof out === 'string' ? out : ''
    if (err[stepId] === 'SIGN_IN') { try { window.vidsoOpenSignup?.() } catch (_) {} }
    render()
  }

  function bind() {
    const $ = (q) => root.querySelector(q)
    const $$ = (q, fn) => root.querySelectorAll(q).forEach((b) => b.addEventListener('click', () => fn(b)))
    $$('[data-sm-go]', (b) => goTo(b.dataset.smGo))
    $$('[data-sm-mode]', (b) => { mode = b.dataset.smMode; err.script = ''; render() })
    $$('[data-sm-len]', (b) => { call('fvSetDuration', b.dataset.smLen); render() })
    $('#sm-topic')?.addEventListener('input', (e) => { topic = e.target.value })
    $('#sm-own-title')?.addEventListener('input', (e) => { own.title = e.target.value })
    $('#sm-own-text')?.addEventListener('input', (e) => { own.text = e.target.value })
    $('#sm-title-own')?.addEventListener('input', (e) => { customTitle = e.target.value })
    $('#sm-thumb-note')?.addEventListener('input', (e) => { thumbNote = e.target.value })
    $$('[data-sm-write]', () => { cur = 'script'; run('script', () => call('fvStudioWriteScript', topic)) })
    $$('[data-sm-own]', () => { cur = 'script'; run('script', () => call('fvStudioUseScript', { text: own.text, title: own.title.trim() || own.text.trim().split('\n')[0].slice(0, 80) })) })
    $$('[data-sm-fresh]', () => { call('fvAgentsReset'); secDraft = {}; cur = 'script'; render() })
    root.querySelectorAll('[data-sm-sec]').forEach((t) => {
      t.addEventListener('input', () => { secDraft[t.dataset.smSec] = t.value })
      t.addEventListener('change', () => { const i = Number(t.dataset.smSec); call('fvStudioEditSection', i, t.value); delete secDraft[i] })
    })
    $$('[data-sm-title]', (b) => { call('fvStudioSetTitle', b.dataset.smTitle); render() })
    $$('[data-sm-title-own]', () => { if (customTitle.trim()) { call('fvStudioSetTitle', customTitle); customTitle = ''; render() } })
    root.querySelectorAll('[data-sm-voice]').forEach((el) => {
      const pick = () => { call('fvAgentsVoice', el.dataset.smVoice); render() }
      el.addEventListener('click', (e) => { if (!e.target.closest('[data-sm-preview]')) pick() })
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } })
    })
    $$('[data-sm-preview]', (b) => {
      if (previewId === b.dataset.smPreview) { try { preview?.pause() } catch (_) {} ; previewId = ''; return render() }
      try { preview?.pause() } catch (_) {}
      preview = new Audio(b.dataset.src)
      previewId = b.dataset.smPreview
      preview.onended = () => { previewId = ''; render() }
      preview.play().catch(() => { previewId = ''; render() })
      render()
    })
    $$('[data-sm-styles]', () => { showStyles = true; render() })
    $$('[data-sm-style]', (b) => { call('fvSetVisual', { style: b.dataset.smStyle }); showStyles = false; render() })
    $$('[data-sm-vmode]', (b) => { call('fvSetVisual', { mode: b.dataset.smVmode }); render() })
    $$('[data-sm-media]', () => run('voice', () => call('fvStudioMakeMedia')))
    $$('[data-sm-thumb]', () => run('thumbnail', () => call('fvStudioThumbnail', thumbNote)))
    $$('[data-sm-cap]', (b) => { call('fvSetCaptionLook', b.dataset.smCap); render() })
    $$('[data-sm-render]', () => run('edit', () => call('fvStudioRender')))
    $$('[data-sm-publish]', () => { call('fvPublishAgain'); render() })
    $$('[data-sm-editor]', (b) => openEditor(b.dataset.smEditor))
    $$('[data-sm-tool]', (b) => window.switchPanel(b.dataset.smTool))
    $$('[data-sm-new]', () => { if (!state()?.script || confirm('Start a new video? The current one stays in My Files if it was rendered.')) { call('fvAgentsReset'); secDraft = {}; topic = ''; own = { title: '', text: '' }; cur = 'script'; render() } })
    if (cur === 'voice' || stepNow(statusOf(state(), project())) === 'voice') call('fvAgentsLoadVoices')
  }

  let queued = 0
  const onChange = () => {
    if (queued) return
    queued = setTimeout(() => {
      queued = 0
      if (root.isConnected && root.closest('.panel')?.classList.contains('active')) render()
    }, 120)
  }
  window.addEventListener('vidso:agents', onChange)
  render()
  return { render }
}
