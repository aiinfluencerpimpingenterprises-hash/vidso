/**
 * Agents workspace: a chat with the crew that makes a long-form video.
 *
 * The Manager takes a topic and runs the whole pipeline (the Long Form
 * Generator's agent mode, driven through window.fvAgents* in the dashboard).
 * Every agent has its own thread: what it did, what it made, and, for Title and
 * Thumbnail, a composer that steers it. Characters match the landing page.
 */

import { PAY, breakoutLabel, customNiche, nicheById, rankedNiches, NICHES } from './niches.js'
import { ANGLES, angleById, normalizeProfile, scriptEstimate, formatMinutes } from './channel-kit.js'
import { SETUP_STEPS, GENRES, genreById, fallbackChannel, setupQuestion, stylesForNiche, pickVoices, profileFromSetup } from './onboarding.js'
import { HOSTS, progressFrom, videoPlan, makeTimeLabel, durationSeconds, sceneIndexAt, captionAt } from './studio-flow.js'
import { VISUAL_STYLES, STYLE_GROUPS, DEFAULT_STYLE, VISUAL_MODES, SCENE_PACES, visualStyleById, visualModeById, scenePaceById, styleSample } from './visual-styles.js'

export const AGENTS = [
  { id: 'manager', name: 'Manager', role: 'Plans the video and runs the team', c: '#ff2d48', bg: '#ffd6db',
    body: '<g transform="translate(-9.01 -4.47) scale(.58)"><rect x="48.4" y="16" width="3.2" height="14" rx="1.6"/><circle cx="50" cy="16" r="4.5"/><path d="M22 38c0-6 3-9 9-9.6 12-1 26-1 38 0 6 .6 9 3.6 9 9.6v24c0 6-3 9-9 9.6-12 1-26 1-38 0-6-.6-9-3.6-9-9.6z"/></g>', ey: 19.9 },
  { id: 'script', name: 'Script', role: 'Writes every chapter for watch time', c: '#22b864', bg: '#cdeedb',
    body: '<rect x="7" y="7" width="26" height="26" rx="8" transform="rotate(-12 20 20)"/>', ey: 16 },
  { id: 'title', name: 'Title', role: 'Writes five title options from the script', c: '#0ea5e9', bg: '#cfeafd',
    body: '<path d="M10 9h20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H20l-7 5v-5h-3a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z" stroke-width="4" stroke-linejoin="round"/>', ey: 14.5 },
  { id: 'thumbnail', name: 'Thumbnail', role: 'Designs the thumbnail that gets the click', c: '#e2b100', bg: '#fff1b8',
    body: '<circle cx="20" cy="10" r="6.5"/><circle cx="29.51" cy="16.91" r="6.5"/><circle cx="25.88" cy="28.09" r="6.5"/><circle cx="14.12" cy="28.09" r="6.5"/><circle cx="10.49" cy="16.91" r="6.5"/><circle cx="20" cy="20" r="10"/>', ey: 16 },
  { id: 'voice', name: 'Voice', role: 'Narrates the script', c: '#ff6a4d', bg: '#ffd8cf',
    body: '<path d="M20 8L34 31H6Z" stroke-width="7" stroke-linejoin="round"/>', ey: 20.5 },
  { id: 'agent', name: 'Agent', role: 'Finds B-roll or draws AI scenes', c: '#ff4fa3', bg: '#ffd4e8',
    body: '<circle cx="20" cy="11" r="7"/><circle cx="27.79" cy="15.5" r="7"/><circle cx="27.79" cy="24.5" r="7"/><circle cx="20" cy="29" r="7"/><circle cx="12.21" cy="24.5" r="7"/><circle cx="12.21" cy="15.5" r="7"/><circle cx="20" cy="20" r="10"/>', ey: 16 },
  { id: 'editor', name: 'Editor', role: 'Cuts, captions and renders the MP4', c: '#3b82f6', bg: '#d3e2ff',
    body: '<rect x="4" y="11" width="32" height="20" rx="10" transform="rotate(-8 20 20)"/>', ey: 17.5 },
  { id: 'publish', name: 'Publish', role: 'Writes the description, tags and chapters', c: '#84cc16', bg: '#e4f5c8',
    body: '<rect x="5" y="9" width="30" height="22" rx="7" transform="rotate(6 20 20)"/>', ey: 16.5 },
]
const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]))
const PINNED = ['manager', 'script', 'title']
/** Most channels (brand profiles) one account can run. Each channel gets its own Manager. */
export const MAX_CHANNELS = 3
const VIDEO_CH_KEY = 'vidso_video_channel'
const RUN_KEY = 'vidso_agents_run' // the team's updates for the last video, kept through a reload
const STEERABLE = new Set(['manager', 'title', 'thumbnail'])
const LOOK_NAMES = { bold: 'Bold yellow', clean: 'Clean white', outline: 'Heavy outline', doc: 'Documentary', comic: 'Comic pop', mono: 'Minimal mono' }
const LENGTHS = [['long_180', '3 min'], ['long_300', '5 min'], ['long_600', '10 min'], ['long_900', '15 min'], ['long_1800', '30 min']]
const IDEAS = [
  'What did ancient humans do for fun?',
  'The rise and fall of Blockbuster',
  'Why almost nobody lives in northern Maine',
  'The psychology of people who never ask for help',
]
const STORE_KEY = 'vidso_agents_chat'

/** What a Manager message is asking for, so "change the captions" never becomes a video topic. */
export function routeManagerMessage(text, hasVideo) {
  const t = String(text || '').toLowerCase()
  const bare = t.trim().replace(/[!.?,\s]+$/g, '')
  if (/^(hi+|hey+|hello+|hiya|yo+|sup|hola|namaste|good (morning|afternoon|evening|night))( there| team| manager)?$/.test(bare)) return { type: 'greeting' }
  if (/^(thanks?|thank you|thx|ty|ok(ay)?|cool|nice|great|awesome|perfect|lol|haha|got it)( so much| a lot)?$/.test(bare)) return { type: 'thanks' }
  // "show me", "where can I watch it", "play the video", "is it done?"
  if (/^(show( me)?( it| the video)?|play( it)?|watch( it)?|done|is it (done|ready|finished)|ready|finished|where is (it|the video|my video)|download( it)?)$/.test(bare)
    || /\b(where|how)\b.*\b(watch|see|view|find|download)\b/.test(t)
    || /\b(show|play|watch|see|view|open|download)\b.*\b(the|my|this|finished|final)? ?(video|mp4|result|it)\b/.test(t) && !/\b(new|another|make|create|about)\b/.test(t)) return { type: 'watch' }
  // Questions about the app or this video ("how long will this take?"), not question-shaped topics.
  if (/\?\s*$/.test(t) && /\b(you|this|it|my video|the video|vidso|agents?)\b/.test(t) && !/\b(did|were|was) (ancient|medieval|people|humans)\b/.test(t)) return { type: 'question' }
  if (bare.split(/\s+/).length === 1 && bare.length <= 4) return { type: 'vague' }
  const edit = /\b(change|edit|fix|redo|re-?do|update|replace|remove|add|tweak|improve|swap|different|another|make (it|the|them)|use (a|an|the)|switch|bigger|smaller|shorter|longer|louder|quieter|instead)\b/.test(t)
  const topics = [
    ['captions', /\b(captions?|subtitles?|subs|text on (the )?screen|fonts?)\b/],
    ['title', /\btitles?\b/],
    ['thumbnail', /\b(thumbnails?|thumb|cover image)\b/],
    ['voice', /\b(voices?|narrat\w*|accent|speaker)\b/],
    ['music', /\b(music|songs?|soundtrack|background (audio|track))\b/],
    ['visuals', /\b(art style|visual style|visuals?|stick figure|animat\w*|cartoon|illustrat\w*|drawn|drawings?|ai scenes?|consistent character)\b/],
    ['broll', /\b(b-?roll|footage|clips?|scenes?)\b/],
    ['script', /\b(script|hook|intro|ending|outro|wording|sentences?|paragraphs?)\b/],
    ['length', /\b(shorter|longer|length|duration|\d+\s*(min|mins|minutes))\b/],
  ]
  const hit = topics.find(([, re]) => re.test(t))
  const words = t.split(/\s+/).filter(Boolean).length
  if (hit && (edit || hit[0] === 'captions' || (hasVideo && words <= 4))) return { type: hit[0] }
  if (edit && hasVideo && t.split(/\s+/).length <= 8) return { type: 'edit' }
  if (isVague(text)) return { type: 'vague' }
  return { type: 'topic' }
}

/** "make a new video for my channel" has no subject: the Manager asks for one. */
function isVague(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').trim()
  const filler = /\b(make|create|do|generate|start|build|give|me|us|a|an|another|new|the|my|our|for|on|youtube|yt|channel|video|videos|one|please|pls|can|you|could|i|want|need|some|something|long|form|longform|faceless|good|viral|cool|documentary|documentaries|explainer|about|style|type|kind|series|content|faceless|niche|trending|popular|interesting|random|any|anything|topic|idea|ideas)\b/g
  return t.replace(filler, ' ').replace(/\s+/g, ' ').trim().length < 3
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Colours a channel's Manager can take (the shape stays the Manager's). */
export const MANAGER_COLORS = ['#f4f4f2', '#9a6a3c', '#ff2d48', '#ff6a00', '#ff9f0a', '#22c55e', '#14b8a6', '#1e7bff', '#8b5cf6', '#ff3fa8', '#7a7a7a']
const MANAGER_DEFAULTS = ['#ff2d48', '#22c55e', '#1e7bff']
let managerTint = '' // the active channel's Manager colour, used wherever the Manager is drawn
/** The Manager has white eyes, or dark ones on a light body. */
function eyeOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff'
  const n = parseInt(m[1], 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.7 ? '#141414' : '#fff'
}
export function agentSvg(id, cls = '', color = '') {
  const a = BY_ID[id] || BY_ID.manager
  const c = color || (id === 'manager' && managerTint) || a.c
  return `<svg class="ag-blob ${cls}" viewBox="0 0 40 40" aria-hidden="true"><g class="body" fill="${c}" stroke="${c}">${a.body}</g>` +
    (id === 'manager'
      ? `<g class="eyes" style="fill:${eyeOn(c)}"><rect x="14.8" y="${a.ey}" width="3.5" height="7.5" rx="1.75"/><rect x="21.7" y="${a.ey}" width="3.5" height="7.5" rx="1.75"/></g></svg>`
      : `<g class="eyes"><rect x="15.6" y="${a.ey}" width="3.6" height="7.2" rx="1.8"/><rect x="21.4" y="${a.ey}" width="3.6" height="7.2" rx="1.8"/></g></svg>`)
}

function clock(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch (_) { return '' }
}
function dayLabel(ts) {
  const d = new Date(ts)
  const now = new Date()
  const same = d.toDateString() === now.toDateString()
  return (same ? 'Today' : d.toLocaleDateString([], { weekday: 'long' })) + ' ' + clock(ts)
}

