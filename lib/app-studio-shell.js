/** App studio shell: sidebar, top bar, home, catalog, skeleton pages. Presentation only. */

import { bindMediaPlaceholders } from './media-placeholder.js'
import { getAskMode, setAskMode } from './studio-workspace.js'
import {
  ASK_BEHAVIORS,
  ATTACH_MENU,
  CATALOG_TABS,
  HOME_CHIPS,
  HOME_CHIPS_MORE,
  HOME_PRESETS,
  HOME_PROMPT_IDEAS,
  HOME_PROMPT_MODES,
  ICO,
  INSPIRE_CATEGORIES,
  SIDEBAR_SECTIONS,
  START_FORMATS,
  STUDIO_LENGTH,
  STUDIO_PAGES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TUTORIALS,
  TUTORIAL_CATEGORIES,
  WHATS_NEW,
  WORKSPACE_PILL,
  allStudioTools,
  appMedia,
  catalogTools,
  inspireMedia,
  mcpStripLogos,
  readCollapsed,
  readPinned,
  startMedia,
  studioToolById,
  togglePinned,
  toolThumb,
  writeCollapsed,
} from './studio-nav.js'

const TITLES = {
  dashboard: 'Home',
  tools: 'Tools',
  videogen: 'Long Form Generator',
  imagegen: 'Thumbnail Generator',
  clipper: 'Clipping',
  ranking: 'Ranking',
  captions: 'AI Captions',
  voiceover: 'AI Voiceover',
  reframe: 'AI Reframe',
  commentary: 'Video Commentary',
  editor: 'Video Editor',
  downloader: 'Video Downloader',
  files: 'My Files',
  brandkit: 'Brand kit',
  templates: 'Templates',
  tutorials: 'Tutorials',
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function reduceMotion() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function phHtml(src, extra = '', kind = 'img') {
  const url = String(src || '').trim()
  let media = ''
  if (url && kind === 'video') {
    media = `<video src="${esc(url)}" muted playsinline loop preload="metadata"></video>`
  } else if (url) {
    media = `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`
  }
  return `<div class="studio-ph studio-ph-shimmer ${extra}" data-media-ph>${media}</div>`
}

function bindPh(root = document) {
  try { bindMediaPlaceholders(root) } catch (_) {}
  ;(root.querySelectorAll ? root : document).querySelectorAll('[data-media-ph] video').forEach((vid) => {
    if (vid.dataset.phBound) return
    vid.dataset.phBound = '1'
    vid.addEventListener('error', () => vid.remove())
  })
}

function go(id, query) {
  window.closeMobileNav?.()
  window.closeStudioCmd?.()
  const tool = studioToolById(id)
  if (tool?.external || id === 'mcp') {
    location.href = tool?.href || '/mcp'
    return
  }
  if (query) window.switchPanel?.(id, null, { query })
  else window.switchPanel?.(id, null)
}

function signedIn() {
  try { return !!(localStorage.getItem('clipzo_token') || '') } catch (_) { return false }
}

export function initStudioShell() {
  document.body.classList.add('studio-shell')
  mountSidebar()
  mountTopbarExtras()
  mountCommandPalette()
  mountHome()
  mountCatalog()
  mountBrandKit()
  mountTemplates()
  mountTutorials()
  bindShellEvents()
  applyCollapsed(readCollapsed(), { silent: true })
  syncNav(currentPanelId())
  applyStudioPrefill()
  window.addEventListener('resize', onResize)
  onResize()
  try { window.applyVidsoLogos?.() } catch (_) {}
}

export function studioOnPanelChange(id) {
  syncNav(id)
  const crumb = document.getElementById('topbar-title')
  if (crumb) crumb.textContent = TITLES[id] || 'Vidso'
  if (id === 'dashboard') paintHomeMode(homeMode())
  if (id === 'tools') paintCatalog(catalogTab())
  if (id === 'videogen' || id === 'imagegen' || id === 'voiceover') applyStudioPrefill()
}

export function studioPaintRecent(files) {
  const scroller = document.getElementById('studio-recent-scroller')
  if (!scroller) return
  const list = Array.isArray(files) ? files.slice(0, 12) : []
  if (!list.length) {
    scroller.innerHTML = `<div class="studio-empty">
      <h3>No recent renders</h3>
      <p>Exports from My Files show up here.</p>
      <button type="button" class="btn btn-primary btn-sm" data-go="videogen">Create your first video</button>
    </div>`
    return
  }
  scroller.innerHTML = list.map((f) => {
    const name = esc(f.original_name || 'Untitled')
    const url = String(f.url || '').trim()
    const video = String(f.mime_type || '').startsWith('video/')
    const media = url
      ? (video
        ? `<video src="${esc(url)}" muted playsinline preload="metadata"></video>`
        : `<img src="${esc(url)}" alt="" loading="lazy">`)
      : ''
    return `<a class="studio-tile" href="${esc(url || '/files')}">
      <div class="studio-ph studio-ph-shimmer">${media}<span class="studio-scrim-grad"></span></div>
      <div class="studio-tile-meta">${name}</div>
    </a>`
  }).join('')
}

export function applyStudioPrefill() {
  let topic = ''
  let prompt = ''
  let format = ''
  let duration = ''
  try {
    const q = new URLSearchParams(location.search || '')
    topic = (q.get('topic') || q.get('idea') || '').trim()
    prompt = (q.get('prompt') || '').trim()
    format = (q.get('format') || '').trim()
    duration = (q.get('duration') || '').trim()
    if (!topic) topic = sessionStorage.getItem('vidso_guest_topic') || ''
  } catch (_) {}
  const studio = document.getElementById('studio-prompt')
  const studioText = topic || prompt
  if (studio && studioText && !String(studio.value || '').trim()) {
    studio.value = studioText
    try { studio.dispatchEvent(new Event('input', { bubbles: true })) } catch (_) {}
  }
  if (format === 'shorts') setPromptMode('shorts')
  else if (format === 'long') setPromptMode('long')
  else if (prompt && !format) setPromptMode('thumbnail')
  const fv = document.getElementById('fv-topic')
  if (fv && topic && !String(fv.value || '').trim()) fv.value = topic
  if (format && typeof window.fvSetFormat === 'function') {
    window.fvSetFormat(format === 'shorts' ? 'shorts' : 'long')
  }
  if (duration && typeof window.fvSetDuration === 'function') window.fvSetDuration(duration)
  const img = document.getElementById('img-prompt')
  const imgText = prompt || topic
  if (img && imgText && !String(img.value || '').trim()) {
    if (typeof window.fillImgPrompt === 'function') window.fillImgPrompt(imgText)
    else {
      img.value = imgText
      try { img.dispatchEvent(new Event('input', { bubbles: true })) } catch (_) {}
    }
  }
  const tts = document.getElementById('tts-text')
  if (tts && topic && !String(tts.value || '').trim()) {
    tts.value = topic
    try { tts.dispatchEvent(new Event('input', { bubbles: true })) } catch (_) {}
  }
}

function currentPanelId() {
  return document.querySelector('.panel.active')?.id?.replace(/^panel-/, '') || 'dashboard'
}

function homeMode() {
  return document.documentElement.dataset.studioHomeMode === 'tools' ? 'tools' : 'agents'
}

function setHomeMode(mode) {
  document.documentElement.dataset.studioHomeMode = mode === 'tools' ? 'tools' : 'agents'
  paintHomeMode(mode)
}

function catalogTab() {
  return document.documentElement.dataset.studioCatalogTab || 'popular'
}

function inspireTab() {
  return document.documentElement.dataset.studioInspireTab || INSPIRE_CATEGORIES[0].id
}

function mountSidebar() {
  const el = document.getElementById('studio-sidebar')
  if (!el) return
  el.innerHTML = `
    <div class="studio-sidebar-top">
      <button type="button" class="studio-ico-btn studio-collapse-btn" id="studio-collapse" aria-label="Collapse sidebar" aria-expanded="true">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <button type="button" class="studio-project" id="studio-project-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-project-menu">
        <span class="studio-project-mark" aria-hidden="true">P</span>
        <span class="studio-project-txt">${esc(WORKSPACE_PILL.label)}</span>
        <span class="studio-project-chev" aria-hidden="true">${ICO.chev}</span>
      </button>
    </div>
    <div class="studio-project-menu" id="studio-project-menu" hidden role="menu">
      <button type="button" role="menuitem" aria-checked="true">${esc(WORKSPACE_PILL.label)}</button>
      <p>${esc(WORKSPACE_PILL.hint)}</p>
    </div>
    <nav class="studio-sidebar-nav" id="studio-sidebar-nav" aria-label="Studio"></nav>
    <div class="studio-pinned-rail" id="studio-pinned-rail" hidden></div>
  `
  paintSidebar()
}

function paintSidebar() {
  const nav = document.getElementById('studio-sidebar-nav')
  if (!nav) return
  const pinned = readPinned()
  const parts = SIDEBAR_SECTIONS.map((sec) => {
    if (sec.pinned) return ''
    const label = sec.label ? `<span class="studio-nav-label">${esc(sec.label)}</span>` : ''
    const items = sec.chips
      ? `<div class="studio-nav-tools">${sec.items.map((it) => navChip(it)).join('')}</div>`
      : sec.items.map((it) => navBtn(it)).join('')
    return `<div class="studio-nav-sec" data-sec="${esc(sec.id)}">${label}${items}</div>`
  })
  nav.innerHTML = parts.join('')
  paintPinnedRail(pinned)
  syncNav(currentPanelId())
}

function navBtn(it) {
  const badge = it.badge ? `<span class="studio-nav-new">${esc(it.badge)}</span>` : ''
  const goAttr = it.external ? `data-href="${esc(it.href)}"` : `data-go="${esc(it.id)}"`
  return `<button type="button" class="studio-nav-item" data-panel="${esc(it.id)}" ${goAttr} title="${esc(it.name)}" aria-label="${esc(it.name)}">
    <span class="studio-nav-ico" aria-hidden="true">${it.icon || ''}</span>
    <span class="studio-nav-txt">${esc(it.name)}</span>
    ${badge}
  </button>`
}

function navChip(it) {
  const badge = it.badge ? `<span class="studio-nav-new">${esc(it.badge)}</span>` : ''
  const goAttr = it.external ? `data-href="${esc(it.href)}"` : `data-go="${esc(it.id)}"`
  return `<button type="button" class="studio-nav-chip" data-panel="${esc(it.id)}" ${goAttr} title="${esc(it.name)}" aria-label="${esc(it.name)}">
    <span class="studio-nav-ico" aria-hidden="true">${it.icon || ''}</span>
    <span class="studio-nav-txt">${esc(it.name)}</span>
    ${badge}
  </button>`
}

function paintPinnedRail(ids) {
  const rail = document.getElementById('studio-pinned-rail')
  if (!rail) return
  const items = (ids || []).map((id) => studioToolById(id)).filter(Boolean)
  if (!items.length) {
    rail.hidden = true
    rail.innerHTML = ''
    return
  }
  rail.hidden = false
  rail.innerHTML = `<span class="studio-nav-label">Pinned</span>` + items.map((it) => {
    const goAttr = it.external ? `data-href="${esc(it.href)}"` : `data-go="${esc(it.id)}"`
    return `<button type="button" class="studio-pin-thumb" ${goAttr} title="${esc(it.name)}" aria-label="${esc(it.name)}">
      ${phHtml(toolThumb(it.slug), 'is-thumb')}
    </button>`
  }).join('')
  bindPh(rail)
}

function syncNav(panelId) {
  document.querySelectorAll('#studio-sidebar [data-panel]').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-panel') === panelId)
  })
}

