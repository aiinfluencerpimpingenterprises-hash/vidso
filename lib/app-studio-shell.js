/** App studio shell: sidebar, top bar, home, catalog, skeleton pages. Presentation only. */

import { bindMediaPlaceholders } from './media-placeholder.js'
import { getAskMode, setAskMode } from './studio-workspace.js'
import { bindCatalogClipLoop, catalogClipLoopSeconds, catalogHasClip, featuredMediaId, featuredModels, modelCardClipSrc, modelCardSrc, modelSlug } from './vidso-models.js'
import {
  ASK_BEHAVIORS,
  ATTACH_GROUPS,
  AVATAR_MENU,
  CATALOG_TABS,
  HELP_MENU,
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
  VISUAL_STYLES,
  WHATS_NEW,
  WORKSPACE_PILL,
  allStudioTools,
  appMedia,
  catalogTools,
  inspireItems,
  inspireMedia,
  mcpStripLogos,
  readCollapsed,
  readPinned,
  readShutSecs,
  startMedia,
  studioToolById,
  togglePinned,
  toggleShutSec,
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
  quickstart: 'Quick start',
  homepresets: 'Presets',
  inspirecat: 'Inspirations',
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
  const ico = kind === 'video' ? ICO.videogen : kind === 'audio' ? ICO.voiceover : ICO.imagegen
  return `<div class="studio-ph studio-ph-shimmer ${extra}" data-media-ph>
    <span class="studio-ph-ico" aria-hidden="true">${ico}</span>
    ${media}
  </div>`
}

function bindPh(root = document) {
  try { bindMediaPlaceholders(root) } catch (_) {}
  const scope = root.querySelectorAll ? root : document
  scope.querySelectorAll('[data-media-ph] video').forEach((vid) => {
    if (vid.dataset.phBound) return
    vid.dataset.phBound = '1'
    vid.addEventListener('error', () => vid.remove())
  })
  scope.querySelectorAll('.studio-model-card video').forEach((vid) => {
    if (vid.dataset.loopBound) return
    vid.dataset.loopBound = '1'
    const id = vid.closest('.studio-model-card')?.getAttribute('data-model') || ''
    bindCatalogClipLoop(vid, catalogClipLoopSeconds(id))
  })
}

function go(id, query) {
  window.closeMobileNav?.()
  window.closeStudioCmd?.()
  closeModals()
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
  mountQuickStart()
  mountHomePresets()
  mountInspireCat()
  mountModals()
  bindShellEvents()
  applyCollapsed(readCollapsed(), { silent: true })
  syncNav(currentPanelId())
  applyStudioPrefill()
  paintAccountChrome()
  syncSendState()
  window.addEventListener('resize', onResize)
  onResize()
  try { window.applyVidsoLogos?.() } catch (_) {}
  try { window.applyVidsoSocialLinks?.() } catch (_) {}
}

export function studioOnPanelChange(id) {
  syncNav(id)
  const crumb = document.getElementById('topbar-title')
  if (crumb) {
    if (id === 'inspirecat') {
      const cat = INSPIRE_CATEGORIES.find((c) => c.id === inspirePage()) || INSPIRE_CATEGORIES[0]
      crumb.textContent = cat.label
    } else crumb.textContent = TITLES[id] || 'Vidso'
  }
  if (id === 'dashboard') paintHomeMode(homeMode())
  if (id === 'tools') paintCatalog(catalogTab())
  if (id === 'quickstart') mountQuickStart()
  if (id === 'homepresets') mountHomePresets()
  if (id === 'inspirecat') mountInspireCat()
  if (id === 'videogen' || id === 'imagegen' || id === 'voiceover') applyStudioPrefill()
  const main = document.querySelector('body.studio-shell .content')
  if (main) {
    main.classList.remove('is-enter')
    if (!reduceMotion()) {
      void main.offsetWidth
      main.classList.add('is-enter')
    }
  }
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
      <span class="studio-tile-shot">
        <div class="studio-ph studio-ph-shimmer is-wide">${media}<span class="studio-ph-ico" aria-hidden="true">${ICO.videogen}</span><span class="studio-scrim-grad"></span></div>
        <span class="studio-tile-chip"><span class="studio-tile-chip-ico">${ICO.videogen}</span>${video ? 'Video' : 'Image'}</span>
        <span class="studio-play" aria-hidden="true">${ICO.play}</span>
      </span>
      <span class="studio-tile-meta">${name}</span>
    </a>`
  }).join('')
  bindCardMedia(scroller)
}

export function applyStudioPrefill() {
  let topic = ''
  let prompt = ''
  let format = ''
  let duration = ''
  try {
    const q = new URLSearchParams(location.search || '')
    topic = (q.get('topic') || q.get('idea') || q.get('brief') || '').trim()
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
  syncSendState()
}

export function studioPaintAccount() {
  paintAccountChrome()
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

function inspirePage() {
  return document.documentElement.dataset.studioInspirePage || inspireTab()
}

function planBadge() {
  const user = window.currentUser || {}
  const plan = String(user.plan || user.plan_tier || user.tier || '')
  if (/studio/i.test(plan)) return 'Studio'
  if (/business/i.test(plan)) return 'Business'
  if (/pro/i.test(plan)) return 'Pro'
  return 'Free'
}

function mountSidebar() {
  const el = document.getElementById('studio-sidebar')
  if (!el) return
  el.innerHTML = `
    <div class="studio-brand-row">
      <a class="studio-side-logo" href="/home" aria-label="Vidso home">
        <img data-vidso-logo width="22" height="22" alt="" decoding="async">
        <span class="studio-side-word">Vidso</span>
        <span class="studio-plan-badge" id="studio-plan-badge">${esc(planBadge())}</span>
      </a>
      <button type="button" class="studio-ico-btn studio-collapse-btn" id="studio-collapse" aria-label="Collapse sidebar" aria-expanded="true">
        ${ICO.panel}
      </button>
    </div>
    <button type="button" class="studio-project" id="studio-project-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-project-menu">
      <span class="studio-project-mark" aria-hidden="true">${esc(workspaceInitial())}</span>
      <span class="studio-project-txt">${esc(WORKSPACE_PILL.label)}</span>
      <span class="studio-project-chev" aria-hidden="true">${ICO.chev}</span>
    </button>
    <div class="studio-project-menu" id="studio-project-menu" hidden role="menu">
      <button type="button" role="menuitem" aria-checked="true" id="studio-side-ws-item">${esc(WORKSPACE_PILL.label)}</button>
      <button type="button" role="menuitem" data-workspace-manage>Manage workspace</button>
      <p>${esc(WORKSPACE_PILL.hint)}</p>
    </div>
    <nav class="studio-sidebar-nav" id="studio-sidebar-nav" aria-label="Studio"></nav>
  `
  paintSidebar()
  try { window.applyVidsoLogos?.() } catch (_) {}
}

function paintSidebar() {
  const nav = document.getElementById('studio-sidebar-nav')
  if (!nav) return
  const shut = readShutSecs()
  const pinned = readPinned()
  const parts = SIDEBAR_SECTIONS.map((sec) => {
    const closed = !!shut[sec.id]
    const label = sec.label
      ? `<button type="button" class="studio-nav-label" data-sec-toggle="${esc(sec.id)}" aria-expanded="${closed ? 'false' : 'true'}">
          <span class="studio-nav-chev" aria-hidden="true">${ICO.chev}</span>
          <span>${esc(sec.id === 'pinned' ? 'Pinned tools' : sec.label)}</span>
        </button>`
      : ''
    if (sec.pinned) {
      const items = pinned.map((id) => studioToolById(id)).filter(Boolean)
      const all = `<button type="button" class="studio-nav-item is-all" data-go="tools" data-panel="tools" title="All tools" aria-label="All tools">
        <span class="studio-nav-ico" aria-hidden="true">${ICO.grid}</span>
        <span class="studio-nav-txt">All tools</span>
        <span class="studio-nav-chev" aria-hidden="true">${ICO.chev}</span>
      </button>`
      const body = items.map((it) => {
        const goAttr = it.external ? `data-href="${esc(it.href)}"` : `data-go="${esc(it.id)}"`
        return `<button type="button" class="studio-nav-item" ${goAttr} data-panel="${esc(it.id)}" title="${esc(it.name)}" aria-label="${esc(it.name)}">
          <span class="studio-nav-ico" aria-hidden="true">${it.icon || ICO.tools}</span>
          <span class="studio-nav-txt">${esc(it.short || it.name)}</span>
        </button>`
      }).join('')
      return `<div class="studio-nav-sec${closed ? ' is-shut' : ''}" data-sec="${esc(sec.id)}">${label}<div class="studio-nav-sec-body">${all}${body}</div></div>`
    }
    const create = sec.id === 'create'
    const items = sec.chips
      ? `<div class="studio-nav-sec-body"><div class="studio-nav-tools">${sec.items.map((it) => navChip(it)).join('')}</div></div>`
      : `<div class="studio-nav-sec-body">${sec.items.map((it) => navBtn(it, create)).join('')}</div>`
    return `<div class="studio-nav-sec${closed ? ' is-shut' : ''}" data-sec="${esc(sec.id)}">${label}${items}</div>`
  })
  nav.innerHTML = parts.join('')
  bindPh(nav)
  syncNav(currentPanelId())
}

function navBtn(it, create) {
  const badge = it.badge ? `<span class="studio-nav-new">${esc(it.badge)}</span>` : ''
  const goAttr = it.external ? `data-href="${esc(it.href)}"` : `data-go="${esc(it.id)}"`
  const home = it.id === 'dashboard'
  const extra = create ? ' is-create' : home ? ' is-home' : ''
  const title = it.fullName || it.name
  return `<button type="button" class="studio-nav-item${extra}" data-panel="${esc(it.id)}" ${goAttr} title="${esc(title)}" aria-label="${esc(title)}">
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

function syncNav(panelId) {
  document.querySelectorAll('#studio-sidebar [data-panel]').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-panel') === panelId)
  })
}

