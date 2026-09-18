/** App studio shell: sidebar, top bar, home, catalog, skeleton pages. Presentation only. */

import { bindMediaPlaceholders } from './media-placeholder.js'
import {
  CATALOG_TABS,
  HOME_CHIPS,
  HOME_PROMPT_MODES,
  SIDEBAR_SECTIONS,
  STUDIO_LENGTH,
  STUDIO_PAGES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TUTORIALS,
  TUTORIAL_CATEGORIES,
  WHATS_NEW,
  allStudioTools,
  appMedia,
  catalogTools,
  mcpStripLogos,
  readCollapsed,
  readPinned,
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

function phHtml(src, extra = '') {
  const url = String(src || '').trim()
  const img = url
    ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`
    : ''
  return `<div class="studio-ph studio-ph-shimmer ${extra}" data-media-ph>${img}</div>`
}

function bindPh(root = document) {
  try { bindMediaPlaceholders(root) } catch (_) {}
}

function go(id, query) {
  window.closeMobileNav?.()
  window.closeStudioCmd?.()
  if (query) window.switchPanel?.(id, null, { query })
  else window.switchPanel?.(id, null)
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
  if (id === 'videogen' || id === 'imagegen') applyStudioPrefill()
}

export function studioPaintRecent(files) {
  const scroller = document.getElementById('studio-recent-scroller')
  if (!scroller) return
  const list = Array.isArray(files) ? files.slice(0, 12) : []
  if (!list.length) {
    scroller.innerHTML = `<div class="studio-empty" style="flex:1 1 100%">
      <h3>No recent renders</h3>
      <p>Exports from My Files show up here.</p>
      <button type="button" class="btn btn-primary btn-sm" data-go="videogen">Create your first video</button>
    </div>`
    return
  }
  scroller.innerHTML = list.map((f) => {
    const name = esc(f.original_name || 'Untitled')
    const url = String(f.url || '').trim()
    const media = url
      ? (String(f.mime_type || '').startsWith('video/')
        ? `<video src="${esc(url)}" muted playsinline preload="metadata"></video>`
        : `<img src="${esc(url)}" alt="" loading="lazy">`)
      : ''
    return `<a class="studio-tile" href="${esc(url || '/files')}">
      <div class="studio-ph studio-ph-shimmer">${media}</div>
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
}

function currentPanelId() {
  return document.querySelector('.panel.active')?.id?.replace(/^panel-/, '') || 'dashboard'
}

function homeMode() {
  return document.documentElement.dataset.studioHomeMode === 'tools' ? 'tools' : 'chat'
}

function setHomeMode(mode) {
  document.documentElement.dataset.studioHomeMode = mode === 'tools' ? 'tools' : 'chat'
  paintHomeMode(mode)
}

function catalogTab() {
  return document.documentElement.dataset.studioCatalogTab || 'popular'
}

function mountSidebar() {
  const el = document.getElementById('studio-sidebar')
  if (!el) return
  el.innerHTML = `
    <a class="studio-sidebar-brand" href="/home" aria-label="Vidso home">
      <img data-vidso-logo width="28" height="28" alt="">
      <span class="brand">Vidso</span>
    </a>
    <nav class="studio-sidebar-nav" id="studio-sidebar-nav" aria-label="Studio"></nav>
  `
  paintSidebar()
}

function paintSidebar() {
  const nav = document.getElementById('studio-sidebar-nav')
  if (!nav) return
  const pinned = readPinned()
  const parts = SIDEBAR_SECTIONS.map((sec) => {
    if (sec.pinned) {
      const items = pinned.map((id) => studioToolById(id)).filter(Boolean)
      const body = items.length
        ? items.map((it) => navBtn(it)).join('')
        : '<p class="studio-nav-empty">Pin tools from the catalog</p>'
      return `<span class="studio-nav-label">${esc(sec.label)}</span>${body}`
    }
    const label = sec.label ? `<span class="studio-nav-label">${esc(sec.label)}</span>` : ''
    return label + sec.items.map((it) => navBtn(it)).join('')
  })
  nav.innerHTML = parts.join('')
  syncNav(currentPanelId())
}

function navBtn(it) {
  const badge = it.badge ? `<span class="studio-nav-new">${esc(it.badge)}</span>` : ''
  return `<button type="button" class="studio-nav-item" data-panel="${esc(it.id)}" data-go="${esc(it.id)}" aria-label="${esc(it.name)}">
    <span class="studio-nav-ico" aria-hidden="true">${it.icon || ''}</span>
    <span class="studio-nav-txt">${esc(it.name)}</span>
    ${badge}
  </button>`
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

function mountHome() {
  const root = document.getElementById('studio-home-root')
  if (!root) return
  const logos = mcpStripLogos().map((l) => {
    const fb = l.fallback ? ` data-fallback="${esc(l.fallback)}"` : ''
    return `<img src="${esc(l.src)}" alt="${esc(l.client)}"${fb}>`
  }).join('')
  const chips = HOME_CHIPS.map((c) => `<button type="button" class="studio-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')
  const toolCards = allStudioTools().map((t) => `
    <button type="button" class="studio-tool-row" data-go="${esc(t.id)}">
      ${phHtml(toolThumb(t.slug))}
      <span class="studio-tool-copy"><strong>${esc(t.name)}</strong><p>${esc(t.description)}</p></span>
      <span class="studio-launch" aria-hidden="true">→</span>
    </button>`).join('')
  const news = WHATS_NEW.map((n) => `
    <button type="button" class="studio-tile" ${n.panel ? `data-go="${esc(n.panel)}"` : 'disabled'} aria-label="${esc(n.title || 'Announcement')}">
      ${phHtml(appMedia(n.image))}
      <div class="studio-tile-meta">${esc(n.title)}</div>
      <div class="studio-tile-sub">${esc(n.blurb)}</div>
    </button>`).join('')
  const templates = TEMPLATES.slice(0, 8).map((t) => `
    <button type="button" class="studio-tile" data-go="${esc(t.panel)}">
      ${phHtml(appMedia(t.file))}
      <div class="studio-tile-meta">${esc(t.title)}</div>
      <div class="studio-tile-sub">${esc(TEMPLATE_CATEGORIES.find((c) => c.id === t.category)?.label || '')}</div>
    </button>`).join('')

  root.innerHTML = `
    <div class="studio-home">
      <div class="studio-hero">
        <h1 id="studio-hello">What are we making today<span data-studio-hello></span>?</h1>
        <div class="studio-seg" role="tablist" aria-label="Home view">
          <button type="button" role="tab" id="studio-mode-chat" aria-selected="true" data-home-mode="chat">Chat</button>
          <button type="button" role="tab" id="studio-mode-tools" aria-selected="false" data-home-mode="tools">Tools</button>
        </div>
      </div>
      <div id="studio-home-chat">
        <form class="studio-prompt" id="studio-prompt-form">
          <label class="sr-only" for="studio-prompt">Prompt</label>
          <textarea id="studio-prompt" placeholder="Turn a topic into a narrated video..." rows="3"></textarea>
          <div class="studio-prompt-bar">
            <label class="sr-only" for="studio-prompt-mode">Mode</label>
            <select id="studio-prompt-mode">${HOME_PROMPT_MODES.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('')}</select>
            <label class="sr-only" for="studio-prompt-length">Length</label>
            <select id="studio-prompt-length"></select>
            <button type="button" class="studio-ico-btn" id="studio-mic" aria-label="Speech input" disabled title="Speech input is not available">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
            </button>
            <button type="submit" class="studio-send" id="studio-send" aria-label="Start">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </div>
        </form>
        <div class="studio-chips">${chips}</div>
        <div class="studio-mcp-row">
          <span>Create videos inside your AI agent</span>
          <span class="studio-mcp-logos">${logos}</span>
          <a class="btn btn-secondary btn-sm" href="/mcp">Set up MCP / CLI</a>
        </div>
        <div class="studio-stats" id="dash-stats">
          <div class="studio-stat"><div class="stat-num" id="dash-transcriptions">0</div><div class="stat-label">Transcriptions</div></div>
          <div class="studio-stat"><div class="stat-num" id="dash-voiceovers">0</div><div class="stat-label">Voiceovers</div></div>
          <div class="studio-stat"><div class="stat-num" id="dash-images">0</div><div class="stat-label">Thumbnails generated</div></div>
        </div>
      </div>
      <div id="studio-home-tools" hidden></div>
      <div id="studio-home-rails">
        <section class="studio-rail">
          <div class="studio-rail-head">
            <h2>Your recent renders</h2>
            <a class="studio-rail-more" href="/files" data-go="files">More</a>
          </div>
          <div class="studio-rail-track">
            <button type="button" class="studio-rail-arrow" data-rail="studio-recent-scroller" data-dir="-1" aria-label="Scroll recent left">‹</button>
            <button type="button" class="studio-rail-arrow" data-rail="studio-recent-scroller" data-dir="1" aria-label="Scroll recent right">›</button>
            <div class="studio-rail-scroller" id="studio-recent-scroller"></div>
          </div>
        </section>
        <div id="dash-recent" hidden></div>
        <section class="studio-rail">
          <div class="studio-rail-head">
            <h2>Start from a template</h2>
            <a class="studio-rail-more" href="/templates" data-go="templates">More</a>
          </div>
          <div class="studio-rail-track">
            <button type="button" class="studio-rail-arrow" data-rail="studio-tpl-scroller" data-dir="-1" aria-label="Scroll templates left">‹</button>
            <button type="button" class="studio-rail-arrow" data-rail="studio-tpl-scroller" data-dir="1" aria-label="Scroll templates right">›</button>
            <div class="studio-rail-scroller" id="studio-tpl-scroller">${templates}</div>
          </div>
        </section>
        <section class="studio-rail">
          <div class="studio-rail-head">
            <h2>What's new</h2>
          </div>
          <div class="studio-rail-track">
            <button type="button" class="studio-rail-arrow" data-rail="studio-news-scroller" data-dir="-1" aria-label="Scroll announcements left">‹</button>
            <button type="button" class="studio-rail-arrow" data-rail="studio-news-scroller" data-dir="1" aria-label="Scroll announcements right">›</button>
            <div class="studio-rail-scroller" id="studio-news-scroller">${news}</div>
          </div>
        </section>
        <section class="studio-rail">
          <div class="studio-rail-head">
            <h2>Get started with tools</h2>
            <a class="studio-rail-more" href="/tools" data-go="tools">More</a>
          </div>
          <div class="studio-tool-grid" id="studio-home-toolgrid">${toolCards}</div>
        </section>
      </div>
    </div>`
  paintLengthOptions()
  studioPaintRecent([])
  bindPh(root)
  root.querySelectorAll('.studio-mcp-logos img').forEach((img) => {
    img.addEventListener('error', () => {
      const fb = img.getAttribute('data-fallback')
      if (fb && img.src !== fb) img.src = fb
      else img.remove()
    })
  })
}

function paintHomeMode(mode) {
  const tools = mode === 'tools'
  document.getElementById('studio-mode-chat')?.setAttribute('aria-selected', tools ? 'false' : 'true')
  document.getElementById('studio-mode-tools')?.setAttribute('aria-selected', tools ? 'true' : 'false')
  const chat = document.getElementById('studio-home-chat')
  const rails = document.getElementById('studio-home-rails')
  const embed = document.getElementById('studio-home-tools')
  if (chat) chat.hidden = tools
  if (rails) rails.hidden = tools
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
    ? `<h1>Your studio, your controls</h1><p class="studio-catalog-sub">Every Vidso tool in one place.</p>`
    : ''
  return `<div class="studio-catalog">${head}
    <div class="studio-tabs" role="tablist" aria-label="Tool categories">${tabs}</div>
    <div class="studio-tool-grid">${rows}</div>
  </div>`
}

function toolRowHtml(t) {
  const pinned = readPinned().includes(t.id)
  return `<div class="studio-tool-row" data-launch="${esc(t.id)}">
    ${phHtml(toolThumb(t.slug))}
    <div class="studio-tool-copy"><strong>${esc(t.name)}</strong><p>${esc(t.description)}</p></div>
    <button type="button" class="studio-pin${pinned ? ' is-on' : ''}" data-pin="${esc(t.id)}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(t.name)}" aria-pressed="${pinned ? 'true' : 'false'}">
      <svg width="14" height="14" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3L8 3z"/></svg>
    </button>
    <button type="button" class="studio-launch" data-go="${esc(t.id)}" aria-label="Open ${esc(t.name)}">→</button>
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

function paintLengthOptions() {
  const mode = document.getElementById('studio-prompt-mode')?.value || 'long'
  const sel = document.getElementById('studio-prompt-length')
  if (!sel) return
  const show = mode === 'long' || mode === 'shorts'
  sel.hidden = !show
  if (!show) return
  const list = mode === 'shorts' ? STUDIO_LENGTH.shorts : STUDIO_LENGTH.long
  sel.innerHTML = list.map((d) => `<option value="${esc(d.id)}">${esc(d.label)}</option>`).join('')
}

function submitHomePrompt() {
  const text = String(document.getElementById('studio-prompt')?.value || '').trim()
  const modeId = document.getElementById('studio-prompt-mode')?.value || 'long'
  const mode = HOME_PROMPT_MODES.find((m) => m.id === modeId) || HOME_PROMPT_MODES[0]
  const length = document.getElementById('studio-prompt-length')?.value || ''
  const params = new URLSearchParams()
  if (mode.panel === 'imagegen') {
    if (text) params.set('prompt', text)
  } else {
    if (text) params.set('topic', text)
    if (mode.format) params.set('format', mode.format)
    if (length && mode.format) params.set('duration', length)
  }
  const q = params.toString()
  go(mode.panel, q ? '?' + q : '')
}

function applyCollapsed(on, { silent } = {}) {
  document.body.classList.toggle('studio-collapsed', !!on)
  const btn = document.getElementById('studio-collapse')
  if (btn) {
    btn.setAttribute('aria-expanded', on ? 'false' : 'true')
    btn.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar')
  }
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

function bindShellEvents() {
  document.addEventListener('click', (e) => {
    const pin = e.target.closest('[data-pin]')
    if (pin) {
      e.preventDefault()
      e.stopPropagation()
      togglePinned(pin.getAttribute('data-pin'))
      paintSidebar()
      paintCatalog(catalogTab())
      return
    }
    const launch = e.target.closest('[data-launch]')
    if (launch && !e.target.closest('[data-pin]')) {
      e.preventDefault()
      go(launch.getAttribute('data-launch'))
      return
    }
    const goBtn = e.target.closest('[data-go]')
    if (goBtn && goBtn.closest('#studio-sidebar, #studio-home-root, #studio-tools-root, #studio-templates-root, #studio-tutorials-root, #studio-brandkit-root, .studio-topbar')) {
      e.preventDefault()
      go(goBtn.getAttribute('data-go'))
      return
    }
    const chip = e.target.closest('[data-chip]')
    if (chip) {
      const box = document.getElementById('studio-prompt')
      if (box) box.value = chip.getAttribute('data-chip') || ''
      box?.focus()
      return
    }
    const cat = e.target.closest('[data-cat]')
    if (cat) {
      paintCatalog(cat.getAttribute('data-cat'))
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
      if (scroller) scroller.scrollBy({ left: Number(arrow.getAttribute('data-dir')) * 240, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
    const homeModeBtn = e.target.closest('[data-home-mode]')
    if (homeModeBtn) setHomeMode(homeModeBtn.getAttribute('data-home-mode'))
  })
  document.getElementById('studio-prompt-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    submitHomePrompt()
  })
  document.getElementById('studio-prompt-mode')?.addEventListener('change', paintLengthOptions)
  document.getElementById('studio-collapse')?.addEventListener('click', () => {
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