function mountTopbarExtras() {
  const help = document.getElementById('studio-help-menu')
  if (help) {
    help.innerHTML = `
      <a role="menuitem" href="/home#faq">FAQ</a>
      <a role="menuitem" href="/mcp">MCP page</a>
      <a role="menuitem" data-vidso-support href="mailto:support@vidso.pro">Contact support</a>
    `
  }
  try { window.applyVidsoSupportLinks?.() } catch (_) {}
}

function mountCommandPalette() {
  if (document.getElementById('studio-cmd')) return
  const wrap = document.createElement('div')
  wrap.id = 'studio-cmd'
  wrap.className = 'studio-cmd'
  wrap.hidden = true
  wrap.innerHTML = `<div class="studio-cmd-panel" role="dialog" aria-modal="true" aria-label="Search">
    <label class="sr-only" for="studio-cmd-input">Search tools and files</label>
    <input class="studio-cmd-input" id="studio-cmd-input" type="search" placeholder="Search tools and files" autocomplete="off">
    <div class="studio-cmd-list" id="studio-cmd-list"></div>
  </div>`
  document.body.appendChild(wrap)
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeCmd()
  })
  document.getElementById('studio-cmd-input')?.addEventListener('input', (e) => paintCmd(e.target.value))
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]')
    if (!btn) return
    go(btn.getAttribute('data-go'))
  })
}

