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
import { channelLimit, planDisplayName, minTierForLength, ENTITLEMENTS, TIERS, normalizeTier } from './entitlements.js'
import { resolveUserPlan, addonCheckoutUrl } from './whop-map.js'
import { withCompedPlan } from './comped.js'
import { HOSTS, progressFrom, videoPlan, makeTimeLabel, durationSeconds, sceneIndexAt, captionAt } from './studio-flow.js'
import { playlistOffsetAt } from './faceless-media-fallback.js'
import { audioPlayerHtml } from './audio-player.js'
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
/** Most channels (brand profiles) any account can run; each plan allows fewer (lib/entitlements.js). */
export const MAX_CHANNELS = 25
const VIDEO_CH_KEY = 'vidso_video_channel'
const RUN_KEY = 'vidso_agents_run' // the team's updates for the last video, kept through a reload
const STEERABLE = new Set(['manager', 'title', 'thumbnail'])
const LOOK_NAMES = { bold: 'Bold yellow', clean: 'Clean white', outline: 'Heavy outline', doc: 'Documentary', comic: 'Comic pop', mono: 'Minimal mono' }
const LENGTHS = [['long_180', '3 min'], ['long_300', '5 min'], ['long_600', '10 min'], ['long_900', '15 min'], ['long_1200', '20 min'], ['long_1800', '30 min']]
/** One line shown when a new video can't start yet: starting it would stop the one being made. */
export const BUSY_NOTE = 'Your current video is still being made. Start the next one when it finishes.'
/** True while a video (or a new cut of one) is still being made. */
export function videoBusy(st) { return !!(st && (st.running || st.busyScript)) }
/**
 * Every length, with the ones above the plan's cap (seconds; Infinity or 0 = no cap) locked
 * and the plan that unlocks them.
 */
export function lengthOptions(capSeconds) {
  const cap = Number(capSeconds)
  const capped = Number.isFinite(cap) && cap > 0
  return LENGTHS.map(([id, label]) => {
    const seconds = durationSeconds(id)
    const locked = capped && seconds > cap
    return { id, label, seconds, locked, unlock: locked ? planDisplayName(minTierForLength(seconds)) : '' }
  })
}
/** The length a run really uses: the picked one, or the longest the plan allows (like the dashboard does). */
export function effectiveLength(id, capSeconds) {
  const opts = lengthOptions(capSeconds)
  const open = opts.filter((o) => !o.locked)
  const hit = opts.find((o) => o.id === id)
  if (hit && !hit.locked) return hit
  const secs = /_(\d+)$/.test(String(id || '')) ? durationSeconds(id) : 0
  const cap = Number(capSeconds)
  if (secs && !hit && !(Number.isFinite(cap) && cap > 0 && secs > cap)) return { id, label: formatMinutes(secs), seconds: secs, locked: false, unlock: '' }
  if (!secs) return opts.find((o) => o.id === 'long_600' && !o.locked) || open[open.length - 1] || opts[0]
  return open[open.length - 1] || opts[0]
}
/**
 * What to say when the account has no room for another channel. `tier` is the plan, `limit`
 * the channels it runs now (add-ons included), `addonUrl` the extra-channel checkout ('' = none yet).
 */
