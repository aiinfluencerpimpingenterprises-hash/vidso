import { GENERATE_HREF, TOOL_MENU_COLUMNS, TOOL_MENU_ITEMS } from './public-tools.js'
import {
  MODELS_HREF,
  MODELS_PROMO,
  MODELS_PROMO_COPY,
  MODEL_GROUPS,
  VIDSO_MODELS,
  modelHref,
  modelSlug,
  modelsByGroup,
} from './vidso-models.js'

const OPEN_MS = 120
const CLOSE_MS = 200

const COL_ICONS = {
  'long-form': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M8 12h8"/></svg>',
  shorts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v10a3 3 0 01-3 3"/><rect x="9" y="13" width="6" height="8" rx="3"/><path d="M8 21h8"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>',
  popular: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l1.6 5H19l-4.2 3.2L16.4 17 12 13.8 7.6 17l1.6-5.8L5 8h5.4z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
  voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v10a3 3 0 01-3 3"/><rect x="9" y="13" width="6" height="8" rx="3"/></svg>',
  script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
}

const CHEVRON = '<svg class="nav-tools-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.4 4.2L6 7.8l3.6-3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const openMenus = new Set()

function itemHtml(id, opts = {}) {
  const item = TOOL_MENU_ITEMS[id]
  if (!item) return ''
  const popular = opts.popular ? '<span class="tools-mega-dot" aria-hidden="true"></span>' : ''
  return `<a class="tools-mega-item" role="menuitem" href="${item.href}" data-tool="${id}">
    <span class="tools-mega-name">${popular}${item.name}<span class="tools-mega-arrow" aria-hidden="true">→</span></span>
    <span class="tools-mega-desc">${item.description}</span>
  </a>`
}

function colIcon(id) {
  return COL_ICONS[id] || ''
}

function newPill(on) {
  return on ? '<span class="models-mega-new">NEW</span>' : ''
}

function modelItemHtml(model) {
  return `<a class="tools-mega-item models-mega-item" role="menuitem" href="${modelHref(model.id)}" data-model="${modelSlug(model.id)}">
    <span class="tools-mega-name">${model.name}${newPill(model.isNew)}<span class="tools-mega-arrow" aria-hidden="true">→</span></span>
  </a>`
}

function toolsPanelHtml() {
  const cols = TOOL_MENU_COLUMNS.map((col) => `
    <div class="tools-mega-col${col.popular ? ' is-popular' : ''}">
      <p class="tools-mega-h"><span class="tools-mega-ico">${colIcon(col.id)}</span>${col.label}</p>
      ${col.items.map((id) => itemHtml(id, { popular: col.popular })).join('')}
    </div>`).join('')
  return `<div class="tools-mega-inner">
    <div class="tools-mega-grid">${cols}</div>
    <div class="tools-mega-foot">
      <a class="btn btn-primary tools-mega-cta" href="${GENERATE_HREF}">Start Creating</a>
    </div>
  </div>`
}

function toolsAccordionHtml() {
  return TOOL_MENU_COLUMNS.filter((c) => !c.popular).map((col) => `
    <div class="tools-acc-group">
      <p class="tools-acc-h"><span class="tools-mega-ico">${colIcon(col.id)}</span>${col.label}</p>
      ${col.items.map((id) => {
        const item = TOOL_MENU_ITEMS[id]
        return `<a class="tools-acc-item" href="${item.href}">
          <span class="tools-acc-name">${item.name}</span>
          <span class="tools-acc-desc">${item.description}</span>
        </a>`
      }).join('')}
    </div>`).join('') +
    `<a class="btn btn-primary tools-acc-cta" href="${GENERATE_HREF}">Start Creating</a>`
}

function modelsPanelHtml() {
  const cols = MODEL_GROUPS.map((g) => `
    <div class="tools-mega-col">
      <p class="tools-mega-h"><span class="tools-mega-ico">${colIcon(g.id)}</span>${g.nav}</p>
      ${modelsByGroup(g.id).map(modelItemHtml).join('')}
    </div>`).join('')
  return `<div class="tools-mega-inner models-mega-inner">
    <div class="models-mega-grid">
      <div class="models-mega-promo">
        <div class="models-mega-shot is-blank" data-models-promo></div>
        <p class="models-mega-cap">${MODELS_PROMO_COPY.caption}</p>
        <a class="btn btn-primary models-mega-browse" role="menuitem" href="${MODELS_HREF}">${MODELS_PROMO_COPY.browse}</a>
        <a class="models-mega-more" role="menuitem" href="${MODELS_PROMO_COPY.secondaryHref}">${MODELS_PROMO_COPY.secondaryLabel}</a>
      </div>
      ${cols}
    </div>
  </div>`
}

function modelsAccordionHtml() {
  return MODEL_GROUPS.map((g) => `
    <div class="tools-acc-group">
      <p class="tools-acc-h"><span class="tools-mega-ico">${colIcon(g.id)}</span>${g.nav}</p>
      ${modelsByGroup(g.id).map((m) => `
        <a class="tools-acc-item" href="${modelHref(m.id)}">
          <span class="tools-acc-name">${m.name}${newPill(m.isNew)}</span>
        </a>`).join('')}
    </div>`).join('') +
    `<a class="btn btn-primary tools-acc-cta" href="${MODELS_HREF}">${MODELS_PROMO_COPY.browse}</a>
    <a class="tools-acc-more" href="${MODELS_PROMO_COPY.secondaryHref}">${MODELS_PROMO_COPY.secondaryLabel}</a>`
}