function paintCmd(q) {
  const list = document.getElementById('studio-cmd-list')
  if (!list) return
  const needle = String(q || '').trim().toLowerCase()
  const tools = allStudioTools().concat(Object.values(STUDIO_PAGES))
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .filter((t) => !needle || (t.name || '').toLowerCase().includes(needle))
  const toolHtml = tools.length
    ? tools.map((t) => `<button type="button" class="studio-cmd-item" data-go="${esc(t.id)}">${esc(t.name)}</button>`).join('')
    : '<p class="studio-cmd-empty">No matching tools</p>'
  list.innerHTML = `<div class="studio-cmd-group">Tools</div>${toolHtml}
    <div class="studio-cmd-group">Files</div>
    <p class="studio-cmd-empty">No files in search. Open My Files to browse uploads.</p>`
}

function openCmd() {
  const el = document.getElementById('studio-cmd')
  if (!el) return
  el.hidden = false
  paintCmd('')
  const input = document.getElementById('studio-cmd-input')
  input.value = ''
  input.focus()
}

function closeCmd() {
  const el = document.getElementById('studio-cmd')
  if (el) el.hidden = true
}
window.closeStudioCmd = closeCmd
window.openStudioCmd = openCmd

function chipHtml(c) {
  return `<button type="button" class="studio-chip" data-chip="${esc(c.id)}" data-chip-fill="${esc(c.fill)}" data-chip-mode="${esc(c.mode)}">
    <span class="studio-chip-ico" aria-hidden="true">${ICO[c.icon] || ''}</span>${esc(c.label)}
  </button>`
}

function railHead(title, moreLabel, moreGo, moreHref) {
  const more = moreGo
    ? `<a class="studio-rail-more" href="${esc(moreHref || '#')}" data-go="${esc(moreGo)}">${esc(moreLabel)}</a>`
    : moreHref
      ? `<a class="studio-rail-more" href="${esc(moreHref)}">${esc(moreLabel)}</a>`
      : ''
  return `<div class="studio-rail-head"><h2>${esc(title)}</h2>${more}</div>`
}

function railTrack(id, inner, extra = '') {
  return `<div class="studio-rail-track">
    <button type="button" class="studio-rail-arrow" data-rail="${id}" data-dir="-1" aria-label="Scroll left">‹</button>
    <button type="button" class="studio-rail-arrow" data-rail="${id}" data-dir="1" aria-label="Scroll right">›</button>
    <div class="studio-rail-scroller ${extra}" id="${id}" tabindex="0">${inner}</div>
  </div>`
}

function startCards() {
  return START_FORMATS.map((f) => {
    const badge = f.badge ? `<span class="studio-badge">${esc(f.badge)}</span>` : ''
    const goAttr = f.panel ? `data-go="${esc(f.panel)}" data-format="${esc(f.format || '')}"` : ''
    return `<button type="button" class="studio-tile is-portrait" ${goAttr} aria-label="${esc(f.label)}">
      ${phHtml(startMedia(f.slug), 'is-portrait', 'video')}
      ${badge}
      <span class="studio-scrim-grad"></span>
      <span class="studio-tile-meta is-over">${esc(f.label)}</span>
    </button>`
  }).join('')
}

function newsCards() {
  return WHATS_NEW.map((n) => {
    const tag = n.tag ? `<span class="studio-badge">${esc(n.tag)}</span>` : ''
    const goAttr = n.panel ? `data-go="${esc(n.panel)}"` : n.href ? `data-href="${esc(n.href)}"` : 'disabled'
    return `<button type="button" class="studio-tile is-wide" ${goAttr} aria-label="${esc(n.title || 'Announcement')}">
      ${phHtml(appMedia(n.image), 'is-wide')}
      ${tag}
      <span class="studio-scrim-grad"></span>
      <span class="studio-tile-copy">
        <span class="studio-tile-meta">${esc(n.title)}</span>
        <span class="studio-tile-sub">${esc(n.blurb)}</span>
      </span>
    </button>`
  }).join('')
}

function presetCards() {
  return HOME_PRESETS.map((t) => `
    <button type="button" class="studio-preset" data-go="${esc(t.panel)}" aria-label="${esc(t.title)}">
      ${phHtml(appMedia(t.file))}
      <span class="studio-scrim-grad"></span>
      <span class="studio-tile-meta is-over">${esc(t.title)}</span>
    </button>`).join('')
}

