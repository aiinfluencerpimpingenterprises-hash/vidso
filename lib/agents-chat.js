/**
 * Agents workspace: a chat with the crew that makes a long-form video.
 *
 * The Manager takes a topic and runs the whole pipeline (the Long Form
 * Generator's agent mode, driven through window.fvAgents* in the dashboard).
 * Every agent has its own thread: what it did, what it made, and, for Title and
 * Thumbnail, a composer that steers it. Characters match the landing page.
 */

import { PAY, breakoutLabel, customNiche, nicheById, rankedNiches } from './niches.js'

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
]
const BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]))
const PINNED = ['manager', 'script', 'title']
const STEERABLE = new Set(['manager', 'title', 'thumbnail'])
const LENGTHS = [['long_180', '3 min'], ['long_300', '5 min'], ['long_600', '10 min'], ['long_900', '15 min'], ['long_1800', '30 min']]
const IDEAS = [
  'What did ancient humans do for fun?',
  'The rise and fall of Blockbuster',
  'Why almost nobody lives in northern Maine',
  'The psychology of people who never ask for help',
]
const STORE_KEY = 'vidso_agents_chat'

/** "make a new video for my channel" has no subject: the Manager asks for one. */
function isVague(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').trim()
  const filler = /\b(make|create|do|generate|start|build|give|me|us|a|an|another|new|the|my|our|for|on|youtube|yt|channel|video|videos|one|please|pls|can|you|could|i|want|need|some|something|long|form|longform|faceless|good|viral|cool)\b/g
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
  let previewAudio = null
  let previewSrc = ''

  const save = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(mine.slice(-200))) } catch (_) {} }
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  const say = (to, from, text, kind) => { mine.push({ at: Date.now(), to, from, text: String(text || ''), kind: kind || '' }); save() }

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
      <div class="ag-card-label" data-yt-status hidden></div>
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
    if (selected === 'manager' && (!niche || changingNiche) && !items.some((e) => e.type === 'log')) return nichePickerHtml()
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

  function composerHtml(st) {
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

  async function send(text) {
    const msg = String(text || '').trim()
    if (!msg) return
    const st = state()
    drafts[selected] = ''
    const box = root.querySelector('#ag-input')
    if (box) box.value = ''
    if (selected === 'manager') {
      say('manager', 'me', msg)
      if (isVague(msg)) {
        say('manager', 'manager', 'Happy to. What should the video be about? Give me a subject, like one of these, and the team will take it from there.', 'ideas')
        render()
        return
      }
      // Post the hand-off first so the thread reads in order; swap it for the reason if the run can't start.
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
      return
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