function bindAccordion(drawer, header, { id, label, html, before }) {
  if (!drawer) return
  const acc = document.createElement('div')
  acc.className = 'tools-acc'
  acc.dataset.menu = id
  acc.innerHTML = `<button type="button" class="tools-acc-btn" id="nav-${id}-acc" aria-expanded="false">${label} ${CHEVRON}</button>
    <div class="tools-acc-panel" id="nav-${id}-acc-panel" hidden>${html}</div>`
  if (before) drawer.insertBefore(acc, before.nextSibling)
  else drawer.insertBefore(acc, drawer.firstChild)
  const accBtn = acc.querySelector(`#nav-${id}-acc`)
  const accPanel = acc.querySelector(`#nav-${id}-acc-panel`)
  accBtn.addEventListener('click', () => {
    const open = accBtn.getAttribute('aria-expanded') === 'true'
    accBtn.setAttribute('aria-expanded', open ? 'false' : 'true')
    accPanel.hidden = open
    acc.classList.toggle('is-open', !open)
  })
  acc.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => header.classList.remove('menu-open'))
  })
  return acc
}

function bindMegaMenu({ wrap, panel, btn, header, flag }) {
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
    panel.hidden = !next
    panel.classList.toggle('is-open', next)
    header.classList.toggle(flag, next)
  }

  function scheduleOpen() {
    clearTimeout(closeTimer)
    if (open) return
    clearTimeout(openTimer)
    openTimer = window.setTimeout(() => setOpen(true), OPEN_MS)
  }

  function scheduleClose() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    closeTimer = window.setTimeout(() => setOpen(false), CLOSE_MS)
  }

  function closeNow() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    setOpen(false)
  }

  const api = { closeNow, scheduleOpen }
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

function probePromo(root) {
  const host = root.querySelector('[data-models-promo]')
  if (!host) return
  fetch(MODELS_PROMO, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-0' } })
    .then((r) => r.ok || r.status === 206)
    .then((ok) => {
      if (!ok) return
      const img = document.createElement('img')
      img.alt = ''
      img.src = MODELS_PROMO
      img.width = 320
      img.height = 180
      host.appendChild(img)
      host.classList.remove('is-blank')
    })
    .catch(() => {})
}

export function mountLandingToolsMenu() {
  const nav = document.querySelector('.lp-sitehead .nav-links')
  const header = document.querySelector('.lp-sitehead header')
  const drawer = document.getElementById('navDrawer')
  if (!nav || !header) return
  if (nav.querySelector('#nav-tools-btn')) return

  const toolsWrap = document.createElement('div')
  toolsWrap.className = 'nav-tools'
  toolsWrap.dataset.menu = 'tools'
  toolsWrap.innerHTML = `<button type="button" class="nav-tools-btn" id="nav-tools-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-tools-panel">Tools ${CHEVRON}</button>`
  nav.insertBefore(toolsWrap, nav.firstChild)

  const modelsWrap = document.createElement('div')
  modelsWrap.className = 'nav-tools'
  modelsWrap.dataset.menu = 'models'
  modelsWrap.innerHTML = `<button type="button" class="nav-tools-btn" id="nav-models-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-models-panel">Models ${CHEVRON}</button>`
  nav.insertBefore(modelsWrap, toolsWrap.nextSibling)

  const toolsPanel = document.createElement('div')
  toolsPanel.className = 'tools-mega'
  toolsPanel.id = 'nav-tools-panel'
  toolsPanel.setAttribute('role', 'menu')
  toolsPanel.setAttribute('aria-label', 'Tools')
  toolsPanel.hidden = true
  toolsPanel.innerHTML = toolsPanelHtml()
  header.appendChild(toolsPanel)

  const modelsPanel = document.createElement('div')
  modelsPanel.className = 'tools-mega models-mega'
  modelsPanel.id = 'nav-models-panel'
  modelsPanel.setAttribute('role', 'menu')
  modelsPanel.setAttribute('aria-label', 'Models')
  modelsPanel.hidden = true
  modelsPanel.innerHTML = modelsPanelHtml()
  header.appendChild(modelsPanel)
  probePromo(modelsPanel)

  if (drawer) {
    const toolsAcc = bindAccordion(drawer, header, { id: 'tools', label: 'Tools', html: toolsAccordionHtml() })
    bindAccordion(drawer, header, { id: 'models', label: 'Models', html: modelsAccordionHtml(), before: toolsAcc })
  }

  bindMegaMenu({
    wrap: toolsWrap,
    panel: toolsPanel,
    btn: toolsWrap.querySelector('#nav-tools-btn'),
    header,
    flag: 'tools-open',
  })
  bindMegaMenu({
    wrap: modelsWrap,
    panel: modelsPanel,
    btn: modelsWrap.querySelector('#nav-models-btn'),
    header,
    flag: 'models-open',
  })
}

export { VIDSO_MODELS }