function toolCardsHtml() {
  return allStudioTools().filter((t) => t.id !== 'mcp').map((t) => `
    <button type="button" class="studio-tool-row" data-go="${esc(t.id)}">
      ${phHtml(toolThumb(t.slug))}
      <span class="studio-tool-copy"><strong>${esc(t.name)}</strong><p>${esc(t.description)}</p></span>
      <span class="studio-launch" aria-hidden="true">→</span>
    </button>`).join('')
}

function mountHome() {
  const root = document.getElementById('studio-home-root')
  if (!root) return
  const logos = mcpStripLogos().map((l) => {
    const fb = l.fallback ? ` data-fallback="${esc(l.fallback)}"` : ''
    return `<img src="${esc(l.src)}" alt="${esc(l.client)}"${fb}>`
  }).join('')
  const chips = HOME_CHIPS.map(chipHtml).join('')
  const more = HOME_CHIPS_MORE.map(chipHtml).join('')
  const ask = ASK_BEHAVIORS.find((b) => b.id === getAskMode()) || ASK_BEHAVIORS[0]
  const modes = HOME_PROMPT_MODES.map((m) => `<button type="button" role="menuitem" data-prompt-mode="${esc(m.id)}">${esc(m.label)}</button>`).join('')
  const asks = ASK_BEHAVIORS.map((b) => `<button type="button" role="menuitem" data-ask="${esc(b.id)}">${esc(b.label)}</button>`).join('')
  const attach = ATTACH_MENU.map((a) => `<button type="button" role="menuitem" data-attach="${esc(a.id)}">${esc(a.label)}</button>`).join('')

  root.innerHTML = `
    <div class="studio-home">
      <div class="studio-hero">
        <h1 id="studio-hello">What are we making today<span data-studio-hello></span>?</h1>
        <div class="studio-seg" role="tablist" aria-label="Home view">
          <button type="button" role="tab" id="studio-mode-agents" aria-selected="true" data-home-mode="agents">
            <span aria-hidden="true">${ICO.agents}</span>Agents
          </button>
          <button type="button" role="tab" id="studio-mode-tools" aria-selected="false" data-home-mode="tools">
            <span aria-hidden="true">${ICO.tools}</span>Tools
          </button>
        </div>
      </div>
      <div id="studio-home-agents">
        <form class="studio-prompt" id="studio-prompt-form">
          <label class="sr-only" for="studio-prompt">Prompt</label>
          <textarea id="studio-prompt" rows="3" autocomplete="off"></textarea>
          <div class="studio-prompt-bar">
            <div class="studio-prompt-left">
              <div class="studio-pop" id="studio-attach-wrap">
                <button type="button" class="studio-round-btn" id="studio-attach" aria-label="Attach" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-attach-menu">${ICO.plus}</button>
                <div class="studio-mini-menu" id="studio-attach-menu" hidden role="menu">${attach}</div>
              </div>
              <div class="studio-pop" id="studio-mode-wrap">
                <button type="button" class="studio-drop-btn" id="studio-mode-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-mode-menu">
                  <span id="studio-mode-label">Long-form</span><span aria-hidden="true">${ICO.chev}</span>
                </button>
                <div class="studio-mini-menu" id="studio-mode-menu" hidden role="menu">${modes}</div>
              </div>
              <input type="hidden" id="studio-prompt-mode" value="long">
            </div>
            <div class="studio-prompt-right">
              <div class="studio-pop" id="studio-ask-wrap">
                <button type="button" class="studio-drop-btn is-ghost" id="studio-ask-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-ask-menu">
                  <span id="studio-ask-label">${esc(ask.label)}</span><span aria-hidden="true">${ICO.chev}</span>
                </button>
                <div class="studio-mini-menu" id="studio-ask-menu" hidden role="menu">${asks}</div>
              </div>
              <button type="button" class="studio-round-btn" id="studio-mic" aria-label="Speech input">
                ${ICO.mic}
              </button>
              <button type="submit" class="studio-send" id="studio-send" aria-label="Start">${ICO.send}</button>
            </div>
          </div>
        </form>
        <div class="studio-chips" id="studio-chips">
          ${chips}
          <button type="button" class="studio-chip" id="studio-chips-more" aria-expanded="false">More</button>
          <span class="studio-chips-extra" id="studio-chips-extra" hidden>${more}</span>
        </div>
        <div class="studio-mcp-row">
          <span>Create videos inside your AI agent</span>
          <span class="studio-mcp-logos">${logos}</span>
          <a class="studio-mcp-btn" href="/mcp">Set up MCP / CLI ↗</a>
        </div>
        <input type="file" id="studio-upload-input" accept="video/*,image/*,audio/*" hidden>
        <div class="studio-url-pop" id="studio-url-pop" hidden>
          <label class="sr-only" for="studio-url-input">Media URL</label>
          <input id="studio-url-input" type="url" placeholder="https://">
          <button type="button" class="btn btn-primary btn-sm" id="studio-url-go">Open</button>
        </div>
      </div>
      <div id="studio-home-tools" hidden></div>
      <div id="studio-home-rails">
        <section class="studio-rail" id="rail-start">
          ${railHead('Start creating', 'More →', 'tools', '/tools')}
          ${railTrack('studio-start-scroller', startCards(), 'is-portrait')}
        </section>
        <section class="studio-rail" id="rail-recent">
          ${railHead('Your recent renders', 'More →', 'files', '/files')}
          ${railTrack('studio-recent-scroller', '')}
        </section>
        <div id="dash-recent" hidden></div>
        <section class="studio-rail" id="rail-news">
          ${railHead("What's new", 'More →', '', '/models')}
          ${railTrack('studio-news-scroller', newsCards(), 'is-wide')}
        </section>
        <section class="studio-rail" id="rail-presets">
          ${railHead('Presets', 'More →', 'templates', '/templates')}
          <div class="studio-masonry" id="studio-preset-grid">${presetCards()}</div>
        </section>
        <section class="studio-rail" id="rail-inspire">
          <div class="studio-rail-head"><h2>Inspirations</h2></div>
          <div class="studio-tabs is-left" role="tablist" aria-label="Inspiration categories" id="studio-inspire-tabs"></div>
          <div id="studio-inspire-panel"></div>
        </section>
        <section class="studio-rail" id="rail-tools">
          ${railHead('Get started with tools', 'More →', 'tools', '/tools')}
          <div class="studio-tool-grid is-3" id="studio-home-toolgrid">${toolCardsHtml()}</div>
        </section>
      </div>
    </div>`
  paintInspire(inspireTab())
  studioPaintRecent([])
  bindPh(root)
  bindRails(root)
  startPlaceholder()
  root.querySelectorAll('.studio-mcp-logos img').forEach((img) => {
    img.addEventListener('error', () => {
      const fb = img.getAttribute('data-fallback')
      if (fb && img.src !== fb) img.src = fb
      else img.remove()
    })
  })
}

