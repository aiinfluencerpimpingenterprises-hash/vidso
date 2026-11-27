/**
 * Brand: the channel setup page. A list of brand profiles, and an editor laid
 * out as five steps (Channel, Visual style, Voice, Captions, Video) with a live preview
 * of the look on the right. Each step is hosted by the agent that uses it.
 *
 * Profiles are stored by the Agents app (window.agentsChat.profiles) so the
 * chat, Studio and this page always share one list. Captions are the
 * renderer's real settings (px at 1080p), so the preview matches the MP4.
 */

import { agentSvg, lengthOptions } from './agents-chat.js'
import { VISUAL_STYLES, STYLE_GROUPS, DEFAULT_STYLE, VISUAL_MODES, SCENE_PACES, visualStyleById, styleSample } from './visual-styles.js'
import { ANGLES, normalizeProfile } from './channel-kit.js'
import { NICHES, nicheById } from './niches.js'
import { FACELESS_CAPTION_FONT_GROUPS, ensureCaptionGoogleFonts } from './caption-fonts.js'
import { GENRES, genreById } from './onboarding.js'

export const BRAND_STEPS = [
  { id: 'genre', agent: 'manager', name: 'Channel', title: 'What kind of channel is it?', line: 'Pick a genre and tell me what the channel is about. I set the style, script angle and captions to match, and can name the channel for you.' },
  { id: 'style', agent: 'agent', name: 'Visual style', title: 'Choose a visual style', line: 'I draw every scene of your videos in this style, so the channel looks like one series.' },
  { id: 'voice', agent: 'voice', name: 'Voice', title: 'Pick the voice for your videos', line: 'Press play to hear each narrator before you choose.' },
  { id: 'captions', agent: 'editor', name: 'Captions', title: 'Style your captions', line: 'I burn these into the video exactly as the preview shows.' },
  { id: 'video', agent: 'manager', name: 'Video', title: 'Video defaults', line: 'What every new video on this channel starts from. You can still change them per video.' },
]

const LENGTHS = [['long_180', '3 min'], ['long_300', '5 min'], ['long_600', '10 min'], ['long_900', '15 min'], ['long_1200', '20 min'], ['long_1800', '30 min']]
/** The plan's longest video in seconds (Infinity when there is no cap). */
const lenCap = () => { try { const c = Number(window.fvDurationCap?.()); return Number.isFinite(c) && c > 0 ? c : Infinity } catch (_) { return Infinity } }
const SWATCHES = ['#ffffff', '#ffd400', '#00e5ff', '#ff3b30', '#4ade80', '#ff4fa3', '#000000']
const SAMPLE = ['Here’s', 'how', 'captions', 'look']

/** A preset look (from the dashboard) as a full caption style in the renderer's terms. */
export function styleFromLook(look, fonts = []) {
  if (!look) return null
  const f = fonts.find((x) => x.label.toLowerCase() === String(look.font || '').toLowerCase())
  return {
    font: f?.css || `'${look.font}', sans-serif`,
    size: Number(look.size) || 64,
    color: look.base || '#ffffff',
    highlight: look.hl || '#ffffff',
    stroke: !!look.stroke,
    strokeColor: look.stroke || '#000000',
    strokeWidth: Number(look.strokeW) || 0,
    shadow: !!look.shadow,
  }
}