function workspaceName() {
  const user = window.currentUser || {}
  const first = String(user.name || '').trim().split(/\s+/)[0]
  if (first && !/^(preview|your|account)$/i.test(first)) return first + "'s workspace"
  return 'My workspace'
}

function workspaceInitial() {
  const label = workspaceName()
  return /my workspace/i.test(label) ? 'M' : label.charAt(0).toUpperCase()
}

function mountTopbarExtras() {
  const left = document.querySelector('.studio-topbar-left')
  if (left && !document.getElementById('studio-workspace-btn')) {
    const wrap = document.createElement('div')
    wrap.className = 'studio-pop studio-workspace-pop'
    wrap.innerHTML = `
      <button type="button" class="studio-workspace-btn" id="studio-workspace-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-workspace-menu">
        <span class="studio-ws-tile" id="studio-ws-tile">${esc(workspaceInitial())}</span>
        <span id="studio-ws-label">${esc(WORKSPACE_PILL.label)}</span>
      </button>
      <div class="studio-mini-menu studio-drop-menu" id="studio-workspace-menu" hidden role="menu">
        <button type="button" role="menuitem" aria-checked="true" id="studio-ws-item">${esc(WORKSPACE_PILL.label)}</button>
        <button type="button" role="menuitem" data-workspace-manage>Manage workspace</button>
      </div>`
    const crumb = document.getElementById('topbar-title')
    if (crumb) left.insertBefore(wrap, crumb)
    else left.appendChild(wrap)
  }
  const av = document.getElementById('user-avatar')
  if (av && !av.innerHTML.trim() && !av.textContent.trim()) av.innerHTML = ICO.user
  const help = document.getElementById('studio-help-menu')
  if (help) {
    help.innerHTML = HELP_MENU.map((item) => {
      const extra = item.extra ? ` data-help="${esc(item.extra)}"` : ''
      const goAttr = item.go ? ` data-go="${esc(item.go)}"` : ''
      const href = item.href || '#'
      return `<a role="menuitem" href="${esc(href)}"${goAttr}${extra}>${menuIco(item.icon)}<span>${esc(item.label)}</span></a>`
    }).join('') + `<div class="studio-help-rule"></div><div class="studio-help-socials" data-vidso-socials></div>`
  }
  const avatar = document.getElementById('nav-avatar-menu')
  if (avatar) {
    const nameEl = avatar.querySelector('#user-name')
    const emailEl = avatar.querySelector('#user-email')
    const name = nameEl?.textContent || 'Your account'
    const email = emailEl?.textContent || '...'
    const keep = []
    avatar.querySelectorAll('[role="menuitem"]').forEach((el) => {
      if (['user-getting-started-btn', 'nav-yt-mcp-btn', 'user-studio-btn'].includes(el.id)) {
        el.hidden = true
        keep.push(el)
      }
    })
    const rows = AVATAR_MENU.map((item) => {
      const rule = item.action === 'logout' ? '<div class="studio-help-rule"></div>' : ''
      return `${rule}<button type="button" role="menuitem" data-avatar="${esc(item.action)}">${menuIco(item.icon)}${esc(item.label)}</button>`
    }).join('')
    avatar.innerHTML = `
      <div class="studio-account-head">
        <span class="studio-account-face" id="studio-account-face" aria-hidden="true"></span>
        <div class="studio-account-copy">
          <strong class="user-name" id="user-name">${esc(name)}</strong>
          <span class="user-email" id="user-email">${esc(email)}</span>
        </div>
      </div>
      ${rows}`
    keep.forEach((el) => avatar.appendChild(el))
  }
  try { window.applyVidsoSocialLinks?.() } catch (_) {}
}