function paintInspire(catId) {
  const cat = INSPIRE_CATEGORIES.find((c) => c.id === catId) || INSPIRE_CATEGORIES[0]
  document.documentElement.dataset.studioInspireTab = cat.id
  const tabs = document.getElementById('studio-inspire-tabs')
  const panel = document.getElementById('studio-inspire-panel')
  if (!tabs || !panel) return
  tabs.innerHTML = INSPIRE_CATEGORIES.map((c) => `<button type="button" class="studio-tab" role="tab" data-inspire="${esc(c.id)}" aria-selected="${c.id === cat.id ? 'true' : 'false'}">${esc(c.label)}</button>`).join('')
  const cells = [1, 2, 3, 4, 5, 6].map((n) => `
    <button type="button" class="studio-inspire-card is-n${n}" data-go="videogen" aria-label="${esc(cat.label)} ${n}">
      ${phHtml(inspireMedia(cat.id, n), n === 1 || n === 4 ? 'is-wide' : '')}
    </button>`).join('')
  panel.innerHTML = `<div class="studio-inspire-head">
      <div>
        <h3>${esc(cat.label)}</h3>
        <p>${esc(cat.description)}</p>
      </div>
      <a class="studio-rail-more" href="/templates" data-go="templates">See all</a>
    </div>
    <div class="studio-inspire-grid">${cells}</div>`
  bindPh(panel)
}

function paintHomeMode(mode) {
  const tools = mode === 'tools'
  document.getElementById('studio-mode-agents')?.setAttribute('aria-selected', tools ? 'false' : 'true')
  document.getElementById('studio-mode-tools')?.setAttribute('aria-selected', tools ? 'true' : 'false')
  const hello = document.getElementById('studio-hello')
  if (hello) {
    hello.innerHTML = tools
      ? 'Your studio, your controls'
      : 'What are we making today<span data-studio-hello></span>?'
    try {
      const nameEl = document.getElementById('user-name')
      const first = String(nameEl?.textContent || '').trim().split(/\s+/)[0]
      const slot = hello.querySelector('[data-studio-hello]')
      if (slot && first && !/^(preview|your|account|\.\.\.)$/i.test(first)) slot.textContent = ', ' + first
    } catch (_) {}
  }
  const agents = document.getElementById('studio-home-agents')
  const embed = document.getElementById('studio-home-tools')
  if (agents) agents.hidden = tools
  if (embed) {
    embed.hidden = !tools
    if (tools) {
      embed.innerHTML = catalogHtml(false)
      bindPh(embed)
    }
  }
}

function catalogHtml(pageHeading) {
  const tab = catalogTab()
  const tabs = CATALOG_TABS.map((t) => `<button type="button" class="studio-tab" role="tab" data-cat="${esc(t.id)}" aria-selected="${t.id === tab ? 'true' : 'false'}">${esc(t.label)}</button>`).join('')
  const rows = catalogTools(tab).map((t) => toolRowHtml(t)).join('')
  const head = pageHeading
    ? `<h1>Your studio, your controls</h1>`
    : ''
  return `<div class="studio-catalog">${head}
    <div class="studio-tabs" role="tablist" aria-label="Tool categories">${tabs}</div>
    <div class="studio-tool-grid">${rows || '<div class="studio-empty"><h3>No tools in this category</h3></div>'}</div>
  </div>`
}

function toolRowHtml(t) {
  const goAttr = t.external ? `data-href="${esc(t.href)}"` : `data-go="${esc(t.id)}"`
  return `<div class="studio-tool-row" data-launch="${esc(t.id)}">
    ${phHtml(toolThumb(t.slug))}
    <div class="studio-tool-copy"><strong>${esc(t.name)}</strong><p>${esc(t.description)}</p></div>
    <button type="button" class="studio-launch" ${goAttr} aria-label="Open ${esc(t.name)}">→</button>
  </div>`
}

function mountCatalog() {
  const root = document.getElementById('studio-tools-root')
  if (!root) return
  paintCatalog('popular')
}

function paintCatalog(tab) {
  document.documentElement.dataset.studioCatalogTab = tab || 'popular'
  const root = document.getElementById('studio-tools-root')
  if (root) {
    root.innerHTML = catalogHtml(true)
    bindPh(root)
  }
  const embed = document.getElementById('studio-home-tools')
  if (embed && !embed.hidden) {
    embed.innerHTML = catalogHtml(false)
    bindPh(embed)
  }
}

