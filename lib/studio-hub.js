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
.cf-step i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:.72rem;font-weight:600;background:#262627;color:var(--cf-mute)}
.cf-step.is-on{color:var(--cf-ink)}.cf-step.is-on i{background:var(--cf-acc);color:#fff}
.cf-step.is-done i{background:#22b864;color:#fff}
.cf-step:disabled{opacity:.4;cursor:not-allowed}
.cf-sep{width:28px;height:1px;background:var(--cf-line)}
.cf-kicker{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--cf-acc);font-weight:500;margin:0 0 8px}
.cf-h1{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(2rem,3.6vw,3rem);letter-spacing:-.015em;line-height:1.05}
.cf-h1 em{font-style:normal;color:var(--cf-acc)}
.cf-lead{margin:10px 0 24px;color:var(--cf-mute);font-size:.98rem;max-width:640px;line-height:1.5}
.cf-cols{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:22px;align-items:start}
.cf-card{background:var(--cf-card);border:1px solid var(--cf-line);border-radius:20px;padding:18px}
.cf-label{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px;font-size:.78rem;color:var(--cf-mute)}
.cf-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:#202021;margin-bottom:14px}
.cf-tab{height:34px;padding:0 16px;border-radius:999px;border:0;background:none;color:var(--cf-mute);font:inherit;font-size:.86rem;cursor:pointer}
.cf-tab.is-on{background:#fff;color:#141414;font-weight:500}
.cf-text,.cf-input{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--cf-line);background:#101011;color:var(--cf-ink);font:inherit;font-size:.95rem;line-height:1.6;padding:14px 16px}
.cf-text{resize:vertical;min-height:300px}
.cf-text:focus,.cf-input:focus{outline:none;border-color:rgba(255,255,255,.32)}
.cf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--cf-line);background:#232324;color:var(--cf-ink);font:inherit;font-size:.92rem;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.cf-btn:hover{background:#2c2c2d}
.cf-btn.is-primary{background:var(--cf-acc);border-color:var(--cf-acc);color:#fff;font-weight:500}
.cf-btn.is-primary:hover{filter:brightness(1.08)}
.cf-btn[disabled]{opacity:.45;cursor:default;filter:none}
.cf-btn:focus-visible,.cf-tab:focus-visible,.cf-brand:focus-visible,.cf-opt:focus-visible,.cf-chip:focus-visible{outline:2px solid #fff;outline-offset:2px}
.cf-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px}
.cf-hint{font-size:.82rem;color:var(--cf-mute)}
.cf-err{margin-top:12px;padding:10px 14px;border-radius:12px;background:rgba(245,165,36,.12);color:#fbbf24;font-size:.88rem}
.cf-chips{display:flex;flex-wrap:wrap;gap:6px}
.cf-chip{height:32px;padding:0 13px;border-radius:999px;border:1px solid var(--cf-line);background:#1f1f20;color:var(--cf-ink);font:inherit;font-size:.82rem;cursor:pointer}
.cf-chip.is-on{background:#fff;color:#141414;border-color:#fff;font-weight:500}
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
.cf-pct b{font-size:2rem;font-weight:600}
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
.cf-p em{font-style:normal;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;align-self:center}
.cf-p em.ok{color:#4ade80}.cf-p em.turn{background:var(--cf-acc);color:#fff}.cf-p em.stuck{color:#fbbf24}
.cf-live{border-radius:18px;background:repeating-linear-gradient(135deg,#151516 0 14px,#19191a 14px 28px);border:1px solid var(--cf-line);min-height:360px;padding:16px;display:flex;flex-direction:column;gap:12px}
.cf-live-tag{align-self:flex-start;font-size:.72rem;font-weight:600;letter-spacing:.08em;padding:4px 10px;border-radius:999px;background:#0e0e0f;color:#fff}
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
/* ── New look (Nov 2026): same type, sizes and blue accent as the Agents page ── */
.cf{--cf-ink:#ededec;--cf-mute:#8d8d8b;--cf-line:rgba(255,255,255,.08);--cf-card:#1a1a1b;--cf-card2:#202021;--cf-acc:#ff2d48;max-width:1080px;font-family:Inter,system-ui,-apple-system,sans-serif}
.cf-steps{font-size:12.5px;margin:2px 0 22px;gap:8px}
.cf-step{gap:7px}
.cf-step i{width:20px;height:20px;font-size:10.5px;font-weight:500}
.cf-step.is-on i{background:#c41530;box-shadow:0 0 0 1px #ff2d48}
.cf-sep{width:22px}
.cf-kicker{font-size:11px;letter-spacing:.08em;color:var(--cf-mute);font-weight:500;margin-bottom:6px}
.cf-h1{font:500 26px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.015em}
.cf-h1 em{color:inherit}
.cf-lead{font-size:13.5px;margin:8px 0 20px}
.cf-card{border-radius:16px;padding:16px}
.cf-label{font-size:12px}
.cf-tab{height:30px;padding:0 13px;font-size:13px;border-radius:8px}
.cf-text,.cf-input{border-radius:10px;font-size:14px;background:#141415}
.cf-btn{height:36px;padding:0 15px;border-radius:9px;font-size:13.5px;font-weight:500}
.cf-btn.is-primary{background:#c41530;border-color:#ff2d48;color:#fff;font-weight:500}
.cf-btn.is-primary:hover{background:#e0203c;color:#fff}
.cf-chip{height:30px;padding:0 11px;border-radius:8px;font-size:12.5px}
.cf-hint{font-size:12.5px}
.cf-brand,.cf-new{border-radius:14px}
.cf-brand.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48}
.cf-tags span{font-size:11px}
.cf-opt{border-radius:11px;padding:10px 12px}
.cf-opt b{font-size:13.5px;font-weight:500}.cf-opt span{font-size:12px}
.cf-opt.is-on{border-color:#ff2d48;background:rgba(255,45,72,.08)}
.cf-sub{font-size:11px;letter-spacing:.08em}
.cf-play{background:#c41530;box-shadow:0 0 0 1px #ff2d48}
.cf-stats{font-size:12.5px}
.cf-shape i.is-anim{background:rgba(255,45,72,.45)}
.cf-turn{border-color:#ff2d48;background:rgba(255,45,72,.07)}
.cf-tab.is-on,.cf-chip.is-on{font-weight:500}

/* ── 2026 refresh: glass cards, bigger type, segmented tabs, red glow actions ── */
.cf{--cf-line:rgba(255,255,255,.08);--cf-card:#141416;--cf-card2:#1b1b1e;max-width:1120px}
.cf-steps{font-size:13px;margin:4px 0 26px;gap:10px}
.cf-step{color:rgba(255,255,255,.45)}
.cf-step.is-on{color:#fff}
.cf-step i{width:24px;height:24px;font-size:11.5px;border-radius:8px;background:rgba(255,255,255,.06)}
.cf-step.is-on i{background:linear-gradient(180deg,#ff4a63,#e11d3a);box-shadow:0 6px 16px -6px rgba(255,45,72,.7)}
.cf-kicker{font-size:12.5px;letter-spacing:0;text-transform:none;color:#ff6b80;font-weight:500;margin-bottom:8px}
.cf-h1{font:550 36px/1.12 Inter,system-ui,sans-serif;letter-spacing:-.04em;color:#fff}
.cf-lead{font-size:15.5px;color:rgba(255,255,255,.55);margin:10px 0 28px;max-width:620px}
.cf-card{border-radius:24px;padding:22px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);box-shadow:0 30px 70px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05)}
.cf-label{font-size:13px;font-weight:500;color:rgba(255,255,255,.55)}
.cf-tabs{display:inline-flex;padding:4px;gap:2px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
.cf-tab{height:34px;padding:0 15px;font-size:13.5px;border-radius:9px;border:0;background:transparent;color:rgba(255,255,255,.55)}
.cf-tab.is-on{background:rgba(255,255,255,.12);color:#fff;font-weight:500;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.cf-text,.cf-input{border-radius:14px;font-size:15px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);padding:14px 16px;transition:border-color .15s,box-shadow .15s}
.cf-text:focus,.cf-input:focus{border-color:rgba(255,72,96,.5);box-shadow:0 0 0 4px rgba(255,45,72,.08);outline:none}
.cf-chip{height:34px;padding:0 14px;border-radius:999px;font-size:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);transition:background .15s}
.cf-chip:hover{background:rgba(255,255,255,.1)}
.cf-chip.is-on{background:#fff;color:#111;border-color:#fff}
.cf-btn{height:40px;padding:0 18px;border-radius:12px;font-size:14px;font-weight:500;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);transition:background .15s,filter .15s}
.cf-btn:hover{background:rgba(255,255,255,.11)}
.cf-btn.is-primary{background:linear-gradient(180deg,#ff4a63,#e11d3a);border:0;color:#fff;font-weight:500;box-shadow:0 10px 28px -8px rgba(255,45,72,.7),inset 0 1px 0 rgba(255,255,255,.25)}
.cf-btn.is-primary:hover{background:linear-gradient(180deg,#ff4a63,#e11d3a);filter:brightness(1.08)}
.cf-btn.is-primary:disabled{opacity:.45;box-shadow:none}
.cf-hint{font-size:13px;color:rgba(255,255,255,.45)}
.cf-brand,.cf-new{border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08)}
.cf-brand.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48,0 16px 40px -14px rgba(255,45,72,.45)}
.cf-tags span{border-radius:999px;font-size:11.5px;padding:3px 9px;background:rgba(255,255,255,.06)}
.cf-opt{border-radius:16px;padding:14px 16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);transition:border-color .15s,background .15s}
.cf-opt:hover{background:rgba(255,255,255,.06)}
.cf-opt b{font-size:14.5px;font-weight:500}.cf-opt span{font-size:12.5px}
.cf-opt.is-on{border-color:#ff2d48;background:rgba(255,45,72,.08);box-shadow:0 0 0 1px #ff2d48}
.cf-sub{font-size:12.5px;letter-spacing:0;text-transform:none;font-weight:500;color:rgba(255,255,255,.5)}
/* Studio like the reference: identity header, uppercase section titles, image cards with a check */
.cf-hero{position:relative;display:flex;flex-direction:column;gap:26px;margin:0 0 34px;isolation:isolate}
.cf-hero::before{content:"";position:absolute;inset:-90px -60px -30px;z-index:-1;background:var(--bg) center 30%/cover no-repeat;opacity:.18;filter:blur(40px) saturate(1.1);-webkit-mask-image:radial-gradient(70% 90% at 25% 10%,#000 20%,transparent 75%);mask-image:radial-gradient(70% 90% at 25% 10%,#000 20%,transparent 75%);pointer-events:none}
.cf-crumb{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.4)}
.cf-crumb svg{width:14px;height:14px}
.cf-crumb i{font-style:normal;opacity:.6}
.cf-crumb b{font-weight:400;color:rgba(255,255,255,.8)}
.cf-id{display:flex;align-items:center;gap:22px;min-width:0}
.cf-ava{position:relative;flex:none;width:88px;height:88px;padding:0;border:0;border-radius:50%;overflow:visible;background:none;cursor:pointer}
.cf-ava img{width:100%;height:100%;border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 16px 36px -12px rgba(0,0,0,.8)}
.cf-ava i{position:absolute;right:0;bottom:2px;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#1c1c1f;border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.75)}
.cf-ava i svg,.cf-pen svg{width:12px;height:12px}
.cf-idt{display:flex;flex-direction:column;gap:10px;min-width:0}
.cf-name{display:flex;align-items:center;gap:10px;min-width:0}
.cf-name h1{margin:0;font:600 34px/1.05 "SF Pro Display",-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;letter-spacing:-.01em;text-transform:uppercase;color:#f2f2f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cf-pen{flex:none;display:grid;place-items:center;width:28px;height:28px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(255,255,255,.55);cursor:pointer}
.cf-pen:hover{color:#fff;border-color:rgba(255,255,255,.25)}
.cf-idsub{display:flex;flex-direction:column;gap:3px}
.cf-idsub small{font-size:12px;color:rgba(255,255,255,.4)}
.cf-idsub span{font-size:14px;color:rgba(255,255,255,.82)}
.cf-sec{margin:0 0 6px;font:600 20px/1.2 "SF Pro Display",-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;letter-spacing:0;text-transform:uppercase;color:#f2f2f0}
.cf-sech{margin:0 0 18px;font-size:13px;color:rgba(255,255,255,.45)}
/* Channel picks as image cards, three across */
.cf-brands{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.cf-brand{position:relative;padding:6px;border-radius:16px;background:#141416;border:1px solid rgba(255,255,255,.08);transition:border-color .15s,background .15s}
.cf-brand:hover{border-color:rgba(255,255,255,.2);background:#18181b}
.cf-brand img{border-radius:11px}
.cf-brand-b{padding:10px 6px 4px;gap:6px}
.cf-brand-b b{font-size:14px;font-weight:500}
.cf-brand.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48}
.cf-brand.is-on::after{content:"";position:absolute;top:14px;right:14px;width:22px;height:22px;border-radius:7px;background:#ff2d48 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/14px no-repeat}
.cf-new{min-height:190px;flex-direction:column;border-radius:16px;border:1.5px dashed rgba(255,255,255,.14);color:rgba(255,255,255,.55);font-size:14px}
.cf-new:hover{border-color:rgba(255,45,72,.5);color:#fff}
/* Settings rows like the reference's topic rows */
.cf-opt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;position:relative;padding:12px 40px 12px 14px;border-radius:12px;background:#141416;border:1px solid rgba(255,255,255,.07)}
.cf-opt.is-on{border-color:#ff2d48;background:rgba(255,45,72,.05);box-shadow:0 0 0 1px #ff2d48}
.cf-opt.is-on::after{content:"";position:absolute;right:12px;top:50%;margin-top:-10px;width:20px;height:20px;border-radius:6px;background:#ff2d48 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/13px no-repeat}
.cf-opt b{font-size:13.5px;font-weight:500}
.cf-opt span{font-size:12px;color:rgba(255,255,255,.45)}
@media (max-width:640px){.cf-ava{width:64px;height:64px}.cf-name h1{font-size:24px}.cf-id{gap:14px}}
/* Script, settings and run steps: calm sections like the reference */
.cf-link{border:0;background:none;padding:4px 6px;border-radius:8px;color:rgba(255,255,255,.6);font:500 13px Inter,system-ui,sans-serif;cursor:pointer}
.cf-link:hover{color:#fff;background:rgba(255,255,255,.05)}
.cf-sbar{display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:14px;border-radius:14px;background:#141416;border:1px solid rgba(255,255,255,.07);font-size:13px;color:rgba(255,255,255,.55)}
.cf-sbar b{color:#fff;font-weight:500}
.cf-sp{flex:1}
.cf-parts{display:flex;flex-direction:column;gap:10px}
.cf-part{padding:14px 16px 10px;border-radius:16px;background:#141416;border:1px solid rgba(255,255,255,.07);transition:border-color .15s}
.cf-part:focus-within{border-color:rgba(255,45,72,.5)}
.cf-part-h{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
.cf-part-h em{font-style:normal;font-size:12px;color:#ff6b80;font-variant-numeric:tabular-nums}
.cf-part-h b{font-size:14px;font-weight:500;color:#f2f2f0}
.cf-ptext{display:block;width:100%;min-height:0;resize:none;overflow:hidden;padding:0;border:0;outline:0;background:transparent;color:rgba(255,255,255,.78);font:400 14px/1.65 Inter,system-ui,sans-serif}
.cf-stack{display:flex;flex-direction:column;gap:14px}
.cf-blk{padding:18px;border-radius:18px;background:#141416;border:1px solid rgba(255,255,255,.07)}
.cf-blk-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.cf-blk-h b{font-size:14px;font-weight:500;color:#f2f2f0}
.cf-blk-h span{font-size:12.5px;color:rgba(255,255,255,.45)}
.cf-blk-h .cf-link{margin-left:auto}
.cf-rows{display:flex;flex-direction:column;gap:8px}
.cf-row2{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:rgba(255,255,255,.78);font:400 14px/1.35 Inter,system-ui,sans-serif;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
.cf-row2:hover{border-color:rgba(255,255,255,.16)}
.cf-row2.is-on{border-color:#ff2d48;background:rgba(255,45,72,.05);color:#fff;box-shadow:0 0 0 1px #ff2d48}
.cf-radio{flex:none;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,.25)}
.cf-row2.is-on .cf-radio{border:0;background:#ff2d48 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/12px no-repeat}
.cf-lookrow{display:flex;align-items:center;gap:16px;width:100%;padding:8px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:inherit;font:inherit;text-align:left;cursor:pointer}
.cf-lookrow:hover{border-color:rgba(255,255,255,.16)}
.cf-lookrow img{width:180px;aspect-ratio:16/9;object-fit:cover;border-radius:10px}
.cf-lookrow span{display:flex;flex-direction:column;gap:4px}
.cf-lookrow b{font-size:15px;font-weight:500}
.cf-lookrow small{font-size:12.5px;color:rgba(255,255,255,.45)}
.cf-sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;max-height:460px;overflow:auto;margin-top:12px;padding:2px}
.cf-scard{position:relative;display:flex;flex-direction:column;gap:8px;padding:5px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:rgba(255,255,255,.75);font:400 12.5px Inter,system-ui,sans-serif;text-align:left;cursor:pointer}
.cf-scard img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px}
.cf-scard span{padding:0 4px 4px}
.cf-scard:hover{border-color:rgba(255,255,255,.18)}
.cf-scard.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48;color:#fff}
.cf-scard.is-on::after{content:"";position:absolute;top:11px;right:11px;width:20px;height:20px;border-radius:6px;background:#ff2d48 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/12px no-repeat}
.cf-opts3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cf-blk-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.cf-blk-3 .cf-blk-h{margin-bottom:8px}
.cf-seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.cf-seg button{height:30px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.55);font:400 12.5px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.cf-seg button:hover{color:#fff}
.cf-seg button.is-on{background:rgba(255,255,255,.12);color:#fff;font-weight:500}
.cf-seg-wrap{display:flex}
.cf-shape{display:flex;flex-wrap:wrap;gap:3px}
.cf-shape i{width:10px;height:22px;border-radius:3px;background:rgba(255,255,255,.12)}
.cf-shape i.is-anim{background:#ff2d48}
.cf-using{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px;font-size:0}
.cf-using span{height:26px;display:inline-flex;align-items:center;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:12px;color:rgba(255,255,255,.7)}
.cf-status{padding:18px 20px;border-radius:18px;background:#141416;border:1px solid rgba(255,255,255,.07);margin-bottom:14px}
.cf-status-t{display:flex;align-items:center;gap:16px;margin-bottom:14px}
.cf-status-t>b{font:600 30px/1 "SF Pro Display",-apple-system,Inter,sans-serif;color:#fff;font-variant-numeric:tabular-nums}
.cf-status-t>span{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.cf-status-t strong{font-size:14px;font-weight:500;color:#f2f2f0}
.cf-status-t small{font-size:12.5px;color:rgba(255,255,255,.5)}
.cf-status-t>em{font-style:normal;font-size:12.5px;color:rgba(255,255,255,.45);white-space:nowrap}
.cf-bar2{height:6px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
.cf-bar2 i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#ff2d48,#ff6b80);transition:width .5s ease}
.cf-run2{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
.cf-live2{min-height:340px;padding:16px;border-radius:18px;background:#141416;border:1px solid rgba(255,255,255,.07)}
.cf-live2 .cf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:12px}
.cf-live2 .cf-grid img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:9px}
.cf-live2 .cf-media{width:100%;border-radius:12px;margin:12px 0}
.cf-live2 video.cf-media{margin-top:0;background:#000}
.cf-live2 .cf-hint{font-size:13px;color:rgba(255,255,255,.55)}
.cf-live-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:260px;text-align:center}
.cf-live-empty p{font-size:13px;color:rgba(255,255,255,.4)}
.cf-dots{display:flex;gap:6px}
.cf-dots i{width:8px;height:8px;border-radius:50%;background:#ff2d48;opacity:.3;animation:cfDot 1.2s ease-in-out infinite}
.cf-dots i:nth-child(2){animation-delay:.2s}.cf-dots i:nth-child(3){animation-delay:.4s}
@keyframes cfDot{50%{opacity:1;transform:translateY(-3px)}}
.cf-pipe2{display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:18px;background:#141416;border:1px solid rgba(255,255,255,.07)}
.cf-p2{display:flex;align-items:center;gap:10px;padding:8px;border-radius:11px}
.cf-p2.is-now{background:rgba(255,255,255,.04)}
.cf-p2-ico{flex:none;display:grid;place-items:center;width:28px;height:28px}
.cf-p2-ico svg,.cf-p2-ico .ag-blob{width:26px;height:26px}
.cf-p2[data-state="idle"] .cf-p2-ico{opacity:.35}
.cf-p2-t{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.cf-p2-t b{font-size:13px;font-weight:500;color:#f2f2f0}
.cf-p2[data-state="idle"] .cf-p2-t b{color:rgba(255,255,255,.5)}
.cf-p2-t small{font-size:11.5px;color:rgba(255,255,255,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cf-p2>em{flex:none;display:inline-flex;align-items:center;gap:5px;font-style:normal;font-size:11px;color:rgba(255,255,255,.35)}
.cf-p2>em.is-done{color:rgba(255,255,255,.6)}
.cf-p2>em.is-work,.cf-p2>em.is-turn,.cf-p2>em.is-stuck{color:#ff6b80}
.cf-p2>em.is-work i{width:6px;height:6px;border-radius:50%;background:#ff2d48;animation:cfDot 1.2s ease-in-out infinite}
.cf-pipe2 .cf-link{align-self:flex-start;margin-top:6px}
@media (max-width:1100px){.cf-run2{grid-template-columns:minmax(0,1fr)}.cf-blk-3{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){.cf-opts3{grid-template-columns:minmax(0,1fr)}.cf-lookrow img{width:120px}}
/* Voice picker in Video settings */
.cf-vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;max-height:420px;overflow:auto;padding:2px}
.cf-vgrid.is-one{grid-template-columns:minmax(0,340px);max-height:none}
.cf-vcard{position:relative;display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);transition:border-color .15s,background .15s}
.cf-vcard:hover{border-color:rgba(255,255,255,.16)}
.cf-vcard.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48;background:rgba(255,45,72,.04)}
.cf-vpick{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:6px;border:0;border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
div.cf-vpick{cursor:default}
.cf-vorb{flex:none;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 32% 28%,hsl(var(--h) 100% 88%) 0%,hsl(var(--h) 85% 62%) 32%,hsl(var(--h) 80% 42%) 70%,hsl(var(--h) 75% 22%) 100%);box-shadow:inset -3px -5px 10px rgba(0,0,0,.35)}
.cf-vtxt{display:flex;flex-direction:column;gap:2px;min-width:0}
.cf-vtxt b{font-size:14px;font-weight:500;color:#f2f2f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cf-vtxt small{font-size:12px;color:rgba(255,255,255,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cf-vplay{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;cursor:pointer}
.cf-vplay svg{width:13px;height:13px}
.cf-vplay:hover{background:rgba(255,255,255,.1)}
.cf-vplay.is-playing{background:#ff2d48;border-color:#ff2d48}
/* Step rail (like a vertical stepper): content on the left, steps on the right with Back / Next */
.cf.cf-shell{max-width:1280px;display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:48px;align-items:start}
.cf-mainc{min-width:0}
.cf-rail{position:sticky;top:96px;display:flex;flex-direction:column;gap:28px;padding-top:6px}
.cf-rsteps{display:flex;flex-direction:column;gap:22px}
.cf-rstep{position:relative;display:flex;align-items:center;gap:14px;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.cf-rstep:disabled{cursor:not-allowed;opacity:.45}
.cf-rstep+.cf-rstep::before{content:"";position:absolute;left:19px;top:-22px;width:2px;height:22px;border-radius:2px;background:rgba(255,255,255,.1)}
.cf-rstep.is-lit+.cf-rstep.is-lit::before{background:linear-gradient(180deg,#ff2d48,#ff6b80)}
.cf-rdot{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);transition:background .2s,color .2s,box-shadow .2s}
.cf-rdot svg{width:17px;height:17px}
.cf-rstep:hover:not(:disabled) .cf-rdot{background:rgba(255,255,255,.09);color:#fff}
.cf-rstep.is-done .cf-rdot{background:rgba(255,45,72,.14);border-color:rgba(255,45,72,.4);color:#ff8a9a}
.cf-rstep.is-on .cf-rdot{background:linear-gradient(180deg,#ff4a63,#e11d3a);border-color:transparent;color:#fff;box-shadow:0 0 0 5px rgba(255,45,72,.14),0 10px 26px -6px rgba(255,45,72,.75)}
.cf-rtxt{display:flex;flex-direction:column;gap:2px;min-width:0}
.cf-rtxt small{font-size:12px;color:rgba(255,255,255,.4);font-weight:500}
.cf-rtxt b{font-size:15px;font-weight:550;color:rgba(255,255,255,.62);letter-spacing:-.01em}
.cf-rstep.is-on .cf-rtxt b,.cf-rstep.is-done .cf-rtxt b{color:#fff}
.cf-rnav{display:flex;gap:10px}
.cf-rback{flex:none;display:grid;place-items:center;width:48px;height:48px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;transition:background .15s}
.cf-rback svg{width:18px;height:18px}
.cf-rback:hover:not(:disabled){background:rgba(255,255,255,.1)}
.cf-rnext{flex:1;height:48px;border-radius:14px;border:0;background:linear-gradient(180deg,#ff4a63,#e11d3a);color:#fff;font:500 15px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 30px -8px rgba(255,45,72,.7),inset 0 1px 0 rgba(255,255,255,.25);transition:filter .15s,transform .15s}
.cf-rnext:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
.cf-rback:disabled,.cf-rnext:disabled{opacity:.35;cursor:not-allowed;box-shadow:none;transform:none}
.cf-shell .cf-cols{grid-template-columns:minmax(0,1fr) 300px}
@media (max-width:1100px){.cf.cf-shell{grid-template-columns:minmax(0,1fr);gap:22px}.cf-rail{position:static;order:-1;flex-direction:row;align-items:center;justify-content:space-between;gap:16px;padding:0}.cf-rsteps{flex-direction:row;gap:10px;overflow-x:auto}.cf-rstep+.cf-rstep::before{display:none}.cf-rstep .cf-rtxt small{display:none}.cf-rtxt b{font-size:13px;white-space:nowrap}.cf-rdot{width:32px;height:32px}.cf-rnav{flex:none}.cf-rback,.cf-rnext{height:40px}.cf-rback{width:40px}.cf-rnext{padding:0 18px}}
@media (max-width:640px){.cf-rstep:not(.is-on) .cf-rtxt{display:none}.cf-rnav{display:none}}
@media (max-width:640px){.cf-h1{font-size:27px}.cf-lead{font-size:14px}.cf-card{padding:16px;border-radius:20px}}
/* Script step: one calm box with tabs, length (with a Custom slider), upload and per-part AI rewrite */
.cf-hero::before{display:none}
.cf-hero{gap:16px;margin-bottom:30px}
.cf-banner{position:relative;width:100%;aspect-ratio:6.2/1;min-height:120px;max-height:210px;border-radius:16px;overflow:hidden;background:#141416;-webkit-mask-image:linear-gradient(180deg,#000 45%,transparent 100%);mask-image:linear-gradient(180deg,#000 45%,transparent 100%)}
.cf-banner img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 35%}
.cf-hero .cf-id{position:relative;margin-top:-58px;padding-left:22px}
.cf-hero .cf-ava{cursor:default;display:block}
.cf-hero .cf-ava img{box-shadow:0 0 0 4px #0b0b0c,0 16px 36px -12px rgba(0,0,0,.8)}
.cf-hero .cf-idt{padding-top:30px}
.cf-wbox{padding:16px;border-radius:18px;background:#141416;border:1px solid rgba(255,255,255,.07)}
.cf-wtabs{margin-bottom:14px}
.cf-wtext{display:block;width:100%;box-sizing:border-box;min-height:120px;resize:vertical;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.22);color:#ededec;font:400 14px/1.6 Inter,system-ui,sans-serif;transition:border-color .15s}
.cf-wtext.is-tall{min-height:300px}
.cf-wtext:focus{outline:none;border-color:rgba(255,255,255,.22)}
.cf-wtext::placeholder{color:rgba(255,255,255,.3)}
.cf-wfoot{margin-top:14px}
.cf-wlen{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cf-wlab{font-size:12.5px;color:rgba(255,255,255,.45);min-width:46px}
.cf-slide{display:flex;align-items:center;gap:14px;margin:14px 0 0 58px;max-width:460px}
.cf-slide b{flex:none;min-width:52px;font-size:13px;font-weight:500;color:#ededec;text-align:right;font-variant-numeric:tabular-nums}
.cf-slide input{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;background:linear-gradient(90deg,#ff2d48 var(--p,0%),rgba(255,255,255,.1) var(--p,0%));outline:none;cursor:pointer}
.cf-slide input::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:0;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.cf-slide input::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:0}
.cf-slide input:focus-visible::-webkit-slider-thumb{outline:2px solid #fff;outline-offset:2px}
.cf-slide-ends{display:flex;justify-content:space-between;max-width:394px;margin:6px 0 0 58px;font-size:11.5px;color:rgba(255,255,255,.32)}
.cf-wgo{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)}
.cf-wgo .cf-btn svg{width:14px;height:14px}
.cf-wbusy{display:flex;align-items:center;gap:14px;padding:18px 6px}
.cf-wbusy span:last-child{display:flex;flex-direction:column;gap:3px}
.cf-wbusy b{font-size:14px;font-weight:500;color:#ededec}
.cf-wbusy small{font-size:12.5px;color:rgba(255,255,255,.45)}
.cf-wfile{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:12.5px;color:rgba(255,255,255,.5)}
.cf-wfile svg{width:15px;height:15px;flex:none}
.cf-wfile b{font-weight:500;color:rgba(255,255,255,.8)}
.cf-wfile .cf-link{margin-left:auto}
.cf-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:230px;padding:24px;border-radius:14px;border:1.5px dashed rgba(255,255,255,.12);background:rgba(0,0,0,.18);text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
.cf-drop:hover,.cf-drop.is-over{border-color:rgba(255,45,72,.55);background:rgba(255,45,72,.03)}
.cf-drop.is-busy{cursor:progress}
.cf-drop-ico{display:grid;place-items:center;width:42px;height:42px;margin-bottom:6px;border-radius:12px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.7)}
.cf-drop-ico svg{width:20px;height:20px}
.cf-drop b{font-size:13.5px;font-weight:500;color:#ededec}
.cf-drop small{font-size:12px;color:rgba(255,255,255,.4)}
/* Script parts: word count and a quiet "Rewrite with AI" on each */
.cf-part-h{align-items:center}
.cf-pwords{margin-left:auto;font-size:11.5px;color:rgba(255,255,255,.3);font-variant-numeric:tabular-nums}
.cf-prw{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:8px;border:1px solid transparent;background:transparent;color:rgba(255,255,255,.45);font:400 12px Inter,system-ui,sans-serif;cursor:pointer;transition:color .15s,background .15s,border-color .15s}
.cf-prw svg{width:12px;height:12px}
.cf-prw:hover,.cf-prw.is-on{color:#fff;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)}
.cf-prw.is-on svg,.cf-prw:hover svg{color:#ff2d48}
.cf-pbusy{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,.5)}
.cf-part.is-busy .cf-ptext{opacity:.45}
.cf-part.is-rw{border-color:rgba(255,255,255,.14)}
.cf-rwbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
.cf-rwq{display:flex;gap:6px;flex-wrap:wrap}
.cf-rwq button{height:28px;padding:0 11px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.65);font:400 12.5px Inter,system-ui,sans-serif;cursor:pointer}
.cf-rwq button:hover{color:#fff;background:rgba(255,255,255,.08)}
.cf-rwin{flex:1;min-width:220px;display:flex;align-items:center;gap:6px;height:32px;padding:0 4px 0 11px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25)}
.cf-rwin:focus-within{border-color:rgba(255,255,255,.22)}
.cf-rwin input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#ededec;font:400 12.5px Inter,system-ui,sans-serif}
.cf-rwin input::placeholder{color:rgba(255,255,255,.3)}
.cf-rwin input:focus,.cf-rwin input:focus-visible{outline:none;box-shadow:none;border:0}
.cf-rwsend{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;border:0;background:#ff2d48;color:#fff;cursor:pointer}
.cf-rwsend svg{width:12px;height:12px}
.cf-part .cf-err{margin-top:8px}
/* Video settings: every block says what it is for */
.cf-blk .cf-blk-h{margin-bottom:4px}
.cf-blk-d{margin:0 0 12px;font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.42)}
.cf-opts3.is-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.cf-frame{flex-direction:row;align-items:center;gap:12px}
.cf-opt .cf-ftxt{display:flex;flex-direction:column;gap:2px;min-width:0;font-size:inherit;color:#ededec}
.cf-opt .cf-ftxt>span{font-size:12px;color:rgba(255,255,255,.45)}
.cf-fshape{flex:none;width:30px;height:17px;border-radius:3px;border:1.5px solid rgba(255,255,255,.45)}
.cf-fshape.is-tall{width:13px;height:22px;margin:0 8px}
.cf-frame.is-on .cf-fshape{border-color:#ff2d48}
.cf-caps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cf-cap{position:relative;display:flex;flex-direction:column;gap:8px;padding:6px 6px 9px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:#141416;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:border-color .15s}
.cf-cap:hover{border-color:rgba(255,255,255,.18)}
.cf-cap.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48}
.cf-cap-demo{display:grid;place-items:center;height:58px;border-radius:8px;background:linear-gradient(160deg,#2a2a30,#151518);font-size:17px;font-weight:700;letter-spacing:.01em;white-space:nowrap;overflow:hidden}
.cf-cap-demo em{font-style:normal}
.cf-cap-n{padding:0 4px;font-size:12.5px;color:rgba(255,255,255,.6)}
.cf-cap.is-on .cf-cap-n{color:#fff}
@media (max-width:760px){.cf-caps{grid-template-columns:repeat(2,minmax(0,1fr))}.cf-opts3.is-2{grid-template-columns:minmax(0,1fr)}.cf-slide,.cf-slide-ends{margin-left:0}.cf-hero .cf-id{margin-top:-40px;padding-left:12px}.cf-hero .cf-idt{padding-top:24px}}

/* Header like the reference: the channel's banner fills the top of the page, dim, and fades into it */
.cf.cf-shell{position:relative}
.cf-shell>.cf-mainc,.cf-shell>.cf-rail{position:relative;z-index:1}
.cf-bg{position:absolute;z-index:0;top:-60px;left:calc(50% - 50vw);width:100vw;height:540px;overflow:hidden;pointer-events:none;-webkit-mask-image:linear-gradient(180deg,#000 30%,transparent 100%);mask-image:linear-gradient(180deg,#000 30%,transparent 100%)}
.cf-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 40%;opacity:0;transition:opacity .6s ease}
.cf-bg img.is-in{opacity:.42}
.cf-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,11,12,.55),rgba(11,11,12,.1) 55%,rgba(11,11,12,.35))}
.cf-bg.is-busy{background:linear-gradient(100deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.035) 50%,rgba(255,255,255,0) 70%) 0 0/200% 100%;animation:cfBgWait 2.4s linear infinite}
@keyframes cfBgWait{to{background-position:-200% 0}}
.cf-hero{gap:30px;margin:0 0 40px}
.cf-hero .cf-id{margin-top:0;padding-left:0;gap:26px}
.cf-hero .cf-ava{width:120px;height:120px}
.cf-hero .cf-ava img{box-shadow:0 0 0 1px rgba(255,255,255,.12),0 18px 40px -14px rgba(0,0,0,.85)}
.cf-hero .cf-idt{padding-top:0;gap:12px}
.cf-hero .cf-name{padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.1)}
.cf-hero .cf-name h1{font-size:40px}
@media (max-width:760px){.cf-hero .cf-ava{width:76px;height:76px}.cf-hero .cf-name h1{font-size:26px}.cf-hero .cf-id{gap:16px}.cf-bg{height:400px}}

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
  let mode = 'write'     // script: 'write' | 'paste' | 'upload'
  let customLen = false  // the Custom length slider is open
  let fileName = ''      // the script file the user uploaded
  let fileBusy = false
  let rwOpen = -1        // the script part whose AI rewrite bar is open
  let rwNote = ''
  const rwBusy = {}      // part index → what it is being rewritten as
  let topic = ''
  let paste = ''
  let secDraft = {}
  const secTimers = {}
  /** Write one edited section to the script (fvState) and forget the draft. */
  const saveSec = (key) => {
    clearTimeout(secTimers[key])
    if (!(key in secDraft)) return
    const text = secDraft[key]
    delete secDraft[key]
    call('fvStudioEditSection', Number(key), text)
  }
  /** Save every pending edit, e.g. before leaving the script step or making the video. */
  const flushSecs = () => { Object.keys(secDraft).forEach(saveSec) }
  const err = {}
  let audio = null
  let playing = ''
  let started = false
  let showStyles = false
  let showVoices = false
  let styleGroup = ''

  function viewNow(st) {
    if (view) return view
    if (st?.renderUrl || st?.running || st?.media?.voiceover || started) return 'run'
    if (st?.script) return 'settings'
    return profiles().length > 1 && !activeId() ? 'brand' : 'script'
  }
  const go = (v) => { flushSecs(); view = v; render(); try { root.scrollIntoView({ block: 'start' }) } catch (_) {} }
  /** A step is ticked only when it is really done, and "Make it" opens only once there is a script or a run. */
  const STEP_ICONS = {
    brand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/><circle cx="16" cy="16" r="2.2"/></svg>',
    run: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" opacity=".7"/></svg>',
  }
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  /** The step rail on the right: one row per step, the current one lit, done ones ticked, with Back and Next under it.
   *  A step is ticked only when it is really done, and "Make it" opens only once there is a script or a run. */
  const stepper = (v, st) => {
    const order = [['brand', 'Choose channel'], ['script', 'Write the script'], ['settings', 'Video settings'], ['run', 'Make the video']]
    const running = !!(st?.renderUrl || st?.running || st?.media?.voiceover || started)
    const done = { brand: profiles().length > 0, script: !!st?.script, settings: running, run: !!st?.renderUrl }
    const open = { brand: true, script: true, settings: true, run: running || !!st?.script }
    const at = order.findIndex(([k]) => k === v)
    const prev = at > 0 ? order[at - 1][0] : ''
    // Next moves on only once this step is done: a script must exist before Video settings.
    const ready = { brand: true, script: !!st?.script, settings: false, run: false }
    const next = ready[v] && at < order.length - 1 ? order[at + 1][0] : ''
    return `<aside class="cf-rail" aria-label="Steps"><nav class="cf-rsteps">${order.map(([k, l], i) => {
      const on = k === v
      const tick = !on && done[k]
      const lit = i < at || on
      return `<button type="button" class="cf-rstep${on ? ' is-on' : tick ? ' is-done' : ''}${lit ? ' is-lit' : ''}" data-cf-go="${k}"${open[k] ? '' : ' disabled title="Write or paste the script first"'}${on ? ' aria-current="step"' : ''}><span class="cf-rdot">${tick ? CHECK : STEP_ICONS[k]}</span><span class="cf-rtxt"><small>Step ${i + 1}</small><b>${l}</b></span></button>`
    }).join('')}</nav>
    <div class="cf-rnav"><button type="button" class="cf-rback" ${prev ? `data-cf-go="${prev}"` : 'disabled'} aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>${v === 'settings' && st?.script ? '<button type="button" class="cf-rnext" data-cf-generate>Generate video</button>' : v === 'run' ? '' : `<button type="button" class="cf-rnext" ${next ? `data-cf-go="${next}"` : 'disabled title="Write or paste the script first"'}>Next</button>`}</div></aside>`
  }
  /** The header every step shares: breadcrumb, the channel's look as an avatar, the video's name, and what it's for. */
  function headHtml(st, v) {
    const p = profiles().find((x) => x.id === activeId())
    const style = visualStyleById(p?.visualStyle) || visualStyleById(st?.visual?.style) || VISUAL_STYLES[0]
    const img = styleSample(style.id, p?.genre)
    const ava = p?.avatarUrl || img
    const name = st?.script?.title || (v !== 'brand' && topic.trim()) || 'New video'
    const sub = p ? ['Channel', p.name + (p.niche ? ' · ' + p.niche : '')] : ['Look', style.name + ' · no channel picked']
    const pencil = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
    return `<header class="cf-hero">
      <div class="cf-crumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg><span>Studio</span><i>/</i><b>New video</b></div>
      <div class="cf-id">
        <span class="cf-ava"><img src="${esc(ava)}" alt=""></span>
        <div class="cf-idt">
          <div class="cf-name"><h1 title="${esc(name)}">${esc(name)}</h1>${st?.script || v === 'brand' ? '' : `<button type="button" class="cf-pen" data-cf-go="script" aria-label="Edit">${pencil}</button>`}</div>
          <div class="cf-idsub"><small>${esc(sub[0])}</small><span>${esc(sub[1])}</span></div>
        </div>
      </div>
    </header>`
  }
  /** The channel's own banner as a dim, full-width background behind the header (never its profile picture). */
  const bgSeen = new Set() // banners already shown once: no fade-in on every redraw
  function bgHtml() {
    const p = profiles().find((x) => x.id === activeId())
    if (!p) return ''
    if (!p.bannerUrl) call('fvEnsureChannelBanner', p.id)
    const busy = !p.bannerUrl && !!call('fvBannerBusy', p.id)
    return `<div class="cf-bg${p.bannerUrl ? ' has-img' : ''}${busy ? ' is-busy' : ''}" aria-hidden="true">${p.bannerUrl ? `<img src="${esc(p.bannerUrl)}" alt=""${bgSeen.has(p.bannerUrl) ? ' class="is-in"' : ` onload="this.classList.add('is-in')"`}>` : ''}</div>`
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
    return `<h2 class="cf-sec">Choose a channel</h2><p class="cf-sech">The channel sets the voice, visual style and captions for this video.</p>
      <div class="cf-brands">${list.map((p) => brandCard(p, st, { pick: true })).join('')}<button type="button" class="cf-new" data-cf-newbrand>+ New channel</button></div>
      ${list.length ? '' : '<p class="cf-hint" style="margin-top:14px">No channel yet. You can skip this and use the default look.</p>'}
      <div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-go="script">Continue to the script →</button></div>`
  }

  const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" opacity=".7"/></svg>'
  const RW = [['redo', 'Rewrite'], ['shorter', 'Shorter'], ['longer', 'Longer'], ['punchier', 'Punchier']]
  /** The longest custom length this plan allows, in minutes (3 to 30). */
  const maxMins = () => { const cap = Number(call('fvDurationCap')); return Math.max(3, Math.min(30, Number.isFinite(cap) ? Math.floor(cap / 60) : 30)) }
  /** Length: the preset chips, then Custom, which opens a 3 to 30 minute slider. */
  function lengthHtml(st) {
    const list = lengthChoices()
    const preset = list.some(([id]) => id === st?.durationId)
    const custom = customLen || (!!st?.durationId && !preset)
    const max = maxMins()
    const mins = Math.min(max, Math.max(3, Math.round(durationSeconds(st?.durationId) / 60)))
    return `<div class="cf-wlen"><span class="cf-wlab">Length</span><div class="cf-seg">${list.map(([id, l]) => `<button type="button" class="${!custom && st?.durationId === id ? 'is-on' : ''}" data-cf-len="${id}">${esc(l)}</button>`).join('')}<button type="button" class="${custom ? 'is-on' : ''}" data-cf-custom>Custom</button></div></div>
      ${custom ? `<div class="cf-slide"><input type="range" min="3" max="${max}" step="1" value="${mins}" id="cf-len-range" aria-label="Video length in minutes" style="--p:${((mins - 3) / Math.max(1, max - 3)) * 100}%"><b id="cf-len-val">${mins} min</b></div><div class="cf-slide-ends"><span>3 min</span><span>${max} min</span></div>` : ''}`
  }
  function scriptView(st) {
    const sc = st?.script
    const working = st?.busyScript || st?.crew?.script?.state === 'working'
    const voice = (st?.voices || []).find((v) => v.id === st?.voiceId)
    let main
    if (working) {
      main = `<div class="cf-wbox is-busy"><div class="cf-wbusy"><span class="cf-dots"><i></i><i></i><i></i></span><span><b>Writing your script</b><small>${esc(st?.crew?.script?.text || 'The Script agent is writing it now…')}</small></span></div></div>`
    } else if (sc) {
      const total = sc.sections.reduce((n, x, i) => n + words(secDraft[i] ?? x.text), 0)
      main = `<div class="cf-sbar"><span><b>${total.toLocaleString('en-US')}</b> words · about ${Math.max(1, Math.round(total / 150))} min · ${sc.sections.length} parts</span><span class="cf-sp"></span><span class="cf-hint">Click any line to edit it</span><button type="button" class="cf-link" data-cf-fresh>Start over</button></div>
        <div class="cf-parts">${sc.sections.map((x, i) => {
          const busy = rwBusy[i]
          const open = rwOpen === i && !busy
          return `<div class="cf-part${busy ? ' is-busy' : ''}${open ? ' is-rw' : ''}"><div class="cf-part-h"><em>${String(i + 1).padStart(2, '0')}</em><b>${esc(x.heading || 'Part ' + (i + 1))}</b><span class="cf-pwords">${words(secDraft[i] ?? x.text)} words</span>${busy ? `<span class="cf-pbusy"><span class="cf-dots"><i></i><i></i><i></i></span>${esc(busy)}…</span>` : `<button type="button" class="cf-prw${open ? ' is-on' : ''}" data-cf-rw="${i}" title="Rewrite this part with AI">${SPARK}<span>Rewrite with AI</span></button>`}</div>
            <textarea class="cf-ptext" rows="1" data-cf-sec="${i}" aria-label="${esc(x.heading || 'Part ' + (i + 1))}"${busy ? ' disabled' : ''}>${esc(secDraft[i] ?? x.text)}</textarea>
            ${open ? `<div class="cf-rwbar"><div class="cf-rwq">${RW.map(([k, l]) => `<button type="button" data-cf-rwgo="${k}">${l}</button>`).join('')}</div><div class="cf-rwin"><input type="text" id="cf-rw-note" placeholder="Or say what to change, e.g. add a surprising stat" value="${esc(rwNote)}" maxlength="400"><button type="button" class="cf-rwsend" data-cf-rwgo="note" aria-label="Rewrite">${SPARK}</button></div></div>` : ''}
            ${err['rw' + i] ? `<div class="cf-err">${esc(err['rw' + i] === 'SIGN_IN' ? 'Sign in to rewrite with AI.' : err['rw' + i])}</div>` : ''}</div>`
        }).join('')}</div>
        ${errHtml('script')}`
    } else {
      const tabs = [['write', 'Write with AI'], ['paste', 'Paste script'], ['upload', 'Upload file']]
      let inner
      if (mode === 'write') {
        inner = `<textarea class="cf-wtext" id="cf-topic" placeholder="What's the video about? e.g. The rise and fall of Blockbuster">${esc(topic)}</textarea>
          <div class="cf-wfoot">${lengthHtml(st)}</div>
          ${errHtml('script')}
          <div class="cf-wgo"><span class="cf-hint">The Script agent writes it in parts. You can edit or rewrite any part after.</span><button type="button" class="cf-btn is-primary" data-cf-write>${SPARK}Write the script</button></div>`
      } else if (mode === 'paste') {
        inner = `${fileName ? `<div class="cf-wfile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg><span>From <b>${esc(fileName)}</b>. Check it, then continue.</span><button type="button" class="cf-link" data-cf-unfile>Remove</button></div>` : ''}
          <textarea class="cf-wtext is-tall" id="cf-paste" placeholder="Paste your narration. Blank lines split it into parts.">${esc(paste)}</textarea>
          ${errHtml('script')}
          <div class="cf-wgo"><span class="cf-hint" id="cf-paste-count">${words(paste).toLocaleString('en-US')} words · about ${Math.max(1, Math.round(words(paste) / 150))} min</span><button type="button" class="cf-btn is-primary" data-cf-paste${words(paste) ? '' : ' disabled'}>Use this script →</button></div>`
      } else {
        inner = `<label class="cf-drop${fileBusy ? ' is-busy' : ''}" id="cf-drop"><input type="file" id="cf-file" accept=".pdf,.txt,.md,.markdown,.rtf,application/pdf,text/plain,text/markdown" hidden>
            <span class="cf-drop-ico">${fileBusy ? '<span class="cf-dots"><i></i><i></i><i></i></span>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>'}</span>
            <b>${fileBusy ? 'Reading the file…' : 'Drop your script here, or click to choose'}</b>
            <small>PDF, TXT or Markdown, up to 20 MB. Blank lines split it into parts.</small></label>
          ${errHtml('script')}`
      }
      main = `<div class="cf-wbox"><div class="cf-seg cf-wtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${mode === k}" class="${mode === k ? 'is-on' : ''}" data-cf-mode="${k}">${l}</button>`).join('')}</div>${inner}</div>`
    }
    return `<h2 class="cf-sec">${sc ? 'Your script' : 'Write the script'}</h2><p class="cf-sech">${sc ? 'Read it through, edit any line or rewrite a part with AI, then go to Video settings.' : 'Length, scene count and cost are worked out from the script, so it comes first.'}${voice ? ` Narrator: ${esc(voice.name)}.` : ''}</p>
      ${main}`
  }

  /** Plain text from an uploaded script: PDFs go through pdf.js (loaded on first use), the rest are read as text. */
  let pdfLib = null
  const loadPdfJs = () => pdfLib || (pdfLib = new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib)
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      const lib = window.pdfjsLib
      if (!lib) return reject(new Error('The PDF reader did not load.'))
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(lib)
    }
    s.onerror = () => { pdfLib = null; reject(new Error('The PDF reader did not load. Check your connection.')) }
    document.head.appendChild(s)
  }))
  async function fileText(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB.')
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
    if (!isPdf) {
      let text = await file.text()
      if (/\.rtf$/i.test(file.name)) text = text.replace(/\\par[d]?/g, '\n').replace(/\{\\[^{}]*\}|\\[a-z]+-?\d* ?|[{}]/gi, '')
      return text
    }
    const lib = await loadPdfJs()
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const tc = await page.getTextContent()
      // Rebuild lines from the text runs: a new line when the run says so or the baseline moves,
      // and a blank line (a new part) when the gap is bigger than a normal line.
      let out = ''
      let lastY = null
      let lastH = 12
      for (const it of tc.items) {
        const y = it.transform ? it.transform[5] : null
        if (lastY != null && y != null && Math.abs(y - lastY) > 1) {
          const want = Math.abs(y - lastY) > lastH * 1.8 ? '\n\n' : '\n'
          // pdf.js may already have ended the line (hasEOL); only add what is missing.
          if (!out.endsWith(want)) out += out.endsWith('\n') ? '\n' : want
        }
        out += it.str
        if (it.hasEOL && !out.endsWith('\n')) out += '\n'
        if (y != null) lastY = y
        if (it.height) lastH = it.height
      }
      pages.push(out)
    }
    return pages.join('\n\n')
  }
  /** Tidy text from a file: drop page numbers, join lines broken mid-sentence, keep blank lines as part breaks. */
  const tidyScript = (raw) => String(raw || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.split('\n').map((l) => l.trim()).filter((l) => l && !/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l)).join(' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
  async function takeFile(file) {
    if (!file || fileBusy) return
    fileBusy = true
    err.script = ''
    render()
    try {
      const text = tidyScript(await fileText(file))
      if (words(text) < 20) throw new Error(/\.pdf$/i.test(file.name) ? 'No text found in that PDF. If it is a scan, paste the script instead.' : 'That file has almost no text in it.')
      paste = text
      fileName = file.name
      mode = 'paste'
    } catch (e) {
      err.script = e?.message || 'Could not read that file.'
    }
    fileBusy = false
    render()
  }
  async function rewritePart(i, how) {
    if (rwBusy[i]) return
    flushSecs()
    const note = how === 'note' ? (root.querySelector('#cf-rw-note')?.value || rwNote).trim() : ''
    if (how === 'note' && !note) { root.querySelector('#cf-rw-note')?.focus(); return }
    rwBusy[i] = { redo: 'Rewriting', shorter: 'Making it shorter', longer: 'Making it longer', punchier: 'Making it punchier', note: 'Rewriting' }[how] || 'Rewriting'
    err['rw' + i] = ''
    rwOpen = -1
    rwNote = ''
    render()
    const out = await call('fvStudioRewriteSection', i, how === 'note' ? 'redo' : how, note)
    delete rwBusy[i]
    err['rw' + i] = typeof out === 'string' ? out : ''
    if (err['rw' + i] === 'SIGN_IN') { try { window.vidsoOpenSignup?.() } catch (_) {} }
    render()
  }

  const VC_HUES = [44, 28, 12, 352, 330, 300, 272, 248, 218, 196, 172, 36]
  const voiceHueOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return VC_HUES[h % VC_HUES.length] }
  const capWord = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase())
  const voiceTags = (x) => [x.gender, x.accent].filter(Boolean).map(capWord).join(' · ')
  function voiceCard(x, on, pick) {
    const name = x.name || String(x.label || '').split(' · ')[0] || 'Voice'
    const tags = voiceTags(x) || x.desc || ''
    const play = x.preview ? `<button type="button" class="cf-vplay${playing === x.preview ? ' is-playing' : ''}" data-cf-play="${esc(x.preview)}" aria-label="Play ${esc(name)}">${playing === x.preview ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>'}</button>` : ''
    const body = `<span class="cf-vorb" style="--h:${voiceHueOf(x.id + name)}" aria-hidden="true"></span><span class="cf-vtxt"><b>${esc(name)}</b><small>${esc(tags)}</small></span>`
    return `<div class="cf-vcard${on ? ' is-on' : ''}">${pick ? `<button type="button" class="cf-vpick" data-cf-voice="${esc(x.id)}" aria-pressed="${on}" title="${esc(x.desc || name)}">${body}</button>` : `<div class="cf-vpick">${body}</div>`}${play}</div>`
  }
  function settingsView(st, proj) {
    const sc = st?.script
    if (!sc) return `<h2 class="cf-sec">Video settings</h2><p class="cf-sech">Write or paste the script first.</p><div class="cf-row"><button type="button" class="cf-btn is-primary" data-cf-go="script">Go to the script</button></div>`
    const v = st?.visual || {}
    const secs = Math.round((Number(sc.words || 0) / 150) * 60) || durationSeconds(st?.durationId)
    const plan = (() => { try { return videoPlan({ seconds: secs, pace: v.pace || 'normal', mode: v.mode || 'cheapest', text: sc.sections.map((x) => x.text).join(' ') }) } catch (_) { return null } })()
    const style = visualStyleById(v.style) || VISUAL_STYLES[0]
    const looks = call('fvCaptionLooks') || []
    // Title options come back as { title, ... } objects; show their text.
    const opts = [...new Set([sc.title, ...(sc.options || []).map((o) => (typeof o === 'string' ? o : o?.title || ''))].map((t) => String(t || '').trim()).filter(Boolean))]
    const groups = [...new Set(VISUAL_STYLES.map((x) => x.group))]
    const voices = st?.voices || []
    const voice = voices.find((x) => x.id === st?.voiceId) || null
    const seg = (list, attr, cur) => `<div class="cf-seg">${list.map(([id, label]) => `<button type="button" class="${id === cur ? 'is-on' : ''}" ${attr}="${esc(id)}">${esc(label)}</button>`).join('')}</div>`
    return `<h2 class="cf-sec">Video settings</h2><p class="cf-sech">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} long · ${Number(sc.words || 0).toLocaleString('en-US')} words. Nothing is made until you press Generate video.</p>
      <div class="cf-stack">
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Title</b></div><p class="cf-blk-d">The video's name on YouTube. These were written from your script; pick one, you can change it later.</p>
          <div class="cf-rows">${opts.map((x) => `<button type="button" class="cf-row2${x === sc.title ? ' is-on' : ''}" data-cf-title="${esc(x)}"><i class="cf-radio" aria-hidden="true"></i><span>${esc(x)}</span></button>`).join('')}</div>
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Look</b><span>${esc(style.name)} · ${esc(style.group)}</span><button type="button" class="cf-link" data-cf-styles>${showStyles ? 'Done' : 'Change style'}</button></div><p class="cf-blk-d">The art style every scene is drawn in.</p>
          ${showStyles
            ? `<div class="cf-seg cf-seg-wrap"><button type="button" class="${styleGroup ? '' : 'is-on'}" data-cf-sgroup="">All</button>${groups.map((g) => `<button type="button" class="${styleGroup === g ? 'is-on' : ''}" data-cf-sgroup="${esc(g)}">${esc(g)}</button>`).join('')}</div>
              <div class="cf-sgrid">${VISUAL_STYLES.filter((x) => !styleGroup || x.group === styleGroup).map((x) => `<button type="button" class="cf-scard${x.id === style.id ? ' is-on' : ''}" data-cf-style="${esc(x.id)}"><img src="${esc(styleSample(x.id))}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>`
            : `<button type="button" class="cf-lookrow" data-cf-styles><img src="${esc(styleSample(style.id))}" alt=""><span><b>${esc(style.name)}</b><small>Every scene is drawn in this style. ${VISUAL_STYLES.length} to choose from.</small></span></button>`}
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Voice</b><span>${esc(voice ? voiceTags(voice) || 'Narrator' : (voices.length ? 'Pick a narrator' : 'Voices load once you sign in'))}</span>${voices.length ? `<button type="button" class="cf-link" data-cf-voices>${showVoices ? 'Done' : 'Change voice'}</button>` : ''}</div><p class="cf-blk-d">The narrator who reads your script out loud. Press play to hear a voice.</p>
          ${showVoices
            ? `<div class="cf-vgrid">${voices.map((x) => voiceCard(x, x.id === st?.voiceId, true)).join('')}</div>`
            : voice ? `<div class="cf-vgrid is-one">${voiceCard(voice, true, false)}</div>` : voices.length ? '<button type="button" class="cf-lookrow" data-cf-voices><span><b>Choose a narrator</b><small>Press play on any voice to hear it first.</small></span></button>' : ''}
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Animation</b></div><p class="cf-blk-d">How many scenes move instead of staying still. Moving scenes cost more credits and take longer to make.</p>
          <div class="cf-opts3">${VISUAL_MODES.map((m) => `<button type="button" class="cf-opt${(v.mode || 'cheapest') === m.id ? ' is-on' : ''}" data-cf-vmode="${esc(m.id)}"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></button>`).join('')}</div>
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Scene pace</b></div><p class="cf-blk-d">How long each picture stays on screen before cutting to the next. Faster pace means more scenes.</p>
          <div class="cf-opts3 is-2">${SCENE_PACES.map((x) => `<button type="button" class="cf-opt${(v.pace || 'normal') === x.id ? ' is-on' : ''}" data-cf-pace="${esc(x.id)}"><b>${esc(x.name)}</b><span>A new scene every ${x.seconds}s</span></button>`).join('')}</div>
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Frame</b></div><p class="cf-blk-d">The shape of the video, set by where people will watch it.</p>
          <div class="cf-opts3 is-2">${[['16:9', 'Wide · 16:9', 'YouTube videos, fills a computer or TV screen'], ['9:16', 'Tall · 9:16', 'Shorts, fills a phone screen']].map(([id, name, note]) => `<button type="button" class="cf-opt cf-frame${(st?.aspect || '16:9') === id ? ' is-on' : ''}" data-cf-aspect="${id}"><i class="cf-fshape${id === '9:16' ? ' is-tall' : ''}" aria-hidden="true"></i><span class="cf-ftxt"><b>${name}</b><span>${note}</span></span></button>`).join('')}</div>
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>Captions</b></div><p class="cf-blk-d">The words shown on screen as the narrator speaks. The coloured word is the one being said.</p>
          <div class="cf-caps">${(Array.isArray(looks) ? looks : []).map((l) => `<button type="button" class="cf-cap${st?.captionLook === l.id ? ' is-on' : ''}" data-cf-cap="${esc(l.id)}"><span class="cf-cap-demo" style="font-family:'${esc(l.font)}',Inter,sans-serif;color:${esc(l.base || '#fff')};${l.stroke ? '-webkit-text-stroke:1px #000;paint-order:stroke fill;' : ''}${l.shadow ? 'text-shadow:0 2px 6px rgba(0,0,0,.8);' : ''}"><span>${l.upper ? 'THE' : 'the'} <em style="color:${esc(l.hl || l.color || '#fff')}">${l.upper ? 'REAL' : 'real'}</em> ${l.upper ? 'STORY' : 'story'}</span></span><span class="cf-cap-n">${esc(l.name)}</span></button>`).join('')}</div>
        </section>
        <section class="cf-blk">
          <div class="cf-blk-h"><b>What gets made</b>${plan ? `<span>${plan.count} scenes · ${plan.animated} animated · about ${esc(makeTimeLabel(plan.minutes).replace('about ', ''))} to make</span>` : '<span>Worked out once the script is in.</span>'}</div><p class="cf-blk-d">One bar per scene, in order. Red bars are the scenes that move.</p>
          ${plan ? `<div class="cf-shape" aria-hidden="true">${plan.scenes.slice(0, 80).map((x) => `<i class="${x.animate ? 'is-anim' : ''}"></i>`).join('')}</div>` : ''}
        </section>
        ${errHtml('generate')}
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
        ${imgs.length ? `<div class="cf-grid">${imgs.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : '<div class="cf-live-empty"><span class="cf-dots"><i></i><i></i><i></i></span><p>Scenes show up here as they are drawn.</p></div>'}
        ${st?.media?.voiceover ? `<audio class="cf-media" controls preload="none" src="${esc(st.media.voiceover)}"></audio>` : ''}${errHtml('generate')}`
    }
    const statusLine = st?.renderUrl ? 'Your video is ready to download or upload.' : pl.turn ? 'Your turn: check the timeline, then render.' : (now.text || 'Working…')
    const pill = (r) => r.state === 'done' ? '<em class="is-done">Done</em>' : r.state === 'working' ? '<em class="is-work"><i></i>Working</em>' : r.state === 'turn' ? '<em class="is-turn">Your turn</em>' : r.state === 'stuck' ? '<em class="is-stuck">Needs you</em>' : '<em>Up next</em>'
    return `<h2 class="cf-sec">${st?.renderUrl ? 'Your video is ready' : 'Making your video'}</h2>
      <div class="cf-using">${p ? `<span>${esc(p.name)}</span>` : ''}${style ? `<span>${esc(style.name)}</span>` : ''}${voice ? `<span>${esc(voice.name)}</span>` : ''}</div>
      <div class="cf-status">
        <div class="cf-status-t"><b>${pl.percent}%</b><span><strong>${esc(now.name)}</strong><small>${esc(statusLine)}</small></span><em>${st?.renderUrl ? 'Done' : mins ? 'About ' + mins + ' min so far' : 'Just started'}</em></div>
        <div class="cf-bar2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pl.percent}" aria-label="Video progress"><i style="width:${pl.percent}%"></i></div>
      </div>
      <div class="cf-run2">
        <section class="cf-live2">${live}</section>
        <aside class="cf-pipe2">${pl.rows.map((r) => `<div class="cf-p2${r === now ? ' is-now' : ''}" data-state="${esc(r.state)}"><span class="cf-p2-ico">${agentSvg(r.agent)}</span><span class="cf-p2-t"><b>${esc(r.name)}</b><small>${esc(r.state === 'idle' ? '' : r.text)}</small></span>${pill(r)}</div>`).join('')}
          <button type="button" class="cf-link" data-cf-new>Start a new video</button></aside>
      </div>`
  }

  function render() {
    const st = state()
    const proj = project()
    const v = viewNow(st)
    const act = document.activeElement
    const focusId = act && root.contains(act) ? (act.id || (act.dataset.cfSec != null ? 'sec:' + act.dataset.cfSec : '')) : ''
    const sel = focusId && 'selectionStart' in act ? [act.selectionStart, act.selectionEnd] : null
    const body = v === 'brand' ? brandView(st) : v === 'script' ? scriptView(st) : v === 'settings' ? settingsView(st, proj) : runView(st, proj)
    const bgImg = () => { const im = root.querySelector('.cf-bg img'); if (im) { const src = im.getAttribute('src'); if (im.complete && im.naturalWidth) bgSeen.add(src); else im.addEventListener('load', () => bgSeen.add(src), { once: true }) } }
    root.innerHTML = `<div class="cf cf-shell">${bgHtml()}<div class="cf-mainc">${headHtml(st, v)}${body}</div>${stepper(v, st)}</div>`
    bgImg()
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
    on('[data-cf-len]', (b) => { customLen = false; call('fvSetDuration', b.dataset.cfLen); render() })
    on('[data-cf-custom]', () => {
      customLen = true
      const st = state()
      if (lengthChoices().some(([id]) => id === st?.durationId)) call('fvApplyCustomDuration', Math.min(maxMins(), Math.max(3, Math.round(durationSeconds(st?.durationId) / 60))))
      render()
    })
    const range = $('#cf-len-range')
    if (range) {
      const show = () => {
        const n = Number(range.value)
        range.style.setProperty('--p', ((n - 3) / Math.max(1, Number(range.max) - 3)) * 100 + '%')
        const lab = $('#cf-len-val'); if (lab) lab.textContent = n + ' min'
      }
      range.addEventListener('input', () => { show(); call('fvApplyCustomDuration', range.value) })
      range.addEventListener('change', () => { call('fvApplyCustomDuration', range.value) })
    }
    const fileIn = $('#cf-file')
    fileIn?.addEventListener('change', () => takeFile(fileIn.files?.[0]))
    const drop = $('#cf-drop')
    if (drop) {
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over') })
      drop.addEventListener('dragleave', () => drop.classList.remove('is-over'))
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); takeFile(e.dataTransfer?.files?.[0]) })
    }
    on('[data-cf-unfile]', () => { fileName = ''; paste = ''; mode = 'upload'; render() })
    on('[data-cf-rw]', (b) => { const i = Number(b.dataset.cfRw); rwOpen = rwOpen === i ? -1 : i; rwNote = ''; render(); if (rwOpen === i) root.querySelector('#cf-rw-note')?.focus() })
    on('[data-cf-rwgo]', (b) => rewritePart(rwOpen, b.dataset.cfRwgo))
    const note = $('#cf-rw-note')
    note?.addEventListener('input', () => { rwNote = note.value })
    note?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rewritePart(rwOpen, 'note') } else if (e.key === 'Escape') { rwOpen = -1; render() } })
    $('#cf-topic')?.addEventListener('input', (e) => { topic = e.target.value })
    $('#cf-paste')?.addEventListener('input', (e) => {
      paste = e.target.value
      const lab = $('#cf-paste-count'); if (lab) lab.textContent = `${words(paste).toLocaleString('en-US')} words · about ${Math.max(1, Math.round(words(paste) / 150))} min`
      const btn = $('[data-cf-paste]'); if (btn) btn.disabled = !words(paste)
    })
    on('[data-cf-write]', () => run('script', () => call('fvStudioWriteScript', topic)))
    on('[data-cf-paste]', async () => { if (await run('script', () => call('fvStudioUseScript', { text: paste, title: (fileName ? fileName.replace(/\.[a-z0-9]+$/i, '') : paste.trim().split('\n')[0]).slice(0, 80) }))) { fileName = ''; go('settings') } })
    on('[data-cf-fresh]', () => { call('fvAgentsReset'); secDraft = {}; rwOpen = -1; started = false; go('script') })
    const fit = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }
    root.querySelectorAll('.cf-ptext').forEach((t) => { fit(t); t.addEventListener('input', () => fit(t)) })
    root.querySelectorAll('[data-cf-sec]').forEach((t) => {
      // Save as you type (after a short pause), not only on blur: a re-draw while the box
      // had focus used to skip the change event and the edit was lost.
      t.addEventListener('input', () => {
        const i = t.dataset.cfSec
        secDraft[i] = t.value
        clearTimeout(secTimers[i])
        secTimers[i] = setTimeout(() => saveSec(i), 400)
      })
      t.addEventListener('change', () => saveSec(t.dataset.cfSec))
    })
    on('[data-cf-voices]', () => { showVoices = !showVoices; if (showVoices) call('fvAgentsLoadVoices'); render() })
    on('[data-cf-voice]', (b) => { call('fvAgentsVoice', b.dataset.cfVoice); showVoices = false; render() })
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
      flushSecs()
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
    if (v === 'script' || v === 'settings') call('fvAgentsLoadVoices')
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
  window.addEventListener('vidso:channel-banner', onChange)
  root.style.overflowX = 'clip'
  render()
  return { render }
}
