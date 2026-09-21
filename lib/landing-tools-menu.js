import {
  FEATURES_ITEMS,
  FEATURES_PROMO_COPY,
  MODELS_COLUMNS,
  MODELS_NAV_PROMO,
  NAV_CLOSE_MS,
  NAV_ITEMS,
  NAV_OPEN_MS,
  RESOURCES_COLUMNS,
  TOOLS_COLUMNS,
  TOOLS_CTA,
} from './landing-nav.js'

const CHEVRON = '<svg class="nav-tools-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.4 4.2L6 7.8l3.6-3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const COL_ICONS = {
  create: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  'short-form': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  popular: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l1.6 5H19l-4.2 3.2L16.4 17 12 13.8 7.6 17l1.6-5.8L5 8h5.4z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>',
  voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v10a3 3 0 01-3 3"/><rect x="9" y="13" width="6" height="8" rx="3"/></svg>',
  script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
}

const openMenus = new Set()

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function badgeHtml(badge) {
  return badge ? `<span class="models-mega-new">${esc(badge)}</span>` : ''
}

function itemHtml(item) {
  const desc = item.description
    ? `<span class="tools-mega-desc">${esc(item.description)}</span>`
    : ''
  return `<a class="tools-mega-item" role="menuitem" href="${esc(item.href)}" data-nav-id="${esc(item.id)}">
    <span class="tools-mega-name">${esc(item.label)}${badgeHtml(item.badge)}<span class="tools-mega-arrow" aria-hidden="true">→</span></span>
    ${desc}
  </a>`
}

function accItemHtml(item) {
  const desc = item.description
    ? `<span class="tools-acc-desc">${esc(item.description)}</span>`
    : ''
  return `<a class="tools-acc-item" href="${esc(item.href)}">
    <span class="tools-acc-name">${esc(item.label)}${badgeHtml(item.badge)}</span>
    ${desc}
  </a>`
}

function colIcon(id) {
  return COL_ICONS[id] || ''
}

function toolsPanelHtml() {
  const cols = TOOLS_COLUMNS.map((col) => `
    <div class="tools-mega-col${col.popular ? ' is-popular' : ''}">
      <p class="tools-mega-h">${col.popular ? '<span class="tools-mega-dot" aria-hidden="true"></span>' : `<span class="tools-mega-ico">${colIcon(col.id)}</span>`}${esc(col.label)}</p>
      ${col.items.map((item) => itemHtml(item)).join('')}
    </div>`).join('')
  return `<div class="tools-mega-inner">
    <div class="tools-mega-grid is-tools">${cols}</div>
    <div class="tools-mega-foot">
      <a class="btn btn-primary tools-mega-cta" href="${esc(TOOLS_CTA.href)}">${esc(TOOLS_CTA.label)}</a>
    </div>
  </div>`
}

function modelsPanelHtml() {
  const cols = MODELS_COLUMNS.map((col) => `
    <div class="tools-mega-col">
      <p class="tools-mega-h"><span class="tools-mega-ico">${colIcon(col.id)}</span>${esc(col.label)}</p>
      ${col.items.map((item) => itemHtml(item)).join('')}
    </div>`).join('')
  return `<div class="tools-mega-inner models-mega-inner">
    <div class="models-mega-grid">${cols}</div>
    <div class="tools-mega-foot">
      <a class="btn btn-primary tools-mega-cta" href="${esc(MODELS_NAV_PROMO.browseHref)}">${esc(MODELS_NAV_PROMO.browse)}</a>
    </div>
  </div>`
}

function featuresPanelHtml() {
  const items = FEATURES_ITEMS.map((item) => itemHtml(item)).join('')
  return `<div class="tools-mega-inner features-mega-inner">
    <div class="features-mega-list">${items}</div>
  </div>`
}

function resourcesPanelHtml() {
  const cols = RESOURCES_COLUMNS.map((col) => `
    <div class="tools-mega-col">
      <p class="tools-mega-h">${esc(col.label)}</p>
      ${col.items.map((item) => itemHtml(item)).join('')}
    </div>`).join('')
  return `<div class="tools-mega-inner resources-mega-inner">
    <div class="resources-mega-grid">${cols}</div>
  </div>`
}