function mountBrandKit() {
  const root = document.getElementById('studio-brandkit-root')
  if (!root) return
  const blocks = [
    ['Logo', 'Drop a logo file here'],
    ['Colors', 'Brand colors'],
    ['Fonts', 'Brand fonts'],
    ['Intro / outro clips', 'Drop a clip here'],
  ]
  root.innerHTML = `<div class="studio-page">
    <h1>Brand kit</h1>
    <p class="studio-page-sub">Save logos, colors, fonts, and intro clips for later. Nothing is stored on this page yet.</p>
    <div class="studio-kit-grid">${blocks.map(([title, hint]) => `<section class="studio-kit-card">
      <h2>${esc(title)}</h2>
      <div class="studio-upload">${esc(hint)}</div>
    </section>`).join('')}</div>
    <p style="margin-top:16px"><button type="button" class="btn btn-primary" disabled>Save</button></p>
  </div>`
}

function mountTemplates() {
  const root = document.getElementById('studio-templates-root')
  if (!root) return
  root.innerHTML = `<div class="studio-page">
    <h1>Templates</h1>
    <p class="studio-page-sub">Start from a layout. Cards stay blank until media is uploaded to R2.</p>
    <div class="studio-tabs" role="tablist" aria-label="Template categories" id="studio-tpl-tabs"></div>
    <div class="studio-grid" id="studio-tpl-grid"></div>
  </div>`
  paintTemplates('explainers')
}

function paintTemplates(cat) {
  const tabs = document.getElementById('studio-tpl-tabs')
  const grid = document.getElementById('studio-tpl-grid')
  if (!tabs || !grid) return
  tabs.innerHTML = TEMPLATE_CATEGORIES.map((c) => `<button type="button" class="studio-tab" data-tpl-cat="${esc(c.id)}" aria-selected="${c.id === cat ? 'true' : 'false'}">${esc(c.label)}</button>`).join('')
  const rows = TEMPLATES.filter((t) => t.category === cat)
  grid.innerHTML = rows.map((t) => `<button type="button" class="studio-tile" data-go="${esc(t.panel)}">
    ${phHtml(appMedia(t.file))}
    <div class="studio-tile-meta">${esc(t.title)}</div>
    <div class="studio-tile-sub">${esc(TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.label || '')}</div>
  </button>`).join('')
  bindPh(grid)
}

function mountTutorials() {
  const root = document.getElementById('studio-tutorials-root')
  if (!root) return
  root.innerHTML = `<div class="studio-page">
    <h1>Tutorials</h1>
    <p class="studio-page-sub">Walkthroughs of Vidso tools. Cards stay blank until media is uploaded to R2.</p>
    <input class="studio-search" id="studio-tut-q" type="search" placeholder="Search tutorials" aria-label="Search tutorials">
    <div class="studio-tabs" role="tablist" aria-label="Tutorial categories" id="studio-tut-tabs"></div>
    <div class="studio-grid" id="studio-tut-grid"></div>
  </div>`
  paintTutorials('all', '')
}

function paintTutorials(cat, q) {
  const tabs = document.getElementById('studio-tut-tabs')
  const grid = document.getElementById('studio-tut-grid')
  if (!tabs || !grid) return
  tabs.innerHTML = TUTORIAL_CATEGORIES.map((c) => `<button type="button" class="studio-tab" data-tut-cat="${esc(c.id)}" aria-selected="${c.id === cat ? 'true' : 'false'}">${esc(c.label)}</button>`).join('')
  const needle = String(q || '').trim().toLowerCase()
  const rows = TUTORIALS.filter((t) => (cat === 'all' || t.category === cat) && (!needle || t.title.toLowerCase().includes(needle)))
  grid.innerHTML = rows.map((t) => `<div class="studio-tile">
    ${phHtml(appMedia(t.file))}
    <div class="studio-tile-meta">${esc(t.title)}</div>
    <div class="studio-tile-sub">${esc(t.duration)}</div>
  </div>`).join('')
  bindPh(grid)
  grid.dataset.cat = cat
}

function setPromptMode(id) {
  const mode = HOME_PROMPT_MODES.find((m) => m.id === id) || HOME_PROMPT_MODES[0]
  const hidden = document.getElementById('studio-prompt-mode')
  if (hidden) hidden.value = mode.id
  const label = document.getElementById('studio-mode-label')
  if (label) label.textContent = mode.label
  closePops()
}

function submitHomePrompt() {
  const text = String(document.getElementById('studio-prompt')?.value || '').trim()
  const modeId = document.getElementById('studio-prompt-mode')?.value || 'long'
  const mode = HOME_PROMPT_MODES.find((m) => m.id === modeId) || HOME_PROMPT_MODES[0]
  const params = new URLSearchParams()
  if (mode.panel === 'imagegen') {
    if (text) params.set('prompt', text)
  } else if (text) {
    params.set('topic', text)
  }
  if (mode.format) params.set('format', mode.format)
  go(mode.panel, params.toString() ? '?' + params.toString() : '')
}

function applyCollapsed(on, { silent } = {}) {
  document.body.classList.toggle('studio-collapsed', !!on)
  document.querySelectorAll('#studio-collapse, .studio-topbar #studio-collapse').forEach((btn) => {
    btn.setAttribute('aria-expanded', on ? 'false' : 'true')
    btn.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar')
  })
  if (!silent) writeCollapsed(!!on)
}

function openDrawer() {
  document.body.classList.add('nav-open')
  document.getElementById('studio-scrim')?.removeAttribute('hidden')
  document.getElementById('nav-hamburger')?.setAttribute('aria-expanded', 'true')
}
function closeDrawer() {
  document.body.classList.remove('nav-open')
  const scrim = document.getElementById('studio-scrim')
  if (scrim) scrim.hidden = true
  document.getElementById('nav-hamburger')?.setAttribute('aria-expanded', 'false')
}

function onResize() {
  if (window.innerWidth >= 1024) closeDrawer()
}