const CSS = `
.ag-app{--ag-bg:#1c1c1d;--ag-side:#141415;--ag-line:rgba(255,255,255,.07);--ag-bubble:#2a2a2b;--ag-ink:#f2f2f1;--ag-mute:rgba(242,242,241,.55);
  display:grid;grid-template-columns:300px minmax(0,1fr);grid-template-rows:minmax(0,1fr);height:calc(100dvh - 128px);min-height:560px;border-radius:24px;overflow:hidden;
  background:var(--ag-bg);border:1px solid var(--ag-line);color:var(--ag-ink);font-family:Inter,system-ui,-apple-system,sans-serif}
.ag-app.is-ed{grid-template-columns:minmax(0,1fr)}
.ag-side{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:auto;background:var(--ag-side);border-right:1px solid var(--ag-line);padding:16px 14px 14px}
.ag-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px 14px}
.ag-side-head h2{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:1.35rem;letter-spacing:-.01em}
.ag-icon-btn{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--ag-line);background:#232324;color:var(--ag-ink);cursor:pointer}
.ag-icon-btn:hover{background:#2c2c2d}
.ag-icon-btn:focus-visible,.ag-tile:focus-visible,.ag-row:focus-visible,.ag-send:focus-visible,.ag-chip:focus-visible,.ag-pill:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-bottom:10px}
.ag-tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 4px 10px;border-radius:18px;border:0;background:transparent;color:var(--ag-ink);cursor:pointer;font:inherit;font-size:.86rem;text-align:center;min-width:0}
.ag-tile:hover{background:#1d1d1e}
.ag-tile.is-on{background:#262627}
.ag-tile .ag-blob{width:64px;height:64px}
/* One Manager per channel: each has its own colour and the channel's name. */
.ag-mgr span:last-child{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
.ag-colors{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:4px 6px 14px}
.ag-color{width:26px;height:26px;padding:0;border-radius:50%;border:0;background:var(--c);cursor:pointer;box-shadow:0 0 0 2px var(--ag-side),0 0 0 3px transparent;transition:box-shadow .15s,transform .15s}
.ag-color:hover{transform:scale(1.08)}
.ag-color.is-on{box-shadow:0 0 0 3px var(--ag-side),0 0 0 5px rgba(255,255,255,.7)}
.ag-color:focus-visible{outline:2px solid #fff;outline-offset:3px}.ag-mgr-add{color:var(--ag-mute)}
.ag-head-ch{color:var(--ag-mute);font-weight:500}
.ag-mgr-list .ag-mgr-plus{width:42px;height:42px;font-size:1.25rem;flex-shrink:0}
.ag-mgr-list .ag-colors{padding:2px 10px 10px}
.ag-mgr-plus{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;border:1.5px dashed rgba(255,255,255,.2);font-size:1.6rem;font-weight:300;color:rgba(255,255,255,.55)}
.ag-mgr-add:hover .ag-mgr-plus{border-color:rgba(255,255,255,.5);color:#fff}
.ag-list{display:flex;flex-direction:column;gap:2px;overflow:auto;min-height:0;flex:1}
.ag-row{display:flex;align-items:center;gap:12px;padding:10px 10px;border-radius:16px;border:0;background:transparent;color:var(--ag-ink);cursor:pointer;font:inherit;text-align:left;min-width:0}
.ag-row:hover{background:#1d1d1e}
.ag-row.is-on{background:#262627}
.ag-row .ag-blob{width:42px;height:42px;flex-shrink:0}
.ag-row-txt{min-width:0;display:flex;flex-direction:column;gap:2px}
.ag-row-txt b{font-weight:600;font-size:.95rem}
.ag-row-txt span{font-size:.82rem;color:var(--ag-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ava{position:relative;display:inline-grid;place-items:center;flex-shrink:0}
.ag-dot{position:absolute;right:2px;bottom:2px;width:12px;height:12px;border-radius:50%;border:2px solid var(--ag-side);display:none}
.ag-ava[data-state="working"] .ag-dot{display:block;background:#fff;animation:agPulse 1.2s ease-in-out infinite}
.ag-ava[data-state="done"] .ag-dot{display:block;background:#22b864}
.ag-ava[data-state="stuck"] .ag-dot{display:block;background:#f5a524}
.ag-ava[data-state="error"] .ag-dot{display:block;background:#ef4444}
.ag-ava[data-state="working"] .ag-blob{animation:agHop .95s ease-in-out infinite}
.ag-blob{overflow:visible}
.ag-blob .eyes{fill:#141414;transform-box:fill-box;transform-origin:center;animation:agBlink 4.6s infinite}
.ag-me{display:flex;align-items:center;gap:10px;padding:12px 6px 2px;border-top:1px solid var(--ag-line);margin-top:8px;font-size:.92rem}
.ag-me i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#2a2a2b;font-style:normal;font-size:.72rem;letter-spacing:.04em;color:var(--ag-mute)}
.ag-main{display:flex;flex-direction:column;min-width:0;min-height:0}
.ag-head{position:relative;display:flex;align-items:center;justify-content:center;padding:14px 16px;min-height:68px}
.ag-head-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:999px;background:#232324;border:1px solid var(--ag-line);font-weight:600;font-size:.95rem}
.ag-head-pill .ag-blob{width:26px;height:26px}
.ag-pill{position:absolute;right:16px;display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:999px;border:0;background:#fff;color:#161616;font:inherit;font-size:.9rem;font-weight:600;cursor:pointer}
.ag-pill:hover{background:#e9e9e7}
.ag-thread{flex:1;overflow:auto;padding:4px 24px 20px;display:flex;flex-direction:column;gap:10px;min-height:0}
.ag-day{align-self:center;font-size:.82rem;color:var(--ag-mute);margin:6px 0 4px}
.ag-msg{display:flex;flex-direction:column;gap:6px;max-width:min(78%,720px);align-self:flex-start;min-width:0}
.ag-msg.from-me{align-self:flex-end;align-items:flex-end}
.ag-who{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--ag-mute);margin-top:6px}
.ag-who .ag-blob{width:22px;height:22px}
.ag-who b{color:var(--ag-ink);font-weight:600}
.ag-bubble{padding:12px 16px;border-radius:20px;background:var(--ag-bubble);font-size:.97rem;line-height:1.5;overflow-wrap:anywhere}
.from-me .ag-bubble{background:#ececea;color:#161616}
.ag-bubble.is-check{display:flex;gap:8px}
.ag-bubble.is-check::before{content:"✓";font-weight:700}
.ag-bubble.is-stuck{color:#f5c26b}
.ag-bubble.is-error{color:#f3b4b8}
.ag-bubble b{font-weight:650}
.ag-card{padding:14px;border-radius:20px;background:var(--ag-bubble);display:flex;flex-direction:column;gap:10px;min-width:0}
.ag-card-label{font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ag-mute)}
.ag-card video{display:block;width:100%;border-radius:14px;background:#000;aspect-ratio:16/9}
.ag-card img{display:block;width:100%;border-radius:14px;aspect-ratio:16/9;object-fit:cover;background:#111}
.ag-card-title{font-size:1.05rem;font-weight:650;overflow-wrap:anywhere}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px}
.ag-chip{font:inherit;font-size:.82rem;text-align:left;padding:7px 12px;border-radius:999px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);cursor:pointer;max-width:100%;overflow-wrap:anywhere;text-decoration:none;display:inline-flex;align-items:center}
.ag-chip:hover{background:#2c2c2d}
.ag-chip.is-on{background:#fff;color:#161616;border-color:#fff}
.ag-chip.is-primary{background:#fff;color:#161616;border-color:#fff;font-weight:600}
.ag-chip[disabled]{opacity:.5;cursor:default}
.ag-script{display:flex;flex-direction:column;gap:8px;font-size:.9rem;line-height:1.5;color:rgba(242,242,241,.82)}
.ag-script h4{margin:4px 0 0;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ag-mute)}
.ag-team{margin:0 auto 12px;max-width:760px;padding:12px 14px 10px;border:1px solid var(--ag-line);border-radius:20px;background:#1a1a1b}
.ag-team-row{display:flex;justify-content:space-between;gap:4px}
.ag-team-m{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;border:0;background:none;color:var(--ag-mute);font:inherit;font-size:.72rem;cursor:pointer;padding:2px 0;min-width:0}
.ag-team-m:hover .ag-team-name{color:var(--ag-ink)}
.ag-team-ava{position:relative;display:grid;place-items:center;width:44px;height:44px}
.ag-team-ava .ag-blob{width:38px;height:38px;transition:opacity .3s,filter .3s}
.ag-team-m[data-state=idle] .ag-blob{opacity:.28;filter:grayscale(1)}
.ag-team-m[data-state=idle] .ag-blob .eyes{animation:none}
.ag-team-m[data-state=working] .ag-blob{animation:agHop .95s ease-in-out infinite}
.ag-team-m[data-state=working] .ag-team-name{color:var(--ag-ink);font-weight:600}
.ag-team-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ag-team-typing{position:absolute;top:-6px;right:-10px;display:flex;gap:2px;padding:4px 5px;border-radius:9px;background:#fff}
.ag-team-typing b{width:4px;height:4px;border-radius:50%;background:#141414;animation:agType 1.1s infinite}
.ag-team-typing b:nth-child(2){animation-delay:.15s}.ag-team-typing b:nth-child(3){animation-delay:.3s}
.ag-team-ok{position:absolute;right:-2px;bottom:-1px;width:16px;height:16px;border-radius:50%;background:#22b864;color:#fff;font-style:normal;font-size:10px;font-weight:700;display:grid;place-items:center;border:2px solid #1a1a1b}
.ag-team-ok.is-stuck{background:#f5a524}
.ag-team-now{display:flex;gap:6px;align-items:baseline;margin-top:8px;font-size:.84rem;color:var(--ag-mute);min-width:0}
.ag-team-now b{color:var(--ag-ink);font-weight:600;flex:0 0 auto}
.ag-team-now span{margin-left:auto;flex:0 0 auto;font-size:.76rem}
.ag-team-bar{height:3px;border-radius:3px;background:rgba(255,255,255,.08);margin-top:8px;overflow:hidden}
.ag-team-bar i{display:block;height:100%;background:#fff;border-radius:inherit;transition:width .6s ease}
@keyframes agType{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-2px);opacity:1}}
@media (max-width:640px){.ag-team{padding:10px 8px 8px;border-radius:16px}.ag-team-ava{width:34px;height:34px}.ag-team-ava .ag-blob{width:30px;height:30px}.ag-team-name{font-size:.64rem}.ag-team-now span{display:none}}
@media (prefers-reduced-motion:reduce){.ag-team-m .ag-blob,.ag-team-typing b{animation:none!important}}
.ag-building{display:flex;align-items:center;gap:12px;margin-top:6px;color:var(--ag-mute);font-size:.95rem}
.ag-building .ag-blob{width:44px;height:44px;animation:agHop .95s ease-in-out infinite}
.ag-building b{color:var(--ag-ink);font-weight:500}
.ag-empty{margin:auto;max-width:560px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 8px}
.ag-empty-crew{display:flex;gap:6px}
.ag-empty-crew .ag-blob{width:44px;height:44px}
.ag-empty h3{margin:6px 0 0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(1.7rem,3.2vw,2.4rem);line-height:1.1;letter-spacing:-.02em}
.ag-empty p{margin:0;color:var(--ag-mute);font-size:1rem;line-height:1.5}
.ag-empty .ag-chips{justify-content:center;margin-top:6px}
.ag-compose-wrap{padding:12px 20px 18px;position:relative}
.ag-compose{display:flex;align-items:flex-end;gap:8px;padding:8px;border-radius:28px;background:#232324;border:1px solid var(--ag-line)}
.ag-compose{align-items:center}
.ag-compose:focus-within{border-color:rgba(255,255,255,.22)}
#panel-agents .ag-app .ag-compose textarea#ag-input,#panel-agents .ag-app .ag-compose textarea#ag-input:focus,#panel-agents .ag-app .ag-compose textarea#ag-input:focus-visible{outline:none!important;box-shadow:none!important;border:0!important;background:transparent!important}
.ag-app .ag-compose:focus-within{border-color:rgba(255,255,255,.22)}
#panel-agents .ag-app input:focus,#panel-agents .ag-app textarea:focus,#panel-agents .ag-app select:focus{box-shadow:none!important;border-color:rgba(255,255,255,.35)!important;background-color:#232324}
#panel-agents .ag-app input:focus-visible,#panel-agents .ag-app textarea:focus-visible,#panel-agents .ag-app select:focus-visible{outline:2px solid rgba(255,255,255,.7);outline-offset:1px}
.ag-app .ag-compose textarea{flex:1;min-width:0;width:auto;min-height:24px;height:24px;resize:none;border:0;outline:0;box-shadow:none;border-radius:0;background:transparent;color:var(--ag-ink);font:inherit;font-size:1rem;line-height:1.45;padding:8px 4px;max-height:160px;box-sizing:content-box}
.ag-compose textarea::placeholder{color:var(--ag-mute)}
.ag-send{width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;background:#fff;color:#161616;cursor:pointer;flex-shrink:0}
.ag-send[disabled]{opacity:.4;cursor:default}
.ag-plus{width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;background:transparent;color:var(--ag-mute);cursor:pointer;flex-shrink:0}
.ag-plus:hover{background:#2c2c2d;color:var(--ag-ink)}
.ag-settings-tag{align-self:center;font-size:.76rem;color:var(--ag-mute);white-space:nowrap;padding:0 4px}
.ag-pop{position:absolute;left:20px;bottom:calc(100% - 4px);z-index:5;padding:14px;border-radius:18px;background:#262627;border:1px solid var(--ag-line);box-shadow:0 18px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:10px;width:min(340px,calc(100% - 40px))}
.ag-pop[hidden]{display:none}
.ag-pop{max-height:min(560px,70vh);overflow:auto}
.ag-voices{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow:auto;padding-right:2px}
.ag-voice{display:flex;align-items:center;gap:6px;border-radius:12px;border:1px solid transparent}
.ag-voice.is-on{background:#fff;border-color:#fff}
.ag-voice-pick{flex:1;min-width:0;text-align:left;font:inherit;font-size:.84rem;padding:8px 10px;border:0;background:transparent;color:var(--ag-ink);cursor:pointer;border-radius:12px;overflow-wrap:anywhere}
.ag-voice:not(.is-on) .ag-voice-pick:hover{background:#2c2c2d}
.ag-voice.is-on .ag-voice-pick{color:#161616;font-weight:600}
.ag-voice-play{flex-shrink:0;width:30px;height:30px;margin-right:4px;border-radius:50%;border:1px solid var(--ag-line);display:grid;place-items:center;background:#1f1f20;color:var(--ag-ink);cursor:pointer}
.ag-voice.is-on .ag-voice-play{background:#161616;color:#fff;border-color:#161616}
.ag-voice-pick:focus-visible,.ag-voice-play:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-note{font-size:.84rem;color:var(--ag-mute);padding:0 6px 2px}
.ag-note button{font:inherit;color:var(--ag-ink);background:none;border:0;padding:0;text-decoration:underline;cursor:pointer}
.ag-mobile-strip{display:none}
.ag-profile-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;margin-top:8px;padding:10px 12px;border-radius:14px;border:1px solid var(--ag-line);background:#1b1b1c;color:var(--ag-ink);font:inherit;text-align:left;cursor:pointer}
.ag-profile-btn:hover{background:#232324}
.ag-profile-btn b{font-size:.92rem}
.ag-profile-btn > span:last-child{font-size:.76rem;color:var(--ag-mute)}
.ag-profiles{margin:0 auto;width:100%;max-width:760px;display:flex;flex-direction:column;gap:12px;padding:8px 2px}
.ag-profiles h3{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:1.8rem}
.ag-profiles > p{margin:0;color:var(--ag-mute)}
.ag-profile-list{display:flex;flex-direction:column;gap:8px}
.ag-profile-card{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:16px;border:1px solid var(--ag-line);background:#232324}
.ag-profile-card.is-on{border-color:rgba(132,204,22,.5)}
.ag-profile-card > div:first-child{display:flex;align-items:center;gap:8px}
.ag-profile-card > span{font-size:.84rem;color:var(--ag-mute)}
.ag-form{display:flex;flex-direction:column;gap:14px}
.ag-form label{display:flex;flex-direction:column;gap:6px;font-size:.8rem;color:var(--ag-mute)}
.ag-form input,.ag-form select,.ag-own input,.ag-own textarea{font:inherit;font-size:.92rem;color:var(--ag-ink);background:#1b1b1c;border:1px solid var(--ag-line);border-radius:12px;padding:10px 12px;min-width:0;width:100%;box-sizing:border-box}
.ag-field{display:flex;flex-direction:column;gap:6px}
.ag-own{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:22px;background:#232324;border:1px solid var(--ag-line)}
.ag-own textarea{resize:vertical;min-height:140px;max-height:42vh;line-height:1.5}
.ag-own-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:.84rem}
.ag-own-head span{color:var(--ag-mute)}
.ag-publish summary{list-style:none;cursor:pointer;display:inline-flex}
.ag-publish summary::-webkit-details-marker{display:none}
.ag-desc{white-space:pre-wrap;font:inherit;font-size:.86rem;line-height:1.5;color:rgba(242,242,241,.85);background:#1b1b1c;border-radius:12px;padding:12px;margin:10px 0 8px;max-height:260px;overflow:auto}
.ag-style-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.ag-style{display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:14px;border:2px solid transparent;background:#232324;color:var(--ag-ink);font:inherit;font-size:.8rem;cursor:pointer;text-align:left;min-width:0}
.ag-style img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:#111}
.ag-style:hover{background:#2a2a2b}
.ag-style.is-on{border-color:#fff}
.ag-style:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-style[hidden]{display:none}
.ag-style-scroll{max-height:min(460px,55vh);overflow-y:auto;padding:2px;overscroll-behavior:contain}
.ag-style-current{display:flex;align-items:center;gap:12px}
.ag-style-current img{width:96px;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:#111}
.ag-style-current div{display:flex;flex-direction:column;gap:2px}
.ag-style-search{width:100%;box-sizing:border-box;background:#232324;border:1px solid #333;border-radius:12px;color:var(--ag-ink);font:inherit;padding:10px 12px}
.ag-style-search:focus{outline:2px solid #fff;outline-offset:1px}
.ag-char{display:flex;gap:12px;align-items:center}
.ag-char img{width:88px;height:88px;object-fit:cover;border-radius:14px;background:#111}
.ag-char > div{display:flex;flex-direction:column;gap:4px;font-size:.86rem}
.ag-char span{color:var(--ag-mute);font-size:.8rem}
.ag-char-form{display:flex;gap:8px;flex-wrap:wrap}
.ag-char-form input{flex:1;min-width:200px;font:inherit;font-size:.9rem;color:var(--ag-ink);background:#1b1b1c;border:1px solid var(--ag-line);border-radius:12px;padding:10px 12px}
.ag-tag{font-size:.76rem;padding:4px 9px;border-radius:999px;background:#1b1b1c;border:1px solid var(--ag-line);color:var(--ag-mute)}
.ag-niche{margin:auto;width:100%;max-width:920px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 4px;text-align:center}
.ag-niche h3{margin:6px 0 0;font-family:Lora,Georgia,serif;font-weight:500;font-size:clamp(1.7rem,3.2vw,2.4rem);line-height:1.1;letter-spacing:-.02em}
.ag-niche > p{margin:0;max-width:620px;color:var(--ag-mute);font-size:.98rem;line-height:1.5}
.ag-niche-grid{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px;text-align:left}
.ag-niche-card{display:flex;flex-direction:column;gap:6px;min-width:0;padding:14px;border-radius:18px;border:1px solid var(--ag-line);background:#232324;color:var(--ag-ink);font:inherit;cursor:pointer;text-align:left}
.ag-niche-card:hover{background:#2a2a2b;border-color:rgba(255,255,255,.18)}
.ag-niche-card:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-niche-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.ag-niche-top b{font-size:1rem;font-weight:650;line-height:1.25}
.ag-pay{flex-shrink:0;font-size:.68rem;font-weight:650;letter-spacing:.03em;padding:3px 8px;border-radius:999px;white-space:nowrap}
.ag-pay.is-high{background:rgba(34,184,100,.18);color:#6fe0a0}
.ag-pay.is-mid{background:rgba(245,165,36,.16);color:#f5c26b}
.ag-pay.is-low{background:rgba(255,255,255,.08);color:var(--ag-mute)}
.ag-niche-blurb{font-size:.84rem;color:var(--ag-mute);line-height:1.4}
.ag-niche-proof{display:flex;gap:8px;align-items:baseline;font-size:.78rem;line-height:1.35;color:rgba(242,242,241,.75);border-top:1px solid var(--ag-line);padding-top:8px;margin-top:auto}
.ag-niche-x{flex-shrink:0;font-weight:700;color:#fff;font-variant-numeric:tabular-nums}
.ag-niche-own{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:8px;font-size:.88rem;color:var(--ag-mute)}
.ag-niche-own input{min-width:0;width:240px;max-width:100%;height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);font:inherit;font-size:.88rem}
.ag-niche-src{font-size:.74rem!important;max-width:560px!important}
.ag-su-wrap{display:flex;flex-direction:column;gap:10px;margin-top:8px;max-width:760px}
.ag-genres{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.ag-genre{position:relative;display:block;padding:0;border-radius:14px;border:2px solid transparent;overflow:hidden;background:#232324;cursor:pointer;aspect-ratio:4/3}
.ag-genre img{width:100%;height:100%;object-fit:cover;display:block;opacity:.7;transition:opacity .15s}
.ag-genre span{position:absolute;left:8px;bottom:6px;font-size:.78rem;font-weight:600;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.ag-genre:hover img,.ag-genre.is-on img{opacity:1}
.ag-genre.is-on{border-color:#fff}
.ag-genre:focus-visible,.ag-su-topic:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-su-about{display:flex;gap:10px;align-items:stretch;background:#232324;border:1px solid var(--ag-line);border-radius:16px;padding:10px}
.ag-su-about textarea{flex:1;min-width:0;background:transparent;border:0;color:var(--ag-ink);font:inherit;font-size:.95rem;resize:none;padding:4px 6px}
#panel-agents .ag-su-about textarea:focus{outline:none!important;box-shadow:none!important;border:0!important;background:transparent}
.ag-su-about:focus-within{border-color:rgba(255,255,255,.3)}
.ag-su-name{display:flex;align-items:center;gap:10px}
.ag-su-name input{flex:1;max-width:320px;background:#232324;border:1px solid #333;border-radius:10px;color:var(--ag-ink);font:inherit;font-size:1rem;font-weight:600;padding:8px 10px}
.ag-su-topics{display:flex;flex-direction:column;gap:6px}
.ag-su-topic{text-align:left;padding:11px 14px;border-radius:12px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);font:inherit;font-size:.92rem;cursor:pointer}
.ag-su-topic:hover{background:#2a2a2b;border-color:rgba(255,255,255,.25)}
@media (max-width:760px){.ag-genres{grid-template-columns:repeat(3,minmax(0,1fr))}.ag-su-about{flex-direction:column}}
.ag-su-voices{max-height:340px}
@media (max-width:1100px){.ag-niche-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.ag-niche-grid{grid-template-columns:minmax(0,1fr)}}
@keyframes agBlink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}
@keyframes agHop{0%,100%{transform:translateY(0)}35%{transform:translateY(-4px) scale(.95,1.05)}60%{transform:translateY(0) scale(1.05,.94)}}
@keyframes agPulse{0%,100%{opacity:1}50%{opacity:.35}}
@media (max-width:860px){
  .ag-app{grid-template-columns:minmax(0,1fr);height:calc(100dvh - 112px);border-radius:18px}
  .ag-side{display:none}
  .ag-mobile-strip{display:flex;gap:4px;overflow-x:auto;padding:10px 10px 0;scroll-snap-type:x mandatory}
  .ag-mobile-strip .ag-tile{flex:0 0 76px;scroll-snap-align:start;padding:8px 2px}
  .ag-mobile-strip .ag-tile .ag-blob{width:44px;height:44px}
  .ag-head{min-height:56px;padding:10px 12px;justify-content:flex-start}
  .ag-pill{right:12px;height:34px;padding:0 13px}
  .ag-thread{padding:4px 12px 14px}
  .ag-msg{max-width:92%}
  .ag-compose-wrap{padding:8px 10px 12px}
  .ag-settings-tag{display:none}
  .ag-pop{left:10px;width:calc(100% - 20px)}
}
/* ── Studio: guided setup, hosted by the agents ── */
.ag-studio{flex:1;overflow:auto;min-height:0;padding:6px 24px 24px}
.ag-st-steps{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--ag-mute);margin:0 0 14px}
.ag-st-steps b{color:var(--ag-ink);font-weight:600}
.ag-st-steps i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:1px solid var(--ag-line);font-size:.72rem}
.ag-st-steps .is-on i{background:#fff;color:#161616;border-color:#fff}
.ag-st-steps .ag-st-line{width:24px;height:1px;background:var(--ag-line)}
.ag-st{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:22px;align-items:start}
.ag-st-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.ag-st h3{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:1.8rem;letter-spacing:-.01em}
.ag-host{display:flex;align-items:flex-start;gap:12px}
.ag-host .ag-blob{width:46px;height:46px;flex:0 0 46px}
.ag-host-say{background:var(--ag-bubble);border-radius:6px 18px 18px 18px;padding:10px 14px;font-size:.92rem;line-height:1.45}
.ag-host-say b{display:block;font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ag-mute);font-weight:600;margin-bottom:2px}
.ag-tabs{display:flex;gap:6px;flex-wrap:wrap}
.ag-tab{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);font:inherit;font-size:.86rem;cursor:pointer}
.ag-tab .ag-blob{width:26px;height:26px}
.ag-tab.is-on{background:#fff;color:#161616;border-color:#fff}
.ag-tab:focus-visible,.ag-mode:focus-visible,.ag-capcard:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-preview{position:sticky;top:0;display:flex;flex-direction:column;gap:12px;background:#161617;border:1px solid var(--ag-line);border-radius:20px;padding:12px}
.ag-preview-frame{position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:16/9;container-type:size}
.ag-preview-frame.is-tall{aspect-ratio:9/16;height:min(420px,60vh);margin:0 auto;width:auto}
.ag-preview-frame img{width:100%;height:100%;object-fit:cover;display:block}
.ag-cap{position:absolute;left:6%;right:6%;bottom:12%;text-align:center;line-height:1.15;font-weight:800;text-wrap:balance}
.ag-cap .hot{color:var(--hl)}
.ag-preview-row{display:flex;align-items:center;gap:10px;font-size:.85rem}
.ag-preview-row .ag-card-label{min-width:64px}
.ag-preview-row b{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-round{width:34px;height:34px;flex:0 0 34px;border-radius:50%;border:0;background:#fff;color:#161616;display:grid;place-items:center;cursor:pointer}
.ag-capgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ag-capcard{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;border:2px solid transparent;background:#232324;color:var(--ag-ink);font:inherit;font-size:.8rem;cursor:pointer;text-align:left}
.ag-capcard.is-on{border-color:#fff}
.ag-capcard > span:first-child{display:block;text-align:center;line-height:54px;overflow:hidden;height:54px;border-radius:9px;background:linear-gradient(135deg,#3a3f4a,#22252b);font-size:17px;font-weight:800;white-space:nowrap;paint-order:stroke fill}
.ag-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ag-mode{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;border:2px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);font:inherit;text-align:left;cursor:pointer}
.ag-mode b{font-size:.92rem}
.ag-mode span{font-size:.78rem;color:var(--ag-mute)}
.ag-mode.is-on{border-color:#fff;background:#262627}
.ag-topic{width:100%;box-sizing:border-box;background:#232324;border:1px solid #333;border-radius:14px;color:var(--ag-ink);font:inherit;padding:12px 14px;resize:vertical;min-height:84px}
.ag-topic:focus,.ag-pfname:focus{outline:2px solid #fff;outline-offset:1px}
.ag-pfname{background:#232324;border:1px solid #333;border-radius:12px;color:var(--ag-ink);font:inherit;padding:9px 12px;min-width:0}
.ag-pfrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.ag-pfrow label{display:flex;flex-direction:column;gap:6px;font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ag-mute)}
.ag-pfrow select{background:#232324;border:1px solid #333;border-radius:12px;color:var(--ag-ink);font:inherit;padding:9px 12px;text-transform:none;letter-spacing:0}
.ag-st-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:6px}
.ag-go{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;border:0;background:#fff;color:#161616;font:inherit;font-weight:600;cursor:pointer}
.ag-go:disabled{opacity:.4;cursor:not-allowed}
.ag-go small{font-weight:500;color:#555}
.ag-shape{display:flex;flex-wrap:wrap;gap:3px}
.ag-shape i{width:14px;height:22px;border-radius:3px;background:#2d2d2f}
.ag-shape i.is-anim{background:#ff4fa3}
.ag-crewplan{display:flex;flex-direction:column;gap:8px}
.ag-crewplan div{display:flex;align-items:center;gap:10px;font-size:.88rem}
.ag-crewplan .ag-blob{width:30px;height:30px;flex:0 0 30px}
.ag-crewplan b{font-weight:600}
.ag-crewplan span{color:var(--ag-mute)}
.ag-prog{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:22px;align-items:start}
.ag-prog-list{display:flex;flex-direction:column;gap:2px;background:#161617;border:1px solid var(--ag-line);border-radius:20px;padding:14px}
.ag-prog-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}
.ag-prog-top b{font-size:1.6rem;font-weight:600}
.ag-bar{height:6px;border-radius:999px;background:#2a2a2b;overflow:hidden;margin-bottom:10px}
.ag-bar i{display:block;height:100%;background:#fff;border-radius:999px;transition:width .4s}
.ag-step{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:12px;border:0;background:none;color:var(--ag-ink);font:inherit;text-align:left;width:100%}
.ag-step .ag-blob{width:32px;height:32px;flex:0 0 32px}
.ag-step-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.ag-step-txt b{font-size:.9rem;font-weight:600}
.ag-step-txt span{font-size:.76rem;color:var(--ag-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-step[data-state=idle]{opacity:.45}
.ag-step[data-state=working]{background:#232324}
.ag-step[data-state=working] .ag-blob{animation:agHop 1.1s ease-in-out infinite}
.ag-step-mark{font-size:.72rem;color:var(--ag-mute);flex:0 0 auto}
.ag-step[data-state=done] .ag-step-mark{color:#4ade80}
.ag-step[data-state=stuck] .ag-step-mark{color:#fbbf24}
.ag-live{display:flex;flex-direction:column;gap:14px;background:#161617;border:1px solid var(--ag-line);border-radius:20px;padding:16px;min-width:0}
.ag-live-head{display:flex;align-items:center;gap:14px}
.ag-live-head .ag-blob{width:64px;height:64px;flex:0 0 64px}
.ag-live-head b{font-size:1.2rem}
.ag-live-head span{display:block;color:var(--ag-mute);font-size:.88rem}
.ag-live-scenes{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
.ag-live-scenes img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#111;display:block}
.ag-live-empty{display:grid;place-items:center;aspect-ratio:16/9;border-radius:14px;background:repeating-linear-gradient(135deg,#1d1d1e 0 14px,#202022 14px 28px);color:var(--ag-mute);font-size:.9rem;text-align:center;padding:16px}
.ag-live video{width:100%;border-radius:12px;background:#000}
.ag-script-peek{max-height:200px;overflow:auto;font-size:.88rem;line-height:1.55;color:rgba(242,242,241,.85);background:#1f1f20;border-radius:12px;padding:12px 14px}
@media (max-width:1100px){.ag-st,.ag-prog{grid-template-columns:minmax(0,1fr)}.ag-preview{position:static}}
@media (max-width:1100px){.ag-live{order:-1}}
@media (max-width:860px){.ag-studio{padding:4px 12px 16px}.ag-modes{grid-template-columns:minmax(0,1fr)}.ag-pfrow{grid-template-columns:minmax(0,1fr)}.ag-st h3{font-size:1.45rem}}
/* ── Scene editor ── */
.ag-ed-wrap .ag-ed-player{display:flex;flex-direction:column;align-self:stretch!important;min-height:0}
.ag-ed-wrap .ag-ed-ctl.is-inbar{margin:0;flex:1;width:auto;max-width:560px;padding:4px 12px 4px 4px;background:rgba(255,255,255,.05);box-shadow:none;backdrop-filter:none}
.ag-ed-wrap .ag-ed-ctl.is-inbar .ag-round{width:28px;height:28px}
.ag-ed-wrap .ag-ed-player{padding:8px}
.ag-ed-wrap .ag-ed-bar{padding:0 2px 8px;margin-bottom:4px}
.ag-ed-wrap .ag-ed-export,.ag-ed-wrap .ag-ed-ghost{height:36px}
.ag-ed-wrap .ag-ed-tlbar{margin-top:8px!important}
.ag-ed-wrap .ag-ed-tl{padding:6px 10px 6px!important;margin-top:6px!important}
.ag-ed-wrap .ag-ed-ruler{height:14px!important;margin-bottom:4px!important}
.ag-ed-wrap .ag-ed-strip{height:42px!important}
.ag-ed-wrap .ag-ed-lane{margin-bottom:3px!important}
.ag-ed-wrap .ag-ed-caps,.ag-ed-wrap .ag-ed-caps span{height:18px!important;line-height:16px!important}
.ag-ed-wrap .ag-ed-wave{height:22px!important}
.ag-ed-wrap .ag-ed-music-bar{height:18px!important;line-height:16px!important}
/* One screen: the picture takes every pixel the bar and timeline leave. */
.ag-ed-wrap .ag-ed-player .ag-preview-frame{flex:1 1 0;min-height:0;height:auto;width:auto;max-width:100%;max-height:100%;margin:0 auto;aspect-ratio:16/9}
.ag-ed-wrap .ag-ed-player .ag-preview-frame.is-tall{aspect-ratio:9/16}
.ag-app.is-ed{height:calc(100dvh - var(--app-chrome-h, 64px) - 40px);min-height:460px}
.ag-app.is-ed .ag-main{padding:12px 14px 12px}
.ag-app.is-ed .ag-main{padding-top:16px}
.ag-ed-vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;overflow:auto;min-height:0}
.ag-ed-vid{position:relative;border-radius:18px;background:rgba(255,255,255,.045);overflow:hidden}
.ag-ed-vid.is-on{box-shadow:inset 0 0 0 2px #ff3040}
.ag-ed-vid-open{display:flex;flex-direction:column;gap:4px;width:100%;padding:0 0 12px;border:0;background:none;color:var(--ag-ink);font:inherit;text-align:left;cursor:pointer}
.ag-ed-vid-open:hover .ag-ed-vid-img{filter:brightness(1.1)}
.ag-ed-vid-img{position:relative;display:block;aspect-ratio:16/9;background:#0d0d0e center/cover no-repeat;margin-bottom:6px}
.ag-ed-vid-img i{position:absolute;left:8px;top:8px;font-style:normal;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;padding:3px 7px;border-radius:6px;background:rgba(0,0,0,.65);color:#4ade80}
.ag-ed-vid-img i.is-draft{color:#fbbf24}
.ag-ed-vid-open b{padding:0 12px;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ed-vid-open>span:last-child{padding:0 12px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.66rem;color:var(--ag-mute);text-transform:uppercase;letter-spacing:.03em}
.ag-ed-vid-x{position:absolute;right:8px;top:8px;width:26px;height:26px;border-radius:8px;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;opacity:.0;transition:opacity .15s}
.ag-ed-vid:hover .ag-ed-vid-x,.ag-ed-vid-x:focus-visible{opacity:1}
.ag-ed-whole{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;background:rgba(0,0,0,.28)}
.ag-ed-wrow{display:flex;align-items:center;gap:10px}
.ag-ed-wrow.is-col{flex-direction:column;align-items:stretch}
.ag-ed-wrow>span{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.ag-ed-wrow b{font-size:.86rem}
.ag-ed-wrow i{font-style:normal;font-size:.74rem;color:var(--ag-mute);line-height:1.35}
.ag-ed-wbtn{flex:0 0 auto;height:34px;padding:0 14px;border-radius:10px;border:0;background:#ff3040;color:#fff;font:inherit;font-weight:600;font-size:.8rem;cursor:pointer;white-space:nowrap}
.ag-ed-wbtn[disabled]{opacity:.45;cursor:default}
.ag-ed-wrap .ag-ed-seg button[disabled]{opacity:.5;cursor:default}
.ag-ed-wnote{font-style:normal;font-size:.76rem;color:#fbbf24}
.ag-ed-wnote.is-err{color:#f87171}
.ag-ed-clipbox{position:absolute;inset:0;pointer-events:none}
.ag-ed-clipbox .ag-ed-clip{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s}
.ag-ed-clipbox .ag-ed-clip.is-ready{opacity:1}
.ag-ed-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 2px 12px;border-bottom:1px solid var(--ag-line);margin-bottom:12px}
.ag-ed-back{border:0;background:none;color:var(--ag-mute);font:inherit;font-size:.86rem;cursor:pointer;padding:6px 8px;border-radius:8px}
.ag-ed-back:hover{color:var(--ag-ink);background:#232324}
.ag-ed-title{font-size:1rem;font-weight:600;max-width:40ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-ed-badge{font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#2a2a2b;color:#fbbf24}
.ag-ed-badge.is-done{color:#4ade80}
.ag-ed-sp{flex:1}
.ag-ed-ghost{height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--ag-line);color:var(--ag-ink);text-decoration:none;display:inline-flex;align-items:center;font-size:.86rem}
.ag-ed-export{height:36px;padding:0 18px;border-radius:999px;border:0;background:#ff3040;color:#fff;font:inherit;font-weight:600;font-size:.88rem;cursor:pointer}
.ag-ed-export[disabled]{opacity:.5}
.ag-ed-tabs{display:flex;gap:2px;padding:4px;border-radius:14px;background:#1d1d1e;overflow-x:auto}
.ag-ed-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 10px;border:0;border-radius:10px;background:none;color:var(--ag-mute);font:inherit;font-size:.82rem;cursor:pointer;white-space:nowrap}
.ag-ed-tabs button .ag-blob{width:18px;height:18px}
.ag-ed-tabs button.is-on{background:#2c2c2d;color:var(--ag-ink);font-weight:600}
.ag-ed-body{display:flex;flex-direction:column;gap:10px;background:#161617;border:1px solid var(--ag-line);border-radius:16px;padding:14px;min-width:0}
.ag-ed-sec{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ag-mute);margin-top:4px}
.ag-ed-sl{display:flex;flex-direction:column;gap:6px;font-size:.82rem}
.ag-ed-sl>span{display:flex;justify-content:space-between;color:var(--ag-mute)}
.ag-ed-sl b{color:#ff3040;font-weight:600}
.ag-ed-sl input[type=range]{accent-color:#ff3040}
.ag-ed-select{height:38px;border-radius:10px;border:1px solid var(--ag-line);background:#101011;color:var(--ag-ink);font:inherit;padding:0 10px}
.ag-ed-sw{display:flex;gap:6px;flex-wrap:wrap}
.ag-ed-sw button{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:var(--c);cursor:pointer}
.ag-ed-sw button.is-on{box-shadow:0 0 0 2px #1a1a1b,0 0 0 4px #ff3040}
.ag-ed-seg{display:flex;gap:4px;padding:3px;border-radius:10px;background:#101011}
.ag-ed-seg button{flex:1;height:30px;border:0;border-radius:8px;background:none;color:var(--ag-mute);font:inherit;font-size:.8rem;cursor:pointer}
.ag-ed-seg button.is-on{background:#ff3040;color:#fff;font-weight:600}
.ag-ed-tlbar{flex:0 0 auto;display:flex;align-items:center;gap:12px;margin-top:12px;font-size:.84rem}
.ag-ed-zoom{display:flex;align-items:center;gap:8px;color:var(--ag-mute);font-size:.78rem}
.ag-ed-zoom input{width:120px;accent-color:#ff3040}
.ag-ed-ruler{position:relative;height:16px;margin-bottom:4px}
.ag-ed-ruler span{position:absolute;top:0;font-size:.62rem;color:var(--ag-mute);transform:translateX(-50%)}
.ag-ed-lane{display:grid;grid-template-columns:74px auto;align-items:center;margin-bottom:6px}
.ag-ed-lane .ag-ed-lab{margin:0}
.ag-ed-caps{position:relative;height:24px}
.ag-ed-caps span{position:absolute;top:0;height:24px;border-radius:5px;background:rgba(56,189,248,.18);border:1px solid rgba(56,189,248,.35);color:#bfe6fb;font-size:.6rem;line-height:22px;padding:0 4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box}
.ag-ed-music-bar{height:24px;border-radius:6px;background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.35);color:#a7f3c0;font-size:.68rem;line-height:22px;padding:0 8px;cursor:pointer;box-sizing:border-box;white-space:nowrap;overflow:hidden}
.ag-ed-music-bar.is-off{background:none;border-style:dashed;border-color:rgba(255,255,255,.15);color:var(--ag-mute)}
.ag-ed-wrap{display:flex;flex-direction:column;overflow:hidden;padding-bottom:12px}
/* Editor skin (Higgsfield-like): near-black, borderless tinted panels, Space Grotesk + mono labels */
.ag-app.is-ed{background:#131416;border-color:rgba(255,255,255,.06)}
.ag-ed-wrap{--ed-panel:rgba(255,255,255,.045);--ed-panel2:rgba(255,255,255,.07);--ed-acc:#ff3040;--ed-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--ed-disp:'Space Grotesk',Inter,system-ui,sans-serif;font-family:Inter,system-ui,sans-serif}
.ag-ed-wrap .ag-ed-bar{border-bottom:0;padding:2px 2px 14px;margin-bottom:6px}
.ag-ed-wrap .ag-ed-title{font-family:var(--ed-disp);font-weight:700;text-transform:uppercase;letter-spacing:-.02em;font-size:1.25rem}
.ag-ed-wrap .ag-ed-back{font-family:var(--ed-mono);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;background:var(--ed-panel);border-radius:10px;padding:8px 12px}
.ag-ed-wrap .ag-ed-badge{font-family:var(--ed-mono);font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;background:rgba(251,191,36,.12);border-radius:8px}
.ag-ed-wrap .ag-ed-badge.is-done{background:rgba(74,222,128,.12)}
.ag-ed-wrap .ag-ed-bar>.ag-note{font-family:var(--ed-mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.04em}
.ag-ed-wrap .ag-ed-ghost{border:0;background:var(--ed-panel2);border-radius:12px;height:42px;font-weight:500}
.ag-ed-wrap .ag-ed-export{height:42px;border-radius:12px;padding:0 22px;font-family:var(--ed-disp);font-weight:700;text-transform:uppercase;letter-spacing:.02em;box-shadow:0 10px 28px rgba(255,48,64,.32),inset 0 1px 0 rgba(255,255,255,.25);background:linear-gradient(180deg,#ff4655,#ff2238)}
.ag-ed-wrap .ag-ed-export:hover{filter:brightness(1.06)}
.ag-ed-wrap .ag-ed{gap:14px}
.ag-ed-wrap .ag-ed-side{gap:10px}
.ag-ed-wrap .ag-ed-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0;background:none;overflow:visible}
.ag-ed-wrap .ag-ed-tabs button{justify-content:flex-start;gap:10px;height:auto;padding:8px 10px;border-radius:14px;background:var(--ed-panel);text-align:left;transition:background .15s}
.ag-ed-wrap .ag-ed-tabs button:hover{background:var(--ed-panel2)}
.ag-ed-wrap .ag-ed-tabs button.is-on{background:rgba(255,48,64,.12);box-shadow:inset 0 0 0 1px rgba(255,48,64,.55)}
.ag-ed-ti{flex:0 0 34px;width:34px;height:34px;border-radius:10px;background:rgba(0,0,0,.35);display:grid;place-items:center}
.ag-ed-wrap .ag-ed-tabs .ag-ed-ti .ag-blob{width:22px;height:22px}
.ag-ed-tt{display:flex;flex-direction:column;min-width:0;line-height:1.2}
.ag-ed-tt i{font-style:normal;font-family:var(--ed-mono);font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ag-mute)}
.ag-ed-tt b{font-size:.84rem;font-weight:600;color:var(--ag-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-ed-wrap .ag-ed-body{background:var(--ed-panel);border:0;border-radius:20px;padding:16px;gap:12px}
.ag-ed-wrap .ag-ed-sec{font-family:var(--ed-mono);font-size:.64rem;letter-spacing:.08em;color:rgba(242,242,241,.45);display:flex;align-items:center;gap:8px}
.ag-ed-wrap .ag-ed-sec::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
.ag-ed-wrap .ag-capgrid{gap:8px}
.ag-ed-wrap .ag-capcard{background:rgba(0,0,0,.28);border:0;border-radius:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
.ag-ed-wrap .ag-capcard.is-on{box-shadow:inset 0 0 0 2px var(--ed-acc);background:rgba(255,48,64,.08)}
.ag-ed-wrap .ag-ed-sl{font-size:.8rem;gap:8px}
.ag-ed-wrap .ag-ed-sl>span{color:rgba(242,242,241,.7)}
.ag-ed-wrap .ag-ed-sl b{font-family:var(--ed-mono);font-size:.7rem;color:#fff;background:rgba(255,48,64,.85);padding:2px 7px;border-radius:6px}
.ag-ed-wrap input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;background:rgba(255,255,255,.1);outline:none}
.ag-ed-wrap input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--ed-acc);box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer}
.ag-ed-wrap input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid var(--ed-acc)}
.ag-ed-wrap .ag-ed-select{height:42px;border:0;border-radius:12px;background:rgba(0,0,0,.35);font-size:.86rem}
.ag-ed-wrap .ag-ed-sw{gap:8px}
.ag-ed-wrap .ag-ed-sw button{width:30px;height:30px;border-radius:10px;border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
.ag-ed-wrap .ag-ed-sw button.is-on{box-shadow:0 0 0 2px #1b1c1e,0 0 0 4px var(--ed-acc)}
.ag-ed-wrap .ag-ed-seg{background:rgba(0,0,0,.35);border-radius:12px;padding:4px}
.ag-ed-wrap .ag-ed-seg button{height:32px;border-radius:9px;font-size:.78rem}
.ag-ed-wrap .ag-ed-seg button.is-on{background:#fff;color:#141414}
.ag-ed-wrap .ag-ed-player{background:var(--ed-panel);border:0;border-radius:22px;padding:12px;position:relative}
.ag-ed-wrap .ag-preview-frame{border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.ag-ed-wrap .ag-ed-ctl{flex:0 0 auto;margin:10px auto 0;position:relative;z-index:2;width:min(100%,720px);padding:8px 14px 8px 8px;border-radius:999px;background:rgba(14,14,16,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.08);font-family:var(--ed-mono);font-size:.72rem;color:rgba(255,255,255,.8)}
.ag-ed-wrap .ag-ed-ctl .ag-round{width:34px;height:34px;background:#fff;color:#111;border:0}
.ag-ed-wrap .ag-ed-ctl input[type=range]{height:4px}
.ag-ed-wrap .ag-ed-tlbar{margin-top:10px;font-family:var(--ed-mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(242,242,241,.55)}
.ag-ed-wrap .ag-ed-tlbar b{font-family:var(--ed-disp);font-size:.95rem;letter-spacing:-.01em;color:var(--ag-ink)}
.ag-ed-wrap .ag-ed-tlbar .ag-note{font-family:inherit;font-size:inherit}
.ag-ed-wrap .ag-ed-zoom{background:var(--ed-panel);border-radius:10px;padding:6px 12px}
.ag-ed-wrap .ag-ed-tl{background:var(--ed-panel);border:0;border-radius:20px;padding:10px 12px 12px;margin-top:8px}
.ag-ed-wrap .ag-ed-ruler{height:18px;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:8px}
.ag-ed-wrap .ag-ed-ruler span{font-family:var(--ed-mono);font-size:.6rem;color:rgba(242,242,241,.4)}
.ag-ed-wrap .ag-ed-lane{margin-bottom:5px}
.ag-ed-wrap .ag-ed-lab{font-family:var(--ed-mono);font-size:.6rem;letter-spacing:.06em;color:rgba(242,242,241,.42)}
.ag-ed-wrap .ag-ed-strip{height:50px;gap:0}
.ag-ed-wrap .ag-ed-scene{border-radius:10px;margin-right:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.ag-ed-wrap .ag-ed-scene:hover{filter:brightness(1.12)}
.ag-ed-wrap .ag-ed-scene.is-sel{box-shadow:inset 0 0 0 2px var(--ed-acc),0 0 0 3px rgba(255,48,64,.25)}
.ag-ed-wrap .ag-ed-scene.is-now::before{background:var(--ed-acc)}
.ag-ed-wrap .ag-ed-caps span{border-radius:7px;background:rgba(255,255,255,.07);border:0;color:rgba(242,242,241,.8);font-family:var(--ed-mono);font-size:.56rem}
.ag-ed-wrap .ag-ed-music-bar{border-radius:8px;background:rgba(74,222,128,.12);border:0;font-family:var(--ed-mono);font-size:.64rem}
.ag-ed-wrap .ag-ed-music-bar.is-off{background:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.ag-ed-wrap .ag-ed-ph{width:2px;background:var(--ed-acc);box-shadow:0 0 12px rgba(255,48,64,.6)}
.ag-ed-wrap .ag-ed-ph::before{content:'';position:absolute;top:-4px;left:50%;width:12px;height:12px;margin-left:-6px;border-radius:4px 4px 50% 50%;background:var(--ed-acc)}
.ag-ed-wrap .ag-ed-scene-card img{border-radius:14px}
.ag-ed-wrap .ag-ed-quote{background:rgba(0,0,0,.3);border-radius:14px}
.ag-ed-wrap .ag-host{background:none;padding:0}
.ag-ed-wrap .ag-ed{flex:1;min-height:0;overflow:hidden;align-items:stretch}
.ag-ed-wrap .ag-ed-side{min-height:0;overflow:auto;padding-right:4px}
.ag-ed-wrap .ag-ed-tl{flex:0 0 auto;margin-top:12px}
.ag-ed-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.ag-ed{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);gap:18px;align-items:start}
.ag-ed-side{display:flex;flex-direction:column;gap:12px;min-width:0}
.ag-ed-player{display:flex;flex-direction:column;gap:10px;background:#161617;border:1px solid var(--ag-line);border-radius:20px;padding:12px;min-width:0}
.ag-ed-player .ag-preview-frame video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ag-ed-player .ag-cap .hot{color:var(--hl)}
.ag-ed-ctl{display:flex;align-items:center;gap:10px;font-size:.82rem;color:var(--ag-mute)}
.ag-ed-ctl input[type=range]{flex:1;min-width:0;accent-color:#fff}
.ag-ed-tl{margin-top:16px;background:#161617;border:1px solid var(--ag-line);border-radius:16px;padding:10px 10px 12px;overflow-x:auto;overscroll-behavior-x:contain}
.ag-ed-lanes{position:relative}
.ag-ed-lab{font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ag-mute);margin:2px 0 4px}
.ag-ed-strip{display:flex;height:62px}
.ag-ed-scene{flex:0 0 auto;height:100%;border:0;padding:0;margin-right:2px;border-radius:6px;background:#2a2a2b center/cover no-repeat;position:relative;cursor:pointer}
.ag-ed-scene.is-sel{box-shadow:inset 0 0 0 2px #fff}
.ag-ed-scene.is-now::before{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:#fff;border-radius:0 0 6px 6px}
.ag-ed-scene.is-anim::after{content:'';position:absolute;right:4px;top:4px;width:8px;height:8px;border-radius:50%;background:#ff4fa3;box-shadow:0 0 0 2px rgba(0,0,0,.4)}
.ag-ed-scene .ag-ed-busy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.55);border-radius:6px;font-size:.62rem;color:#fff}
.ag-ed-scene:focus-visible{outline:2px solid #fff;outline-offset:1px}
.ag-ed-wave{display:block;height:30px}
.ag-ed-ph{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;pointer-events:none;border-radius:2px}
.ag-ed-scene-card{display:flex;flex-direction:column;gap:10px}
.ag-ed-scene-card img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#111}
.ag-ed-quote{font-size:.88rem;line-height:1.5;color:rgba(242,242,241,.85);background:#1f1f20;border-radius:12px;padding:10px 12px}
.ag-ed-music{display:flex;flex-direction:column;gap:6px}
.ag-ed-music div{display:flex;align-items:center;gap:8px}
.ag-ed-music .ag-chip{flex:1;justify-content:flex-start}
@media (max-width:1100px){.ag-ed{grid-template-columns:minmax(0,1fr)}.ag-ed-player{order:-1}}
@media (max-width:860px){.ag-ed-wrap{overflow:auto}.ag-ed-wrap .ag-ed{flex:none;overflow:visible}}
@media (prefers-reduced-motion:reduce){.ag-blob .eyes,.ag-ava .ag-blob,.ag-building .ag-blob,.ag-dot,.ag-step .ag-blob{animation:none!important}}
`