function toolsAccordionHtml() {
  return TOOLS_COLUMNS.map((col) => `
    <div class="tools-acc-group">
      <p class="tools-acc-h">${col.popular ? '<span class="tools-mega-dot" aria-hidden="true"></span>' : `<span class="tools-mega-ico">${colIcon(col.id)}</span>`}${esc(col.label)}</p>
      ${col.items.map(accItemHtml).join('')}
    </div>`).join('') +
    `<a class="btn btn-primary tools-acc-cta" href="${esc(TOOLS_CTA.href)}">${esc(TOOLS_CTA.label)}</a>`
}

function modelsAccordionHtml() {
  return MODELS_COLUMNS.map((col) => `
    <div class="tools-acc-group">
      <p class="tools-acc-h"><span class="tools-mega-ico">${colIcon(col.id)}</span>${esc(col.label)}</p>
      ${col.items.map(accItemHtml).join('')}
    </div>`).join('') +
    `<a class="btn btn-primary tools-acc-cta" href="${esc(MODELS_NAV_PROMO.browseHref)}">${esc(MODELS_NAV_PROMO.browse)}</a>`
}

function featuresAccordionHtml() {
  return `<div class="tools-acc-group">${FEATURES_ITEMS.map(accItemHtml).join('')}</div>
    <a class="btn btn-primary tools-acc-cta" href="${esc(FEATURES_PROMO_COPY.browseHref)}">${esc(FEATURES_PROMO_COPY.browse)}</a>`
}

function resourcesAccordionHtml() {
  return RESOURCES_COLUMNS.map((col) => `
    <div class="tools-acc-group">
      <p class="tools-acc-h">${esc(col.label)}</p>
      ${col.items.map(accItemHtml).join('')}
    </div>`).join('')
}

const PANEL = {
  tools: { html: toolsPanelHtml, label: 'Tools', cls: '' },
  models: { html: modelsPanelHtml, label: 'Models', cls: 'models-mega' },
  features: { html: featuresPanelHtml, label: 'Features', cls: 'features-mega' },
  resources: { html: resourcesPanelHtml, label: 'Resources', cls: 'resources-mega' },
}

const ACCORDION = {
  tools: toolsAccordionHtml,
  models: modelsAccordionHtml,
  features: featuresAccordionHtml,
  resources: resourcesAccordionHtml,
}

function bindMegaMenu({ wrap, panel, btn, header }) {
  let openTimer = 0
  let closeTimer = 0
  let open = false

  function items() {
    return [...panel.querySelectorAll('[role="menuitem"]')]
  }

  function setOpen(next) {
    if (next) {
      openMenus.forEach((other) => {
        if (other !== api) other.closeNow()
      })
    }
    open = next
    btn.setAttribute('aria-expanded', next ? 'true' : 'false')
    wrap.classList.toggle('is-on', next)
    header.classList.toggle('mega-open', next)
    if (next) {
      panel.hidden = false
      const show = () => panel.classList.add('is-open')
      if (reduceMotion()) show()
      else requestAnimationFrame(show)
    } else {
      panel.classList.remove('is-open')
      const hide = () => { if (!open) panel.hidden = true }
      if (reduceMotion()) hide()
      else window.setTimeout(hide, NAV_CLOSE_MS)
    }
  }

  function scheduleOpen() {
    clearTimeout(closeTimer)
    if (open) return
    clearTimeout(openTimer)
    openTimer = window.setTimeout(() => setOpen(true), NAV_OPEN_MS)
  }

  function scheduleClose() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    closeTimer = window.setTimeout(() => setOpen(false), NAV_CLOSE_MS)
  }

  function closeNow() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    setOpen(false)
  }

  const api = { closeNow }
  openMenus.add(api)

  wrap.addEventListener('pointerenter', scheduleOpen)
  wrap.addEventListener('pointerleave', scheduleClose)
  panel.addEventListener('pointerenter', () => {
    clearTimeout(closeTimer)
    setOpen(true)
  })
  panel.addEventListener('pointerleave', scheduleClose)
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    if (open) closeNow()
    else setOpen(true)
  })
  btn.addEventListener('focus', scheduleOpen)
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
      items()[0]?.focus()
    }
  })
  panel.addEventListener('keydown', (e) => {
    const list = items()
    const i = list.indexOf(document.activeElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      closeNow()
      btn.focus()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(i + 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(i - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      list[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      list[list.length - 1]?.focus()
    } else if (e.key === 'Tab' && !e.shiftKey && i === list.length - 1) {
      closeNow()
    } else if (e.key === 'Tab' && e.shiftKey && i <= 0) {
      closeNow()
    }
  })
  document.addEventListener('pointerdown', (e) => {
    if (!open) return
    if (wrap.contains(e.target) || panel.contains(e.target)) return
    closeNow()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) closeNow()
  })
  document.addEventListener('focusin', (e) => {
    if (!open) return
    if (wrap.contains(e.target) || panel.contains(e.target)) return
    closeNow()
  })
}

const ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'

function setDrawerOpen(header, toggle, drawer, next) {
  header.classList.toggle('menu-open', next)
  toggle.setAttribute('aria-expanded', next ? 'true' : 'false')
  toggle.setAttribute('aria-label', next ? 'Close menu' : 'Open menu')
  toggle.innerHTML = next ? ICON_CLOSE : ICON_OPEN
  drawer.hidden = !next
  document.documentElement.classList.toggle('nav-drawer-lock', next)
  document.body.classList.toggle('nav-drawer-lock', next)
}

function bindDrawer(header, toggle, drawer) {
  if (!toggle || !drawer) return
  toggle.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDrawerOpen(header, toggle, drawer, !header.classList.contains('menu-open'))
  })
  drawer.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setDrawerOpen(header, toggle, drawer, false))
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) {
      setDrawerOpen(header, toggle, drawer, false)
      toggle.focus()
    }
  })
}