function closePops(except) {
  document.querySelectorAll('.studio-mini-menu, .studio-project-menu, .studio-url-pop').forEach((el) => {
    if (el.id === except) return
    el.hidden = true
  })
  document.querySelectorAll('[aria-expanded="true"]').forEach((btn) => {
    if (['studio-help-btn', 'nav-avatar-btn', 'nav-hamburger', 'studio-collapse', 'studio-chips-more'].includes(btn.id)) return
    if (except && btn.getAttribute('aria-controls') === except) return
    btn.setAttribute('aria-expanded', 'false')
  })
}

function togglePop(btn, menu) {
  if (!btn || !menu) return
  const next = menu.hidden
  closePops(next ? menu.id : '')
  menu.hidden = !next
  btn.setAttribute('aria-expanded', next ? 'true' : 'false')
}

function startPlaceholder() {
  const box = document.getElementById('studio-prompt')
  if (!box) return
  const ideas = HOME_PROMPT_IDEAS
  if (!ideas.length) return
  if (reduceMotion()) {
    box.placeholder = ideas[0]
    return
  }
  let i = 0
  let j = 0
  let dir = 1
  let timer = 0
  const tick = () => {
    if (document.activeElement === box || String(box.value || '').trim()) {
      box.placeholder = ''
      timer = setTimeout(tick, 400)
      return
    }
    const text = ideas[i] || ''
    j += dir
    if (j > text.length) {
      dir = -1
      timer = setTimeout(tick, 1100)
      return
    }
    if (j < 0) {
      dir = 1
      i = (i + 1) % ideas.length
      j = 0
    }
    box.placeholder = text.slice(0, Math.max(0, j))
    timer = setTimeout(tick, dir > 0 ? 36 : 16)
  }
  box.addEventListener('focus', () => { box.placeholder = '' })
  box.addEventListener('blur', () => {
    if (!String(box.value || '').trim() && !box.placeholder) box.placeholder = ideas[i] || ''
  })
  tick()
  box.dataset.phTimer = String(timer)
}

function bindRails(root) {
  root.querySelectorAll('.studio-rail-scroller').forEach((scroller) => {
    scroller.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      scroller.scrollLeft += e.deltaY
    }, { passive: false })
    scroller.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        scroller.scrollBy({ left: dir * 240, behavior: reduceMotion() ? 'auto' : 'smooth' })
      }
    })
  })
  root.querySelectorAll('.studio-tile, .studio-preset, .studio-inspire-card').forEach((card) => {
    const vid = card.querySelector('video')
    if (!vid) return
    card.addEventListener('mouseenter', () => { try { vid.play() } catch (_) {} })
    card.addEventListener('mouseleave', () => { try { vid.pause() } catch (_) {} })
    card.addEventListener('focus', () => { try { vid.play() } catch (_) {} })
    card.addEventListener('blur', () => { try { vid.pause() } catch (_) {} })
  })
}

function handleAttach(id) {
  closePops()
  if (id === 'upload') {
    if (!signedIn()) {
      window.openPreviewGate?.('auth')
      return
    }
    document.getElementById('studio-upload-input')?.click()
    return
  }
  if (id === 'url') {
    const pop = document.getElementById('studio-url-pop')
    if (pop) pop.hidden = !pop.hidden
  }
}

function submitImportUrl() {
  const url = String(document.getElementById('studio-url-input')?.value || '').trim()
  closePops()
  go('downloader')
  if (url) {
    const field = document.getElementById('dl-url')
    if (field) field.value = url
  }
}

function startMic() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition
  const btn = document.getElementById('studio-mic')
  const box = document.getElementById('studio-prompt')
  if (!Speech || !box) {
    if (btn) btn.title = 'Speech input is not available in this browser'
    return
  }
  const rec = new Speech()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.onresult = (e) => {
    const text = e.results?.[0]?.[0]?.transcript || ''
    if (text) box.value = (box.value ? box.value + ' ' : '') + text
  }
  rec.onerror = () => {}
  rec.start()
}