export function initAgentsChat({ root, getUser, openWizard } = {}) {
  if (!root) return null
  if (!document.getElementById('ag-style')) {
    const st = document.createElement('style')
    st.id = 'ag-style'
    st.textContent = CSS
    document.head.appendChild(st)
  }
  if (!document.querySelector('link[data-ag-font]')) {
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap'
    l.dataset.agFont = '1'
    document.head.appendChild(l)
  }

  let selected = 'manager'
  let mine = []
  try { mine = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]') } catch (_) { mine = [] }
  const drafts = {}
  let popOpen = false
  let keptVideo = null
  let keptVideoSrc = ''
  let pending = ''
  const nicheKey = () => {
    let u = null
    try { u = getUser?.() } catch (_) {}
    return 'vidso_niche:' + String(u?.email || u?.id || 'guest').toLowerCase()
  }
  const loadNiche = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(nicheKey()) || 'null')
      if (!raw) return null
      return raw.id === 'custom' ? customNiche(raw.name) : nicheById(raw.id)
    } catch (_) { return null }
  }
  let niche = loadNiche()
  let nicheFor = nicheKey()
  let changingNiche = false
  let pickerShown = false
  const ideasNow = () => (niche?.ideas?.length ? niche.ideas : IDEAS)
  function setNiche(n) {
    niche = n
    changingNiche = false
    try {
      if (n) localStorage.setItem(nicheKey(), JSON.stringify({ id: n.id, name: n.name }))
      else localStorage.removeItem(nicheKey())
    } catch (_) {}
    if (n) {
      const pay = n.pay && PAY[n.pay] ? ' ' + PAY[n.pay].note : ''
      say('manager', 'manager', `Great choice: ${n.name}.${pay} Here are four videos that fit what's breaking out right now. Pick one, or send me your own topic.`, 'ideas')
    }
  }
  const profilesKey = () => nicheKey().replace('vidso_niche:', 'vidso_profiles:')
  const loadProfiles = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(profilesKey()) || '{}')
      return { list: (Array.isArray(raw.list) ? raw.list : []).map(normalizeProfile), active: raw.active || '' }
    } catch (_) { return { list: [], active: '' } }
  }
  let profiles = loadProfiles()
  let profilesFor = profilesKey()
  let profileView = ''   // '' | 'list' | 'edit'
  let profileDraft = null
  let scriptMode = false
  let visualsView = false
  let charBusy = false
  let charError = ''
  let scriptDraft = { title: '', text: '' }
  // Studio: '' (chat) | 'profile' | 'script' | 'settings' | 'progress'
  let studio = ''
  const chatRoot = root
  let edHosted = false // the Editor page borrows this chat's scene editor
  let edPicker = false // the Editor's list of saved videos
  let edWhole = '' // '' | 'animate' | 'pace' | 'length': a whole-video change in progress
  let edWholeMsg = ''
  let edAnimAll = null // { done, total }
  let edAutoOpened = false
  let edOpenErr = ''
  let profileTab = 'style'
  let pw = null // brand profile being set up in the studio
  let pwFrom = '' // where the profile setup returns to
  let brief = { mode: 'write', topic: '' }
  let visualsReturn = ''
  let scrollToVideo = false
  let pastVideo = null // last finished video from My Files, when this tab has none loaded
  // Scene editor
  let edTab = 'scenes'
  let edSel = 0
  const edBusy = {}
  const edPrompt = {}
  let edErr = ''
  let edAudio = null
  let edRendering = false
  let ED_PPS = 14 // timeline pixels per second (the zoom slider changes it)
  // Channel setup the Manager runs after signup (see lib/onboarding.js)
  const setupKey = () => nicheKey().replace('vidso_niche:', 'vidso_setup:')
  const setupDoneKey = () => nicheKey().replace('vidso_niche:', 'vidso_setup_done:')
  const loadSetup = () => { try { return JSON.parse(localStorage.getItem(setupKey()) || 'null') } catch (_) { return null } }
  let setup = loadSetup() // { step, answers } while the setup is running
  if (setup?.step === 'niche') setup.step = 'genre'
  let setupFor = setupKey()
  let suAll = false // show every style / voice instead of the short list
  const setupDone = () => { try { return localStorage.getItem(setupDoneKey()) === '1' } catch (_) { return false } }
  const saveSetup = () => { try { if (setup) localStorage.setItem(setupKey(), JSON.stringify(setup)); else localStorage.removeItem(setupKey()) } catch (_) {} }
  const saveProfiles = () => { try { localStorage.setItem(profilesKey(), JSON.stringify(profiles)) } catch (_) {} }
  const activeProfile = () => profiles.list.find((p) => p.id === profiles.active) || null
  function applyProfile(p) {
    if (!p) return
    profiles.active = p.id
    saveProfiles()
    if (p.niche) {
      const n = nicheById(p.niche) || customNiche(p.niche)
      if (n) { niche = n; try { localStorage.setItem(nicheKey(), JSON.stringify({ id: n.id, name: n.name })) } catch (_) {} }
    }
    try { if (p.voiceId) window.fvAgentsVoice?.(p.voiceId) } catch (_) {}
    try { if (p.captionStyle) window.fvSetCaptionStyle?.(p.captionStyle); else if (p.captions) window.fvSetCaptionLook?.(p.captions) } catch (_) {}
    try { window.fvSetDuration?.(p.durationId) } catch (_) {}
    try { window.fvSetAspect?.(p.aspect) } catch (_) {}
    try { window.fvAgentsAngle?.(p.angle) } catch (_) {}
    try { window.fvSetVisual?.({ style: p.visualStyle || DEFAULT_STYLE, mode: p.visualMode || 'cheapest', pace: p.scenePace || 'normal', characterUrl: p.characterUrl || '', characterDesc: p.characterDesc || '' }) } catch (_) {}
  }
  let previewAudio = null
  let previewSrc = ''

  const save = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(mine.slice(-200))) } catch (_) {} }
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  const say = (to, from, text, kind, extra) => { mine.push({ at: Date.now(), to, from, text: String(text || ''), kind: kind || '', ch: profiles.active || '', ...(extra || {}) }); save() }
  /** True when the video in progress (or just made) belongs to the channel on screen. */
  const videoHere = () => { try { const ch = localStorage.getItem(VIDEO_CH_KEY); return !ch || !profiles.active || ch === profiles.active } catch (_) { return true } }
  const markVideo = () => { try { localStorage.setItem(VIDEO_CH_KEY, profiles.active || '') } catch (_) {} }
  const canAddChannel = () => profiles.list.length < MAX_CHANNELS
  // The team's progress lines live in the page, so keep a copy: a reload must not wipe them.
  const loadRun = () => { try { return JSON.parse(localStorage.getItem(RUN_KEY) || 'null') } catch (_) { return null } }
  let savedRun = loadRun()
  function keepRun(st) {
    if (!st?.log?.length || !videoHere()) return
    savedRun = { ch: profiles.active || '', topic: String(st.topic || '').slice(0, 300), log: st.log.slice(-60), running: !!st.running, serverSide: !!st.serverSide, done: !!st.renderUrl, at: Date.now() }
    try { localStorage.setItem(RUN_KEY, JSON.stringify(savedRun)) } catch (_) {}
  }
  /** After a reload the live run is gone: show its saved lines, and say so once if it was still going. */
  function runLog(st) {
    if (st?.log?.length) return st.log
    if (!savedRun || (savedRun.ch && profiles.active && savedRun.ch !== profiles.active)) return []
    // A server-side video keeps going on its own; it reappears once the page reconnects.
    if (savedRun.running && !savedRun.serverSide) {
      savedRun.running = false
      try { localStorage.setItem(RUN_KEY, JSON.stringify(savedRun)) } catch (_) {}
      const topic = savedRun.topic
      const lastStep = [...savedRun.log].reverse().find((e) => e.text)
      say('manager', 'manager', `The page reloaded while the team was working${topic ? ` on “${topic}”` : ''}${lastStep ? ` (${BY_ID[lastStep.agent]?.name || 'the team'} was on: ${String(lastStep.text).slice(0, 80)})` : ''}, so that video stopped. Want me to start it again?`, topic ? 'first-episode' : '', topic ? { topic } : undefined)
    }
    return savedRun.log
  }
  // Leaving the page stops a video that is still being made, so ask first.
  window.addEventListener('beforeunload', (e) => {
    const st = state()
    if ((st?.running || st?.busyScript) && !st?.serverSide) { e.preventDefault(); e.returnValue = '' }
  })
  const capNote = () => { say('manager', 'manager', `You're running ${MAX_CHANNELS} channels, the most one account can have. Delete one under Brand to start another.`); render() }

  function lastFor(id, st) {
    const log = (st?.log || []).filter((e) => e.agent === id)
    const own = mine.filter((m) => m.to === id)
    const a = log[log.length - 1]
    const b = own[own.length - 1]
    if (a && (!b || a.at >= b.at)) return a.text
    if (b) return (b.from === 'me' ? 'You: ' : '') + b.text
    return BY_ID[id].role
  }

  function ava(id, st, cls = '', color = '') {
    const s = st?.crew?.[id]?.state || 'idle'
    return `<span class="ag-ava" data-state="${esc(s)}">${agentSvg(id, cls, color)}<i class="ag-dot"></i></span>`
  }
  const mgrColor = (p, i) => (p && MANAGER_COLORS.includes(p.managerColor) ? p.managerColor : MANAGER_DEFAULTS[i % MANAGER_DEFAULTS.length])
  let colorFor = '' // channel id whose colour picker is open

  function sideHtml(st) {
    const user = (() => { try { return getUser?.() } catch (_) { return null } })()
    const name = user?.name || user?.full_name || user?.email || 'You'
    const initials = String(name).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ME'
    return `
      <div class="ag-side-head"><h2>Agents</h2>
        <button type="button" class="ag-icon-btn" data-ag-new aria-label="New video"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      <div class="ag-list ag-mgr-list" role="group" aria-label="Your channels">${Array.from({ length: MAX_CHANNELS }, (_, i) => {
        const p = profiles.list[i]
        if (!p) return `<button type="button" class="ag-row ag-mgr-add" data-ag-ch-add title="Set up another channel"><span class="ag-mgr-plus" aria-hidden="true">+</span><span class="ag-row-txt"><b>New channel</b><span>Up to ${MAX_CHANNELS} channels, one Manager each</span></span></button>`
        const on = selected === 'manager' && profiles.active === p.id
        const col = mgrColor(p, i)
        const last = [...mine].reverse().find((m) => m.to === 'manager' && m.from === 'manager' && m.ch === p.id && !/^(Using|Saved) the .+ profile/.test(m.text))
        const sub = profiles.active === p.id && videoHere() && st?.running ? 'Making a video…' : last ? last.text : 'Manager'
        return `<button type="button" class="ag-row ag-mgr${on ? ' is-on' : ''}" data-ag-ch="${esc(p.id)}" aria-pressed="${on}" title="${on ? 'Change the colour of this Manager' : 'Open ' + esc(p.name)}">${profiles.active === p.id ? ava('manager', videoHere() ? st : null, '', col) : `<span class="ag-ava">${agentSvg('manager', '', col)}</span>`}<span class="ag-row-txt"><b>${esc(p.name)}</b><span>${esc(String(sub).slice(0, 80))}</span></span></button>${colorFor === p.id ? `<div class="ag-colors" role="radiogroup" aria-label="Manager colour">${MANAGER_COLORS.map((col) => { const i = profiles.list.findIndex((p) => p.id === colorFor); const on = mgrColor(profiles.list[i], i) === col; return `<button type="button" class="ag-color${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-ag-color="${col}" style="--c:${col}" aria-label="Colour ${col}"></button>` }).join('')}</div>` : ''}`
      }).join('')}</div>
      <div class="ag-me"><i>${esc(initials)}</i><span>${esc(String(name).slice(0, 40))}</span></div>`
  }

  // ── threads ────────────────────────────────────────────────────────────
  function entriesFor(id, st) {
    const log = (videoHere() ? runLog(st) : [])
      .filter((e) => id === 'manager' || e.agent === id)
      .filter((e) => !(e.agent === 'manager' && /^Running the whole video$/.test(e.text)))
      .map((e) => ({ ...e, type: 'log' }))
    // Chats from before channels had their own Manager belong to the channel that was active.
    if (profiles.active) mine.forEach((m) => { if (m.ch === undefined) m.ch = profiles.active })
    const own = mine.filter((m) => m.to === id && (!m.ch || !profiles.active || m.ch === profiles.active)).map((m) => ({ ...m, type: 'mine' }))
    return [...log, ...own].sort((a, b) => a.at - b.at)
  }

  function artifactFor(agent, st) {
    const s = st?.script
    if (agent === 'title' && s?.options?.length) {
      return `<div class="ag-card"><div class="ag-card-label">Title options · click to use</div>
        <div class="ag-chips">${s.options.map((o, i) => `<button type="button" class="ag-chip${o.title === s.title ? ' is-on' : ''}" data-ag-title="${i}">${esc(o.title)}</button>`).join('')}</div></div>`
    }
    if (agent === 'thumbnail' && st?.thumb) {
      const t = st.thumb
      if (t.url) {
        return `<div class="ag-card"><div class="ag-card-label">Thumbnail · ${esc(t.style || '')}</div><img src="${esc(t.url)}" alt="Thumbnail">
          <div class="ag-chips"><a class="ag-chip" href="${esc(t.url)}" target="_blank" rel="noopener" download>Download</a><button type="button" class="ag-chip" data-ag-thumb>Another style</button></div></div>`
      }
      if (t.error) return `<div class="ag-card"><div class="ag-card-label">Thumbnail</div><div>${esc(t.error)}</div><div class="ag-chips"><button type="button" class="ag-chip" data-ag-thumb>Try again</button></div></div>`
      return ''
    }
    if (agent === 'script' && s?.sections?.length) {
      return `<div class="ag-card"><div class="ag-card-label">Script · ${Number(s.words || 0).toLocaleString()} words${s.hook ? ' · ' + esc(String(s.hook).toLowerCase()) + ' hook' : ''}</div>
        <details><summary class="ag-chip" style="list-style:none">Read the script</summary><div class="ag-script">${s.sections.map((x) => `<h4>${esc(x.heading)}</h4><div>${esc(x.text)}</div>`).join('')}</div></details></div>`
    }
    if (agent === 'voice' && st?.media?.voiceover) {
      return `<div class="ag-card"><div class="ag-card-label">Narration</div><audio controls preload="none" src="${esc(st.media.voiceover)}" style="width:100%"></audio></div>`
    }
    if (agent === 'editor' && st?.renderUrl) return deliveryHtml(st)
    if (agent === 'publish' && st?.publish?.description) return `<div class="ag-card">${publishHtml(st).replace('<details class="ag-publish">', '<details class="ag-publish" open>')}</div>`
    return ''
  }

  function deliveryHtml(st) {
    const s = st.script || {}
    const t = st.thumb || {}
    const others = (s.options || []).filter((o) => o.title !== s.title)
    const file = (String(s.title || 'vidso-video').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'vidso-video') + '.mp4'
    return `<div class="ag-card">
      <div class="ag-card-label">Your video${st.madeIn ? ' · made in ' + esc(st.madeIn) : ''}</div>
      <div data-ag-keep="video"></div>
      <div class="ag-card-title">${esc(s.title || 'Untitled')}</div>
      ${others.length ? `<div class="ag-chips">${others.map((o) => `<button type="button" class="ag-chip" data-ag-title-o="${esc(o.title)}">${esc(o.title)}</button>`).join('')}</div>` : ''}
      ${t.url ? `<img src="${esc(t.url)}" alt="Thumbnail">` : t.busy ? '<div class="ag-card-label">Thumbnail is still designing…</div>' : ''}
      <div class="ag-chips">
        <a class="ag-chip is-primary" href="${esc(st.renderUrl)}" download="${esc(file)}">Download video</a>
        ${t.url ? `<a class="ag-chip" href="${esc(t.url)}" target="_blank" rel="noopener" download>Download thumbnail</a>` : ''}
        <button type="button" class="ag-chip" data-ag-copy>Copy title</button>
        <button type="button" class="ag-chip" data-ag-yt>Upload to YouTube</button>
        ${(() => { try { return window.fvSceneProject?.() ? '<button type="button" class="ag-chip" data-ed-open>Edit scenes</button>' : '' } catch (_) { return '' } })()}
      </div>
      ${publishHtml(st)}
      <div class="ag-card-label" data-yt-status hidden></div>
    </div>`
  }

  function publishHtml(st) {
    const p = st?.publish
    if (!p) return ''
    if (p.busy) return '<div class="ag-card-label">Publish is writing the description and tags…</div>'
    if (!p.description) return p.error ? `<div class="ag-card-label">${esc(p.error)}</div>` : ''
    return `<details class="ag-publish"><summary class="ag-chip">Description, ${p.tags.length} tags${p.chapters.length ? ', ' + p.chapters.length + ' chapters' : ''}</summary>
      <pre class="ag-desc">${esc(p.full)}</pre>
      <div class="ag-chips">${p.tags.map((t) => `<span class="ag-tag">${esc(t)}</span>`).join('')}</div>
      <div class="ag-chips"><button type="button" class="ag-chip" data-ag-copy-desc>Copy description</button><button type="button" class="ag-chip" data-ag-copy-tags>Copy tags</button><button type="button" class="ag-chip" data-ag-publish-again>Rewrite</button></div>
    </details>`
  }

  function filterStyles(q, group) {
    const search = root.querySelector('[data-vs-search]')
    if (search && search.value !== q) search.value = q
    root.querySelectorAll('[data-vs-group]').forEach((b) => b.classList.toggle('is-on', b.dataset.vsGroup === group))
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean)
    let shown = 0
    root.querySelectorAll('[data-vs-grid] [data-vs-style]').forEach((b) => {
      const ok = (!group || b.dataset.group === group) && words.every((w) => b.dataset.name.includes(w))
      b.hidden = !ok
      if (ok) shown++
    })
    const empty = root.querySelector('[data-vs-empty]')
    if (empty) empty.hidden = shown > 0
  }

  function visualsLabel(v) {
    const s = visualStyleById(v?.style) || visualStyleById(DEFAULT_STYLE)
    return [s.name, visualModeById(v.mode).name, scenePaceById(v.pace).name + ' pace', v.characterUrl ? 'with a character' : ''].filter(Boolean).join(' · ')
  }

  function visualsHtml(st) {
    const v = { ...(st?.visual || {}) }
    if (!visualStyleById(v.style)) v.style = DEFAULT_STYLE
    const cur = visualStyleById(v.style)
    return `<div class="ag-profiles ag-visuals">
      <h3>Visuals</h3>
      <p>Every scene is drawn by AI in one art style, matched to what the narration says. ${VISUAL_STYLES.length} styles. Applies to the next video.</p>
      <div class="ag-style-current"><img src="${esc(styleSample(cur.id, activeProfile()?.genre))}" alt=""><div><span class="ag-card-label">Style</span><b>${esc(cur.name)}</b></div></div>
      <input class="ag-style-search" data-vs-search type="search" placeholder="Search ${VISUAL_STYLES.length} styles" aria-label="Search styles" autocomplete="off">
      <div class="ag-chips" role="group" aria-label="Style groups"><button type="button" class="ag-chip is-on" data-vs-group="">All</button>${STYLE_GROUPS.map((g) => `<button type="button" class="ag-chip" data-vs-group="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="ag-style-grid ag-style-scroll" data-vs-grid>${VISUAL_STYLES.map((x) => `
        <button type="button" class="ag-style${x.id === v.style ? ' is-on' : ''}" data-vs-style="${esc(x.id)}" data-group="${esc(x.group)}" data-name="${esc((x.name + ' ' + x.group + ' ' + x.prompt).toLowerCase())}" aria-pressed="${x.id === v.style}"><img src="${esc(styleSample(x.id, activeProfile()?.genre))}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>
      <div class="ag-note" data-vs-empty hidden style="padding:0">No style matches that. Try another word.</div>
      <div class="ag-field"><span class="ag-card-label">Visual mode</span><div class="ag-chips">${VISUAL_MODES.map((m) => `<button type="button" class="ag-chip${m.id === (v.mode || 'cheapest') ? ' is-on' : ''}" data-vs-mode="${esc(m.id)}" title="${esc(m.note)}">${esc(m.name)} · ${esc(m.note)}</button>`).join('')}</div></div>
      <div class="ag-field"><span class="ag-card-label">Scene pace</span><div class="ag-chips">${SCENE_PACES.map((p) => `<button type="button" class="ag-chip${p.id === (v.pace || 'normal') ? ' is-on' : ''}" data-vs-pace="${esc(p.id)}">${esc(p.name)} · new scene every ${p.seconds}s</button>`).join('')}</div></div>
      <div class="ag-field"><span class="ag-card-label">Consistent character (optional)</span>
        ${v.characterUrl ? `<div class="ag-char"><img src="${esc(v.characterUrl)}" alt="Character reference"><div><b>${esc(v.characterDesc || 'Your character')}</b><span>Appears in every scene where a person fits.</span><div class="ag-chips"><button type="button" class="ag-chip" data-vs-char-clear>Remove</button></div></div></div>` : `
        <form class="ag-char-form" data-vs-char-form><input id="ag-char-desc" maxlength="200" placeholder="e.g. a bald man in his 40s with a grey beard, round glasses and a brown leather jacket" value="${esc(v.characterDesc || '')}" autocomplete="off"><button type="submit" class="ag-chip is-primary"${charBusy ? ' disabled' : ''}>${charBusy ? 'Drawing…' : 'Create character'}</button></form>${charError ? `<div class="ag-note" style="padding:0">${esc(charError)}</div>` : ''}`}
      </div>
      <div class="ag-chips"><button type="button" class="ag-chip is-primary" data-vs-done>Done</button></div>
    </div>`
  }


  // ── Studio screens ─────────────────────────────────────────────────────
  function hostHtml(key, extra = '') {
    const h = HOSTS[key]
    const a = BY_ID[h.agent]
    return `<div class="ag-host">${agentSvg(h.agent)}<div class="ag-host-say"><b>${esc(a.name)}</b>${esc(extra || h.line)}</div></div>`
  }
  function looksList() { try { return window.fvCaptionLooks?.() || [] } catch (_) { return [] } }
  /** Caption spec from a preset look (Agents picker) in the renderer's terms: size is px at 1080p. */
  function specFromLook(l) {
    if (!l) return null
    return { name: l.name, font: `'${l.font}', Impact, sans-serif`, size: Number(l.size) || 64, color: l.base || '#fff', hl: l.hl || '#fff', stroke: !!l.stroke, strokeColor: l.stroke || '#000', strokeW: Number(l.strokeW) || 0, shadow: !!l.shadow, weight: '' }
  }
  /** The caption style the next render really uses. */
  function specNow(st) {
    let s0 = null
    try { s0 = window.fvCaptionStyleNow?.() } catch (_) {}
    const named = looksList().find((l) => l.id === st?.captionLook)
    if (!s0) return specFromLook(named || looksList()[0])
    return { name: named?.name || 'Your caption style', font: s0.font, size: Number(s0.size) || 64, color: s0.color || '#fff', hl: s0.highlight || '#fff', stroke: !!s0.stroke, strokeColor: s0.strokeColor || '#000', strokeW: Number(s0.strokeWidth) || 0, shadow: !!s0.shadow, weight: s0.weight || '' }
  }
  /**
   * Inline CSS for a caption. In a preview frame (px omitted) sizes use container units so the text
   * is the same share of the picture as in the 1080p render; px gives a fixed size for small cards.
   */
  function capStyle(spec, px) {
    if (!spec) return 'color:#fff'
    const unit = (v) => px ? (v * px / spec.size).toFixed(2) + 'px' : (v / 10.8).toFixed(3) + 'cqh'
    const parts = []
    if (spec.stroke && spec.strokeW > 0) {
      const w = unit(spec.strokeW)
      parts.push([[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => `calc(${x} * ${w}) calc(${y} * ${w}) 0 ${spec.strokeColor}`).join(','))
    }
    if (spec.shadow || !(spec.stroke && spec.strokeW > 0)) parts.push('0 2px 8px rgba(0,0,0,.85), 0 0 2px #000')
    return `font-family:${spec.font};${spec.weight ? 'font-weight:' + spec.weight + ';' : ''}font-size:${px ? px + 'px' : unit(spec.size)};color:${spec.color};text-shadow:${parts.join(',')};--hl:${spec.hl}`
  }
  // The renderer shows about four words at a time with the spoken one highlighted.
  const SAMPLE_CAPTION = ['Here’s', 'how', 'captions', 'look']
  function capLine(words = SAMPLE_CAPTION, hot = 2) {
    return words.map((w, i) => i === hot ? `<span class="hot">${esc(w)}</span>` : esc(w)).join(' ')
  }
  /** The setup a new video will use: the active profile, or the current settings. */
  function setupNow(st) {
    const p = activeProfile()
    const v = st?.visual || {}
    const voiceId = p?.voiceId || st?.voiceId || ''
    const voice = (st?.voices || []).find((x) => x.id === voiceId)
    return {
      name: p?.name || 'Current settings',
      genre: p?.genre || '',
      style: visualStyleById(p?.visualStyle || v.style) || visualStyleById(DEFAULT_STYLE),
      voiceLabel: voice ? String(voice.label).split(' · ')[0] : (p?.voiceLabel ? String(p.voiceLabel).split(' · ')[0] : 'Default voice'),
      voicePreview: voice?.preview || '',
      cap: specNow(st),
      aspect: st?.aspect || p?.aspect || '16:9',
    }
  }
  function previewCard(o) {
    return `<aside class="ag-preview" aria-label="Preview">
      <div class="ag-preview-frame${o.aspect === '9:16' ? ' is-tall' : ''}"><img src="${esc(styleSample(o.style.id, o.genre))}" alt="${esc(o.style.name)} sample"><div class="ag-cap" style="${capStyle(o.cap)}">${capLine()}</div></div>
      <div class="ag-preview-row"><span class="ag-card-label">Style</span><b>${esc(o.style.name)}</b></div>
      <div class="ag-preview-row"><span class="ag-card-label">Voice</span><b>${esc(o.voiceLabel)}</b>${o.voicePreview ? `<button type="button" class="ag-round" data-ag-play="${esc(o.voicePreview)}" aria-label="Play ${esc(o.voiceLabel)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>` : ''}</div>
      <div class="ag-preview-row"><span class="ag-card-label">Captions</span><b>${esc(o.cap?.name || 'Default')}</b></div>
      ${o.extra || ''}
    </aside>`
  }
  function styleGridHtml(current) {
    return `<input class="ag-style-search" data-vs-search type="search" placeholder="Search ${VISUAL_STYLES.length} styles" aria-label="Search styles" autocomplete="off">
      <div class="ag-chips" role="group" aria-label="Style groups"><button type="button" class="ag-chip is-on" data-vs-group="">All</button>${STYLE_GROUPS.map((g) => `<button type="button" class="ag-chip" data-vs-group="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="ag-style-grid ag-style-scroll" data-vs-grid>${VISUAL_STYLES.map((x) => `
        <button type="button" class="ag-style${x.id === current ? ' is-on' : ''}" data-vs-style="${esc(x.id)}" data-group="${esc(x.group)}" data-name="${esc((x.name + ' ' + x.group + ' ' + x.prompt).toLowerCase())}" aria-pressed="${x.id === current}"><img src="${esc(styleSample(x.id, activeProfile()?.genre))}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>
      <div class="ag-note" data-vs-empty hidden style="padding:0">No style matches that. Try another word.</div>`
  }
  function voicePickHtml(st, current) {
    const list = st?.voices || []
    if (!list.length) return `<div class="ag-note" style="padding:0">${esc(st?.voiceState === 'error' ? 'Voices load once you sign in. The profile keeps the default voice until then.' : 'Loading voices…')}</div>`
    return `<input class="ag-style-search" data-voice-search type="search" placeholder="Search ${list.length} voices" aria-label="Search voices" autocomplete="off">
      <div class="ag-voices" style="max-height:min(460px,55vh)" role="radiogroup" aria-label="Narrator voice">${list.map((v) => {
      const on = v.id === current
      return `<div class="ag-voice${on ? ' is-on' : ''}" data-voice-name="${esc(String(v.label).toLowerCase())}">
        <button type="button" class="ag-voice-pick" role="radio" aria-checked="${on}" data-pw-voice="${esc(v.id)}">${esc(v.label)}</button>
        ${v.preview ? `<button type="button" class="ag-voice-play" data-ag-play="${esc(v.preview)}" aria-label="Preview ${esc(v.label)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>` : ''}
      </div>`
    }).join('')}</div>`
  }
  function captionPickHtml(current, attr = 'data-pw-cap') {
    const looks = looksList()
    return `<div class="ag-capgrid">${looks.map((l) => `<button type="button" class="ag-capcard${l.id === current ? ' is-on' : ''}" ${attr}="${esc(l.id)}" aria-pressed="${l.id === current}"><span style="${capStyle(specFromLook(l), 17)}">Your <span style="color:${esc(l.hl)}">words</span></span>${esc(l.name)}</button>`).join('')}</div>`
  }
  function modeCards(attr, current) {
    return `<div class="ag-modes">${VISUAL_MODES.map((m) => `<button type="button" class="ag-mode${m.id === current ? ' is-on' : ''}" ${attr}="${esc(m.id)}" aria-pressed="${m.id === current}"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></button>`).join('')}</div>`
  }
  function paceChips(attr, current) {
    return `<div class="ag-chips">${SCENE_PACES.map((p) => `<button type="button" class="ag-chip${p.id === current ? ' is-on' : ''}" ${attr}="${esc(p.id)}">${esc(p.name)} · every ${p.seconds}s</button>`).join('')}</div>`
  }

  function profileStudioHtml(st) {
    const d = pw
    const tabs = [['style', 'agent', 'Visual style'], ['voice', 'voice', 'Voice'], ['captions', 'editor', 'Captions'], ['video', 'manager', 'Video']]
    const look = looksList().find((l) => l.id === d.captions) || looksList()[0] || null
    const voice = (st?.voices || []).find((x) => x.id === d.voiceId)
    let body = ''
    if (profileTab === 'style') body = hostHtml('style') + styleGridHtml(d.visualStyle)
    else if (profileTab === 'voice') body = hostHtml('voice') + voicePickHtml(st, d.voiceId)
    else if (profileTab === 'captions') body = hostHtml('captions') + captionPickHtml(d.captions || look?.id)
    else {
      body = `<div class="ag-host">${agentSvg('manager')}<div class="ag-host-say"><b>Manager</b>The defaults every video on this channel starts from. You can still change them per video.</div></div>
        <div class="ag-field"><span class="ag-card-label">Length</span><div class="ag-chips">${LENGTHS.map(([id, l]) => `<button type="button" class="ag-chip${d.durationId === id ? ' is-on' : ''}" data-pw-len="${id}">${l}</button>`).join('')}</div></div>
        <div class="ag-field"><span class="ag-card-label">Frame</span><div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([v, l]) => `<button type="button" class="ag-chip${d.aspect === v ? ' is-on' : ''}" data-pw-aspect="${v}">${l}</button>`).join('')}</div></div>
        <div class="ag-field"><span class="ag-card-label">Script angle</span><div class="ag-chips">${ANGLES.map((a) => `<button type="button" class="ag-chip${d.angle === a.id ? ' is-on' : ''}" data-pw-angle="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div></div>
        <div class="ag-field"><span class="ag-card-label">Visual mode</span>${modeCards('data-pw-mode', d.visualMode)}</div>
        <div class="ag-field"><span class="ag-card-label">Scene pace</span>${paceChips('data-pw-pace', d.scenePace)}</div>`
    }
    const i = tabs.findIndex((t) => t[0] === profileTab)
    const next = tabs[i + 1]
    return `<div class="ag-studio">
      <div class="ag-st">
        <div class="ag-st-col">
          <h3>${profiles.list.some((p) => p.id === d.id) ? 'Edit brand profile' : 'Set up your channel'}</h3>
          <div class="ag-pfrow">
            <label>Profile name<input class="ag-pfname" id="ag-pw-name" maxlength="40" value="${esc(d.name)}" autocomplete="off"></label>
            <label>Niche<select id="ag-pw-niche"><option value="">Not set</option>${NICHES.map((n) => `<option value="${esc(n.id)}"${d.niche === n.id ? ' selected' : ''}>${esc(n.name)}</option>`).join('')}${d.niche && !nicheById(d.niche) ? `<option value="${esc(d.niche)}" selected>${esc(d.niche)}</option>` : ''}</select></label>
          </div>
          <div class="ag-tabs" role="tablist">${tabs.map(([id, ag, label]) => `<button type="button" role="tab" class="ag-tab${profileTab === id ? ' is-on' : ''}" aria-selected="${profileTab === id}" data-pw-tab="${id}">${agentSvg(ag)}${esc(label)}</button>`).join('')}</div>
          ${body}
          <div class="ag-st-foot">
            <button type="button" class="ag-chip" data-pw-cancel>Cancel</button>
            <div class="ag-chips">${next ? `<button type="button" class="ag-chip" data-pw-tab="${next[0]}">Next: ${esc(next[2])}</button>` : ''}<button type="button" class="ag-go" data-pw-save>Save profile</button></div>
          </div>
        </div>
        ${previewCard({ style: visualStyleById(d.visualStyle) || visualStyleById(DEFAULT_STYLE), cap: d.captions ? specFromLook(look) : specNow(st), voiceLabel: voice ? String(voice.label).split(' · ')[0] : 'Default voice', voicePreview: voice?.preview || '', aspect: d.aspect })}
      </div></div>`
  }

  function stepsBar(n) {
    return `<div class="ag-st-steps"><span class="${n === 1 ? 'is-on' : ''}"><i>1</i> <b>Script</b></span><span class="ag-st-line"></span><span class="${n === 2 ? 'is-on' : ''}"><i>2</i> <b>Video settings</b></span></div>`
  }

  function scriptStudioHtml(st) {
    const own = brief.mode === 'own'
    const est = scriptEstimate(scriptDraft.text)
    const ok = own ? est.words >= 40 : brief.topic.trim().length >= 4
    const setup = setupNow(st)
    return `<div class="ag-studio">${stepsBar(1)}
      <div class="ag-st">
        <div class="ag-st-col">
          <h3>Start with the script</h3>
          ${hostHtml('script')}
          <div class="ag-tabs" role="tablist"><button type="button" role="tab" class="ag-tab${own ? '' : ' is-on'}" aria-selected="${!own}" data-br-mode="write">${agentSvg('script')}Write it for me</button><button type="button" role="tab" class="ag-tab${own ? ' is-on' : ''}" aria-selected="${own}" data-br-mode="own">${agentSvg('manager')}I have a script</button></div>
          ${own ? `
            <input class="ag-pfname" id="ag-own-title" maxlength="120" placeholder="Working title (optional)" value="${esc(scriptDraft.title)}" autocomplete="off">
            <textarea class="ag-topic" id="ag-own-text" rows="10" placeholder="Paste your script. Blank lines split it into sections; ## Heading lines name them.">${esc(scriptDraft.text)}</textarea>
            <div class="ag-note" style="padding:0" data-own-est>${esc(est.label || 'At least 40 words.')}</div>` : `
            <label class="ag-card-label" for="ag-br-topic">What is it about?</label>
            <textarea class="ag-topic" id="ag-br-topic" rows="3" maxlength="300" placeholder="e.g. The rise and fall of Blockbuster">${esc(brief.topic)}</textarea>
            <div class="ag-chips">${ideasNow().map((x) => `<button type="button" class="ag-chip" data-br-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>
            <div class="ag-field"><span class="ag-card-label">Angle</span><div class="ag-chips">${ANGLES.map((a) => `<button type="button" class="ag-chip${(st?.angle || 'auto') === a.id ? ' is-on' : ''}" data-ag-angle="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div></div>
            <div class="ag-field"><span class="ag-card-label">Target length</span><div class="ag-chips">${LENGTHS.map(([id, l]) => `<button type="button" class="ag-chip${st?.durationId === id ? ' is-on' : ''}" data-ag-len="${id}">${l}</button>`).join('')}</div></div>`}
          <div class="ag-st-foot"><button type="button" class="ag-chip" data-st-close>Back to chat</button><button type="button" class="ag-go" data-st-next${ok ? '' : ' disabled'}>Next: video settings</button></div>
        </div>
        ${previewCard({ ...setup, extra: `<div class="ag-preview-row"><span class="ag-card-label">Profile</span><b>${esc(setup.name)}</b><button type="button" class="ag-chip" data-st-profile style="margin-left:auto">${activeProfile() ? 'Edit' : 'Set up'}</button></div>` })}
      </div></div>`
  }

  function settingsStudioHtml(st) {
    const v = st?.visual || {}
    const own = brief.mode === 'own'
    const est = scriptEstimate(scriptDraft.text)
    const seconds = own ? est.seconds : durationSeconds(st?.durationId)
    const plan = videoPlan({ seconds, pace: v.pace, mode: v.mode, text: own ? scriptDraft.text : '' })
    const setup = setupNow(st)
    const style = visualStyleById(v.style) || visualStyleById(DEFAULT_STYLE)
    const lenLabel = own ? formatMinutes(est.seconds) : (st?.durationLabel || formatMinutes(seconds))
    const crew = [
      ['script', own ? 'Uses your script' : `Writes about ${Math.round((seconds / 60) * 150).toLocaleString('en-US')} words${st?.angle && st.angle !== 'auto' ? ', ' + angleById(st.angle).name.toLowerCase() : ''}`],
      ['title', 'Writes five titles and picks the strongest'],
      ['voice', `${setup.voiceLabel} narrates it`],
      ['agent', `Draws ${plan.count} scenes in ${style.name}${plan.animated ? `, animates ${plan.animated}` : ''}`],
      ['thumbnail', 'Designs the thumbnail'],
      ['editor', `${setup.cap?.name || 'Default'} captions, ${st?.aspect || '16:9'}, renders the MP4`],
      ['publish', 'Writes the description, tags and chapters'],
    ]
    return `<div class="ag-studio">${stepsBar(2)}
      <div class="ag-st">
        <div class="ag-st-col">
          <h3>Your video</h3>
          ${hostHtml('settings', `${own ? 'Your script' : brief.topic.trim() ? '“' + brief.topic.trim() + '”' : 'Your video'}, ${lenLabel}. ${plan.count} scenes, ${plan.animated} animated. The team needs ${makeTimeLabel(plan.minutes)}.`)}
          <div class="ag-field"><span class="ag-card-label">Visual mode</span>${modeCards('data-vs-mode', v.mode || 'cheapest')}</div>
          <div class="ag-field"><span class="ag-card-label">Frame</span><div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([a, l]) => `<button type="button" class="ag-chip${(st?.aspect || '16:9') === a ? ' is-on' : ''}" data-ag-aspect="${a}">${l}</button>`).join('')}</div></div>
          ${own ? '' : `<div class="ag-field"><span class="ag-card-label">Length</span><div class="ag-chips">${LENGTHS.map(([id, l]) => `<button type="button" class="ag-chip${st?.durationId === id ? ' is-on' : ''}" data-ag-len="${id}">${l}</button>`).join('')}</div></div>`}
          <div class="ag-field"><span class="ag-card-label">Scene pace</span>${paceChips('data-vs-pace', v.pace || 'normal')}</div>
          ${own ? '' : `<div class="ag-field"><span class="ag-card-label">Script angle</span><div class="ag-chips">${ANGLES.map((a) => `<button type="button" class="ag-chip${(st?.angle || 'auto') === a.id ? ' is-on' : ''}" data-ag-angle="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div></div>`}
          <div class="ag-field"><span class="ag-card-label">Narrator · ${esc(setup.voiceLabel)}</span>${voiceListHtml(st)}</div>
          <div class="ag-field"><span class="ag-card-label">Captions · ${esc(setup.cap?.name || 'Default')}</span>${captionPickHtml(st?.captionLook || '', 'data-st-cap')}</div>
          <div class="ag-field"><span class="ag-card-label">Style</span><div class="ag-chips"><span class="ag-chip is-on">${esc(style.name)}</span><button type="button" class="ag-chip" data-ag-visuals>Change</button></div></div>
          <div class="ag-field"><span class="ag-card-label">Consistent character (optional)</span>
            ${v.characterUrl ? `<div class="ag-char"><img src="${esc(v.characterUrl)}" alt="Character reference"><div><b>${esc(v.characterDesc || 'Your character')}</b><span>Appears in every scene where a person fits.</span><div class="ag-chips"><button type="button" class="ag-chip" data-vs-char-clear>Remove</button></div></div></div>` : `
            <form class="ag-char-form" data-vs-char-form><input id="ag-char-desc" maxlength="200" placeholder="e.g. a bald man in his 40s with a grey beard and round glasses" value="${esc(v.characterDesc || '')}" autocomplete="off"><button type="submit" class="ag-chip is-primary"${charBusy ? ' disabled' : ''}>${charBusy ? 'Drawing…' : 'Create character'}</button></form>${charError ? `<div class="ag-note" style="padding:0">${esc(charError)}</div>` : ''}`}
          </div>
          <div class="ag-field"><span class="ag-card-label">Likely shape · ${plan.count} scenes${plan.animated ? ` · ${plan.animated} animated` : ''}</span><div class="ag-shape" aria-hidden="true">${plan.scenes.map((x) => `<i class="${x.animate ? 'is-anim' : ''}"></i>`).join('')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Who does what</span><div class="ag-crewplan">${crew.map(([id, t]) => `<div>${agentSvg(id)}<b>${esc(BY_ID[id].name)}</b><span>${esc(t)}</span></div>`).join('')}</div></div>
          <div class="ag-st-foot"><button type="button" class="ag-chip" data-st-back>Back</button><button type="button" class="ag-go" data-st-go>Hand it to the team <small>${esc(makeTimeLabel(plan.minutes))}</small></button></div>
        </div>
        ${previewCard({ ...setup, style, aspect: st?.aspect || '16:9' })}
      </div></div>`
  }

  function progressStudioHtml(st) {
    const pr = progressFrom(st?.crew || {}, { delivered: !!st?.renderUrl })
    const f = pr.focus
    const a = BY_ID[f.agent]
    const sc = st?.scenes
    const mins = st?.startedAt ? Math.max(0, Math.round((Date.now() - st.startedAt) / 60000)) : 0
    let live = ''
    if (st?.renderUrl) live = deliveryHtml(st)
    else if (f.agent === 'agent' && sc?.images?.length) live = `<div class="ag-card-label">Scenes · ${sc.drawn} of ${sc.total} drawn${sc.animTotal ? ` · ${sc.animated} of ${sc.animTotal} animated` : ''}</div><div class="ag-live-scenes">${sc.images.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>`
    else if ((f.agent === 'voice' || f.agent === 'agent') && st?.media?.voiceover) live = `<div class="ag-card-label">Narration</div><audio controls preload="none" src="${esc(st.media.voiceover)}" style="width:100%"></audio>`
    else if (st?.script?.sections?.length) live = `<div class="ag-card-label">${esc(st.script.title || 'Script')} · ${Number(st.script.words || 0).toLocaleString('en-US')} words</div><div class="ag-script-peek">${st.script.sections.slice(0, 4).map((x) => `<b>${esc(x.heading)}</b><br>${esc(x.text)}`).join('<br><br>')}</div>`
    else live = `<div class="ag-live-empty">${esc(f.text || (st?.running ? 'Working…' : 'Waiting for the team to start'))}</div>`
    const stuck = pr.steps.find((x) => x.state === 'stuck')
    return `<div class="ag-studio"><div class="ag-prog">
      <div class="ag-prog-list">
        <div class="ag-prog-top"><b>${pr.percent}%</b><span class="ag-card-label">${st?.renderUrl ? 'Done' : mins ? mins + ' min so far' : 'Starting'}</span></div>
        <div class="ag-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pr.percent}" aria-label="Video progress"><i style="width:${pr.percent}%"></i></div>
        ${pr.steps.map((x) => `<div class="ag-step" data-state="${esc(x.state)}">${agentSvg(x.agent)}<span class="ag-step-txt"><b>${esc(x.name)}</b><span>${esc(x.state === 'idle' ? x.note : x.text || x.note)}</span></span><span class="ag-step-mark">${x.state === 'done' ? '✓ Done' : x.state === 'working' ? 'Working' : x.state === 'stuck' ? 'Needs you' : ''}</span></div>`).join('')}
        <div class="ag-chips" style="margin-top:10px"><button type="button" class="ag-chip" data-st-close>Chat with the Manager</button>${st?.renderUrl || !st?.running ? '<button type="button" class="ag-chip" data-ag-new>New video</button>' : ''}</div>
      </div>
      <div class="ag-live" aria-live="polite">
        <div class="ag-live-head">${agentSvg(f.agent)}<div><b>${esc(a.name)}</b><span>${st?.renderUrl ? 'Your video is ready' : esc(f.text || f.note)} · step ${pr.index + 1} of ${pr.steps.length}</span></div></div>
        ${live}
        ${stuck ? `<div class="ag-note" style="padding:0">${esc(BY_ID[stuck.agent].name)} needs you: ${esc(stuck.text || 'it stopped')}. <button type="button" data-st-close>Tell the Manager</button>.</div>${stuck.agent === 'editor' ? '<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-retry-render>Try again</button></div>' : ''}` : ''}
      </div>
    </div></div>`
  }


  function fmtClock(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0))
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
  }
  function edPickerHtml(list) {
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago' }
    return `<div class="ag-studio ag-ed-wrap"><div class="ag-ed-bar"><b class="ag-ed-title">My videos</b><span class="ag-ed-badge is-done">${list.length} saved</span><span class="ag-ed-sp"></span>${window.fvSceneProject?.() ? '<button type="button" class="ag-ed-back" data-ed-picker-close>Back to the editor</button>' : ''}</div>
      ${edOpenErr ? `<div class="ag-note" style="padding:0 0 10px">${esc(edOpenErr)}</div>` : ''}
      ${list.length ? `<div class="ag-ed-vids">${list.map((v) => `<div class="ag-ed-vid${v.current ? ' is-on' : ''}"><button type="button" class="ag-ed-vid-open" data-ed-open="${esc(v.id)}"><span class="ag-ed-vid-img" style="background-image:url('${esc(v.thumb || '')}')">${v.rendered ? '<i>Rendered</i>' : '<i class="is-draft">Draft</i>'}</span><b>${esc(v.title)}</b><span>${v.scenes} scenes · ${fmtClock(v.duration)} · ${ago(v.savedAt)}</span></button><button type="button" class="ag-ed-vid-x" data-ed-forget="${esc(v.id)}" aria-label="Remove ${esc(v.title)} from this list">×</button></div>`).join('')}</div>`
        : '<div class="ag-empty"><h3>No saved videos yet</h3><p>Every video made with AI scenes is kept here, so you can come back and edit it after a reload.</p></div>'}
      <div class="ag-chips" style="margin-top:14px"><button type="button" class="ag-chip is-primary" data-ed-go="manual">Make a new one in Studio</button><button type="button" class="ag-chip" data-ed-go="files">Open My Files</button></div></div>`
  }

  function editorStudioHtml(st) {
    let proj = (() => { try { return window.fvSceneProject?.() } catch (_) { return null } })()
    const saved = (() => { try { return window.fvEditProjects?.() || [] } catch (_) { return [] } })()
    // After a reload the Editor reopens the last video it had.
    if (!proj && edHosted && !edAutoOpened && saved.length) {
      edAutoOpened = true
      const err = window.fvOpenEditProject?.(saved[0].id)
      if (!err) proj = (() => { try { return window.fvSceneProject?.() } catch (_) { return null } })()
    }
    if (proj && edWhole === 'length' && proj.scenes?.length && !st?.running) edWhole = ''
    if (edHosted && !proj && edWhole === 'length') {
      const pr = progressFrom(st?.crew || {}, {})
      const f = pr.steps.find((x) => x.state === 'working') || pr.focus
      const imgs = st?.scenes?.images || []
      return `<div class="ag-studio ag-ed-wrap"><div class="ag-ed-bar"><b class="ag-ed-title">${esc(st?.script?.title || 'Making it longer')}</b><span class="ag-ed-badge">Making it longer</span></div>
        <div class="ag-ed-whole" style="max-width:720px">${agentSvg(f.agent)}<b>${esc(BY_ID[f.agent]?.name || '')}</b><i>${esc(f.text || f.note || 'Working…')}</i>
          ${imgs.length ? `<div class="ag-ed-vids" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${imgs.map((u) => `<span class="ag-ed-vid-img" style="background-image:url('${esc(u)}');border-radius:10px"></span>`).join('')}</div>` : ''}
          <i>${pr.steps.some((x) => x.state === 'stuck') ? 'Something stopped: ' + esc((pr.steps.find((x) => x.state === 'stuck') || {}).text || 'try again') : 'The longer video opens here when its scenes are drawn.'}</i><div class="ag-chips"><button type="button" class="ag-chip" data-ed-unwait>Back to My videos</button></div></div></div>`
    }
    if (edHosted && (edPicker || (!proj && saved.length))) return edPickerHtml(saved)
    if (!proj) {
      return `<div class="ag-studio"><div class="ag-empty"><div class="ag-empty-crew">${agentSvg('agent')}</div><h3>Nothing to edit yet</h3><p>${edHosted ? 'The Editor opens the video you made in this tab: redraw or animate any scene, change the captions, music or narrator, then render a new version. Make a video in Studio or Agents first.' : 'The scene editor opens a finished video made with AI scenes. Make a video, then press Edit scenes on it.'}</p><div class="ag-chips">${edHosted ? '<button type="button" class="ag-chip is-primary" data-ed-go="manual">Make one in Studio</button><button type="button" class="ag-chip" data-ed-go="agents">Ask the Manager</button><button type="button" class="ag-chip" data-ed-go="editor">Edit any video file</button>' : '<button type="button" class="ag-chip" data-st-close>Back to chat</button>'}</div></div></div>`
    }
    const scenes = proj.scenes
    if (edSel >= scenes.length) edSel = 0
    const sc = scenes[edSel]
    const cap = specNow(st)
    const tabs = [['captions', 'editor', 'Captions'], ['scenes', 'agent', 'Scenes'], ['music', 'manager', 'Music'], ['voice', 'voice', 'Voiceover']]
    const dur = proj.duration || scenes[scenes.length - 1].end
    let body = ''
    if (edTab === 'scenes') {
      const busy = edBusy[sc.i]
      const stills = scenes.filter((x) => !x.clip).length
      const pace = st?.visual?.pace || 'normal'
      const curSecs = Math.round(dur)
      const longer = LENGTHS.filter(([id]) => durationSeconds(id) > curSecs + 20)
      const lock = edWhole ? ' disabled' : ''
      body = `<div class="ag-ed-sec">Whole video</div>
        <div class="ag-ed-whole">
          <div class="ag-ed-wrow"><span><b>Animate every scene</b><i>${stills ? `${stills} still scene${stills === 1 ? '' : 's'} become moving clips · a few minutes each, 3 at a time` : 'Every scene is already animated'}</i></span>
            <button type="button" class="ag-ed-wbtn" data-ed-animall${stills && !edWhole ? '' : ' disabled'}>${edWhole === 'animate' && edAnimAll ? `Animating ${edAnimAll.done}/${edAnimAll.total}` : 'Animate all'}</button></div>
          <div class="ag-ed-wrow is-col"><span><b>Pacing</b><i>How often the picture changes. Redraws every scene; the narration stays.</i></span>
            <div class="ag-ed-seg">${SCENE_PACES.map((p) => `<button type="button" class="${pace === p.id ? 'is-on' : ''}" data-ed-pace="${p.id}"${lock}>${esc(p.name)} · ${p.seconds}s</button>`).join('')}</div></div>
          <div class="ag-ed-wrow is-col"><span><b>Length · now ${fmtClock(dur)}</b><i>Writes more script, records new narration and draws new scenes.</i></span>
            ${longer.length ? `<div class="ag-ed-seg">${longer.map(([id, l]) => `<button type="button" data-ed-len="${id}"${lock}>${esc(l)}</button>`).join('')}</div>` : '<i class="ag-ed-wnote">Already at the longest length.</i>'}</div>
          ${edWhole === 'pace' ? '<div class="ag-ed-wnote">Redrawing every scene at the new pace…</div>' : edWhole === 'length' ? '<div class="ag-ed-wnote">Writing a longer script, then new narration and scenes. This takes a few minutes.</div>' : ''}
          ${edWholeMsg ? `<div class="ag-ed-wnote is-err">${esc(edWholeMsg)}</div>` : ''}
        </div>
        <div class="ag-ed-sec">This scene</div>`
      body += `<div class="ag-host">${agentSvg('agent')}<div class="ag-host-say"><b>Agent</b>Pick a scene on the timeline. I can redraw it from a new description, animate it, or make it a still again.</div></div>
        <div class="ag-ed-scene-card">
          <div class="ag-card-label">Scene ${edSel + 1} of ${scenes.length} · ${fmtClock(sc.start)}–${fmtClock(sc.end)}${sc.clip ? ' · animated' : ''}</div>
          ${sc.image ? `<img src="${esc(sc.image)}" alt="Scene ${edSel + 1}">` : ''}
          <div class="ag-ed-quote">“${esc(sc.text)}”</div>
          <label class="ag-card-label" for="ag-ed-prompt">What the scene shows</label>
          <textarea class="ag-topic" id="ag-ed-prompt" rows="3" maxlength="600">${esc(edPrompt[sc.i] ?? sc.prompt ?? '')}</textarea>
          <div class="ag-chips">
            <button type="button" class="ag-chip is-primary" data-ed-redraw${busy ? ' disabled' : ''}>${busy === 'draw' ? 'Drawing…' : 'Redraw scene'}</button>
            ${sc.clip ? `<button type="button" class="ag-chip" data-ed-still${busy ? ' disabled' : ''}>Make it a still</button>` : `<button type="button" class="ag-chip" data-ed-animate${busy ? ' disabled' : ''}>${busy === 'animate' ? 'Animating… a few minutes' : 'Animate scene'}</button>`}
          </div>
          ${edErr ? `<div class="ag-note" style="padding:0">${esc(edErr)}</div>` : ''}
        </div>`
    } else if (edTab === 'captions') {
      const cs = (() => { try { return window.fvCaptionStyleNow?.() || {} } catch (_) { return {} } })()
      const fonts = [...document.querySelectorAll('#fv-cap-font option')].map((o) => [o.value, o.textContent.trim()]).filter(([v]) => v)
      const SW = ['#ffffff', '#ffe14d', '#ff3040', '#22c55e', '#38bdf8', '#a78bfa', '#ff7a1a', '#111111']
      const sw = (key, cur) => `<div class="ag-ed-sw">${SW.map((c) => `<button type="button" class="${String(cur || '').toLowerCase() === c ? 'is-on' : ''}" style="--c:${c}" data-ed-cs="${key}" data-v="${c}" aria-label="${key} ${c}"></button>`).join('')}</div>`
      const slider = (key, label, min, max, step, val, unit = '') => `<label class="ag-ed-sl"><span>${label}<b>${val}${unit}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-ed-cr="${key}"></label>`
      body = `<div class="ag-ed-sec">Style</div>` + captionPickHtml(st?.captionLook || '', 'data-ed-cap') + `
        <div class="ag-ed-sec">Fine-tune</div>
        ${fonts.length ? `<label class="ag-ed-sl"><span>Font</span><select class="ag-ed-select" data-ed-font>${fonts.map(([v, l]) => `<option value="${esc(v)}"${v === cs.font ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
        <div class="ag-ed-sl"><span>Text colour</span></div>${sw('color', cs.color)}
        <div class="ag-ed-sl"><span>Highlight (the word being said)</span></div>${sw('highlight', cs.highlight)}
        ${slider('size', 'Text size', 24, 140, 2, Number(cs.size) || 64, 'px')}
        ${slider('letterSpacing', 'Letter spacing', -2, 10, 0.5, Number(cs.letterSpacing) || 0)}
        <div class="ag-ed-sl"><span>Outline</span></div><div class="ag-ed-seg">${[['none', 'None', 0], ['thin', 'Thin', 2], ['medium', 'Medium', 4], ['heavy', 'Heavy', 8]].map(([id, l, w]) => `<button type="button" class="${(cs.stroke ? (Number(cs.strokeWidth) <= 2 ? 'thin' : Number(cs.strokeWidth) <= 5 ? 'medium' : 'heavy') : 'none') === id ? 'is-on' : ''}" data-ed-stroke="${w}">${l}</button>`).join('')}</div>
        <div class="ag-ed-sl"><span>Text shadow</span></div><div class="ag-ed-seg">${[['0', 'None'], ['1', 'Soft']].map(([v, l]) => `<button type="button" class="${(cs.shadow ? '1' : '0') === v ? 'is-on' : ''}" data-ed-shadow="${v}">${l}</button>`).join('')}</div>
        <div class="ag-note" style="padding:0">Caption changes show in the preview now and go into the video when you export.</div>`
    } else if (edTab === 'music') {
      const list = (() => { try { return window.fvMusicList?.() || [] } catch (_) { return [] } })()
      body = `<div class="ag-host">${agentSvg('manager')}<div class="ag-host-say"><b>Manager</b>Background music sits under the narration. Press play to hear a track.</div></div>
        <div class="ag-ed-music">${list.map((m) => `<div><button type="button" class="ag-chip${m.id === proj.musicId ? ' is-on' : ''}" data-ed-music="${esc(m.id)}" aria-pressed="${m.id === proj.musicId}">${esc(m.name)}</button>${m.url ? `<button type="button" class="ag-round" data-ag-play="${esc(m.url)}" aria-label="Play ${esc(m.name)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>` : ''}</div>`).join('')}</div>
        <label class="ag-field"><span class="ag-card-label">Music volume · ${Math.round(proj.musicVol * 100)}%</span><input type="range" min="0" max="1" step="0.05" value="${proj.musicVol}" data-ed-vol aria-label="Music volume"></label>`
    } else {
      body = hostHtml('voice', 'This is the narration the whole video is timed to. A new voice means recording it again, which changes every scene timing. Ask the Manager to make the video again with another narrator.') + `
        ${proj.voiceover ? `<audio controls preload="none" src="${esc(proj.voiceover)}" style="width:100%"></audio>` : ''}`
    }
    const W = Math.max(600, Math.round(dur * ED_PPS))
    const tabValue = {
      captions: cap?.name || 'Default',
      scenes: scenes.length + ' scenes',
      music: (() => { try { const m = (window.fvMusicList?.() || []).find((x) => x.id === proj.musicId); return m && m.id !== 'none' ? m.name : 'None' } catch (_) { return 'None' } })(),
      voice: proj.voiceover ? fmtClock(dur) : 'Narration',
    }
    const words = proj.words || []
    const phrases = []
    for (let k = 0; k < words.length; k += 4) { const g = words.slice(k, k + 4); phrases.push([g[0][0], g[g.length - 1][1], g.map((w) => w[2]).join(' ')]) }
    const music = (() => { try { return (window.fvMusicList?.() || []).find((m) => m.id === proj.musicId) } catch (_) { return null } })()
    const t = edAudio ? edAudio.currentTime : sc.start
    const title = st?.script?.title || 'Untitled video'
    return `<div class="ag-studio ag-ed-wrap">
      <div class="ag-ed-bar">
        <button type="button" class="ag-ed-back" data-ed-files>← My videos</button>
        <b class="ag-ed-title">${esc(title.slice(0, 70))}</b><span class="ag-ed-badge${st?.renderUrl ? ' is-done' : ''}">${st?.renderUrl ? 'Rendered' : 'Draft'}</span>
        <span class="ag-ed-sp"></span>
        <span class="ag-note" style="padding:0">${proj.edits ? proj.edits + ' scene change' + (proj.edits === 1 ? '' : 's') + ' · ' : ''}changes apply on export</span>
        ${st?.renderUrl ? `<a class="ag-ed-ghost" href="${esc(st.renderUrl)}" download target="_blank" rel="noopener">Download</a>` : ''}
        <button type="button" class="ag-ed-export" data-ed-render${edRendering ? ' disabled' : ''}>${edRendering ? 'Starting…' : st?.renderUrl ? 'Export new version' : 'Export'}</button>
      </div>
      <div class="ag-ed">
        <div class="ag-ed-side">
          <div class="ag-ed-tabs" role="tablist">${tabs.map(([id, ag, label]) => `<button type="button" role="tab" class="${edTab === id ? 'is-on' : ''}" aria-selected="${edTab === id}" data-ed-tab="${id}"><span class="ag-ed-ti">${agentSvg(ag)}</span><span class="ag-ed-tt"><i>${esc(label)}</i><b>${esc(tabValue[id] || '')}</b></span></button>`).join('')}</div>
          <div class="ag-ed-body">${body}</div>
        </div>
        <div class="ag-ed-player">
          <div class="ag-preview-frame${proj.aspect === '9:16' ? ' is-tall' : ''}"><img data-ed-img src="${esc(sc.image || '')}" alt=""><div class="ag-ed-clipbox" data-ed-clipbox></div><div class="ag-cap" data-ed-capline style="${capStyle(cap)}"></div></div>

        </div>
      </div>
      <div class="ag-ed-tlbar"><b>Timeline</b><div class="ag-ed-ctl is-inbar"><button type="button" class="ag-round" data-ed-play aria-label="Play">${edAudio && !edAudio.paused ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}</button>
            <span data-ed-time>${fmtClock(t)}</span><input type="range" min="0" max="${dur}" step="0.1" value="${t}" data-ed-seek aria-label="Seek"><span>${fmtClock(dur)}</span></div><span class="ag-note" style="padding:0">${scenes.length} scenes · ${esc(proj.styleName || '')} · ${scenes.filter((x) => x.clip).length} animated</span><span class="ag-ed-sp"></span>
        <label class="ag-ed-zoom"><span>Zoom</span><input type="range" min="6" max="40" step="1" value="${ED_PPS}" data-ed-zoom aria-label="Timeline zoom"></label></div>
      <div class="ag-ed-tl" data-ed-tl>
        <div class="ag-ed-lanes" data-ed-lanes style="width:${W + 74}px">
          <div class="ag-ed-ruler">${Array.from({ length: Math.ceil(dur / 10) + 1 }, (_, k) => `<span style="left:${74 + k * 10 * ED_PPS}px">${fmtClock(k * 10)}</span>`).join('')}</div>
          <div class="ag-ed-lane"><span class="ag-ed-lab">Scenes</span>
            <div class="ag-ed-strip" role="listbox" aria-label="Scenes">${scenes.map((x, k) => `<button type="button" role="option" aria-selected="${k === edSel}" class="ag-ed-scene${k === edSel ? ' is-sel' : ''}${x.clip ? ' is-anim' : ''}" data-ed-scene="${k}" style="width:${Math.max(18, Math.round((x.end - x.start) * ED_PPS) - 2)}px;background-image:url('${esc(x.image || '')}')" title="Scene ${k + 1} · ${fmtClock(x.start)}" aria-label="Scene ${k + 1} at ${fmtClock(x.start)}${x.clip ? ', animated' : ''}">${edBusy[x.i] ? `<span class="ag-ed-busy">${edBusy[x.i] === 'draw' ? 'Drawing' : 'Animating'}</span>` : ''}</button>`).join('')}</div></div>
          ${phrases.length ? `<div class="ag-ed-lane"><span class="ag-ed-lab">Captions</span><div class="ag-ed-caps">${phrases.map(([a, b, txt]) => `<span style="left:${Math.round(a * ED_PPS)}px;width:${Math.max(6, Math.round((b - a) * ED_PPS) - 2)}px" title="${esc(txt)}">${esc(txt)}</span>`).join('')}</div></div>` : ''}
          <div class="ag-ed-lane"><span class="ag-ed-lab">Voice</span><canvas class="ag-ed-wave" data-ed-wave width="${W}" height="30" style="width:${W}px"></canvas></div>
          <div class="ag-ed-lane"><span class="ag-ed-lab">Music</span><div class="ag-ed-music-bar${music && music.id !== 'none' ? '' : ' is-off'}" style="width:${W}px" data-ed-tab-go="music">${music && music.id !== 'none' ? `♪ ${esc(music.name)} · ${Math.round((proj.musicVol ?? 0.25) * 100)}%` : '+ Add music'}</div></div>
          <div class="ag-ed-ph" data-ed-ph style="left:${74 + Math.round(t * ED_PPS)}px"></div>
        </div>
      </div>
    </div>`
  }

  function edDrawWave(proj) {
    const cv = root.querySelector('[data-ed-wave]')
    if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.fillStyle = 'rgba(255,255,255,.5)'
    const words = proj.words || []
    if (!words.length) { ctx.fillRect(0, 14, Math.round((proj.duration || 0) * ED_PPS), 2); return }
    // One bar per spoken word, taller for longer words: the shape of the narration, not a real waveform.
    for (const [a, b, w] of words) {
      const x = Math.round(a * ED_PPS)
      const wd = Math.max(1, Math.round((b - a) * ED_PPS) - 1)
      const h = Math.min(26, 8 + String(w).length * 2)
      ctx.fillRect(x, (30 - h) / 2, wd, h)
    }
  }

  // Animated scenes: one preloaded <video> per clip, kept across re-renders, so a clip is ready
  // before its scene starts and plays from the right moment instead of loading late.
  // A seek made before the narration has loaded is kept and applied once it can play.
  let edPendingT = null
  function edSeek(v) {
    edPendingT = v
    if (!edAudio) return
    try { edAudio.currentTime = v } catch (_) {}
    if (edAudio.readyState >= 1) edPendingT = null
  }
  const edClips = new Map()
  function edClipEl(url) {
    let v = edClips.get(url)
    if (v) return v
    v = document.createElement('video')
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '')
    v.className = 'ag-ed-clip'
    v.addEventListener('loadeddata', () => v.classList.add('is-ready'))
    v.src = url
    edClips.set(url, v)
    if (edClips.size > 12) { const [first] = edClips.keys(); const old = edClips.get(first); if (old && !old.isConnected) { old.removeAttribute('src'); old.load(); edClips.delete(first) } }
    return v
  }
  function edShowClip(scenes, k, t) {
    const box = root.querySelector('[data-ed-clipbox]')
    if (!box) return
    const sc = scenes[k]
    // Warm the next two animated scenes while this one plays.
    for (let j = k + 1; j < Math.min(scenes.length, k + 3); j++) if (scenes[j].clip) edClipEl(scenes[j].clip)
    if (!sc?.clip) {
      if (box.firstChild) { box.firstChild.pause?.(); box.replaceChildren() }
      return
    }
    const v = edClipEl(sc.clip)
    if (box.firstChild !== v) { if (box.firstChild) box.firstChild.pause?.(); box.replaceChildren(v) }
    // Keep the clip in step with the narration: its own time is the time into the scene, looped.
    const off = Math.max(0, t - sc.start)
    const len = v.duration && isFinite(v.duration) ? v.duration : 0
    const want = len ? off % len : off
    const playing = !!(edAudio && !edAudio.paused)
    if (v.readyState >= 1 && (Math.abs(v.currentTime - want) > (playing ? 0.45 : 0.05))) { try { v.currentTime = want } catch (_) {} }
    if (playing) { if (v.paused) v.play().catch(() => {}) } else if (!v.paused) v.pause()
  }

  function edUpdate(proj, t, { scroll = false } = {}) {
    const scenes = proj.scenes
    const k = sceneIndexAt(scenes, t)
    const sc = scenes[k]
    if (!sc) return
    const img = root.querySelector('[data-ed-img]')
    if (img && sc.image && img.getAttribute('src') !== sc.image) img.setAttribute('src', sc.image)
    edShowClip(scenes, k, t)
    const cap = root.querySelector('[data-ed-capline]')
    if (cap) {
      const c = captionAt(proj.words || [], t, 4)
      cap.innerHTML = c.line.length ? c.line.map((w, i) => i === c.hot ? `<span class="hot">${esc(w)}</span>` : esc(w)).join(' ') : esc(String(sc.text || '').split(/\s+/).slice(0, 6).join(' '))
    }
    const dur = proj.duration || scenes[scenes.length - 1].end
    const tm = root.querySelector('[data-ed-time]')
    if (tm) tm.textContent = fmtClock(t)
    const sk = root.querySelector('[data-ed-seek]')
    if (sk && document.activeElement !== sk) sk.value = String(t)
    const ph = root.querySelector('[data-ed-ph]')
    if (ph) ph.style.left = (74 + Math.round(t * ED_PPS)) + 'px'
    root.querySelectorAll('[data-ed-scene]').forEach((b) => b.classList.toggle('is-now', Number(b.dataset.edScene) === k))
    if (scroll) {
      const tl = root.querySelector('[data-ed-tl]')
      const x = 74 + t * ED_PPS
      if (tl && (x < tl.scrollLeft + 40 || x > tl.scrollLeft + tl.clientWidth - 40)) tl.scrollLeft = Math.max(0, x - tl.clientWidth / 3)
    }
  }

  function edBind(st) {
    const proj = (() => { try { return window.fvSceneProject?.() } catch (_) { return null } })()
    if (!proj) return
    edDrawWave(proj)
    if (proj.voiceover && (!edAudio || edAudio.dataset.src !== proj.voiceover)) {
      try { edAudio?.pause() } catch (_) {}
      edAudio = new Audio(proj.voiceover)
      edAudio.dataset.src = proj.voiceover
      edAudio.preload = 'metadata'
      edAudio.onloadedmetadata = () => { if (edPendingT != null) { try { edAudio.currentTime = edPendingT } catch (_) {} } }
      edSeek(proj.scenes[edSel]?.start || 0)
    }
    const t0 = edAudio && edAudio.readyState >= 1 ? edAudio.currentTime : (edPendingT ?? proj.scenes[edSel]?.start ?? 0)
    edUpdate(proj, t0)
    const tl = root.querySelector('[data-ed-tl]')
    if (tl && !tl.dataset.placed) { tl.dataset.placed = '1'; tl.scrollLeft = Math.max(0, 74 + t0 * ED_PPS - tl.clientWidth / 3) }
    if (edAudio) {
      edAudio.ontimeupdate = () => { if (studio === 'editor') edUpdate(proj, edAudio.currentTime, { scroll: true }) }
      edAudio.onplay = edAudio.onpause = () => { if (studio === 'editor') { const b = root.querySelector('[data-ed-play]'); if (b) b.innerHTML = edAudio.paused ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'; b?.setAttribute('aria-label', edAudio.paused ? 'Play' : 'Pause'); edUpdate(proj, edAudio.currentTime) } }
    }
    root.querySelector('[data-ed-play]')?.addEventListener('click', () => { if (!edAudio) return; if (edAudio.paused) edAudio.play().catch(() => {}); else edAudio.pause() })
    root.querySelector('[data-ed-seek]')?.addEventListener('input', (e) => { const v = Number(e.target.value) || 0; edSeek(v); edUpdate(proj, v) })
    root.querySelectorAll('[data-ed-tab]').forEach((b) => b.addEventListener('click', () => { edTab = b.dataset.edTab; edErr = ''; render() }))
    root.querySelector('[data-ed-tab-go]')?.addEventListener('click', (e) => { edTab = e.currentTarget.dataset.edTabGo; render() })
    root.querySelector('[data-ed-files]')?.addEventListener('click', () => { if (edHosted) { edPicker = true; edOpenErr = ''; return render() } try { window.switchPanel('files', document.getElementById('nav-files')) } catch (_) {} })
    root.querySelector('[data-ed-zoom]')?.addEventListener('change', (e) => { ED_PPS = Number(e.target.value) || 14; const tl = root.querySelector('[data-ed-tl]'); if (tl) delete tl.dataset.placed; render() })
    // Click empty timeline space to move the playhead there.
    root.querySelector('[data-ed-lanes]')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-ed-scene],[data-ed-tab-go]')) return
      const r = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - r.left - 74
      if (x < 0) return
      const v = Math.max(0, Math.min(proj.duration || 0, x / ED_PPS))
      edSeek(v)
      edUpdate(proj, v)
    })
    // Caption fine-tuning: change one field of the current style; the render uses the same style.
    const capSet = (patch) => { let c = {}; try { c = window.fvCaptionStyleNow?.() || {} } catch (_) {} ; window.fvSetCaptionStyle?.({ ...c, ...patch }); render() }
    root.querySelectorAll('[data-ed-cs]').forEach((b) => b.addEventListener('click', () => capSet({ [b.dataset.edCs]: b.dataset.v })))
    root.querySelectorAll('[data-ed-cr]').forEach((r) => {
      r.addEventListener('input', () => { const lab = r.closest('label')?.querySelector('b'); if (lab) lab.textContent = r.value + (r.dataset.edCr === 'size' ? 'px' : '') })
      r.addEventListener('change', () => capSet({ [r.dataset.edCr]: Number(r.value) }))
    })
    root.querySelector('[data-ed-font]')?.addEventListener('change', (e) => capSet({ font: e.target.value }))
    root.querySelectorAll('[data-ed-stroke]').forEach((b) => b.addEventListener('click', () => { const w = Number(b.dataset.edStroke); capSet(w ? { stroke: true, strokeWidth: w, strokeColor: '#000000' } : { stroke: false }) }))
    root.querySelectorAll('[data-ed-shadow]').forEach((b) => b.addEventListener('click', () => capSet({ shadow: b.dataset.edShadow === '1' })))
    root.querySelectorAll('[data-ed-scene]').forEach((b) => b.addEventListener('click', () => {
      const p = root.querySelector('#ag-ed-prompt')
      if (p) edPrompt[proj.scenes[edSel].i] = p.value
      edSel = Number(b.dataset.edScene) || 0
      edTab = 'scenes'
      edErr = ''
      edSeek(proj.scenes[edSel].start)
      render()
    }))
    root.querySelector('#ag-ed-prompt')?.addEventListener('input', (e) => { edPrompt[proj.scenes[edSel].i] = e.target.value })
    const sceneJob = (kind, fn) => async () => {
      const sc = proj.scenes[edSel]
      edBusy[sc.i] = kind
      edErr = ''
      render()
      try { await fn(sc) } catch (e) { edErr = e?.message || 'That did not work. Try again.' }
      delete edBusy[sc.i]
      render()
    }
    root.querySelector('[data-ed-redraw]')?.addEventListener('click', sceneJob('draw', (sc) => window.fvRedrawScene(sc.i, edPrompt[sc.i] ?? sc.prompt)))
    root.querySelector('[data-ed-animate]')?.addEventListener('click', sceneJob('animate', (sc) => window.fvAnimateScene(sc.i)))
    root.querySelector('[data-ed-animall]')?.addEventListener('click', async () => {
      const todo = proj.scenes.filter((x) => !x.clip && !edBusy[x.i])
      if (!todo.length || edWhole) return
      if (!confirm(`Animate ${todo.length} scene${todo.length === 1 ? '' : 's'}? Each takes a few minutes and uses video credits.`)) return
      edWhole = 'animate'; edWholeMsg = ''; edAnimAll = { done: 0, total: todo.length }
      todo.forEach((x) => { edBusy[x.i] = 'animate' })
      render()
      let i = 0, failed = 0
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (i < todo.length) {
          const sc = todo[i++]
          try { await window.fvAnimateScene(sc.i) } catch (_) { failed++ }
          delete edBusy[sc.i]
          edAnimAll.done++
          render()
        }
      }))
      edWhole = ''; edAnimAll = null
      edWholeMsg = failed ? `${failed} scene${failed === 1 ? '' : 's'} could not be animated. Try them one by one.` : ''
      render()
    })
    root.querySelectorAll('[data-ed-pace]').forEach((b) => b.addEventListener('click', async () => {
      if (edWhole || b.classList.contains('is-on')) return
      if (!confirm('Redraw every scene at the new pace? Your scene edits are replaced; the narration stays.')) return
      edWhole = 'pace'; edWholeMsg = ''; render()
      const err = await window.fvRepaceScenes?.(b.dataset.edPace)
      edWhole = ''; edWholeMsg = err || ''; edSel = 0; render()
    }))
    root.querySelectorAll('[data-ed-len]').forEach((b) => b.addEventListener('click', async () => {
      if (edWhole) return
      if (!confirm(`Make the video ${b.textContent}? This writes more script, records new narration and draws new scenes. The current version stays under My videos.`)) return
      edWhole = 'length'; edWholeMsg = ''; render()
      const err = await window.fvLengthenVideo?.(b.dataset.edLen)
      // Narration and scenes keep going after this returns; the Editor shows progress until the new scenes exist.
      if (err) edWhole = ''
      edWholeMsg = err === 'SIGN_IN' ? 'Sign in to make the video longer.' : (err || '')
      edSel = 0
      render()
    }))
    root.querySelector('[data-ed-still]')?.addEventListener('click', () => { try { window.fvStillScene(proj.scenes[edSel].i) } catch (_) {} ; render() })
    root.querySelectorAll('[data-ed-cap]').forEach((b) => b.addEventListener('click', () => { window.fvSetCaptionLook?.(b.dataset.edCap); render() }))
    root.querySelectorAll('[data-ed-music]').forEach((b) => b.addEventListener('click', () => { try { window.fvSelectMusic?.(b.dataset.edMusic) } catch (_) {} ; render() }))
    root.querySelector('[data-ed-vol]')?.addEventListener('change', (e) => { window.fvSetMusicVol?.(e.target.value); render() })
    root.querySelector('[data-ed-render]')?.addEventListener('click', async () => {
      if (Object.keys(edBusy).length) { edErr = 'Wait for the scene that is still drawing or animating.'; edTab = 'scenes'; return render() }
      edRendering = true
      try { edAudio?.pause() } catch (_) {}
      render()
      const err = await window.fvRenderSceneEdits?.()
      edRendering = false
      if (err) { edErr = err; return render() }
      selected = 'manager'
      say('manager', 'manager', 'Rendering your edits. The new cut will show up here when the Editor is done.')
      studio = 'progress'
      render()
    })
  }

  function studioHtml(st) {
    if (studio === 'profile' && pw) return profileStudioHtml(st)
    if (studio === 'script') return scriptStudioHtml(st)
    if (studio === 'settings') return settingsStudioHtml(st)
    if (studio === 'progress') return progressStudioHtml(st)
    if (studio === 'editor') return editorStudioHtml(st)
    return ''
  }
  /** Brand profiles are edited on the Brand page; this keeps the old entry points working. */
  function openProfileSetup(p, from, tab) {
    if (window.brandStudio) {
      try { window.switchPanel('brand', document.getElementById('nav-brand')) } catch (_) {}
      window.brandStudio.edit(p?.id || '', tab || 'style')
      return
    }
    openProfileSetupHere(p, from)
  }
  function openProfileSetupHere(p, from) {
    const st = state()
    const cv = st?.visual || {}
    pw = p ? { ...p } : normalizeProfile({ name: niche?.name ? niche.name + ' channel' : 'My channel', niche: niche?.id === 'custom' ? niche.name : (niche?.id || ''), voiceId: st?.voiceId || '', captions: st?.captionLook || '', durationId: st?.durationId || 'long_600', aspect: st?.aspect || '16:9', angle: st?.angle || 'auto', visualStyle: cv.style || DEFAULT_STYLE, visualMode: cv.mode || 'cheapest', scenePace: cv.pace || 'normal', characterUrl: cv.characterUrl || '', characterDesc: cv.characterDesc || '' })
    pwFrom = from || ''
    profileTab = 'style'
    studio = 'profile'
    profileView = ''
    visualsView = false
    popOpen = false
    try { window.fvAgentsLoadVoices?.() } catch (_) {}
  }
  function filterVoices(q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean)
    root.querySelectorAll('[data-voice-name]').forEach((el) => { el.hidden = !words.every((w) => el.dataset.voiceName.includes(w)) })
  }


  // ── Channel setup (onboarding) ─────────────────────────────────────────
  function firstName() {
    let u = null
    try { u = getUser?.() } catch (_) {}
    const n = String(u?.name || u?.full_name || '').trim().split(/\s+/)[0]
    return n && !/^preview$/i.test(n) ? n : ''
  }
  function setupAsk(step) {
    setup.step = step
    suAll = false
    saveSetup()
    const a0 = setup.answers || {}
    const ctx = step === 'episode' ? (a0.channelName || '') : step === 'style' ? (genreById(a0.genre)?.name || niche?.name || '') : (niche?.name || '')
    say('manager', 'manager', setupQuestion(step, { name: firstName(), niche: ctx }), 'setup-' + step)
  }
  /** Start (or resume) the setup. Skipped when it is already done. */
  function startSetup({ force = false, from = '' } = {}) {
    // Done once finished or skipped, or when the account already has a channel profile.
    if (profilesKey() !== profilesFor) { profilesFor = profilesKey(); profiles = loadProfiles() }
    if (!force && (setupDone() || profiles.list.length)) return false
    if (!canAddChannel()) {
      selected = 'manager'; studio = ''
      try { window.switchPanel('agents', document.getElementById('nav-agents')) } catch (_) {}
      capNote()
      return true
    }
    // The full-screen channel creator (lib/channel-creator.js) runs the setup when it is loaded.
    if (window.channelCreator) {
      try { window.switchPanel('create', null) } catch (_) {}
      // A setup already under way (e.g. after a reload) carries on where it was.
      if (!window.channelCreator.inProgress?.()) window.channelCreator.open(from)
      return true
    }
    studio = ''
    selected = 'manager'
    visualsView = false
    profileView = ''
    changingNiche = false
    if (!setup) setup = { step: 'genre', answers: {} }
    const last = mine.filter((m) => m.to === 'manager').pop()
    if (!last || last.kind !== 'setup-' + setup.step) setupAsk(setup.step)
    render()
    return true
  }
  function setupAnswer(label, patch, nextStep) {
    say('manager', 'me', label)
    Object.assign(setup.answers, patch)
    if (nextStep) setupAsk(nextStep)
    else saveSetup()
    render()
  }
  function endSetup(answers) {
    setup = null
    saveSetup()
    try { localStorage.setItem(setupDoneKey(), '1') } catch (_) {}
    try { window.fvSetupDone?.(answers) } catch (_) {}
  }
  /** Genre + "what it's about": set the niche, then let the channel agent name the channel. */
  async function submitGenre(aboutRaw) {
    const a = setup.answers
    const about = String(aboutRaw || a.aboutDraft || '').trim()
    if (about.length < 3) return
    if (!a.genre) a.genre = 'education'
    const g = genreById(a.genre)
    const picked = a.nicheId ? nicheById(a.nicheId) : null
    const n = picked || customNiche(about.replace(/^\s*(a\s+)?(youtube\s+)?channel\s+(about|on|for)\s+/i, '').replace(/^./, (c) => c.toUpperCase()).slice(0, 60))
    if (n) { niche = n; try { localStorage.setItem(nicheKey(), JSON.stringify({ id: n.id, name: n.name })) } catch (_) {} }
    say('manager', 'me', `${g.name} · ${about}`)
    Object.assign(a, { about, niche: n?.id === 'custom' ? n.name : (n?.id || '') })
    delete a.aboutDraft
    saveSetup()
    pending = 'Naming your channel…'
    render()
    let out = null
    try { out = await Promise.race([window.fvSetupChannel?.({ genre: g.name, about, niche: n?.name || '' }), new Promise((r) => setTimeout(() => r(null), 20000))]) } catch (_) {}
    pending = ''
    if (!setup) return
    const fb = fallbackChannel({ about, ideas: picked?.ideas || [] })
    a.channelName = out?.name || fb.name
    a.topics = out?.topics?.length ? out.topics : fb.topics
    setupAsk('episode')
    render()
  }
  function finishSetup() {
    const a = setup?.answers || {}
    const p = profilesApi.save(normalizeProfile(profileFromSetup(a, niche?.name || '')))
    endSetup({ ...a, profile: p.name })
    const topic = a.topic || ''
    say('manager', 'manager', `You're all set: ${p.name} is ready. From now on just tell me "make a video about …" and the team does the rest: script, voice, ${visualStyleById(p.visualStyle)?.name || 'AI'} scenes, captions and the finished MP4.${topic ? ` Want me to make the first episode, “${topic}”, now?` : ''}`, topic ? 'first-episode' : 'ideas', topic ? { topic } : undefined)
    render()
  }
  /** The channel creator finished: save the profile, then start episode 1 or offer it. */
  /** Start the video with the current brief and settings (what "Hand it to the team" does). */
  async function handToTeam() {
      studio = 'progress'
      selected = 'manager'
      if (brief.mode === 'own') {
        const est = scriptEstimate(scriptDraft.text)
        say('manager', 'me', `Use my script${scriptDraft.title ? ': “' + scriptDraft.title + '”' : ''} (${est.label})`)
        say('manager', 'manager', `Got it. I'll skip writing and hand your script to Title, Thumbnail, Voice, Agent and Editor. It runs about ${formatMinutes(est.seconds)}.`)
        const handoff = mine[mine.length - 1]
        render()
        markVideo(); const err = await window.fvAgentsRunScript?.({ text: scriptDraft.text, title: scriptDraft.title })
        if (err) { mine = mine.filter((m) => m !== handoff); save(); studio = '' }
        if (err === 'SIGN_IN') say('manager', 'manager', "You're in preview mode, so I can't make videos yet. Sign in and send the script again.", 'signin')
        else if (err) say('manager', 'manager', err, 'stuck')
        else scriptDraft = { title: '', text: '' }
        return render()
      }
      const topic = brief.topic.trim()
      say('manager', 'me', topic)
      render()
      const err = await startVideo(topic, state())
      if (err) { studio = ''; render() } else brief.topic = ''
  }

  function channelCreated(profile, { niche: n, topic = '', firstTopic = '', script = null } = {}) {
    if (n) { niche = n; try { localStorage.setItem(nicheKey(), JSON.stringify({ id: n.id, name: n.name })) } catch (_) {} }
    studio = ''
    selected = 'manager'
    visualsView = false
    profileView = ''
    setup = null
    const p = profilesApi.save(profile)
    if (!p) return
    endSetup({ genre: profile.genre, about: profile.about, profile: p.name, firstTopic, startedFirst: !!(topic || script) })
    // Episode 1 opens on the full video settings page, so every option is there before the team starts.
    if (script?.text || topic) {
      if (script?.text) { brief = { mode: 'own', topic: '' }; scriptDraft = { title: script.title || '', text: script.text } }
      else brief = { mode: 'write', topic }
      // Every option was picked in the four setup steps, so the team starts right away.
      say('manager', 'manager', `${p.name} is ready. The team is starting episode 1 now.`)
      handToTeam()
      return
    }
    say('manager', 'manager', `${p.name} is ready. From now on just tell me "make a video about …" and the team does the rest.${firstTopic ? ` Want me to make the first episode, “${firstTopic}”, now?` : ''}`, firstTopic ? 'first-episode' : 'ideas', firstTopic ? { topic: firstTopic } : undefined)
    render()
  }
  function channelSkipped() {
    setup = null
    endSetup({ skipped: true })
    say('manager', 'manager', 'No problem. I\'ll use sensible defaults, and you can set up your channel any time under Brand. What should the first video be about?', 'ideas')
    render()
  }
  function skipSetup() {
    say('manager', 'me', 'Skip setup')
    endSetup({ skipped: true })
    say('manager', 'manager', 'No problem. I\'ll use sensible defaults, and you can set everything up any time under Brand. What should the first video be about?', 'ideas')
    render()
  }
  /** Typed text while the setup is running. Returns true when it was handled here. */
  function setupText(msg) {
    if (!setup) return false
    if (/^\s*(skip|skip setup|later|not now)\s*[.!]?$/i.test(msg)) { skipSetup(); return true }
    if (setup.step === 'genre' && !wantsVideoNow(msg)) { submitGenre(msg); return true }
    if (setup.step === 'episode' && !wantsVideoNow(msg)) { setupAnswer(msg.trim(), { topic: msg.trim() }, 'style'); return true }
    // An explicit "make a video about X" mid-setup keeps the answers so far and starts the video.
    // Anything else is an answer we can't read, so ask again.
    if (wantsVideoNow(msg)) {
      say('manager', 'me', msg)
      const a = setup.answers
      profilesApi.save(normalizeProfile(profileFromSetup(a, niche?.name || '')))
      endSetup({ ...a, skippedAt: setup?.step })
      const topic = String(msg).replace(/^.*?\b(?:video|one)\b\s*(?:about|on|of)?\s*/i, '').trim()
      startVideo(topic.length >= 4 ? topic : msg, state())
      return true
    }
    say('manager', 'me', msg)
    say('manager', 'manager', 'Pick one above, or say "skip" and I\'ll choose for you.', 'setup-' + setup.step)
    render()
    return true
  }
  function wantsVideoNow(msg) {
    const t = String(msg || '').toLowerCase()
    return /\b(make|create|generate|start|do|build)\b[^.?!]{0,30}\b(video|one)\b/.test(t) && !isVague(msg)
  }
  function setupWidget(step, st) {
    const a = setup?.answers || {}
    const chips = '<div class="ag-chips"><button type="button" class="ag-chip" data-su-skip>Skip setup</button></div>'
    if (step === 'genre') {
      const g = genreById(a.genre)
      return `<div class="ag-genres" role="radiogroup" aria-label="Genre">${GENRES.map((x) => `<button type="button" class="ag-genre${a.genre === x.id ? ' is-on' : ''}" role="radio" aria-checked="${a.genre === x.id}" data-su-genre="${esc(x.id)}"><img src="/home/img/genres/${esc(x.id)}.jpg" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>
        <form class="ag-su-about" data-su-about-form>
          <label class="sr-only" for="ag-su-about">What is the channel about?</label>
          <textarea id="ag-su-about" rows="2" maxlength="300" placeholder="${esc(g?.placeholder || 'Channel about famous heists and scams')}">${esc(a.aboutDraft || '')}</textarea>
          <button type="submit" class="ag-go" data-su-genre-next${a.genre && String(a.aboutDraft || '').trim().length >= 3 ? '' : ' disabled'}>Next</button>
        </form>
        <div class="ag-card-label">Breaking out right now</div>
        <div class="ag-chips">${rankedNiches().slice(0, 6).map((n) => `<button type="button" class="ag-chip${a.nicheId === n.id ? ' is-on' : ''}" data-su-nichechip="${esc(n.id)}">${esc(n.name)} <span style="opacity:.6;margin-left:6px">${esc(PAY[n.pay].label)}</span></button>`).join('')}</div>${chips}`
    }
    if (step === 'episode') {
      return `<div class="ag-su-name"><label class="ag-card-label" for="ag-su-name">Channel name</label><input id="ag-su-name" maxlength="40" value="${esc(a.channelName || '')}" autocomplete="off"></div>
        <div class="ag-su-topics">${(a.topics || []).map((t) => `<button type="button" class="ag-su-topic" data-su-topic="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <form class="ag-niche-own" data-su-topic-own><label for="ag-su-topic">Your own topic</label><input id="ag-su-topic" maxlength="200" placeholder="What is the first episode about?" autocomplete="off"><button type="submit" class="ag-chip is-primary">Use this</button></form>${chips}`
    }
    if (step === 'niche') {
      return `<div class="ag-niche-grid ag-su">${rankedNiches().map((n) => `
        <button type="button" class="ag-niche-card" data-su-niche="${esc(n.id)}">
          <span class="ag-niche-top"><b>${esc(n.name)}</b><span class="ag-pay is-${esc(n.pay)}">${esc(PAY[n.pay].label)}</span></span>
          <span class="ag-niche-blurb">${esc(n.blurb)}</span>
        </button>`).join('')}</div>
        <form class="ag-niche-own" data-su-niche-own><label for="ag-su-niche">Something else?</label><input id="ag-su-niche" maxlength="60" placeholder="e.g. cars, anime lore, chess" autocomplete="off"><button type="submit" class="ag-chip is-primary">Use this</button></form>${chips}`
    }
    if (step === 'style') {
      const ids = suAll ? VISUAL_STYLES.map((x) => x.id) : (genreById(a.genre)?.styles || stylesForNiche(niche?.id))
      return `${suAll ? '<input class="ag-style-search" data-su-q type="search" placeholder="Search ' + VISUAL_STYLES.length + ' styles" aria-label="Search styles" autocomplete="off">' : ''}
        <div class="ag-style-grid${suAll ? ' ag-style-scroll' : ''}">${ids.map((id) => { const x = visualStyleById(id); return `<button type="button" class="ag-style${a.style === id ? ' is-on' : ''}" data-su-style="${esc(id)}" data-name="${esc((x.name + ' ' + x.group).toLowerCase())}"><img src="${esc(styleSample(id, a.genre))}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>` }).join('')}</div>
        <div class="ag-chips">${suAll ? '' : `<button type="button" class="ag-chip" data-su-all>See all ${VISUAL_STYLES.length} styles</button>`}<button type="button" class="ag-chip" data-su-skip>Skip setup</button></div>`
    }
    if (step === 'voice') {
      const all = st?.voices || []
      if (!all.length) {
        return `<div class="ag-note" style="padding:0">${esc(st?.voiceState === 'error' ? 'Voices load once you sign in.' : 'Loading voices…')}</div><div class="ag-chips"><button type="button" class="ag-chip is-primary" data-su-voice="">Use the default voice</button><button type="button" class="ag-chip" data-su-skip>Skip setup</button></div>`
      }
      const list = suAll ? all : pickVoices(all, 6)
      return `<div class="ag-voices ag-su-voices" role="radiogroup" aria-label="Narrator voice">${list.map((v) => `
        <div class="ag-voice${a.voiceId === v.id ? ' is-on' : ''}">
          <button type="button" class="ag-voice-pick" role="radio" aria-checked="${a.voiceId === v.id}" data-su-voice="${esc(v.id)}">${esc(v.name || v.label)}${v.desc ? ` <span style="opacity:.6">· ${esc(v.desc)}</span>` : ''}</button>
          ${v.preview ? `<button type="button" class="ag-voice-play" data-ag-play="${esc(v.preview)}" aria-label="Preview ${esc(v.name || v.label)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>` : ''}
        </div>`).join('')}</div>
        <div class="ag-chips">${suAll || all.length <= 6 ? '' : `<button type="button" class="ag-chip" data-su-all>See all ${all.length} voices</button>`}<button type="button" class="ag-chip" data-su-skip>Skip setup</button></div>`
    }
    if (step === 'captions') return captionPickHtml(a.captions || genreById(a.genre)?.captions || '', 'data-su-cap') + (genreById(a.genre) ? `<div class="ag-note" style="padding:0">Highlighted: the usual pick for ${esc(genreById(a.genre).name)}.</div>` : '') + chips
    if (step === 'video') {
      const len = a.durationId || 'long_600'
      const asp = a.aspect || '16:9'
      return `<div class="ag-card-label">Length</div><div class="ag-chips">${LENGTHS.map(([id, l]) => `<button type="button" class="ag-chip${len === id ? ' is-on' : ''}" data-su-len="${id}">${l}</button>`).join('')}</div>
        <div class="ag-card-label">Screen</div><div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([v, l]) => `<button type="button" class="ag-chip${asp === v ? ' is-on' : ''}" data-su-aspect="${v}">${l}</button>`).join('')}</div>
        <div class="ag-chips"><button type="button" class="ag-chip is-primary" data-su-finish>Finish setup</button></div>`
    }
    return ''
  }
  function bindSetup(st) {
    if (!setup) {
      root.querySelectorAll('[data-su-start]').forEach((b) => b.addEventListener('click', () => startSetup({ force: true, from: 'agents' })))
      return
    }
    root.querySelectorAll('[data-su-skip]').forEach((b) => b.addEventListener('click', skipSetup))
    root.querySelectorAll('[data-su-all]').forEach((b) => b.addEventListener('click', () => { suAll = true; render() }))
    root.querySelector('[data-su-q]')?.addEventListener('input', (e) => {
      const words = String(e.target.value || '').toLowerCase().split(/\s+/).filter(Boolean)
      root.querySelectorAll('[data-su-style]').forEach((b) => { b.hidden = !words.every((w) => b.dataset.name.includes(w)) })
    })
    root.querySelectorAll('[data-su-genre]').forEach((b) => b.addEventListener('click', () => {
      setup.answers.aboutDraft = root.querySelector('#ag-su-about')?.value ?? setup.answers.aboutDraft
      setup.answers.genre = b.dataset.suGenre
      saveSetup()
      render()
      root.querySelector('#ag-su-about')?.focus()
    }))
    const about = root.querySelector('#ag-su-about')
    about?.addEventListener('input', () => {
      setup.answers.aboutDraft = about.value
      const nx = root.querySelector('[data-su-genre-next]')
      if (nx) nx.disabled = !(setup.answers.genre && about.value.trim().length >= 3)
    })
    about?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); root.querySelector('[data-su-about-form]')?.requestSubmit() } })
    root.querySelector('[data-su-about-form]')?.addEventListener('submit', (e) => { e.preventDefault(); if (!setup.answers.genre) return; submitGenre(about?.value) })
    root.querySelectorAll('[data-su-nichechip]').forEach((b) => b.addEventListener('click', () => {
      const n = nicheById(b.dataset.suNichechip)
      if (!n) return
      setup.answers.nicheId = n.id
      setup.answers.aboutDraft = 'Channel about ' + n.name.toLowerCase()
      if (!setup.answers.genre) setup.answers.genre = ({ history: 'history', military: 'history', crime: 'mystery', space: 'documentary', geography: 'documentary', business: 'storytelling' })[n.id] || 'education'
      saveSetup()
      render()
    }))
    root.querySelector('#ag-su-name')?.addEventListener('change', (e) => { const v = e.target.value.trim(); if (v) { setup.answers.channelName = v.slice(0, 40); saveSetup() } })
    root.querySelectorAll('[data-su-topic]').forEach((b) => b.addEventListener('click', () => {
      const v = root.querySelector('#ag-su-name')?.value.trim(); if (v) setup.answers.channelName = v.slice(0, 40)
      setupAnswer(b.dataset.suTopic, { topic: b.dataset.suTopic }, 'style')
    }))
    root.querySelector('[data-su-topic-own]')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const t = root.querySelector('#ag-su-topic')?.value.trim()
      if (!t || t.length < 4) return
      const v = root.querySelector('#ag-su-name')?.value.trim(); if (v) setup.answers.channelName = v.slice(0, 40)
      setupAnswer(t, { topic: t }, 'style')
    })
    root.querySelectorAll('[data-su-niche]').forEach((b) => b.addEventListener('click', () => {
      const n = nicheById(b.dataset.suNiche)
      if (!n) return
      niche = n
      try { localStorage.setItem(nicheKey(), JSON.stringify({ id: n.id, name: n.name })) } catch (_) {}
      setupAnswer(n.name, { niche: n.id }, 'style')
    }))
    root.querySelector('[data-su-niche-own]')?.addEventListener('submit', (e) => { e.preventDefault(); setupText(root.querySelector('#ag-su-niche')?.value || '') })
    root.querySelectorAll('[data-su-style]').forEach((b) => b.addEventListener('click', () => setupAnswer(visualStyleById(b.dataset.suStyle)?.name || b.dataset.suStyle, { style: b.dataset.suStyle }, 'voice')))
    root.querySelectorAll('[data-su-voice]').forEach((b) => b.addEventListener('click', () => {
      const v = (st?.voices || []).find((x) => x.id === b.dataset.suVoice)
      setupAnswer(v ? (v.name || v.label) : 'Default voice', { voiceId: v?.id || '', voiceLabel: v?.label || '' }, 'captions')
    }))
    root.querySelectorAll('[data-su-cap]').forEach((b) => b.addEventListener('click', () => {
      const l = (window.fvCaptionLooks?.() || []).find((x) => x.id === b.dataset.suCap)
      setupAnswer((l?.name || 'Captions') + ' captions', { captions: b.dataset.suCap }, 'video')
    }))
    root.querySelectorAll('[data-su-len]').forEach((b) => b.addEventListener('click', () => { setup.answers.durationId = b.dataset.suLen; saveSetup(); render() }))
    root.querySelectorAll('[data-su-aspect]').forEach((b) => b.addEventListener('click', () => { setup.answers.aspect = b.dataset.suAspect; saveSetup(); render() }))
    root.querySelector('[data-su-finish]')?.addEventListener('click', () => {
      const a = setup.answers
      setupAnswer(`${(LENGTHS.find(([id]) => id === (a.durationId || 'long_600')) || [])[1]} videos, ${a.aspect || '16:9'}`, {}, null)
      finishSetup()
    })
  }

  function profileSummary(p, st) {
    const v = (st?.voices || []).find((x) => x.id === p.voiceId)
    const len = (LENGTHS.find(([id]) => id === p.durationId) || [])[1] || ''
    return [nicheById(p.niche)?.name || p.niche, visualStyleById(p.visualStyle)?.name, v ? v.label.split(' · ')[0] : p.voiceLabel, LOOK_NAMES[p.captions] ? LOOK_NAMES[p.captions] + ' captions' : '', len, p.aspect, p.angle !== 'auto' ? angleById(p.angle).name : ''].filter(Boolean).join(' · ')
  }

  function profilesHtml(st) {
    if (profileView === 'edit' && profileDraft) {
      const d = profileDraft
      const chip = (attr, val, on, label) => `<button type="button" class="ag-chip${on ? ' is-on' : ''}" ${attr}="${esc(val)}">${esc(label)}</button>`
      return `<div class="ag-profiles">
        <h3>${profiles.list.some((p) => p.id === d.id) ? 'Edit profile' : 'New brand profile'}</h3>
        <p>Save how this channel's videos are made. Picking the profile sets all of it at once.</p>
        <form class="ag-form" data-ag-profile-form>
          <label>Name<input id="ag-pf-name" maxlength="40" value="${esc(d.name)}" autocomplete="off"></label>
          <div class="ag-field"><span class="ag-card-label">Niche</span><div class="ag-chips">${NICHES.map((n) => chip('data-pf-niche', n.id, d.niche === n.id, n.name)).join('')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Narrator voice</span>${(st?.voices || []).length ? `<select id="ag-pf-voice"><option value="">Default voice</option>${st.voices.map((v) => `<option value="${esc(v.id)}"${v.id === d.voiceId ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select>` : '<div class="ag-note" style="padding:0">Voices load once you sign in; the profile keeps the default voice until then.</div>'}</div>
          <div class="ag-field"><span class="ag-card-label">Captions</span><div class="ag-chips">${Object.entries(LOOK_NAMES).map(([id, nm]) => chip('data-pf-cap', id, d.captions === id, nm)).join('')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Length</span><div class="ag-chips">${LENGTHS.map(([id, l]) => chip('data-pf-len', id, d.durationId === id, l)).join('')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Frame</span><div class="ag-chips">${chip('data-pf-aspect', '16:9', d.aspect === '16:9', '16:9 YouTube')}${chip('data-pf-aspect', '9:16', d.aspect === '9:16', '9:16 Shorts')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Visuals</span><div class="ag-chips"><span class="ag-chip is-on">${esc(visualsLabel({ style: d.visualStyle, mode: d.visualMode, pace: d.scenePace, characterUrl: d.characterUrl }))}</span><button type="button" class="ag-chip" data-pf-vis-current>Use current visuals</button></div></div>
          <div class="ag-field"><span class="ag-card-label">Script angle</span><div class="ag-chips">${ANGLES.map((a) => chip('data-pf-angle', a.id, d.angle === a.id, a.name)).join('')}</div></div>
          <div class="ag-chips"><button type="submit" class="ag-chip is-primary">Save and use</button><button type="button" class="ag-chip" data-ag-profiles>Cancel</button></div>
        </form>
      </div>`
    }
    return `<div class="ag-profiles">
      <h3>Brand profiles</h3>
      <p>One profile per channel: its niche, voice, captions, length, frame and script angle. Pick one and every new video uses it.</p>
      <div class="ag-profile-list">${profiles.list.map((p) => `
        <div class="ag-profile-card${p.id === profiles.active ? ' is-on' : ''}">
          <div><b>${esc(p.name)}</b>${p.id === profiles.active ? '<span class="ag-pay is-high">In use</span>' : ''}</div>
          <span>${esc(profileSummary(p, st) || 'Default settings')}</span>
          <div class="ag-chips">${p.id === profiles.active ? '' : `<button type="button" class="ag-chip is-primary" data-pf-use="${esc(p.id)}">Use</button>`}<button type="button" class="ag-chip" data-pf-edit="${esc(p.id)}">Edit</button><button type="button" class="ag-chip" data-pf-del="${esc(p.id)}">Delete</button></div>
        </div>`).join('') || '<div class="ag-note">No profiles yet.</div>'}</div>
      <div class="ag-chips"><button type="button" class="ag-chip is-primary" data-pf-new>New profile</button><button type="button" class="ag-chip" data-ag-profiles-close>Back to chat</button></div>
    </div>`
  }

  function nichePickerHtml() {
    const list = rankedNiches()
    return `<div class="ag-niche">
      <div class="ag-empty-crew">${AGENTS.map((a) => agentSvg(a.id)).join('')}</div>
      <h3>What's your channel about?</h3>
      <p>Pick a niche and your agents will pitch videos in it. These are the faceless niches breaking out right now, best first: how well each pays, and a real video that just did many times its channel's usual views.</p>
      <div class="ag-niche-grid">${list.map((n) => `
        <button type="button" class="ag-niche-card" data-ag-niche="${esc(n.id)}">
          <span class="ag-niche-top"><b>${esc(n.name)}</b><span class="ag-pay is-${esc(n.pay)}">${esc(PAY[n.pay].label)}</span></span>
          <span class="ag-niche-blurb">${esc(n.blurb)}</span>
          <span class="ag-niche-proof"><span class="ag-niche-x">${esc(breakoutLabel(n.proof.x))}</span><span>“${esc(n.proof.title)}” · ${esc(n.proof.channel)}</span></span>
        </button>`).join('')}</div>
      <form class="ag-niche-own" data-ag-niche-own>
        <label for="ag-niche-own">Something else?</label>
        <input id="ag-niche-own" maxlength="60" placeholder="e.g. cars, anime lore, chess" autocomplete="off">
        <button type="submit" class="ag-chip is-primary">Use this</button>
      </form>
      <p class="ag-niche-src">Pay is a tier, not a promise: YouTube doesn't publish pay by niche and estimates vary. Multiples compare a video to its own channel's usual views.</p>
      ${niche ? '<button type="button" class="ag-chip" data-ag-niche-cancel>Keep ' + esc(niche.name) + '</button>' : ''}
    </div>`
  }

  function threadHtml(st) {
    const items = entriesFor(selected, st)
    const crew = st?.crew || {}
    if (visualsView) return visualsHtml(st)
    if (profileView) return profilesHtml(st)
    if (selected === 'manager' && (changingNiche || (!niche && !items.length && setupDone()))) return nichePickerHtml()
    if (!items.length && selected === 'manager') {
      return `<div class="ag-empty">
        <div class="ag-empty-crew">${AGENTS.map((a) => agentSvg(a.id)).join('')}</div>
        <h3>What should your agents make?</h3>
        <p>Give the Manager a topic. Script, Title, Thumbnail, Voice, Agent and Editor take it from there and hand you a finished video.</p>
        <div class="ag-chips">${ideasNow().map((x) => `<button type="button" class="ag-chip" data-ag-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        ${niche ? `<div class="ag-note">Niche: <b>${esc(niche.name)}</b> · <button type="button" data-ag-niche-change>Change</button></div>` : ''}
        ${!profiles.list.length ? '<div class="ag-chips" style="justify-content:center"><button type="button" class="ag-chip is-primary" data-su-start>Set up my channel</button></div>' : ''}
      </div>`
    }
    // Attach each artifact to the newest "done" entry of the agent that made it.
    const lastDone = {}
    items.forEach((e, i) => { if (e.type === 'log' && e.kind === 'done') lastDone[e.agent] = i })
    let html = items.length ? `<div class="ag-day">${esc(dayLabel(items[0].at))}</div>` : `<div class="ag-empty"><div class="ag-empty-crew">${agentSvg(selected)}</div><h3>${esc(BY_ID[selected].name)}</h3><p>${esc(BY_ID[selected].role)}. Nothing yet for this video.</p></div>`
    let prevWho = ''
    items.forEach((e, i) => {
      if (e.type === 'mine' && e.from === 'me') {
        html += `<div class="ag-msg from-me"><div class="ag-bubble">${esc(e.text)}</div></div>`
        prevWho = 'me'
        return
      }
      const who = e.type === 'mine' ? (e.from || selected) : e.agent
      const a = BY_ID[who] || BY_ID.manager
      const head = who !== prevWho ? `<div class="ag-who">${agentSvg(who)}<b>${esc(a.name)}</b><span>${esc(clock(e.at))}</span></div>` : ''
      const cls = e.kind === 'done' && who !== 'manager' ? ' is-check' : e.kind === 'stuck' ? ' is-stuck' : e.kind === 'error' ? ' is-error' : ''
      html += `<div class="ag-msg">${head}<div class="ag-bubble${cls}">${esc(e.text)}</div>`
      if (e.kind === 'ideas' && i === items.length - 1) html += `<div class="ag-chips">${ideasNow().map((x) => `<button type="button" class="ag-chip" data-ag-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>`
      if (e.kind === 'signin') html += `<div class="ag-chips"><a class="ag-chip is-primary" href="/login?ui=0">Sign in</a></div>`
      if (setup && e.kind === 'setup-' + setup.step && i === items.length - 1) html += `<div class="ag-su-wrap">${setupWidget(setup.step, st)}</div>`
      if (e.kind === 'first-episode' && i === items.length - 1 && !st?.script) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-newtopic="${esc(e.topic || '')}">Make it now</button><button type="button" class="ag-chip" data-ag-say="Not now">Not now</button></div>`
      if (e.type === 'log' && e.agent === 'editor' && e.kind === 'error' && i === items.length - 1 && !st?.renderUrl) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-retry-render>Try again</button></div>`
      const last = i === items.length - 1
      if (e.kind === 'captions' && last) {
        const looks = (() => { try { return window.fvCaptionLooks?.() || [] } catch (_) { return [] } })()
        html += `<div class="ag-chips">${looks.map((l) => `<button type="button" class="ag-chip" data-ag-cap="${esc(l.id)}" style="font-family:'${esc(l.font)}',Impact,sans-serif;color:${esc(l.color)}">${esc(l.name)}</button>`).join('')}</div>`
      }
      if (e.kind === 'edit-menu' && last) html += `<div class="ag-chips">${['Captions', 'Title', 'Thumbnail', 'Voice', 'Music', 'B-roll'].map((x) => `<button type="button" class="ag-chip" data-ag-say="Change the ${esc(x.toLowerCase())}">${esc(x)}</button>`).join('')}</div>`
      if (e.kind === 'render' && last) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-retry-render>Render it now</button></div>`
      if (e.kind === 'confirm-new' && last) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-newtopic="${esc(e.topic || '')}">Yes, new video</button><button type="button" class="ag-chip" data-ag-keep>No, keep this one</button></div>`
      if (e.type === 'log' && lastDone[e.agent] === i) {
        const art = selected === 'manager' && e.agent === 'editor' ? '' : artifactFor(e.agent, st)
        if (art) html += art
      }
      html += '</div>'
      prevWho = who
    })
    // The finished video always sits at the end of the Manager chat, so it never scrolls out of reach.
    if (selected === 'manager' && !st?.renderUrl && pastVideo?.url) {
      const file = (String(pastVideo.title || 'vidso-video').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'vidso-video') + '.mp4'
      html += `<div class="ag-msg" data-ag-delivery><div class="ag-who">${agentSvg('editor')}<b>Editor</b><span>Your last video</span></div><div class="ag-card">
        <div class="ag-card-label">From My Files</div>
        <video controls playsinline preload="metadata" src="${esc(pastVideo.url)}"></video>
        ${pastVideo.title ? `<div class="ag-card-title">${esc(pastVideo.title)}</div>` : ''}
        <div class="ag-chips"><a class="ag-chip is-primary" href="${esc(pastVideo.url)}" download="${esc(file)}" target="_blank" rel="noopener">Download video</a><button type="button" class="ag-chip" data-ag-files>Open My Files</button></div>
      </div></div>`
    }
    if (selected === 'manager' && st?.renderUrl && videoHere()) html += `<div class="ag-msg" data-ag-delivery>${prevWho !== 'editor' ? `<div class="ag-who">${agentSvg('editor')}<b>Editor</b><span>Your video</span></div>` : ''}${deliveryHtml(st)}</div>`
    const working = selected === 'manager'
      ? Object.entries(crew).filter(([id, c]) => c.state === 'working' && id !== 'manager')
      : (crew[selected]?.state === 'working' ? [[selected, crew[selected]]] : [])
    if ((working.length || pending) && !teamOn(st)) {
      const [id, c] = working[0] || [selected, { text: pending }]
      const more = working.length > 1 ? ` <span>· ${working.slice(1).map(([w]) => BY_ID[w]?.name).join(', ')} also working</span>` : ''
      html += `<div class="ag-building">${agentSvg(id)}<span><b>${esc(BY_ID[id]?.name || '')}</b> ${esc(c.text || 'Building')}${more}</span></div>`
    }
    return html
  }

  function voiceListHtml(st) {
    const list = st?.voices || []
    if (!list.length) {
      const msg = st?.voiceState === 'loading' ? 'Loading voices…' : st?.voiceState === 'error' ? 'Voices load once you sign in.' : 'Loading voices…'
      return `<div class="ag-note" style="padding:0">${esc(msg)}</div>`
    }
    return `<div class="ag-voices" role="radiogroup" aria-label="Narrator voice">${list.map((v) => {
      const on = v.id === st.voiceId
      return `<div class="ag-voice${on ? ' is-on' : ''}">
        <button type="button" class="ag-voice-pick" role="radio" aria-checked="${on}" data-ag-voice="${esc(v.id)}">${esc(v.label)}</button>
        ${v.preview ? `<button type="button" class="ag-voice-play" data-ag-play="${esc(v.preview)}" aria-label="Preview ${esc(v.label)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>` : ''}
      </div>`
    }).join('')}</div>`
  }

  function voiceName(st) {
    const v = (st?.voices || []).find((x) => x.id === st?.voiceId)
    return v ? String(v.label).split(' · ')[0] : ''
  }

  function ownScriptHtml() {
    const est = scriptEstimate(scriptDraft.text)
    return `<form class="ag-own" data-ag-own-form>
      <div class="ag-own-head"><b>Your script</b><span>${esc(est.label || 'Paste the narration. Blank lines split it into sections; "## Heading" lines name them.')}</span></div>
      <input id="ag-own-title" maxlength="120" placeholder="Working title (optional)" value="${esc(scriptDraft.title)}" autocomplete="off">
      <textarea id="ag-own-text" rows="8" placeholder="Paste your script here">${esc(scriptDraft.text)}</textarea>
      <div class="ag-chips"><button type="submit" class="ag-chip is-primary"${est.words < 40 ? ' disabled' : ''}>Make the video</button><button type="button" class="ag-chip" data-ag-own-cancel>Cancel</button>${est.words && est.words < 40 ? '<span class="ag-note">At least 40 words.</span>' : ''}</div>
    </form>`
  }

  /** The team at work on this channel's video, just above the message box. */
  function teamOn(st) {
    return selected === 'manager' && !!st?.running && !st?.renderUrl && videoHere()
  }
  function teamHtml(st) {
    if (!teamOn(st)) return ''
    const pr = progressFrom(st?.crew || {}, { delivered: false })
    const f = pr.focus
    const mins = st?.startedAt ? Math.max(0, Math.round((Date.now() - st.startedAt) / 60000)) : 0
    const also = pr.steps.filter((x) => x.state === 'working' && x !== f).map((x) => x.name)
    const line = f.state === 'working' ? (f.text || f.note) : f.state === 'stuck' ? `needs you: ${f.text || 'it stopped'}` : 'getting ready'
    return `<div class="ag-team" aria-live="polite">
      <div class="ag-team-row">${pr.steps.map((x) => `<button type="button" class="ag-team-m" data-state="${esc(x.state)}" data-ag-pick="${esc(x.agent)}" title="${esc(x.name)}: ${esc(x.state === 'idle' ? x.note : x.text || x.note)}"><span class="ag-team-ava">${agentSvg(x.agent)}${x.state === 'working' ? '<i class="ag-team-typing"><b></b><b></b><b></b></i>' : x.state === 'done' ? '<i class="ag-team-ok">✓</i>' : x.state === 'stuck' ? '<i class="ag-team-ok is-stuck">!</i>' : ''}</span><span class="ag-team-name">${esc(x.name.split(' ')[0])}</span></button>`).join('')}</div>
      <div class="ag-team-now"><b>${esc(f.name)}</b> ${esc(line)}${also.length ? ` · ${esc(also.join(', '))} too` : ''}<span>${pr.done} of ${pr.steps.length} done${mins ? ' · ' + mins + ' min' : ''}</span></div>
      <div class="ag-team-bar"><i style="width:${pr.percent}%"></i></div>
    </div>`
  }

  function composerHtml(st) {
    if (scriptMode && selected === 'manager') return ownScriptHtml()
    const a = BY_ID[selected]
    const len = st?.durationLabel || ''
    const steer = STEERABLE.has(selected)
    const placeholder = selected === 'manager' || st?.script ? `Message ${a.name}` : `${a.name} works once the script is written`
    if (!steer) {
      return `<div class="ag-note">${esc(a.name)} takes its brief from the Manager. To change it, message the Manager.</div>`
    }
    return `${teamHtml(st)}
      <div class="ag-pop" data-ag-pop ${popOpen ? '' : 'hidden'}>
        <div class="ag-card-label">Length</div>
        <div class="ag-chips">${LENGTHS.map(([id, label]) => `<button type="button" class="ag-chip${st?.durationId === id ? ' is-on' : ''}" data-ag-len="${id}">${label}</button>`).join('')}</div>
        <div class="ag-card-label">Frame</div>
        <div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([v, l]) => `<button type="button" class="ag-chip${st?.aspect === v ? ' is-on' : ''}" data-ag-aspect="${v}">${l}</button>`).join('')}</div>
        <div class="ag-card-label">Visuals</div>
        <div class="ag-chips"><span class="ag-chip is-on">${esc(visualsLabel(st?.visual))}</span><button type="button" class="ag-chip" data-ag-visuals>Change</button></div>
        <div class="ag-card-label">Script angle</div>
        <div class="ag-chips">${ANGLES.map((a) => `<button type="button" class="ag-chip${(st?.angle || 'auto') === a.id ? ' is-on' : ''}" data-ag-angle="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div>
        <div class="ag-card-label">Your own script</div>
        <div class="ag-chips"><button type="button" class="ag-chip" data-ag-own>Paste my script</button></div>
        <div class="ag-card-label">Brand profile</div>
        <div class="ag-chips"><span class="ag-chip is-on">${esc(activeProfile()?.name || 'None')}</span><button type="button" class="ag-chip" data-ag-profiles>${profiles.list.length ? 'Switch or edit' : 'Create one'}</button></div>
        <div class="ag-card-label">Niche</div>
        <div class="ag-chips"><span class="ag-chip is-on">${esc(niche?.name || 'Not set')}</span><button type="button" class="ag-chip" data-ag-niche-change>${niche ? 'Change' : 'Pick a niche'}</button></div>
        <div class="ag-card-label">Narrator voice</div>
        ${voiceListHtml(st)}
      </div>
      <form class="ag-compose" data-ag-form>
        ${selected === 'manager' ? `<button type="button" class="ag-plus" data-ag-plus aria-label="Video settings" aria-expanded="${popOpen}"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}
        <label class="sr-only" for="ag-input">${esc(placeholder)}</label>
        <textarea id="ag-input" rows="1" placeholder="${esc(placeholder)}" ${steer && (selected === 'manager' || st?.script) ? '' : 'disabled'}>${esc(drafts[selected] || '')}</textarea>
        ${selected === 'manager' && len ? `<span class="ag-settings-tag">${esc(len)} · ${esc(st?.aspect || '16:9')}${voiceName(st) ? ' · ' + esc(voiceName(st)) : ''}</span>` : ''}
        <button type="submit" class="ag-send" aria-label="Send"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
      </form>`
  }

  function render() {
    // The signed-in user can arrive after init; each account keeps its own niche.
    if (nicheKey() !== nicheFor) { nicheFor = nicheKey(); niche = loadNiche() }
    if (profilesKey() !== profilesFor) { profilesFor = profilesKey(); profiles = loadProfiles() }
    if (setupKey() !== setupFor) { setupFor = setupKey(); setup = loadSetup() }
    try { window.vidsoNiche = niche?.name || '' } catch (_) {}
    if (edHosted) studio = 'editor'
    const st = state()
    const a = BY_ID[selected]
    const thread = root.querySelector('.ag-thread')
    const nearBottom = !thread || thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120
    const focused = document.activeElement && document.activeElement.id === 'ag-input'
    const voicesScroll = root.querySelector('.ag-voices')?.scrollTop || 0
    const pickerScroll = root.querySelector('.ag-thread')?.scrollTop || 0
    const input = root.querySelector('#ag-input')
    if (input) drafts[selected] = input.value
    if (keptVideo && keptVideo.isConnected) keptVideo.remove()
    const studioScroll = root.querySelector('.ag-studio')?.scrollTop || 0
    const edPane = root.querySelector('.ag-ed')?.scrollTop
    const edTl = root.querySelector('[data-ed-tl]')?.scrollLeft
    if (studio !== 'editor') { try { edAudio?.pause() } catch (_) {} }
    const hostOf = { editor: { scenes: 'agent', captions: 'editor', music: 'manager', voice: 'voice' }[edTab], profile: { style: 'agent', voice: 'voice', captions: 'editor', video: 'manager' }[profileTab], script: 'script', settings: 'manager', progress: progressFrom(st?.crew || {}, { delivered: !!st?.renderUrl }).focus.agent }
    const headAgent = studio ? hostOf[studio] || 'manager' : selected
    keepRun(st)
    { const i = profiles.list.findIndex((p) => p.id === profiles.active); managerTint = i >= 0 ? mgrColor(profiles.list[i], i) : '' }
    const inRun = !!(st?.running || st?.script || st?.renderUrl)
    const headBtn = studio === 'progress' ? '<button type="button" class="ag-pill" data-st-close>Chat</button>'
      : studio ? '<button type="button" class="ag-pill" data-st-close>Chat</button>'
      : inRun && selected === 'manager' ? '<button type="button" class="ag-pill" data-st-progress>Progress</button>'
      : '<button type="button" class="ag-pill" data-ag-new>New video</button>'
    if (edHosted) {
      root.innerHTML = `<div class="ag-app is-ed"><section class="ag-main" aria-label="Editor">
        ${editorStudioHtml(st)}</section></div>`
      bind(st)
      root.querySelectorAll('[data-ed-go]').forEach((b) => b.addEventListener('click', () => { try { window.switchPanel(b.dataset.edGo, document.getElementById('nav-' + b.dataset.edGo)) } catch (_) {} }))
      root.querySelectorAll('[data-ed-open]').forEach((b) => b.addEventListener('click', () => {
        const err = window.fvOpenEditProject?.(b.dataset.edOpen) || ''
        edOpenErr = err
        if (!err) { edPicker = false; edSel = 0; try { edAudio?.pause() } catch (_) {} ; edAudio = null }
        render()
      }))
      root.querySelectorAll('[data-ed-forget]').forEach((b) => b.addEventListener('click', () => { window.fvForgetEditProject?.(b.dataset.edForget); render() }))
      root.querySelector('[data-ed-picker-close]')?.addEventListener('click', () => { edPicker = false; render() })
      root.querySelector('[data-ed-unwait]')?.addEventListener('click', () => { edWhole = ''; edPicker = true; render() })
      if (studio === 'editor') {
        const pane = root.querySelector('.ag-ed')
        if (pane && edPane != null) pane.scrollTop = edPane
        const tl = root.querySelector('[data-ed-tl]')
        if (tl && edTl != null) { tl.scrollLeft = edTl; tl.dataset.placed = '1' }
      }
      return
    }
    root.innerHTML = `<div class="ag-app">
      <aside class="ag-side" aria-label="Agents">${sideHtml(st)}</aside>
      <section class="ag-main" aria-label="${esc(a.name)} chat">
        <div class="ag-mobile-strip">${(profiles.list.length ? profiles.list.slice(0, MAX_CHANNELS).map((p, i) => `<button type="button" class="ag-tile ag-mgr${selected === 'manager' && profiles.active === p.id ? ' is-on' : ''}" data-ag-ch="${esc(p.id)}">${profiles.active === p.id ? ava('manager', videoHere() ? st : null, '', mgrColor(p, i)) : `<span class="ag-ava">${agentSvg('manager', '', mgrColor(p, i))}</span>`}<span>${esc(p.name)}</span></button>`).join('') : `<button type="button" class="ag-tile${selected === 'manager' ? ' is-on' : ''}" data-ag-pick="manager">${ava('manager', st)}<span>Manager</span></button>`)}${profiles.list.length && profiles.list.length < MAX_CHANNELS ? `<button type="button" class="ag-tile ag-mgr-add" data-ag-ch-add><span class="ag-mgr-plus" aria-hidden="true">+</span><span>New channel</span></button>` : ''}</div>
        <header class="ag-head"><span class="ag-head-pill">${agentSvg(headAgent)}${esc(BY_ID[headAgent].name)}${headAgent === 'manager' && activeProfile() ? ` <span class="ag-head-ch">· ${esc(activeProfile().name)}</span>` : ''}</span>
          ${headBtn}</header>
        ${studio ? studioHtml(st) : `<div class="ag-thread" aria-live="polite">${threadHtml(st)}</div>
        <div class="ag-compose-wrap">${composerHtml(st)}</div>`}
      </section></div>`
    // Keep the delivered video element so playback survives re-renders.
    const slot = root.querySelector('[data-ag-keep="video"]')
    if (slot && st?.renderUrl) {
      if (!keptVideo || keptVideoSrc !== st.renderUrl) {
        keptVideo = document.createElement('video')
        keptVideo.controls = true
        keptVideo.playsInline = true
        keptVideo.preload = 'metadata'
        keptVideo.src = st.renderUrl
        keptVideoSrc = st.renderUrl
      }
      slot.replaceWith(keptVideo)
    }
    bind(st)
    const stEl = root.querySelector('.ag-studio')
    if (stEl) stEl.scrollTop = studioScroll
    if (studio === 'editor') {
      const pane = root.querySelector('.ag-ed')
      if (pane && edPane != null) pane.scrollTop = edPane
      const tl = root.querySelector('[data-ed-tl]')
      if (tl && edTl != null) { tl.scrollLeft = edTl; tl.dataset.placed = '1' }
    }
    const vs = root.querySelector('.ag-voices')
    if (vs) vs.scrollTop = voicesScroll
    const t2 = root.querySelector('.ag-thread')
    const picker = t2?.querySelector('.ag-niche')
    if (picker) {
      if (!pickerShown) t2.scrollTop = 0
      else t2.scrollTop = pickerScroll
      pickerShown = true
    } else {
      pickerShown = false
      if (t2 && nearBottom) t2.scrollTop = t2.scrollHeight
    }
    if (scrollToVideo) {
      scrollToVideo = false
      const card = root.querySelector('[data-ag-delivery]')
      if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
    if (focused) {
      const i2 = root.querySelector('#ag-input')
      if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length) }
    }
  }

  async function askClaude(msg, st) {
    if (typeof window.fvAskManager !== 'function') return null
    const media = st?.media
    const context = {
      hasVideo: !!st?.script,
      topic: st?.topic || '',
      title: st?.script?.title || '',
      stage: st?.stage || '',
      running: !!st?.running,
      hasMedia: !!st?.hasMedia,
      delivered: !!st?.renderUrl,
      targetLength: st?.durationLabel || '',
      actualLength: media?.duration ? (media.duration / 60).toFixed(1) + ' min' : '',
      wordCount: st?.script?.words || 0,
      voice: voiceName(st),
      niche: niche?.name || '',
      profile: activeProfile()?.name || '',
      angle: st?.angle && st.angle !== 'auto' ? angleById(st.angle).name : '',
      visuals: visualsLabel(st?.visual),
      youtubeConnected: st?.youtubeConnected ?? null,
      lastVideo: (() => { try { const v = window.fvLastVideoSaved?.(); return v?.url ? (v.title || 'untitled') : '' } catch (_) { return '' } })(),
    }
    const history = mine.filter((m) => m.to === 'manager').slice(-9, -1).map((m) => ({ from: m.from === 'me' ? 'me' : 'manager', text: m.text }))
    let captionStyles = []
    try { captionStyles = (window.fvCaptionLooks?.() || []).map((l) => ({ id: l.id, name: l.name })) } catch (_) {}
    try {
      return await Promise.race([
        window.fvAskManager({ message: msg, context, history, captionStyles }),
        new Promise((r) => setTimeout(() => r(null), 15000)),
      ])
    } catch (_) { return null }
  }

  /** Answer "show me the video": point at the player at the end of the chat, or say where it stands. */
  async function showVideo(st, reply) {
    if (st?.renderUrl) {
      say('manager', 'manager', reply || 'Here it is, right below. Press play to watch it, or download it or send it to YouTube from the same card.')
      scrollToVideo = true
      return
    }
    if (!st?.running) {
      pending = 'Looking in My Files…'
      render()
      let v = null
      try { v = await window.fvLastVideo?.() } catch (_) {}
      pending = ''
      if (v?.url) {
        pastVideo = v
        say('manager', 'manager', `Here's your last finished video${v.title ? ', “' + v.title + '”' : ''}, right below. It's saved in My Files, so it's still here after the page reloads.`)
        scrollToVideo = true
        return
      }
    }
    if (st?.running) {
      say('manager', 'manager', 'It isn\'t finished yet. The team is still working on it; here\'s where each agent is.')
      studio = 'progress'
    } else if (st?.hasMedia) {
      say('manager', 'manager', 'The narration and scenes are ready, but the Editor hasn\'t rendered the video yet.', 'render')
    } else {
      say('manager', 'manager', 'There\'s no finished video yet. Give me a topic and the team will make one.', 'ideas')
    }
  }

  async function runPlan(plan, msg, st) {
    const acts = Array.isArray(plan.actions) ? plan.actions : []
    const nv = acts.find((a) => a.type === 'new_video')
    if (nv) {
      if (st?.script) {
        say('manager', 'manager', (plan.reply ? plan.reply + ' ' : '') + `This replaces the current video, which stays in My Files. Go ahead?`, 'confirm-new', { topic: nv.topic })
        return render()
      }
      return startVideo(nv.topic, st)
    }
    if (acts.some((a) => a.type === 'show_video') && !st?.renderUrl) {
      // Claude only sees the chat; the tab may have lost the video on reload, so answer from what is really here.
      await showVideo(st)
      return render()
    }
    const kind = acts.some((a) => a.type === 'captions' && a.style === 'choose') ? 'captions'
      : acts.some((a) => a.type === 'open_editor') ? 'wizard' : ''
    if (plan.reply) say('manager', 'manager', plan.reply, kind)
    render()
    for (const a of acts) {
      if (a.type === 'captions' && a.style !== 'choose') {
        const err = window.fvAgentsCaptions?.(a.style)
        if (err && st?.hasMedia) say('manager', 'manager', err, 'stuck')
      } else if (a.type === 'titles') {
        const err = await window.fvTitleSteer?.(a.direction || msg)
        if (err) say('manager', 'manager', err, 'stuck')
      } else if (a.type === 'thumbnail') {
        try { await window.fvThumbSteer?.(a.direction || msg) } catch (e) { say('manager', 'manager', e.message || 'Thumbnail could not redo it.', 'stuck') }
      } else if (a.type === 'voice' || a.type === 'length') {
        popOpen = true
        try { window.fvAgentsLoadVoices?.() } catch (_) {}
      } else if (a.type === 'upload') {
        try { await window.fvUploadToYoutube?.() } catch (_) {}
      } else if (a.type === 'rerender') {
        const err = (window.fvResumeRender || window.fvAgentsRerender)?.()
        if (err) say('manager', 'manager', err, 'stuck')
      } else if (a.type === 'edit_scenes') {
        if (window.fvSceneProject?.()) { studio = 'editor'; edTab = 'scenes' } else say('manager', 'manager', 'The scene editor needs a finished video made with AI scenes in this tab. Make one, then I can open it.')
      } else if (a.type === 'show_video') {
        scrollToVideo = true
      } else if (a.type === 'visuals') {
        visualsView = true
      } else if (a.type === 'change_niche') {
        changingNiche = true
      }
      render()
    }
  }

  async function startVideo(msg, st) {
    say('manager', 'manager', `On it. Script is writing a ${st?.durationLabel ? st.durationLabel + ' ' : ''}video on “${msg}”. Title, Thumbnail, Voice, Agent and Editor take it from there, and I'll hand you the finished video right here.`)
    const handoff = mine[mine.length - 1]
    pending = 'Briefing the team…'
    render()
    markVideo()
    const err = await window.fvAgentsRun?.({ topic: msg, channel: profiles.active || '' })
    pending = ''
    if (err) {
      mine = mine.filter((m) => m !== handoff)
      if (err === 'SIGN_IN') say('manager', 'manager', "You're in preview mode, so I can't make videos yet. Sign in and the team will start on “" + msg + '” right away.', 'signin')
      else say('manager', 'manager', err, 'stuck')
      save()
    }
    render()
    return err
  }

  async function send(text) {
    const msg = String(text || '').trim()
    if (!msg) return
    const st = state()
    drafts[selected] = ''
    const box = root.querySelector('#ag-input')
    if (box) box.value = ''
    if (selected === 'manager' && setup) { setupText(msg); return render() }
    if (selected === 'manager') {
      say('manager', 'me', msg)
      const hasVideo = !!(st?.script)
      // Claude reads the message first; the keyword router below is the backup.
      pending = 'Reading your message…'
      render()
      const plan = await askClaude(msg, st)
      pending = ''
      if (plan) return runPlan(plan, msg, st)
      const route = routeManagerMessage(msg, hasVideo)
      if (route.type === 'greeting') {
        say('manager', 'manager', hasVideo ? 'Hi! Want to change something on this video, or start a new one? Tell me what to change, or give me a new topic.' : 'Hi! Give me a topic and the team will make the video. Here are a few ideas to start from.', hasVideo ? '' : 'ideas')
        return render()
      }
      if (route.type === 'watch') {
        await showVideo(st)
        return render()
      }
      if (route.type === 'thanks') {
        say('manager', 'manager', 'Anytime. Tell me when you want changes or the next video.')
        return render()
      }
      if (route.type === 'question') {
        say('manager', 'manager', hasVideo
          ? `I can't answer questions right now, but here's where it stands: ${st?.renderUrl ? 'your video is finished' : st?.running ? 'the agents are still working on it' : 'the script is ready'}. Ask me to change captions, title, thumbnail or voice, or give me a new topic.`
          : "I can't answer questions right now. Give me a topic and the team will start a video.")
        return render()
      }
      if (route.type === 'vague') {
        say('manager', 'manager', 'Happy to. What should the video be about? Give me a subject, like one of these, and the team will take it from there.', 'ideas')
        return render()
      }
      if (route.type === 'captions') {
        say('manager', 'manager', st?.hasMedia
          ? 'Pick a caption style and I\'ll have the Editor re-cut your video with it.'
          : 'Pick a caption style. I\'ll use it on this video when the Editor renders it.', 'captions')
        return render()
      }
      if (route.type === 'title') {
        if (!hasVideo) { say('manager', 'manager', 'Titles come from the script, so give me a topic first.'); return render() }
        say('manager', 'manager', 'Passing that to Title. Its new options will show up here.')
        render()
        const err = await window.fvTitleSteer?.(msg)
        if (err) say('manager', 'manager', err, 'stuck')
        return render()
      }
      if (route.type === 'thumbnail') {
        if (!hasVideo) { say('manager', 'manager', 'Thumbnails are designed from the title, so give me a topic first.'); return render() }
        say('manager', 'manager', 'Passing that to Thumbnail. It\'s designing a new one now.')
        render()
        try { await window.fvThumbSteer?.(msg) } catch (e) { say('manager', 'manager', e.message || 'Thumbnail could not redo it.', 'stuck') }
        return render()
      }
      if (route.type === 'voice') {
        popOpen = true
        try { window.fvAgentsLoadVoices?.() } catch (_) {}
        say('manager', 'manager', 'Pick a narrator in the menu below (Narrator voice). A new voice means recording the narration again, so ask me to make the video again with it.')
        return render()
      }
      if (route.type === 'visuals') {
        visualsView = true
        say('manager', 'manager', `Here are the visual settings: pick one of ${VISUAL_STYLES.length} art styles for the AI-drawn scenes. It applies to the next video.`)
        return render()
      }
      if ((route.type === 'broll' || route.type === 'music') && window.fvSceneProject?.()) {
        studio = 'editor'
        edTab = route.type === 'music' ? 'music' : 'scenes'
        say('manager', 'manager', route.type === 'music' ? 'Opening the editor on Music. Pick a track, then render again.' : 'Opening the scene editor. Pick a scene on the timeline to redraw or animate it, then render again.')
        return render()
      }
      if (route.type === 'music' || route.type === 'broll' || route.type === 'script' || route.type === 'length') {
        const where = {
          music: 'Open the scene editor on your finished video and pick a track under Music, then render again.',
          broll: 'Open the scene editor on your finished video and redraw any scene from a new description, then render again.',
          script: 'Tell me what to change and I\'ll make a new cut, or ask for a new video with a sharper angle.',
          length: 'Length is set before the script is written. Pick a new length in the + menu below and send me the topic again to make a new cut.',
        }[route.type]
        if (route.type === 'length') popOpen = true
        say('manager', 'manager', where)
        return render()
      }
      if (route.type === 'edit') {
        say('manager', 'manager', 'What should change on this video?', 'edit-menu')
        return render()
      }
      if (hasVideo) {
        say('manager', 'manager', `Start a new video on “${msg}”? This one stays in My Files.`, 'confirm-new', { topic: msg })
        return render()
      }
      return startVideo(msg, st)
    }
    if (selected === 'title') {
      say('title', 'me', msg)
      render()
      const err = await window.fvTitleSteer?.(msg)
      if (err) say('title', 'title', err, 'stuck')
      render()
      return
    }
    if (selected === 'thumbnail') {
      say('thumbnail', 'me', msg)
      render()
      try { await window.fvThumbSteer?.(msg) } catch (e) { say('thumbnail', 'thumbnail', e.message || 'Could not redo the thumbnail', 'stuck') }
      render()
    }
  }

  function bind(st) {
    root.querySelectorAll('[data-ag-pick]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.agPick; popOpen = false; render() }))
    root.querySelectorAll('[data-ag-new]').forEach((b) => b.addEventListener('click', () => {
      window.fvAgentsReset?.()
      mine = []
      save()
      selected = 'manager'
      keptVideo = null
      pastVideo = null
      studio = 'script'
      brief = { mode: 'write', topic: '' }
      render()
      root.querySelector('#ag-br-topic')?.focus()
    }))
    root.querySelectorAll('[data-ag-niche]').forEach((b) => b.addEventListener('click', () => { setNiche(nicheById(b.dataset.agNiche)); render() }))
    root.querySelector('[data-ag-niche-own]')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const n = customNiche(root.querySelector('#ag-niche-own')?.value)
      if (n) { setNiche(n); render() }
    })
    root.querySelectorAll('[data-ag-niche-change]').forEach((b) => b.addEventListener('click', () => { changingNiche = true; popOpen = false; selected = 'manager'; render() }))
    root.querySelector('[data-ag-niche-cancel]')?.addEventListener('click', () => { changingNiche = false; render() })
    root.querySelectorAll('[data-ag-angle]').forEach((b) => b.addEventListener('click', () => { window.fvAgentsAngle?.(b.dataset.agAngle); render() }))
    root.querySelectorAll('[data-ag-own]').forEach((b) => b.addEventListener('click', () => { scriptMode = true; popOpen = false; selected = 'manager'; render(); root.querySelector('#ag-own-text')?.focus() }))
    root.querySelector('[data-ag-own-cancel]')?.addEventListener('click', () => { scriptMode = false; render() })
    const ownText = root.querySelector('#ag-own-text')
    const ownTitle = root.querySelector('#ag-own-title')
    ownText?.addEventListener('input', () => {
      scriptDraft.text = ownText.value
      const est = scriptEstimate(ownText.value)
      const head = root.querySelector('.ag-own-head span')
      if (head) head.textContent = est.label || 'Paste the narration.'
      const go = root.querySelector('[data-ag-own-form] button[type=submit]')
      if (go) go.disabled = est.words < 40
    })
    ownTitle?.addEventListener('input', () => { scriptDraft.title = ownTitle.value })
    root.querySelector('[data-ag-own-form]')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const est = scriptEstimate(scriptDraft.text)
      if (est.words < 40) return
      scriptMode = false
      say('manager', 'me', `Use my script${scriptDraft.title ? ': “' + scriptDraft.title + '”' : ''} (${est.label})`)
      say('manager', 'manager', `Got it. I'll skip writing and hand your script to Title, Thumbnail, Voice, Agent and Editor. It runs about ${formatMinutes(est.seconds)}.`)
      const handoff = mine[mine.length - 1]
      render()
      markVideo(); const err = await window.fvAgentsRunScript?.({ text: scriptDraft.text, title: scriptDraft.title })
      if (err) { mine = mine.filter((m) => m !== handoff); save() }
      if (err === 'SIGN_IN') say('manager', 'manager', "You're in preview mode, so I can't make videos yet. Sign in and send the script again.", 'signin')
      else if (err) say('manager', 'manager', err, 'stuck')
      else scriptDraft = { title: '', text: '' }
      render()
    })
    root.querySelectorAll('[data-ag-copy-desc]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(st?.publish?.full || ''); b.textContent = 'Copied' } catch (_) {} }))
    root.querySelectorAll('[data-ag-copy-tags]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText((st?.publish?.tags || []).join(', ')); b.textContent = 'Copied' } catch (_) {} }))
    root.querySelectorAll('[data-ag-publish-again]').forEach((b) => b.addEventListener('click', () => window.fvPublishAgain?.()))

    root.querySelectorAll('[data-ag-files]').forEach((b) => b.addEventListener('click', () => { try { window.switchPanel('files', document.getElementById('nav-files')) } catch (_) { location.href = '/files' } }))
    root.querySelectorAll('[data-ag-retry-render]').forEach((b) => b.addEventListener('click', () => {
      const err = (window.fvResumeRender || window.fvAgentsRerender)?.()
      if (err) say('manager', 'manager', err, 'stuck')
      render()
    }))
    if (studio === 'editor') edBind(st)
    bindSetup(st)
    root.querySelectorAll('[data-ed-open]').forEach((b) => b.addEventListener('click', () => { studio = 'editor'; edTab = 'scenes'; render() }))
    // studio
    root.querySelectorAll('[data-st-close]').forEach((b) => b.addEventListener('click', () => { studio = ''; selected = 'manager'; render() }))
    root.querySelectorAll('[data-st-progress]').forEach((b) => b.addEventListener('click', () => { studio = 'progress'; render() }))
    root.querySelectorAll('[data-st-profile]').forEach((b) => b.addEventListener('click', () => { openProfileSetup(activeProfile(), studio); render() }))
    root.querySelectorAll('[data-br-mode]').forEach((b) => b.addEventListener('click', () => { brief.mode = b.dataset.brMode; render() }))
    root.querySelectorAll('[data-br-idea]').forEach((b) => b.addEventListener('click', () => { brief.topic = b.dataset.brIdea; render() }))
    const topicBox = root.querySelector('#ag-br-topic')
    topicBox?.addEventListener('input', () => {
      brief.topic = topicBox.value
      const nx = root.querySelector('[data-st-next]')
      if (nx) nx.disabled = brief.topic.trim().length < 4
    })
    if (studio === 'script') {
      const ot = root.querySelector('#ag-own-text')
      ot?.addEventListener('input', () => {
        scriptDraft.text = ot.value
        const est = scriptEstimate(ot.value)
        const lab = root.querySelector('[data-own-est]')
        if (lab) lab.textContent = est.label || 'At least 40 words.'
        const nx = root.querySelector('[data-st-next]')
        if (nx) nx.disabled = est.words < 40
      })
      root.querySelector('#ag-own-title')?.addEventListener('input', (e) => { scriptDraft.title = e.target.value })
    }
    root.querySelector('[data-st-next]')?.addEventListener('click', () => { studio = 'settings'; try { window.fvAgentsLoadVoices?.() } catch (_) {} ; render() })
    root.querySelectorAll('[data-st-cap]').forEach((b) => b.addEventListener('click', () => { window.fvSetCaptionLook?.(b.dataset.stCap); render() }))
    root.querySelector('[data-st-back]')?.addEventListener('click', () => { studio = 'script'; render() })
    root.querySelector('[data-st-go]')?.addEventListener('click', () => handToTeam())
    // brand profile setup
    if (studio === 'profile' && pw) {
      const keepFields = () => {
        pw.name = root.querySelector('#ag-pw-name')?.value ?? pw.name
        pw.niche = root.querySelector('#ag-pw-niche')?.value ?? pw.niche
      }
      root.querySelectorAll('[data-pw-tab]').forEach((b) => b.addEventListener('click', () => { keepFields(); profileTab = b.dataset.pwTab; render() }))
      const pwSet = (attr, key) => root.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => { keepFields(); pw[key] = b.getAttribute(attr); render() }))
      pwSet('data-pw-cap', 'captions'); pwSet('data-pw-len', 'durationId'); pwSet('data-pw-aspect', 'aspect'); pwSet('data-pw-angle', 'angle'); pwSet('data-pw-mode', 'visualMode'); pwSet('data-pw-pace', 'scenePace')
      root.querySelectorAll('[data-pw-voice]').forEach((b) => b.addEventListener('click', () => {
        keepFields()
        pw.voiceId = b.dataset.pwVoice
        pw.voiceLabel = (state()?.voices || []).find((v) => v.id === pw.voiceId)?.label || ''
        const box = root.querySelector('.ag-voices')
        const keep = box?.scrollTop || 0
        const q = root.querySelector('[data-voice-search]')?.value || ''
        render()
        const s2 = root.querySelector('[data-voice-search]')
        if (s2) { s2.value = q; filterVoices(q) }
        const b2 = root.querySelector('.ag-voices')
        if (b2) b2.scrollTop = keep
      }))
      root.querySelector('[data-voice-search]')?.addEventListener('input', (e) => filterVoices(e.target.value))
      root.querySelector('[data-pw-cancel]')?.addEventListener('click', () => { studio = pwFrom && pwFrom !== 'profile' ? pwFrom : ''; if (!studio) profileView = profiles.list.length ? 'list' : ''; pw = null; render() })
      root.querySelector('[data-pw-save]')?.addEventListener('click', () => {
        keepFields()
        const p = normalizeProfile(pw)
        const i = profiles.list.findIndex((x) => x.id === p.id)
        if (i >= 0) profiles.list[i] = p; else if (canAddChannel()) profiles.list.push(p); else { capNote(); return null }
        applyProfile(p)
        pw = null
        studio = pwFrom && pwFrom !== 'profile' ? pwFrom : ''
        say('manager', 'manager', `Saved the ${p.name} profile and switched to it. New videos will follow it.`)
        render()
      })
    }
    // visuals
    root.querySelectorAll('[data-ag-visuals]').forEach((b) => b.addEventListener('click', () => { visualsReturn = studio; studio = ''; visualsView = true; profileView = ''; popOpen = false; selected = 'manager'; render() }))
    root.querySelectorAll('[data-vs-style]').forEach((b) => b.addEventListener('click', () => {
      const grid = root.querySelector('[data-vs-grid]')
      const keep = { scroll: grid?.scrollTop || 0, q: root.querySelector('[data-vs-search]')?.value || '', g: root.querySelector('[data-vs-group].is-on')?.dataset.vsGroup || '' }
      if (studio === 'profile' && pw) {
        pw.name = root.querySelector('#ag-pw-name')?.value ?? pw.name
        pw.niche = root.querySelector('#ag-pw-niche')?.value ?? pw.niche
        pw.visualStyle = b.dataset.vsStyle
      } else window.fvSetVisual?.({ style: b.dataset.vsStyle })
      render()
      filterStyles(keep.q, keep.g)
      const g2 = root.querySelector('[data-vs-grid]')
      if (g2) g2.scrollTop = keep.scroll
    }))
    root.querySelector('[data-vs-search]')?.addEventListener('input', (e) => filterStyles(e.target.value, root.querySelector('[data-vs-group].is-on')?.dataset.vsGroup || ''))
    root.querySelectorAll('[data-vs-group]').forEach((b) => b.addEventListener('click', () => filterStyles(root.querySelector('[data-vs-search]')?.value || '', b.dataset.vsGroup)))
    root.querySelectorAll('[data-vs-mode]').forEach((b) => b.addEventListener('click', () => { window.fvSetVisual?.({ mode: b.dataset.vsMode }); render() }))
    root.querySelectorAll('[data-vs-pace]').forEach((b) => b.addEventListener('click', () => { window.fvSetVisual?.({ pace: b.dataset.vsPace }); render() }))
    root.querySelector('[data-vs-char-clear]')?.addEventListener('click', () => { window.fvSetVisual?.({ characterUrl: '', characterDesc: '' }); render() })
    root.querySelector('[data-vs-char-form]')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const desc = root.querySelector('#ag-char-desc')?.value || ''
      charBusy = true; charError = ''; render()
      try { await window.fvCreateCharacter?.(desc) } catch (err) { charError = /live app|not found|405|404/i.test(err?.message || '') ? 'Characters are drawn on the live app, or sign in locally.' : (err?.message || 'Could not draw the character') }
      charBusy = false; render()
    })
    root.querySelector('[data-vs-done]')?.addEventListener('click', () => {
      visualsView = false
      if (visualsReturn) { studio = visualsReturn; visualsReturn = ''; return render() }
      const v = state()?.visual
      say('manager', 'manager', `Next video: ${visualsLabel(v)}. Each scene is drawn to match the narration.`)
      render()
    })
    root.querySelector('[data-pf-vis-current]')?.addEventListener('click', () => {
      if (!profileDraft) return
      const v = state()?.visual || {}
      profileDraft.name = root.querySelector('#ag-pf-name')?.value || profileDraft.name
      Object.assign(profileDraft, { visualStyle: v.style || DEFAULT_STYLE, visualMode: v.mode || 'cheapest', scenePace: v.pace || 'normal', characterUrl: v.characterUrl || '', characterDesc: v.characterDesc || '' })
      render()
    })
    // brand profiles
    root.querySelectorAll('[data-ag-ch]').forEach((b) => b.addEventListener('click', () => {
      const p = profiles.list.find((x) => x.id === b.dataset.agCh)
      if (!p) return
      // Clicking the channel that is already open shows its colour choices.
      if (profiles.active === p.id && selected === 'manager' && !studio) colorFor = colorFor === p.id ? '' : p.id
      else colorFor = ''
      if (profiles.active !== p.id) applyProfile(p)
      studio = ''; profileView = ''; visualsView = false; selected = 'manager'
      render()
    }))
    root.querySelectorAll('[data-ag-color]').forEach((b) => b.addEventListener('click', () => {
      const p = profiles.list.find((x) => x.id === colorFor)
      if (!p) return
      p.managerColor = b.dataset.agColor
      saveProfiles()
      colorFor = ''
      render()
    }))
    root.querySelectorAll('[data-ag-ch-add]').forEach((b) => b.addEventListener('click', () => startSetup({ force: true, from: 'agents' })))
    root.querySelectorAll('[data-ag-profiles]').forEach((b) => b.addEventListener('click', () => { popOpen = false; profileDraft = null; if (window.brandStudio) { try { window.switchPanel('brand', document.getElementById('nav-brand')) } catch (_) {} ; return } studio = ''; if (profiles.list.length) profileView = 'list'; else openProfileSetup(null, ''); render() }))
    root.querySelector('[data-ag-profiles-close]')?.addEventListener('click', () => { profileView = ''; render() })
    root.querySelector('[data-pf-new]')?.addEventListener('click', () => { openProfileSetup(null, ''); render() })
    root.querySelector('[data-pf-new-old]')?.addEventListener('click', () => {
      const cv = st?.visual || {}
      profileDraft = normalizeProfile({ name: niche?.name ? niche.name + ' channel' : 'My channel', niche: niche?.id === 'custom' ? niche.name : (niche?.id || ''), voiceId: st?.voiceId || '', durationId: st?.durationId || 'long_600', aspect: st?.aspect || '16:9', angle: st?.angle || 'auto', visualStyle: cv.style || DEFAULT_STYLE, visualMode: cv.mode || 'cheapest', scenePace: cv.pace || 'normal', characterUrl: cv.characterUrl || '', characterDesc: cv.characterDesc || '' })
      profileView = 'edit'; render()
    })
    root.querySelectorAll('[data-pf-edit]').forEach((b) => b.addEventListener('click', () => { openProfileSetup(profiles.list.find((p) => p.id === b.dataset.pfEdit), ''); render() }))
    root.querySelectorAll('[data-pf-use]').forEach((b) => b.addEventListener('click', () => {
      const p = profiles.list.find((x) => x.id === b.dataset.pfUse)
      applyProfile(p); profileView = ''
      say('manager', 'manager', `Using the ${p.name} profile. New videos will follow it.`)
      render()
    }))
    root.querySelectorAll('[data-pf-del]').forEach((b) => b.addEventListener('click', () => {
      profiles.list = profiles.list.filter((p) => p.id !== b.dataset.pfDel)
      if (profiles.active === b.dataset.pfDel) profiles.active = ''
      saveProfiles(); render()
    }))
    const pick = (attr, key) => root.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
      if (!profileDraft) return
      profileDraft.name = root.querySelector('#ag-pf-name')?.value || profileDraft.name
      profileDraft.voiceId = root.querySelector('#ag-pf-voice')?.value ?? profileDraft.voiceId
      profileDraft[key] = b.getAttribute(attr)
      render()
    }))
    pick('data-pf-niche', 'niche'); pick('data-pf-cap', 'captions'); pick('data-pf-len', 'durationId'); pick('data-pf-aspect', 'aspect'); pick('data-pf-angle', 'angle')
    root.querySelector('[data-ag-profile-form]')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const sel = root.querySelector('#ag-pf-voice')
      const p = normalizeProfile({ ...profileDraft, name: root.querySelector('#ag-pf-name')?.value, voiceId: sel ? sel.value : profileDraft.voiceId, voiceLabel: sel?.selectedOptions?.[0]?.textContent || profileDraft.voiceLabel })
      const i = profiles.list.findIndex((x) => x.id === p.id)
      if (i >= 0) profiles.list[i] = p; else if (canAddChannel()) profiles.list.push(p); else { capNote(); return null }
      applyProfile(p)
      profileView = ''; profileDraft = null
      say('manager', 'manager', `Saved the ${p.name} profile and switched to it. New videos will follow it.`)
      render()
    })
    root.querySelectorAll('[data-ag-cap]').forEach((b) => b.addEventListener('click', () => {
      const look = b.textContent.trim()
      say('manager', 'me', 'Captions: ' + look)
      const err = window.fvAgentsCaptions?.(b.dataset.agCap)
      if (err && !(st?.hasMedia)) say('manager', 'manager', `${look} captions are set. The Editor will use them when it renders.`)
      else if (err) say('manager', 'manager', err, 'stuck')
      else say('manager', 'manager', `${look} captions it is. The Editor is re-cutting your video now.`)
      render()
    }))
    root.querySelectorAll('[data-ag-say]').forEach((b) => b.addEventListener('click', () => send(b.dataset.agSay)))
    root.querySelectorAll('[data-ag-newtopic]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.agNewtopic; say('manager', 'me', 'Yes, start a new video'); startVideo(t, state()) }))
    root.querySelectorAll('[data-ag-keep]').forEach((b) => b.addEventListener('click', () => { say('manager', 'me', 'Keep this one'); say('manager', 'manager', 'Kept. Tell me what to change on it: captions, title, thumbnail, voice, music or B-roll.'); render() }))
    root.querySelectorAll('[data-ag-idea]').forEach((b) => b.addEventListener('click', () => send(b.dataset.agIdea)))
    root.querySelectorAll('[data-ag-title]').forEach((b) => b.addEventListener('click', () => {
      const o = (st?.script?.options || [])[Number(b.dataset.agTitle)]
      if (o) window.fvSetTitle?.(o.title)
    }))
    root.querySelectorAll('[data-ag-title-o]').forEach((b) => b.addEventListener('click', () => window.fvSetTitle?.(b.dataset.agTitleO)))
    root.querySelectorAll('[data-ag-thumb]').forEach((b) => b.addEventListener('click', () => window.fvThumbAgentAgain?.()))
    root.querySelectorAll('[data-ag-yt]').forEach((b) => b.addEventListener('click', () => window.fvUploadToYoutube?.()))
    root.querySelectorAll('[data-ag-copy]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(st?.script?.title || ''); b.textContent = 'Copied' } catch (_) {}
    }))
    root.querySelectorAll('[data-ag-wizard]').forEach((b) => b.addEventListener('click', () => openWizard?.()))
    root.querySelector('[data-ag-plus]')?.addEventListener('click', () => {
      popOpen = !popOpen
      if (popOpen) { try { window.fvAgentsLoadVoices?.() } catch (_) {} }
      render()
    })
    root.querySelectorAll('[data-ag-voice]').forEach((b) => b.addEventListener('click', () => { window.fvAgentsVoice?.(b.dataset.agVoice) }))
    root.querySelectorAll('[data-ag-play]').forEach((b) => b.addEventListener('click', () => {
      const src = b.dataset.agPlay
      if (previewAudio && previewSrc === src && !previewAudio.paused) { previewAudio.pause(); return }
      try { previewAudio?.pause() } catch (_) {}
      previewAudio = new Audio(src)
      previewSrc = src
      previewAudio.play().catch(() => {})
    }))
    root.querySelectorAll('[data-ag-len]').forEach((b) => b.addEventListener('click', () => { try { window.fvSetDuration?.(b.dataset.agLen) } catch (_) {} ; render() }))
    root.querySelectorAll('[data-ag-aspect]').forEach((b) => b.addEventListener('click', () => { try { window.fvSetAspect?.(b.dataset.agAspect) } catch (_) {} ; render() }))
    const form = root.querySelector('[data-ag-form]')
    const input = root.querySelector('#ag-input')
    const grow = () => { if (!input) return; input.style.height = '24px'; input.style.height = Math.min(160, Math.max(24, input.scrollHeight - 16)) + 'px' }
    grow()
    input?.addEventListener('input', () => { drafts[selected] = input.value; grow() })
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); form?.requestSubmit() }
    })
    form?.addEventListener('submit', (e) => { e.preventDefault(); popOpen = false; send(input?.value) })
  }

  let queued = 0
  const onChange = () => {
    if (queued) return
    queued = setTimeout(() => {
      queued = 0
      if (!root.isConnected || !root.closest('.panel')?.classList.contains('active')) return
      render()
    }, 40)
  }
  window.addEventListener('vidso:agents', onChange)
  window.addEventListener('vidso:titles', onChange)

  render()
  /**
   * Open a screen from outside the chat (the Studio page). opts.tab picks the editor or
   * profile tab; opts.fresh starts a new video on the script step.
   */
  function openView(view, opts = {}) {
    if (view === 'profile') {
      openProfileSetup(activeProfile(), '', opts.tab)
      if (!window.brandStudio && opts.tab) profileTab = opts.tab
      return render()
    }
    if (view === 'script' && opts.fresh) {
      window.fvAgentsReset?.()
      mine = []
      save()
      keptVideo = null
      pastVideo = null
      brief = { mode: 'write', topic: '' }
    }
    selected = 'manager'
    visualsView = false
    profileView = ''
    studio = ['script', 'settings', 'progress', 'editor'].includes(view) ? view : ''
    if (view === 'editor' && opts.tab) edTab = opts.tab
    render()
  }
  const profilesApi = {
    list: () => { if (profilesKey() !== profilesFor) { profilesFor = profilesKey(); profiles = loadProfiles() } return profiles.list.map((p) => ({ ...p })) },
    activeId: () => profiles.active || '',
    niche: () => (niche ? { id: niche.id, name: niche.name } : null),
    draft: () => {
      const st = state()
      const cv = st?.visual || {}
      return normalizeProfile({ name: niche?.name ? niche.name + ' channel' : 'My channel', niche: niche?.id === 'custom' ? niche.name : (niche?.id || ''), voiceId: st?.voiceId || '', captions: st?.captionLook || '', durationId: st?.durationId || 'long_600', aspect: st?.aspect || '16:9', angle: st?.angle || 'auto', visualStyle: cv.style || DEFAULT_STYLE, visualMode: cv.mode || 'cheapest', scenePace: cv.pace || 'normal', characterUrl: cv.characterUrl || '', characterDesc: cv.characterDesc || '' })
    },
    save: (draft) => {
      const p = normalizeProfile(draft)
      const i = profiles.list.findIndex((x) => x.id === p.id)
      if (i >= 0) profiles.list[i] = p; else if (canAddChannel()) profiles.list.push(p); else { capNote(); return null }
      applyProfile(p)
      say('manager', 'manager', `Saved the ${p.name} profile and switched to it. New videos will follow it.`)
      render()
      return p
    },
    use: (id) => {
      const p = profiles.list.find((x) => x.id === id)
      if (!p) return null
      applyProfile(p)
      say('manager', 'manager', `Using the ${p.name} profile. New videos will follow it.`)
      render()
      return p
    },
    remove: (id) => {
      profiles.list = profiles.list.filter((p) => p.id !== id)
      if (profiles.active === id) profiles.active = ''
      saveProfiles()
      render()
    },
  }
  /** The Editor page: draw the scene editor into `el` until hostChat() hands it back. */
  function hostEditor(el, tab) {
    if (!el) return
    if (!edHosted) { edHosted = true; root = el }
    try { window.fvSaveEditProjectNow?.() } catch (_) {}
    if (tab) edTab = tab
    studio = 'editor'
    render()
  }
  function hostChat() {
    if (!edHosted) return
    try { edAudio?.pause() } catch (_) {}
    edHosted = false
    root.innerHTML = ''
    root = chatRoot
    studio = ''
    render()
  }
  return { hostEditor, hostChat, canAddChannel, render, select: (id) => { if (BY_ID[id]) { studio = ''; selected = id; render() } }, open: openView, profiles: profilesApi, startSetup, setupDone, setupActive: () => !!setup, channelCreated, channelSkipped }
}
