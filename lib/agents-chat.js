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

export const AGENTS = [
  { id: 'manager', name: 'Manager', role: 'Plans the video and runs the team', c: '#7c5cff', bg: '#dcd2ff',
    body: '<circle cx="14" cy="15" r="9"/><circle cx="26" cy="14" r="9"/><circle cx="13" cy="26" r="9"/><circle cx="27" cy="26" r="9"/><circle cx="20" cy="20" r="10"/>', ey: 16 },
  { id: 'script', name: 'Script', role: 'Writes every chapter for watch time', c: '#22b864', bg: '#cdeedb',
    body: '<rect x="7" y="7" width="26" height="26" rx="8" transform="rotate(-12 20 20)"/>', ey: 16 },
  { id: 'title', name: 'Title', role: 'Writes five title options from the script', c: '#0ea5e9', bg: '#cfeafd',
    body: '<path d="M10 9h20a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H20l-7 5v-5h-3a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z" stroke-width="4" stroke-linejoin="round"/>', ey: 14.5 },
  { id: 'thumbnail', name: 'Thumbnail', role: 'Designs the thumbnail that gets the click', c: '#e2b100', bg: '#fff1b8',
    body: '<circle cx="20" cy="10" r="6.5"/><circle cx="29.51" cy="16.91" r="6.5"/><circle cx="25.88" cy="28.09" r="6.5"/><circle cx="14.12" cy="28.09" r="6.5"/><circle cx="10.49" cy="16.91" r="6.5"/><circle cx="20" cy="20" r="10"/>', ey: 16 },
  { id: 'voice', name: 'Voice', role: 'Narrates the script', c: '#ff6a4d', bg: '#ffd8cf',
    body: '<path d="M20 8L34 31H6Z" stroke-width="7" stroke-linejoin="round"/>', ey: 20.5 },
  { id: 'agent', name: 'Agent', role: 'Finds the B-roll for each line', c: '#ff4fa3', bg: '#ffd4e8',
    body: '<circle cx="20" cy="11" r="7"/><circle cx="27.79" cy="15.5" r="7"/><circle cx="27.79" cy="24.5" r="7"/><circle cx="20" cy="29" r="7"/><circle cx="12.21" cy="24.5" r="7"/><circle cx="12.21" cy="15.5" r="7"/><circle cx="20" cy="20" r="10"/>', ey: 16 },
  { id: 'editor', name: 'Editor', role: 'Cuts, captions and renders the MP4', c: '#3b82f6', bg: '#d3e2ff',
    body: '<rect x="4" y="11" width="32" height="20" rx="10" transform="rotate(-8 20 20)"/>', ey: 17.5 },
  { id: 'publish', name: 'Publish', role: 'Writes the description, tags and chapters', c: '#84cc16', bg: '#e4f5c8',
    body: '<rect x="5" y="9" width="30" height="22" rx="7" transform="rotate(6 20 20)"/>', ey: 16.5 },
]
const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]))
const PINNED = ['manager', 'script', 'title']
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
    ['broll', /\b(b-?roll|footage|clips?|visuals?|scenes?)\b/],
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

export function agentSvg(id, cls = '') {
  const a = BY_ID[id] || BY_ID.manager
  return `<svg class="ag-blob ${cls}" viewBox="0 0 40 40" aria-hidden="true"><g class="body" fill="${a.c}" stroke="${a.c}">${a.body}</g>` +
    `<g class="eyes"><rect x="15.6" y="${a.ey}" width="3.6" height="7.2" rx="1.8"/><rect x="21.4" y="${a.ey}" width="3.6" height="7.2" rx="1.8"/></g></svg>`
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
  display:grid;grid-template-columns:300px minmax(0,1fr);height:calc(100dvh - 128px);min-height:560px;border-radius:24px;overflow:hidden;
  background:var(--ag-bg);border:1px solid var(--ag-line);color:var(--ag-ink);font-family:Inter,system-ui,-apple-system,sans-serif}