export function channelCapInfo(tier, limit, addonUrl = '') {
  const key = normalizeTier(tier) || 'plus'
  const n = Math.max(1, Number(limit) || 1)
  const plan = planDisplayName(key)
  const next = TIERS.slice(TIERS.indexOf(key) + 1).find((t) => (ENTITLEMENTS[t]?.channels || 0) > n) || ''
  const runs = `Your ${plan} plan runs ${n} channel${n === 1 ? '' : 's'}.`
  const del = 'delete one under Channels'
  const add = addonUrl ? 'add an extra channel' : ''
  const message = next
    ? `${runs} ${planDisplayName(next)} runs ${ENTITLEMENTS[next].channels}. Upgrade${add ? `, ${add},` : ''} or ${del} to start another.`
    : `${runs} ${add ? `Add an extra channel or ${del}` : `To start another, ${del}`}${add ? ' to start another' : ''}.`
  return { tier: key, limit: n, plan, upgrade: next, upgradeName: next ? planDisplayName(next) : '', addonUrl: addonUrl || '', message }
}
const IDEAS = [
  'What did ancient humans do for fun?',
  'The rise and fall of Blockbuster',
  'Why almost nobody lives in northern Maine',
  'The psychology of people who never ask for help',
]
// Extra starters for the composer's idea chips (shuffle walks through them).
const MORE_IDEAS = [
  'The city the jungle swallowed',
  'One day that changed history',
  'An unsolved case, minute by minute',
  'Why your brain lies to you',
  'What the Voyager probes heard',
  'How Japan took over the car world',
  'The empire that vanished in a decade',
  'Why some countries drive on the left',
]
/** "Explainer" for questions and why/how topics, "Documentary" for the rest. */
export function ideaFormat(idea) {
  const t = String(idea || '').trim()
  return /\?$/.test(t) || /^(why|how|what|when|who|can|is|are|do|does)\b/i.test(t) ? 'Explainer' : 'Documentary'
}
/** Six ideas starting at `seed`, niche ideas first, no repeats. */
export function ideaPage(own, seed = 0, size = 6) {
  const pool = [...new Set([...(own || []), ...IDEAS, ...MORE_IDEAS])]
  if (pool.length <= size) return pool
  const start = ((seed * size) % pool.length + pool.length) % pool.length
  return Array.from({ length: size }, (_, i) => pool[(start + i) % pool.length])
}
const HERO_PROMPTS = [
  'A cinematic documentary about the city the jungle swallowed',
  'An explainer on why your brain lies to you',
  'The rise and fall of Blockbuster, told in 10 minutes',
  'What the Voyager probes heard on their way out',
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
  if (/\?\s*$/.test(t) && /\b(you|this|it|my video|the video|vidso|tubeops|agents?)\b/.test(t) && !/\b(did|were|was) (ancient|medieval|people|humans)\b/.test(t)) return { type: 'question' }
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
/* Agents page: no card. The channel list is a full-height sidebar under the top bar. */
html:has(#panel-agents.active) .content{padding:0!important;overflow:hidden}
#panel-agents .ag-app:not(.is-ed){height:calc(100dvh - var(--app-chrome-h,44px));min-height:0;border:0;border-radius:0;background:transparent}
#panel-agents .ag-app:not(.is-ed) .ag-side{background:#0f0f10;padding:18px 14px 14px}
#panel-agents .ag-app:not(.is-ed) .ag-main{background:transparent}
/* Compact sidebar, sized like Claude's: 14px single-line rows, small icons. */
@media (min-width:861px){
  #panel-agents .ag-app:not(.is-ed){grid-template-columns:248px minmax(0,1fr);transition:grid-template-columns .32s cubic-bezier(.32,.72,0,1)}
  #panel-agents .ag-app.is-side-min:not(.is-ed){grid-template-columns:56px minmax(0,1fr)}
}
.ag-chat-label{font-size:11.5px;color:var(--ag-mute);padding:12px 10px 4px}
.ag-chat-empty{font-size:12.5px;color:var(--ag-mute);padding:6px 10px}
.ag-chat-row{position:relative}
.ag-chat-busy{position:absolute;right:10px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:#ff2d48;box-shadow:0 0 0 3px rgba(255,45,72,.2);animation:agPulse 1.2s ease-in-out infinite}
.ag-chat-done{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;color:var(--ag-mute);font-size:13px;padding:8px 0}
#panel-agents .ag-mobile-strip{display:none!important}
.ag-side-toggle{width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--ag-mute);cursor:pointer;flex:none;margin-right:2px}
.ag-side-toggle:hover{background:rgba(255,255,255,.07);color:var(--ag-ink)}
.ag-side-head h2{flex:1}
@media (max-width:860px){.ag-side-toggle{display:none}}
/* Phones: a Chats button in the header opens the chats list as a drawer. */
.ag-chats-btn,.ag-drawer-x,.ag-drawer-bg{display:none}
@media (max-width:860px){
  .ag-chats-btn{display:inline-flex;align-items:center;gap:6px;flex:none;margin-right:8px;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--ag-line);background:transparent;color:var(--ag-ink);font:500 13px/1 Inter,system-ui,sans-serif;cursor:pointer}
  .ag-chats-btn:hover,.ag-chats-btn[aria-expanded="true"]{background:rgba(255,255,255,.07)}
  .ag-chats-btn:focus-visible,.ag-drawer-x:focus-visible{outline:2px solid #fff;outline-offset:2px}
  .ag-app .ag-main.is-hero .ag-head{display:flex;min-height:44px}
  .ag-app .ag-main.is-hero .ag-head .ag-head-pill,.ag-app .ag-main.is-hero .ag-head .ag-pill{display:none}
  #panel-agents .ag-app.is-drawer .ag-side,.ag-app.is-drawer .ag-side{display:flex;position:fixed;top:var(--app-chrome-h,44px);left:0;bottom:0;z-index:1001;width:min(300px,84vw);box-sizing:border-box;padding:14px 10px 12px;background:#0f0f10;border-right:1px solid var(--ag-line);box-shadow:20px 0 50px rgba(0,0,0,.5)}
  .ag-app.is-drawer .ag-drawer-bg{display:block;position:fixed;inset:var(--app-chrome-h,44px) 0 0 0;z-index:1000;background:rgba(0,0,0,.55)}
  .ag-app.is-drawer .ag-drawer-x{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--ag-mute);cursor:pointer;flex:none}
  .ag-app.is-drawer .ag-drawer-x:hover{background:rgba(255,255,255,.07);color:var(--ag-ink)}
}
#panel-agents .ag-app:not(.is-ed) .ag-side{padding:12px 8px 10px}
#panel-agents .ag-app:not(.is-ed) .ag-side-head{padding:2px 6px 10px 10px}
#panel-agents .ag-app:not(.is-ed) .ag-side-head h2{font:500 13px/1.2 Inter,system-ui,sans-serif;letter-spacing:0;color:var(--ag-ink)}
#panel-agents .ag-app:not(.is-ed) .ag-side-head .ag-icon-btn{width:26px;height:26px;border:0;background:transparent;color:var(--ag-mute);border-radius:7px}
#panel-agents .ag-app:not(.is-ed) .ag-side-head .ag-icon-btn:hover{background:rgba(255,255,255,.07);color:var(--ag-ink)}
#panel-agents .ag-app:not(.is-ed) .ag-side-head .ag-icon-btn svg{width:15px;height:15px}
#panel-agents .ag-app:not(.is-ed) .ag-mgr-list{gap:1px}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row{gap:8px;padding:5px 10px;border-radius:8px;min-height:30px;box-sizing:border-box}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row:hover{background:rgba(255,255,255,.05)}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row.is-on{background:rgba(255,255,255,.09)}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row .ag-blob{width:18px;height:18px}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row-txt{gap:0}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row-txt b{font:400 13px/1.3 Inter,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-row-txt span{display:none}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-mgr-plus{width:18px;height:18px;font-size:13px;border-width:1px}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-mgr-add .ag-row-txt b{color:var(--ag-mute)}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-mgr-add:hover .ag-row-txt b{color:var(--ag-ink)}
#panel-agents .ag-app:not(.is-ed) .ag-me{gap:8px;padding:10px 10px 2px;font-size:12.5px}
#panel-agents .ag-app:not(.is-ed) .ag-me i{width:24px;height:24px;font-size:10px}
/* Compact chat, same scale as the sidebar and start composer. */
#panel-agents .ag-app:not(.is-ed) .ag-head{min-height:52px;padding:10px 16px}
#panel-agents .ag-app:not(.is-ed) .ag-head-pill{gap:7px;padding:4px 12px 4px 6px;font-size:13px;font-weight:500;background:transparent}
#panel-agents .ag-app:not(.is-ed) .ag-head-pill .ag-blob{width:18px;height:18px}
#panel-agents .ag-app:not(.is-ed) .ag-pill{height:30px;padding:0 13px;font-size:13px;font-weight:500;border-radius:8px;background:#ededec}
#panel-agents .ag-app:not(.is-ed) .ag-thread{padding:4px max(28px,calc((100% - 1080px) / 2 + 28px)) 18px;gap:8px;width:100%;margin:0;box-sizing:border-box;scrollbar-width:none}
#panel-agents .ag-app:not(.is-ed) .ag-thread::-webkit-scrollbar{display:none}
#panel-agents .ag-app:not(.is-ed) .ag-day{font-size:12px}
#panel-agents .ag-app:not(.is-ed) .ag-who{font-size:12px;gap:7px}
#panel-agents .ag-app:not(.is-ed) .ag-who .ag-blob{width:18px;height:18px}
#panel-agents .ag-app:not(.is-ed) .ag-bubble{padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.5}
#panel-agents .ag-app:not(.is-ed) .ag-msg.from-me .ag-bubble{background:#f2f2f0;color:#141414}
#panel-agents .ag-app:not(.is-ed) .ag-chip{font-size:12.5px;padding:6px 11px}
#panel-agents .ag-app:not(.is-ed) .ag-building{gap:9px;font-size:13.5px}
#panel-agents .ag-app:not(.is-ed) .ag-building .ag-blob{width:22px;height:22px}
#panel-agents .ag-app:not(.is-ed) .ag-compose-wrap{width:min(1080px,100%);margin:0 auto;box-sizing:border-box;padding:8px 28px 18px}
#panel-agents .ag-app:not(.is-ed) .ag-compose{border-radius:16px;padding:6px;background:#1e1e1f}
#panel-agents .ag-app:not(.is-ed) .ag-compose textarea#ag-input{font-size:14px}
#panel-agents .ag-app:not(.is-ed) .ag-send{width:32px;height:32px}
#panel-agents .ag-app:not(.is-ed) .ag-plus{width:32px;height:32px}
#panel-agents .ag-app:not(.is-ed) .ag-settings-tag{font-size:12px}
/* Phones: the channel strip is a row of small chips, not big tiles. */
@media (max-width:860px){
  #panel-agents .ag-app:not(.is-ed) .ag-mobile-strip{gap:6px;padding:10px 12px 2px;scroll-snap-type:none}
  #panel-agents .ag-app:not(.is-ed) .ag-mobile-strip .ag-tile{flex:0 0 auto;flex-direction:row;gap:6px;padding:6px 11px 6px 8px;border-radius:999px;border:1px solid var(--ag-line);font-size:12.5px;white-space:nowrap}
  #panel-agents .ag-app:not(.is-ed) .ag-mobile-strip .ag-tile.is-on{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.16)}
  #panel-agents .ag-app:not(.is-ed) .ag-mobile-strip .ag-tile .ag-blob{width:16px;height:16px}
  #panel-agents .ag-app:not(.is-ed) .ag-mobile-strip .ag-mgr-plus{width:16px;height:16px;font-size:12px;border-width:1px}
  #panel-agents .ag-app:not(.is-ed) .ag-mobile-strip .ag-dot{width:6px;height:6px;border-width:1px}
}
#panel-agents .ag-app:not(.is-ed) .ag-side .ag-dot{width:7px;height:7px;right:-2px;bottom:-1px;border-width:1.5px;border-color:#0f0f10}
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
.ag-row-txt b{font-weight:500;font-size:.95rem}
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
.ag-head-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:999px;background:#232324;border:1px solid var(--ag-line);font-weight:500;font-size:.95rem}
.ag-head-pill .ag-blob{width:26px;height:26px}
.ag-pill{position:absolute;right:16px;display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:999px;border:0;background:#fff;color:#161616;font:inherit;font-size:.9rem;font-weight:500;cursor:pointer}
.ag-pill:hover{background:#e9e9e7}
.ag-thread{flex:1;overflow:auto;padding:4px 24px 20px;display:flex;flex-direction:column;gap:10px;min-height:0}
.ag-day{align-self:center;font-size:.82rem;color:var(--ag-mute);margin:6px 0 4px}
.ag-msg{display:flex;flex-direction:column;gap:6px;max-width:min(78%,720px);align-self:flex-start;min-width:0}
.ag-msg.from-me{align-self:flex-end;align-items:flex-end}
.ag-who{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--ag-mute);margin-top:6px}
.ag-who .ag-blob{width:22px;height:22px}
.ag-who b{color:var(--ag-ink);font-weight:500}
.ag-bubble{padding:12px 16px;border-radius:20px;background:var(--ag-bubble);font-size:.97rem;line-height:1.5;overflow-wrap:anywhere}
.from-me .ag-bubble{background:#ececea;color:#161616}
.ag-bubble.is-check{display:flex;gap:8px}
.ag-bubble.is-check::before{content:"✓";font-weight:600}
.ag-bubble.is-stuck{color:#f5c26b}
.ag-bubble.is-error{color:#f3b4b8}
.ag-bubble b{font-weight:550}
.ag-card{padding:14px;border-radius:20px;background:var(--ag-bubble);display:flex;flex-direction:column;gap:10px;min-width:0}
.ag-card-label{font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ag-mute)}
.ag-card video{display:block;width:100%;border-radius:14px;background:#000;aspect-ratio:16/9}
.ag-card img{display:block;width:100%;border-radius:14px;aspect-ratio:16/9;object-fit:cover;background:#111}
.ag-card-title{font-size:1.05rem;font-weight:550;overflow-wrap:anywhere}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px}
.ag-chip{font:inherit;font-size:.82rem;text-align:left;padding:7px 12px;border-radius:999px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);cursor:pointer;max-width:100%;overflow-wrap:anywhere;text-decoration:none;display:inline-flex;align-items:center}
.ag-chip:hover{background:#2c2c2d}
.ag-chip.is-on{background:#fff;color:#161616;border-color:#fff}
.ag-chip.is-primary{background:#fff;color:#161616;border-color:#fff;font-weight:500}
.ag-chip[disabled]{opacity:.5;cursor:default}
.ag-chip.is-locked{opacity:.6;border-style:dashed}
.ag-chip.is-locked:hover{opacity:.85}
.ag-lock{margin-left:6px;font-size:.7rem;font-weight:500;color:#ff9aa7}
.ag-hero-menu>button.is-locked{opacity:.6}
.ag-hero-menu>button.is-locked span{color:#ff9aa7}
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
.ag-team-m[data-state=working] .ag-team-name{color:var(--ag-ink);font-weight:500}
.ag-team-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ag-team-typing{position:absolute;top:-6px;right:-10px;display:flex;gap:2px;padding:4px 5px;border-radius:9px;background:#fff}
.ag-team-typing b{width:4px;height:4px;border-radius:50%;background:#141414;animation:agType 1.1s infinite}
.ag-team-typing b:nth-child(2){animation-delay:.15s}.ag-team-typing b:nth-child(3){animation-delay:.3s}
.ag-team-ok{position:absolute;right:-2px;bottom:-1px;width:16px;height:16px;border-radius:50%;background:#22b864;color:#fff;font-style:normal;font-size:10px;font-weight:600;display:grid;place-items:center;border:2px solid #1a1a1b}
.ag-team-ok.is-stuck{background:#f5a524}
.ag-team-now{display:flex;gap:6px;align-items:baseline;margin-top:8px;font-size:.84rem;color:var(--ag-mute);min-width:0}
.ag-team-now b{color:var(--ag-ink);font-weight:500;flex:0 0 auto}
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
.ag-thread.is-hero{display:flex}
.ag-main.is-hero .ag-head{display:none}
.ag-hero{--hx-frame:#2a2a2b;--hx-inner:#1c1c1d;--hx-line:rgba(255,255,255,.09);--hx-text:#ededec;--hx-mute:#8d8d8b;--hx-faint:#5c5c5a;
  margin:auto;width:min(820px,100%);display:flex;flex-direction:column;align-items:center;gap:0;padding:40px 4px 40px;font-family:Inter,system-ui,-apple-system,sans-serif}
.ag-hero-title{margin:0 0 22px;font:500 26px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.015em;color:var(--hx-text);text-align:center}
.ag-hero-tabs{display:flex;gap:2px;padding:3px;margin-bottom:22px;border-radius:10px;background:#212122;border:1px solid var(--hx-line)}
.ag-hero-tabs button{border:0;background:transparent;color:var(--hx-mute);font:400 13.5px/1 Inter,system-ui,sans-serif;padding:8px 22px;min-width:100px;border-radius:7px;cursor:pointer;transition:color .15s,background .15s}
.ag-hero-tabs button:hover{color:var(--hx-text)}
.ag-hero-tabs button.is-on{background:#3b3b3c;color:var(--hx-text)}
.ag-hero-box,.ag-hero .ag-own{position:relative;width:100%;box-sizing:border-box;border-radius:20px;background:var(--hx-frame);border:1px solid rgba(255,255,255,.14);box-shadow:0 0 0 4px rgba(255,255,255,.035),0 30px 70px rgba(0,0,0,.5);padding:4px}
.ag-hero .ag-own{padding:14px}
.ag-hero-inner{border-radius:16px;background:var(--hx-inner);border:1px solid var(--hx-line);padding:10px 10px 4px}
.ag-hero-box:focus-within{border-color:rgba(255,255,255,.2)}
.ag-hero-top{display:flex;flex-wrap:wrap;gap:6px}
.ag-hero-add{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.1);background:#2a2a2b;color:#d8d8d6;font:400 13px/1 Inter,system-ui,sans-serif;padding:7px 10px;border-radius:8px;cursor:pointer}
.ag-hero-add span{color:var(--hx-mute);font-size:15px;line-height:.6}
.ag-hero-add:hover,.ag-hero-add.is-open{background:#333334}
#panel-agents .ag-app .ag-hero-box textarea#ag-input{display:block;width:100%;box-sizing:border-box;min-height:50px;height:50px;margin:12px 0 4px;padding:2px 4px;resize:none;border:0;outline:0;box-shadow:none;background:transparent;color:var(--hx-text);font:400 15px/1.5 Inter,system-ui,sans-serif}
.ag-hero-box textarea::placeholder{color:var(--hx-faint)}
.ag-hero-bar{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;padding:6px 6px 4px 8px}
.ag-hero-side{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
.ag-hero-ctl{display:inline-flex;align-items:center;gap:6px;max-width:200px;border:0;background:transparent;color:#d8d8d6;font:400 13.5px/1 Inter,system-ui,sans-serif;padding:7px 8px;border-radius:8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-hero-ctl:hover,.ag-hero-ctl.is-open{background:rgba(255,255,255,.06)}
.ag-hero-ctl img{width:22px;height:15px;object-fit:cover;border-radius:3px;flex:none}
.ag-hero-ctl svg{flex:none;opacity:.6}
.ag-hero-chev{opacity:.5}
.ag-hero-send{width:32px;height:32px;margin-left:6px;border-radius:50%;border:1px solid #ff2d48;display:grid;place-items:center;background:#c41530;color:#fff;cursor:pointer;box-shadow:0 0 0 3px rgba(255,45,72,.12)}
.ag-hero-send:hover{background:#e0203c;color:#fff}
.ag-hero-menu{position:absolute;top:calc(100% + 8px);z-index:20;min-width:150px;max-height:320px;overflow:auto;padding:5px;border-radius:12px;background:#242425;border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:1px}
.ag-hero-menu.is-right{right:6px}.ag-hero-menu.is-left{left:6px}
.ag-hero-menu.is-wide{min-width:220px}
.ag-own-cost{font-size:12.5px;color:var(--ag-mute);margin:2px 2px 8px}
.ag-own-cost.is-short{color:#ffd27a}
.ag-hero-up{padding:7px}
.ag-hero-file{display:inline-flex;align-items:center;gap:7px;max-width:100%;border:1px solid rgba(255,45,72,.35);background:rgba(255,45,72,.1);color:#d8d8d6;font:400 12.5px/1 Inter,system-ui,sans-serif;padding:5px 6px 5px 9px;border-radius:8px}
.ag-hero-file b{font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-hero-file span{color:#8d8d8b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-hero-file.is-short{border-color:rgba(255,170,0,.4);background:rgba(255,170,0,.08)}
.ag-hero-file button{border:0;background:transparent;color:#8d8d8b;font-size:15px;line-height:1;width:20px;height:20px;border-radius:5px;cursor:pointer}
.ag-hero-file button:hover{background:rgba(255,255,255,.08);color:#fff}
.ag-hero-box.is-drop{border-color:#ff2d48;box-shadow:0 0 0 4px rgba(255,45,72,.18)}
.ag-hero-note{margin-top:10px;font-size:12.5px;color:#ffd27a;text-align:center}
.ag-hero-menu.is-looks{width:min(380px,calc(100% - 12px));padding:8px}
.ag-hero-looks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ag-hero-looks button{display:flex;flex-direction:column;gap:5px;border:1px solid transparent;background:transparent;border-radius:9px;padding:4px;color:#cfcfcd;font:400 11.5px/1.2 Inter,system-ui,sans-serif;cursor:pointer;text-align:left}
.ag-hero-looks button:hover{background:rgba(255,255,255,.05)}
.ag-hero-looks button.is-on{border-color:#ff2d48;background:rgba(255,45,72,.08)}
.ag-hero-looks img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:6px;background:#111}
.ag-hero-looks span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-hero-all{margin-top:6px;width:100%;border:0;border-top:1px solid rgba(255,255,255,.08);background:transparent;color:#9a9a98;font:400 12.5px/1 Inter,system-ui,sans-serif;padding:10px 6px 4px;text-align:left;cursor:pointer}
.ag-hero-all:hover{color:#fff}
.ag-hero-alls{display:flex;justify-content:space-between;gap:8px;margin-top:6px;border-top:1px solid rgba(255,255,255,.08)}
.ag-hero-alls .ag-hero-all{margin:0;width:auto;border:0;padding:10px 6px 4px}
.ag-hero-alls .ag-hero-all:last-child{text-align:right}
.ag-hero-menu-h{padding:8px 10px 4px;font:500 10.5px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7c7c7a}
.ag-hero-menu.is-motion{width:min(300px,calc(100% - 12px))}
/* Style picker popup */
.ag-spop-bg{position:fixed;inset:0;z-index:900;background:rgba(5,5,6,.72);backdrop-filter:blur(10px) saturate(1.2);-webkit-backdrop-filter:blur(10px) saturate(1.2);animation:agPopFade .2s ease}
.ag-spop{position:fixed;z-index:901;left:50%;top:50%;transform:translate(-50%,-50%);width:min(940px,calc(100vw - 40px));max-height:min(800px,calc(100vh - 56px));display:flex;flex-direction:column;border-radius:26px;background:radial-gradient(120% 60% at 50% -10%,rgba(255,45,72,.08),rgba(255,45,72,0) 55%),#0f0f11;border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 50px 120px -20px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden;animation:agPopIn .26s cubic-bezier(.16,1,.3,1);font-family:Inter,system-ui,sans-serif}
.ag-spop.is-wide{width:min(1160px,calc(100vw - 40px))}
.ag-spop.is-small{width:min(540px,calc(100vw - 40px))}
@keyframes agPopFade{from{opacity:0}}
@keyframes agPopIn{from{opacity:0;transform:translate(-50%,-48%) scale(.97)}}
.ag-spop-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:26px 28px 14px}
.ag-spop-head h3{margin:0;font-size:24px;font-weight:550;letter-spacing:-.03em;color:#fff}
.ag-spop-head p{margin:6px 0 0;font-size:14px;color:rgba(255,255,255,.5)}
.ag-spop-x{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;border:0;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);cursor:pointer;transition:background .15s,color .15s}
.ag-spop-x:hover{background:rgba(255,255,255,.12);color:#fff}
.ag-spop-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;padding:4px 28px 18px}
.ag-spop-search{flex:1 1 260px;max-width:360px;height:42px;padding:0 14px 0 40px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 14px 50%;color:#fff;font:400 14px Inter,system-ui,sans-serif;outline:none;transition:border-color .15s,background-color .15s}
.ag-spop-search::placeholder{color:rgba(255,255,255,.38)}
.ag-spop-search:focus{border-color:rgba(255,45,72,.55);background-color:rgba(255,255,255,.06)}
.ag-spop-groups{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.ag-spop-groups button{height:32px;padding:0 13px;border-radius:9px;border:0;background:transparent;color:rgba(255,255,255,.6);font:500 13px Inter,system-ui,sans-serif;cursor:pointer;transition:background .15s,color .15s}
.ag-spop-groups button:hover{color:#fff}
.ag-spop-groups button.is-on{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ag-spop-body{flex:1;min-height:0;overflow-y:auto;padding:6px 28px 28px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}
.ag-spop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}
.ag-spop-style{position:relative;display:flex;flex-direction:column;gap:9px;padding:0;border:0;background:none;color:rgba(255,255,255,.72);font:500 13.5px/1.25 Inter,system-ui,sans-serif;text-align:left;cursor:pointer}
.ag-spop-style img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:14px;outline:2px solid transparent;outline-offset:2px;transition:outline-color .15s,transform .2s cubic-bezier(.16,1,.3,1),filter .2s}
.ag-spop-style:hover img{transform:translateY(-2px) scale(1.015);filter:brightness(1.08)}
.ag-spop-style:hover{color:#fff}
.ag-spop-style.is-on img{outline-color:#ff2d48}
.ag-spop-style.is-on span{color:#fff}
.ag-spop-style i{position:absolute;top:9px;right:9px;display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:#ff2d48;color:#fff;font-style:normal;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(255,45,72,.5)}
.ag-spop-style[hidden]{display:none}
.ag-spop-empty{margin:32px 0;text-align:center;color:rgba(255,255,255,.45);font-size:14px}
.ag-spop-foot{display:flex;justify-content:flex-end;padding:14px 28px 22px;border-top:1px solid rgba(255,255,255,.06)}
.ag-spop-done{height:42px;padding:0 22px;border-radius:12px;border:0;background:#ff2d48;color:#fff;font:500 14px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px -6px rgba(255,45,72,.6)}
.ag-spop-done:hover{background:#ff4560}
/* Voice cards: orb, name, and a play row with a waveform that lights up while it plays */
.ag-vc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.ag-vc{--c:hsl(var(--h,350) 80% 58%);position:relative;display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:20px;background:#151517;border:1px solid rgba(255,255,255,.06);transition:border-color .2s,background .25s,transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s}
.ag-vc:hover{background:linear-gradient(180deg,hsl(var(--h) 70% 45% / .2),hsl(var(--h) 70% 45% / .04) 70%),#161618;border-color:hsl(var(--h) 70% 60% / .35);transform:translateY(-2px)}
.ag-vc.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48,0 16px 40px -12px rgba(255,45,72,.45);background:linear-gradient(180deg,hsl(var(--h) 70% 45% / .22),hsl(var(--h) 70% 45% / .05) 70%),#161618}
.ag-vc.is-playing{background:linear-gradient(180deg,hsl(var(--h) 70% 45% / .3),hsl(var(--h) 70% 45% / .06) 75%),#161618}
.ag-vc[hidden]{display:none}
.ag-vc.is-ghost{height:122px;background:linear-gradient(90deg,#151517,#1d1d20,#151517);background-size:200% 100%;animation:agSpopShine 1.2s linear infinite}
@keyframes agSpopShine{to{background-position:-200% 0}}
.ag-vc-top{position:relative;display:flex;align-items:center;gap:14px;padding:12px;border:0;border-radius:15px;background:rgba(255,255,255,.04);color:inherit;font:inherit;text-align:left;cursor:pointer}
.ag-vc-orb{flex:none;width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 32% 28%,hsl(var(--h) 100% 88%) 0%,hsl(var(--h) 85% 62%) 32%,hsl(var(--h) 80% 42%) 70%,hsl(var(--h) 75% 22%) 100%);box-shadow:inset -4px -6px 12px rgba(0,0,0,.35),0 6px 18px -4px hsl(var(--h) 80% 50% / .55)}
.ag-vc-txt{display:flex;flex-direction:column;gap:3px;min-width:0}
.ag-vc-txt b{font:500 16px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.01em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-vc-txt small{font:400 13px/1.3 Inter,system-ui,sans-serif;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-vc-check{position:absolute;top:10px;right:10px;display:none;place-items:center;width:22px;height:22px;border-radius:7px;background:#ff2d48;color:#fff}
.ag-vc-check svg{width:14px;height:14px}
.ag-vc.is-on .ag-vc-check{display:grid}
.ag-vc-play{display:flex;align-items:center;gap:12px;height:44px;padding:0 12px 0 14px;border:0;border-radius:13px;background:transparent;color:#fff;cursor:pointer}
.ag-vc-play:disabled{cursor:default;opacity:.4}
.ag-vc-play svg{flex:none;width:16px;height:16px}
.ag-vc-play .pa,.ag-vc-play.is-playing .pl{display:none}
.ag-vc-play.is-playing .pa{display:block}
.ag-vc-wave{flex:1;display:flex;align-items:center;justify-content:space-between;gap:2px;height:24px;min-width:0}
.ag-vc-wave i{flex:1;max-width:3px;height:calc(var(--b) * 100%);border-radius:2px;background:rgba(255,255,255,.18);transition:background .2s}
.ag-vc:hover .ag-vc-wave i{background:rgba(255,255,255,.3)}
.ag-vc-play.is-playing .ag-vc-wave i{background:#fff;animation:agVcWave .9s ease-in-out infinite alternate;animation-delay:var(--d)}
@keyframes agVcWave{0%{transform:scaleY(.45)}100%{transform:scaleY(1.05)}}
.ag-spop .ag-char-form{display:flex;gap:8px}
.ag-spop .ag-char-form input{flex:1;min-width:0;height:42px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#fff;font:400 14px Inter,system-ui,sans-serif;outline:none}
.ag-spop .ag-char-form input:focus{border-color:rgba(255,45,72,.55)}
@media(prefers-reduced-motion:reduce){.ag-vc-play.is-playing .ag-vc-wave i{animation:none}}
@media(max-width:600px){.ag-spop,.ag-spop.is-wide,.ag-spop.is-small{top:auto;bottom:0;left:0;right:0;transform:none;width:100%;max-height:90vh;border-radius:24px 24px 0 0;animation:none}.ag-spop-head{padding:20px 18px 10px}.ag-spop-head h3{font-size:20px}.ag-spop-tools{padding:2px 18px 14px}.ag-spop-search{max-width:none}.ag-spop-body{padding:4px 18px 22px}.ag-spop-grid{grid-template-columns:repeat(2,1fr);gap:12px}.ag-vc-grid{grid-template-columns:1fr;gap:10px}.ag-spop .ag-char-form{flex-direction:column}}
.ag-hero-menu .ag-hero-chrow{flex-direction:row;align-items:center;gap:9px}
.ag-hero-chrow .ag-blob{width:16px;height:16px}
.ag-hero-menu-sep{height:1px;background:rgba(255,255,255,.08);margin:4px 2px}
.ag-hero-menu-note{color:#8d8d8b;font-size:12.5px;padding:8px 10px}
.ag-hero-menu.is-voices{width:min(400px,calc(100% - 12px));padding:10px}
.ag-hero-menu>button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:0;background:transparent;color:#d8d8d6;font:400 13.5px/1.2 Inter,system-ui,sans-serif;padding:8px 10px;border-radius:7px;cursor:pointer}
.ag-hero-menu>button b{font-weight:400}
.ag-hero-menu>button span{color:var(--hx-mute);font-size:12px}
.ag-hero-menu>button:hover{background:rgba(255,255,255,.06)}.ag-hero-menu>button.is-on{background:rgba(255,255,255,.1);color:#fff}
.ag-hero-ideas{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:min(640px,100%);margin-top:34px}
.ag-hero-idea,.ag-hero-shuffle{display:inline-flex;align-items:center;gap:9px;border:1px solid rgba(255,255,255,.06);background:transparent;color:var(--hx-faint);font:400 12.5px/1 Inter,system-ui,sans-serif;padding:8px 13px;border-radius:999px;cursor:pointer;transition:color .15s,border-color .15s}
.ag-hero-idea span{color:#4a4a48;padding-right:9px;border-right:1px solid rgba(255,255,255,.07)}
.ag-hero-idea:hover,.ag-hero-shuffle:hover{color:#bdbdbb;border-color:rgba(255,255,255,.14)}
.ag-hero-idea:hover span{color:var(--hx-mute)}
.ag-hero-shuffle{width:32px;height:32px;padding:0;justify-content:center}
.ag-hero-foot{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;color:var(--hx-faint);font-size:12.5px;margin-top:22px}
.ag-hero-foot:empty{display:none}
.ag-hero-foot button{border:0;background:transparent;color:var(--hx-mute);text-decoration:underline;text-underline-offset:3px;cursor:pointer;font:inherit;padding:0}
@media (max-width:640px){.ag-hero{padding:22px 0 26px}.ag-hero-title{font-size:22px;margin-bottom:16px}.ag-hero-tabs{margin-bottom:16px}.ag-hero-tabs button{padding:8px 12px;min-width:0}.ag-hero-ctl{max-width:140px}.ag-hero-idea span{display:none}.ag-hero-ideas{margin-top:22px}}
.ag-rv{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.25fr);gap:36px;width:min(1080px,100%);margin:0 auto;box-sizing:border-box;padding:20px 32px 40px;overflow:auto;align-content:start}
.ag-rv-left{display:flex;flex-direction:column;gap:12px;padding-top:6px}
.ag-rv-art{position:relative;width:132px;aspect-ratio:16/10;border-radius:10px;overflow:hidden;background:#111;box-shadow:0 12px 30px rgba(0,0,0,.45);transform:rotate(-4deg);margin:4px 0 6px 6px}
.ag-rv-art img{width:100%;height:100%;object-fit:cover;display:block}
.ag-rv-art i{position:absolute;right:-8px;bottom:-8px;width:62%;height:56%;border-radius:9px;background:#2a2a2b;border:1px solid rgba(255,255,255,.12);transform:rotate(6deg)}
.ag-rv-left h2{margin:4px 0 0;font:500 28px/1.15 Inter,system-ui,sans-serif;letter-spacing:-.02em;word-break:break-word}
.ag-rv-left p{margin:0;color:var(--ag-mute);font-size:13.5px;line-height:1.5;max-width:400px}
.ag-rv-steps{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
.ag-rv-steps li{display:flex;align-items:center;gap:9px;color:var(--ag-mute);font-size:13px}
.ag-rv-steps li .ag-blob{width:18px;height:18px;flex:none}
.ag-rv-steps b{color:var(--ag-ink);font-weight:500}
.ag-rv-panel{display:flex;flex-direction:column;gap:12px;min-width:0}
.ag-rv-tabs{display:flex;gap:18px;border-bottom:1px solid var(--ag-line)}
.ag-rv-tabs button{border:0;background:transparent;color:var(--ag-mute);font:500 13px/1 Inter,system-ui,sans-serif;padding:9px 2px 11px;border-bottom:2px solid transparent;cursor:pointer}
.ag-rv-tabs button.is-on{color:var(--ag-ink);border-bottom-color:#ff2d48}
.ag-rv-card{border:1px solid rgba(255,255,255,.1);border-radius:16px;background:#1a1a1b;overflow:hidden}
.ag-rv-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--ag-line);font-size:13.5px}
.ag-rv-head b{font-weight:500}
.ag-rv-actions{display:flex;align-items:center;gap:10px}
.ag-rv-price{color:var(--ag-mute);font-size:12.5px;font-variant-numeric:tabular-nums}
.ag-rv-approve{border:1px solid #ff2d48;border-radius:9px;background:#c41530;color:#fff;font:500 13px/1 Inter,system-ui,sans-serif;padding:9px 13px;cursor:pointer}
.ag-rv-approve:hover{background:#e0203c;color:#fff}
.ag-rv-approve:disabled{opacity:.45;cursor:not-allowed}
.ag-rv-warn{margin:12px 14px 0;padding:9px 11px;border-radius:9px;background:rgba(255,170,0,.1);border:1px solid rgba(255,170,0,.3);color:#ffd27a;font-size:12.5px;line-height:1.45}
.ag-rv-body{padding:14px;display:flex;flex-direction:column;gap:14px}
.ag-rv-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.ag-rv-field>span{color:var(--ag-mute);font-size:12px;font-weight:500}
#panel-agents .ag-app .ag-rv-field textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:54px;border-radius:9px;border:1px solid var(--ag-line);background:#141415;color:var(--ag-ink);font:400 13.5px/1.45 Inter,system-ui,sans-serif;padding:9px 11px;outline:0}
#panel-agents .ag-app .ag-rv-field textarea:focus{border-color:rgba(255,255,255,.25)}
.ag-rv-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;border:1px solid var(--ag-line);background:#141415;font-size:13px}
.ag-rv-row b{font-weight:500}
.ag-rv-row small{color:var(--ag-mute);font-size:11.5px}
.ag-rv-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ag-rv-look{display:flex;align-items:center;gap:11px;padding:8px 10px;border-radius:9px;border:1px solid var(--ag-line);background:#141415;font-size:13px}
.ag-rv-look img{width:72px;aspect-ratio:16/9;object-fit:cover;border-radius:6px}
.ag-rv-look div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ag-rv-look b{font-weight:500}
.ag-rv-look small{color:var(--ag-mute);font-size:11.5px}
.ag-rv-bill{display:flex;flex-direction:column;border:1px solid var(--ag-line);border-radius:10px;overflow:hidden}
.ag-rv-bill div{display:flex;justify-content:space-between;gap:12px;padding:9px 12px;font-size:13px;border-top:1px solid var(--ag-line)}
.ag-rv-bill div:first-child{border-top:0}
.ag-rv-bill span{color:var(--ag-mute)}
.ag-rv-bill b{font-variant-numeric:tabular-nums;font-weight:500}
.ag-rv-bill .is-total{background:#222223}.ag-rv-bill .is-total span{color:var(--ag-ink);font-weight:500}
.ag-rv-fine{margin:0;color:var(--ag-mute);font-size:12px;line-height:1.45}
.ag-rv .ag-chip{font-size:12.5px;padding:6px 11px}
@media (max-width:900px){.ag-rv{grid-template-columns:1fr;gap:20px;padding:16px 14px 28px}.ag-rv-two{grid-template-columns:1fr}.ag-rv-art{width:110px}.ag-rv-left h2{font-size:22px}}
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
.ag-voice.is-on .ag-voice-pick{color:#161616;font-weight:500}
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
.ag-niche-top b{font-size:1rem;font-weight:550;line-height:1.25}
.ag-pay{flex-shrink:0;font-size:.68rem;font-weight:550;letter-spacing:.03em;padding:3px 8px;border-radius:999px;white-space:nowrap}
.ag-pay.is-high{background:rgba(34,184,100,.18);color:#6fe0a0}
.ag-pay.is-mid{background:rgba(245,165,36,.16);color:#f5c26b}
.ag-pay.is-low{background:rgba(255,255,255,.08);color:var(--ag-mute)}
.ag-niche-blurb{font-size:.84rem;color:var(--ag-mute);line-height:1.4}
.ag-niche-proof{display:flex;gap:8px;align-items:baseline;font-size:.78rem;line-height:1.35;color:rgba(242,242,241,.75);border-top:1px solid var(--ag-line);padding-top:8px;margin-top:auto}
.ag-niche-x{flex-shrink:0;font-weight:600;color:#fff;font-variant-numeric:tabular-nums}
.ag-niche-own{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:8px;font-size:.88rem;color:var(--ag-mute)}
.ag-niche-own input{min-width:0;width:240px;max-width:100%;height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);font:inherit;font-size:.88rem}
.ag-niche-src{font-size:.74rem!important;max-width:560px!important}
.ag-su-wrap{display:flex;flex-direction:column;gap:10px;margin-top:8px;max-width:760px}
.ag-genres{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.ag-genre{position:relative;display:block;padding:0;border-radius:14px;border:2px solid transparent;overflow:hidden;background:#232324;cursor:pointer;aspect-ratio:4/3}
.ag-genre img{width:100%;height:100%;object-fit:cover;display:block;opacity:.7;transition:opacity .15s}
.ag-genre span{position:absolute;left:8px;bottom:6px;font-size:.78rem;font-weight:500;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.ag-genre:hover img,.ag-genre.is-on img{opacity:1}
.ag-genre.is-on{border-color:#fff}
.ag-genre:focus-visible,.ag-su-topic:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-su-about{display:flex;gap:10px;align-items:stretch;background:#232324;border:1px solid var(--ag-line);border-radius:16px;padding:10px}
.ag-su-about textarea{flex:1;min-width:0;background:transparent;border:0;color:var(--ag-ink);font:inherit;font-size:.95rem;resize:none;padding:4px 6px}
#panel-agents .ag-su-about textarea:focus{outline:none!important;box-shadow:none!important;border:0!important;background:transparent}
.ag-su-about:focus-within{border-color:rgba(255,255,255,.3)}
.ag-su-name{display:flex;align-items:center;gap:10px}
.ag-su-name input{flex:1;max-width:320px;background:#232324;border:1px solid #333;border-radius:10px;color:var(--ag-ink);font:inherit;font-size:1rem;font-weight:500;padding:8px 10px}
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
.ag-st-steps b{color:var(--ag-ink);font-weight:500}
.ag-st-steps i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;border:1px solid var(--ag-line);font-size:.72rem}
.ag-st-steps .is-on i{background:#fff;color:#161616;border-color:#fff}
.ag-st-steps .ag-st-line{width:24px;height:1px;background:var(--ag-line)}
.ag-st{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:22px;align-items:start}
.ag-st-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.ag-st h3{margin:0;font-family:Lora,Georgia,serif;font-weight:500;font-size:1.8rem;letter-spacing:-.01em}
.ag-host{display:flex;align-items:flex-start;gap:12px}
.ag-host .ag-blob{width:46px;height:46px;flex:0 0 46px}
.ag-host-say{background:var(--ag-bubble);border-radius:6px 18px 18px 18px;padding:10px 14px;font-size:.92rem;line-height:1.45}
.ag-host-say b{display:block;font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ag-mute);font-weight:500;margin-bottom:2px}
.ag-tabs{display:flex;gap:6px;flex-wrap:wrap}
.ag-tab{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;border:1px solid var(--ag-line);background:#1f1f20;color:var(--ag-ink);font:inherit;font-size:.86rem;cursor:pointer}
.ag-tab .ag-blob{width:26px;height:26px}
.ag-tab.is-on{background:#fff;color:#161616;border-color:#fff}
.ag-tab:focus-visible,.ag-mode:focus-visible,.ag-capcard:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ag-preview{position:sticky;top:0;display:flex;flex-direction:column;gap:12px;background:#161617;border:1px solid var(--ag-line);border-radius:20px;padding:12px}
.ag-preview-frame{position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:16/9;container-type:size}
.ag-preview-frame.is-tall{aspect-ratio:9/16;height:min(420px,60vh);margin:0 auto;width:auto}
.ag-preview-frame img{width:100%;height:100%;object-fit:cover;display:block}
.ag-cap{position:absolute;left:6%;right:6%;bottom:12%;text-align:center;line-height:1.15;font-weight:600;text-wrap:balance}
.ag-cap .hot{color:var(--hl)}
.ag-preview-row{display:flex;align-items:center;gap:10px;font-size:.85rem}
.ag-preview-row .ag-card-label{min-width:64px}
.ag-preview-row b{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-round{width:34px;height:34px;flex:0 0 34px;border-radius:50%;border:0;background:#fff;color:#161616;display:grid;place-items:center;cursor:pointer}
.ag-capgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ag-capcard{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;border:2px solid transparent;background:#232324;color:var(--ag-ink);font:inherit;font-size:.8rem;cursor:pointer;text-align:left}
.ag-capcard.is-on{border-color:#fff}
.ag-capcard > span:first-child{display:block;text-align:center;line-height:54px;overflow:hidden;height:54px;border-radius:9px;background:linear-gradient(135deg,#3a3f4a,#22252b);font-size:17px;font-weight:600;white-space:nowrap;paint-order:stroke fill}
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
.ag-go{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;border:0;background:#fff;color:#161616;font:inherit;font-weight:500;cursor:pointer}
.ag-go:disabled{opacity:.4;cursor:not-allowed}
.ag-go small{font-weight:500;color:#555}
.ag-shape{display:flex;flex-wrap:wrap;gap:3px}
.ag-shape i{width:14px;height:22px;border-radius:3px;background:#2d2d2f}
.ag-shape i.is-anim{background:#ff4fa3}
.ag-crewplan{display:flex;flex-direction:column;gap:8px}
.ag-crewplan div{display:flex;align-items:center;gap:10px;font-size:.88rem}
.ag-crewplan .ag-blob{width:30px;height:30px;flex:0 0 30px}
.ag-crewplan b{font-weight:500}
.ag-crewplan span{color:var(--ag-mute)}
.ag-prog{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:22px;align-items:start}
.ag-prog-list{display:flex;flex-direction:column;gap:2px;background:#161617;border:1px solid var(--ag-line);border-radius:20px;padding:14px}
.ag-prog-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}
.ag-prog-top b{font-size:1.6rem;font-weight:500}
.ag-bar{height:6px;border-radius:999px;background:#2a2a2b;overflow:hidden;margin-bottom:10px}
.ag-bar i{display:block;height:100%;background:#fff;border-radius:999px;transition:width .4s}
.ag-step{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:12px;border:0;background:none;color:var(--ag-ink);font:inherit;text-align:left;width:100%}
.ag-step .ag-blob{width:32px;height:32px;flex:0 0 32px}
.ag-step-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.ag-step-txt b{font-size:.9rem;font-weight:500}
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
.ag-ed-wbtn{flex:0 0 auto;height:34px;padding:0 14px;border-radius:10px;border:0;background:#ff3040;color:#fff;font:inherit;font-weight:500;font-size:.8rem;cursor:pointer;white-space:nowrap}
.ag-ed-wbtn[disabled]{opacity:.45;cursor:default}
.ag-ed-wrap .ag-ed-seg button[disabled]{opacity:.5;cursor:default}
.ag-ed-wnote{font-style:normal;font-size:.76rem;color:#fbbf24}
.ag-ed-wnote.is-err{color:#f87171}
.ag-ed-clipbox{position:absolute;inset:0;pointer-events:none}
.ag-ed-clipbox .ag-ed-clip{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s}
.ag-ed-clipbox .ag-ed-clip.is-ready{opacity:1}
.ag-ed-grip{position:absolute;top:0;bottom:0;right:-6px;width:10px;z-index:3;cursor:col-resize;touch-action:none}
.ag-ed-grip::after{content:'';position:absolute;top:8px;bottom:8px;left:4px;width:3px;border-radius:3px;background:#fff;opacity:0;transition:opacity .12s;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
.ag-ed-scene:hover .ag-ed-grip::after,.ag-ed-grip:focus-visible::after,.ag-ed-grip.is-drag::after{opacity:1}
.ag-ed-grip.is-drag::after{background:#ff3040}
.ag-ed-grip:focus-visible{outline:none}
.ag-ed-tip{position:absolute;top:4px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 8px;border-radius:6px;background:#ff3040;color:#fff;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.64rem;pointer-events:none}
.ag-ed-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 2px 12px;border-bottom:1px solid var(--ag-line);margin-bottom:12px}
.ag-ed-back{border:0;background:none;color:var(--ag-mute);font:inherit;font-size:.86rem;cursor:pointer;padding:6px 8px;border-radius:8px}
.ag-ed-back:hover{color:var(--ag-ink);background:#232324}
.ag-ed-title{font-size:1rem;font-weight:500;max-width:40ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-ed-badge{font-size:.7rem;font-weight:600;padding:3px 9px;border-radius:999px;background:#2a2a2b;color:#fbbf24}
.ag-ed-badge.is-done{color:#4ade80}
.ag-ed-sp{flex:1}
.ag-ed-ghost{height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--ag-line);color:var(--ag-ink);text-decoration:none;display:inline-flex;align-items:center;font-size:.86rem}
.ag-ed-export{height:36px;padding:0 18px;border-radius:999px;border:0;background:#ff3040;color:#fff;font:inherit;font-weight:500;font-size:.88rem;cursor:pointer}
.ag-ed-export[disabled]{opacity:.5}
.ag-ed-tabs{display:flex;gap:2px;padding:4px;border-radius:14px;background:#1d1d1e;overflow-x:auto}
.ag-ed-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 10px;border:0;border-radius:10px;background:none;color:var(--ag-mute);font:inherit;font-size:.82rem;cursor:pointer;white-space:nowrap}
.ag-ed-tabs button .ag-blob{width:18px;height:18px}
.ag-ed-tabs button.is-on{background:#2c2c2d;color:var(--ag-ink);font-weight:500}
.ag-ed-body{display:flex;flex-direction:column;gap:10px;background:#161617;border:1px solid var(--ag-line);border-radius:16px;padding:14px;min-width:0}
.ag-ed-sec{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ag-mute);margin-top:4px}
.ag-ed-sl{display:flex;flex-direction:column;gap:6px;font-size:.82rem}
.ag-ed-sl>span{display:flex;justify-content:space-between;color:var(--ag-mute)}
.ag-ed-sl b{color:#ff3040;font-weight:500}
.ag-ed-sl input[type=range]{accent-color:#ff3040}
.ag-ed-select{height:38px;border-radius:10px;border:1px solid var(--ag-line);background:#101011;color:var(--ag-ink);font:inherit;padding:0 10px}
.ag-ed-sw{display:flex;gap:6px;flex-wrap:wrap}
.ag-ed-sw button{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:var(--c);cursor:pointer}
.ag-ed-sw button.is-on{box-shadow:0 0 0 2px #1a1a1b,0 0 0 4px #ff3040}
.ag-ed-seg{display:flex;gap:4px;padding:3px;border-radius:10px;background:#101011}
.ag-ed-seg button{flex:1;height:30px;border:0;border-radius:8px;background:none;color:var(--ag-mute);font:inherit;font-size:.8rem;cursor:pointer}
.ag-ed-seg button.is-on{background:#ff3040;color:#fff;font-weight:500}
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
.ag-ed-wrap .ag-ed-title{font-family:var(--ed-disp);font-weight:600;text-transform:uppercase;letter-spacing:-.02em;font-size:1.25rem}
.ag-ed-wrap .ag-ed-back{font-family:var(--ed-mono);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;background:var(--ed-panel);border-radius:10px;padding:8px 12px}
.ag-ed-wrap .ag-ed-badge{font-family:var(--ed-mono);font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;background:rgba(251,191,36,.12);border-radius:8px}
.ag-ed-wrap .ag-ed-badge.is-done{background:rgba(74,222,128,.12)}
.ag-ed-wrap .ag-ed-bar>.ag-note{font-family:var(--ed-mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.04em}
.ag-ed-wrap .ag-ed-ghost{border:0;background:var(--ed-panel2);border-radius:12px;height:42px;font-weight:500}
.ag-ed-wrap .ag-ed-export{height:42px;border-radius:12px;padding:0 22px;font-family:var(--ed-disp);font-weight:600;text-transform:uppercase;letter-spacing:.02em;box-shadow:0 10px 28px rgba(255,48,64,.32),inset 0 1px 0 rgba(255,255,255,.25);background:linear-gradient(180deg,#ff4655,#ff2238)}
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
.ag-ed-tt b{font-size:.84rem;font-weight:500;color:var(--ag-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
/* ── New look (Nov 2026): the Editor keeps its layout, with the Agents page's type and blue accent ── */
.ag-ed-wrap{--ed-acc:#ff2d48;--ed-disp:Inter,system-ui,-apple-system,sans-serif}
.ag-ed-wrap .ag-ed-title{font-weight:500;text-transform:none;letter-spacing:-.01em;font-size:16px}
.ag-ed-wrap .ag-ed-export,.ag-ed-export{height:34px;border-radius:9px;padding:0 15px;font-weight:500;font-size:13px;text-transform:none;letter-spacing:0;background:#c41530;color:#fff;border:1px solid #ff2d48;box-shadow:none}
.ag-ed-wrap .ag-ed-export:hover,.ag-ed-export:hover{background:#e0203c;color:#fff}
.ag-ed-wbtn{background:#c41530;color:#fff;border:1px solid #ff2d48;font-weight:500;border-radius:9px}
.ag-ed-vid.is-on{box-shadow:inset 0 0 0 2px #ff2d48}
.ag-ed-grip.is-drag::after{background:#ff2d48}
.ag-ed-tip{background:#ff2d48}
.ag-ed-sl b{color:#ff9aa7}
.ag-ed-sl input[type=range],.ag-ed-zoom input{accent-color:#ff2d48}
.ag-ed-sw button.is-on{box-shadow:0 0 0 2px #1a1a1b,0 0 0 4px #ff2d48}
.ag-ed-seg button.is-on{background:#c41530;color:#fff;font-weight:500}
.ag-ed-wrap .ag-ed-tlbar b{font-size:13.5px}
.ag-app.is-ed .ag-empty h3{font:500 22px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.015em}
.ag-app.is-ed .ag-empty p{font-size:13.5px}
.ag-app.is-ed .ag-chip{font-size:12.5px;padding:6px 11px}
.ag-app.is-ed .ag-chip.is-primary{background:#c41530;color:#fff;border-color:#ff2d48}

/* ── 2026 refresh: glass surfaces, softer borders, bigger type, segmented controls, red glow actions ── */
.ag-app{--rf-surface:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));--rf-line:rgba(255,255,255,.08);--rf-red:linear-gradient(180deg,#ff4a63,#e11d3a);--rf-glow:0 10px 28px -8px rgba(255,45,72,.7),inset 0 1px 0 rgba(255,255,255,.25)}
.ag-side{background:linear-gradient(180deg,#0f0f11,#0b0b0c);border-right:1px solid rgba(255,255,255,.05)}
.ag-chat-list button,.ag-list button{border-radius:10px;transition:background .15s,color .15s}
/* Composer */
.ag-main.is-hero{background:radial-gradient(55% 45% at 50% 22%,rgba(255,45,72,.075),rgba(255,45,72,0) 70%)}
.ag-hero-title{font:550 36px/1.12 Inter,system-ui,sans-serif;letter-spacing:-.04em;color:#fff;margin-bottom:26px}
.ag-hero-tabs{padding:4px;gap:2px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:26px}
.ag-hero-tabs button{border-radius:10px;padding:9px 24px;font-weight:500;color:rgba(255,255,255,.5);transition:background .2s,color .2s}
.ag-hero-tabs button.is-on{background:rgba(255,255,255,.12);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 2px 8px rgba(0,0,0,.3)}
.ag-hero-box,.ag-hero .ag-own{border-radius:26px;padding:6px;background:var(--rf-surface);border:1px solid rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(0,0,0,.45),0 40px 90px -24px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.07);transition:border-color .2s,box-shadow .2s}
.ag-hero-box:focus-within{border-color:rgba(255,72,96,.45);box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 0 5px rgba(255,45,72,.08),0 40px 90px -24px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.07)}
.ag-hero-inner{border-radius:21px;background:#121214;border-color:rgba(255,255,255,.05);padding:14px 14px 6px}
#panel-agents .ag-app .ag-hero-box textarea#ag-input{font-size:16px;line-height:1.5;min-height:62px;height:62px;margin:14px 0 4px;color:#f5f5f4}
.ag-hero-add{border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:7px 13px;color:#ececea;font-weight:500;transition:background .15s}
.ag-hero-add:hover,.ag-hero-add.is-open{background:rgba(255,255,255,.11)}
.ag-hero-bar{padding:10px 6px 6px 8px}
.ag-hero-ctl{border-radius:999px;padding:8px 12px;color:rgba(255,255,255,.72);font-weight:500;transition:background .15s,color .15s}
.ag-hero-ctl:hover,.ag-hero-ctl.is-open{background:rgba(255,255,255,.08);color:#fff}
.ag-hero-ctl img{border-radius:5px}
.ag-hero-send{width:40px;height:40px;border:0;background:var(--rf-red);box-shadow:var(--rf-glow);transition:transform .15s,filter .15s}
.ag-hero-send:hover{filter:brightness(1.08);transform:translateY(-1px)}
.ag-hero-menu{border-radius:16px;padding:6px;background:rgba(22,22,25,.94);backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 70px -12px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.05)}
.ag-hero-menu button{border-radius:10px}
.ag-hero-menu button.is-on{background:rgba(255,45,72,.12)}
.ag-hero-ideas{margin-top:38px;gap:10px}
.ag-hero-idea,.ag-hero-shuffle{border-radius:999px;background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.07);color:rgba(255,255,255,.55);padding:9px 14px;transition:background .15s,color .15s,border-color .15s}
.ag-hero-idea:hover,.ag-hero-shuffle:hover{background:rgba(255,255,255,.06);color:#fff;border-color:rgba(255,255,255,.14)}
.ag-hero-idea span{color:rgba(255,255,255,.35)}
/* Chat */
.ag-bubble{border-radius:18px;padding:11px 15px;font-size:14.5px;line-height:1.55}
.ag-compose{border-radius:22px;padding:8px;background:var(--rf-surface);border:1px solid rgba(255,255,255,.09);box-shadow:0 20px 50px -20px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05)}
.ag-compose:focus-within{border-color:rgba(255,72,96,.4)}
/* Chips, labels, fields everywhere in the Agents app (review screen, settings, empty states) */
.ag-chip{border-radius:999px;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);transition:background .15s,border-color .15s,color .15s}
.ag-chip:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.14)}
.ag-chip.is-on{background:#fff;color:#111;border-color:#fff}
.ag-chip.is-primary,.ag-app.is-ed .ag-chip.is-primary{background:var(--rf-red);color:#fff;border-color:transparent;box-shadow:var(--rf-glow);font-weight:500}
.ag-chip.is-primary:hover{filter:brightness(1.08)}
.ag-card-label{font-size:12.5px;letter-spacing:0;text-transform:none;font-weight:500;color:rgba(255,255,255,.5)}
.ag-empty h3{font:550 26px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.03em;color:#fff}
.ag-empty p{color:rgba(255,255,255,.55);font-size:14.5px}
.ag-studio{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent}
/* Review screen */
.ag-rv-left h2{font:550 32px/1.12 Inter,system-ui,sans-serif;letter-spacing:-.035em;color:#fff}
.ag-rv-art{border-radius:14px;box-shadow:0 20px 40px -10px rgba(0,0,0,.7)}
.ag-rv-tabs{gap:2px;width:fit-content;padding:4px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.04)}
.ag-rv-tabs button{padding:8px 14px;border-radius:9px;border-bottom:0;color:rgba(255,255,255,.5);transition:background .15s,color .15s}
.ag-rv-tabs button.is-on{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ag-rv-card{border-radius:22px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border-color:rgba(255,255,255,.08);box-shadow:0 30px 70px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05)}
.ag-rv-head{padding:16px 18px;font-size:15px;font-weight:500;border-bottom-color:rgba(255,255,255,.06)}
.ag-rv-approve{border:0;border-radius:12px;padding:11px 16px;font-weight:500;font-size:13.5px;background:var(--rf-red);box-shadow:var(--rf-glow);transition:filter .15s,transform .15s}
.ag-rv-approve:hover{background:var(--rf-red);filter:brightness(1.08);transform:translateY(-1px)}
.ag-rv-body{padding:18px}
.ag-rv-field>span{font-size:12.5px;color:rgba(255,255,255,.5)}
.ag-rv-field textarea{border-radius:12px;background:rgba(0,0,0,.25);border-color:rgba(255,255,255,.08);font-size:14px;padding:12px 14px}
.ag-rv-field textarea:focus{border-color:rgba(255,72,96,.5);box-shadow:0 0 0 4px rgba(255,45,72,.08)}
@media (max-width:640px){.ag-hero-title{font-size:27px;margin-bottom:18px}.ag-hero-tabs{margin-bottom:18px}.ag-rv-left h2{font-size:24px}.ag-empty h3{font-size:22px}}
/* Calmer home (Agents): one flat prompt box, small grey type, small grey idea pills */
.ag-main.is-hero{background:none}
.ag-hero{width:min(780px,100%);padding-top:64px}
.ag-hero-title{font:500 32px/1.2 "SF Pro Display",-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;letter-spacing:-.015em;color:#fff;margin-bottom:20px}
.ag-hero-tabs{padding:3px;border-radius:10px;margin-bottom:20px;background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06)}
.ag-hero-tabs button{padding:6px 18px;min-width:0;font-size:13px;font-weight:400;border-radius:7px}
.ag-hero-tabs button.is-on{font-weight:500}
.ag-hero-box,.ag-hero .ag-own{padding:0;border-radius:20px;background:#18181b;border:1px solid rgba(255,255,255,.09);box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 24px 60px -30px rgba(0,0,0,.8)}
.ag-hero-box:focus-within{border-color:rgba(255,255,255,.18);box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 24px 60px -30px rgba(0,0,0,.8)}
.ag-hero-inner{background:transparent;border:0;border-radius:0;padding:14px 16px 0}
#panel-agents .ag-app .ag-hero-box textarea#ag-input{font-size:14.5px;line-height:1.5;min-height:50px;height:50px;margin:10px 2px 2px;color:#ececea}
.ag-hero-box textarea::placeholder{color:rgba(255,255,255,.32)}
.ag-hero-add{background:transparent;border:1px solid rgba(255,255,255,.09);padding:5px 10px;font-size:12.5px;font-weight:400;color:rgba(255,255,255,.6)}
.ag-hero-add:hover,.ag-hero-add.is-open{background:rgba(255,255,255,.05);color:rgba(255,255,255,.85)}
.ag-hero-bar{padding:6px 10px 10px 8px}
.ag-hero-ctl{padding:6px 8px;font-size:13px;font-weight:400;color:rgba(255,255,255,.55)}
.ag-hero-ctl:hover,.ag-hero-ctl.is-open{color:rgba(255,255,255,.85);background:rgba(255,255,255,.05)}
.ag-hero-ctl .ag-hero-chev{opacity:.4}
.ag-hero-send{width:32px;height:32px;background:#ff2d48;box-shadow:none}
.ag-hero-send:hover{background:#ff4560;filter:none;transform:none}
.ag-hero-ideas{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%;margin-top:26px}
.ag-hero-idea{display:inline-flex;align-items:center;gap:7px;max-width:100%;min-width:0;padding:7px 12px;border-radius:999px;background:transparent;border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.42);font:400 12.5px/1.2 Inter,system-ui,sans-serif;cursor:pointer;transition:color .15s,border-color .15s}
.ag-hero-idea:hover{background:transparent;border-color:rgba(255,255,255,.14);color:rgba(255,255,255,.75)}
.ag-hero-idea b{font-weight:400;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-idea-ico{flex:none;display:inline-flex;width:auto;height:auto;background:none;border-radius:0;color:rgba(255,255,255,.3)}
.ag-idea-ico svg{width:13px;height:13px}
.ag-hero-more{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:5px 9px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.35);font:400 12px Inter,system-ui,sans-serif;cursor:pointer}
.ag-hero-more svg{width:12px;height:12px}
.ag-hero-more:hover{color:rgba(255,255,255,.7);background:transparent}
.ag-hero-foot{margin-top:16px;font-size:12px}
@media (max-width:640px){.ag-hero{padding-top:28px}.ag-hero-title{font-size:24px}.ag-hero-idea:nth-child(n+4){display:none}}
/* Dropdowns: compact, grey, current choice marked with a small red check */
.ag-hero-menu{min-width:200px;padding:5px;border-radius:13px;background:#1c1c1f;backdrop-filter:none;-webkit-backdrop-filter:none;border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 44px -12px rgba(0,0,0,.75)}
.ag-hero-menu.is-wide{min-width:240px}
.ag-hero-menu.is-motion{width:260px}
.ag-hero-menu>button{position:relative;width:100%;gap:2px;padding:7px 30px 7px 10px;border-radius:8px;color:rgba(255,255,255,.75);font:400 13px/1.25 Inter,system-ui,sans-serif}
.ag-hero-menu>button b{font-weight:400}
.ag-hero-menu>button span{font-size:11.5px;color:rgba(255,255,255,.4)}
.ag-hero-menu>button:hover{background:rgba(255,255,255,.05);color:#fff}
.ag-hero-menu>button.is-on,.ag-hero-menu button.is-on{background:transparent;color:#fff}
.ag-hero-menu>button.is-on:hover{background:rgba(255,255,255,.05)}
.ag-hero-menu>button.is-on::after{content:"";position:absolute;right:10px;top:50%;width:12px;height:12px;margin-top:-6px;background:#ff2d48;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E") center/contain no-repeat}
.ag-hero-menu-h{padding:7px 10px 3px;font:500 11px/1 Inter,system-ui,sans-serif;letter-spacing:0;text-transform:none;color:rgba(255,255,255,.35)}
.ag-hero-menu-sep{margin:4px 6px;background:rgba(255,255,255,.06)}
.ag-hero-looks button{font-size:11.5px;color:rgba(255,255,255,.6)}
.ag-hero-looks button.is-on{border-color:rgba(255,45,72,.7);background:transparent;color:#fff}
/* Editor side panel: compact tabs, one thing at a time */
.ag-ed-wrap .ag-ed-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.ag-ed-wrap .ag-ed-tabs button{flex-direction:column;justify-content:center;align-items:center;gap:3px;height:auto;padding:7px 4px;border-radius:9px;background:transparent;text-align:center}
.ag-ed-wrap .ag-ed-tabs button:hover{background:rgba(255,255,255,.04)}
.ag-ed-wrap .ag-ed-tabs button.is-on{background:rgba(255,255,255,.1);box-shadow:none}
.ag-ed-wrap .ag-ed-ti{flex:none;width:auto;height:auto;background:none}
.ag-ed-wrap .ag-ed-tabs .ag-ed-ti .ag-blob,.ag-ed-wrap .ag-ed-tabs .ag-ed-ti svg{width:18px;height:18px}
.ag-ed-wrap .ag-ed-tt{align-items:center}
.ag-ed-wrap .ag-ed-tt i{font-family:Inter,system-ui,sans-serif;font-size:11.5px;text-transform:none;letter-spacing:0;color:rgba(255,255,255,.7)}
.ag-ed-wrap .ag-ed-tabs button.is-on .ag-ed-tt i{color:#fff}
.ag-ed-wrap .ag-ed-tt b{font-size:10.5px;font-weight:400;color:rgba(255,255,255,.38);max-width:100%}
.ag-ed-wrap .ag-ed-body{padding:14px;gap:12px;border-radius:16px;background:#141416;border:1px solid rgba(255,255,255,.06)}
.ag-ed-hint{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.1);font-size:12.5px;color:rgba(255,255,255,.5)}
.ag-ed-hint svg{flex:none;width:16px;height:16px;color:rgba(255,255,255,.4)}
.ag-ed-grp{display:flex;flex-direction:column;border-radius:12px;border:1px solid rgba(255,255,255,.06);overflow:hidden}
.ag-ed-grp-row{display:flex;align-items:center;gap:12px;padding:12px;border-top:1px solid rgba(255,255,255,.06)}
.ag-ed-grp-row:first-child{border-top:0}
.ag-ed-grp-row.is-col{flex-direction:column;align-items:stretch;gap:8px}
.ag-ed-grp-row>span{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.ag-ed-grp-row b{font-size:13px;font-weight:500;color:#f2f2f0}
.ag-ed-grp-row i{font-style:normal;font-size:11.5px;line-height:1.4;color:rgba(255,255,255,.42)}
.ag-ed-wrap .ag-ed-wbtn{height:32px;padding:0 12px;border-radius:9px;font-size:12.5px;font-weight:500;background:#ff2d48;box-shadow:none}
.ag-ed-wrap .ag-ed-seg{display:flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:10px;background:rgba(255,255,255,.04)}
.ag-ed-wrap .ag-ed-seg button{flex:1;height:28px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:rgba(255,255,255,.55);font:400 12px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.ag-ed-wrap .ag-ed-seg button:hover{color:#fff}
.ag-ed-wrap .ag-ed-seg button.is-on{background:rgba(255,255,255,.12);color:#fff;font-weight:500}
.ag-ed-scn{display:flex;flex-direction:column;gap:10px}
.ag-ed-scn-h{display:flex;align-items:center;gap:10px}
.ag-ed-scn-x{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(255,255,255,.7);cursor:pointer}
.ag-ed-scn-x svg{width:15px;height:15px}
.ag-ed-scn-x:hover{background:rgba(255,255,255,.06);color:#fff}
.ag-ed-scn-h span{display:flex;align-items:baseline;gap:6px}
.ag-ed-scn-h b{font-size:14px;font-weight:500;color:#f2f2f0}
.ag-ed-scn-h small{font-size:12px;color:rgba(255,255,255,.42)}
.ag-ed-scn-img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:#0c0c0d}
.ag-ed-scn-line small,.ag-ed-scn-lab{display:block;font-size:11.5px;color:rgba(255,255,255,.42);margin-bottom:4px}
.ag-ed-scn-line p{margin:0;font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.7)}
.ag-ed-scn-text{width:100%;box-sizing:border-box;resize:vertical;min-height:80px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25);color:#ececea;font:400 13px/1.5 Inter,system-ui,sans-serif;outline:none}
.ag-ed-scn-text:focus{border-color:rgba(255,45,72,.5)}
.ag-ed-scn-act{display:flex;gap:8px}
.ag-ed-scn-btn{flex:1;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#ececea;font:500 12.5px Inter,system-ui,sans-serif;cursor:pointer}
.ag-ed-scn-btn:hover{background:rgba(255,255,255,.08)}
.ag-ed-scn-btn.is-red{border:0;background:#ff2d48;color:#fff}
.ag-ed-scn-btn.is-red:hover{background:#ff4560}
.ag-ed-scn-btn[disabled]{opacity:.5;cursor:default}
.ag-ed-scn-err{font-size:12px;color:#ff8a9a}
/* Voice track: red bars on a soft red lane */
.ag-ed-wrap .ag-ed-wave{height:28px!important;border-radius:7px;background:rgba(255,45,72,.07);box-shadow:inset 0 0 0 1px rgba(255,45,72,.14)}
.ag-ed-wrap .ag-ed-scene.is-sel{outline:2px solid #ff2d48;outline-offset:1px}
.ag-hero-menu .ag-hero-chrow{align-items:center;gap:10px;padding:8px 30px 8px 10px}
.ag-chrow-t{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left}
.ag-chrow-t b{font-weight:400;color:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-chrow-t small{font-size:11.5px;color:rgba(255,255,255,.4);max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-hero-menu.is-wide:has(.ag-hero-chrow){min-width:300px}
.ag-hero-menu .ag-chrow-t b{color:#f2f2f0}
/* Let AI pick a topic */
.ag-hero-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ag-hero-ai svg{width:12px;height:12px;color:#ff2d48}
.ag-hero-ai[disabled]{cursor:progress;opacity:.75}
.ag-hero-ai.is-busy svg{animation:agAiSpin 1.2s linear infinite}
@keyframes agAiSpin{to{transform:rotate(360deg)}}
/* Timeline: draggable playhead, zoom controls, real waveform lane */
.ag-ed-wrap .ag-ed-ph{pointer-events:auto;cursor:ew-resize;width:2px;margin-left:-1px;background:#ff2d48;box-shadow:0 0 10px rgba(255,45,72,.55);z-index:5;touch-action:none}
.ag-ed-wrap .ag-ed-ph::after{content:"";position:absolute;top:0;bottom:0;left:-7px;width:16px}
.ag-ed-wrap .ag-ed-ph::before{width:14px;height:14px;margin-left:-7px;top:-6px;border-radius:4px 4px 50% 50%;background:#ff2d48;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.ag-ed-wrap .ag-ed-ph.is-drag{box-shadow:0 0 16px rgba(255,45,72,.9)}
.ag-ed-wrap .ag-ed-ruler{cursor:ew-resize;touch-action:none}
.ag-ed-zoom{display:inline-flex;align-items:center;gap:6px}
.ag-ed-zb{display:grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font:400 15px/1 Inter,system-ui,sans-serif;cursor:pointer}
.ag-ed-zb.is-txt{font-size:11.5px}
.ag-ed-zb:hover{color:#fff;background:rgba(255,255,255,.08)}
.ag-ed-wrap .ag-ed-wave{height:34px!important;border-radius:8px;background:rgba(255,45,72,.06);box-shadow:inset 0 0 0 1px rgba(255,45,72,.12)}
/* Camera moves on a still scene */
.ag-ed-moves{display:flex;flex-direction:column;gap:6px}
.ag-ed-moves .ag-ed-scn-lab i{font-style:normal;color:rgba(255,255,255,.3)}
.ag-ed-move-note{font-size:12px;color:rgba(255,255,255,.45)}
.ag-ed-scn-pic{overflow:hidden;border-radius:10px;aspect-ratio:16/9;background:#0c0c0d}
.ag-ed-scn-pic .ag-ed-scn-img{display:block;border-radius:0;transform-origin:center}
.ag-ed-scn-img.is-prev-zoom_in{animation:agMvIn 2.6s cubic-bezier(.25,.1,.25,1) forwards}
.ag-ed-scn-img.is-prev-zoom_out{animation:agMvOut 2.6s cubic-bezier(.25,.1,.25,1) forwards}
.ag-ed-scn-img.is-prev-pan{animation:agMvPan 2.6s cubic-bezier(.25,.1,.25,1) forwards}
@keyframes agMvIn{from{transform:scale(1)}to{transform:scale(1.18)}}
@keyframes agMvOut{from{transform:scale(1.18)}to{transform:scale(1)}}
@keyframes agMvPan{from{transform:scale(1.15) translateX(5%)}to{transform:scale(1.15) translateX(-5%)}}
/* Editor: My videos picker */
.ag-ed-pickh{display:flex;flex-direction:column;gap:3px}
.ag-ed-pickh span{font-size:13.5px;color:rgba(255,255,255,.5)}
.ag-ed-wrap .ag-ed-pickh .ag-ed-title{font-size:24px;letter-spacing:-.03em}
.ag-ed-wrap .ag-ed-bar .ag-chip{height:38px;padding:0 16px;font-size:13.5px}
.ag-ed-vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;margin-top:8px}
.ag-ed-vid{position:relative;border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);transition:transform .25s cubic-bezier(.16,1,.3,1),border-color .2s}
.ag-ed-vid:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.18)}
.ag-ed-vid.is-on{border-color:#ff2d48;box-shadow:0 0 0 1px #ff2d48}
.ag-ed-vid-open{display:flex;flex-direction:column;gap:4px;width:100%;padding:0 0 14px;border:0;background:none;color:inherit;text-align:left;cursor:pointer}
.ag-ed-vid-img{display:block;position:relative;aspect-ratio:16/9;background-size:cover;background-position:center;margin-bottom:8px}
.ag-ed-vid-open>b{padding:0 14px;font:500 15px/1.3 Inter,system-ui,sans-serif;letter-spacing:-.01em;color:#fff}
.ag-ed-wrap .ag-ed-vid-open>span:last-child,.ag-ed-vid-open>span:last-child{padding:0 14px;font-size:12.5px;color:rgba(255,255,255,.5)}
.ag-ed-vid-img i{border-radius:999px;padding:4px 9px;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);font-size:11px;font-weight:500}
.ag-ed-vid-x{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:10px;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:18px;cursor:pointer;opacity:0;transition:opacity .15s}
.ag-ed-vid:hover .ag-ed-vid-x{opacity:1}
.ag-ed-none{margin:auto;max-width:520px}
.ag-ed-none .ag-empty-crew svg,.ag-ed-none .ag-empty-crew .ag-blob{width:52px;height:52px}
/* Editor: no more typewriter labels */
.ag-ed-wrap{--ed-mono:Inter,system-ui,-apple-system,sans-serif;--ed-panel:rgba(255,255,255,.04);--ed-panel2:rgba(255,255,255,.07)}
.ag-ed-wrap .ag-ed-back,.ag-ed-wrap .ag-ed-badge,.ag-ed-wrap .ag-ed-bar>.ag-note,.ag-ed-wrap .ag-ed-tlbar,.ag-ed-tt i,.ag-ed-vid-img i,.ag-ed-vid-open>span:last-child,.ag-ed-sec,.ag-ed-wrap .ag-ed-sec,.ag-ed-lab,.ag-ed-wrap .ag-ed-lab{text-transform:none;letter-spacing:0;font-family:Inter,system-ui,sans-serif}
.ag-ed-wrap .ag-ed-back{font-size:13px;font-weight:500;border-radius:999px;padding:8px 14px}
.ag-ed-wrap .ag-ed-badge{font-size:11.5px;font-weight:500;border-radius:999px;padding:3px 9px}
.ag-ed-wrap .ag-ed-bar>.ag-note{font-size:12.5px;color:rgba(255,255,255,.5)}
.ag-ed-wrap .ag-ed-title{font-size:18px;font-weight:550;letter-spacing:-.02em}
.ag-ed-wrap .ag-ed-sec,.ag-ed-sec{font-size:12.5px;font-weight:500;color:rgba(255,255,255,.5)}
.ag-ed-wrap .ag-ed-lab,.ag-ed-lab{font-size:11.5px;font-weight:500;color:rgba(255,255,255,.45)}
.ag-ed-wrap .ag-ed-tlbar{font-size:12.5px;font-weight:500;color:rgba(255,255,255,.55)}
.ag-ed-wrap .ag-ed-tlbar b{font-size:15px;font-weight:550;letter-spacing:-.01em}
.ag-ed-wrap .ag-ed-ruler span{font-family:Inter,system-ui,sans-serif;font-size:10.5px}
.ag-ed-wrap .ag-ed-caps span,.ag-ed-wrap .ag-ed-music-bar{font-family:Inter,system-ui,sans-serif;font-size:10.5px}
.ag-ed-wrap .ag-ed-sl b{font-family:Inter,system-ui,sans-serif;font-size:11.5px;font-weight:500}
.ag-ed-wrap .ag-ed-export,.ag-ed-export{height:40px;border-radius:12px;padding:0 20px;font-size:14px;font-weight:500;border:0;background:var(--rf-red);box-shadow:var(--rf-glow)}
.ag-ed-wrap .ag-ed-export:hover,.ag-ed-export:hover{background:var(--rf-red);filter:brightness(1.08)}
.ag-ed-wbtn{border:0;border-radius:11px;background:var(--rf-red);box-shadow:var(--rf-glow);font-weight:500}
.ag-ed-seg button.is-on{background:rgba(255,255,255,.14);color:#fff;font-weight:500;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
/* Chat: wider column, and the finished video as one clean card */
#panel-agents .ag-app:not(.is-ed) .ag-msg{max-width:min(86%,880px)}
#panel-agents .ag-app:not(.is-ed) .ag-msg:has(.ag-dv){max-width:min(100%,880px);width:100%}
.ag-dv{padding:10px;gap:0;border-radius:18px;background:#18181a;border:1px solid rgba(255,255,255,.07)}
.ag-dv video{border-radius:11px}
.ag-dv-head{display:flex;align-items:flex-start;gap:12px;padding:14px 6px 4px}
.ag-dv-t{display:flex;flex-direction:column;gap:4px;min-width:0}
.ag-dv-t b{font-size:16px;font-weight:500;color:#f2f2f0;line-height:1.35}
.ag-dv-t small{font-size:12.5px;color:rgba(255,255,255,.42)}
.ag-dv-acts{display:flex;flex-wrap:wrap;gap:8px;padding:10px 6px 12px}
.ag-dv-btn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:9px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:rgba(255,255,255,.82);font:400 13px Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer;transition:background .15s,color .15s}
.ag-dv-btn svg{width:14px;height:14px;flex:none}
.ag-dv-btn:hover{background:rgba(255,255,255,.09);color:#fff}
.ag-dv-btn.is-red{background:#ff2d48;border-color:#ff2d48;color:#fff}
.ag-dv-btn.is-red:hover{background:#ff4560}
.ag-dv-more{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,.06)}
.ag-dv-more>*{padding:10px 6px;border-bottom:1px solid rgba(255,255,255,.06)}
.ag-dv-more>*:last-child{border-bottom:0}
.ag-dv-thumb{display:flex;align-items:center;gap:14px}
.ag-dv .ag-dv-thumb img{width:132px;flex:none;border-radius:8px;aspect-ratio:16/9}
.ag-dv-thumb-wait{width:132px;flex:none;aspect-ratio:16/9;border-radius:8px;background:linear-gradient(100deg,#202023 30%,#2a2a2e 50%,#202023 70%) 0 0/200% 100%;animation:agDvWait 1.6s linear infinite}
@keyframes agDvWait{to{background-position:-200% 0}}
.ag-dv-thumb span{display:flex;flex-direction:column;gap:3px}
.ag-dv-thumb b{font-size:13px;font-weight:500;color:#ececea}
.ag-dv-thumb a,.ag-dv-thumb small{font-size:12.5px;color:rgba(255,255,255,.45);text-decoration:none}
.ag-dv-thumb a:hover{color:#fff}
/* Other title ideas: folded into one row */
.ag-tcard{padding:0;gap:0;border-radius:14px;background:#18181a;border:1px solid rgba(255,255,255,.07)}
.ag-tcard>summary,.ag-dv-titles>summary{display:flex;align-items:center;gap:10px;padding:11px 14px;list-style:none;cursor:pointer;font-size:13px;color:#ececea}
.ag-dv-titles>summary{padding:0}
.ag-tcard>summary::-webkit-details-marker,.ag-dv-titles>summary::-webkit-details-marker{display:none}
.ag-tcard summary small,.ag-dv-titles summary small{font-size:12px;color:rgba(255,255,255,.4)}
.ag-tcard summary i,.ag-dv-titles summary i{display:block;flex:none;margin-right:4px;margin-left:auto;width:8px;height:8px;border-right:1.6px solid rgba(255,255,255,.5);border-bottom:1.6px solid rgba(255,255,255,.5);transform:rotate(45deg) translateY(-2px);transition:transform .15s}
.ag-tcard[open] summary i,.ag-dv-titles[open] summary i{transform:rotate(-135deg) translateY(-2px)}
.ag-tlist{display:flex;flex-direction:column;gap:2px;padding:0 6px 8px}
.ag-dv-titles .ag-tlist{padding:8px 0 0}
.ag-trow{display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.72);font:400 13px/1.4 Inter,system-ui,sans-serif;cursor:pointer}
.ag-trow:hover{background:rgba(255,255,255,.05);color:#fff}
.ag-trow.is-on{color:#fff}
.ag-trow.is-on::after{content:" · in use";color:#ff6b80;font-size:12px}
.ag-dv .ag-publish>summary.ag-chip{border:0;background:none;padding:0;font-size:13px;color:#ececea}

/* Credits a video will cost, next to the send button */
.ag-hero-cost{font-size:12.5px;color:rgba(255,255,255,.42);margin:0 4px 0 6px;font-variant-numeric:tabular-nums;white-space:nowrap}
/* Chat flows behind the agents: the progress panel and message box float over the thread */
#panel-agents .ag-app:not(.is-ed) .ag-main{position:relative}
#panel-agents .ag-app:not(.is-ed) .ag-main:not(.is-hero)>.ag-thread{padding-bottom:calc(var(--ag-dock-h,160px) + 12px)}
#panel-agents .ag-app:not(.is-ed) .ag-main:not(.is-hero)>.ag-compose-wrap{position:absolute;left:0;right:0;bottom:0;z-index:6;width:auto;margin:0;padding:0 max(28px,calc((100% - 1080px) / 2 + 28px)) 18px;pointer-events:none;background:linear-gradient(180deg,rgba(11,11,12,0) 0,rgba(11,11,12,0) calc(100% - 64px),#0b0b0c calc(100% - 18px))}
#panel-agents .ag-app:not(.is-ed) .ag-main:not(.is-hero)>.ag-compose-wrap>*{pointer-events:auto}
#panel-agents .ag-app:not(.is-ed) .ag-team{background:rgba(24,24,26,.72);-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3);border-color:rgba(255,255,255,.08);box-shadow:0 18px 40px -18px rgba(0,0,0,.7)}
#panel-agents .ag-app:not(.is-ed) .ag-compose{background:rgba(30,30,31,.86);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}

/* Finished video: a big thumbnail with its actions beside it */
.ag-dv .ag-dv-thumb{align-items:flex-start;gap:16px}
.ag-dv-thumb-img{position:relative;display:block;flex:none;width:min(440px,58%);border-radius:10px;overflow:hidden;line-height:0}
.ag-dv .ag-dv-thumb-img img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;transition:opacity .2s}
.ag-dv-thumb-img.is-busy img{opacity:.45}
.ag-dv-thumb-note{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;font-size:12.5px;line-height:1.2}
.ag-dv-thumb .ag-dv-thumb-wait{width:min(440px,58%)}
.ag-dv-thumb-t{display:flex;flex-direction:column;gap:4px;min-width:0;padding-top:2px}
.ag-dv-thumb-t b{font-size:13.5px;font-weight:500;color:#ececea}
.ag-dv-thumb-t small{font-size:12px;color:rgba(255,255,255,.42)}
.ag-dv-thumb-acts{display:flex;gap:6px;margin:8px 0 4px;flex-wrap:wrap}
.ag-dv-thumb-acts a,.ag-dv-thumb-acts button{height:30px;display:inline-flex;align-items:center;padding:0 11px;border-radius:8px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:rgba(255,255,255,.8);font:400 12.5px Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer}
.ag-dv-thumb-acts a:hover,.ag-dv-thumb-acts button:hover{background:rgba(255,255,255,.09);color:#fff}
.ag-dv-thumb-t .ag-dv-thumb-tip{line-height:1.45;color:rgba(255,255,255,.35)}
@media (max-width:700px){.ag-dv .ag-dv-thumb{flex-direction:column}.ag-dv-thumb-img,.ag-dv-thumb .ag-dv-thumb-wait{width:100%}}
/* Images pasted into the prompt box, and on your own messages */
.ag-att{display:flex;gap:8px;flex-wrap:wrap}
.ag-hero-top .ag-att{order:-1;width:100%}
.ag-compose-wrap>.ag-att{margin:0 0 8px}
.ag-att-i{position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;background:#1c1c1e;border:1px solid rgba(255,255,255,.1);flex:none}
.ag-att-i img{width:100%;height:100%;object-fit:cover;display:block}
.ag-att-i.is-up img{opacity:.45}
.ag-att-i.is-err{border-color:#ff2d48}
.ag-att-i button{position:absolute;top:3px;right:3px;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;font-size:14px;line-height:20px;cursor:pointer}
.ag-att-spin{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:agAttSpin .8s linear infinite}
.ag-dv-thumb-note .ag-att-spin{position:static;margin:0;width:12px;height:12px}
@keyframes agAttSpin{to{transform:rotate(360deg)}}
.ag-hero-box.is-drop,.ag-compose.is-drop{outline:1.5px dashed rgba(255,45,72,.7);outline-offset:3px}
.ag-me-imgs{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-bottom:4px}
.ag-me-imgs img{display:block;max-width:220px;max-height:160px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,.08)}

/* Sidebar: slides closed to a narrow rail that shows only the TubeOps logo */
.ag-side-logo{display:none}
@media (min-width:861px){
  #panel-agents .ag-app:not(.is-ed) .ag-side{position:relative;overflow-x:hidden}
  #panel-agents .ag-app:not(.is-ed) .ag-side>.ag-side-head,#panel-agents .ag-app:not(.is-ed) .ag-side>.ag-list,#panel-agents .ag-app:not(.is-ed) .ag-side>.ag-me{min-width:226px;transition:opacity .2s ease .08s,transform .32s cubic-bezier(.32,.72,0,1)}
  #panel-agents .ag-app.is-side-min:not(.is-ed) .ag-side>.ag-side-head,#panel-agents .ag-app.is-side-min:not(.is-ed) .ag-side>.ag-list,#panel-agents .ag-app.is-side-min:not(.is-ed) .ag-side>.ag-me{opacity:0;pointer-events:none;visibility:hidden;transform:translateX(-10px);transition:opacity .12s ease,transform .32s cubic-bezier(.32,.72,0,1),visibility 0s linear .32s}
  #panel-agents .ag-app:not(.is-ed) .ag-side-logo{display:grid;place-items:center;position:absolute;top:12px;left:10px;width:36px;height:36px;padding:0;border:0;border-radius:9px;background:transparent;color:var(--ag-ink);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease,background .15s}
  #panel-agents .ag-app.is-side-min:not(.is-ed) .ag-side-logo{opacity:1;pointer-events:auto;transition:opacity .25s ease .14s,background .15s}
    .ag-side-logo svg{width:18px;height:18px;color:var(--ag-mute);transition:color .15s}
  .ag-side-logo:hover{background:rgba(255,255,255,.07)}
    .ag-side-logo:hover svg{color:var(--ag-ink)}
}
@media (prefers-reduced-motion:reduce){#panel-agents .ag-app:not(.is-ed),#panel-agents .ag-app:not(.is-ed) .ag-side>*{transition:none!important}}

/* + menu in the prompt boxes */
.ag-pm-wrap{position:relative;display:inline-flex}
#panel-agents .ag-compose{position:relative}
.ag-compose .ag-pm-wrap{position:static;display:contents}
.ag-pm{position:absolute;z-index:40;display:flex;align-items:flex-end;gap:8px;font-family:Inter,system-ui,sans-serif}
.ag-pm.is-hero{top:calc(100% + 8px);left:0;align-items:flex-start}
.ag-pm.is-chat{bottom:calc(100% + 10px);left:0}
.ag-pm-main,.ag-pm-sub{padding:6px;border-radius:14px;background:#1d1d20;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px -16px rgba(0,0,0,.8)}
.ag-pm-main{width:260px}
.ag-pm-row{display:flex;align-items:center;gap:11px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.86);font:400 13.5px Inter,system-ui,sans-serif;text-align:left;cursor:pointer}
.ag-pm-row:hover,.ag-pm-row.is-on{background:rgba(255,255,255,.06);color:#fff}
.ag-pm-row>svg:first-child{width:17px;height:17px;flex:none;color:rgba(255,255,255,.55)}
.ag-pm-row>span:not(.ag-pm-yt-ico){flex:1}
.ag-pm-row em{font-style:normal;font-size:11px;padding:2px 7px;border-radius:999px;background:rgba(255,45,72,.14);color:#ff6b80}
.ag-pm-yt-ico{display:grid;place-items:center;width:17px;flex:none}
.ag-pm-yt-ico svg,.ag-pm-yt>svg{width:20px;height:14px;flex:none}
.ag-pm-chev{width:14px;height:14px;flex:none;color:rgba(255,255,255,.35)}
.ag-pm-sep{height:1px;margin:5px 6px;background:rgba(255,255,255,.07)}
.ag-pm-yt{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 10px}
.ag-pm-yt input{flex:1;min-width:0;height:30px;padding:0 9px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#ececea;font:400 12.5px Inter,system-ui,sans-serif;outline:none}
.ag-pm-yt input:focus{border-color:rgba(255,255,255,.25)}
.ag-pm-yt button{height:30px;padding:0 11px;border:0;border-radius:8px;background:#ff2d48;color:#fff;font:500 12.5px Inter,system-ui,sans-serif;cursor:pointer}
.ag-pm-err{padding:0 12px 6px 38px;font-size:12px;color:#ff8a9a}
.ag-pm-sub{width:300px;max-height:340px;overflow:auto}
.ag-pm-note{padding:14px 10px;font-size:12.5px;color:rgba(255,255,255,.45)}
.ag-pm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ag-pm-file{position:relative;padding:0;border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;aspect-ratio:16/10;background:#111;cursor:pointer}
.ag-pm-file:hover{border-color:rgba(255,45,72,.7)}
.ag-pm-file img,.ag-pm-file video{width:100%;height:100%;object-fit:cover;display:block}
.ag-pm-tool{position:relative;display:flex;align-items:center;gap:12px;padding:10px;border-radius:9px;cursor:pointer}
.ag-pm-tool:hover{background:rgba(255,255,255,.04)}
.ag-pm-tool>span{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.ag-pm-tool b{font-size:13.5px;font-weight:500;color:#ececea}
.ag-pm-tool small{font-size:12px;color:rgba(255,255,255,.42);line-height:1.4}
.ag-pm-tool input{position:absolute;opacity:0;pointer-events:none}
.ag-pm-sw{position:relative;flex:none;width:34px;height:20px;border-radius:999px;background:rgba(255,255,255,.14);transition:background .15s}
.ag-pm-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s ease}
.ag-pm-tool input:checked+.ag-pm-sw{background:#ff2d48}
.ag-pm-tool input:checked+.ag-pm-sw::after{transform:translateX(14px)}
.ag-pm-tool input:focus-visible+.ag-pm-sw{outline:2px solid #fff;outline-offset:2px}
.ag-plus.is-open,.ag-pm-btn.is-open{background:rgba(255,255,255,.1);color:#fff}
/* Attached clips and YouTube links */
.ag-att-i video{width:100%;height:100%;object-fit:cover;display:block}
.ag-att-badge{position:absolute;left:4px;bottom:4px;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.65);color:#fff}
.ag-att-badge svg{width:10px;height:10px}
.ag-att-yt{position:relative;display:flex;align-items:center;gap:10px;max-width:340px;height:64px;padding:6px 30px 6px 6px;border-radius:10px;background:#1c1c1e;border:1px solid rgba(255,255,255,.1)}
.ag-att-yt img{width:80px;height:52px;border-radius:6px;object-fit:cover;flex:none}
.ag-att-ytlogo{width:52px;height:52px;flex:none;border-radius:6px;background:#2a2a2d url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 20'%3E%3Crect width='28' height='20' rx='5' fill='%23ff0033'/%3E%3Cpath d='M11 6v8l7-4z' fill='white'/%3E%3C/svg%3E") center/26px no-repeat}
.ag-att-yt>span{display:flex;flex-direction:column;gap:2px;min-width:0}
.ag-att-yt small{font-size:11px;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-att-yt b{font-size:12.5px;font-weight:500;color:#ececea;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ag-att-yt.is-up b{color:rgba(255,255,255,.5)}
.ag-att-yt.is-err{border-color:#ff2d48}
.ag-att-yt.is-err b{color:#ff8a9a}
.ag-att-yt button{position:absolute;top:4px;right:4px;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:14px;line-height:20px;cursor:pointer}
.ag-me-imgs video{display:block;max-width:260px;max-height:170px;border-radius:12px;background:#000}
@media (max-width:640px){.ag-pm{flex-direction:column;align-items:stretch}.ag-pm-main,.ag-pm-sub{width:min(300px,84vw)}}

/* "Best for Mystery" on the narrators that suit the channel */
.ag-vc-best{display:inline-block;margin-left:7px;padding:1px 7px;border-radius:999px;background:rgba(255,45,72,.14);color:#ff8a9a;font:500 10.5px Inter,system-ui,sans-serif;font-style:normal;vertical-align:middle}

.ag-dv-tip{margin:0;padding:0 6px 12px;font-size:12px;line-height:1.45;color:rgba(255,255,255,.38)}

`

export function initAgentsChat({ root, getUser, openWizard } = {}) {
  /** Channels this account's plan runs, plus extra-channel add-ons. */
  const planTier = () => {
    let u = null
    try { u = getUser?.() } catch (_) {}
    return u ? resolveUserPlan(withCompedPlan(u)).tier : null
  }
  const maxChannels = () => {
    let u = null
    try { u = getUser?.() } catch (_) {}
    return Math.min(MAX_CHANNELS, channelLimit(planTier() || 'plus', u?.addon_channels))
  }
  /** The channel limit, in words, and whether a bigger plan runs more. */
  const capInfo = () => {
    let url = ''
    try { url = addonCheckoutUrl('extra_channel') } catch (_) {}
    return channelCapInfo(planTier() || 'plus', maxChannels(), url)
  }
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
  const drafts = {}
  let popOpen = false
  let review = null // { topic, tab }: the plan shown before a video starts (studio === 'review')
  // Desktop sidebar collapsed to an icon rail; remembered per browser.
  let drawer = false // phones: the chats list open as a drawer
  let sideMin = (() => { try { return localStorage.getItem('tubeops_agents_side') === 'min' } catch (_) { return false } })()
  let heroMenu = ''
  // Style picker popup over the current screen: '' | 'style' | 'char'.
  let stylePop = ''
  let heroNote = '' // a one-line message under the start composer (e.g. script too short) // '' | 'len' | 'angle' | 'voice': the open dropdown in the start composer
  let ideaSeed = 0
  const aiTopics = {}      // channel id → topics the AI picked for it on this visit (they also fill the idea chips)
  const pickedTopics = []  // topics already put in the box, so the next pick is new
  let topicBusy = false
  let heroTimer = 0
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
  // The live chat and the team's saved updates belong to the signed-in account, so the next
  // account in this browser never sees them. (The old unkeyed copies are dropped.)
  const chatStoreKey = () => nicheKey().replace('vidso_niche:', STORE_KEY + ':')
  const runKey = () => nicheKey().replace('vidso_niche:', RUN_KEY + ':')
  try { sessionStorage.removeItem(STORE_KEY); localStorage.removeItem(RUN_KEY) } catch (_) {}
  const loadMine = () => { try { const v = JSON.parse(sessionStorage.getItem(chatStoreKey()) || '[]'); return Array.isArray(v) ? v : [] } catch (_) { return [] } }
  mine = loadMine()
  let mineFor = chatStoreKey()
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
    // Picked from the review: go straight back to it, no ideas message.
    if (n && !review) {
      const pay = n.pay && PAY[n.pay] ? ' ' + PAY[n.pay].note : ''
      say('manager', 'manager', `Great choice: ${n.name}.${pay} Here are four videos that fit what's breaking out right now. Pick one, or send me your own topic.`, 'ideas')
    }
  }
  const profilesKey = () => nicheKey().replace('vidso_niche:', 'vidso_profiles:')
  // Past chats: each new video starts a fresh chat and the old one is kept here (per account).
  const chatsKey = () => nicheKey().replace('vidso_niche:', 'tubeops_chats:')
  const loadChats = () => { try { const v = JSON.parse(localStorage.getItem(chatsKey()) || '[]'); return Array.isArray(v) ? v : [] } catch (_) { return [] } }
  let chats = loadChats()
  let chatsFor = chatsKey()
  let viewChat = '' // id of a past chat being read; '' = the live chat
  const saveChats = () => { try { localStorage.setItem(chatsKey(), JSON.stringify(chats.slice(0, 60))) } catch (_) {} }
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
  let edRaf = 0
  let edDragging = false
  let edPick = false // a scene is open in the side panel
  let edEscBound = false
  const edBusy = {}
  const edPrompt = {}
  // A different video (or a redraw of every scene) starts with a clean slate: no typed prompts,
  // no busy markers, no errors from the last one.
  const edForget = () => { for (const k of Object.keys(edPrompt)) delete edPrompt[k]; for (const k of Object.keys(edBusy)) delete edBusy[k]; edErr = ''; edSel = 0; edPick = false }
  const edBusyNote = () => (Object.keys(edBusy).length ? 'Wait for the scene that is still drawing or animating to finish.' : '')
  let edErr = ''
  let edAudio = null
  let edExporting = '' // the renderUrl showing when Export was pressed; cleared when a new cut lands
  /**
   * The Editor's narration. Long videos are recorded in parts, so this plays them back to back
   * and speaks one timeline (currentTime, play, pause, events) like a single <audio>.
   */
  function edNarration(urls, total) {
    const parts = urls.map((u) => { const a = new Audio(); a.preload = 'metadata'; a.src = u; return a })
    const durs = urls.map(() => (total > 0 ? total / urls.length : 0))
    let idx = 0
    const before = (i) => durs.slice(0, i).reduce((a, b) => a + b, 0)
    const n = {
      dataset: { src: urls.join('|') },
      onplay: null, onpause: null, ontimeupdate: null, onloadedmetadata: null,
      get paused() { return parts[idx].paused },
      get readyState() { return parts[idx].readyState },
      get duration() { return durs.reduce((a, b) => a + b, 0) },
      get currentTime() { return before(idx) + (parts[idx].currentTime || 0) },
      set currentTime(t) {
        const playing = !parts[idx].paused
        const hit = playlistOffsetAt(durs, t)
        if (hit.index !== idx) { parts[idx].pause(); idx = hit.index }
        try { parts[idx].currentTime = hit.local } catch (_) {}
        if (playing) parts[idx].play().catch(() => {})
      },
      play() { return parts[idx].play() },
      pause() { parts.forEach((a) => a.pause()) },
    }
    parts.forEach((a, i) => {
      a.addEventListener('loadedmetadata', () => { if (isFinite(a.duration) && a.duration > 0) durs[i] = a.duration; if (i === 0) n.onloadedmetadata?.() })
      a.addEventListener('timeupdate', () => { if (i === idx) n.ontimeupdate?.() })
      a.addEventListener('play', () => { if (i === idx) n.onplay?.() })
      a.addEventListener('pause', () => { if (i === idx && !(a.ended && idx < parts.length - 1)) n.onpause?.() })
      a.addEventListener('ended', () => { if (i === idx && idx < parts.length - 1) { idx++; parts[idx].currentTime = 0; parts[idx].play().catch(() => {}) } })
    })
    return n
  }
  let edRendering = false
  let ED_PPS = 14 // timeline pixels per second (the zoom slider changes it)
  const ED_MIN_PPS = 4
  const ED_MAX_PPS = 160
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
    try { if (p.voiceId) window.fvAgentsVoice?.(p.voiceId); else window.fvPickBestVoice?.() } catch (_) {}
    try { if (p.captionStyle) window.fvSetCaptionStyle?.(p.captionStyle); else if (p.captions) window.fvSetCaptionLook?.(p.captions) } catch (_) {}
    try { window.fvSetDuration?.(p.durationId) } catch (_) {}
    try { window.fvSetAspect?.(p.aspect) } catch (_) {}
    try { window.fvAgentsAngle?.(p.angle) } catch (_) {}
    try { window.fvSetVisual?.({ style: p.visualStyle || DEFAULT_STYLE, mode: p.visualMode || 'cheapest', pace: p.scenePace || 'normal', characterUrl: p.characterUrl || '', characterDesc: p.characterDesc || '' }) } catch (_) {}
  }
  let previewAudio = null
  let previewSrc = ''

  const save = () => { try { sessionStorage.setItem(chatStoreKey(), JSON.stringify(mine.slice(-200))) } catch (_) {} }
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  /** Images pasted or dropped into the prompt box, waiting to go with the next message. */
  let attach = [] // { id, name, local, url, status: 'up' | 'ok' | 'err', err }
  let heroImgs = [] // images that went with the topic typed in the first box
  const readyRefs = () => attach.filter((a) => a.kind !== 'video' && a.kind !== 'yt' && a.status === 'ok' && a.url).map((a) => a.url)
  const readyVideos = () => attach.filter((a) => a.kind === 'video' && a.status === 'ok' && a.url).map((a) => a.url)
  const ytRefs = () => attach.filter((a) => a.kind === 'yt' && a.status === 'ok')
  let plusOpen = false   // the + menu in the prompt box
  let plusSub = ''       // '' | 'recent' | 'tools'
  let plusYt = false     // the YouTube link field inside the menu
  let plusRecent = null  // null = not loaded, [] = none
  let plusErr = ''
  let ytChannel = null   // { title, about, titles } from an added channel link
  const meImages = (list) => (Array.isArray(list) && list.length ? `<div class="ag-me-imgs">${list.slice(0, 4).map((u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u) ? `<video src="${esc(u)}" controls muted playsinline preload="metadata"></video>` : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Image you added" loading="lazy"></a>`).join('')}</div>` : '')
  function attachHtml() {
    if (!attach.length) return ''
    const media = (a) => a.kind === 'video'
      ? `<video src="${esc(a.local || a.url)}" muted playsinline preload="metadata"></video><i class="ag-att-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></i>`
      : `<img src="${esc(a.local || a.url)}" alt="">`
    return `<div class="ag-att">${attach.map((a) => a.kind === 'yt'
      ? `<span class="ag-att-yt${a.status === 'up' ? ' is-up' : a.status === 'err' ? ' is-err' : ''}" title="${esc(a.err || a.name)}">${a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : '<b class="ag-att-ytlogo"></b>'}<span><small>${esc(a.sub || 'YouTube')}</small><b>${esc(a.status === 'up' ? 'Reading the link…' : a.status === 'err' ? (a.err || 'Could not read that link') : a.name)}</b></span><button type="button" data-ag-att-x="${esc(a.id)}" aria-label="Remove">×</button></span>`
      : `<span class="ag-att-i${a.status === 'up' ? ' is-up' : a.status === 'err' ? ' is-err' : ''}" title="${esc(a.err || (a.kind === 'video' ? 'Plays as the opening scene' : a.name))}">${media(a)}${a.status === 'up' ? '<i class="ag-att-spin" aria-hidden="true"></i>' : ''}<button type="button" data-ag-att-x="${esc(a.id)}" aria-label="Remove">×</button></span>`).join('')}</div>`
  }
  async function addImages(files) {
    const list = [...(files || [])].filter((f) => /^(image|video)\//.test(f.type || '')).slice(0, Math.max(0, 4 - attach.length))
    if (!list.length) return false
    for (const f of list) {
      const a = { id: Math.random().toString(36).slice(2, 9), kind: /^video\//.test(f.type) ? 'video' : 'image', name: f.name || 'Image', local: URL.createObjectURL(f), url: '', status: 'up', err: '' }
      attach.push(a)
      ;(async () => {
        try { a.url = await window.fvUploadChatImage(f); a.status = 'ok' } catch (e) { a.status = 'err'; a.err = e?.message || 'Upload failed' }
        render()
      })()
    }
    render()
    return true
  }
  let pdfJs = null
  const loadPdfJs = () => pdfJs || (pdfJs = new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib)
    const el = document.createElement('script')
    el.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    el.onload = () => { const lib = window.pdfjsLib; if (!lib) return reject(new Error('The PDF reader did not load.')); lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; resolve(lib) }
    el.onerror = () => { pdfJs = null; reject(new Error('The PDF reader did not load. Check your connection.')) }
    document.head.appendChild(el)
  }))
  /** The text of a script file: .txt, .md or .pdf (read in the browser). Throws a readable error. */
  async function readScriptFile(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB.')
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      const lib = await loadPdfJs()
      const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
      const pages = []
      for (let n = 1; n <= pdf.numPages; n++) {
        const tc = await (await pdf.getPage(n)).getTextContent()
        let out = ''
        let lastY = null
        let lastH = 12
        for (const it of tc.items) {
          const y = it.transform ? it.transform[5] : null
          if (lastY != null && y != null && Math.abs(y - lastY) > 1) { const want = Math.abs(y - lastY) > lastH * 1.8 ? '\n\n' : '\n'; if (!out.endsWith(want)) out += out.endsWith('\n') ? '\n' : want }
          out += it.str
          if (it.hasEOL && !out.endsWith('\n')) out += '\n'
          if (y != null) lastY = y
          if (it.height) lastH = it.height
        }
        pages.push(out)
      }
      const text = pages.join('\n\n').split(/\n{2,}/).map((p) => p.split('\n').map((l) => l.trim()).filter((l) => l && !/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l)).join(' ')).filter(Boolean).join('\n\n')
      if (!text.trim()) throw new Error('No text found in that PDF. If it is a scan, paste the script instead.')
      return text
    }
    if (!/\.(txt|md|markdown)$/i.test(file.name) && !/^text\//.test(file.type || '')) throw new Error('Add a script as a .txt, .md or .pdf file.')
    const text = (await file.text()).replace(/^﻿/, '').trim()
    if (!text) throw new Error('That file is empty.')
    return text
  }
  /** A script file becomes this video's own script (the box keeps its title). */
  async function takeScript(file) {
    try {
      const text = await readScriptFile(file)
      const draft = String(root.querySelector('#ag-input')?.value || '').trim()
      scriptDraft = { title: draft.length <= 120 ? draft : '', text, file: file.name }
      heroNote = scriptEstimate(text).words < 40 ? 'That script is too short: it needs at least 40 words.' : ''
    } catch (e) { heroNote = e?.message || 'Could not read that file.' }
    render()
  }
  /** Files from the + menu or a drop: images and clips are attached, scripts become the script. */
  function takeFiles(files) {
    const list = [...(files || [])]
    const media = list.filter((f) => /^(image|video)\//.test(f.type || ''))
    const script = list.find((f) => !/^(image|video)\//.test(f.type || ''))
    if (media.length) addImages(media)
    if (script) {
      if (heroOn(state()) && !studio) takeScript(script)
      else { takeScript(script).then(() => { if (scriptDraft.text) openOwnReview({}) }) }
    }
  }
  /** A file from My Files, attached without uploading again. */
  function attachExisting(f) {
    if (attach.length >= 4 || attach.some((a) => a.url === f.url)) return
    attach.push({ id: Math.random().toString(36).slice(2, 9), kind: f.kind === 'video' ? 'video' : 'image', name: f.name, local: '', url: f.url, status: 'ok', err: '' })
  }
  /** A YouTube video or channel link: a video's title becomes the reference; a channel steers "Let AI pick a topic". */
  async function addYoutube(link) {
    const url = String(link || '').trim()
    if (!/^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url) && !/^@[\w.-]{2,}$/.test(url)) { plusErr = 'Paste a youtube.com or youtu.be link.'; return render() }
    plusErr = ''
    plusYt = false
    plusOpen = false
    const full = /^https?:/i.test(url) ? url : (url.startsWith('@') ? 'https://www.youtube.com/' + url : 'https://' + url)
    const isVideo = /youtu\.be\/|[?&]v=|\/shorts\/|\/live\//i.test(full)
    const a = { id: Math.random().toString(36).slice(2, 9), kind: 'yt', name: full, sub: isVideo ? 'YouTube video' : 'YouTube channel', url: full, status: 'up', err: '' }
    attach = attach.filter((x) => x.kind !== 'yt')
    attach.push(a)
    render()
    try {
      if (isVideo) {
        const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(full))
        if (!r.ok) throw new Error('That video is private or the link is wrong.')
        const d = await r.json()
        a.name = String(d.title || 'YouTube video').slice(0, 140)
        a.sub = 'Video like · ' + String(d.author_name || 'YouTube').slice(0, 40)
        a.thumb = d.thumbnail_url || ''
        a.status = 'ok'
        const box = root.querySelector('#ag-input')
        if (box && !box.value.trim()) { box.value = `A video like “${a.name}”`; drafts[selected] = box.value }
      } else {
        const d = await window.fvReadReference?.(full)
        if (!d) throw new Error('Could not read that channel.')
        a.name = String(d.channel?.title || 'YouTube channel').slice(0, 80)
        a.sub = 'Channel like'
        a.status = 'ok'
        ytChannel = { title: a.name, about: String(d.about || ''), titles: d.channel?.titles || [] }
        render()
        // Topics in that channel's style, typed straight into the box.
        if (!String(root.querySelector('#ag-input')?.value || '').trim()) return aiPickTopic({ about: ytChannel.about, reference: ytChannel.titles })
      }
    } catch (e) {
      a.status = 'err'
      a.err = e?.message || 'Could not read that link.'
    }
    render()
  }
  /** Text the agents get for any YouTube reference attached to this message. */
  function ytNote() {
    const y = ytRefs()[0]
    if (!y) return ''
    return y.sub && y.sub.startsWith('Video like') ? ` (in the style of the YouTube video “${y.name}”)` : ` (in the style of the YouTube channel ${y.name})`
  }
  /** Things that go with the next message, applied before it is sent. */
  function applyAttachments() {
    const vids = readyVideos()
    if (vids.length) { try { window.fvSetOpeningClip?.(vids[0]) } catch (_) {} }
  }
  const say = (to, from, text, kind, extra) => { mine.push({ at: Date.now(), to, from, text: String(text || ''), kind: kind || '', ch: profiles.active || '', ...(extra || {}) }); save() }
  /** True when the video in progress (or just made) belongs to the channel on screen. */
  const videoHere = () => { try { const ch = localStorage.getItem(VIDEO_CH_KEY); return !ch || !profiles.active || ch === profiles.active } catch (_) { return true } }
  const markVideo = () => { try { localStorage.setItem(VIDEO_CH_KEY, profiles.active || '') } catch (_) {} }
  const canAddChannel = () => profiles.list.length < maxChannels()
  // The team's progress lines live in the page, so keep a copy: a reload must not wipe them.
  const loadRun = () => { try { return JSON.parse(localStorage.getItem(runKey()) || 'null') } catch (_) { return null } }
  let savedRun = loadRun()
  function keepRun(st) {
    if (!st?.log?.length || !videoHere()) return
    const https = (u) => (/^https?:/.test(String(u || '')) ? String(u) : '')
    // The same run comes back after a reload (its progress lines are restored without the video):
    // keep what it finished with instead of saving it again as unfinished.
    const runId = String(st.log[0]?.at || '')
    const was = savedRun && String(savedRun.runId || savedRun.log?.[0]?.at || '') === runId ? savedRun : null
    const video = https(st.renderUrl) || https(st.renderSaved) || was?.video || ''
    savedRun = {
      ch: profiles.active || '', topic: String(st.topic || '').slice(0, 300), log: st.log.slice(-60), running: !!st.running, serverSide: !!st.serverSide, at: Date.now(), runId,
      done: !!st.renderUrl || (!st.running && !!(was?.done || video)),
      // Enough to bring the finished video and thumbnail back after a reload.
      editId: String(st.editId || was?.editId || ''),
      video,
      thumb: https(st.thumb?.url) || was?.thumb || '',
      title: String(st.script?.title || was?.title || '').slice(0, 160),
    }
    try { localStorage.setItem(runKey(), JSON.stringify(savedRun)) } catch (_) {}
  }
  /** After a reload the finished video is gone from the page: load its project back (video, scenes,
   *  thumbnail, titles), or at least show the saved video and thumbnail at the end of the chat. Once per load. */
  let runMediaTried = false
  function restoreRunMedia(st) {
    if (runMediaTried || st?.renderUrl || st?.running || !(savedRun?.done || savedRun?.video) || !videoHere()) return
    if (savedRun.ch && profiles.active && savedRun.ch !== profiles.active) return
    runMediaTried = true
    let back = false
    let editId = savedRun.editId || ''
    if (!editId) {
      // Saved before chats kept their project: find it by title or topic (newest first).
      const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const want = [savedRun.title, savedRun.topic].map(norm).filter(Boolean)
      try { editId = (window.fvEditProjects?.() || []).find((x) => want.includes(norm(x.title)))?.id || '' } catch (_) {}
    }
    if (editId) { try { back = !window.fvOpenEditProject?.(editId) } catch (_) { back = false } }
    if (!back || !state()?.renderUrl) {
      let v = savedRun.video ? { url: savedRun.video, title: savedRun.title, thumb: savedRun.thumb } : null
      // Last resort: the finished video that was saved to My Files.
      if (!v) { try { const last = window.fvLastVideoSaved?.(); if (last?.url && (!savedRun.at || (last.at || 0) >= savedRun.at - 6 * 3600e3)) v = { url: last.url, title: last.title || savedRun.title } } catch (_) {} }
      if (v) pastVideo = { ...v, fromChat: true }
      else {
        // Nothing saved in this browser: the newest finished video in My Files.
        Promise.resolve(window.fvLastVideo?.()).then((last) => {
          if (last?.url && !state()?.renderUrl && !pastVideo) { pastVideo = { ...last, fromChat: true }; render() }
        }).catch(() => {})
      }
    }
  }
  /** After a reload the live run is gone: show its saved lines, and say so once if it was still going. */
  function runLog(st) {
    if (st?.log?.length) return st.log
    if (!savedRun || (savedRun.ch && profiles.active && savedRun.ch !== profiles.active)) return []
    // A server-side video keeps going on its own; it reappears once the page reconnects.
    if (savedRun.running && !savedRun.serverSide) {
      savedRun.running = false
      try { localStorage.setItem(runKey(), JSON.stringify(savedRun)) } catch (_) {}
      const topic = savedRun.topic
      const lastStep = [...savedRun.log].reverse().find((e) => e.text)
      say('manager', 'manager', `The page reloaded while the team was working${topic ? ` on “${topic}”` : ''}${lastStep ? ` (${BY_ID[lastStep.agent]?.name || 'the team'} was on: ${String(lastStep.text).slice(0, 80)})` : ''}, so that video stopped. Want me to start it again?`, topic ? 'first-episode' : '', topic ? { topic } : undefined)
    }
    return savedRun.log
  }
  // Leaving the page stops a video that is still being made, so ask first.
  window.addEventListener('beforeunload', (e) => {
    const st = state()
    if (((st?.running || st?.busyScript) && !st?.serverSide) || Object.keys(edBusy).length || edWhole || edRendering) { e.preventDefault(); e.returnValue = '' }
  })
  /** Say BUSY_NOTE in the live chat (once in a row). */
  const busyNote = () => {
    const last = [...mine].reverse().find((m) => m.to === 'manager' && (!m.ch || !profiles.active || m.ch === profiles.active))
    if (last?.text !== BUSY_NOTE) say('manager', 'manager', BUSY_NOTE)
  }
  const capNote = () => { const c = capInfo(); say('manager', 'manager', c.message, c.upgrade ? 'upgrade' : ''); render() }

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
    if (chatsKey() !== chatsFor) { chatsFor = chatsKey(); chats = loadChats() }
    const user = (() => { try { return getUser?.() } catch (_) { return null } })()
    const name = user?.name || user?.full_name || user?.email || 'You'
    const initials = String(name).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ME'
    const live = entriesFor('manager', st)
    const liveOn = !viewChat && !studio
    const working = videoHere() && st?.running && !st?.renderUrl
    const liveTitle = liveChatTitle(st, live)
    const liveRow = live.length
      ? `<button type="button" class="ag-row ag-chat-row${liveOn ? ' is-on' : ''}" data-ag-chat-live title="${esc(liveTitle)}"><span class="ag-row-txt"><b>${esc(liveTitle)}</b></span>${working ? '<i class="ag-chat-busy" title="The team is working"></i>' : ''}</button>`
      : ''
    const past = chats.map((c) => `<button type="button" class="ag-row ag-chat-row${viewChat === c.id ? ' is-on' : ''}" data-ag-chat="${esc(c.id)}" title="${esc(c.title)}"><span class="ag-row-txt"><b>${esc(c.title)}</b></span></button>`).join('')
    return `
      <button type="button" class="ag-side-logo" data-ag-side-toggle aria-label="Open sidebar" title="Open sidebar (⌘B)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg></button>
      <div class="ag-side-head"><button type="button" class="ag-side-toggle" data-ag-side-toggle aria-label="${sideMin ? 'Expand sidebar' : 'Collapse sidebar'}" title="${sideMin ? 'Expand sidebar' : 'Collapse sidebar'} (⌘B)" aria-expanded="${!sideMin}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg></button><h2>Chats</h2>
        <button type="button" class="ag-icon-btn" data-ag-new aria-label="New chat" title="New chat"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
        <button type="button" class="ag-drawer-x" data-ag-drawer-close aria-label="Close chats"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="ag-list ag-chat-list" role="group" aria-label="Your chats">
        ${liveRow || past ? `${liveRow}${past ? '<div class="ag-chat-label">Recent</div>' + past : ''}` : '<div class="ag-chat-empty">Your chats show up here.</div>'}
      </div>
      <div class="ag-me"><i>${esc(initials)}</i><span>${esc(String(name).slice(0, 40))}</span></div>`
  }

  /** A past chat, read-only: what everyone said, and the video it made. */
  function chatViewHtml() {
    const c = chats.find((x) => x.id === viewChat)
    if (!c) return ''
    let prev = ''
    const rows = (c.entries || []).map((e) => {
      if (e.who === 'me') { prev = 'me'; return `<div class="ag-msg from-me">${meImages(e.images)}${e.text ? `<div class="ag-bubble">${esc(e.text)}</div>` : ''}</div>` }
      const who = BY_ID[e.who] ? e.who : 'manager'
      const head = who !== prev ? `<div class="ag-who">${agentSvg(who)}<b>${esc(BY_ID[who].name)}</b><span>${esc(clock(e.at))}</span></div>` : ''
      prev = who
      return `<div class="ag-msg">${head}<div class="ag-bubble${e.kind === 'done' && who !== 'manager' ? ' is-check' : ''}">${esc(e.text)}</div></div>`
    }).join('')
    const file = (String(c.title || 'tubeops-video').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'tubeops-video') + '.mp4'
    const video = c.video ? `<div class="ag-msg"><div class="ag-who">${agentSvg('editor')}<b>Editor</b><span>The finished video</span></div><div class="ag-card">
        <video controls playsinline preload="metadata" src="${esc(c.video)}"></video>
        ${c.thumb ? `<img src="${esc(c.thumb)}" alt="Thumbnail">` : ''}
        <div class="ag-chips"><a class="ag-chip is-primary" href="${esc(c.video)}" download="${esc(file)}" target="_blank" rel="noopener">Download video</a><button type="button" class="ag-chip" data-ag-files>Open My Files</button></div>
      </div></div>` : ''
    return `<div class="ag-thread"><div class="ag-day">${esc(dayLabel(c.at))}</div>${rows}${video}</div>
      <div class="ag-compose-wrap"><div class="ag-chat-done"><span>Your current video is still being made. You can keep chatting here once it's done.</span><button type="button" class="ag-chip" data-ag-chat-live>Back to it</button><button type="button" class="ag-chip" data-ag-chat-del>Delete chat</button></div></div>`
  }

  // ── threads ────────────────────────────────────────────────────────────
  function entriesFor(id, st) {
    const log = (videoHere() ? runLog(st) : [])
      .filter((e) => id === 'manager' || e.agent === id)
      .filter((e) => !(e.agent === 'manager' && /^Running the whole video$/.test(e.text)))
      .map((e) => ({ ...e, type: 'log' }))
    // Messages saved with no channel (older chats, or said before the first channel existed)
    // belong to the channel that is active now, so they never show up in every channel.
    if (profiles.active && mine.some((m) => !m.ch)) { mine.forEach((m) => { if (!m.ch) m.ch = profiles.active }); save() }
    const own = mine.filter((m) => m.to === id && (!m.ch || !profiles.active || m.ch === profiles.active)).map((m) => ({ ...m, type: 'mine' }))
    return [...log, ...own].sort((a, b) => a.at - b.at)
  }

  function artifactFor(agent, st) {
    const s = st?.script
    if (agent === 'title' && s?.options?.length) {
      const n = s.options.filter((o) => o.title !== s.title).length
      return `<details class="ag-card ag-tcard"><summary><span>${n ? `${n} other title idea${n === 1 ? '' : 's'}` : 'Title ideas'}</span><small>Click one to use it instead</small><i aria-hidden="true"></i></summary>
        <div class="ag-tlist">${s.options.map((o, i) => `<button type="button" class="ag-trow${o.title === s.title ? ' is-on' : ''}" data-ag-title="${i}">${esc(o.title)}</button>`).join('')}</div></details>`
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
      return `<div class="ag-card"><div class="ag-card-label">Narration</div>${audioPlayerHtml(st.media.voiceover)}</div>`
    }
    if (agent === 'editor' && st?.renderUrl) return deliveryHtml(st)
    if (agent === 'publish' && st?.publish?.description) return `<div class="ag-card">${publishHtml(st).replace('<details class="ag-publish">', '<details class="ag-publish" open>')}</div>`
    return ''
  }

  function deliveryHtml(st) {
    const s = st.script || {}
    const t = st.thumb || {}
    const others = (s.options || []).filter((o) => o.title !== s.title)
    const file = (String(s.title || 'tubeops-video').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'tubeops-video') + '.mp4'
    const dur = Number(st.media?.duration || 0)
    const meta = [st.madeIn ? 'Made in ' + st.madeIn : '', dur ? Math.floor(dur / 60) + ':' + String(Math.round(dur % 60)).padStart(2, '0') + ' long' : '', st.aspect || ''].filter(Boolean).join(' · ')
    const canEdit = (() => { try { return !!window.fvSceneProject?.() } catch (_) { return false } })()
    const ico = {
      down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
      yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    }
    return `<div class="ag-card ag-dv">
      <div data-ag-keep="video"></div>
      <div class="ag-dv-head">
        <div class="ag-dv-t"><b>${esc(s.title || 'Untitled')}</b>${meta ? `<small>${esc(meta)}</small>` : ''}</div>
      </div>
      <div class="ag-dv-acts">
        <a class="ag-dv-btn is-red" href="${esc(st.renderUrl)}" download="${esc(file)}">${ico.down}Download</a>
        ${canEdit ? `<button type="button" class="ag-dv-btn" data-ed-open>${ico.edit}Edit scenes</button>` : ''}
        <button type="button" class="ag-dv-btn" data-ag-copy>${ico.copy}Copy title</button>
      </div>
      <div class="ag-card-label" data-yt-status hidden></div>
      <p class="ag-dv-tip">The last 20 seconds tease your next episode. When you post it, add an end screen there in YouTube Studio pointing to it.</p>
      <div class="ag-dv-more">
        ${t.url || t.busy || t.prev ? `<div class="ag-dv-thumb">${(() => {
          const img = t.url || t.prev
          const pic = img ? `<a class="ag-dv-thumb-img${t.busy ? ' is-busy' : ''}" href="${esc(img)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(img)}" alt="Thumbnail">${t.busy ? '<span class="ag-dv-thumb-note"><i class="ag-att-spin"></i>Updating…</span>' : ''}</a>` : '<div class="ag-dv-thumb-wait"></div>'
          const side = `<span class="ag-dv-thumb-t"><b>Thumbnail</b><small>${esc(t.busy ? (t.style ? t.style + ' · updating' : 'Designing…') : (t.style || 'Ready'))}</small><span class="ag-dv-thumb-acts">${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener" download>Download</a>` : ''}${t.busy ? '' : '<button type="button" data-ag-thumb>Another style</button>'}</span><small class="ag-dv-thumb-tip">To change it, tell the Manager, e.g. “make the clock say 4:00 AM”. You can paste an image too.</small></span>`
          return pic + side
        })()}</div>` : ''}
        ${others.length ? `<details class="ag-dv-titles"><summary><span>${others.length} other title idea${others.length === 1 ? '' : 's'}</span><small>Click one to use it instead</small><i aria-hidden="true"></i></summary><div class="ag-tlist">${others.map((o) => `<button type="button" class="ag-trow" data-ag-title-o="${esc(o.title)}">${esc(o.title)}</button>`).join('')}</div></details>` : ''}
        ${publishHtml(st)}
      </div>
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
        <div class="ag-field"><span class="ag-card-label">Length</span><div class="ag-chips">${lenButtons('data-pw-len', d.durationId)}</div></div>
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
          <h3>${profiles.list.some((p) => p.id === d.id) ? 'Edit channel' : 'Set up your channel'}</h3>
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


  /** A steady colour per voice for its orb, from a curated set (golds, corals, pinks, violets, blues, teals). */
  const ORB_HUES = [44, 28, 12, 352, 330, 300, 272, 248, 218, 196, 172, 36, 4, 318, 230, 186]
  function voiceSeed(seed) {
    let h = 2166136261
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
    return h
  }
  function voiceHue(seed) { return ORB_HUES[voiceSeed(seed) % ORB_HUES.length] }
  /** A fixed, voice-like waveform per voice (heights 0.25-1). */
  function waveBars(seed, n = 30) {
    let s = voiceSeed(seed) % 233280
    return Array.from({ length: n }, (_, i) => {
      s = (s * 9301 + 49297) % 233280
      const env = 0.55 + 0.45 * Math.sin((i / n) * Math.PI)
      return (0.25 + 0.75 * (s / 233280) * env).toFixed(2)
    })
  }

  /** The style picker as a popup over whatever screen is open. Picking a style applies it and closes. */
  function stylePopHtml(st) {
    const v = st?.visual || {}
    const cur = visualStyleById(v.style) || visualStyleById(DEFAULT_STYLE)
    const x = '<button type="button" class="ag-spop-x" data-pop-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>'
    if (stylePop === 'voice') {
      const list = st?.voices || []
      const loading = !list.length
      const msg = st?.voiceState === 'error' ? 'Voices load once you sign in.' : 'Loading voices…'
      const genders = [...new Set(list.map((v) => v.gender).filter(Boolean))].sort()
      const accents = [...new Set(list.map((v) => v.accent).filter(Boolean))].sort()
      const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase())
      const initials = (n) => String(n || '?').trim().slice(0, 1).toUpperCase()
      return `<div class="ag-spop-bg" data-pop-close></div>
      <div class="ag-spop is-wide" role="dialog" aria-modal="true" aria-labelledby="ag-spop-h">
        <header class="ag-spop-head"><div><h3 id="ag-spop-h">Choose a narrator</h3><p>${loading ? esc(msg) : list.length + ' voices. Press play to hear one, then click it to use it.'}</p></div>${x}</header>
        ${loading ? '' : `<div class="ag-spop-tools">
          <input class="ag-spop-search" data-pop-search type="search" placeholder="Search voices, accents or moods" aria-label="Search voices" autocomplete="off">
          <div class="ag-spop-groups" role="group" aria-label="Filter voices"><button type="button" class="is-on" data-pop-group="">All</button>${genders.map((g) => `<button type="button" data-pop-group="${esc(g)}">${esc(cap(g))}</button>`).join('')}${accents.slice(0, 6).map((a) => `<button type="button" data-pop-group="${esc(a.toLowerCase())}">${esc(cap(a))}</button>`).join('')}</div>
        </div>`}
        <div class="ag-spop-body">
          ${loading ? (st?.voiceState === 'error' ? '' : '<div class="ag-vc-grid">' + Array.from({ length: 8 }, () => '<div class="ag-vc is-ghost"></div>').join('') + '</div>') : `<div class="ag-vc-grid" data-pop-grid>${list.map((v) => {
            const on = v.id === st.voiceId
            const tags = [v.gender, v.accent].filter(Boolean)
            const hue = voiceHue(v.id + (v.name || ''))
            const bars = waveBars(v.id)
            return `<div class="ag-vc${on ? ' is-on' : ''}" style="--h:${hue}" data-pop-item data-group="${esc(tags.join(' ').toLowerCase())}" data-name="${esc([v.name, v.desc, v.label, ...tags].join(' ').toLowerCase())}">
              <button type="button" class="ag-vc-top" data-vp-voice="${esc(v.id)}" aria-pressed="${on}" title="${esc(v.desc || v.label)}">
                <span class="ag-vc-orb" aria-hidden="true"></span>
                <span class="ag-vc-txt"><b>${esc(v.name || v.label)}${v.bestFor ? `<em class="ag-vc-best">${esc(v.bestFor)}</em>` : ''}</b><small>${esc(tags.map(cap).join(' · ') || v.desc || '')}</small></span>
                <span class="ag-vc-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
              </button>
              <button type="button" class="ag-vc-play" ${v.preview ? `data-vp-play="${esc(v.preview)}"` : 'disabled'} aria-label="Play ${esc(v.name || v.label)}">
                <svg class="pl" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg><svg class="pa" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                <span class="ag-vc-wave" aria-hidden="true">${bars.map((h, i) => `<i style="--b:${h};--d:${(i % 7) * 0.09}s"></i>`).join('')}</span>
              </button>
            </div>`
          }).join('')}</div>
          <p class="ag-spop-empty" data-pop-empty hidden>No voice matches that. Try another word.</p>`}
        </div>
      </div>`
    }
    if (stylePop === 'char') {
      return `<div class="ag-spop-bg" data-pop-close></div>
      <div class="ag-spop is-small" role="dialog" aria-modal="true" aria-labelledby="ag-spop-h">
        <header class="ag-spop-head"><div><h3 id="ag-spop-h">Consistent character</h3><p>One person who shows up in every scene where a person fits. Optional.</p></div>${x}</header>
        <div class="ag-spop-body">
        ${v.characterUrl ? `<div class="ag-char"><img src="${esc(v.characterUrl)}" alt="Character reference"><div><b>${esc(v.characterDesc || 'Your character')}</b><span>Appears in every scene where a person fits.</span><div class="ag-chips"><button type="button" class="ag-chip" data-vs-char-clear>Remove</button></div></div></div>` : `
        <form class="ag-char-form" data-vs-char-form><input id="ag-char-desc" maxlength="200" placeholder="e.g. a bald man in his 40s with a grey beard, round glasses and a brown leather jacket" value="${esc(v.characterDesc || '')}" autocomplete="off"><button type="submit" class="ag-chip is-primary"${charBusy ? ' disabled' : ''}>${charBusy ? 'Drawing…' : 'Create character'}</button></form>${charError ? `<div class="ag-note is-warn">${esc(charError)}</div>` : ''}`}
        </div>
        <footer class="ag-spop-foot"><button type="button" class="ag-spop-done" data-pop-close>Done</button></footer>
      </div>`
    }
    return `<div class="ag-spop-bg" data-pop-close></div>
    <div class="ag-spop" role="dialog" aria-modal="true" aria-labelledby="ag-spop-h">
      <header class="ag-spop-head"><div><h3 id="ag-spop-h">Choose a look</h3><p>${VISUAL_STYLES.length} styles. Every scene in your next video is drawn in the one you pick.</p></div>${x}</header>
      <div class="ag-spop-tools">
        <input class="ag-spop-search" data-pop-search type="search" placeholder="Search styles" aria-label="Search styles" autocomplete="off">
        <div class="ag-spop-groups" role="group" aria-label="Style groups"><button type="button" class="is-on" data-pop-group="">All</button>${STYLE_GROUPS.map((g) => `<button type="button" data-pop-group="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      </div>
      <div class="ag-spop-body">
        <div class="ag-spop-grid" data-pop-grid>${VISUAL_STYLES.map((s) => `<button type="button" class="ag-spop-style${s.id === cur.id ? ' is-on' : ''}" data-pop-style="${esc(s.id)}" data-group="${esc(s.group)}" data-name="${esc((s.name + ' ' + s.group + ' ' + s.prompt).toLowerCase())}" aria-pressed="${s.id === cur.id}"><img src="${esc(styleSample(s.id, activeProfile()?.genre))}" alt="" loading="lazy"><span>${esc(s.name)}</span>${s.id === cur.id ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>
        <p class="ag-spop-empty" data-pop-empty hidden>No style matches that. Try another word.</p>
      </div>
    </div>`
  }

  /** The popup is drawn inside the app (so it binds like the rest), then moved to <body>,
   *  because a transformed parent would otherwise shift a fixed-position popup. */
  function placeStylePop() {
    let host = document.getElementById('ag-spop-host')
    if (!host) { host = document.createElement('div'); host.id = 'ag-spop-host'; document.body.appendChild(host) }
    host.replaceChildren(...root.querySelectorAll('.ag-spop-bg, .ag-spop'))
  }
  let popEscBound = false
  function bindStylePop() {
    if (!popEscBound) {
      popEscBound = true
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stylePop) { stylePop = ''; render() } })
    }
    if (!stylePop) return
    const pop = root.querySelector('.ag-spop')
    if (!pop) return
    const close = () => { if (stylePop === 'voice') { try { previewAudio?.pause() } catch (_) {} } stylePop = ''; render() }
    root.querySelectorAll('[data-pop-close]').forEach((b) => b.addEventListener('click', close))
    const search = pop.querySelector('[data-pop-search]')
    const filter = () => {
      const words = String(search?.value || '').toLowerCase().split(/\s+/).filter(Boolean)
      const group = pop.querySelector('[data-pop-group].is-on')?.dataset.popGroup || ''
      let shown = 0
      pop.querySelectorAll('[data-pop-style], [data-pop-item]').forEach((b) => {
        const ok = (!group || b.dataset.group === group || b.dataset.group.split(' ').includes(group)) && words.every((w) => b.dataset.name.includes(w))
        b.hidden = !ok
        if (ok) shown++
      })
      const empty = pop.querySelector('[data-pop-empty]')
      if (empty) empty.hidden = shown > 0
    }
    search?.addEventListener('input', filter)
    pop.querySelectorAll('[data-pop-group]').forEach((b) => b.addEventListener('click', () => {
      pop.querySelectorAll('[data-pop-group]').forEach((x) => x.classList.toggle('is-on', x === b))
      filter()
    }))
    pop.querySelectorAll('[data-pop-style]').forEach((b) => b.addEventListener('click', () => {
      try { window.fvSetVisual?.({ style: b.dataset.popStyle }) } catch (_) {}
      close()
    }))
    pop.querySelectorAll('[data-vp-voice]').forEach((b) => b.addEventListener('click', () => {
      try { previewAudio?.pause() } catch (_) {}
      try { window.fvAgentsVoice?.(b.dataset.vpVoice) } catch (_) {}
      close()
    }))
    pop.querySelectorAll('[data-vp-play]').forEach((b) => b.addEventListener('click', () => {
      const src = b.dataset.vpPlay
      const playing = () => pop.querySelectorAll('[data-vp-play]').forEach((x) => { const on = x === b && previewAudio && !previewAudio.paused; x.classList.toggle('is-playing', on); x.closest('.ag-vc')?.classList.toggle('is-playing', on) })
      if (previewAudio && previewSrc === src && !previewAudio.paused) { previewAudio.pause(); return playing() }
      try { previewAudio?.pause() } catch (_) {}
      previewAudio = new Audio(src)
      previewSrc = src
      previewAudio.addEventListener('ended', playing)
      previewAudio.addEventListener('pause', playing)
      previewAudio.play().then(playing).catch(() => {})
    }))
    if (stylePop === 'style' || stylePop === 'voice') setTimeout(() => search?.focus({ preventScroll: true }), 30)
    pop.querySelector('[data-pop-style].is-on')?.scrollIntoView({ block: 'nearest' })
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
            <div class="ag-field"><span class="ag-card-label">Target length</span><div class="ag-chips">${lenButtons('data-ag-len', lenNow(st).id)}</div></div>`}
          <div class="ag-st-foot"><button type="button" class="ag-chip" data-st-close>Back to chat</button><button type="button" class="ag-go" data-st-next${ok ? '' : ' disabled'}>Next: video settings</button></div>
        </div>
        ${previewCard({ ...setup, extra: `<div class="ag-preview-row"><span class="ag-card-label">Profile</span><b>${esc(setup.name)}</b><button type="button" class="ag-chip" data-st-profile style="margin-left:auto">${activeProfile() ? 'Edit' : 'Set up'}</button></div>` })}
      </div></div>`
  }

  function settingsStudioHtml(st) {
    const v = st?.visual || {}
    const own = brief.mode === 'own'
    const est = scriptEstimate(scriptDraft.text)
    const seconds = own ? est.seconds : lenNow(st).seconds
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
          ${own ? '' : `<div class="ag-field"><span class="ag-card-label">Length</span><div class="ag-chips">${lenButtons('data-ag-len', lenNow(st).id)}</div></div>`}
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
    else if ((f.agent === 'voice' || f.agent === 'agent') && st?.media?.voiceover) live = `<div class="ag-card-label">Narration</div>${audioPlayerHtml(st.media.voiceover)}`
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
    return `<div class="ag-studio ag-ed-wrap"><div class="ag-ed-bar"><div class="ag-ed-pickh"><b class="ag-ed-title">My videos</b><span>Pick a video to open it in the Editor.</span></div><span class="ag-ed-sp"></span>${window.fvSceneProject?.() ? '<button type="button" class="ag-ed-back" data-ed-picker-close>Back to the editor</button>' : ''}${list.length ? '<button type="button" class="ag-chip" data-ed-go="files">My Files</button><button type="button" class="ag-chip is-primary" data-ed-go="manual">New video</button>' : ''}</div>
      ${edOpenErr ? `<div class="ag-note" style="padding:0 0 10px">${esc(edOpenErr)}</div>` : ''}
      ${list.length ? `<div class="ag-ed-vids">${list.map((v) => `<div class="ag-ed-vid${v.current ? ' is-on' : ''}"><button type="button" class="ag-ed-vid-open" data-ed-open="${esc(v.id)}"><span class="ag-ed-vid-img" style="background-image:url('${esc(v.thumb || '')}')">${v.rendered ? '<i>Rendered</i>' : '<i class="is-draft">Draft</i>'}</span><b>${esc(v.title)}</b><span>${v.scenes} scenes · ${fmtClock(v.duration)} · ${ago(v.savedAt)}</span></button><button type="button" class="ag-ed-vid-x" data-ed-forget="${esc(v.id)}" aria-label="Remove ${esc(v.title)} from this list">×</button></div>`).join('')}</div>`
        : '<div class="ag-empty ag-ed-none"><div class="ag-empty-crew">' + agentSvg('editor') + '</div><h3>No videos to edit yet</h3><p>Every video you make with AI scenes shows up here. Pick one to redraw scenes, change the pacing, add music or restyle captions.</p><div class="ag-chips" style="justify-content:center"><button type="button" class="ag-chip is-primary" data-ed-go="manual">Make a video in Studio</button><button type="button" class="ag-chip" data-ed-go="files">Open My Files</button></div></div>'}
      </div>`
  }

  function editorStudioHtml(st) {
    let proj = (() => { try { return window.fvSceneProject?.() } catch (_) { return null } })()
    const saved = (() => { try { return window.fvEditProjects?.() || [] } catch (_) { return [] } })()
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
      const longer = lengthOptions(lenCap()).filter((o) => !o.locked && o.seconds > curSecs + 20).map((o) => [o.id, o.label])
      const lock = edWhole ? ' disabled' : ''
      if (edPick) {
        body = `<div class="ag-ed-scn">
          <div class="ag-ed-scn-h"><button type="button" class="ag-ed-scn-x" data-ed-unpick aria-label="Close this scene"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button><span><b>Scene ${edSel + 1}</b><small>of ${scenes.length} · ${fmtClock(sc.start)}–${fmtClock(sc.end)}${sc.clip ? ' · animated' : ''}</small></span></div>
          ${sc.image ? `<div class="ag-ed-scn-pic"><img class="ag-ed-scn-img" src="${esc(sc.image)}" alt="Scene ${edSel + 1}"></div>` : ''}
          <div class="ag-ed-scn-line"><small>Narration</small><p>${esc(sc.text)}</p></div>
          <label class="ag-ed-scn-lab" for="ag-ed-prompt">What the scene shows</label>
          <textarea class="ag-ed-scn-text" id="ag-ed-prompt" rows="4" maxlength="600">${esc(edPrompt[sc.i] ?? sc.prompt ?? '')}</textarea>
          <div class="ag-ed-scn-act">
            <button type="button" class="ag-ed-scn-btn is-red" data-ed-redraw${busy ? ' disabled' : ''}>${busy === 'draw' ? 'Drawing…' : 'Redraw scene'}</button>
            ${sc.clip ? `<button type="button" class="ag-ed-scn-btn" data-ed-still${busy ? ' disabled' : ''}>Make it a still</button>` : `<button type="button" class="ag-ed-scn-btn" data-ed-animate${busy ? ' disabled' : ''}>${busy === 'animate' ? 'Animating…' : 'Animate scene'}</button>`}
          </div>
          ${sc.clip ? (sc.move ? `<div class="ag-ed-move-note">Camera move: ${esc({ zoom_in: 'Zoom in', zoom_out: 'Zoom out', pan: 'Pan' }[sc.move] || 'on')}. Make it a still to pick another.</div>` : '') : `<div class="ag-ed-moves">
            <span class="ag-ed-scn-lab">Camera move <i>the picture stays still, the camera moves · same credits as Animate</i></span>
            <div class="ag-ed-seg">${[['zoom_in', 'Zoom in'], ['zoom_out', 'Zoom out'], ['pan', 'Pan']].map(([id, l]) => `<button type="button" data-ed-move="${id}" title="${esc(l)}: preview on hover"${busy ? ' disabled' : ''}>${busy === 'move:' + id ? 'Making…' : l}</button>`).join('')}</div>
          </div>`}
          ${edErr ? `<div class="ag-ed-scn-err">${esc(edErr)}</div>` : ''}
        </div>`
      } else {
        body = `<div class="ag-ed-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3 15 5-5 4 4 3-3 6 6"/></svg><span>Click a scene on the timeline to redraw or animate it.</span></div>
        <div class="ag-ed-grp">
          <div class="ag-ed-grp-row"><span><b>Animate every scene</b><i>${stills ? `${stills} still scene${stills === 1 ? '' : 's'} become moving clips, 3 at a time` : 'Every scene is already animated'}</i></span>
            <button type="button" class="ag-ed-wbtn" data-ed-animall${stills && !edWhole ? '' : ' disabled'}>${edWhole === 'animate' && edAnimAll ? `Animating ${edAnimAll.done}/${edAnimAll.total}` : 'Animate all'}</button></div>
          <div class="ag-ed-grp-row is-col"><span><b>Pacing</b><i>How often the picture changes. The narration stays.</i></span>
            <div class="ag-ed-seg">${SCENE_PACES.map((p) => `<button type="button" class="${pace === p.id ? 'is-on' : ''}" data-ed-pace="${p.id}"${lock}>${esc(p.name)} · ${p.seconds}s</button>`).join('')}</div></div>
          <div class="ag-ed-grp-row is-col"><span><b>Length</b><i>Now ${fmtClock(dur)}. A longer one gets more script, narration and scenes.</i></span>
            ${longer.length ? `<div class="ag-ed-seg">${longer.map(([id, l]) => `<button type="button" data-ed-len="${id}"${lock}>${esc(l)}</button>`).join('')}</div>` : '<i class="ag-ed-wnote">Already at the longest length.</i>'}</div>
          ${edWhole === 'pace' ? '<div class="ag-ed-wnote">Redrawing every scene at the new pace…</div>' : edWhole === 'length' ? '<div class="ag-ed-wnote">Writing a longer script, then new narration and scenes. This takes a few minutes.</div>' : ''}
          ${edWholeMsg ? `<div class="ag-ed-wnote is-err">${esc(edWholeMsg)}</div>` : ''}
        </div>`
      }
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
        ${(proj.voiceovers && proj.voiceovers.length ? proj.voiceovers : [proj.voiceover]).filter(Boolean).map((u, k, all) => audioPlayerHtml(u, { label: all.length > 1 ? `Narration part ${k + 1}` : 'Narration', title: all.length > 1 ? `Part ${k + 1} of ${all.length}` : '' })).join('')}`
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
        ${(() => { const cur = st?.renderUrl || ''; if (edExporting && cur && cur !== edExporting) edExporting = ''; const stuck = st?.crew?.editor?.state === 'stuck'; if (edExporting && stuck) { edErr = st.crew.editor.text || 'The render stopped.'; edExporting = '' } return '' })()}<button type="button" class="ag-ed-export" data-ed-render${edRendering || edExporting ? ' disabled' : ''}>${edRendering ? 'Joining scenes…' : edExporting ? 'Rendering…' : st?.renderUrl ? 'Export new version' : 'Export'}</button>
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
        <label class="ag-ed-zoom"><button type="button" class="ag-ed-zb" data-ed-zoom-out aria-label="Zoom out">−</button><input type="range" min="${ED_MIN_PPS}" max="${ED_MAX_PPS}" step="1" value="${Math.round(ED_PPS)}" data-ed-zoom aria-label="Timeline zoom"><button type="button" class="ag-ed-zb" data-ed-zoom-in aria-label="Zoom in">+</button><button type="button" class="ag-ed-zb is-txt" data-ed-zoom-fit title="Fit the whole video">Fit</button></label></div>
      <div class="ag-ed-tl" data-ed-tl>
        <div class="ag-ed-lanes" data-ed-lanes style="width:${W + 74}px">
          <div class="ag-ed-ruler">${Array.from({ length: Math.ceil(dur / 10) + 1 }, (_, k) => `<span style="left:${74 + k * 10 * ED_PPS}px">${fmtClock(k * 10)}</span>`).join('')}</div>
          <div class="ag-ed-lane"><span class="ag-ed-lab">Scenes</span>
            <div class="ag-ed-strip" role="listbox" aria-label="Scenes">${scenes.map((x, k) => `<button type="button" role="option" aria-selected="${edPick && k === edSel}" class="ag-ed-scene${edPick && k === edSel ? ' is-sel' : ''}${x.clip ? ' is-anim' : ''}" data-ed-scene="${k}" style="width:${Math.max(18, Math.round((x.end - x.start) * ED_PPS) - 2)}px;background-image:url('${esc(x.image || '')}')" title="Scene ${k + 1} · ${fmtClock(x.start)}" aria-label="Scene ${k + 1} at ${fmtClock(x.start)}${x.clip ? ', animated' : ''}">${edBusy[x.i] ? `<span class="ag-ed-busy">${edBusy[x.i] === 'draw' ? 'Drawing' : 'Animating'}</span>` : ''}${k < scenes.length - 1 ? `<span class="ag-ed-grip" data-ed-grip="${k}" role="separator" aria-orientation="vertical" aria-label="Drag to change where scene ${k + 1} ends" tabindex="0"></span>` : ''}</button>`).join('')}</div></div>
          ${phrases.length ? `<div class="ag-ed-lane"><span class="ag-ed-lab">Captions</span><div class="ag-ed-caps">${phrases.map(([a, b, txt]) => `<span style="left:${Math.round(a * ED_PPS)}px;width:${Math.max(6, Math.round((b - a) * ED_PPS) - 2)}px" title="${esc(txt)}">${esc(txt)}</span>`).join('')}</div></div>` : ''}
          <div class="ag-ed-lane"><span class="ag-ed-lab">Voice</span><canvas class="ag-ed-wave" data-ed-wave width="${Math.min(W, 16000)}" height="34" style="width:${W}px"></canvas></div>
          <div class="ag-ed-lane"><span class="ag-ed-lab">Music</span><div class="ag-ed-music-bar${music && music.id !== 'none' ? '' : ' is-off'}" style="width:${W}px" data-ed-tab-go="music">${music && music.id !== 'none' ? `♪ ${esc(music.name)} · ${Math.round((proj.musicVol ?? 0.25) * 100)}%` : '+ Add music'}</div></div>
          <div class="ag-ed-ph" data-ed-ph style="left:${74 + Math.round(t * ED_PPS)}px"></div>
        </div>
      </div>
    </div>`
  }

  // Waveform peaks per narration (100 bins a second), decoded once from the audio itself.
  const edPeaks = {}
  const ED_BINS = 100
  function edLoadPeaks(proj) {
    const vo = (proj.voiceovers && proj.voiceovers.length ? proj.voiceovers : [proj.voiceover]).filter(Boolean)
    const key = vo.join('|')
    if (!key || edPeaks[key]) return key ? edPeaks[key] : null
    edPeaks[key] = { state: 'loading' }
    ;(async () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        const ctx = new AC()
        const parts = []
        for (const u of vo) {
          const res = await fetch(u)
          if (!res.ok) throw new Error('audio ' + res.status)
          parts.push(await ctx.decodeAudioData(await res.arrayBuffer()))
        }
        try { ctx.close() } catch (_) {}
        const total = parts.reduce((n, buf) => n + buf.duration, 0)
        const peaks = new Float32Array(Math.ceil(total * ED_BINS) + 1)
        let off = 0
        for (const buf of parts) {
          const ch = buf.getChannelData(0)
          const per = buf.sampleRate / ED_BINS
          for (let i = 0; i * per < ch.length; i++) {
            let m = 0
            const s0 = Math.floor(i * per), s1 = Math.min(ch.length, Math.floor((i + 1) * per))
            for (let s = s0; s < s1; s += 4) { const v = Math.abs(ch[s]); if (v > m) m = v }
            peaks[off + i] = m
          }
          off += Math.round(buf.duration * ED_BINS)
        }
        let top = 0
        for (const v of peaks) if (v > top) top = v
        if (top > 0) for (let i = 0; i < peaks.length; i++) peaks[i] = Math.min(1, peaks[i] / top)
        edPeaks[key] = { state: 'ready', peaks }
      } catch (_) {
        edPeaks[key] = { state: 'fallback' }
      }
      if (studio === 'editor') { const pr = (() => { try { return window.fvSceneProject?.() } catch (_) { return null } })(); if (pr) edDrawWave(pr) }
    })()
    return edPeaks[key]
  }
  /** A word-based envelope when the audio can't be read: smooth hills per word, quiet between words. */
  function edEnvelope(proj, t) {
    const words = proj.words || []
    let lo = 0, hi = words.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const [a, b, w] = words[mid]
      if (t < a) hi = mid - 1
      else if (t > b) lo = mid + 1
      else {
        const f = (t - a) / Math.max(0.05, b - a)
        const syl = Math.max(1, Math.round(String(w).length / 3))
        return (0.35 + 0.45 * Math.min(1, String(w).length / 8)) * (0.55 + 0.45 * Math.abs(Math.sin(f * Math.PI * syl))) * Math.sin(f * Math.PI) ** 0.35
      }
    }
    return 0.03
  }
  function edDrawWave(proj) {
    const cv = root.querySelector('[data-ed-wave]')
    if (!cv) return
    const ctx = cv.getContext('2d')
    const W = cv.width, H = cv.height, mid = H / 2
    ctx.clearRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#ff8a9a')
    grad.addColorStop(0.5, '#ff2d48')
    grad.addColorStop(1, '#ff8a9a')
    ctx.fillStyle = grad
    const pk = edLoadPeaks(proj)
    const peaks = pk?.state === 'ready' ? pk.peaks : null
    // A mirrored waveform, one column per pixel, like an audio editor.
    // Browsers cap canvas width, so a very wide timeline draws fewer columns and is stretched to fit.
    const cssW = parseFloat(cv.style.width) || W
    const sps = cssW / W / ED_PPS // seconds per canvas column
    for (let x = 0; x < W; x++) {
      const t0 = x * sps, t1 = (x + 1) * sps
      let amp = 0
      if (peaks) {
        const i0 = Math.floor(t0 * ED_BINS), i1 = Math.max(i0 + 1, Math.floor(t1 * ED_BINS))
        for (let i = i0; i < i1 && i < peaks.length; i++) if (peaks[i] > amp) amp = peaks[i]
      } else amp = edEnvelope(proj, (t0 + t1) / 2)
      const h = Math.max(1, amp * (H - 4))
      ctx.fillRect(x, mid - h / 2, 1, h)
    }
    ctx.fillStyle = 'rgba(255,45,72,.35)'
    ctx.fillRect(0, mid - 0.5, W, 1)
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
    const vo = (proj.voiceovers && proj.voiceovers.length ? proj.voiceovers : [proj.voiceover]).filter(Boolean)
    const voKey = vo.join('|')
    if (vo.length && (!edAudio || edAudio.dataset.src !== voKey)) {
      try { edAudio?.pause() } catch (_) {}
      if (vo.length > 1) edAudio = edNarration(vo, proj.duration)
      else { edAudio = new Audio(vo[0]); edAudio.dataset.src = voKey; edAudio.preload = 'metadata' }
      edAudio.onloadedmetadata = () => { if (edPendingT != null) { try { edAudio.currentTime = edPendingT } catch (_) {} } }
      edSeek(proj.scenes[edSel]?.start || 0)
    }
    const t0 = edAudio && edAudio.readyState >= 1 ? edAudio.currentTime : (edPendingT ?? proj.scenes[edSel]?.start ?? 0)
    edUpdate(proj, t0)
    const tl = root.querySelector('[data-ed-tl]')
    if (tl && !tl.dataset.placed) { tl.dataset.placed = '1'; tl.scrollLeft = Math.max(0, 74 + t0 * ED_PPS - tl.clientWidth / 3) }
    if (edAudio) {
      edAudio.ontimeupdate = () => { if (studio === 'editor' && edAudio.paused) edUpdate(proj, edAudio.currentTime, { scroll: true }) }
      edAudio.onplay = edAudio.onpause = () => { if (studio === 'editor') { const b = root.querySelector('[data-ed-play]'); if (b) b.innerHTML = edAudio.paused ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'; b?.setAttribute('aria-label', edAudio.paused ? 'Play' : 'Pause'); edUpdate(proj, edAudio.currentTime) } }
    }
    root.querySelector('[data-ed-play]')?.addEventListener('click', () => { if (!edAudio) return; if (edAudio.paused) edAudio.play().catch(() => {}); else edAudio.pause() })
    // While playing, move the playhead every frame instead of 4 times a second.
    cancelAnimationFrame(edRaf)
    const follow = () => {
      if (studio !== 'editor' || !edAudio) return
      if (!edAudio.paused && !edDragging) edUpdate(proj, edAudio.currentTime, { scroll: true })
      edRaf = requestAnimationFrame(follow)
    }
    edRaf = requestAnimationFrame(follow)
    // Drag the playhead (or press anywhere on the ruler) to scrub.
    const lanesEl = root.querySelector('[data-ed-lanes]')
    const timeAt = (clientX) => {
      const r = lanesEl.getBoundingClientRect()
      return Math.max(0, Math.min(proj.duration || 0, (clientX - r.left - 74) / ED_PPS))
    }
    const startDrag = (e) => {
      if (!lanesEl || e.button > 0) return
      e.preventDefault()
      const wasPlaying = edAudio && !edAudio.paused
      if (wasPlaying) edAudio.pause()
      edDragging = true
      root.querySelector('[data-ed-ph]')?.classList.add('is-drag')
      let pending = null, raf = 0
      const move = (ev) => {
        pending = timeAt(ev.clientX)
        if (raf) return
        raf = requestAnimationFrame(() => { raf = 0; if (pending != null) { edSeek(pending); edUpdate(proj, pending) } })
      }
      const up = (ev) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        edDragging = false
        root.querySelector('[data-ed-ph]')?.classList.remove('is-drag')
        const v = timeAt(ev.clientX)
        edSeek(v); edUpdate(proj, v)
        if (wasPlaying) edAudio.play().catch(() => {})
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      move(e)
    }
    root.querySelector('[data-ed-ph]')?.addEventListener('pointerdown', startDrag)
    root.querySelector('.ag-ed-ruler')?.addEventListener('pointerdown', startDrag)
    root.querySelector('[data-ed-seek]')?.addEventListener('input', (e) => { const v = Number(e.target.value) || 0; edSeek(v); edUpdate(proj, v) })
    root.querySelectorAll('[data-ed-tab]').forEach((b) => b.addEventListener('click', () => { edTab = b.dataset.edTab; edErr = ''; render() }))
    root.querySelector('[data-ed-tab-go]')?.addEventListener('click', (e) => { edTab = e.currentTarget.dataset.edTabGo; render() })
    root.querySelector('[data-ed-files]')?.addEventListener('click', () => { if (edHosted) { edPicker = true; edOpenErr = ''; return render() } try { window.switchPanel('files', document.getElementById('nav-files')) } catch (_) {} })
    // Zoom keeps a point in time under the same spot on screen: the open scene, the playhead, or the pointer.
    const zoomTo = (pps, atT, atX) => {
      const tl = root.querySelector('[data-ed-tl]')
      const nx = Math.max(ED_MIN_PPS, Math.min(ED_MAX_PPS, pps))
      if (Math.abs(nx - ED_PPS) < 0.01) return
      const screenX = atX ?? (tl ? tl.clientWidth / 2 : 0)
      ED_PPS = nx
      render()
      const tl2 = root.querySelector('[data-ed-tl]')
      if (tl2) { tl2.dataset.placed = '1'; tl2.scrollLeft = Math.max(0, 74 + atT * ED_PPS - screenX) }
    }
    const focusT = () => edPick && proj.scenes[edSel] ? (proj.scenes[edSel].start + proj.scenes[edSel].end) / 2 : (edAudio ? edAudio.currentTime : 0)
    root.querySelector('[data-ed-zoom]')?.addEventListener('input', (e) => zoomTo(Number(e.target.value) || 14, focusT()))
    root.querySelector('[data-ed-zoom-in]')?.addEventListener('click', () => zoomTo(ED_PPS * 1.5, focusT()))
    root.querySelector('[data-ed-zoom-out]')?.addEventListener('click', () => zoomTo(ED_PPS / 1.5, focusT()))
    root.querySelector('[data-ed-zoom-fit]')?.addEventListener('click', () => {
      const tl = root.querySelector('[data-ed-tl]')
      zoomTo(tl ? (tl.clientWidth - 100) / Math.max(1, proj.duration || 1) : 14, 0, 0)
    })
    const tlEl = root.querySelector('[data-ed-tl]')
    tlEl?.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return // plain scroll still scrolls; pinch or ⌘ + scroll zooms
      e.preventDefault()
      const r = tlEl.getBoundingClientRect()
      const sx = e.clientX - r.left
      const atT = Math.max(0, (tlEl.scrollLeft + sx - 74) / ED_PPS)
      zoomTo(ED_PPS * Math.exp(-e.deltaY * 0.01), atT, sx)
    }, { passive: false })
    root.querySelectorAll('[data-ed-scene]').forEach((b) => b.addEventListener('dblclick', () => {
      const x = proj.scenes[Number(b.dataset.edScene) || 0]
      const tl = root.querySelector('[data-ed-tl]')
      if (!x || !tl) return
      zoomTo((tl.clientWidth * 0.5) / Math.max(0.5, x.end - x.start), (x.start + x.end) / 2)
    }))
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
      const k = Number(b.dataset.edScene) || 0
      edErr = ''
      if (edPick && k === edSel) { edPick = false; return render() }
      edSel = k
      edPick = true
      edTab = 'scenes'
      edSeek(proj.scenes[edSel].start)
      render()
    }))
    root.querySelector('[data-ed-unpick]')?.addEventListener('click', () => { edPick = false; edErr = ''; render() })
    if (!edEscBound) {
      edEscBound = true
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !edPick || studio !== 'editor' || stylePop) return
        if (e.target?.closest?.('textarea,input')) return
        edPick = false; render()
      })
    }
    root.querySelector('#ag-ed-prompt')?.addEventListener('input', (e) => { edPrompt[proj.scenes[edSel].i] = e.target.value })
    // Drag a scene's right edge to move the cut between it and the next scene (the narration length stays).
    root.querySelectorAll('[data-ed-grip]').forEach((g) => {
      const k = Number(g.dataset.edGrip)
      const stop = (e) => { e.stopPropagation(); e.preventDefault() }
      g.addEventListener('click', stop)
      g.addEventListener('pointerdown', (e) => {
        stop(e)
        const a = proj.scenes[k]
        const b = proj.scenes[k + 1]
        const elA = root.querySelector(`[data-ed-scene="${k}"]`)
        const elB = root.querySelector(`[data-ed-scene="${k + 1}"]`)
        const x0 = e.clientX
        let v = a.end
        const tip = document.createElement('span')
        tip.className = 'ag-ed-tip'
        g.appendChild(tip)
        g.setPointerCapture(e.pointerId)
        g.classList.add('is-drag')
        const move = (ev) => {
          v = Math.max(a.start + 1, Math.min(b.end - 1, a.end + (ev.clientX - x0) / ED_PPS))
          v = Math.round(v * 10) / 10
          if (elA) elA.style.width = Math.max(18, Math.round((v - a.start) * ED_PPS) - 2) + 'px'
          if (elB) elB.style.width = Math.max(18, Math.round((b.end - v) * ED_PPS) - 2) + 'px'
          tip.textContent = `${(v - a.start).toFixed(1)}s · ${(b.end - v).toFixed(1)}s`
        }
        const up = () => {
          g.removeEventListener('pointermove', move)
          g.classList.remove('is-drag')
          tip.remove()
          if (Math.abs(v - a.end) >= 0.05) window.fvMoveSceneCut?.(a.i, v)
          render()
        }
        g.addEventListener('pointermove', move)
        g.addEventListener('pointerup', up, { once: true })
        g.addEventListener('pointercancel', up, { once: true })
      })
      // Keyboard: arrow keys move the cut by a quarter second.
      g.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        window.fvMoveSceneCut?.(proj.scenes[k].i, proj.scenes[k].end + (e.key === 'ArrowRight' ? 0.25 : -0.25))
        render()
        root.querySelector(`[data-ed-grip="${k}"]`)?.focus()
      })
    })
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
    root.querySelectorAll('[data-ed-move]').forEach((b) => {
      const mv = b.dataset.edMove
      b.addEventListener('click', sceneJob('move:' + mv, (sc) => window.fvAnimateScene(sc.i, mv)))
      // Hovering a move previews it on the scene picture, for free.
      const img = () => root.querySelector('.ag-ed-scn-img')
      b.addEventListener('mouseenter', () => img()?.classList.add('is-prev-' + mv))
      b.addEventListener('mouseleave', () => img()?.classList.remove('is-prev-' + mv))
    })
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
      if (edBusyNote()) { edWholeMsg = edBusyNote(); return render() }
      if (!confirm('Redraw every scene at the new pace? Your scene edits are replaced; the narration stays.')) return
      edWhole = 'pace'; edWholeMsg = ''; render()
      const err = await window.fvRepaceScenes?.(b.dataset.edPace)
      edWhole = ''; edWholeMsg = err || ''; edForget(); render()
    }))
    root.querySelectorAll('[data-ed-len]').forEach((b) => b.addEventListener('click', async () => {
      if (edWhole) return
      if (edBusyNote()) { edWholeMsg = edBusyNote(); return render() }
      if (!confirm(`Make the video ${b.textContent}? This writes more script, records new narration and draws new scenes. The current version stays under My videos.`)) return
      edWhole = 'length'; edWholeMsg = ''; render()
      const err = await window.fvLengthenVideo?.(b.dataset.edLen)
      // Narration and scenes keep going after this returns; the Editor shows progress until the new scenes exist.
      if (err) edWhole = ''
      edWholeMsg = err === 'SIGN_IN' ? 'Sign in to make the video longer.' : (err || '')
      edForget()
      render()
    }))
    root.querySelector('[data-ed-still]')?.addEventListener('click', () => { try { window.fvStillScene(proj.scenes[edSel].i) } catch (_) {} ; render() })
    root.querySelectorAll('[data-ed-cap]').forEach((b) => b.addEventListener('click', () => { window.fvSetCaptionLook?.(b.dataset.edCap); render() }))
    root.querySelectorAll('[data-ed-music]').forEach((b) => b.addEventListener('click', () => { try { window.fvSelectMusic?.(b.dataset.edMusic) } catch (_) {} ; render() }))
    root.querySelector('[data-ed-vol]')?.addEventListener('change', (e) => { window.fvSetSceneMusicVol?.(e.target.value); render() })
    root.querySelector('[data-ed-render]')?.addEventListener('click', async () => {
      if (Object.keys(edBusy).length) { edErr = 'Wait for the scene that is still drawing or animating.'; edTab = 'scenes'; return render() }
      edRendering = true
      try { edAudio?.pause() } catch (_) {}
      render()
      const was = state()?.renderUrl || ''
      const err = await window.fvRenderSceneEdits?.()
      edRendering = false
      if (err) { edErr = err; edTab = 'scenes'; return render() }
      edExporting = was || '-'
      if (!edHosted) {
        selected = 'manager'
        say('manager', 'manager', 'Rendering your edits. The new cut will show up here when the Editor is done.')
        studio = 'progress'
      }
      render()
    })
  }

  function studioHtml(st) {
    if (studio === 'profile' && pw) return profileStudioHtml(st)
    if (studio === 'script') return scriptStudioHtml(st)
    if (studio === 'settings') return settingsStudioHtml(st)
    if (studio === 'progress') return progressStudioHtml(st)
    if (studio === 'editor') return editorStudioHtml(st)
    if (studio === 'review') return reviewHtml(st)
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
      selected = 'manager'
      // Your own script: show its plan and cost first, like a topic. Nothing starts until Approve.
      if (brief.mode === 'own') { studio = ''; return openOwnReview() }
      studio = 'progress'
      const topic = brief.topic.trim()
      say('manager', 'me', topic)
      render()
      brief.topic = ''
      openReview(topic)
  }

  function channelCreated(profile, { niche: n, topic = '', firstTopic = '', script = null } = {}) {
    if (n) { niche = n; try { localStorage.setItem(nicheKey(), JSON.stringify({ id: n.id, name: n.name })) } catch (_) {} }
    // A new channel gets its own chat: the one on screen (about something else) moves to Recents.
    // Not when the setup itself happened in this chat, and not while a video is still being made.
    const live = state()
    if (!setup && !videoBusy(live) && entriesFor('manager', live).some((e) => e.text)) {
      archiveCurrent(live); clearLiveChat(); try { window.fvAgentsReset?.() } catch (_) {}
      viewChat = ''; review = null
    }
    studio = ''
    selected = 'manager'
    visualsView = false
    profileView = ''
    setup = null
    const p = profilesApi.save(profile)
    if (!p) return
    // Its own banner for the Studio header, made in the background.
    try { window.fvEnsureChannelBanner?.(p.id) } catch (_) {}
    endSetup({ genre: profile.genre, about: profile.about, profile: p.name, firstTopic, startedFirst: !!(topic || script) })
    if (script?.text || topic) {
      if (script?.text) { brief = { mode: 'own', topic: '' }; scriptDraft = { title: script.title || '', text: script.text } }
      else brief = { mode: 'write', topic }
      // Every option was picked in the setup steps; episode 1 opens on the review, and starts on Approve.
      // Every option was picked in the setup steps, so episode 1 starts straight away and is made in the chat.
      // The review page only shows when something needs the user (not enough credits).
      if (script?.text) {
        scriptDraft.file = scriptDraft.file || 'Your script'
        say('manager', 'manager', `${p.name} is ready. Making episode 1 from your script now.`)
        openOwnReview()
        return startIfReady()
      }
      say('manager', 'manager', `${p.name} is ready. Making episode 1, “${topic}”, now.`)
      openReview(topic)
      return startIfReady()
    }
    say('manager', 'manager', `${p.name} is ready. From now on just tell me "make a video about …" and the team does the rest.${firstTopic ? ` Want me to make the first episode, “${firstTopic}”, now?` : ''}`, firstTopic ? 'first-episode' : 'ideas', firstTopic ? { topic: firstTopic } : undefined)
    render()
  }
  function channelSkipped() {
    setup = null
    endSetup({ skipped: true })
    say('manager', 'manager', 'No problem. I\'ll use sensible defaults, and you can set up your channel any time under Channels. What should the first video be about?', 'ideas')
    render()
  }
  function skipSetup() {
    say('manager', 'me', 'Skip setup')
    endSetup({ skipped: true })
    say('manager', 'manager', 'No problem. I\'ll use sensible defaults, and you can set everything up any time under Channels. What should the first video be about?', 'ideas')
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
      openReview(topic.length >= 4 ? topic : msg)
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
      return `<div class="ag-genres" role="radiogroup" aria-label="Genre">${GENRES.map((x) => `<button type="button" class="ag-genre${a.genre === x.id ? ' is-on' : ''}" role="radio" aria-checked="${a.genre === x.id}" data-su-genre="${esc(x.id)}"><img src="https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/img/genres/${esc(x.id)}.jpg" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>
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
      return `<div class="ag-card-label">Length</div><div class="ag-chips">${lenButtons('data-su-len', len)}</div>
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
        <h3>${profiles.list.some((p) => p.id === d.id) ? 'Edit channel' : 'New channel'}</h3>
        <p>Save how this channel's videos are made. Picking the profile sets all of it at once.</p>
        <form class="ag-form" data-ag-profile-form>
          <label>Name<input id="ag-pf-name" maxlength="40" value="${esc(d.name)}" autocomplete="off"></label>
          <div class="ag-field"><span class="ag-card-label">Niche</span><div class="ag-chips">${NICHES.map((n) => chip('data-pf-niche', n.id, d.niche === n.id, n.name)).join('')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Narrator voice</span>${(st?.voices || []).length ? `<select id="ag-pf-voice"><option value="">Default voice</option>${st.voices.map((v) => `<option value="${esc(v.id)}"${v.id === d.voiceId ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select>` : '<div class="ag-note" style="padding:0">Voices load once you sign in; the profile keeps the default voice until then.</div>'}</div>
          <div class="ag-field"><span class="ag-card-label">Captions</span><div class="ag-chips">${Object.entries(LOOK_NAMES).map(([id, nm]) => chip('data-pf-cap', id, d.captions === id, nm)).join('')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Length</span><div class="ag-chips">${lenButtons('data-pf-len', d.durationId)}</div></div>
          <div class="ag-field"><span class="ag-card-label">Frame</span><div class="ag-chips">${chip('data-pf-aspect', '16:9', d.aspect === '16:9', '16:9 YouTube')}${chip('data-pf-aspect', '9:16', d.aspect === '9:16', '9:16 Shorts')}</div></div>
          <div class="ag-field"><span class="ag-card-label">Visuals</span><div class="ag-chips"><span class="ag-chip is-on">${esc(visualsLabel({ style: d.visualStyle, mode: d.visualMode, pace: d.scenePace, characterUrl: d.characterUrl }))}</span><button type="button" class="ag-chip" data-pf-vis-current>Use current visuals</button></div></div>
          <div class="ag-field"><span class="ag-card-label">Script angle</span><div class="ag-chips">${ANGLES.map((a) => chip('data-pf-angle', a.id, d.angle === a.id, a.name)).join('')}</div></div>
          <div class="ag-chips"><button type="submit" class="ag-chip is-primary">Save and use</button><button type="button" class="ag-chip" data-ag-profiles>Cancel</button></div>
        </form>
      </div>`
    }
    return `<div class="ag-profiles">
      <h3>Channels</h3>
      <p>One profile per channel: its niche, voice, captions, length, frame and script angle. Pick one and every new video uses it.</p>
      <div class="ag-profile-list">${profiles.list.map((p) => `
        <div class="ag-profile-card${p.id === profiles.active ? ' is-on' : ''}">
          <div><b>${esc(p.name)}</b>${p.id === profiles.active ? '<span class="ag-pay is-high">In use</span>' : ''}</div>
          <span>${esc(profileSummary(p, st) || 'Default settings')}</span>
          <div class="ag-chips">${p.id === profiles.active ? '' : `<button type="button" class="ag-chip is-primary" data-pf-use="${esc(p.id)}">Use</button>`}<button type="button" class="ag-chip" data-pf-edit="${esc(p.id)}">Edit</button><button type="button" class="ag-chip" data-pf-del="${esc(p.id)}">Delete</button></div>
        </div>`).join('') || '<div class="ag-note">No channels yet.</div>'}</div>
      <div class="ag-chips"><button type="button" class="ag-chip is-primary" data-pf-new>New channel</button><button type="button" class="ag-chip" data-ag-profiles-close>Back to chat</button></div>
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
        html += `<div class="ag-msg from-me">${meImages(e.images)}${e.text ? `<div class="ag-bubble">${esc(e.text)}</div>` : ''}</div>`
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
      if (e.kind === 'own-review' && last && scriptDraft.text && !st?.script) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-own-review>Review episode 1</button></div>`
      if (e.kind === 'upgrade' && last) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-upgrade>See plans</button><button type="button" class="ag-chip" data-ag-profiles>Channels</button></div>`
      // A step stopped: say it plainly (the line above does) and offer to try again.
      if (e.type === 'log' && e.agent === 'manager' && e.kind === 'stuck' && last && st?.failed && !st?.running) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-retry-failed>Try again</button>${st.failed.stage === 'script' ? '<button type="button" class="ag-chip" data-ag-len-pop>Make it shorter</button>' : ''}</div>`
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
      const file = (String(pastVideo.title || 'tubeops-video').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'tubeops-video') + '.mp4'
      html += `<div class="ag-msg" data-ag-delivery><div class="ag-who">${agentSvg('editor')}<b>Editor</b><span>${pastVideo.fromChat ? 'Your video' : 'Your last video'}</span></div><div class="ag-card">
        ${pastVideo.fromChat ? '' : '<div class="ag-card-label">From My Files</div>'}
        <video controls playsinline preload="metadata" src="${esc(pastVideo.url)}"></video>
        ${pastVideo.title ? `<div class="ag-card-title">${esc(pastVideo.title)}</div>` : ''}
        ${pastVideo.thumb ? `<a class="ag-dv-thumb-img" href="${esc(pastVideo.thumb)}" target="_blank" rel="noopener" style="width:min(440px,100%)"><img src="${esc(pastVideo.thumb)}" alt="Thumbnail"></a>` : ''}
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

  /** The longest video this plan makes, in seconds (Infinity when there is no cap). */
  const lenCap = () => { try { const c = Number(window.fvDurationCap?.()); return Number.isFinite(c) && c > 0 ? c : Infinity } catch (_) { return Infinity } }
  /** The length the next run really uses (the plan caps a longer pick), as { id, label, seconds }. */
  function lenNow(st) {
    const secs = Number(st?.durationSeconds) || 0
    if (secs && st?.durationLabel) return { id: st.durationPicked || st.durationId, label: st.durationLabel, seconds: secs }
    return effectiveLength(st?.durationId, lenCap())
  }
  /** Length chips (or menu rows). Lengths above the plan's cap are locked and name the plan that unlocks them. */
  function lenButtons(attr, current, { menu = false } = {}) {
    return lengthOptions(lenCap()).map((o) => {
      if (o.locked) {
        return menu
          ? `<button type="button" role="menuitem" class="is-locked" data-ag-len-locked="${esc(o.unlock)}" title="Needs the ${esc(o.unlock)} plan"><b>${esc(o.label)}</b><span>${esc(o.unlock)} plan</span></button>`
          : `<button type="button" class="ag-chip is-locked" data-ag-len-locked="${esc(o.unlock)}" title="Needs the ${esc(o.unlock)} plan">${esc(o.label)}<span class="ag-lock">${esc(o.unlock)}</span></button>`
      }
      const on = current === o.id
      return menu
        ? `<button type="button" role="menuitemradio" aria-checked="${on}" class="${on ? 'is-on' : ''}" ${attr}="${esc(o.id)}">${esc(o.label)}</button>`
        : `<button type="button" class="ag-chip${on ? ' is-on' : ''}" ${attr}="${esc(o.id)}">${esc(o.label)}</button>`
    }).join('')
  }

  function voiceName(st) {
    const v = (st?.voices || []).find((x) => x.id === st?.voiceId)
    return v ? String(v.label).split(' · ')[0] : ''
  }

  /** What a pasted script will cost, from its length: "About 25 credits · you have 300". */
  function ownCost(seconds) {
    if (!seconds) return { text: '', short: false }
    let c = null
    try { c = window.fvVideoCost?.(seconds) || null } catch (_) {}
    if (!c) return { text: '', short: false }
    const short = !c.unlimited && c.left != null && c.total > c.left
    const have = c.unlimited ? ' · included in your plan' : c.left != null ? ` · you have ${c.left}` : ''
    return { text: `About ${c.total} credits${have}${short ? '. Not enough for this script.' : ''}`, short }
  }

  function ownScriptHtml() {
    const est = scriptEstimate(scriptDraft.text)
    const cost = ownCost(est.words >= 40 ? est.seconds : 0)
    return `<form class="ag-own" data-ag-own-form>
      <div class="ag-own-head"><b>Your script</b><span>${esc(est.label || 'Paste the narration. Blank lines split it into sections; "## Heading" lines name them.')}</span></div>
      <input id="ag-own-title" maxlength="120" placeholder="Working title (optional)" value="${esc(scriptDraft.title)}" autocomplete="off">
      <textarea id="ag-own-text" rows="8" placeholder="Paste your script here">${esc(scriptDraft.text)}</textarea>
      <div class="ag-own-cost${cost.short ? ' is-short' : ''}" data-ag-own-cost${cost.text ? '' : ' hidden'}>${esc(cost.text)}</div>
      <div class="ag-chips"><button type="submit" class="ag-chip is-primary"${est.words < 40 || cost.short ? ' disabled' : ''}>Make the video</button><button type="button" class="ag-chip" data-ag-own-cancel>Cancel</button>${est.words && est.words < 40 ? '<span class="ag-note">At least 40 words.</span>' : ''}</div>
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

  /** The start screen: one big composer in the middle (no thread yet). */
  function heroOn(st) {
    if (selected !== 'manager' || studio || visualsView || profileView || viewChat) return false
    const items = entriesFor('manager', st)
    if (items.length) return false
    if (changingNiche || (!niche && setupDone())) return false
    return true
  }

  /** One line that reminds you what a channel is about: its own description, else niche and look. */
  function channelBlurb(p) {
    const about = String(p?.about || '').trim().replace(/^(a\s+)?channel\s+(about|that|explaining|on|with|for)\s+/i, '')
    if (about) return about.charAt(0).toUpperCase() + about.slice(1)
    const n = nicheById(p?.niche)?.name || (p?.niche ? String(p.niche) : '')
    const s = visualStyleById(p?.visualStyle)?.name || ''
    return [n, s].filter(Boolean).join(' · ')
  }

  /** Nine styles for the Look menu: the current one, then the niche's picks, then the rest. */
  function lookChoices(current) {
    const ids = [...new Set([current, ...stylesForNiche(niche?.id), ...VISUAL_STYLES.map((x) => x.id)])]
    return ids.map((id) => visualStyleById(id)).filter(Boolean).slice(0, 9)
  }

  const PLUS_ICO = {
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    yt: '<svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#ff0033"/><path d="M11 6v8l7-4z" fill="#fff"/></svg>',
    recent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="10" height="10" rx="1.5"/><path d="M3 16h10M8 11v10"/><rect x="15" y="3" width="6" height="6" rx="1.5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    chev: '<svg class="ag-pm-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  }
  /** The + menu: attach a clip, an image or script, a YouTube link, a recent file, and switch tools on or off. */
  function plusMenuHtml(where) {
    if (!plusOpen) return ''
    const tools = (() => { try { return window.fvTools?.() || [] } catch (_) { return [] } })()
    const sub = plusSub === 'recent'
      ? `<div class="ag-pm-sub" role="menu" aria-label="Recent files">${plusRecent === null ? '<div class="ag-pm-note">Loading your files…</div>' : plusRecent.length ? `<div class="ag-pm-grid">${plusRecent.map((f, i) => `<button type="button" class="ag-pm-file" data-ag-pm-recent="${i}" title="${esc(f.name)}">${f.kind === 'video' ? `<video src="${esc(f.url)}#t=0.5" muted preload="metadata"></video><i class="ag-att-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></i>` : `<img src="${esc(f.url)}" alt="" loading="lazy">`}</button>`).join('')}</div>` : '<div class="ag-pm-note">No images or videos in My Files yet.</div>'}</div>`
      : plusSub === 'tools'
        ? `<div class="ag-pm-sub is-tools" role="menu" aria-label="Tools">${tools.map((t) => `<label class="ag-pm-tool"><span><b>${esc(t.name)}</b><small>${esc(t.cost)} · ${esc(t.note)}</small></span><input type="checkbox" data-ag-pm-tool="${esc(t.id)}"${t.on ? ' checked' : ''}><i class="ag-pm-sw" aria-hidden="true"></i></label>`).join('')}</div>`
        : ''
    return `<div class="ag-pm is-${where}" role="menu" aria-label="Add to your message">
      <div class="ag-pm-main">
        <button type="button" class="ag-pm-row" data-ag-pm="video">${PLUS_ICO.video}<span>Attach a video</span><em>New</em></button>
        <button type="button" class="ag-pm-row" data-ag-pm="file">${PLUS_ICO.file}<span>Attach image or file</span></button>
        <div class="ag-pm-sep"></div>
        ${plusYt
          ? `<div class="ag-pm-yt" data-ag-pm-ytform>${PLUS_ICO.yt}<input type="url" id="ag-pm-yt-in" placeholder="Paste a YouTube video or channel link" autocomplete="off"><button type="button" data-ag-pm-ytadd>Add</button></div>${plusErr ? `<div class="ag-pm-err">${esc(plusErr)}</div>` : ''}`
          : `<button type="button" class="ag-pm-row" data-ag-pm="yt"><span class="ag-pm-yt-ico">${PLUS_ICO.yt}</span><span>Add from YouTube</span></button>`}
        <button type="button" class="ag-pm-row${plusSub === 'recent' ? ' is-on' : ''}" data-ag-pm="recent">${PLUS_ICO.recent}<span>Recent files</span>${PLUS_ICO.chev}</button>
        <button type="button" class="ag-pm-row${plusSub === 'tools' ? ' is-on' : ''}" data-ag-pm="tools">${PLUS_ICO.tools}<span>Tools</span>${PLUS_ICO.chev}</button>
        ${where === 'chat' ? `<div class="ag-pm-sep"></div><button type="button" class="ag-pm-row" data-ag-pm="settings">${PLUS_ICO.gear}<span>Video settings</span></button>` : ''}
      </div>${sub}
      <input type="file" hidden accept="video/*" data-ag-pm-video>
      <input type="file" hidden multiple accept="image/*,.txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" data-ag-pm-file>
    </div>`
  }
  /** Ideas for the current channel: what the AI picked for it, then its niche's own ideas. */
  const channelIdeas = () => { const p = activeProfile(); return [...new Set([...(aiTopics[p?.id || '_'] || []), ...(niche?.ideas || [])])] }
  /** Example prompts for the empty box, from this channel (not the generic list once a channel is picked). */
  function heroPrompts() {
    const own = channelIdeas()
    const shown = new Set(ideaPage(own, ideaSeed).slice(0, 4))
    const rest = own.filter((x) => !shown.has(x))
    if (rest.length) return rest.slice(0, 6)
    // Every idea is already a chip below the box: ask instead of repeating one.
    const p = activeProfile()
    if (p) return [`What should the next ${p.name} video be about?`]
    return own.length ? [`What's your next ${niche?.name || ''} video about?`.replace('  ', ' ')] : HERO_PROMPTS
  }
  /** Ask the channel agent for fresh topics that fit this channel, and type the first new one into the box. */
  async function aiPickTopic(opts = {}) {
    if (topicBusy) return
    const p = activeProfile()
    const key = opts.reference ? 'yt:' + (ytChannel?.title || '') : (p?.id || '_')
    const used = [...new Set([...pickedTopics, ...(aiTopics[key] || [])])]
    // The agent's last batch still has topics that weren't used: take the next one straight away.
    const ready = (aiTopics[key] || []).find((t) => !pickedTopics.includes(t))
    if (ready) return typeTopic(ready)
    topicBusy = true
    heroNote = ''
    render()
    const about = String(opts.about || '').trim() || String(p?.about || '').trim() || niche?.name || p?.name || ''
    let out = null
    if (about.length >= 3) {
      try {
        out = await Promise.race([
          window.fvSetupChannel?.({ genre: p?.genre || '', about, niche: niche?.name || '', reference: opts.reference ? opts.reference.slice(0, 8) : used.slice(-8) }),
          new Promise((r) => setTimeout(() => r(null), 25000)),
        ])
      } catch (_) { out = null }
    }
    const seen = new Set(used.map((x) => x.toLowerCase()))
    let fresh = (out?.topics || []).filter((t) => !seen.has(String(t).toLowerCase()))
    if (!fresh.length) {
      // The agent is not reachable: take an idea from this channel's list (or any) that wasn't used yet.
      const own = channelIdeas()
      const pool = (own.length ? own : ideaPage([], 0, 999)).filter((x) => !seen.has(x.toLowerCase()))
      fresh = pool.length ? [pool[Math.floor(Math.random() * Math.min(pool.length, 8))]] : []
    } else {
      aiTopics[key] = [...fresh, ...(aiTopics[key] || [])].slice(0, 12)
    }
    topicBusy = false
    const pick = fresh[0]
    if (!pick) { heroNote = 'Could not pick a topic right now. Try again.'; render(); return }
    typeTopic(pick)
  }
  function typeTopic(pick) {
    pickedTopics.push(pick)
    drafts.manager = ''
    render()
    // Type it in, like the agent is writing it.
    let i = 0
    const step = () => {
      i = Math.min(pick.length, i + 2)
      drafts.manager = pick.slice(0, i)
      const box = root.querySelector('#ag-input')
      if (box) box.value = drafts.manager
      if (i < pick.length) return setTimeout(step, 14)
      if (box) { box.dispatchEvent(new Event('input')); box.focus(); box.setSelectionRange(pick.length, pick.length) }
    }
    step()
  }
  function heroHtml(st) {
    const chev = '<svg class="ag-hero-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>'
    const tall = st?.aspect === '9:16'
    const tab = scriptMode ? 'script' : tall ? 'tall' : 'wide'
    const style = visualStyleById(st?.visual?.style) || visualStyleById(DEFAULT_STYLE)
    const motion = { mode: visualModeById(st?.visual?.mode).id, pace: scenePaceById(st?.visual?.pace).id }
    const motionLabel = { cheapest: 'Still', balanced: 'Some motion', cinematic: 'All motion' }[motion.mode] + (motion.pace === 'rapid' ? ' · Rapid' : '')
    const lenLabel = lenNow(st).label
    const angle = ANGLES.find((x) => x.id === (st?.angle || 'auto')) || ANGLES[0]
    const voice = voiceName(st)
    const ch = activeProfile()
    const menu = !heroMenu ? '' : heroMenu === 'len'
      ? `<div class="ag-hero-menu is-right" role="menu">${lenButtons('data-ag-len', lenNow(st).id, { menu: true })}</div>`
      : heroMenu === 'angle'
        ? `<div class="ag-hero-menu is-right is-wide" role="menu">${ANGLES.map((x) => `<button type="button" role="menuitemradio" aria-checked="${angle.id === x.id}" class="${angle.id === x.id ? 'is-on' : ''}" data-ag-angle="${esc(x.id)}"><b>${esc(x.name)}</b>${x.blurb ? `<span>${esc(x.blurb)}</span>` : ''}</button>`).join('')}</div>`
        : heroMenu === 'channel'
          ? `<div class="ag-hero-menu is-left is-wide" role="menu">${profiles.list.map((p, i) => `<button type="button" role="menuitemradio" aria-checked="${p.id === profiles.active}" class="ag-hero-chrow${p.id === profiles.active ? ' is-on' : ''}" data-ag-hero-ch="${esc(p.id)}"><span class="ag-ava">${agentSvg('manager', '', mgrColor(p, i))}</span><span class="ag-chrow-t"><b>${esc(p.name)}</b>${channelBlurb(p) ? `<small>${esc(channelBlurb(p))}</small>` : ''}</span></button>`).join('') || '<div class="ag-hero-menu-note">No channels yet.</div>'}
            <div class="ag-hero-menu-sep"></div>
            ${profiles.list.length < maxChannels() ? '<button type="button" data-ag-ch-add><b>+ New channel</b></button>' : ''}
            ${profiles.list.length ? '<button type="button" data-ag-profiles><b>Manage channels</b></button>' : ''}</div>`
          : heroMenu === 'format'
            ? `<div class="ag-hero-menu is-left is-wide" role="menu">${[['wide', 'Long-form', '16:9 for YouTube videos'], ['tall', 'Vertical', '9:16 for Shorts, Reels and TikTok']].map(([id, name, note]) => `<button type="button" role="menuitemradio" aria-checked="${tab === id}" class="${tab === id ? 'is-on' : ''}" data-ag-hero-tab="${id}"><b>${name}</b><span>${note}</span></button>`).join('')}</div>`
          : heroMenu === 'motion'
            ? `<div class="ag-hero-menu is-left is-wide is-motion" role="menu"><div class="ag-hero-menu-h">Animation</div>${VISUAL_MODES.map((m) => `<button type="button" role="menuitemradio" aria-checked="${m.id === motion.mode}" class="${m.id === motion.mode ? 'is-on' : ''}" data-ag-hero-mode="${esc(m.id)}"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></button>`).join('')}
              <div class="ag-hero-menu-sep"></div><div class="ag-hero-menu-h">Scene pace</div>${SCENE_PACES.map((x) => `<button type="button" role="menuitemradio" aria-checked="${x.id === motion.pace}" class="${x.id === motion.pace ? 'is-on' : ''}" data-ag-hero-pace="${esc(x.id)}"><b>${esc(x.name)}</b><span>A new scene every ${x.seconds}s</span></button>`).join('')}</div>`
          : heroMenu === 'look'
            ? `<div class="ag-hero-menu is-left is-looks" role="menu"><div class="ag-hero-looks">${lookChoices(style.id).map((x) => `<button type="button" role="menuitemradio" aria-checked="${x.id === style.id}" class="${x.id === style.id ? 'is-on' : ''}" data-ag-hero-style="${esc(x.id)}"><img src="${esc(styleSample(x.id, niche?.id))}" alt="" loading="lazy"><span>${esc(x.name)}</span></button>`).join('')}</div>
              <div class="ag-hero-alls"><button type="button" class="ag-hero-all" data-ag-style-pop>Browse all ${VISUAL_STYLES.length} styles →</button><button type="button" class="ag-hero-all" data-ag-char-pop>${st?.visual?.characterUrl ? 'Character: on' : '+ Consistent character'}</button></div></div>`
            : `<div class="ag-hero-menu is-left is-voices">${voiceListHtml(st)}</div>`
    const ideas = ideaPage(channelIdeas(), ideaSeed)
    const upFile = scriptDraft.file && scriptDraft.text ? scriptDraft.file : ''
    const upEst = upFile ? scriptEstimate(scriptDraft.text) : null
    const upCost = upFile ? ownCost(upEst.words >= 40 ? upEst.seconds : 0) : { text: '' }
    const upChip = upFile ? `<span class="ag-hero-file${upCost.short ? ' is-short' : ''}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg><b>${esc(upFile)}</b><span>${esc(upEst.label || 'empty')}${upCost.text ? ' · ' + esc(upCost.text.replace(/^About /, '')) : ''}</span><button type="button" data-ag-hero-file-clear aria-label="Remove script">×</button></span>` : ''
    const body = scriptMode
      ? ownScriptHtml()
      : `<form class="ag-hero-box" data-ag-form>
        <div class="ag-hero-inner">
        <div class="ag-hero-top">
          ${upChip}
          ${attachHtml()}
          <button type="button" class="ag-hero-add${stylePop === 'voice' ? ' is-open' : ''}" data-ag-voice-pop><span aria-hidden="true">+</span>${voice ? 'Voice: ' + esc(voice) : 'Add voiceover'}</button>
          ${upFile ? '' : `<button type="button" class="ag-hero-add ag-hero-ai${topicBusy ? ' is-busy' : ''}" data-ag-ai-topic${topicBusy ? ' disabled' : ''} title="The agent picks a topic that fits ${esc(activeProfile()?.name || 'your channel')}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" opacity=".7"/></svg>${topicBusy ? 'Picking a topic…' : 'Let AI pick a topic'}</button>`}
        </div>
        <label class="sr-only" for="ag-input">What do you want to create?</label>
        <textarea id="ag-input" rows="2" placeholder="${esc(upFile ? 'Title for this video (optional)' : heroPrompts()[0])}"${upFile ? ' data-ag-titlemode' : ''}>${esc(upFile ? (scriptDraft.title || '') : (drafts.manager || ''))}</textarea>
        </div>
        <div class="ag-hero-bar">
          <div class="ag-hero-side">
            <span class="ag-pm-wrap"><button type="button" class="ag-hero-ctl ag-hero-up ag-pm-btn${plusOpen ? ' is-open' : ''}" data-ag-pm-toggle title="Add a video, image, file or YouTube link" aria-label="Add" aria-expanded="${plusOpen}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>${plusMenuHtml('hero')}</span>
            <button type="button" hidden data-ag-hero-upload></button>
            <input type="file" hidden accept=".txt,.md,.markdown,text/plain,text/markdown" data-ag-hero-file>
            <button type="button" class="ag-hero-ctl${heroMenu === 'format' ? ' is-open' : ''}" data-ag-hero-menu="format" title="Video format">${tall ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="3" width="10" height="18" rx="2.5"/></svg>Vertical' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2.5"/></svg>Long-form'}${chev}</button>
            <button type="button" class="ag-hero-ctl${heroMenu === 'channel' ? ' is-open' : ''}" data-ag-hero-menu="channel" title="Channel"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 13c1.2 1.4 2.5 2 4 2s2.8-.6 4-2M9 9h.01M15 9h.01"/></svg>${esc(ch?.name || 'Channel')}${chev}</button>
            <button type="button" class="ag-hero-ctl${heroMenu === 'look' ? ' is-open' : ''}" data-ag-hero-menu="look" title="Visual style: ${esc(style.name)}"><img src="${esc(styleSample(style.id, niche?.id))}" alt="">Look${chev}</button>
            <button type="button" class="ag-hero-ctl${heroMenu === 'motion' ? ' is-open' : ''}" data-ag-hero-menu="motion" title="Animation and pace"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>${esc(motionLabel)}${chev}</button>
          </div>
          <div class="ag-hero-side">
            <button type="button" class="ag-hero-ctl${heroMenu === 'angle' ? ' is-open' : ''}" data-ag-hero-menu="angle" title="Script angle">${esc(angle.id === 'auto' ? 'Auto angle' : angle.name)}${chev}</button>
            <button type="button" class="ag-hero-ctl${heroMenu === 'len' ? ' is-open' : ''}" data-ag-hero-menu="len" title="Length">${esc(lenLabel)}${chev}</button>
            ${(() => { const c = (() => { try { return window.fvVideoCost?.(lenNow(st).seconds) || null } catch (_) { return null } })(); return c && !c.unlimited && c.total ? `<span class="ag-hero-cost" title="${esc(`About ${c.total} credits for this video${c.left != null ? ` · you have ${c.left}` : ''}`)}">${esc(c.total)} cr</span>` : '' })()}
            <button type="submit" class="ag-hero-send" aria-label="Make the video"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
          </div>
        </div>
        ${menu}
      </form>`
    return `<div class="ag-hero">
      <h2 class="ag-hero-title">What do you want to create?</h2>
      ${body}
      ${heroNote ? `<div class="ag-hero-note" role="status">${esc(heroNote)}</div>` : ''}
      ${scriptMode ? '' : `<div class="ag-hero-ideas">
        ${ideas.slice(0, 4).map((x) => `<button type="button" class="ag-hero-idea" data-ag-hero-idea="${esc(x)}" title="${esc(ideaFormat(x))}"><i class="ag-idea-ico" aria-hidden="true">${ideaFormat(x) === 'Documentary' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>'}</i><b>${esc(x)}</b></button>`).join('')}
      </div>
      <button type="button" class="ag-hero-more" data-ag-hero-shuffle><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>More ideas</button>`}
      <div class="ag-hero-foot">
        ${niche ? `<span>Niche: <b>${esc(niche.name)}</b> · <button type="button" data-ag-niche-change>Change</button></span>` : ''}
        ${!profiles.list.length ? '<button type="button" data-su-start>Set up my channel</button>' : ''}
      </div>
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
        <div class="ag-chips">${lenButtons('data-ag-len', lenNow(st).id)}</div>
        <div class="ag-card-label">Frame</div>
        <div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([v, l]) => `<button type="button" class="ag-chip${st?.aspect === v ? ' is-on' : ''}" data-ag-aspect="${v}">${l}</button>`).join('')}</div>
        <div class="ag-card-label">Visuals</div>
        <div class="ag-chips"><span class="ag-chip is-on">${esc(visualsLabel(st?.visual))}</span><button type="button" class="ag-chip" data-ag-visuals>Change</button></div>
        <div class="ag-card-label">Script angle</div>
        <div class="ag-chips">${ANGLES.map((a) => `<button type="button" class="ag-chip${(st?.angle || 'auto') === a.id ? ' is-on' : ''}" data-ag-angle="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div>
        <div class="ag-card-label">Your own script</div>
        <div class="ag-chips"><button type="button" class="ag-chip" data-ag-own>Paste my script</button></div>
        <div class="ag-card-label">Channel</div>
        <div class="ag-chips"><span class="ag-chip is-on">${esc(activeProfile()?.name || 'None')}</span><button type="button" class="ag-chip" data-ag-profiles>${profiles.list.length ? 'Switch or edit' : 'Create one'}</button></div>
        <div class="ag-card-label">Niche</div>
        <div class="ag-chips"><span class="ag-chip is-on">${esc(niche?.name || 'Not set')}</span><button type="button" class="ag-chip" data-ag-niche-change>${niche ? 'Change' : 'Pick a niche'}</button></div>
        <div class="ag-card-label">Narrator voice</div>
        ${voiceListHtml(st)}
      </div>
      ${attachHtml()}
      <form class="ag-compose" data-ag-form>
        ${selected === 'manager' ? `<span class="ag-pm-wrap">${plusMenuHtml('chat')}</span><button type="button" class="ag-plus${plusOpen ? ' is-open' : ''}" data-ag-pm-toggle aria-label="Add" aria-expanded="${plusOpen}"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}
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
    if (chatStoreKey() !== mineFor) { mineFor = chatStoreKey(); mine = loadMine(); savedRun = loadRun(); viewChat = ''; review = null }
    try { window.vidsoNiche = niche?.name || '' } catch (_) {}
    if (edHosted) studio = 'editor'
    // The review comes back once the visuals, profile or niche picker opened from it closes.
    if (review && !studio && !visualsView && !profileView && !changingNiche) studio = 'review'
    let st = state()
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
    const hostOf = { editor: { scenes: 'agent', captions: 'editor', music: 'manager', voice: 'voice' }[edTab], profile: { style: 'agent', voice: 'voice', captions: 'editor', video: 'manager' }[profileTab], script: 'script', settings: 'manager', review: 'manager', progress: progressFrom(st?.crew || {}, { delivered: !!st?.renderUrl }).focus.agent }
    const headAgent = studio ? hostOf[studio] || 'manager' : selected
    keepRun(st)
    restoreRunMedia(st)
    if (runMediaTried && !st?.renderUrl && state()?.renderUrl) st = state()
    { const i = profiles.list.findIndex((p) => p.id === profiles.active); managerTint = i >= 0 ? mgrColor(profiles.list[i], i) : '' }
    const headBtn = studio === 'review' ? '<button type="button" class="ag-pill" data-st-close>Back</button>'
      : studio === 'progress' ? '<button type="button" class="ag-pill" data-st-close>Chat</button>'
      : studio ? '<button type="button" class="ag-pill" data-st-close>Chat</button>'
      // No Progress button: the team's progress shows in the chat. While a video is being made there's nothing here.
      : st?.running && selected === 'manager' ? ''
      : '<button type="button" class="ag-pill" data-ag-new>New video</button>'
    if (edHosted) {
      root.innerHTML = `<div class="ag-app is-ed"><section class="ag-main" aria-label="Editor">
        ${editorStudioHtml(st)}</section></div>`
      bind(st)
      root.querySelectorAll('[data-ed-go]').forEach((b) => b.addEventListener('click', () => { try { window.switchPanel(b.dataset.edGo, document.getElementById('nav-' + b.dataset.edGo)) } catch (_) {} }))
      root.querySelectorAll('[data-ed-open]').forEach((b) => b.addEventListener('click', () => {
        const busy = edBusyNote()
        if (busy) { edOpenErr = busy; return render() }
        const err = window.fvOpenEditProject?.(b.dataset.edOpen) || ''
        edOpenErr = err
        if (!err) { edPicker = false; edForget(); try { edAudio?.pause() } catch (_) {} ; edAudio = null }
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
    root.innerHTML = `<div class="ag-app${sideMin ? ' is-side-min' : ''}${drawer ? ' is-drawer' : ''}">
      <aside class="ag-side" aria-label="Chats"${drawer ? ' role="dialog" aria-modal="true"' : ''}>${sideHtml(st)}</aside>
      ${drawer ? '<div class="ag-drawer-bg" data-ag-drawer-close aria-hidden="true"></div>' : ''}
      <section class="ag-main${!studio && !viewChat && heroOn(st) ? ' is-hero' : ''}" aria-label="${esc(a.name)} chat">
        <div class="ag-mobile-strip">${(profiles.list.length ? profiles.list.slice(0, MAX_CHANNELS).map((p, i) => `<button type="button" class="ag-tile ag-mgr${selected === 'manager' && profiles.active === p.id ? ' is-on' : ''}" data-ag-ch="${esc(p.id)}">${profiles.active === p.id ? ava('manager', videoHere() ? st : null, '', mgrColor(p, i)) : `<span class="ag-ava">${agentSvg('manager', '', mgrColor(p, i))}</span>`}<span>${esc(p.name)}</span></button>`).join('') : `<button type="button" class="ag-tile${selected === 'manager' ? ' is-on' : ''}" data-ag-pick="manager">${ava('manager', st)}<span>Manager</span></button>`)}${profiles.list.length && profiles.list.length < maxChannels() ? `<button type="button" class="ag-tile ag-mgr-add" data-ag-ch-add><span class="ag-mgr-plus" aria-hidden="true">+</span><span>New channel</span></button>` : ''}</div>
        <header class="ag-head"><button type="button" class="ag-chats-btn" data-ag-drawer aria-label="Chats" aria-expanded="${drawer}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Chats</button><span class="ag-head-pill">${agentSvg(headAgent)}${esc(BY_ID[headAgent].name)}${viewChat && chats.find((x) => x.id === viewChat) ? ` <span class="ag-head-ch">· ${esc(chats.find((x) => x.id === viewChat).title)}</span>` : headAgent === 'manager' && activeProfile() ? ` <span class="ag-head-ch">· ${esc(activeProfile().name)}</span>` : ''}</span>
          ${headBtn}</header>
        ${studio ? studioHtml(st) : viewChat && chats.some((x) => x.id === viewChat) ? chatViewHtml() : heroOn(st) ? `<div class="ag-thread is-hero">${heroHtml(st)}</div>` : `<div class="ag-thread" aria-live="polite">${threadHtml(st)}</div>
        <div class="ag-compose-wrap">${composerHtml(st)}</div>`}
      </section>${stylePop ? stylePopHtml(st) : ''}</div>`
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
    placeStylePop()
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
    syncDock()
    announceChats()
    const t2 = root.querySelector('.ag-thread')
    const picker = t2?.querySelector('.ag-niche')
    if (picker) {
      if (!pickerShown) t2.scrollTop = 0
      else t2.scrollTop = pickerScroll
      pickerShown = true
    } else {
      pickerShown = false
      if (t2?.classList.contains('is-hero')) { if (!t2.dataset.top) { t2.scrollTop = 0; t2.dataset.top = '1' } }
      else if (t2 && nearBottom) t2.scrollTop = t2.scrollHeight
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

  /** The progress panel and message box float over the chat: the thread gets room under its last message
   *  equal to their height, so nothing is hidden and messages scroll on behind them. */
  let dockObs = null
  function syncDock() {
    const main = root.querySelector('.ag-main:not(.is-hero)')
    const dock = main?.querySelector(':scope > .ag-compose-wrap')
    if (!main || !dock) return
    const set = () => main.style.setProperty('--ag-dock-h', Math.ceil(dock.getBoundingClientRect().height) + 'px')
    set()
    try {
      if (!dockObs) dockObs = new ResizeObserver((list) => { for (const e of list) { const m = e.target.closest('.ag-main'); if (m) m.style.setProperty('--ag-dock-h', Math.ceil(e.target.getBoundingClientRect().height) + 'px') } })
      dockObs.disconnect()
      dockObs.observe(dock)
    } catch (_) {}
  }

  let chatsTick = 0
  function announceChats() {
    if (chatsTick) return
    chatsTick = requestAnimationFrame(() => { chatsTick = 0; try { window.dispatchEvent(new CustomEvent('vidso:chats')) } catch (_) {} })
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
      return openReview(nv.topic)
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
        stylePop = 'style'
      } else if (a.type === 'change_niche') {
        changingNiche = true
      }
      render()
    }
  }

  /** Show the plan (settings, creative, cost) before anything is generated. */
  function openReview(topic, { fromHero = false, own = false } = {}) {
    const t = String(topic || '').trim()
    if (!t && !own) return render()
    review = { topic: t, tab: 'settings', fromHero, own }
    selected = 'manager'
    visualsView = false
    profileView = ''
    changingNiche = false
    popOpen = false
    heroMenu = ''
    studio = 'review'
    try { window.fvAgentsLoadVoices?.() } catch (_) {}
    render()
  }
  /** Your own script (uploaded or pasted): the same plan and cost screen, with the length taken from the script. */
  function openOwnReview({ fromHero = false } = {}) {
    const est = scriptEstimate(scriptDraft.text)
    if (est.words < 40) { heroNote = 'That script is too short: it needs at least 40 words.'; return render() }
    heroNote = ''
    scriptMode = false
    openReview(scriptDraft.title || '', { fromHero, own: true })
  }

  /** Leave the review without starting: back to the composer with the topic kept. */
  function closeReview() {
    if (review?.own) scriptDraft.title = review.topic
    else if (review?.topic && !entriesFor('manager', state()).length) drafts.manager = review.topic
    review = null
    if (studio === 'review') studio = ''
  }

  async function approveReview() {
    if (!review) return
    const own = !!review.own
    const t = String(review.topic || '').trim()
    if (!t && !own) return
    const st = state()
    // Starting now would stop the video that is still being made: keep the review open and say so.
    if (videoBusy(st)) return render()
    const fromHero = review.fromHero
    review = null
    studio = ''
    drafts.manager = ''
    viewChat = ''
    if (own) { scriptDraft.title = t; return runOwnScript() }
    // A new video on top of a finished one is a new chat; the old one moves to the sidebar.
    const prior = !!(videoHere() && (st?.script || st?.renderUrl))
    if (prior) { archiveCurrent(st); clearLiveChat(); try { window.fvAgentsReset?.() } catch (_) {} }
    if (fromHero || prior) say('manager', 'me', t, '', heroImgs.length ? { images: heroImgs } : undefined)
    heroImgs = []
    render()
    return startVideo(t, state())
  }

  /** Everything was picked in the prompt box, so start right away. The plan page shows only when
   *  something needs the user: not enough credits, or a video is still being made. */
  function startIfReady() {
    if (!review) return
    const st = state()
    const cost = reviewCost(st)
    const short = cost && !cost.unlimited && cost.left != null && cost.total > cost.left
    if (short || videoBusy(st)) return
    approveReview()
  }
  /** Seconds the review is for: the script's own length, or the length the plan really allows. */
  function reviewSeconds(st) {
    return review?.own ? scriptEstimate(scriptDraft.text).seconds : lenNow(st).seconds
  }
  function reviewCost(st) {
    const seconds = reviewSeconds(st) || 600
    try { return window.fvVideoCost?.(seconds) || null } catch (_) { return null }
  }

  function reviewHtml(st) {
    const r = review || { topic: '', tab: 'settings' }
    const own = !!r.own
    const est = own ? scriptEstimate(scriptDraft.text) : null
    const style = visualStyleById(st?.visual?.style) || visualStyleById(DEFAULT_STYLE)
    const lenLabel = own ? formatMinutes(est.seconds) : lenNow(st).label
    const cost = reviewCost(st)
    const short = cost && !cost.unlimited && cost.left != null && cost.total > cost.left
    const busy = videoBusy(st)
    const tabs = [['settings', 'Settings & details'], ['creative', 'Creative setup'], ['cost', 'Cost']]
    const chip = (attr, val, on, label) => `<button type="button" class="ag-chip${on ? ' is-on' : ''}" ${attr}="${esc(val)}">${esc(label)}</button>`
    const looks = (() => { try { return window.fvCaptionLooks?.() || [] } catch (_) { return [] } })()
    const capNow = (() => { try { return window.fvAgentsCaptionLook?.() || st?.captionLook || '' } catch (_) { return '' } })()
    const ch = activeProfile()
    const heading = own ? (r.topic || scriptDraft.file || 'Your script') : r.topic
    const settings = `
      <label class="ag-rv-field"><span>${own ? 'Title (optional)' : 'Video topic'}</span><textarea data-rv-topic rows="2" maxlength="${own ? 120 : 300}"${own ? ' placeholder="The team picks one if you leave this empty"' : ''}>${esc(r.topic)}</textarea></label>
      <div class="ag-rv-field"><span>Channel</span><div class="ag-rv-row"><b>${esc(ch?.name || 'None')}</b><button type="button" class="ag-chip" data-ag-profiles>${profiles.list.length ? 'Switch or edit' : 'Create one'}</button></div></div>
      <div class="ag-rv-two">
        <div class="ag-rv-field"><span>Length</span>${own
          ? `<div class="ag-rv-row"><b>About ${esc(lenLabel)}</b><small>From your script · ${esc(est.words.toLocaleString('en-US'))} words</small></div>`
          : `<div class="ag-chips">${lenButtons('data-ag-len', lenNow(st).id)}</div>`}</div>
        <div class="ag-rv-field"><span>Frame</span><div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Vertical']].map(([v, l]) => chip('data-ag-aspect', v, (st?.aspect || '16:9') === v, l)).join('')}</div></div>
      </div>
      ${own ? '' : `<div class="ag-rv-field"><span>Script angle</span><div class="ag-chips">${ANGLES.map((x) => chip('data-ag-angle', x.id, (st?.angle || 'auto') === x.id, x.name)).join('')}</div></div>`}
      ${niche ? `<div class="ag-rv-field"><span>Niche</span><div class="ag-rv-row"><b>${esc(niche.name)}</b><button type="button" class="ag-chip" data-ag-niche-change>Change</button></div></div>` : ''}`
    const creative = `
      <div class="ag-rv-field"><span>Look</span><div class="ag-rv-look"><img src="${esc(styleSample(style.id, niche?.id))}" alt=""><div><b>${esc(style.name)}</b><small>${esc(visualsLabel(st?.visual || {}))}</small></div><button type="button" class="ag-chip" data-ag-visuals>Change</button></div></div>
      <div class="ag-rv-field"><span>Narrator voice</span>${voiceListHtml(st)}</div>
      ${looks.length ? `<div class="ag-rv-field"><span>Captions</span><div class="ag-chips">${looks.map((l) => `<button type="button" class="ag-chip${capNow === l.id ? ' is-on' : ''}" data-rv-cap="${esc(l.id)}" style="font-family:'${esc(l.font)}',Impact,sans-serif">${esc(l.name)}</button>`).join('')}</div></div>` : ''}`
    const costBody = !cost ? '<div class="ag-note" style="padding:0">The cost shows once you\'re signed in.</div>' : `
      <div class="ag-rv-bill">
        <div><span>Narration, ${esc(lenLabel)}</span><b>${cost.minutes} cr</b></div>
        ${cost.animation ? `<div><span>${cost.animated} animated scene${cost.animated === 1 ? '' : 's'}</span><b>${cost.animation} cr</b></div>` : ''}
        ${cost.character ? `<div><span>Your character in ${cost.scenes} scenes</span><b>${cost.character} cr</b></div>` : ''}
        <div><span>${cost.scenes} AI-drawn scene${cost.scenes === 1 ? '' : 's'}</span><b>Included</b></div>
        <div class="is-total"><span>Estimated total</span><b>${cost.total} credits</b></div>
        ${cost.unlimited ? '<div><span>Your plan</span><b>Unlimited</b></div>' : cost.left != null ? `<div><span>You have</span><b>${cost.left} credits</b></div><div><span>Left after this video</span><b>${Math.max(0, cost.left - cost.total)} credits</b></div>` : ''}
      </div>
      <p class="ag-rv-fine">Credits are charged as the narration is recorded. The final number can move a little with the script's real length.</p>`
    const body = r.tab === 'creative' ? creative : r.tab === 'cost' ? costBody : settings
    const steps = [
      ['script', own ? `Uses your script (${est.words.toLocaleString('en-US')} words)` : `Writes a ${lenLabel} script`],
      ['title', 'Picks the title'],
      ['thumbnail', 'Designs the thumbnail'],
      ['voice', `Records the narration${voiceName(st) ? ' as ' + voiceName(st) : ''}`],
      ['agent', `Draws ${cost?.scenes || 'the'} scenes in ${style.name}`],
      ['editor', 'Adds captions and renders the MP4'],
    ]
    const canGo = own || r.topic.trim()
    return `<div class="ag-studio ag-rv">
      <div class="ag-rv-left">
        <div class="ag-rv-art"><img src="${esc(styleSample(style.id, niche?.id))}" alt=""><i></i></div>
        <h2>${esc(heading)}</h2>
        <p>Review what the team understood, adjust the settings and see the cost before anything is generated.</p>
        <ol class="ag-rv-steps">${steps.map(([id, t]) => `<li>${agentSvg(id)}<span><b>${esc(BY_ID[id]?.name || id)}</b> ${esc(t)}</span></li>`).join('')}</ol>
      </div>
      <div class="ag-rv-panel">
        <div class="ag-rv-tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" aria-selected="${r.tab === id}" class="${r.tab === id ? 'is-on' : ''}" data-rv-tab="${id}">${esc(l)}</button>`).join('')}</div>
        <div class="ag-rv-card">
          <div class="ag-rv-head"><b>${esc(tabs.find(([id]) => id === r.tab)[1])}</b>
            <div class="ag-rv-actions">
              ${cost && !short ? `<span class="ag-rv-price">${cost.unlimited ? 'Included' : cost.total + ' cr'}</span>` : ''}
              ${short ? '<button type="button" class="ag-rv-approve" data-rv-credits>Get more credits</button>' : `<button type="button" class="ag-rv-approve" data-rv-approve${canGo && !busy ? '' : ' disabled'}>Approve and continue</button>`}
            </div>
          </div>
          ${busy ? `<div class="ag-rv-warn" role="status">${esc(BUSY_NOTE)}</div>` : ''}
          ${short ? `<div class="ag-rv-warn">This video needs about ${cost.total} credits and you have ${cost.left}. ${own ? 'Use a shorter script' : 'Pick a shorter length'} or get more credits.</div>` : ''}
          <div class="ag-rv-body">${body}</div>
        </div>
      </div>
    </div>`
  }

  /** Title for the live chat: the video's title, its topic, or the first thing you asked. */
  function liveChatTitle(st, items) {
    const first = (items || []).find((e) => e.type === 'mine' && e.from === 'me')
    return String(st?.script?.title || (videoHere() ? st?.topic : '') || first?.text || 'New chat').slice(0, 90)
  }
  /** Keep the live chat as a past chat (before a new video replaces it). */
  function archiveCurrent(st) {
    const items = entriesFor('manager', st).filter((e) => e.text)
    if (!items.length) return null
    const url = videoHere() ? (/^https?:/.test(String(st?.renderUrl || '')) ? st.renderUrl : (st?.renderSaved || '')) : ''
    const rec = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: liveChatTitle(st, items),
      ch: profiles.active || '',
      at: Date.now(),
      video: url && !String(url).startsWith('blob:') ? url : (pastVideo?.url || ''),
      // The saved video project (script, scenes, narration, thumbnail) so the chat can pick up where it left off.
      editId: videoHere() ? String(st?.editId || '') : '',
      thumb: videoHere() && /^https?:/.test(String(st?.thumb?.url || '')) ? st.thumb.url : (pastVideo?.thumb || ''),
      entries: items.slice(-150).map((e) => ({
        at: e.at,
        who: e.type === 'mine' ? (e.from === 'me' ? 'me' : (e.from || 'manager')) : (e.agent || 'manager'),
        text: String(e.text).slice(0, 2000),
        kind: e.kind || '',
        ...(Array.isArray(e.images) && e.images.length ? { images: e.images.slice(0, 4) } : {}),
      })),
    }
    chats.unshift(rec)
    chats = chats.slice(0, 60)
    saveChats()
    return rec
  }
  /** Start a new chat (the live one is put away). A video still being made stays, with a note. */
  function newChatNow() {
    drawer = false
    const live = state()
    // A new chat would stop the video that is still being made: show it and say so instead.
    if (videoBusy(live)) { review = null; viewChat = ''; studio = ''; selected = 'manager'; busyNote(); return render() }
    review = null
    archiveCurrent(live); clearLiveChat(); window.fvAgentsReset?.()
    viewChat = ''
    selected = 'manager'
    studio = ''
    scriptMode = false
    brief = { mode: 'write', topic: '' }
    render()
    root.querySelector('#ag-input')?.focus()
  }
  /** The chats list for the app sidebar: the live chat (if it has messages) and the past ones. */
  function chatList() {
    if (chatsKey() !== chatsFor) { chatsFor = chatsKey(); chats = loadChats() }
    const st = state()
    const live = entriesFor('manager', st)
    const onAgents = !!root.closest?.('.panel')?.classList.contains('active')
    return {
      live: live.length ? { title: liveChatTitle(st, live), on: onAgents && !viewChat && !studio, busy: !!(videoHere() && st?.running && !st?.renderUrl) } : null,
      past: chats.map((c) => ({ id: c.id, title: c.title, on: onAgents && viewChat === c.id })),
    }
  }
  const goAgents = () => { try { if (!root.closest?.('.panel')?.classList.contains('active')) window.switchPanel?.('agents', document.getElementById('nav-agents')) } catch (_) {} }
  /** Open an old chat as the live one: what's live now is put away, the old chat's messages come back,
   *  and its video (script, scenes, thumbnail, finished cut) is reloaded so you can keep going. */
  function resumeChat(id) {
    const c = chats.find((x) => x.id === id)
    if (!c) return
    const live = state()
    studio = ''
    review = null
    selected = 'manager'
    // A video still being made would be lost: show the old chat read-only until it's done.
    if (videoBusy(live)) { viewChat = id; return render() }
    viewChat = ''
    archiveCurrent(live)
    clearLiveChat()
    try { window.fvAgentsReset?.() } catch (_) {}
    chats = chats.filter((x) => x.id !== id)
    saveChats()
    if (c.ch && c.ch !== profiles.active) { const p = profiles.list.find((x) => x.id === c.ch); if (p) applyProfile(p) }
    const ch = profiles.active || ''
    mine = mine.concat((c.entries || []).map((e) => ({ at: e.at, to: 'manager', from: e.who || 'manager', text: e.text || '', kind: e.kind || '', ch, ...(e.images ? { images: e.images } : {}) })))
    save()
    let back = false
    let editId = c.editId || ''
    if (!editId) {
      const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      try { editId = (window.fvEditProjects?.() || []).find((x) => norm(x.title) && norm(x.title) === norm(c.title))?.id || '' } catch (_) {}
    }
    if (editId) { try { back = !window.fvOpenEditProject?.(editId) } catch (_) { back = false } }
    if (back) markVideo()
    if (!back || !state()?.renderUrl) pastVideo = c.video ? { url: c.video, title: c.title, thumb: c.thumb || '', fromChat: true } : null
    render()
  }
  /** Start an empty live chat on this channel (the old one must already be archived). */
  function clearLiveChat() {
    const ch = profiles.active || ''
    // Messages with no channel showed in this chat too, so they go with it.
    mine = mine.filter((m) => m.ch && m.ch !== ch)
    save()
    savedRun = null
    try { localStorage.removeItem(runKey()) } catch (_) {}
    keptVideo = null
    pastVideo = null
  }

  async function startVideo(msg, st) {
    say('manager', 'manager', `On it. Script is writing a ${st?.durationLabel ? st.durationLabel + ' ' : ''}video on “${msg}”. Title, Thumbnail, Voice, Agent and Editor take it from there, and I'll hand you the finished video right here.`)
    const handoff = mine[mine.length - 1]
    pending = 'Briefing the team…'
    render()
    markVideo()
    // The video ends by teasing the channel's next episode: the next idea that isn't this one.
    try {
      const here = msg.toLowerCase()
      const next = channelIdeas().find((x) => x.toLowerCase() !== here && !pickedTopics.includes(x)) || ''
      window.fvSetNextTopic?.(next)
    } catch (_) {}
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
    const said = String(text || '').trim()
    const refs = readyRefs()
    const vids = readyVideos()
    // A YouTube link attached to the message travels with the words the agents read.
    const msg = said + (said && ytRefs().length && !said.includes('“') ? ytNote() : '')
    if (!said && !refs.length && !vids.length) return
    const st = state()
    drafts[selected] = ''
    const box = root.querySelector('#ag-input')
    if (box) box.value = ''
    if (selected === 'manager' && setup) { if (!msg) return; setupText(msg); return render() }
    const withImgs = refs.length || vids.length ? { images: [...refs, ...vids] } : undefined
    if (attach.length) { applyAttachments(); attach = [] }
    plusOpen = false
    if (selected === 'manager') {
      say('manager', 'me', said, '', withImgs)
      const hasVideo = !!(st?.script)
      if (vids.length) {
        say('manager', 'manager', st?.renderUrl ? 'Your clip now opens the video. The Editor is re-cutting it.' : hasVideo ? 'Your clip will play as the opening scene.' : 'Got your clip. It will play as the opening scene of the next video.')
        if (!said && !refs.length) return render()
      }
      if (refs.length) {
        const aboutScenes = /\b(scenes?|character|look|visuals?|art style|drawings?)\b/i.test(msg) && !/\b(thumbnails?|thumb)\b/i.test(msg)
        if (!hasVideo || aboutScenes) {
          // The image becomes the look every scene follows.
          try { window.fvSetVisual?.({ characterUrl: refs[0], characterDesc: 'The look from your image' }) } catch (_) {}
          if (hasVideo) { say('manager', 'manager', 'Saved your image as the look for the scenes. Redraw a scene in the Editor to use it now; your next video follows it from the start.'); return render() }
          if (!msg) { say('manager', 'manager', 'Got it, every scene will follow the look of your image. What should the video be about?'); return render() }
        } else {
          say('manager', 'manager', st?.thumb?.url && !/\b(new|another|different)\s+(style|thumbnail|design|one)\b/i.test(msg)
            ? 'Passing that to Thumbnail with your image. It\'s editing the current thumbnail now.'
            : 'Passing that to Thumbnail with your image. It\'s designing a new one now.')
          render()
          try { await window.fvThumbSteer?.(msg || 'Use the attached image in the thumbnail', refs) } catch (e) { say('manager', 'manager', e.message || 'Thumbnail could not redo it.', 'stuck') }
          return render()
        }
      }
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
        say('manager', 'manager', st?.thumb?.url && !/\b(new|another|different)\s+(style|thumbnail|design|one)\b/i.test(msg) ? 'Passing that to Thumbnail. It\'s editing the current thumbnail now.' : 'Passing that to Thumbnail. It\'s designing a new one now.')
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
        stylePop = 'style'
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
      return openReview(msg)
    }
    if (selected === 'title' && !msg) return render()
    if (selected === 'title') {
      say('title', 'me', msg)
      render()
      const err = await window.fvTitleSteer?.(msg)
      if (err) say('title', 'title', err, 'stuck')
      render()
      return
    }
    if (selected === 'thumbnail') {
      say('thumbnail', 'me', msg, '', withImgs)
      render()
      try { await window.fvThumbSteer?.(msg || 'Use the attached image in the thumbnail', refs) } catch (e) { say('thumbnail', 'thumbnail', e.message || 'Could not redo the thumbnail', 'stuck') }
      render()
    }
  }

  function bind(st) {
    root.querySelectorAll('[data-ag-pick]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.agPick; popOpen = false; render() }))
    root.querySelectorAll('[data-ag-new]').forEach((b) => b.addEventListener('click', () => newChatNow()))
    root.querySelectorAll('[data-ag-chat]').forEach((b) => b.addEventListener('click', () => { drawer = false; resumeChat(b.dataset.agChat) }))
    root.querySelectorAll('[data-ag-chat-live]').forEach((el) => el.addEventListener('click', () => { drawer = false; viewChat = ''; studio = ''; selected = 'manager'; render() }))
    // Phones: the chats list opens as a drawer; tap outside, the X or Esc closes it.
    root.querySelector('[data-ag-drawer]')?.addEventListener('click', () => { drawer = !drawer; render(); if (drawer) root.querySelector('.ag-side [data-ag-new]')?.focus() })
    root.querySelectorAll('[data-ag-drawer-close]').forEach((b) => b.addEventListener('click', () => { drawer = false; render(); root.querySelector('[data-ag-drawer]')?.focus() }))
    root.querySelector('[data-ag-chat-del]')?.addEventListener('click', () => {
      const c = chats.find((x) => x.id === viewChat)
      if (!c || !confirm(`Delete the chat "${c.title}"? The video stays in My Files.`)) return
      chats = chats.filter((x) => x.id !== viewChat)
      saveChats()
      viewChat = ''
      render()
    })
    root.querySelectorAll('[data-ag-niche]').forEach((b) => b.addEventListener('click', () => { setNiche(nicheById(b.dataset.agNiche)); render() }))
    root.querySelector('[data-ag-niche-own]')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const n = customNiche(root.querySelector('#ag-niche-own')?.value)
      if (n) { setNiche(n); render() }
    })
    root.querySelectorAll('[data-ag-niche-change]').forEach((b) => b.addEventListener('click', () => { changingNiche = true; popOpen = false; selected = 'manager'; if (studio === 'review') studio = ''; render() }))
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
      const cost = ownCost(est.words >= 40 ? est.seconds : 0)
      const line = root.querySelector('[data-ag-own-cost]')
      if (line) { line.textContent = cost.text; line.hidden = !cost.text; line.classList.toggle('is-short', cost.short) }
      const go = root.querySelector('[data-ag-own-form] button[type=submit]')
      if (go) go.disabled = est.words < 40 || cost.short
    })
    ownTitle?.addEventListener('input', () => { scriptDraft.title = ownTitle.value })
    // Your own script goes through the same plan-and-cost screen as a topic; nothing starts until Approve.
    root.querySelector('[data-ag-own-form]')?.addEventListener('submit', (e) => { e.preventDefault(); openOwnReview() })
    bindOwnScriptExtras(st)
  }

  /** Make a video from your own script (pasted, or uploaded in the start composer). */
  async function runOwnScript() {
      const est = scriptEstimate(scriptDraft.text)
      if (est.words < 40) { heroNote = 'That script is too short: it needs at least 40 words.'; return render() }
      const cost = ownCost(est.seconds)
      if (cost.short) { heroNote = cost.text; return render() }
      const st0 = state()
      // Starting now would stop the video that is still being made.
      if (videoBusy(st0)) { busyNote(); return render() }
      heroNote = ''
      scriptMode = false
      viewChat = ''
      if (videoHere() && (st0?.script || st0?.renderUrl)) { archiveCurrent(st0); clearLiveChat(); try { window.fvAgentsReset?.() } catch (_) {} }
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
  }

  function bindOwnScriptExtras(st) {
    root.querySelectorAll('[data-ag-copy-desc]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(st?.publish?.full || ''); b.textContent = 'Copied' } catch (_) {} }))
    root.querySelectorAll('[data-ag-copy-tags]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText((st?.publish?.tags || []).join(', ')); b.textContent = 'Copied' } catch (_) {} }))
    root.querySelectorAll('[data-ag-publish-again]').forEach((b) => b.addEventListener('click', () => window.fvPublishAgain?.()))

    root.querySelectorAll('[data-ag-files]').forEach((b) => b.addEventListener('click', () => { try { window.switchPanel('files', document.getElementById('nav-files')) } catch (_) { location.href = '/files' } }))
    root.querySelectorAll('[data-ag-retry-failed]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true
      pending = 'Trying again…'
      render()
      let err = ''
      try { err = await window.fvRetryFailed?.() } catch (e) { err = e?.message || 'Could not try again.' }
      pending = ''
      if (err === 'SIGN_IN') say('manager', 'manager', 'Sign in and the team will pick this up again.', 'signin')
      else if (err) say('manager', 'manager', err, 'stuck')
      render()
    }))
    root.querySelectorAll('[data-ag-len-pop]').forEach((b) => b.addEventListener('click', () => { popOpen = true; plusOpen = false; render() }))
    root.querySelectorAll('[data-ag-retry-render]').forEach((b) => b.addEventListener('click', () => {
      const err = (window.fvResumeRender || window.fvAgentsRerender)?.()
      if (err) say('manager', 'manager', err, 'stuck')
      render()
    }))
    if (studio === 'editor') edBind(st)
    bindSetup(st)
    root.querySelectorAll('[data-ed-open]').forEach((b) => b.addEventListener('click', () => { studio = 'editor'; edTab = 'scenes'; render() }))
    // studio
    root.querySelectorAll('[data-st-close]').forEach((b) => b.addEventListener('click', () => { if (studio === 'review') closeReview(); studio = ''; selected = 'manager'; render() }))
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
    root.querySelectorAll('[data-ag-visuals], [data-ag-style-pop]').forEach((b) => b.addEventListener('click', () => { heroMenu = ''; stylePop = 'style'; render() }))
    root.querySelectorAll('[data-ag-char-pop]').forEach((b) => b.addEventListener('click', () => { heroMenu = ''; stylePop = 'char'; render() }))
    root.querySelectorAll('[data-ag-voice-pop]').forEach((b) => b.addEventListener('click', () => { heroMenu = ''; stylePop = 'voice'; try { window.fvAgentsLoadVoices?.() } catch (_) {} ; render() }))
    bindStylePop()
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
      const desc = document.getElementById('ag-char-desc')?.value || ''
      charBusy = true; charError = ''; render()
      try { await window.fvCreateCharacter?.(desc) } catch (err) { charError = /live app|not found|405|404/i.test(err?.message || '') ? 'Characters are drawn on the live app, or sign in locally.' : (err?.message || 'Could not draw the character') }
      charBusy = false; render()
    })
    root.querySelector('[data-vs-done]')?.addEventListener('click', () => {
      visualsView = false
      if (visualsReturn) { studio = visualsReturn; visualsReturn = ''; return render() }
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
      if (profiles.active !== p.id) closeReview()
      studio = review ? 'review' : ''; profileView = ''; visualsView = false; selected = 'manager'
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
    root.querySelectorAll('[data-ag-own-review]').forEach((b) => b.addEventListener('click', () => openOwnReview()))
    root.querySelectorAll('[data-ag-upgrade]').forEach((b) => b.addEventListener('click', () => { try { window.openPaywall?.({ force: true, reason: 'upgrade' }) } catch (_) {} }))
    // A length above this plan's cap: show the plans instead of picking it.
    root.querySelectorAll('[data-ag-len-locked]').forEach((b) => b.addEventListener('click', () => { heroMenu = ''; render(); try { window.openPaywall?.({ force: true, reason: 'upgrade' }) } catch (_) {} }))
    root.querySelectorAll('[data-ag-newtopic]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.agNewtopic; say('manager', 'me', 'Yes, start a new video'); openReview(t) }))
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
    const inHero = !!input?.closest('.ag-hero')
    const grow = () => {
      if (!input) return
      if (inHero) { input.style.height = '52px'; input.style.height = Math.min(220, Math.max(52, input.scrollHeight)) + 'px'; return }
      input.style.height = '24px'; input.style.height = Math.min(160, Math.max(24, input.scrollHeight - 16)) + 'px'
    }
    grow()
    input?.addEventListener('input', () => { if (input.hasAttribute('data-ag-titlemode')) scriptDraft.title = input.value; else drafts[selected] = input.value; grow() })
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); form?.requestSubmit() }
    })
    // Paste or drop images into the prompt box: they go with the next message.
    input?.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.items || [])].filter((it) => it.kind === 'file' && /^(image|video)\//.test(it.type)).map((it) => it.getAsFile()).filter(Boolean)
      if (files.length) { e.preventDefault(); addImages(files) }
    })
    const dropZone = input?.closest('.ag-compose')
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); dropZone.classList.add('is-drop') } })
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-drop'))
      dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('is-drop')
        if (e.dataTransfer?.files?.length) { e.preventDefault(); takeFiles(e.dataTransfer.files) }
      })
    }
    root.querySelectorAll('[data-ag-pm-toggle]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation()
      plusOpen = !plusOpen
      plusSub = ''
      plusYt = false
      plusErr = ''
      heroMenu = ''
      popOpen = false
      render()
    }))
    const pm = root.querySelector('.ag-pm')
    if (pm) {
      pm.addEventListener('click', (e) => e.stopPropagation())
      const vIn = pm.querySelector('[data-ag-pm-video]')
      const fIn = pm.querySelector('[data-ag-pm-file]')
      vIn?.addEventListener('change', () => { plusOpen = false; addImages(vIn.files) })
      fIn?.addEventListener('change', () => { plusOpen = false; takeFiles(fIn.files) })
      pm.querySelectorAll('[data-ag-pm]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.agPm
        if (k === 'video') return vIn?.click()
        if (k === 'file') return fIn?.click()
        if (k === 'yt') { plusYt = true; plusSub = ''; plusErr = ''; render(); return root.querySelector('#ag-pm-yt-in')?.focus() }
        if (k === 'settings') { plusOpen = false; popOpen = true; try { window.fvAgentsLoadVoices?.() } catch (_) {} ; return render() }
        if (k === 'recent' || k === 'tools') {
          plusSub = plusSub === k ? '' : k
          if (k === 'recent' && plusRecent === null) {
            Promise.resolve(window.fvRecentFiles?.()).then((list) => { plusRecent = Array.isArray(list) ? list : [] }).catch(() => { plusRecent = [] }).finally(render)
          }
          return render()
        }
      }))
      pm.querySelectorAll('[data-ag-pm-recent]').forEach((b) => b.addEventListener('click', () => {
        const f = plusRecent?.[Number(b.dataset.agPmRecent)]
        if (f) attachExisting(f)
        plusOpen = false
        render()
      }))
      pm.querySelectorAll('[data-ag-pm-tool]').forEach((t) => t.addEventListener('change', () => { try { window.fvSetTool?.(t.dataset.agPmTool, t.checked) } catch (_) {} }))
      const ytIn = pm.querySelector('#ag-pm-yt-in')
      pm.querySelector('[data-ag-pm-ytadd]')?.addEventListener('click', () => addYoutube(ytIn?.value))
      ytIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addYoutube(ytIn.value) } })
    }
    root.querySelectorAll('[data-ag-att-x]').forEach((b) => b.addEventListener('click', () => {
      const a = attach.find((x) => x.id === b.dataset.agAttX)
      if (a?.local) { try { URL.revokeObjectURL(a.local) } catch (_) {} }
      attach = attach.filter((x) => x !== a)
      render()
    }))
    form?.addEventListener('submit', (e) => {
      e.preventDefault()
      popOpen = false
      heroMenu = ''
      // From the start composer a message is a topic: go straight to the plan.
      if (inHero && !setup) {
        // An uploaded script makes this an own-script video; the box holds its title.
        if (scriptDraft.file && scriptDraft.text) { scriptDraft.title = String(input?.value || '').trim(); openOwnReview({ fromHero: true }); return startIfReady() }
        const t = String(input?.value || '').trim()
        if (attach.some((a) => a.status === 'up')) { heroNote = 'Still adding your attachment. One moment.'; return render() }
        if (t) {
          heroNote = ''
          drafts.manager = t
          const refs = readyRefs()
          // An image added to a new video is the look to follow: it's used as the reference in every scene.
          heroImgs = [...refs, ...readyVideos()]
          if (refs.length) { try { window.fvSetVisual?.({ characterUrl: refs[0], characterDesc: 'The look from your image' }) } catch (_) {} }
          applyAttachments()
          const topic = t + (t.includes('“') && ytRefs().length ? '' : ytNote())
          attach = []
          plusOpen = false
          openReview(topic, { fromHero: true }); startIfReady()
        }
        return
      }
      if (attach.some((a) => a.status === 'up')) return
      send(input?.value)
    })
    bindHero()
    bindReview()
    root.querySelectorAll('[data-ag-side-toggle]').forEach((b) => b.addEventListener('click', toggleSide))
  }

  function toggleSide() {
    if (window.appSidebar?.toggle) return window.appSidebar.toggle()
    sideMin = !sideMin
    try { localStorage.setItem('tubeops_agents_side', sideMin ? 'min' : 'full') } catch (_) {}
    // Change the class on the page that is already there, so the width slides instead of jumping.
    const app = root.querySelector('.ag-app')
    if (!app || app.classList.contains('is-ed')) return render()
    app.classList.toggle('is-side-min', sideMin)
    const label = sideMin ? 'Open sidebar' : 'Close sidebar'
    const t = root.querySelector('.ag-side-toggle')
    if (t) { t.setAttribute('aria-expanded', String(!sideMin)); t.setAttribute('aria-label', label); t.title = label + ' (⌘B)' }
  }
  // Esc closes the phone chats drawer.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !drawer || !root.isConnected) return
    drawer = false
    render()
    root.querySelector('[data-ag-drawer]')?.focus()
  })
  // The + menu closes on a click elsewhere or Esc.
  document.addEventListener('click', (e) => {
    if (!plusOpen || !root.isConnected) return
    if (e.target.closest?.('.ag-pm, [data-ag-pm-toggle]')) return
    plusOpen = false; plusSub = ''; plusYt = false
    render()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && plusOpen && root.isConnected) { plusOpen = false; plusSub = ''; plusYt = false; render() } })
  // ⌘B / Ctrl+B toggles the sidebar while the Agents page is open (not while typing).
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'b') return
    if (!root.isConnected || !root.closest('.panel')?.classList.contains('active') || edHosted) return
    const t = e.target
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    e.preventDefault()
    toggleSide()
  })

  function bindReview() {
    root.querySelectorAll('[data-rv-open]').forEach((b) => b.addEventListener('click', () => {
      review = { topic: b.dataset.rvOpen, tab: 'settings' }
      studio = 'review'
      render()
    }))
    const rv = root.querySelector('.ag-rv')
    if (!rv) return
    rv.querySelectorAll('[data-rv-tab]').forEach((b) => b.addEventListener('click', () => { review.tab = b.dataset.rvTab; render() }))
    rv.querySelector('[data-rv-topic]')?.addEventListener('input', (e) => {
      review.topic = e.target.value
      if (review.own) scriptDraft.title = e.target.value
      const h = rv.querySelector('.ag-rv-left h2')
      if (h) h.textContent = e.target.value || (review.own ? scriptDraft.file || 'Your script' : '')
      const go = rv.querySelector('[data-rv-approve]')
      if (go) go.disabled = videoBusy(state()) || (!review.own && !e.target.value.trim())
    })
    rv.querySelector('[data-rv-approve]')?.addEventListener('click', () => approveReview())
    rv.querySelector('[data-rv-credits]')?.addEventListener('click', () => { try { window.openPaywall?.({ force: true, reason: 'credits' }) } catch (_) {} })
    // Captions here are for the next video only: set the look, never re-cut the last video.
    rv.querySelectorAll('[data-rv-cap]').forEach((b) => b.addEventListener('click', () => {
      try { window.fvSetCaptionLook?.(b.dataset.rvCap) } catch (_) {}
      render()
    }))
  }

  /** Put the open dropdown right under the button that opened it, kept inside the prompt box. */
  function placeHeroMenu(hero) {
    const menu = hero.querySelector('.ag-hero-menu')
    const btn = heroMenu && hero.querySelector(`[data-ag-hero-menu="${heroMenu}"]`)
    const box = menu?.offsetParent
    if (!menu || !btn || !box) return
    const b = btn.getBoundingClientRect(), p = box.getBoundingClientRect()
    const w = menu.offsetWidth
    const left = Math.max(6, Math.min(b.left - p.left, p.width - w - 6))
    menu.style.left = left + 'px'
    menu.style.right = 'auto'
    menu.style.top = (b.bottom - p.top + 6) + 'px'
  }
  function bindHero() {
    clearInterval(heroTimer)
    heroTimer = 0
    const hero = root.querySelector('.ag-hero')
    if (!hero) { heroMenu = ''; return }
    placeHeroMenu(hero)
    // Picking a length or angle closes its menu (runs before the item's own handler re-renders).
    hero.addEventListener('click', (e) => {
      if (e.target.closest('.ag-hero-menu [data-ag-len], .ag-hero-menu [data-ag-angle], .ag-hero-menu [data-ag-visuals], .ag-hero-menu [data-ag-style-pop], .ag-hero-menu [data-ag-char-pop], .ag-hero-menu [data-ag-ch-add], .ag-hero-menu [data-ag-profiles]')) heroMenu = ''
      else if (heroMenu && !e.target.closest('.ag-hero-menu, [data-ag-hero-menu]')) { heroMenu = ''; render() }
    }, true)
    hero.querySelectorAll('[data-ag-hero-menu]').forEach((b) => b.addEventListener('click', () => {
      const want = b.dataset.agHeroMenu
      heroMenu = heroMenu === want ? '' : want
      if (heroMenu === 'voice') { try { window.fvAgentsLoadVoices?.() } catch (_) {} }
      render()
    }))
    hero.querySelectorAll('[data-ag-hero-tab]').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.agHeroTab
      heroMenu = ''
      scriptMode = t === 'script'
      if (t !== 'script') { try { window.fvSetAspect?.(t === 'tall' ? '9:16' : '16:9') } catch (_) {} }
      render()
      if (scriptMode) root.querySelector('#ag-own-text')?.focus()
    }))
    hero.querySelector('[data-ag-hero-shuffle]')?.addEventListener('click', () => { ideaSeed++; render() })
    // Your own script: upload a .txt/.md file (or drop it on the box). The box then holds the title.
    const fileIn = hero.querySelector('[data-ag-hero-file]')
    const takeFile = async (file) => {
      if (!file || /^(image|video)\//.test(file.type || '')) return
      await takeScript(file)
      root.querySelector('#ag-input')?.focus()
    }
    hero.querySelector('[data-ag-hero-upload]')?.addEventListener('click', () => fileIn?.click())
    fileIn?.addEventListener('change', () => takeFile(fileIn.files?.[0]))
    hero.querySelector('[data-ag-hero-file-clear]')?.addEventListener('click', () => { scriptDraft = { title: '', text: '' }; heroNote = ''; render() })
    const box = hero.querySelector('.ag-hero-box')
    box?.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); box.classList.add('is-drop') } })
    box?.addEventListener('dragleave', () => box.classList.remove('is-drop'))
    box?.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('is-drop'); takeFiles(e.dataTransfer?.files) })
    hero.querySelectorAll('[data-ag-hero-ch]').forEach((b) => b.addEventListener('click', () => {
      const p = profiles.list.find((x) => x.id === b.dataset.agHeroCh)
      heroMenu = ''
      if (p && p.id !== profiles.active) applyProfile(p)
      render()
    }))
    hero.querySelectorAll('[data-ag-hero-mode]').forEach((b) => b.addEventListener('click', () => { try { window.fvSetVisual?.({ mode: b.dataset.agHeroMode }) } catch (_) {} ; render() }))
    hero.querySelectorAll('[data-ag-hero-pace]').forEach((b) => b.addEventListener('click', () => { try { window.fvSetVisual?.({ pace: b.dataset.agHeroPace }) } catch (_) {} ; render() }))
    hero.querySelectorAll('[data-ag-hero-style]').forEach((b) => b.addEventListener('click', () => {
      heroMenu = ''
      try { window.fvSetVisual?.({ style: b.dataset.agHeroStyle }) } catch (_) {}
      render()
    }))
    hero.querySelector('[data-ag-ai-topic]')?.addEventListener('click', () => aiPickTopic())
    hero.querySelectorAll('[data-ag-hero-idea]').forEach((b) => b.addEventListener('click', () => {
      const input = root.querySelector('#ag-input')
      if (!input) return
      input.value = b.dataset.agHeroIdea
      drafts.manager = input.value
      input.dispatchEvent(new Event('input'))
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }))
    // The empty box cycles through example prompts, like a typed suggestion.
    const input = hero.querySelector('#ag-input')
    if (input) {
      let i = 0
      const list = heroPrompts()
      if (!input.hasAttribute('data-ag-titlemode') && list.length > 1) heroTimer = setInterval(() => {
        if (!input.isConnected) { clearInterval(heroTimer); return }
        if (input.value) return
        i = (i + 1) % list.length
        input.placeholder = list[i]
      }, 3500)
    }
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
    review = null
    viewChat = ''
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
    /** Quietly change a few fields on a saved channel (no chat message, no switch). */
    patch: (id, fields = {}) => {
      if (profilesKey() !== profilesFor) { profilesFor = profilesKey(); profiles = loadProfiles() }
      const i = profiles.list.findIndex((x) => x.id === id)
      if (i < 0) return null
      profiles.list[i] = normalizeProfile({ ...profiles.list[i], ...fields, id })
      saveProfiles()
      return { ...profiles.list[i] }
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
    // Opening the Editor from the menu shows your videos; a video opens only when you pick one.
    // Studio passes a tab when it hands over the video it just made, so that one opens directly.
    if (!edHosted) { edHosted = true; root = el; edPicker = !tab }
    try { window.fvSaveEditProjectNow?.() } catch (_) {}
    if (tab) { edTab = tab; edPicker = false }
    studio = 'editor'
    render()
  }
  function hostChat() {
    try { edAudio?.pause() } catch (_) {}
    try { previewAudio?.pause() } catch (_) {}
    if (!edHosted) return
    edHosted = false
    root.innerHTML = ''
    root = chatRoot
    studio = ''
    render()
  }
  const chatsApi = {
    list: () => chatList(),
    open: (id) => { goAgents(); resumeChat(id) },
    openLive: () => { goAgents(); drawer = false; viewChat = ''; studio = ''; selected = 'manager'; render() },
    newChat: () => { goAgents(); newChatNow() },
  }
  return { chats: chatsApi, hostEditor, hostChat, canAddChannel, channelCap: capInfo, render, select: (id) => { if (BY_ID[id]) { closeReview(); viewChat = ''; studio = ''; selected = id; render() } }, open: openView, profiles: profilesApi, startSetup, setupDone, setupActive: () => !!setup, channelCreated, channelSkipped }
}