function bindShellEvents() {
  document.addEventListener('click', (e) => {
    const hrefBtn = e.target.closest('[data-href]')
    if (hrefBtn && hrefBtn.closest('#studio-sidebar, #studio-home-root, #studio-tools-root')) {
      e.preventDefault()
      const href = hrefBtn.getAttribute('data-href')
      if (href) location.href = href
      return
    }
    const launch = e.target.closest('[data-launch]')
    if (launch && !e.target.closest('.studio-launch')) {
      e.preventDefault()
      const id = launch.getAttribute('data-launch')
      const tool = studioToolById(id)
      if (tool?.external) location.href = tool.href
      else go(id)
      return
    }
    const goBtn = e.target.closest('[data-go]')
    if (goBtn && goBtn.closest('#studio-sidebar, #studio-home-root, #studio-tools-root, #studio-templates-root, #studio-tutorials-root, #studio-brandkit-root, .studio-topbar, #studio-pinned-rail')) {
      e.preventDefault()
      const format = goBtn.getAttribute('data-format')
      const id = goBtn.getAttribute('data-go')
      if (format) go(id, '?format=' + encodeURIComponent(format))
      else go(id)
      return
    }
    const chip = e.target.closest('[data-chip]')
    if (chip) {
      const box = document.getElementById('studio-prompt')
      if (box) box.value = chip.getAttribute('data-chip-fill') || ''
      const mode = chip.getAttribute('data-chip-mode')
      if (mode) setPromptMode(mode)
      box?.focus()
      return
    }
    if (e.target.closest('#studio-chips-more')) {
      const extra = document.getElementById('studio-chips-extra')
      const btn = document.getElementById('studio-chips-more')
      const open = extra?.hidden
      if (extra) extra.hidden = !open
      btn?.setAttribute('aria-expanded', open ? 'true' : 'false')
      if (btn) btn.hidden = !!open
      return
    }
    const cat = e.target.closest('[data-cat]')
    if (cat) {
      paintCatalog(cat.getAttribute('data-cat'))
      return
    }
    const inspire = e.target.closest('[data-inspire]')
    if (inspire) {
      paintInspire(inspire.getAttribute('data-inspire'))
      return
    }
    const tpl = e.target.closest('[data-tpl-cat]')
    if (tpl) {
      paintTemplates(tpl.getAttribute('data-tpl-cat'))
      return
    }
    const tut = e.target.closest('[data-tut-cat]')
    if (tut) {
      paintTutorials(tut.getAttribute('data-tut-cat'), document.getElementById('studio-tut-q')?.value || '')
      return
    }
    const arrow = e.target.closest('.studio-rail-arrow')
    if (arrow) {
      const scroller = document.getElementById(arrow.getAttribute('data-rail') || '')
      if (scroller) scroller.scrollBy({ left: Number(arrow.getAttribute('data-dir')) * 280, behavior: reduceMotion() ? 'auto' : 'smooth' })
      return
    }
    const homeModeBtn = e.target.closest('[data-home-mode]')
    if (homeModeBtn) {
      setHomeMode(homeModeBtn.getAttribute('data-home-mode'))
      return
    }
    const modeItem = e.target.closest('[data-prompt-mode]')
    if (modeItem) {
      setPromptMode(modeItem.getAttribute('data-prompt-mode'))
      return
    }
    const askItem = e.target.closest('[data-ask]')
    if (askItem) {
      const next = setAskMode(askItem.getAttribute('data-ask'))
      const label = document.getElementById('studio-ask-label')
      const row = ASK_BEHAVIORS.find((b) => b.id === next.askMode)
      if (label && row) label.textContent = row.label
      closePops()
      return
    }
    const attachItem = e.target.closest('[data-attach]')
    if (attachItem) {
      handleAttach(attachItem.getAttribute('data-attach'))
      return
    }
    if (e.target.closest('#studio-attach')) {
      togglePop(document.getElementById('studio-attach'), document.getElementById('studio-attach-menu'))
      return
    }
    if (e.target.closest('#studio-mode-btn')) {
      togglePop(document.getElementById('studio-mode-btn'), document.getElementById('studio-mode-menu'))
      return
    }
    if (e.target.closest('#studio-ask-btn')) {
      togglePop(document.getElementById('studio-ask-btn'), document.getElementById('studio-ask-menu'))
      return
    }
    if (e.target.closest('#studio-project-btn')) {
      togglePop(document.getElementById('studio-project-btn'), document.getElementById('studio-project-menu'))
      return
    }
    if (!e.target.closest('.studio-pop, #studio-project-btn, #studio-project-menu, #studio-url-pop')) closePops()
  })
  document.getElementById('studio-prompt-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    submitHomePrompt()
  })
  document.getElementById('studio-collapse')?.addEventListener('click', () => {
    applyCollapsed(!document.body.classList.contains('studio-collapsed'))
  })
  document.querySelector('.studio-topbar #studio-collapse')?.addEventListener('click', () => {
    applyCollapsed(!document.body.classList.contains('studio-collapsed'))
  })
  document.getElementById('studio-search-btn')?.addEventListener('click', openCmd)
  document.getElementById('nav-hamburger')?.addEventListener('click', (e) => {
    e.preventDefault()
    if (document.body.classList.contains('nav-open')) closeDrawer()
    else openDrawer()
  })
  document.getElementById('studio-scrim')?.addEventListener('click', closeDrawer)
  document.getElementById('studio-tut-q')?.addEventListener('input', (e) => {
    paintTutorials(document.getElementById('studio-tut-grid')?.dataset.cat || 'all', e.target.value)
  })
  document.getElementById('studio-mic')?.addEventListener('click', startMic)
  document.getElementById('studio-url-go')?.addEventListener('click', submitImportUrl)
  document.getElementById('studio-upload-input')?.addEventListener('change', (e) => {
    if (typeof window.uploadFile === 'function') window.uploadFile(e.target)
  })
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      const el = document.getElementById('studio-cmd')
      if (el && !el.hidden) closeCmd()
      else openCmd()
    }
    if (e.key === 'Escape') {
      closeCmd()
      closeDrawer()
      closePops()
    }
  })
  window.openMobileNav = openDrawer
  window.closeMobileNav = closeDrawer
  document.getElementById('studio-help-btn')?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap = document.getElementById('nav-help-wrap')
    const menu = document.getElementById('studio-help-menu')
    const open = !wrap?.classList.contains('is-open')
    wrap?.classList.toggle('is-open', open)
    menu?.classList.toggle('is-open', open)
    document.getElementById('studio-help-btn')?.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  document.addEventListener('click', (e) => {
    if (e.target.closest('#nav-help-wrap')) return
    document.getElementById('nav-help-wrap')?.classList.remove('is-open')
    document.getElementById('studio-help-menu')?.classList.remove('is-open')
  })
  decorateToolPages()
  try { window.applyVidsoLogos?.() } catch (_) {}
}

function decorateToolPages() {
  const ids = ['captions', 'voiceover', 'clipper', 'reframe', 'downloader', 'ranking', 'commentary', 'editor', 'videogen']
  ids.forEach((id) => {
    const panel = document.getElementById('panel-' + id)
    if (!panel || panel.querySelector('.studio-result-slot')) return
    const slot = document.createElement('div')
    slot.className = 'studio-result-slot'
    slot.innerHTML = phHtml('')
    panel.appendChild(slot)
  })
  bindPh(document)
}

window.studioPaintRecent = studioPaintRecent
window.studioOnPanelChange = studioOnPanelChange
window.applyStudioPrefill = applyStudioPrefill