.ag-side{display:flex;flex-direction:column;min-width:0;background:var(--ag-side);border-right:1px solid var(--ag-line);padding:16px 14px 14px}
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
.ag-app .ag-compose textarea:focus,.ag-app .ag-compose textarea:focus-visible{outline:0;box-shadow:none;border:0}
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
@media (prefers-reduced-motion:reduce){.ag-blob .eyes,.ag-ava .ag-blob,.ag-building .ag-blob,.ag-dot{animation:none!important}}
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
    l.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500&display=swap'
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
  let scriptDraft = { title: '', text: '' }
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
    try { if (p.captions) window.fvSetCaptionLook?.(p.captions) } catch (_) {}
    try { window.fvSetDuration?.(p.durationId) } catch (_) {}
    try { window.fvSetAspect?.(p.aspect) } catch (_) {}
    try { window.fvAgentsAngle?.(p.angle) } catch (_) {}
  }
  let previewAudio = null
  let previewSrc = ''

  const save = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(mine.slice(-200))) } catch (_) {} }
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  const say = (to, from, text, kind, extra) => { mine.push({ at: Date.now(), to, from, text: String(text || ''), kind: kind || '', ...(extra || {}) }); save() }

  function lastFor(id, st) {
    const log = (st?.log || []).filter((e) => e.agent === id)
    const own = mine.filter((m) => m.to === id)
    const a = log[log.length - 1]
    const b = own[own.length - 1]
    if (a && (!b || a.at >= b.at)) return a.text
    if (b) return (b.from === 'me' ? 'You: ' : '') + b.text
    return BY_ID[id].role
  }

  function ava(id, st, cls = '') {
    const s = st?.crew?.[id]?.state || 'idle'
    return `<span class="ag-ava" data-state="${esc(s)}">${agentSvg(id, cls)}<i class="ag-dot"></i></span>`
  }

  function sideHtml(st) {
    const user = (() => { try { return getUser?.() } catch (_) { return null } })()
    const name = user?.name || user?.full_name || user?.email || 'You'
    const initials = String(name).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ME'
    return `
      <div class="ag-side-head"><h2>Agents</h2>
        <button type="button" class="ag-icon-btn" data-ag-new aria-label="New video"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      <div class="ag-tiles">${PINNED.map((id) => `<button type="button" class="ag-tile${selected === id ? ' is-on' : ''}" data-ag-pick="${id}" aria-pressed="${selected === id}">${ava(id, st)}<span>${esc(BY_ID[id].name)}</span></button>`).join('')}</div>
      <div class="ag-list">${AGENTS.filter((a) => !PINNED.includes(a.id)).map((a) => `
        <button type="button" class="ag-row${selected === a.id ? ' is-on' : ''}" data-ag-pick="${a.id}" aria-pressed="${selected === a.id}">${ava(a.id, st)}
          <span class="ag-row-txt"><b>${esc(a.name)}</b><span>${esc(lastFor(a.id, st))}</span></span></button>`).join('')}</div>
      <button type="button" class="ag-profile-btn" data-ag-profiles><span class="ag-card-label">Brand profile</span><b>${esc(activeProfile()?.name || 'None yet')}</b><span>${activeProfile() ? 'Switch or edit' : 'Save your channel setup'}</span></button>
      <div class="ag-me"><i>${esc(initials)}</i><span>${esc(String(name).slice(0, 40))}</span></div>`
  }

  // ── threads ────────────────────────────────────────────────────────────
  function entriesFor(id, st) {
    const log = (st?.log || [])
      .filter((e) => id === 'manager' || e.agent === id)
      .filter((e) => !(e.agent === 'manager' && /^Running the whole video$/.test(e.text)))
      .map((e) => ({ ...e, type: 'log' }))
    const own = mine.filter((m) => m.to === id).map((m) => ({ ...m, type: 'mine' }))
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
        <details><summary class="ag-chip" style="list-style:none">Read the script</summary><div class="ag-script">${s.sections.map((x) => `<h4>${esc(x.heading)}</h4><div>${esc(x.text)}</div>`).join('')}</div></details>
        <div class="ag-chips"><button type="button" class="ag-chip" data-ag-wizard>Edit in Long Form Generator</button></div></div>`
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

  function profileSummary(p, st) {
    const v = (st?.voices || []).find((x) => x.id === p.voiceId)
    const len = (LENGTHS.find(([id]) => id === p.durationId) || [])[1] || ''
    return [nicheById(p.niche)?.name || p.niche, v ? v.label.split(' · ')[0] : p.voiceLabel, LOOK_NAMES[p.captions] ? LOOK_NAMES[p.captions] + ' captions' : '', len, p.aspect, p.angle !== 'auto' ? angleById(p.angle).name : ''].filter(Boolean).join(' · ')
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
    if (profileView) return profilesHtml(st)
    if (selected === 'manager' && (changingNiche || (!niche && !items.length))) return nichePickerHtml()
    if (!items.length && selected === 'manager') {
      return `<div class="ag-empty">
        <div class="ag-empty-crew">${AGENTS.map((a) => agentSvg(a.id)).join('')}</div>
        <h3>What should your agents make?</h3>
        <p>Give the Manager a topic. Script, Title, Thumbnail, Voice, Agent and Editor take it from there and hand you a finished video.</p>
        <div class="ag-chips">${ideasNow().map((x) => `<button type="button" class="ag-chip" data-ag-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        ${niche ? `<div class="ag-note">Niche: <b>${esc(niche.name)}</b> · <button type="button" data-ag-niche-change>Change</button></div>` : ''}
      </div>`
    }
    // Attach each artifact to the newest "done" entry of the agent that made it.
    const lastDone = {}
    items.forEach((e, i) => { if (e.type === 'log' && e.kind === 'done') lastDone[e.agent] = i })
    if (st?.renderUrl && selected === 'manager') lastDone.__delivery = items.length - 1
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
      const last = i === items.length - 1
      if (e.kind === 'captions' && last) {
        const looks = (() => { try { return window.fvCaptionLooks?.() || [] } catch (_) { return [] } })()
        html += `<div class="ag-chips">${looks.map((l) => `<button type="button" class="ag-chip" data-ag-cap="${esc(l.id)}" style="font-family:'${esc(l.font)}',Impact,sans-serif;color:${esc(l.color)}">${esc(l.name)}</button>`).join('')}</div>`
      }
      if (e.kind === 'edit-menu' && last) html += `<div class="ag-chips">${['Captions', 'Title', 'Thumbnail', 'Voice', 'Music', 'B-roll'].map((x) => `<button type="button" class="ag-chip" data-ag-say="Change the ${esc(x.toLowerCase())}">${esc(x)}</button>`).join('')}</div>`
      if (e.kind === 'wizard' && last) html += `<div class="ag-chips"><button type="button" class="ag-chip" data-ag-wizard>Open Long Form Generator</button></div>`
      if (e.kind === 'confirm-new' && last) html += `<div class="ag-chips"><button type="button" class="ag-chip is-primary" data-ag-newtopic="${esc(e.topic || '')}">Yes, new video</button><button type="button" class="ag-chip" data-ag-keep>No, keep this one</button></div>`
      if (e.type === 'log' && lastDone[e.agent] === i) {
        const art = selected === 'manager' && e.agent === 'editor' ? '' : artifactFor(e.agent, st)
        if (art) html += art
      }
      if (selected === 'manager' && lastDone.__delivery === i) html += deliveryHtml(st)
      html += '</div>'
      prevWho = who
    })
    const working = selected === 'manager'
      ? Object.entries(crew).filter(([id, c]) => c.state === 'working' && id !== 'manager')
      : (crew[selected]?.state === 'working' ? [[selected, crew[selected]]] : [])
    if (working.length || pending) {
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

  function composerHtml(st) {
    if (scriptMode && selected === 'manager') return ownScriptHtml()
    const a = BY_ID[selected]
    const len = st?.durationLabel || ''
    const steer = STEERABLE.has(selected)
    const placeholder = selected === 'manager' || st?.script ? `Message ${a.name}` : `${a.name} works once the script is written`
    if (!steer) {
      return `<div class="ag-note">${esc(a.name)} takes its brief from the Manager. To change it, message the Manager or <button type="button" data-ag-wizard>open the Long Form Generator</button>.</div>`
    }
    return `
      <div class="ag-pop" data-ag-pop ${popOpen ? '' : 'hidden'}>
        <div class="ag-card-label">Length</div>
        <div class="ag-chips">${LENGTHS.map(([id, label]) => `<button type="button" class="ag-chip${st?.durationId === id ? ' is-on' : ''}" data-ag-len="${id}">${label}</button>`).join('')}</div>
        <div class="ag-card-label">Frame</div>
        <div class="ag-chips">${[['16:9', '16:9 YouTube'], ['9:16', '9:16 Shorts']].map(([v, l]) => `<button type="button" class="ag-chip${st?.aspect === v ? ' is-on' : ''}" data-ag-aspect="${v}">${l}</button>`).join('')}</div>
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
    try { window.vidsoNiche = niche?.name || '' } catch (_) {}
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
    root.innerHTML = `<div class="ag-app">
      <aside class="ag-side" aria-label="Agents">${sideHtml(st)}</aside>
      <section class="ag-main" aria-label="${esc(a.name)} chat">
        <div class="ag-mobile-strip">${AGENTS.map((x) => `<button type="button" class="ag-tile${selected === x.id ? ' is-on' : ''}" data-ag-pick="${x.id}">${ava(x.id, st)}<span>${esc(x.name)}</span></button>`).join('')}</div>
        <header class="ag-head"><span class="ag-head-pill">${agentSvg(selected)}${esc(a.name)}</span>
          <button type="button" class="ag-pill" data-ag-new>New video</button></header>
        <div class="ag-thread" aria-live="polite">${threadHtml(st)}</div>
        <div class="ag-compose-wrap">${composerHtml(st)}</div>
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
      youtubeConnected: st?.youtubeConnected ?? null,
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
        const err = window.fvAgentsRerender?.()
        if (err) say('manager', 'manager', err, 'stuck')
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
    const err = await window.fvAgentsRun?.({ topic: msg })
    pending = ''
    if (err) {
      mine = mine.filter((m) => m !== handoff)
      if (err === 'SIGN_IN') say('manager', 'manager', "You're in preview mode, so I can't make videos yet. Sign in and the team will start on “" + msg + '” right away.', 'signin')
      else say('manager', 'manager', err, 'stuck')
      save()
    }
    render()
  }

  async function send(text) {
    const msg = String(text || '').trim()
    if (!msg) return
    const st = state()
    drafts[selected] = ''
    const box = root.querySelector('#ag-input')
    if (box) box.value = ''
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
        say('manager', 'manager', 'Pick a narrator in the menu below (Narrator voice). A new voice means recording the narration again, which you can do from the Long Form Generator.', 'wizard')
        return render()
      }
      if (route.type === 'music' || route.type === 'broll' || route.type === 'script' || route.type === 'length') {
        const where = {
          music: 'Background music is set in the Preview step of the Long Form Generator; after changing it, render again there.',
          broll: 'B-roll clips can be swapped one by one in the Long Form Generator\'s Media step.',
          script: 'You can edit any section of the script by hand in the Long Form Generator, or ask me for a new video with a sharper angle.',
          length: 'Length is set before the script is written. Pick a new length in the + menu below and send me the topic again to make a new cut.',
        }[route.type]
        if (route.type === 'length') popOpen = true
        say('manager', 'manager', where, route.type === 'length' ? '' : 'wizard')
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
      render()
      root.querySelector('#ag-input')?.focus()
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
      const err = await window.fvAgentsRunScript?.({ text: scriptDraft.text, title: scriptDraft.title })
      if (err) { mine = mine.filter((m) => m !== handoff); save() }
      if (err === 'SIGN_IN') say('manager', 'manager', "You're in preview mode, so I can't make videos yet. Sign in and send the script again.", 'signin')
      else if (err) say('manager', 'manager', err, 'stuck')
      else scriptDraft = { title: '', text: '' }
      render()
    })
    root.querySelectorAll('[data-ag-copy-desc]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(st?.publish?.full || ''); b.textContent = 'Copied' } catch (_) {} }))
    root.querySelectorAll('[data-ag-copy-tags]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText((st?.publish?.tags || []).join(', ')); b.textContent = 'Copied' } catch (_) {} }))
    root.querySelectorAll('[data-ag-publish-again]').forEach((b) => b.addEventListener('click', () => window.fvPublishAgain?.()))
    // brand profiles
    root.querySelectorAll('[data-ag-profiles]').forEach((b) => b.addEventListener('click', () => { profileView = 'list'; profileDraft = null; popOpen = false; render() }))
    root.querySelector('[data-ag-profiles-close]')?.addEventListener('click', () => { profileView = ''; render() })
    root.querySelector('[data-pf-new]')?.addEventListener('click', () => {
      profileDraft = normalizeProfile({ name: niche?.name ? niche.name + ' channel' : 'My channel', niche: niche?.id === 'custom' ? niche.name : (niche?.id || ''), voiceId: st?.voiceId || '', durationId: st?.durationId || 'long_600', aspect: st?.aspect || '16:9', angle: st?.angle || 'auto' })
      profileView = 'edit'; render()
    })
    root.querySelectorAll('[data-pf-edit]').forEach((b) => b.addEventListener('click', () => { profileDraft = { ...profiles.list.find((p) => p.id === b.dataset.pfEdit) }; profileView = 'edit'; render() }))
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
      if (i >= 0) profiles.list[i] = p; else profiles.list.push(p)
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
  return { render, select: (id) => { if (BY_ID[id]) { selected = id; render() } } }
}