function bindAccordion(root) {
  root.querySelectorAll('.tools-acc-btn').forEach((btn) => {
    const panel = btn.nextElementSibling
    if (!panel) return
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true'
      btn.setAttribute('aria-expanded', open ? 'false' : 'true')
      panel.hidden = open
      btn.parentElement.classList.toggle('is-open', !open)
    })
  })
}

export function mountLandingToolsMenu() {
  const nav = document.querySelector('.lp-sitehead .nav-links')
  const header = document.querySelector('.lp-sitehead header')
  const drawer = document.getElementById('navDrawer')
  if (!nav || !header || nav.dataset.navReady === '1') return
  nav.dataset.navReady = '1'
  nav.innerHTML = ''

  const drawerBody = drawer?.querySelector('.nav-drawer-body') || drawer

  NAV_ITEMS.forEach((item) => {
    if (item.type === 'link') {
      const a = document.createElement('a')
      a.href = item.href
      a.textContent = item.label
      a.className = 'nav-plain'
      nav.appendChild(a)
      if (drawerBody) {
        const da = document.createElement('a')
        da.href = item.href
        da.textContent = item.label
        da.className = 'tools-acc-link'
        drawerBody.appendChild(da)
      }
      return
    }

    const spec = PANEL[item.kind]
    const wrap = document.createElement('div')
    wrap.className = 'nav-tools'
    wrap.dataset.menu = item.id
    wrap.innerHTML = `<button type="button" class="nav-tools-btn" id="nav-${item.id}-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-${item.id}-panel">${esc(item.label)} ${CHEVRON}</button>`
    nav.appendChild(wrap)

    const panel = document.createElement('div')
    panel.className = `tools-mega ${spec.cls}`.trim()
    panel.id = `nav-${item.id}-panel`
    panel.setAttribute('role', 'menu')
    panel.setAttribute('aria-label', spec.label)
    panel.hidden = true
    panel.innerHTML = spec.html()
    header.appendChild(panel)

    bindMegaMenu({
      wrap,
      panel,
      btn: wrap.querySelector(`#nav-${item.id}-btn`),
      header,
    })

    if (drawerBody) {
      const acc = document.createElement('div')
      acc.className = 'tools-acc'
      acc.dataset.menu = item.id
      acc.innerHTML = `<button type="button" class="tools-acc-btn" id="nav-${item.id}-acc" aria-expanded="false">${esc(item.label)} ${CHEVRON}</button>
        <div class="tools-acc-panel" id="nav-${item.id}-acc-panel" hidden>${ACCORDION[item.kind]()}</div>`
      drawerBody.appendChild(acc)
    }
  })

  if (drawerBody) bindAccordion(drawerBody)

  const toggle = header.querySelector('.nav-toggle')
  if (drawer && toggle) {
    drawer.hidden = !header.classList.contains('menu-open')
    bindDrawer(header, toggle, drawer)
  }
}
