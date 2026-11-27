/**
 * The app's left sidebar, like Claude's: the main sections at the top
 * (Agents, Studio, Editor, Channels), the Agents chats under "Recents",
 * and the account at the bottom. It shows on every page and collapses to an
 * icon rail (⌘B). Phones keep the top bar and the chats drawer instead.
 */

const ICONS = {
  agents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>',
  manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18M8 5v4M16 5v4M10 12.5v4l3.5-2z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  brand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="m8 2 4 4 4-4"/></svg>',
  side: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
}
export const SIDE_ITEMS = [
  { panel: 'agents', name: 'Agents' },
  { panel: 'manual', name: 'Studio' },
  { panel: 'edit', name: 'Editor' },
  { panel: 'brand', name: 'Channels' },
]

const KEY = 'tubeops_agents_side' // shared with the old chats sidebar, so the choice carries over

const CSS = `
#app-side{display:none}
@media (min-width:861px){
  .main.has-side{flex-direction:row}
  .main.has-side>.content{flex:1;min-width:0}
  #app-side{position:relative;display:flex;flex-direction:column;flex:none;width:248px;min-height:0;overflow:hidden;background:#0f0f10;border-right:1px solid rgba(255,255,255,.05);transition:width .32s cubic-bezier(.32,.72,0,1);font-family:var(--app-font,Inter,system-ui,sans-serif)}
  html.side-min #app-side{width:56px}
  #app-side .as-in{display:flex;flex-direction:column;min-height:0;flex:1;width:248px;padding:10px 8px}
  #app-side .as-head{display:flex;align-items:center;gap:4px;padding:2px 2px 8px}
  #app-side .as-ico{display:grid;place-items:center;width:36px;height:36px;flex:none;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.55);cursor:pointer}
  #app-side .as-ico:hover{background:rgba(255,255,255,.06);color:#fff}
  #app-side .as-ico svg{width:18px;height:18px}
  #app-side .as-newvid{margin-bottom:6px;color:#fff}
  #app-side .as-newvid .as-plus{display:grid;place-items:center;width:22px;height:22px;margin-left:-2px;margin-right:-2px;flex:none;border-radius:50%;background:#ff2d48;color:#fff}
  #app-side .as-newvid .as-plus svg{width:13px;height:13px;color:#fff}
  #app-side .as-newvid:hover .as-plus{filter:brightness(1.08)}
  #app-side .as-nav{display:flex;flex-direction:column;gap:1px;padding-bottom:6px}
  #app-side .as-item{display:flex;align-items:center;gap:11px;width:100%;height:36px;padding:0 9px;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.72);font:400 13.5px/1 var(--app-font,Inter,system-ui,sans-serif);text-align:left;cursor:pointer;white-space:nowrap}
  #app-side .as-item svg{width:18px;height:18px;flex:none;color:rgba(255,255,255,.55)}
  #app-side .as-item:hover{background:rgba(255,255,255,.05);color:#fff}
  #app-side .as-item.is-on{background:rgba(255,255,255,.08);color:#fff}
  #app-side .as-item.is-on svg{color:#ff2d48}
  #app-side .as-label{padding:14px 10px 6px;font-size:11.5px;color:rgba(255,255,255,.38);white-space:nowrap}
  #app-side .as-chats{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;gap:1px}
  #app-side .as-chats::-webkit-scrollbar{display:none}
  #app-side .as-chat{position:relative;display:block;width:100%;padding:8px 26px 8px 10px;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.72);font:400 13px/1.3 var(--app-font,Inter,system-ui,sans-serif);text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #app-side .as-chat:hover{background:rgba(255,255,255,.05);color:#fff}
  #app-side .as-chat.is-on{background:rgba(255,255,255,.08);color:#fff}
  #app-side .as-busy{position:absolute;right:10px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:#ff2d48;box-shadow:0 0 0 3px rgba(255,45,72,.2)}
  #app-side .as-empty{padding:6px 10px;font-size:12.5px;color:rgba(255,255,255,.38)}
  #app-side .as-me{display:flex;align-items:center;gap:10px;margin-top:6px;padding:10px 8px 4px;border:0;border-top:1px solid rgba(255,255,255,.06);background:transparent;color:rgba(255,255,255,.8);font:400 13px var(--app-font,Inter,system-ui,sans-serif);text-align:left;cursor:pointer;white-space:nowrap}
  #app-side .as-me i{display:grid;place-items:center;width:26px;height:26px;flex:none;border-radius:50%;background:#2a2a2d;color:#fff;font:500 11px var(--app-font,Inter,system-ui,sans-serif);font-style:normal}
  #app-side .as-me span{overflow:hidden;text-overflow:ellipsis}
  #app-side .as-fade{transition:opacity .2s ease .08s}
  html.side-min #app-side .as-fade{opacity:0;pointer-events:none;transition:opacity .12s ease}
  /* New video lives in the sidebar, so the Agents header drops its own button. */
  #panel-agents .ag-pill[data-ag-new]{display:none!important}
  /* The sections live in the sidebar now; the top bar keeps the logo, credits and account. */
  .app-topnav .topnav-primary{display:none!important}
  /* The Agents page drops its own chats column: the app sidebar has the chats. */
  #panel-agents .ag-app:not(.is-ed){grid-template-columns:minmax(0,1fr)!important}
  #panel-agents .ag-app:not(.is-ed)>.ag-side{display:none!important}
}
@media (prefers-reduced-motion:reduce){#app-side,#app-side .as-fade{transition:none!important}}
`

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function initAppSidebar({ main, getUser } = {}) {
  if (!main || document.getElementById('app-side')) return null
  const style = document.createElement('style')
  style.id = 'app-side-style'
  style.textContent = CSS
  document.head.appendChild(style)
  const el = document.createElement('aside')
  el.id = 'app-side'
  el.setAttribute('aria-label', 'Sidebar')
  main.insertBefore(el, main.firstChild)
  main.classList.add('has-side')

  let min = false
  try { min = localStorage.getItem(KEY) === 'min' } catch (_) {}
  document.documentElement.classList.toggle('side-min', min)

  const activePanel = () => String(document.querySelector('.content > .panel.active')?.id || '').replace(/^panel-/, '')
  const chats = () => { try { return window.agentsChat?.chats?.list?.() || { live: null, past: [] } } catch (_) { return { live: null, past: [] } } }

  function render() {
    const now = activePanel()
    const list = chats()
    const user = (() => { try { return getUser?.() } catch (_) { return null } })()
    const name = user?.name || user?.full_name || user?.email || 'Your account'
    const initials = String(name).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'ME'
    const label = min ? 'Open sidebar' : 'Close sidebar'
    const rows = [
      list.live ? `<button type="button" class="as-chat${list.live.on ? ' is-on' : ''}" data-as-live title="${esc(list.live.title)}">${esc(list.live.title)}${list.live.busy ? '<i class="as-busy" title="The team is working"></i>' : ''}</button>` : '',
      ...list.past.map((c) => `<button type="button" class="as-chat${c.on ? ' is-on' : ''}" data-as-chat="${esc(c.id)}" title="${esc(c.title)}">${esc(c.title)}</button>`),
    ].join('')
    el.innerHTML = `<div class="as-in">
      <div class="as-head">
        <button type="button" class="as-ico" data-as-toggle aria-label="${label}" title="${label} (⌘B)" aria-expanded="${!min}">${ICONS.side}</button>
      </div>
      <button type="button" class="as-item as-newvid" data-as-new title="New video"><i class="as-plus">${ICONS.plus}</i><span class="as-fade">New video</span></button>
      <nav class="as-nav" aria-label="Main">${SIDE_ITEMS.map((x) => `<button type="button" class="as-item${now === x.panel ? ' is-on' : ''}" data-as-panel="${x.panel}" title="${x.name}"${now === x.panel ? ' aria-current="page"' : ''}>${ICONS[x.panel]}<span class="as-fade">${x.name}</span></button>`).join('')}</nav>
      <div class="as-label as-fade">Recents</div>
      <div class="as-chats as-fade" role="group" aria-label="Your chats">${rows || '<div class="as-empty">Your chats show up here.</div>'}</div>
      <button type="button" class="as-me" data-as-me title="Account"><i>${esc(initials)}</i><span class="as-fade">${esc(String(name).slice(0, 40))}</span></button>
    </div>`
    bind()
  }

  function bind() {
    el.querySelector('[data-as-toggle]')?.addEventListener('click', toggle)
    el.querySelector('[data-as-new]')?.addEventListener('click', () => { try { window.agentsChat?.chats?.newChat?.() } catch (_) {} })
    el.querySelectorAll('[data-as-panel]').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.asPanel
      try { window.switchPanel?.(p, document.getElementById('nav-' + p)) } catch (_) {}
      render()
    }))
    el.querySelector('[data-as-live]')?.addEventListener('click', () => { try { window.agentsChat?.chats?.openLive?.() } catch (_) {} ; render() })
    el.querySelectorAll('[data-as-chat]').forEach((b) => b.addEventListener('click', () => { try { window.agentsChat?.chats?.open?.(b.dataset.asChat) } catch (_) {} ; render() }))
    el.querySelector('[data-as-me]')?.addEventListener('click', () => { try { window.openAccountSettings?.() } catch (_) {} })
  }

  function toggle() {
    min = !min
    try { localStorage.setItem(KEY, min ? 'min' : 'full') } catch (_) {}
    document.documentElement.classList.toggle('side-min', min)
    const b = el.querySelector('[data-as-toggle]')
    if (b) { const l = min ? 'Open sidebar' : 'Close sidebar'; b.setAttribute('aria-label', l); b.title = l + ' (⌘B)'; b.setAttribute('aria-expanded', String(!min)) }
  }

  // ⌘B / Ctrl+B anywhere except while typing.
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'b') return
    const t = e.target
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    e.preventDefault()
    e.stopImmediatePropagation()
    toggle()
  }, true)

  let queued = 0
  const soon = () => { if (queued) return; queued = requestAnimationFrame(() => { queued = 0; render() }) }
  window.addEventListener('vidso:chats', soon)
  // Redraw when the page changes, so the current section is lit.
  new MutationObserver(soon).observe(main.querySelector('.content') || main, { attributes: true, subtree: false, childList: false, attributeFilter: ['class'] })
  const content = main.querySelector('.content')
  if (content) for (const p of content.querySelectorAll(':scope > .panel')) new MutationObserver(soon).observe(p, { attributes: true, attributeFilter: ['class'] })

  render()
  const api = { render, toggle, isMin: () => min }
  window.appSidebar = api
  return api
}