function paintAccountChrome() {
  const user = window.currentUser || {}
  const plan = String(user.plan || user.plan_tier || user.tier || '')
  const top = /studio|business/i.test(plan)
  const upgrade = document.getElementById('studio-upgrade')
  if (upgrade) upgrade.hidden = top
  const label = workspaceName()
  const initial = workspaceInitial()
  const wsLabel = document.getElementById('studio-ws-label')
  const wsTile = document.getElementById('studio-ws-tile')
  const wsItem = document.getElementById('studio-ws-item')
  if (wsLabel) wsLabel.textContent = label
  if (wsTile) wsTile.textContent = initial
  if (wsItem) wsItem.textContent = label
  const sideTxt = document.querySelector('.studio-project-txt')
  const sideMark = document.querySelector('.studio-project-mark')
  if (sideTxt) sideTxt.textContent = label
  if (sideMark) sideMark.textContent = initial
  const sideItem = document.getElementById('studio-side-ws-item')
  if (sideItem) sideItem.textContent = label
  const badge = document.getElementById('studio-plan-badge')
  if (badge) badge.textContent = planBadge()
  const av = document.getElementById('user-avatar')
  const face = document.getElementById('studio-account-face')
  const letter = String(user.name || user.email || '').trim().charAt(0)
  const paintFace = (el) => {
    if (!el) return
    if (letter) {
      el.classList.remove('is-icon')
      el.textContent = letter.toUpperCase()
    } else {
      el.classList.add('is-icon')
      el.innerHTML = ICO.user
    }
  }
  paintFace(av)
  paintFace(face)
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
window.studioPaintAccount = paintAccountChrome

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

function formatCard(f, { brief = true } = {}) {
  const badge = f.badge ? `<span class="studio-badge">${esc(f.badge)}</span>` : ''
  const chip = f.chip ? `<span class="studio-tile-chip"><span class="studio-tile-chip-ico">${ICO[f.panel] || ICO.videogen}</span>${esc(f.chip)}</span>` : ''
  const ratio = f.ratio === '9:16' ? 'is-portrait' : 'is-wide'
  const action = brief ? `data-brief="${esc(f.id)}"` : `data-go="${esc(f.panel)}" data-format="${esc(f.format || '')}"`
  return `<button type="button" class="studio-tile" ${action} aria-label="${esc(f.label)}">
    <span class="studio-tile-shot">
      ${phHtml(startMedia(f.slug), ratio, 'video')}
      <span class="studio-scrim-grad"></span>
      ${badge}
      ${chip}
      <span class="studio-play" aria-hidden="true">${ICO.play}</span>
    </span>
    <span class="studio-tile-meta">${esc(f.label)}</span>
  </button>`
}

function startCards() {
  return START_FORMATS.map((f) => formatCard(f)).join('')
}

function newsCards() {
  return WHATS_NEW.map((n) => {
    const goAttr = n.panel ? `data-go="${esc(n.panel)}"` : n.href ? `data-href="${esc(n.href)}"` : 'disabled'
    return `<button type="button" class="studio-tile studio-news-card" ${goAttr} aria-label="${esc(n.title)}">
      <span class="studio-tile-shot">
        ${phHtml(appMedia(n.image), 'is-news')}
        <span class="studio-scrim-grad is-heavy"></span>
        <span class="studio-tag is-${esc(n.tagTone || 'new')}">${esc(n.tag)}</span>
        <span class="studio-tile-copy is-news">
          <span class="studio-tile-meta">${esc(n.title)}</span>
        </span>
      </span>
    </button>`
  }).join('')
}

function presetCards(list = HOME_PRESETS) {
  return list.map((t, i) => `
    <button type="button" class="studio-preset" data-go="${esc(t.panel)}" data-brief-fill="${esc(t.title)}" aria-label="${esc(t.title)}">
      <span class="studio-tile-shot">
        ${phHtml(appMedia(t.file), i % 3 === 0 ? 'is-portrait' : i % 3 === 1 ? 'is-square' : 'is-wide')}
        <span class="studio-scrim-grad"></span>
        <span class="studio-use">Use</span>
        <span class="studio-play" aria-hidden="true">${ICO.play}</span>
      </span>
      <span class="studio-tile-meta">${esc(t.title)}</span>
    </button>`).join('')
}

function toolRowHtml(t, { pin = true } = {}) {
  const goAttr = t.external ? `data-href="${esc(t.href)}"` : `data-go="${esc(t.id)}"`
  const pinned = readPinned().includes(t.id)
  const badge = t.badge ? `<span class="studio-nav-new">${esc(t.badge)}</span>` : ''
  const pinBtn = pin
    ? `<button type="button" class="studio-pin${pinned ? ' is-on' : ''}" data-pin="${esc(t.id)}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(t.name)}" aria-pressed="${pinned ? 'true' : 'false'}">${ICO.pin}</button>`
    : ''
  return `<div class="studio-tool-row" data-launch="${esc(t.id)}">
    ${phHtml(toolThumb(t.slug))}
    <div class="studio-tool-copy"><strong>${esc(t.name)}${badge}</strong><p>${esc(t.description)}</p></div>
    ${pinBtn}
    <button type="button" class="studio-launch" ${goAttr} aria-label="Open ${esc(t.name)}">→</button>
  </div>`
}

function toolCardsHtml() {
  return allStudioTools().filter((t) => t.id !== 'mcp').map((t) => toolRowHtml(t)).join('')
}

function modelCards() {
  return featuredModels().filter((m) => m.id !== 'claude').map((m) => {
    const mediaId = featuredMediaId(m.id)
    const clip = catalogHasClip(mediaId) ? modelCardClipSrc(mediaId) : ''
    const media = clip ? phHtml(clip, 'is-wide', 'video') : phHtml(modelCardSrc(mediaId), 'is-wide')
    return `<a class="studio-tile studio-model-card" data-model="${esc(mediaId)}" href="${esc('/models#' + modelSlug(mediaId))}" aria-label="${esc(m.name)}">
      <span class="studio-tile-shot">
        ${media}
        ${m.isNew ? '<span class="studio-badge">New</span>' : ''}
      </span>
      <span class="studio-tile-meta">${esc(m.name)}</span>
    </a>`
  }).join('')
}

function menuIco(name) {
  return `<span class="studio-menu-ico" aria-hidden="true">${ICO[name] || ICO.plus}</span>`
}

function attachMenuHtml() {
  const icos = { 'local-image': 'imagegen', 'local-audio': 'voiceover', 'local-video': 'videogen', files: 'files', brandkit: 'brandkit' }
  return ATTACH_GROUPS.map((g) => `
    <div class="studio-menu-group">${esc(g.label)}</div>
    ${g.items.map((a) => `<button type="button" role="menuitem" data-attach="${esc(a.id)}">${menuIco(icos[a.id])}${esc(a.label)}</button>`).join('')}
  `).join('')
}

function modeMenuHtml() {
  const cur = document.getElementById('studio-prompt-mode')?.value || 'long'
  return HOME_PROMPT_MODES.map((m) => `<button type="button" role="menuitem" data-prompt-mode="${esc(m.id)}" aria-checked="${m.id === cur ? 'true' : 'false'}">
    ${menuIco(m.icon)}
    <span class="studio-menu-copy"><strong>${esc(m.label)}</strong><small>${esc(m.hint)}</small></span>
    ${m.id === cur ? `<span class="studio-menu-check">${ICO.check}</span>` : ''}
  </button>`).join('')
}

function askMenuHtml() {
  const cur = getAskMode()
  return ASK_BEHAVIORS.map((b) => `<button type="button" role="menuitem" data-ask="${esc(b.id)}" aria-checked="${b.id === cur ? 'true' : 'false'}">
    ${menuIco(b.icon)}
    <span class="studio-menu-copy"><strong>${esc(b.label)}</strong><small>${esc(b.hint)}</small></span>
    ${b.id === cur ? `<span class="studio-menu-check">${ICO.check}</span>` : ''}
  </button>`).join('')
}

function moreMenuHtml() {
  return HOME_CHIPS_MORE.map((c) => `<button type="button" role="menuitem" data-chip="${esc(c.id)}" data-chip-fill="${esc(c.fill)}" data-chip-mode="${esc(c.mode)}">
    ${menuIco(c.icon || 'videogen')}
    <span class="studio-menu-copy">${esc(c.label)}</span>
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
  const ask = ASK_BEHAVIORS.find((b) => b.id === getAskMode()) || ASK_BEHAVIORS[0]

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
          <div class="studio-attach-chips" id="studio-attach-chips" hidden></div>
          <textarea id="studio-prompt" rows="3" autocomplete="off"></textarea>
          <div class="studio-prompt-bar">
            <div class="studio-prompt-left">
              <div class="studio-pop" id="studio-attach-wrap">
                <button type="button" class="studio-round-btn" id="studio-attach" aria-label="Attach" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-attach-menu">${ICO.plus}</button>
                <div class="studio-mini-menu studio-drop-menu" id="studio-attach-menu" hidden role="menu">${attachMenuHtml()}</div>
              </div>
              <div class="studio-pop" id="studio-mode-wrap">
                <button type="button" class="studio-drop-btn" id="studio-mode-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-mode-menu">
                  <span id="studio-mode-label">Long-form</span><span aria-hidden="true">${ICO.chev}</span>
                </button>
                <div class="studio-mini-menu studio-drop-menu is-wide" id="studio-mode-menu" hidden role="menu">${modeMenuHtml()}</div>
              </div>
              <input type="hidden" id="studio-prompt-mode" value="long">
            </div>
            <div class="studio-prompt-right">
              <div class="studio-pop" id="studio-ask-wrap">
                <button type="button" class="studio-drop-btn is-ghost" id="studio-ask-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-ask-menu">
                  <span id="studio-ask-label">${esc(ask.label)}</span><span aria-hidden="true">${ICO.chev}</span>
                </button>
                <div class="studio-mini-menu studio-drop-menu is-ask is-end" id="studio-ask-menu" hidden role="menu">${askMenuHtml()}</div>
              </div>
              <button type="button" class="studio-round-btn" id="studio-mic" aria-label="Speech input">${ICO.mic}</button>
              <button type="submit" class="studio-send is-dim" id="studio-send" aria-label="Start" disabled>${ICO.send}</button>
            </div>
          </div>
        </form>
        <div class="studio-chips" id="studio-chips">
          ${chips}
          <div class="studio-pop">
            <button type="button" class="studio-chip" id="studio-chips-more" aria-haspopup="menu" aria-expanded="false" aria-controls="studio-more-menu">More</button>
            <div class="studio-mini-menu studio-drop-menu is-wide" id="studio-more-menu" hidden role="menu">${moreMenuHtml()}</div>
          </div>
        </div>
        <input type="file" id="studio-upload-input" hidden>
      </div>
      <div id="studio-home-tools" hidden></div>
      <div class="studio-mcp-row">
        <span class="studio-mcp-spark" aria-hidden="true">${ICO.spark}</span>
        <span class="studio-mcp-copy">Create videos inside your AI agent</span>
        <span class="studio-mcp-logos">${logos}</span>
        <a class="studio-mcp-btn" href="/mcp">Set up MCP / CLI ↗</a>
      </div>
      <div id="studio-home-rails">
        <section class="studio-rail" id="rail-start">
          ${railHead('Start creating', 'More →', 'quickstart', '/home/quick-start')}
          ${railTrack('studio-start-scroller', startCards(), 'is-mixed')}
        </section>
        <section class="studio-rail" id="rail-recent">
          ${railHead('Your recent renders', 'More →', 'files', '/files')}
          ${railTrack('studio-recent-scroller', '')}
        </section>
        <div id="dash-recent" hidden></div>
        <section class="studio-rail" id="rail-news">
          ${railHead("What's new", 'More →', '', '/models')}
          ${railTrack('studio-news-scroller', newsCards(), 'is-news')}
        </section>
        <section class="studio-rail" id="rail-presets">
          ${railHead('Presets', 'More →', 'homepresets', '/home/presets')}
          ${railTrack('studio-preset-scroller', presetCards(HOME_PRESETS.slice(0, 12)), 'is-wide')}
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
        <section class="studio-rail" id="rail-models">
          ${railHead('Latest AI models', 'More →', '', '/models')}
          ${railTrack('studio-models-scroller', modelCards(), 'is-wide')}
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
  const items = inspireItems(cat.id)
  const cells = items.slice(0, 6).map((it, i) => `
    <button type="button" class="studio-inspire-card is-n${i + 1}" data-inspire-open="${esc(it.id)}" aria-label="${esc(it.title)}">
      <span class="studio-tile-shot">
        ${phHtml(appMedia(it.file), i === 0 || i === 3 ? 'is-wide' : '')}
        <span class="studio-scrim-grad"></span>
        <span class="studio-inspire-hover">
          <span>${esc(it.creator)}</span>
          <span class="studio-direct-pill">Direct this</span>
        </span>
      </span>
    </button>`).join('')
  panel.innerHTML = `<div class="studio-inspire-head">
      <div>
        <h3>${esc(cat.label)}</h3>
        <p>${esc(cat.description)}</p>
      </div>
      <a class="studio-rail-more" href="/home/inspirations/${esc(cat.id)}" data-go="inspirecat" data-inspire-page="${esc(cat.id)}">See all</a>
    </div>
    <div class="studio-inspire-grid">${cells}</div>`
  bindPh(panel)
  syncTabIndicator(document.getElementById('rail-inspire'))
}

function paintHomeMode(mode) {
  const tools = mode === 'tools'
  document.querySelector('.studio-seg')?.classList.toggle('is-tools', tools)
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
      syncTabIndicator(embed)
    }
  }
}

function catalogHtml(pageHeading) {
  const tab = catalogTab()
  const tabs = CATALOG_TABS.map((t) => `<button type="button" class="studio-tab" role="tab" data-cat="${esc(t.id)}" aria-selected="${t.id === tab ? 'true' : 'false'}">${esc(t.label)}</button>`).join('')
  const rows = catalogTools(tab).map((t) => toolRowHtml(t)).join('')
  const head = pageHeading ? `<h1>Your studio, your controls</h1>` : ''
  return `<div class="studio-catalog">${head}
    <div class="studio-tabs" role="tablist" aria-label="Tool categories">${tabs}</div>
    <div class="studio-tool-grid">${rows || '<div class="studio-empty"><h3>No tools in this category</h3></div>'}</div>
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
    syncTabIndicator(root)
  }
  const embed = document.getElementById('studio-home-tools')
  if (embed && !embed.hidden) {
    embed.innerHTML = catalogHtml(false)
    bindPh(embed)
    syncTabIndicator(embed)
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

function pageBack(title) {
  return `<div class="studio-page-bar">
    <button type="button" class="studio-ico-btn" data-go="dashboard" aria-label="Back to Home">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
    </button>
    <h1>${esc(title)}</h1>
  </div>`
}

function mountQuickStart() {
  const root = document.getElementById('studio-quickstart-root')
  if (!root) return
  root.innerHTML = `<div class="studio-page">
    ${pageBack('Quick start')}
    <p class="studio-page-sub">Pick a format. Cards stay blank until media is uploaded to R2.</p>
    <div class="studio-qs-grid">${START_FORMATS.map((f) => formatCard(f)).join('')}</div>
  </div>`
  bindPh(root)
  bindCardMedia(root)
}

function mountHomePresets() {
  const root = document.getElementById('studio-homepresets-root')
  if (!root) return
  root.innerHTML = `<div class="studio-page">
    ${pageBack('Presets')}
    <p class="studio-page-sub">Start from a look. Empty cards wait for R2 media.</p>
    <div class="studio-masonry is-dense">${HOME_PRESETS.length ? presetCards() : '<div class="studio-empty"><h3>No presets yet</h3></div>'}</div>
  </div>`
  bindPh(root)
  bindCardMedia(root)
}

function mountInspireCat() {
  const root = document.getElementById('studio-inspirecat-root')
  if (!root) return
  const cat = INSPIRE_CATEGORIES.find((c) => c.id === inspirePage()) || INSPIRE_CATEGORIES[0]
  document.documentElement.dataset.studioInspirePage = cat.id
  const items = inspireItems(cat.id)
  root.innerHTML = `<div class="studio-page">
    ${pageBack(cat.label)}
    <p class="studio-page-sub">${esc(cat.description)}</p>
    <div class="studio-masonry is-dense">${items.map((it) => `
      <button type="button" class="studio-preset" data-inspire-open="${esc(it.id)}" aria-label="${esc(it.title)}">
        <span class="studio-tile-shot">
          ${phHtml(appMedia(it.file), it.n % 3 === 0 ? 'is-portrait' : 'is-wide')}
          <span class="studio-scrim-grad"></span>
          <span class="studio-inspire-hover">
            <span>${esc(it.creator)}</span>
            <span class="studio-direct-pill">Direct this</span>
          </span>
        </span>
        <span class="studio-tile-meta">${esc(it.title)}</span>
      </button>`).join('')}</div>
  </div>`
  bindPh(root)
  bindCardMedia(root)
}

function mountModals() {
  if (document.getElementById('studio-brief-modal')) return
  const brief = document.createElement('div')
  brief.id = 'studio-brief-modal'
  brief.className = 'studio-modal'
  brief.hidden = true
  brief.innerHTML = `<div class="studio-modal-panel" role="dialog" aria-modal="true" aria-labelledby="studio-brief-title">
    <button type="button" class="studio-modal-x" data-modal-close aria-label="Close">${ICO.plus}</button>
    <div class="studio-brief-grid">
      <div class="studio-brief-media">
        <button type="button" class="studio-brief-nav" data-brief-step="-1" aria-label="Previous">‹</button>
        <div id="studio-brief-preview"></div>
        <button type="button" class="studio-brief-nav" data-brief-step="1" aria-label="Next">›</button>
        <div class="studio-brief-transport">
          <button type="button" class="studio-round-btn" id="studio-brief-play" aria-label="Play">${ICO.play}</button>
          <input id="studio-brief-seek" type="range" min="0" max="100" value="0" aria-label="Timeline">
        </div>
      </div>
      <div class="studio-brief-side">
        <h2 id="studio-brief-title">Make a video</h2>
        <p id="studio-brief-sub" class="studio-page-sub"></p>
        <label class="sr-only" for="studio-brief-text">Brief</label>
        <textarea id="studio-brief-text" rows="5" placeholder="Write your story, a scene, or even a feeling"></textarea>
        <p class="studio-field-label">Visual style</p>
        <div class="studio-style-row" id="studio-brief-styles"></div>
        <div id="studio-brief-len-wrap">
          <p class="studio-field-label">How long should it be? <span id="studio-brief-len-val"></span></p>
          <input id="studio-brief-len" type="range" min="0" max="2" value="0" aria-label="Duration">
        </div>
        <p class="studio-field-label">Add reference (optional)</p>
        <label class="studio-upload" id="studio-brief-ref">Upload your assets
          <input id="studio-brief-file" type="file" accept="video/*,image/*,audio/*" hidden>
        </label>
        <button type="button" class="btn btn-primary studio-brief-go" id="studio-brief-go">Direct my video →</button>
      </div>
    </div>
  </div>`
  const inspire = document.createElement('div')
  inspire.id = 'studio-inspire-modal'
  inspire.className = 'studio-modal'
  inspire.hidden = true
  inspire.innerHTML = `<div class="studio-modal-panel" role="dialog" aria-modal="true" aria-labelledby="studio-inspire-title">
    <button type="button" class="studio-modal-x" data-modal-close aria-label="Close">${ICO.plus}</button>
    <div class="studio-brief-grid">
      <div class="studio-brief-media" id="studio-inspire-preview"></div>
      <div class="studio-brief-side">
        <h2 id="studio-inspire-title"></h2>
        <p class="studio-inspire-handle" id="studio-inspire-handle"></p>
        <span class="studio-tile-chip" id="studio-inspire-cat"></span>
        <p class="studio-field-label">Starting brief</p>
        <p class="studio-inspire-brief" id="studio-inspire-brief"></p>
        <button type="button" class="studio-more-link" id="studio-inspire-more">See more</button>
        <p class="studio-field-label">References</p>
        <div class="studio-ref-strip" id="studio-inspire-refs"></div>
        <div class="studio-brief-actions">
          <button type="button" class="studio-drop-btn" id="studio-inspire-share">${ICO.share} Share</button>
          <button type="button" class="btn btn-primary" id="studio-inspire-go">Direct this</button>
        </div>
      </div>
    </div>
  </div>`
  document.body.appendChild(brief)
  document.body.appendChild(inspire)
  document.getElementById('studio-brief-styles').innerHTML = VISUAL_STYLES.map((s, i) =>
    `<button type="button" class="studio-style-chip${i === 0 ? ' is-on' : ''}" data-style="${esc(s.id)}">${esc(s.label)}</button>`
  ).join('')
}

let briefIndex = 0
let inspireOpenId = ''

function openBrief(id) {
  briefIndex = Math.max(0, START_FORMATS.findIndex((f) => f.id === id))
  paintBrief()
  const modal = document.getElementById('studio-brief-modal')
  if (modal) modal.hidden = false
}

function paintBrief() {
  const f = START_FORMATS[briefIndex] || START_FORMATS[0]
  const title = document.getElementById('studio-brief-title')
  const sub = document.getElementById('studio-brief-sub')
  const preview = document.getElementById('studio-brief-preview')
  const goBtn = document.getElementById('studio-brief-go')
  const lenWrap = document.getElementById('studio-brief-len-wrap')
  const slider = document.getElementById('studio-brief-len')
  if (title) title.textContent = 'Make ' + f.label
  if (sub) sub.textContent = f.subtitle || ''
  if (preview) {
    preview.innerHTML = phHtml(startMedia(f.slug), f.ratio === '9:16' ? 'is-portrait' : 'is-wide', 'video')
    bindPh(preview)
  }
  if (goBtn) goBtn.textContent = 'Direct my ' + f.label + ' →'
  const lengths = f.format === 'shorts' ? STUDIO_LENGTH.shorts : f.format === 'long' ? STUDIO_LENGTH.long : []
  if (lenWrap) lenWrap.hidden = !lengths.length
  if (slider && lengths.length) {
    slider.max = String(lengths.length - 1)
    slider.value = '0'
    paintBriefLen()
  }
}

function paintBriefLen() {
  const f = START_FORMATS[briefIndex] || START_FORMATS[0]
  const lengths = f.format === 'shorts' ? STUDIO_LENGTH.shorts : STUDIO_LENGTH.long
  const slider = document.getElementById('studio-brief-len')
  const val = document.getElementById('studio-brief-len-val')
  const i = Number(slider?.value || 0)
  if (val) val.textContent = lengths[i]?.label || ''
}

function submitBrief() {
  const f = START_FORMATS[briefIndex] || START_FORMATS[0]
  const text = String(document.getElementById('studio-brief-text')?.value || '').trim()
  const style = document.querySelector('.studio-style-chip.is-on')?.getAttribute('data-style') || ''
  const lengths = f.format === 'shorts' ? STUDIO_LENGTH.shorts : f.format === 'long' ? STUDIO_LENGTH.long : []
  const dur = lengths[Number(document.getElementById('studio-brief-len')?.value || 0)]
  const params = new URLSearchParams()
  if (f.panel === 'imagegen') {
    if (text) params.set('prompt', text)
  } else if (text) {
    params.set('topic', text)
    params.set('brief', text)
  }
  if (f.format) params.set('format', f.format)
  if (dur?.id) params.set('duration', dur.id)
  if (style) params.set('style', style)
  go(f.panel, params.toString() ? '?' + params.toString() : '')
}

function findInspire(id) {
  for (const cat of INSPIRE_CATEGORIES) {
    const hit = inspireItems(cat.id).find((it) => it.id === id)
    if (hit) return { item: hit, cat }
  }
  return null
}

function openInspire(id) {
  const found = findInspire(id)
  if (!found) return
  inspireOpenId = id
  const { item, cat } = found
  const modal = document.getElementById('studio-inspire-modal')
  document.getElementById('studio-inspire-title').textContent = item.creator
  document.getElementById('studio-inspire-handle').textContent = item.handle
  document.getElementById('studio-inspire-cat').textContent = cat.label
  const brief = document.getElementById('studio-inspire-brief')
  brief.textContent = item.brief
  brief.classList.remove('is-open')
  const preview = document.getElementById('studio-inspire-preview')
  preview.innerHTML = phHtml(appMedia(item.file), 'is-wide')
  bindPh(preview)
  const refs = document.getElementById('studio-inspire-refs')
  refs.innerHTML = inspireItems(cat.id).filter((x) => x.id !== item.id).slice(0, 4).map((x) =>
    `<button type="button" class="studio-ref-thumb" data-inspire-open="${esc(x.id)}">${phHtml(appMedia(x.file))}</button>`
  ).join('')
  bindPh(refs)
  if (modal) modal.hidden = false
}

function closeModals() {
  const brief = document.getElementById('studio-brief-modal')
  const inspire = document.getElementById('studio-inspire-modal')
  if (brief) brief.hidden = true
  if (inspire) inspire.hidden = true
}

function setPromptMode(id) {
  const mode = HOME_PROMPT_MODES.find((m) => m.id === id) || HOME_PROMPT_MODES[0]
  const hidden = document.getElementById('studio-prompt-mode')
  if (hidden) hidden.value = mode.id
  const label = document.getElementById('studio-mode-label')
  if (label) label.textContent = mode.label
  const menu = document.getElementById('studio-mode-menu')
  if (menu) menu.innerHTML = modeMenuHtml()
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

function syncSendState() {
  const box = document.getElementById('studio-prompt')
  const send = document.getElementById('studio-send')
  if (!send) return
  const on = !!(box && String(box.value || '').trim())
  send.disabled = !on
  send.classList.toggle('is-dim', !on)
}

function applyCollapsed(on, { silent } = {}) {
  document.body.classList.toggle('studio-collapsed', !!on)
  document.querySelectorAll('#studio-collapse, #studio-collapse-top').forEach((btn) => {
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

function closeHelp() {
  document.getElementById('nav-help-wrap')?.classList.remove('is-open')
  const menu = document.getElementById('studio-help-menu')
  if (menu) menu.hidden = true
  document.getElementById('studio-help-btn')?.setAttribute('aria-expanded', 'false')
}

function placeMenu(btn, menu) {
  if (!btn || !menu) return
  menu.classList.toggle('is-end', menu.classList.contains('is-ask') || !!btn.closest('#studio-ask-wrap'))
  menu.classList.remove('is-up')
  const r = btn.getBoundingClientRect()
  const h = menu.offsetHeight || 260
  const below = window.innerHeight - r.bottom
  if (below < h + 12 && r.top > below) menu.classList.add('is-up')
}

function closeAvatar() {
  document.getElementById('nav-avatar-wrap')?.classList.remove('is-open')
  document.getElementById('nav-avatar-btn')?.setAttribute('aria-expanded', 'false')
}

function closePops(except) {
  document.querySelectorAll('.studio-mini-menu, .studio-project-menu').forEach((el) => {
    if (el.id === except) return
    el.hidden = true
  })
  closeHelp()
  document.querySelectorAll('#studio-attach, #studio-mode-btn, #studio-ask-btn, #studio-project-btn, #studio-workspace-btn, #studio-chips-more').forEach((btn) => {
    if (except && btn.getAttribute('aria-controls') === except) return
    btn.setAttribute('aria-expanded', 'false')
  })
}

function togglePop(btn, menu) {
  if (!btn || !menu) return
  const next = menu.hidden
  closePops(next ? menu.id : '')
  closeAvatar()
  menu.hidden = !next
  btn.setAttribute('aria-expanded', next ? 'true' : 'false')
  if (next) {
    placeMenu(btn, menu)
    const first = menu.querySelector('[role="menuitem"]')
    first?.focus()
  }
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
  const tick = () => {
    if (document.activeElement === box || String(box.value || '').trim()) {
      box.placeholder = ''
      setTimeout(tick, 400)
      return
    }
    const text = ideas[i] || ''
    j += dir
    if (j > text.length) {
      dir = -1
      setTimeout(tick, 1100)
      return
    }
    if (j < 0) {
      dir = 1
      i = (i + 1) % ideas.length
      j = 0
    }
    box.placeholder = text.slice(0, Math.max(0, j))
    setTimeout(tick, dir > 0 ? 36 : 16)
  }
  box.addEventListener('focus', () => { box.placeholder = '' })
  box.addEventListener('blur', () => {
    if (!String(box.value || '').trim() && !box.placeholder) box.placeholder = ideas[i] || ''
  })
  tick()
}

function bindCardMedia(root) {
  if (!root) return
  root.querySelectorAll('.studio-tile, .studio-preset, .studio-inspire-card').forEach((card) => {
    const vid = card.querySelector('video')
    if (!vid || vid.dataset.hoverBound) return
    vid.dataset.hoverBound = '1'
    card.addEventListener('mouseenter', () => { try { vid.play() } catch (_) {} })
    card.addEventListener('mouseleave', () => { try { vid.pause() } catch (_) {} })
    card.addEventListener('focus', () => { try { vid.play() } catch (_) {} })
    card.addEventListener('blur', () => { try { vid.pause() } catch (_) {} })
  })
}

function syncTabIndicator(root) {
  const track = (root || document).querySelector('.studio-tabs')
  const on = track?.querySelector('[aria-selected="true"]')
  if (!track || !on) return
  let bar = track.querySelector('.studio-tab-ind')
  if (!bar) {
    bar = document.createElement('span')
    bar.className = 'studio-tab-ind'
    track.prepend(bar)
  }
  const r = on.getBoundingClientRect()
  const p = track.getBoundingClientRect()
  bar.style.width = r.width + 'px'
  bar.style.transform = `translateX(${r.left - p.left + track.scrollLeft}px)`
}

function bindRails(root) {
  root.querySelectorAll('.studio-rail-scroller').forEach((scroller) => {
    scroller.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      scroller.scrollLeft += e.deltaY
    }, { passive: false })
  })
  bindCardMedia(root)
}

function handleAttach(id) {
  closePops()
  const item = ATTACH_GROUPS.flatMap((g) => g.items).find((a) => a.id === id)
  if (!item) return
  if (item.kind === 'go') {
    go(item.panel)
    return
  }
  const input = document.getElementById('studio-upload-input')
  if (!input) return
  input.accept = item.accept || 'video/*,image/*,audio/*'
  input.onchange = (e) => {
    const file = e.target.files?.[0]
    if (file) showAttachChip(file.name)
    if (signedIn() && typeof window.uploadFile === 'function') window.uploadFile(e.target)
    e.target.value = ''
  }
  input.click()
}

function showAttachChip(name) {
  const row = document.getElementById('studio-attach-chips')
  if (!row) return
  row.hidden = false
  row.innerHTML = `<span class="studio-file-chip">${esc(name)}<button type="button" data-clear-chip aria-label="Remove">×</button></span>`
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
    if (text) {
      box.value = (box.value ? box.value + ' ' : '') + text
      syncSendState()
    }
  }
  rec.onerror = () => {}
  rec.start()
}

function runAvatar(action) {
  if (action === 'logout') window.doLogout?.()
  else if (action === 'paywall') window.openPaywall?.({ force: true })
  else window.openAccountSettings?.()
}

function bindShellEvents() {
  document.addEventListener('click', (e) => {
    const hrefBtn = e.target.closest('[data-href]')
    if (hrefBtn && hrefBtn.closest('#studio-sidebar, #studio-home-root, #studio-tools-root, #studio-quickstart-root, #studio-homepresets-root, #studio-inspirecat-root')) {
      e.preventDefault()
      const href = hrefBtn.getAttribute('data-href')
      if (href) location.href = href
      return
    }
    if (e.target.closest('[data-pin]')) {
      e.preventDefault()
      e.stopPropagation()
      togglePinned(e.target.closest('[data-pin]').getAttribute('data-pin'))
      paintSidebar()
      paintCatalog(catalogTab())
      const grid = document.getElementById('studio-home-toolgrid')
      if (grid) {
        grid.innerHTML = toolCardsHtml()
        bindPh(grid)
      }
      return
    }
    const launch = e.target.closest('[data-launch]')
    if (launch && !e.target.closest('.studio-launch, .studio-pin')) {
      e.preventDefault()
      const id = launch.getAttribute('data-launch')
      const tool = studioToolById(id)
      if (tool?.external) location.href = tool.href
      else go(id)
      return
    }
    const briefBtn = e.target.closest('[data-brief]')
    if (briefBtn) {
      e.preventDefault()
      openBrief(briefBtn.getAttribute('data-brief'))
      return
    }
    const inspireBtn = e.target.closest('[data-inspire-open]')
    if (inspireBtn) {
      e.preventDefault()
      openInspire(inspireBtn.getAttribute('data-inspire-open'))
      return
    }
    const goBtn = e.target.closest('[data-go]')
    if (goBtn && goBtn.closest('#studio-sidebar, #studio-home-root, #studio-tools-root, #studio-templates-root, #studio-tutorials-root, #studio-brandkit-root, #studio-quickstart-root, #studio-homepresets-root, #studio-inspirecat-root, .studio-topbar, .studio-help-menu, .studio-page-bar')) {
      e.preventDefault()
      const page = goBtn.getAttribute('data-inspire-page')
      if (page) document.documentElement.dataset.studioInspirePage = page
      const format = goBtn.getAttribute('data-format')
      const id = goBtn.getAttribute('data-go')
      if (id === 'dashboard' && goBtn.getAttribute('data-help') === 'news') {
        go('dashboard')
        setTimeout(() => document.getElementById('rail-news')?.scrollIntoView({ block: 'start' }), 80)
        return
      }
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
      syncSendState()
      box?.focus()
      closePops()
      return
    }
    if (e.target.closest('#studio-chips-more')) {
      togglePop(document.getElementById('studio-chips-more'), document.getElementById('studio-more-menu'))
      return
    }
    if (e.target.closest('[data-clear-chip]')) {
      const row = document.getElementById('studio-attach-chips')
      if (row) { row.hidden = true; row.innerHTML = '' }
      return
    }
    const secToggle = e.target.closest('[data-sec-toggle]')
    if (secToggle) {
      toggleShutSec(secToggle.getAttribute('data-sec-toggle'))
      paintSidebar()
      return
    }
    const cat = e.target.closest('[data-cat]')
    if (cat) { paintCatalog(cat.getAttribute('data-cat')); return }
    const inspire = e.target.closest('[data-inspire]')
    if (inspire) { paintInspire(inspire.getAttribute('data-inspire')); return }
    const tpl = e.target.closest('[data-tpl-cat]')
    if (tpl) { paintTemplates(tpl.getAttribute('data-tpl-cat')); return }
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
    if (homeModeBtn) { setHomeMode(homeModeBtn.getAttribute('data-home-mode')); return }
    const modeItem = e.target.closest('[data-prompt-mode]')
    if (modeItem) { setPromptMode(modeItem.getAttribute('data-prompt-mode')); return }
    const askItem = e.target.closest('[data-ask]')
    if (askItem) {
      const next = setAskMode(askItem.getAttribute('data-ask'))
      const label = document.getElementById('studio-ask-label')
      const row = ASK_BEHAVIORS.find((b) => b.id === next.askMode)
      if (label && row) label.textContent = row.label
      const menu = document.getElementById('studio-ask-menu')
      if (menu) menu.innerHTML = askMenuHtml()
      closePops()
      return
    }
    const attachItem = e.target.closest('[data-attach]')
    if (attachItem) { handleAttach(attachItem.getAttribute('data-attach')); return }
    if (e.target.closest('#studio-attach')) {
      togglePop(document.getElementById('studio-attach'), document.getElementById('studio-attach-menu'))
      return
    }
    if (e.target.closest('#studio-mode-btn')) {
      const menu = document.getElementById('studio-mode-menu')
      if (menu) menu.innerHTML = modeMenuHtml()
      togglePop(document.getElementById('studio-mode-btn'), menu)
      return
    }
    if (e.target.closest('#studio-ask-btn')) {
      const menu = document.getElementById('studio-ask-menu')
      if (menu) menu.innerHTML = askMenuHtml()
      togglePop(document.getElementById('studio-ask-btn'), menu)
      return
    }
    if (e.target.closest('#studio-project-btn')) {
      togglePop(document.getElementById('studio-project-btn'), document.getElementById('studio-project-menu'))
      return
    }
    if (e.target.closest('#studio-workspace-btn')) {
      togglePop(document.getElementById('studio-workspace-btn'), document.getElementById('studio-workspace-menu'))
      return
    }
    if (e.target.closest('[data-workspace-manage]')) {
      closePops()
      window.openAccountSettings?.()
      return
    }
    if (e.target.closest('[data-avatar]')) {
      runAvatar(e.target.closest('[data-avatar]').getAttribute('data-avatar'))
      return
    }
    if (e.target.closest('#studio-upgrade')) {
      window.openPaywall?.({ force: true, reason: 'upgrade' })
      return
    }
    if (e.target.closest('[data-modal-close]') || e.target.classList.contains('studio-modal')) {
      closeModals()
      return
    }
    if (e.target.closest('[data-brief-step]')) {
      const dir = Number(e.target.closest('[data-brief-step]').getAttribute('data-brief-step'))
      briefIndex = (briefIndex + dir + START_FORMATS.length) % START_FORMATS.length
      paintBrief()
      return
    }
    if (e.target.closest('#studio-brief-go')) { submitBrief(); return }
    if (e.target.closest('#studio-brief-play')) {
      const vid = document.querySelector('#studio-brief-preview video')
      if (vid) { if (vid.paused) vid.play(); else vid.pause() }
      return
    }
    if (e.target.closest('[data-style]')) {
      document.querySelectorAll('.studio-style-chip').forEach((el) => el.classList.toggle('is-on', el === e.target.closest('[data-style]')))
      return
    }
    if (e.target.closest('#studio-brief-ref')) {
      document.getElementById('studio-brief-file')?.click()
      return
    }
    if (e.target.closest('#studio-inspire-more')) {
      document.getElementById('studio-inspire-brief')?.classList.toggle('is-open')
      return
    }
    if (e.target.closest('#studio-inspire-share')) {
      const url = location.origin + '/home/inspirations/' + (findInspire(inspireOpenId)?.cat.id || '')
      if (navigator.share) navigator.share({ url }).catch(() => {})
      else navigator.clipboard?.writeText(url).catch(() => {})
      return
    }
    if (e.target.closest('#studio-inspire-go')) {
      const found = findInspire(inspireOpenId)
      const text = found?.item.brief || ''
      go('videogen', text ? '?topic=' + encodeURIComponent(text) + '&brief=' + encodeURIComponent(text) : '')
      return
    }
    if (!e.target.closest('.studio-pop, #studio-project-btn, #studio-project-menu, #studio-workspace-btn, #studio-workspace-menu')) closePops()
  })
  document.getElementById('studio-prompt-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    submitHomePrompt()
  })
  document.getElementById('studio-prompt')?.addEventListener('input', syncSendState)
  document.getElementById('studio-brief-len')?.addEventListener('input', paintBriefLen)
  document.getElementById('studio-collapse')?.addEventListener('click', () => {
    applyCollapsed(!document.body.classList.contains('studio-collapsed'))
  })
  document.getElementById('studio-collapse-top')?.addEventListener('click', () => {
    applyCollapsed(!document.body.classList.contains('studio-collapsed'))
  })
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
      closeModals()
    }
    const menu = document.querySelector('.studio-mini-menu:not([hidden]), .studio-project-menu:not([hidden]), #studio-help-menu:not([hidden]), #nav-avatar-menu')
    if (menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = [...menu.querySelectorAll('[role="menuitem"]')].filter((el) => !el.hidden)
      if (!items.length) return
      e.preventDefault()
      const i = items.indexOf(document.activeElement)
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
      items[next].focus()
    }
  })
  window.openMobileNav = openDrawer
  window.closeMobileNav = closeDrawer
  document.getElementById('nav-avatar-btn')?.addEventListener('click', () => {
    closeHelp()
    closePops()
  })
  document.getElementById('studio-help-btn')?.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap = document.getElementById('nav-help-wrap')
    const menu = document.getElementById('studio-help-menu')
    const btn = document.getElementById('studio-help-btn')
    const open = !!menu?.hidden
    closePops()
    closeAvatar()
    if (menu) menu.hidden = !open
    wrap?.classList.toggle('is-open', open)
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) placeMenu(btn, menu)
  })
  document.addEventListener('click', (e) => {
    if (e.target.closest('#nav-help-wrap')) return
    closeHelp()
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
window.studioPaintAccount = paintAccountChrome