/** Short text for a caption style, e.g. "Arial Black · 64px · outline". */
export function captionSummary(c, fonts = []) {
  if (!c) return 'Default'
  const f = fonts.find((x) => x.css === c.font)
  return [f?.label || String(c.font || '').split(',')[0].replace(/['"]/g, ''), `${Number(c.size) || 64}px`, c.stroke ? 'outline' : '', c.shadow ? 'shadow' : ''].filter(Boolean).join(' · ')
}

const CSS = `
.bs{--bs-ink:#f2f2f1;--bs-mute:rgba(242,242,241,.58);--bs-line:rgba(255,255,255,.08);--bs-card:#1c1c1d;max-width:1240px;margin:0 auto;padding:6px 4px 40px;color:var(--bs-ink);font-family:Inter,system-ui,-apple-system,sans-serif}
.bs h1{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(1.9rem,3.2vw,2.6rem);letter-spacing:-.01em}
.bs-sub{margin:6px 0 0;color:var(--bs-mute);max-width:640px;line-height:1.5}
.bs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 22px}
.bs-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;padding:0 16px;border-radius:999px;border:1px solid var(--bs-line);background:#232324;color:var(--bs-ink);font:inherit;font-size:.86rem;font-weight:500;cursor:pointer;white-space:nowrap}
.bs-btn:hover{background:#2b2b2c}
.bs-btn.is-primary{background:#fff;color:#161616;border-color:#fff;font-weight:500}
.bs-btn.is-primary:hover{background:#ececec}
.bs-btn.is-danger:hover{background:#3a1d1d;border-color:#5a2a2a}
.bs-btn:focus-visible,.bs-chip:focus-visible,.bs-style:focus-visible,.bs-voice:focus-visible,.bs-look:focus-visible,.bs-mode:focus-visible,.bs-step:focus-visible,.bs-sw:focus-visible{outline:2px solid #fff;outline-offset:2px}
.bs-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.bs-card{display:flex;flex-direction:column;border-radius:20px;background:var(--bs-card);border:1px solid var(--bs-line);overflow:hidden;min-width:0}
.bs-card.is-on{border-color:rgba(255,255,255,.4)}
.bs-card-body{display:flex;flex-direction:column;gap:10px;padding:14px 16px 16px}
.bs-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.bs-card-top b{font-size:1.05rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bs-badge{flex:0 0 auto;font-size:.7rem;font-weight:500;padding:3px 9px;border-radius:999px;background:rgba(74,222,128,.14);color:#4ade80}
.bs-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:.84rem}
.bs-rows span{color:var(--bs-mute)}
.bs-rows b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bs-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.bs-new{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:280px;border-radius:20px;border:1px dashed rgba(255,255,255,.18);background:transparent;color:var(--bs-ink);font:inherit;cursor:pointer;text-align:center;padding:20px}
.bs-new:hover{background:#171718}
.bs-new .bs-crew{display:flex;gap:4px}
.bs-new .ag-blob{width:30px;height:30px}
.bs-frame{position:relative;aspect-ratio:16/9;background:#000;overflow:hidden;container-type:size}
.bs-frame.is-tall{aspect-ratio:9/16;height:min(560px,62vh);width:auto;margin:0 auto}
.bs-frame img{width:100%;height:100%;object-fit:cover;display:block}
.bs-cap{position:absolute;left:6%;right:6%;bottom:12%;text-align:center;line-height:1.15;font-weight:600;text-wrap:balance}
.bs-cap .hot{color:var(--hl)}
.bs-top{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;margin:2px 0 18px}
.bs-top-left{display:flex;align-items:center;gap:10px;min-width:0}
.bs-name{min-width:0;flex:1;max-width:340px;background:transparent;border:1px solid transparent;border-radius:10px;color:var(--bs-ink);font:inherit;font-size:1.15rem;font-weight:500;padding:6px 8px}
.bs-name:hover{border-color:var(--bs-line)}
.bs-name:focus{outline:none;border-color:rgba(255,255,255,.4);background:#1c1c1d}
/* The dashboard paints every focused field with a red glow; Brand uses white like the rest of the new UI. */
#panel-brand .bs input:focus,#panel-brand .bs select:focus,#panel-brand .bs textarea:focus{box-shadow:none!important;border-color:rgba(255,255,255,.4)!important;outline:none!important}
#panel-brand .bs input:focus-visible,#panel-brand .bs select:focus-visible{outline:2px solid rgba(255,255,255,.7)!important;outline-offset:1px}
.bs-steps{display:flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:#1c1c1d;border:1px solid var(--bs-line)}
.bs-step{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px 0 6px;border-radius:999px;border:0;background:transparent;color:var(--bs-mute);font:inherit;font-size:.86rem;font-weight:500;cursor:pointer;white-space:nowrap}
.bs-step i{font-style:normal;display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#2a2a2b;color:var(--bs-ink);font-size:.74rem;font-weight:500}
.bs-step.is-done i{background:rgba(74,222,128,.18);color:#4ade80}
.bs-step.is-on{background:#fff;color:#161616}
.bs-step.is-on i{background:#161616;color:#fff}
.bs-top-right{display:flex;justify-content:flex-end;gap:8px}
.bs-edit{display:grid;grid-template-columns:minmax(320px,440px) minmax(0,1fr);gap:22px;align-items:start}
.bs-panel{display:flex;flex-direction:column;gap:14px;min-width:0}
.bs-panel h2{margin:0;font-size:1.35rem;font-weight:500;letter-spacing:-.01em}
.bs-host{display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:var(--bs-mute);line-height:1.45}
.bs-host .ag-blob{width:30px;height:30px;flex:0 0 30px}
.bs-label{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--bs-mute)}
.bs-field{display:flex;flex-direction:column;gap:8px}
.bs-input,.bs-select{width:100%;box-sizing:border-box;height:40px;background:#232324;border:1px solid #333;border-radius:12px;color:var(--bs-ink);font:inherit;font-size:.9rem;padding:0 12px}
.bs-input:focus,.bs-select:focus{outline:2px solid rgba(255,255,255,.7);outline-offset:1px;box-shadow:none!important;border-color:#555!important}
.bs-chips{display:flex;flex-wrap:wrap;gap:6px}
.bs-chip{display:inline-flex;align-items:center;height:32px;padding:0 13px;border-radius:999px;border:1px solid var(--bs-line);background:#1f1f20;color:var(--bs-ink);font:inherit;font-size:.82rem;cursor:pointer}
.bs-chip.is-on{background:#fff;color:#161616;border-color:#fff}
.bs-chip.is-locked{opacity:.55;border-style:dashed}
.bs-genres{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.bs-genre{position:relative;display:block;padding:0;border-radius:14px;border:2px solid transparent;overflow:hidden;background:#232324;cursor:pointer;aspect-ratio:16/10}
.bs-genre img{width:100%;height:100%;object-fit:cover;display:block;opacity:.72;transition:opacity .15s}
.bs-genre span{position:absolute;left:10px;bottom:8px;font-size:.84rem;font-weight:500;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.bs-genre:hover img,.bs-genre.is-on img{opacity:1}
.bs-genre.is-on{border-color:#fff}
.bs-genre:focus-visible{outline:2px solid #fff;outline-offset:2px}
.bs-about{height:auto;padding:10px 12px;resize:vertical;min-height:64px;line-height:1.45}
.bs-namerow{display:flex;gap:8px}
.bs-namerow .bs-input{flex:1;min-width:0}
.bs-sug{font-style:normal;font-size:.66rem;font-weight:500;margin-left:4px;padding:1px 6px;border-radius:999px;background:rgba(74,222,128,.15);color:#4ade80}
.bs-styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:min(520px,52vh);overflow-y:auto;padding:2px;overscroll-behavior:contain}
.bs-style{display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:14px;border:2px solid transparent;background:#232324;color:var(--bs-ink);font:inherit;font-size:.8rem;text-align:left;cursor:pointer;min-width:0}
.bs-style img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:#111;display:block}
.bs-style.is-on{border-color:#fff}
.bs-style[hidden]{display:none}
.bs-voices{display:flex;flex-direction:column;gap:6px;max-height:min(520px,52vh);overflow-y:auto;padding:2px;overscroll-behavior:contain}
.bs-voice{display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;border:2px solid transparent;background:#232324;color:var(--bs-ink);font:inherit;text-align:left;cursor:pointer;min-width:0}
.bs-voice.is-on{border-color:#fff}
.bs-voice[hidden]{display:none}
.bs-voice-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.bs-voice-txt b{font-size:.9rem;font-weight:500}
.bs-voice-txt span{font-size:.78rem;color:var(--bs-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bs-tag{flex:0 0 auto;font-size:.68rem;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.07);color:var(--bs-mute);text-transform:capitalize}
.bs-play{flex:0 0 34px;width:34px;height:34px;border-radius:50%;border:0;background:#fff;color:#161616;display:grid;place-items:center;cursor:pointer}
.bs-play:focus-visible{outline:2px solid #fff;outline-offset:2px}
.bs-looks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.bs-look{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:12px;border:2px solid transparent;background:#232324;color:var(--bs-ink);font:inherit;font-size:.74rem;cursor:pointer;text-align:left}
.bs-look > span:first-child{display:block;text-align:center;line-height:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#3a3f4a,#22252b);font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden}
.bs-look.is-on{border-color:#fff}
.bs-range{display:flex;align-items:center;gap:10px}
.bs-range input{flex:1;accent-color:#fff}
.bs-range input[type=color]{flex:0 0 34px;width:34px;height:34px;border:0;padding:0;background:none;cursor:pointer}
.bs-range output{min-width:46px;text-align:right;font-size:.84rem;color:var(--bs-mute)}
.bs-sws{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bs-sw{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.18);cursor:pointer;padding:0}
.bs-sw.is-on{border-color:#fff;box-shadow:0 0 0 2px #161616 inset}
.bs-sws input[type=color]{width:34px;height:34px;border:0;background:none;padding:0;cursor:pointer}
.bs-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.88rem}
.bs-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.bs-mode{display:flex;flex-direction:column;gap:3px;padding:10px;border-radius:12px;border:2px solid var(--bs-line);background:#1f1f20;color:var(--bs-ink);font:inherit;text-align:left;cursor:pointer}
.bs-mode b{font-size:.86rem}
.bs-mode span{font-size:.74rem;color:var(--bs-mute)}
.bs-mode.is-on{border-color:#fff}
.bs-nav{display:flex;justify-content:space-between;gap:8px;padding-top:6px}
.bs-preview{position:sticky;top:0;display:flex;flex-direction:column;gap:12px;padding:12px;border-radius:22px;background:#161617;border:1px solid var(--bs-line)}
.bs-preview .bs-frame{border-radius:14px}
.bs-pv-rows{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px 14px;padding:4px 6px;font-size:.88rem}
.bs-pv-rows span{color:var(--bs-mute);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}
.bs-pv-rows b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bs-note{font-size:.8rem;color:var(--bs-mute);line-height:1.45}
.bs-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#fff;color:#161616;font-size:.88rem;font-weight:500;padding:10px 18px;border-radius:999px;z-index:500;box-shadow:0 10px 30px rgba(0,0,0,.4)}
@media (max-width:1060px){.bs-edit{grid-template-columns:minmax(0,1fr)}.bs-preview{position:static;order:-1}.bs-top{grid-template-columns:minmax(0,1fr) auto}.bs-steps{grid-column:1/-1;grid-row:2;justify-self:start;overflow-x:auto;max-width:100%}}
@media (max-width:640px){.bs{padding:4px 0 28px}.bs-step{padding:0 10px 0 4px}.bs-step span{display:none}.bs-step.is-on span{display:inline}.bs-looks{grid-template-columns:repeat(2,minmax(0,1fr))}.bs-modes{grid-template-columns:minmax(0,1fr)}}
/* ── New look (Nov 2026): same type, sizes and blue accent as the Agents page ── */
.bs{--bs-ink:#ededec;--bs-mute:#8d8d8b;--bs-line:rgba(255,255,255,.08);--bs-card:#1a1a1b;max-width:1080px}
.bs h1{font:500 26px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.015em}
.bs-sub{font-size:13.5px}
.bs-btn{height:34px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:500}
.bs-btn.is-primary{background:#c41530;border-color:#ff2d48;color:#fff;font-weight:500}
.bs-btn.is-primary:hover{background:#e0203c;color:#fff}
.bs-card{border-radius:16px}
.bs-card.is-on{border-color:rgba(255,45,72,.6)}
.bs-badge{background:rgba(255,45,72,.14)!important;color:#ff9aa7!important}
.bs-rows{font-size:12.5px}
.bs-new{border-radius:16px}
.bs-name{font-size:16px}
.bs-steps{border-radius:10px;padding:3px}
.bs-step{height:30px;border-radius:7px;font-size:12.5px;padding:0 11px 0 5px}
.bs-step i{width:20px;height:20px;font-size:10.5px}
.bs-step.is-on{background:#3b3b3c;color:#ededec}
.bs-host{font-size:13px}
.bs-label{font-size:12px;letter-spacing:0;text-transform:none}
.bs-input,.bs-select{height:36px;border-radius:9px;font-size:13.5px;background:#141415;border-color:rgba(255,255,255,.1)}
.bs-chip{height:30px;padding:0 11px;border-radius:8px;font-size:12.5px}
.bs-chip.is-on{font-weight:500}
.bs-style,.bs-voice,.bs-look,.bs-mode{border-radius:11px}
.bs-style.is-on,.bs-voice.is-on,.bs-look.is-on,.bs-mode.is-on{border-color:#ff2d48!important}
.bs-play{background:#c41530;color:#fff;box-shadow:0 0 0 1px #ff2d48}
.bs-preview{border-radius:16px}
.bs-pv-rows span{letter-spacing:0;text-transform:none;font-size:11.5px}
.bs-note{font-size:12.5px}
.bs h2{font:500 20px/1.25 Inter,system-ui,sans-serif;letter-spacing:-.01em}
/* Channel list: compact cards, several per row */
.bs-head{margin:4px 0 18px;align-items:center}
.bs h1{font-size:22px}
.bs-sub{font-size:13px;max-width:560px}
.bs-list{grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.bs-card{border-radius:12px;transition:border-color .15s}
.bs-card:hover{border-color:rgba(255,255,255,.16)}
.bs-card .bs-frame{aspect-ratio:16/9}
.bs-card-body{gap:8px;padding:10px 12px 12px}
.bs-card-top b{font-size:13.5px}
.bs-badge{font-size:10.5px;padding:2px 7px}
.bs-rows{gap:3px 10px;font-size:12px}
.bs-card-actions{gap:6px;margin-top:2px}
.bs-card-actions .bs-btn{height:28px;padding:0 10px;font-size:12.5px;border-radius:7px}
.bs-card-actions .bs-btn.is-danger{border-color:transparent;background:transparent;color:var(--bs-mute);margin-left:auto}
.bs-card-actions .bs-btn.is-danger:hover{color:#ff8a8a;background:rgba(255,80,80,.08)}
.bs-new{min-height:0;border-radius:12px;padding:28px 16px}

/* ── 2026 refresh: glass cards, bigger type, red glow actions ── */
.bs{--bs-line:rgba(255,255,255,.08);--bs-card:#141416;max-width:1120px}
.bs h1{font:550 34px/1.12 Inter,system-ui,sans-serif;letter-spacing:-.04em;color:#fff}
.bs-sub{font-size:15px;color:rgba(255,255,255,.55);max-width:600px}
.bs-head{margin:6px 0 26px}
.bs h2{font:550 22px/1.25 Inter,system-ui,sans-serif;letter-spacing:-.025em}
.bs-list{gap:16px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.bs-card,.bs-new{border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05);transition:border-color .2s,transform .2s cubic-bezier(.16,1,.3,1)}
.bs-card:hover,.bs-new:hover{border-color:rgba(255,255,255,.16);transform:translateY(-2px)}
.bs-new{border-style:dashed;padding:34px 18px}
.bs-card.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48,0 16px 40px -14px rgba(255,45,72,.45)}
.bs-card-body{padding:12px 14px 14px}
.bs-card-top b{font-size:15px;font-weight:550;letter-spacing:-.01em}
.bs-badge{border-radius:999px}
.bs-btn{height:38px;padding:0 16px;border-radius:12px;font-size:13.5px;font-weight:500;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);transition:background .15s,filter .15s}
.bs-btn:hover{background:rgba(255,255,255,.11)}
.bs-btn.is-primary{background:linear-gradient(180deg,#ff4a63,#e11d3a);border:0;color:#fff;font-weight:500;box-shadow:0 10px 28px -8px rgba(255,45,72,.7),inset 0 1px 0 rgba(255,255,255,.25)}
.bs-btn.is-primary:hover{background:linear-gradient(180deg,#ff4a63,#e11d3a);filter:brightness(1.08)}
.bs-card-actions .bs-btn{height:32px;border-radius:10px}
.bs-steps{border-radius:13px;padding:4px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
.bs-step{height:34px;border-radius:10px;font-size:13px}
.bs-step.is-on{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.bs-label{font-size:13px;font-weight:500;color:rgba(255,255,255,.55)}
.bs-input,.bs-select{height:42px;border-radius:12px;font-size:14px;background:rgba(0,0,0,.25);border-color:rgba(255,255,255,.08)}
.bs-input:focus,.bs-select:focus{border-color:rgba(255,72,96,.5);box-shadow:0 0 0 4px rgba(255,45,72,.08);outline:none}
.bs-chip{height:34px;padding:0 14px;border-radius:999px;font-size:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.bs-chip.is-on{background:#fff;color:#111;border-color:#fff}
.bs-style,.bs-voice,.bs-look,.bs-mode{border-radius:16px}
.bs-preview{border-radius:22px}
.bs-note{font-size:13px;color:rgba(255,255,255,.45)}
/* Channels v2: cover cards */
.bs-v2 .bs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.bs-v2 .bs-head .bs-btn svg{width:16px;height:16px;margin-right:6px}
.bs-v2 .bs-head .bs-btn{display:inline-flex;align-items:center}
.bs-grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.bs-cc{position:relative;display:flex;flex-direction:column;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);box-shadow:0 30px 70px -34px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.05);transition:transform .25s cubic-bezier(.16,1,.3,1),border-color .2s,box-shadow .2s}
.bs-cc:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.16)}
.bs-cc.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48,0 24px 60px -24px rgba(255,45,72,.55)}
.bs-cc-cover{position:relative;aspect-ratio:16/9;overflow:hidden;background:#111}
.bs-cc-cover img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s cubic-bezier(.16,1,.3,1)}
.bs-cc:hover .bs-cc-cover img{transform:scale(1.04)}
.bs-cc-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(14,14,16,.95))}
.bs-cc-live{position:absolute;top:12px;left:12px;z-index:1;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border-radius:999px;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);color:#fff;font:500 12px Inter,system-ui,sans-serif}
.bs-cc-live i{width:7px;height:7px;border-radius:50%;background:#ff2d48;box-shadow:0 0 10px #ff2d48}
.bs-cc-body{display:flex;flex-direction:column;gap:16px;padding:0 18px 18px;margin-top:-26px;position:relative;z-index:1}
.bs-cc-id{display:flex;align-items:center;gap:12px;min-width:0}
.bs-cc-ava{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:radial-gradient(circle at 30% 25%,hsl(var(--h) 100% 80%),hsl(var(--h) 80% 52%) 45%,hsl(var(--h) 75% 30%));color:#fff;font:600 18px Inter,system-ui,sans-serif;box-shadow:0 0 0 3px #141416,0 10px 24px -8px hsl(var(--h) 80% 50% / .7)}
.bs-cc-id>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.bs-cc-id b{font:550 18px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.02em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-cc-id small{font-size:13px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-cc-tags{display:flex;flex-wrap:wrap;gap:6px}
.bs-cc-tags span{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.78);font:500 12px Inter,system-ui,sans-serif;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bs-cc-tags svg{flex:none;width:13px;height:13px;color:rgba(255,255,255,.5)}
.bs-cc-actions{display:flex;align-items:center;gap:8px}
.bs-cc-actions .bs-btn.is-primary{flex:1;height:40px}
.bs-cc-using{flex:1;font-size:13px;color:#ff8a9a;font-weight:500}
.bs-cc-ico{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.75);cursor:pointer;transition:background .15s,color .15s,border-color .15s}
.bs-cc-ico svg{width:16px;height:16px}
.bs-cc-ico:hover{background:rgba(255,255,255,.11);color:#fff}
.bs-cc-ico.is-danger:hover{background:rgba(255,60,80,.12);border-color:rgba(255,60,80,.35);color:#ff8a9a}
.bs-cc-new{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:300px;border-radius:24px;border:1.5px dashed rgba(255,255,255,.14);background:rgba(255,255,255,.015);color:#fff;font:inherit;cursor:pointer;transition:background .2s,border-color .2s}
.bs-cc-new:hover{background:rgba(255,45,72,.05);border-color:rgba(255,45,72,.45)}
.bs-cc-new span{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.06);margin-bottom:6px}
.bs-cc-new span svg{width:22px;height:22px}
.bs-cc-new b{font:550 16px Inter,system-ui,sans-serif}
.bs-cc-new small{font-size:13px;color:rgba(255,255,255,.45)}
.bs-empty2{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:64px 24px;border-radius:28px;background:radial-gradient(60% 80% at 50% 0%,rgba(255,45,72,.1),rgba(255,45,72,0) 70%),linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08)}
.bs-empty2 .bs-crew{display:flex;gap:8px;margin-bottom:6px}
.bs-empty2 .bs-crew .ag-blob,.bs-empty2 .bs-crew svg{width:44px;height:44px}
.bs-empty2 h2{margin:0;font:550 28px/1.15 Inter,system-ui,sans-serif;letter-spacing:-.03em;color:#fff}
.bs-empty2 p{margin:0;max-width:460px;font-size:15px;color:rgba(255,255,255,.55)}
.bs-btn.bs-btn-lg{height:46px;padding:0 24px;border-radius:14px;font-size:15px;margin-top:8px}
/* Channels v3: calmer cards. Covers are cropped past the white frame in the style images, so no strip shows on hover. */
.bs-grid2{grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
.bs-cc{border-radius:18px;background:#141416;border:1px solid rgba(255,255,255,.07);box-shadow:none;transition:border-color .2s}
.bs-cc:hover{transform:none;border-color:rgba(255,255,255,.15)}
.bs-cc.is-on{border-color:rgba(255,45,72,.7);box-shadow:0 0 0 1px rgba(255,45,72,.35)}
.bs-cc-cover{aspect-ratio:16/9;margin:6px 6px 0;border-radius:13px;background:#0e0e10}
.bs-cc-cover img{transform:scale(1.07);transition:none}
.bs-cc:hover .bs-cc-cover img{transform:scale(1.07)}
.bs-cc-cover::after{background:none}
.bs-cc-live{top:10px;left:10px;height:24px;padding:0 9px;font-size:11px;font-weight:500;background:rgba(0,0,0,.6)}
.bs-cc-body{margin-top:0;gap:12px;padding:14px 16px 16px}
.bs-cc-id{gap:10px}
.bs-cc-ava{width:34px;height:34px;border-radius:10px;font-size:14px;box-shadow:none}
.bs-cc-id b{font-size:15px;font-weight:500;letter-spacing:-.01em}
.bs-cc-id small{font-size:12px;color:rgba(255,255,255,.42)}
.bs-cc-tags{gap:5px}
.bs-cc-tags span{height:24px;padding:0 8px;font-size:11.5px;font-weight:400;color:rgba(255,255,255,.6);background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.05)}
.bs-cc-tags svg{width:12px;height:12px;color:rgba(255,255,255,.4)}
.bs-cc-actions .bs-btn.is-primary{flex:1;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);box-shadow:none;color:#ececea;font-size:13px;font-weight:500}
.bs-cc-actions .bs-btn.is-primary:hover{background:rgba(255,255,255,.1);filter:none}
.bs-cc-using{font-size:12.5px;font-weight:400;color:rgba(255,138,154,.9)}
.bs-cc-ico{width:34px;height:34px;border-radius:10px}
.bs-cc-ico svg{width:14px;height:14px}
.bs-cc-new{min-height:0;border-radius:18px;border-width:1px;background:transparent}
.bs-cc-new span{width:42px;height:42px;border-radius:12px}
.bs-cc-new b{font-size:14px;font-weight:500}
.bs-cc-new small{font-size:12px}
.bs-v2 .bs-head .bs-btn.is-primary{height:36px;border-radius:10px;font-size:13px;box-shadow:none}
@media (max-width:640px){.bs h1{font-size:27px}.bs-sub{font-size:14px}}
`

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const PLAY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'

export function initBrandStudio({ root } = {}) {
  if (!root) return null
  if (!document.getElementById('bs-style')) {
    const el = document.createElement('style')
    el.id = 'bs-style'
    el.textContent = CSS
    document.head.appendChild(el)
  }
  const FONTS = FACELESS_CAPTION_FONT_GROUPS.flatMap((g) => g.fonts.map((f) => ({ ...f, group: g.label })))
  // Load the caption fonts so the preview and the font menu show the real typefaces.
  try { ensureCaptionGoogleFonts() } catch (_) {}
  const api = () => window.agentsChat?.profiles || null
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  const looks = () => { try { return window.fvCaptionLooks?.() || [] } catch (_) { return [] } }

  let view = 'list' // 'list' | 'edit'
  let nameBusy = false
  let nameNote = ''
  let tab = 'style'
  let draft = null
  const visited = new Set()
  let audio = null
  let audioSrc = ''
  let hotTimer = 0
  let hot = 2

  function toast(text) {
    const t = document.createElement('div')
    t.className = 'bs-toast'
    t.setAttribute('role', 'status')
    t.textContent = text
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2200)
  }
  function play(src) {
    if (!src) return
    if (audio && audioSrc === src && !audio.paused) { audio.pause(); return }
    try { audio?.pause() } catch (_) {}
    audio = new Audio(src)
    audioSrc = src
    audio.play().catch(() => {})
  }

  /** Caption style of a profile: its own fine-tuned style, else its preset, else what renders now. */
  function capOf(p) {
    if (p?.captionStyle) return p.captionStyle
    const look = looks().find((l) => l.id === p?.captions)
    if (look) return styleFromLook(look, FONTS)
    try { const now = window.fvCaptionStyleNow?.(); if (now) return now } catch (_) {}
    return styleFromLook(looks()[0], FONTS)
  }
  function capName(p) {
    if (p?.captionStyle) return 'Custom · ' + captionSummary(p.captionStyle, FONTS)
    return looks().find((l) => l.id === p?.captions)?.name || 'Current style'
  }
  function capCss(c, px) {
    if (!c) return 'color:#fff'
    const size = Number(c.size) || 64
    const unit = (v) => px ? (v * px / size).toFixed(2) + 'px' : (v / 10.8).toFixed(3) + 'cqh'
    const parts = []
    if (c.stroke && Number(c.strokeWidth) > 0) {
      const w = unit(Number(c.strokeWidth))
      parts.push([[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => `calc(${x} * ${w}) calc(${y} * ${w}) 0 ${c.strokeColor || '#000'}`).join(','))
    }
    if (c.shadow || !(c.stroke && Number(c.strokeWidth) > 0)) parts.push('0 2px 8px rgba(0,0,0,.85), 0 0 2px #000')
    const f = FONTS.find((x) => x.css === c.font)
    return `font-family:${c.font};${f?.weight ? 'font-weight:' + f.weight + ';' : ''}font-size:${px ? px + 'px' : unit(size)};color:${c.color || '#fff'};text-shadow:${parts.join(',')};--hl:${c.highlight || '#fff'}`
  }
  const capLine = (h = hot) => SAMPLE.map((w, i) => i === h ? `<span class="hot">${esc(w)}</span>` : esc(w)).join(' ')
  function voiceOf(p) {
    return (state()?.voices || []).find((v) => v.id === p?.voiceId) || null
  }
  function frameHtml(p, tall) {
    const style = visualStyleById(p?.visualStyle) || visualStyleById(DEFAULT_STYLE)
    return `<div class="bs-frame${tall ? ' is-tall' : ''}"><img src="${esc(styleSample(style.id, p?.genre))}" alt="${esc(style.name)} sample" loading="lazy"><div class="bs-cap" data-bs-cap style="${capCss(capOf(p))}">${capLine()}</div></div>`
  }

  // ── list ──
  const CH_HUES = [352, 28, 44, 330, 272, 218, 186, 300, 12, 248]
  const chHue = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return CH_HUES[h % CH_HUES.length] }
  const ICO = {
    style: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>',
    voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 12h4M13 12h4M7 15h6"/></svg>',
    len: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  }
  function listHtml() {
    const a = api()
    const list = a?.list() || []
    const active = a?.activeId() || ''
    if (!list.length) {
      return `<div class="bs bs-v2">
        <header class="bs-head"><div><h1>Channels</h1><p class="bs-sub">Each channel has its own art style, narrator, captions and video defaults. Pick one and every new video follows it.</p></div></header>
        <div class="bs-empty2">
          <span class="bs-crew">${['agent', 'voice', 'editor', 'manager'].map((id) => agentSvg(id)).join('')}</span>
          <h2>Set up your first channel</h2>
          <p>Pick a genre, an art style, a narrator and a caption look. Your agents use it for every video. It takes four quick steps.</p>
          <button type="button" class="bs-btn is-primary bs-btn-lg" data-bs-new>Set up a channel</button>
        </div>
      </div>`
    }
    return `<div class="bs bs-v2">
      <header class="bs-head"><div><h1>Channels</h1><p class="bs-sub">Each channel has its own art style, narrator, captions and video defaults. Pick one and every new video follows it.</p></div>
        <button type="button" class="bs-btn is-primary" data-bs-new>${ICO.plus}New channel</button></header>
      <div class="bs-grid2">
        ${list.map((p) => {
          const style = visualStyleById(p.visualStyle) || visualStyleById(DEFAULT_STYLE)
          const v = voiceOf(p)
          const len = (LENGTHS.find(([id]) => id === p.durationId) || [])[1] || ''
          const niche = nicheById(p.niche)?.name || p.niche || genreById(p.genre)?.name || ''
          const on = p.id === active
          // Every channel gets its own banner; it is made once in the background.
          if (!p.bannerUrl) { try { window.fvEnsureChannelBanner?.(p.id) } catch (_) {} }
          const voice = v?.name || String(p.voiceLabel || '').split(' · ')[0] || 'Default voice'
          return `<article class="bs-cc${on ? ' is-on' : ''}" style="--h:${chHue(p.id + p.name)}">
            <div class="bs-cc-cover"><img src="${esc(p.bannerUrl || styleSample(style.id, p?.genre))}" alt="${esc(p.bannerUrl ? p.name + ' banner' : style.name + ' sample')}" loading="lazy">${on ? '<span class="bs-cc-live"><i></i>In use</span>' : ''}</div>
            <div class="bs-cc-body">
              <div class="bs-cc-id"><span class="bs-cc-ava" aria-hidden="true">${esc(String(p.name || '?').trim().slice(0, 1).toUpperCase())}</span><div><b>${esc(p.name)}</b>${niche ? `<small>${esc(niche)}</small>` : ''}</div></div>
              <div class="bs-cc-tags">
                <span title="Art style">${ICO.style}${esc(style.name)}</span>
                <span title="Narrator">${ICO.voice}${esc(voice)}</span>
                <span title="Captions">${ICO.cap}${esc(capName(p))}</span>
                ${len || p.aspect ? `<span title="Video">${ICO.len}${esc([len, p.aspect].filter(Boolean).join(' · '))}</span>` : ''}
              </div>
              <div class="bs-cc-actions">
                ${on ? '<span class="bs-cc-using">Your videos use this channel</span>' : `<button type="button" class="bs-btn is-primary" data-bs-use="${esc(p.id)}">Use channel</button>`}
                <button type="button" class="bs-cc-ico" data-bs-edit="${esc(p.id)}" aria-label="Edit ${esc(p.name)}" title="Edit">${ICO.edit}</button>
                <button type="button" class="bs-cc-ico is-danger" data-bs-del="${esc(p.id)}" aria-label="Delete ${esc(p.name)}" title="Delete">${ICO.del}</button>
              </div>
            </div>
          </article>`
        }).join('')}
        <button type="button" class="bs-cc-new" data-bs-new><span>${ICO.plus}</span><b>New channel</b><small>Another niche, style or voice</small></button>
      </div>
    </div>`
  }

  // ── editor ──
  function stepBody(st) {
    const d = draft
    const step = BRAND_STEPS.find((x) => x.id === tab)
    const host = `<div class="bs-host">${agentSvg(step.agent)}<span>${esc(step.line)}</span></div>`
    if (tab === 'genre') {
      const g = genreById(d.genre)
      return `<h2>${esc(step.title)}</h2>${host}
        <div class="bs-genres" role="radiogroup" aria-label="Genre">${GENRES.map((x) => `<button type="button" class="bs-genre${d.genre === x.id ? ' is-on' : ''}" role="radio" aria-checked="${d.genre === x.id}" data-bs-genre="${esc(x.id)}"><img src="https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/img/genres/${esc(x.id)}.jpg" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>
        <div class="bs-field"><label class="bs-label" for="bs-about">What is the channel about?</label><textarea class="bs-input bs-about" id="bs-about" data-bs-about rows="2" maxlength="300" placeholder="${esc(g?.placeholder || 'Channel about famous heists and scams')}">${esc(d.about || '')}</textarea></div>
        <div class="bs-field"><label class="bs-label" for="bs-chname">Channel name</label><div class="bs-namerow"><input class="bs-input" id="bs-chname" data-bs-chname maxlength="40" value="${esc(d.name || '')}" autocomplete="off"><button type="button" class="bs-btn" data-bs-suggest${nameBusy ? ' disabled' : ''}>${nameBusy ? 'Thinking…' : 'Suggest a name'}</button></div>${nameNote ? `<span class="bs-note">${esc(nameNote)}</span>` : ''}</div>
        ${g ? `<div class="bs-note">${esc(g.name)} sets the script angle to ${esc(g.angle === 'story' ? 'story-driven' : 'explainer')}, puts its styles first on the next step and suggests matching captions.</div>` : ''}`
    }
    if (tab === 'style') {
      const sug = genreById(d.genre)?.styles || []
      const ordered = [...sug.map((id) => visualStyleById(id)).filter(Boolean), ...VISUAL_STYLES.filter((x) => !sug.includes(x.id))]
      return `<h2>${esc(step.title)}</h2>${host}
        <input class="bs-input" type="search" data-bs-style-q placeholder="Search ${VISUAL_STYLES.length} styles" aria-label="Search styles" autocomplete="off">
        <div class="bs-chips" role="group" aria-label="Style groups"><button type="button" class="bs-chip is-on" data-bs-group="">All</button>${STYLE_GROUPS.map((g) => `<button type="button" class="bs-chip" data-bs-group="${esc(g)}">${esc(g)}</button>`).join('')}</div>
        <div class="bs-styles" data-bs-styles>${ordered.map((x) => `<button type="button" class="bs-style${x.id === d.visualStyle ? ' is-on' : ''}" data-bs-style="${esc(x.id)}" data-group="${esc(x.group)}" data-name="${esc((x.name + ' ' + x.group + ' ' + x.prompt).toLowerCase())}" aria-pressed="${x.id === d.visualStyle}"><img src="${esc(styleSample(x.id, d.genre))}" alt="" loading="lazy"><span>${esc(x.name)}${sug.includes(x.id) ? ' <em class="bs-sug">Suggested</em>' : ''}</span></button>`).join('')}</div>`
    }
    if (tab === 'voice') {
      const list = st?.voices || []
      const genders = [...new Set(list.map((v) => v.gender).filter(Boolean))]
      if (!list.length) return `<h2>${esc(step.title)}</h2>${host}<div class="bs-note">${esc(st?.voiceState === 'error' ? 'Voices load once you sign in. The profile keeps the default voice until then.' : 'Loading voices…')}</div>`
      return `<h2>${esc(step.title)}</h2>${host}
        <input class="bs-input" type="search" data-bs-voice-q placeholder="Search ${list.length} voices" aria-label="Search voices" autocomplete="off">
        ${genders.length > 1 ? `<div class="bs-chips" role="group" aria-label="Filter voices"><button type="button" class="bs-chip is-on" data-bs-gender="">All</button>${genders.map((g) => `<button type="button" class="bs-chip" data-bs-gender="${esc(g)}">${esc(g[0].toUpperCase() + g.slice(1))}</button>`).join('')}</div>` : ''}
        <div class="bs-voices" role="radiogroup" aria-label="Narrator voice">${list.map((v) => `
          <div class="bs-voice${v.id === d.voiceId ? ' is-on' : ''}" data-bs-voice-row data-name="${esc((v.name + ' ' + v.desc + ' ' + v.category + ' ' + v.accent).toLowerCase())}" data-gender="${esc(v.gender)}">
            ${v.preview ? `<button type="button" class="bs-play" data-bs-play="${esc(v.preview)}" aria-label="Play ${esc(v.name)}">${PLAY}</button>` : ''}
            <button type="button" class="bs-voice-txt" style="all:unset;display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;cursor:pointer" role="radio" aria-checked="${v.id === d.voiceId}" data-bs-voice="${esc(v.id)}"><b>${esc(v.name || v.label)}</b><span>${esc(v.desc || v.category || '')}</span></button>
            ${v.accent ? `<span class="bs-tag">${esc(v.accent)}</span>` : v.category ? `<span class="bs-tag">${esc(v.category)}</span>` : ''}
          </div>`).join('')}</div>`
    }
    if (tab === 'captions') {
      const c = capOf(d)
      const lk = looks()
      const presetOn = !d.captionStyle && d.captions
      const sizeV = Number(c.size) || 64
      return `<h2>${esc(step.title)}</h2>${host}
        <div class="bs-field"><span class="bs-label">Presets</span><div class="bs-looks">${lk.map((l) => { const s = styleFromLook(l, FONTS); return `<button type="button" class="bs-look${presetOn === l.id ? ' is-on' : ''}" data-bs-look="${esc(l.id)}" aria-pressed="${presetOn === l.id}"><span style="${capCss(s, 16)}">Your <span style="color:${esc(s.highlight)}">words</span></span>${esc(l.name)}</button>` }).join('')}</div></div>
        <div class="bs-field"><label class="bs-label" for="bs-font">Font</label><select class="bs-select" id="bs-font" data-bs-cap-font>${FACELESS_CAPTION_FONT_GROUPS.map((g) => `<optgroup label="${esc(g.label)}">${g.fonts.map((f) => `<option value="${esc(f.css)}"${f.css === c.font ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <div class="bs-field"><label class="bs-label" for="bs-size">Text size</label><div class="bs-range"><input type="range" id="bs-size" min="32" max="110" step="2" value="${sizeV}" data-bs-cap-size><output>${sizeV}px</output></div></div>
        <div class="bs-field"><span class="bs-label">Text colour</span><div class="bs-sws">${SWATCHES.map((col) => `<button type="button" class="bs-sw${String(c.color).toLowerCase() === col ? ' is-on' : ''}" style="background:${col}" data-bs-cap-color="${col}" aria-label="Text colour ${col}"></button>`).join('')}<input type="color" value="${esc(c.color || '#ffffff')}" data-bs-cap-color-in aria-label="Custom text colour"></div></div>
        <div class="bs-field"><span class="bs-label">Highlight the spoken word</span><div class="bs-sws">${SWATCHES.map((col) => `<button type="button" class="bs-sw${String(c.highlight).toLowerCase() === col ? ' is-on' : ''}" style="background:${col}" data-bs-cap-hl="${col}" aria-label="Highlight colour ${col}"></button>`).join('')}<input type="color" value="${esc(c.highlight || '#ffffff')}" data-bs-cap-hl-in aria-label="Custom highlight colour"></div></div>
        <div class="bs-field"><div class="bs-toggle"><span>Outline</span><div class="bs-chips"><button type="button" class="bs-chip${c.stroke ? ' is-on' : ''}" data-bs-cap-stroke="1" aria-pressed="${!!c.stroke}">On</button><button type="button" class="bs-chip${c.stroke ? '' : ' is-on'}" data-bs-cap-stroke="0" aria-pressed="${!c.stroke}">Off</button></div></div>
          ${c.stroke ? `<div class="bs-range"><input type="range" min="1" max="10" step="1" value="${Number(c.strokeWidth) || 3}" data-bs-cap-sw aria-label="Outline width"><output>${Number(c.strokeWidth) || 3}px</output><input type="color" value="${esc(c.strokeColor || '#000000')}" data-bs-cap-sc aria-label="Outline colour"></div>` : ''}</div>
        <div class="bs-field"><div class="bs-toggle"><span>Shadow</span><div class="bs-chips"><button type="button" class="bs-chip${c.shadow ? ' is-on' : ''}" data-bs-cap-shadow="1" aria-pressed="${!!c.shadow}">On</button><button type="button" class="bs-chip${c.shadow ? '' : ' is-on'}" data-bs-cap-shadow="0" aria-pressed="${!c.shadow}">Off</button></div></div></div>
        <div class="bs-note">Sizes are for a 1080p video, the same numbers the renderer uses. Captions sit near the bottom, about four words at a time.</div>`
    }
    // video defaults
    return `<h2>${esc(step.title)}</h2>${host}
      <div class="bs-field"><label class="bs-label" for="bs-niche">Niche</label><select class="bs-select" id="bs-niche" data-bs-niche><option value="">Not set</option>${NICHES.map((n) => `<option value="${esc(n.id)}"${d.niche === n.id ? ' selected' : ''}>${esc(n.name)}</option>`).join('')}${d.niche && !nicheById(d.niche) ? `<option value="${esc(d.niche)}" selected>${esc(d.niche)}</option>` : ''}</select></div>
      <div class="bs-field"><span class="bs-label">Length</span><div class="bs-chips">${lengthOptions(lenCap()).map((o) => o.locked
        ? `<button type="button" class="bs-chip is-locked" data-bs-len-locked title="Needs the ${esc(o.unlock)} plan">${esc(o.label)} · ${esc(o.unlock)}</button>`
        : `<button type="button" class="bs-chip${d.durationId === o.id ? ' is-on' : ''}" data-bs-set="durationId" data-v="${o.id}">${esc(o.label)}</button>`).join('')}</div></div>
      <div class="bs-field"><span class="bs-label">Frame</span><div class="bs-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([v, l]) => `<button type="button" class="bs-chip${d.aspect === v ? ' is-on' : ''}" data-bs-set="aspect" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="bs-field"><span class="bs-label">Script angle</span><div class="bs-chips">${ANGLES.map((a) => `<button type="button" class="bs-chip${d.angle === a.id ? ' is-on' : ''}" data-bs-set="angle" data-v="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div></div>
      <div class="bs-field"><span class="bs-label">Visual mode</span><div class="bs-modes">${VISUAL_MODES.map((m) => `<button type="button" class="bs-mode${d.visualMode === m.id ? ' is-on' : ''}" data-bs-set="visualMode" data-v="${esc(m.id)}" aria-pressed="${d.visualMode === m.id}"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></button>`).join('')}</div></div>
      <div class="bs-field"><span class="bs-label">Scene pace</span><div class="bs-chips">${SCENE_PACES.map((p) => `<button type="button" class="bs-chip${d.scenePace === p.id ? ' is-on' : ''}" data-bs-set="scenePace" data-v="${esc(p.id)}">${esc(p.name)} · every ${p.seconds}s</button>`).join('')}</div></div>`
  }

  function editHtml() {
    const st = state()
    const d = draft
    const i = BRAND_STEPS.findIndex((x) => x.id === tab)
    const prev = BRAND_STEPS[i - 1]
    const next = BRAND_STEPS[i + 1]
    const style = visualStyleById(d.visualStyle) || visualStyleById(DEFAULT_STYLE)
    const v = voiceOf(d)
    const exists = (api()?.list() || []).some((p) => p.id === d.id)
    return `<div class="bs">
      <div class="bs-top">
        <div class="bs-top-left"><button type="button" class="bs-btn" data-bs-back aria-label="Back to channels">← Channels</button><input class="bs-name" data-bs-name maxlength="40" value="${esc(d.name)}" aria-label="Profile name"></div>
        <nav class="bs-steps" aria-label="Profile steps">${BRAND_STEPS.map((x, k) => `<button type="button" class="bs-step${x.id === tab ? ' is-on' : ''}${x.id !== tab && visited.has(x.id) ? ' is-done' : ''}" data-bs-tab="${x.id}" aria-current="${x.id === tab ? 'step' : 'false'}"><i>${x.id !== tab && visited.has(x.id) ? '✓' : k + 1}</i><span>${esc(x.name)}</span></button>`).join('')}</nav>
        <div class="bs-top-right"><button type="button" class="bs-btn is-primary" data-bs-save>${exists ? 'Save channel' : 'Create channel'}</button></div>
      </div>
      <div class="bs-edit">
        <div class="bs-panel">
          ${stepBody(st)}
          <div class="bs-nav">${prev ? `<button type="button" class="bs-btn" data-bs-tab="${prev.id}">Back</button>` : '<span></span>'}${next ? `<button type="button" class="bs-btn is-primary" data-bs-tab="${next.id}">Next: ${esc(next.name)}</button>` : `<button type="button" class="bs-btn is-primary" data-bs-save>${exists ? 'Save profile' : 'Create profile'}</button>`}</div>
        </div>
        <aside class="bs-preview" aria-label="Preview">
          ${frameHtml(d, d.aspect === '9:16')}
          <div class="bs-pv-rows">
            <span>Style</span><b>${esc(style.name)}</b><i></i>
            <span>Voice</span><b>${esc(v?.name || 'Default voice')}</b>${v?.preview ? `<button type="button" class="bs-play" data-bs-play="${esc(v.preview)}" aria-label="Play ${esc(v.name)}">${PLAY}</button>` : '<i></i>'}
            <span>Captions</span><b>${esc(capName(d))}</b><i></i>
            <span>Video</span><b>${esc([(LENGTHS.find(([id]) => id === d.durationId) || [])[1], d.aspect, VISUAL_MODES.find((m) => m.id === d.visualMode)?.name].filter(Boolean).join(' · '))}</b><i></i>
          </div>
        </aside>
      </div>
    </div>`
  }

  function filterStyles() {
    const q = String(root.querySelector('[data-bs-style-q]')?.value || '').toLowerCase().split(/\s+/).filter(Boolean)
    const g = root.querySelector('[data-bs-group].is-on')?.dataset.bsGroup || ''
    root.querySelectorAll('[data-bs-style]').forEach((b) => { b.hidden = !((!g || b.dataset.group === g) && q.every((w) => b.dataset.name.includes(w))) })
  }
  function filterVoices() {
    const q = String(root.querySelector('[data-bs-voice-q]')?.value || '').toLowerCase().split(/\s+/).filter(Boolean)
    const g = root.querySelector('[data-bs-gender].is-on')?.dataset.bsGender || ''
    root.querySelectorAll('[data-bs-voice-row]').forEach((r) => { r.hidden = !((!g || r.dataset.gender === g) && q.every((w) => r.dataset.name.includes(w))) })
  }
  function setCap(patch) {
    draft.captionStyle = { ...capOf(draft), ...patch }
    draft.captions = ''
    render({ keep: true })
  }

  function render({ keep = false } = {}) {
    if (!root.closest('.panel')?.classList.contains('active') && root.innerHTML) { /* still render so state is fresh when shown */ }
    if (view === 'edit' && !draft) view = 'list'
    const keepScroll = keep ? { list: root.querySelector('.bs-styles, .bs-voices')?.scrollTop || 0, sq: root.querySelector('[data-bs-style-q]')?.value || '', vq: root.querySelector('[data-bs-voice-q]')?.value || '', g: root.querySelector('[data-bs-group].is-on')?.dataset.bsGroup || '', gen: root.querySelector('[data-bs-gender].is-on')?.dataset.bsGender || '' } : null
    // The name and about boxes update the draft as you type, so nothing is read back here.
    root.innerHTML = view === 'edit' ? editHtml() : listHtml()
    if (keepScroll) {
      const sq = root.querySelector('[data-bs-style-q]'); if (sq) sq.value = keepScroll.sq
      const vq = root.querySelector('[data-bs-voice-q]'); if (vq) vq.value = keepScroll.vq
      root.querySelectorAll('[data-bs-group]').forEach((b) => b.classList.toggle('is-on', b.dataset.bsGroup === keepScroll.g))
      root.querySelectorAll('[data-bs-gender]').forEach((b) => b.classList.toggle('is-on', b.dataset.bsGender === keepScroll.gen))
      filterStyles(); filterVoices()
      const l = root.querySelector('.bs-styles, .bs-voices'); if (l) l.scrollTop = keepScroll.list
    }
    bind()
    // Cycle the highlighted word so the preview reads like the real captions.
    clearInterval(hotTimer)
    hotTimer = setInterval(() => {
      const caps = root.querySelectorAll('[data-bs-cap]')
      if (!caps.length || !root.closest('.panel')?.classList.contains('active')) return
      hot = (hot + 1) % SAMPLE.length
      caps.forEach((c) => { c.innerHTML = capLine() })
    }, 520)
  }

  function bind() {
    const a = api()
    root.querySelectorAll('[data-bs-play]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); play(b.dataset.bsPlay) }))
    if (view === 'list') {
      root.querySelectorAll('[data-bs-new]').forEach((b) => b.addEventListener('click', () => {
        // Each plan runs a set number of channels (lib/entitlements.js), one Manager each.
        if (window.agentsChat?.canAddChannel?.() === false) {
          const cap = window.agentsChat?.channelCap?.()
          toast(cap?.message || 'Your plan has no room for another channel. Delete one to start another.')
          if (cap?.upgrade) { try { window.openPaywall?.({ force: true, reason: 'upgrade' }) } catch (_) {} }
          return
        }
        // New channels start in the full-screen creator; the editor is for changing a profile.
        if (window.channelCreator) { try { window.switchPanel('create', null) } catch (_) {} ; window.channelCreator.open('brand'); return }
        edit('', 'genre')
      }))
      root.querySelectorAll('[data-bs-edit]').forEach((b) => b.addEventListener('click', () => edit(b.dataset.bsEdit, 'genre')))
      root.querySelectorAll('[data-bs-use]').forEach((b) => b.addEventListener('click', () => { const p = a?.use(b.dataset.bsUse); if (p) toast(`Using ${p.name}`); render() }))
      root.querySelectorAll('[data-bs-del]').forEach((b) => b.addEventListener('click', () => {
        const p = (a?.list() || []).find((x) => x.id === b.dataset.bsDel)
        if (!p || !window.confirm(`Delete the ${p.name} profile? This can't be undone.`)) return
        a.remove(p.id)
        render()
      }))
      return
    }
    root.querySelector('[data-bs-back]')?.addEventListener('click', () => { view = 'list'; draft = null; render() })
    root.querySelectorAll('[data-bs-tab]').forEach((b) => b.addEventListener('click', () => { visited.add(tab); tab = b.dataset.bsTab; render(); root.querySelector('.bs-panel')?.scrollIntoView({ block: 'nearest' }) }))
    root.querySelectorAll('[data-bs-save]').forEach((b) => b.addEventListener('click', () => {
      draft.name = root.querySelector('[data-bs-name]')?.value || draft.name
      const v = voiceOf(draft)
      if (v) draft.voiceLabel = v.label
      const p = a?.save(normalizeProfile(draft))
      if (p) toast(`Saved ${p.name}. New videos follow it.`)
      view = 'list'; draft = null
      render()
    }))
    // channel / genre
    root.querySelectorAll('[data-bs-genre]').forEach((b) => b.addEventListener('click', () => {
      const g = genreById(b.dataset.bsGenre)
      draft.about = root.querySelector('[data-bs-about]')?.value ?? draft.about
      draft.genre = g.id
      draft.angle = g.angle
      if (!draft.captionStyle) draft.captions = g.captions
      // A new profile takes the genre's first style; an existing one keeps its own.
      if (!(api()?.list() || []).some((p) => p.id === draft.id)) draft.visualStyle = g.styles[0]
      render({ keep: true })
    }))
    const chname = root.querySelector('[data-bs-chname]')
    chname?.addEventListener('input', () => { draft.name = chname.value; const top = root.querySelector('[data-bs-name]'); if (top) top.value = chname.value })
    root.querySelector('[data-bs-name]')?.addEventListener('input', (e) => { draft.name = e.target.value; if (chname) chname.value = e.target.value })
    root.querySelector('[data-bs-about]')?.addEventListener('input', (e) => { draft.about = e.target.value })
    root.querySelector('[data-bs-suggest]')?.addEventListener('click', async () => {
      draft.about = root.querySelector('[data-bs-about]')?.value ?? draft.about
      const about = String(draft.about || '').trim()
      if (about.length < 3) { nameNote = 'Say what the channel is about first.'; return render({ keep: true }) }
      nameBusy = true; nameNote = ''; render({ keep: true })
      let out = null
      try { out = await Promise.race([window.fvSetupChannel?.({ genre: genreById(draft.genre)?.name || 'Education', about, niche: nicheById(draft.niche)?.name || '' }), new Promise((r) => setTimeout(() => r(null), 20000))]) } catch (_) {}
      nameBusy = false
      if (out?.name) { draft.name = out.name; nameNote = '' } else nameNote = 'Could not suggest a name right now. Type your own.'
      render({ keep: true })
    })
    // style
    root.querySelector('[data-bs-style-q]')?.addEventListener('input', filterStyles)
    root.querySelectorAll('[data-bs-group]').forEach((b) => b.addEventListener('click', () => { root.querySelectorAll('[data-bs-group]').forEach((x) => x.classList.toggle('is-on', x === b)); filterStyles() }))
    root.querySelectorAll('[data-bs-style]').forEach((b) => b.addEventListener('click', () => { draft.visualStyle = b.dataset.bsStyle; render({ keep: true }) }))
    // voice
    root.querySelector('[data-bs-voice-q]')?.addEventListener('input', filterVoices)
    root.querySelectorAll('[data-bs-gender]').forEach((b) => b.addEventListener('click', () => { root.querySelectorAll('[data-bs-gender]').forEach((x) => x.classList.toggle('is-on', x === b)); filterVoices() }))
    root.querySelectorAll('[data-bs-voice]').forEach((b) => b.addEventListener('click', () => { draft.voiceId = b.dataset.bsVoice; render({ keep: true }) }))
    // captions
    root.querySelectorAll('[data-bs-look]').forEach((b) => b.addEventListener('click', () => { draft.captions = b.dataset.bsLook; draft.captionStyle = null; render({ keep: true }) }))
    root.querySelector('[data-bs-cap-font]')?.addEventListener('change', (e) => setCap({ font: e.target.value }))
    const size = root.querySelector('[data-bs-cap-size]')
    size?.addEventListener('input', () => { size.nextElementSibling.textContent = size.value + 'px'; draft.captionStyle = { ...capOf(draft), size: Number(size.value) }; draft.captions = ''; root.querySelectorAll('[data-bs-cap]').forEach((c) => { c.style.cssText = capCss(capOf(draft)) }) })
    size?.addEventListener('change', () => render({ keep: true }))
    root.querySelectorAll('[data-bs-cap-color]').forEach((b) => b.addEventListener('click', () => setCap({ color: b.dataset.bsCapColor })))
    root.querySelector('[data-bs-cap-color-in]')?.addEventListener('change', (e) => setCap({ color: e.target.value }))
    root.querySelectorAll('[data-bs-cap-hl]').forEach((b) => b.addEventListener('click', () => setCap({ highlight: b.dataset.bsCapHl })))
    root.querySelector('[data-bs-cap-hl-in]')?.addEventListener('change', (e) => setCap({ highlight: e.target.value }))
    root.querySelectorAll('[data-bs-cap-stroke]').forEach((b) => b.addEventListener('click', () => setCap({ stroke: b.dataset.bsCapStroke === '1', strokeWidth: Number(capOf(draft).strokeWidth) || 3, strokeColor: capOf(draft).strokeColor || '#000000' })))
    root.querySelector('[data-bs-cap-sw]')?.addEventListener('change', (e) => setCap({ strokeWidth: Number(e.target.value) }))
    root.querySelector('[data-bs-cap-sc]')?.addEventListener('change', (e) => setCap({ strokeColor: e.target.value }))
    root.querySelectorAll('[data-bs-cap-shadow]').forEach((b) => b.addEventListener('click', () => setCap({ shadow: b.dataset.bsCapShadow === '1' })))
    // video
    root.querySelector('[data-bs-niche]')?.addEventListener('change', (e) => { draft.niche = e.target.value })
    root.querySelectorAll('[data-bs-set]').forEach((b) => b.addEventListener('click', () => { draft[b.dataset.bsSet] = b.dataset.v; render({ keep: true }) }))
    root.querySelectorAll('[data-bs-len-locked]').forEach((b) => b.addEventListener('click', () => { try { window.openPaywall?.({ force: true, reason: 'upgrade' }) } catch (_) {} }))
  }

  /** Open the editor for a profile id ('' = a new profile from the current settings). */
  function edit(id, startTab = 'genre') {
    const a = api()
    const existing = id ? (a?.list() || []).find((p) => p.id === id) : null
    draft = existing ? { ...existing } : (a?.draft() || normalizeProfile({}))
    if (!draft.visualStyle || !visualStyleById(draft.visualStyle)) draft.visualStyle = DEFAULT_STYLE
    tab = BRAND_STEPS.some((x) => x.id === startTab) ? startTab : 'genre'
    nameBusy = false
    nameNote = ''
    visited.clear()
    view = 'edit'
    try { window.fvAgentsLoadVoices?.() } catch (_) {}
    render()
  }

  let queued = 0
  window.addEventListener('vidso:channel-banner', () => { try { window.dispatchEvent(new Event('vidso:agents')) } catch (_) {} })
  window.addEventListener('vidso:agents', () => {
    if (queued) return
    queued = setTimeout(() => {
      queued = 0
      // Voices arrive after load; refresh only the list view or the voice step so typing isn't interrupted.
      // Never redraw under someone typing (the voice search box would lose focus).
      const typing = root.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)
      if (!typing && root.closest('.panel')?.classList.contains('active') && (view === 'list' || tab === 'voice')) render({ keep: true })
    }, 120)
  })
  render()
  return { render: () => render({ keep: true }), edit, list: () => { view = 'list'; draft = null; render() } }
}
