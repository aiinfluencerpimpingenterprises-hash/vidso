import { GENERATE_HREF, TOOL_MENU_COLUMNS, TOOL_MENU_ITEMS } from './public-tools.js'

const OPEN_MS = 120
const CLOSE_MS = 200

function itemHtml(id, opts = {}) {
  const item = TOOL_MENU_ITEMS[id]
  if (!item) return ''
  const popular = opts.popular ? '<span class="tools-mega-dot" aria-hidden="true"></span>' : ''
  return `<a class="tools-mega-item" role="menuitem" href="${item.href}" data-tool="${id}">
    <span class="tools-mega-name">${popular}${item.name}<span class="tools-mega-arrow" aria-hidden="true">→</span></span>
    <span class="tools-mega-desc">${item.description}</span>
  </a>`
}

function panelHtml() {
  const cols = TOOL_MENU_COLUMNS.map((col) => `
    <div class="tools-mega-col${col.popular ? ' is-popular' : ''}">
      <p class="tools-mega-h">${col.label}</p>
      ${col.items.map((id) => itemHtml(id, { popular: col.popular })).join('')}
    </div>`).join('')
  return `<div class="tools-mega-inner">
    <div class="tools-mega-grid">${cols}</div>
    <div class="tools-mega-foot">
      <a class="btn btn-primary tools-mega-cta" href="${GENERATE_HREF}">Start Creating</a>
    </div>
  </div>`
}

function accordionHtml() {
  return TOOL_MENU_COLUMNS.filter((c) => !c.popular).map((col) => `
    <div class="tools-acc-group">
      <p class="tools-acc-h">${col.label}</p>
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

export function mountLandingToolsMenu() {
  const nav = document.querySelector('.lp-sitehead .nav-links')
  const header = document.querySelector('.lp-sitehead header')
  const drawer = document.getElementById('navDrawer')
  if (!nav || !header) return

  const wrap = document.createElement('div')
  wrap.className = 'nav-tools'
  wrap.innerHTML = `<button type="button" class="nav-tools-btn" id="nav-tools-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-tools-panel">Tools</button>`
  nav.insertBefore(wrap, nav.firstChild)

  const panel = document.createElement('div')
  panel.className = 'tools-mega'
  panel.id = 'nav-tools-panel'
  panel.setAttribute('role', 'menu')
  panel.setAttribute('aria-label', 'Tools')
  panel.hidden = true
  panel.innerHTML = panelHtml()
  header.appendChild(panel)

  if (drawer) {
    const acc = document.createElement('div')
    acc.className = 'tools-acc'
    acc.innerHTML = `<button type="button" class="tools-acc-btn" id="nav-tools-acc" aria-expanded="false">Tools</button>
      <div class="tools-acc-panel" id="nav-tools-acc-panel" hidden>${accordionHtml()}</div>`
    drawer.insertBefore(acc, drawer.firstChild)
    const accBtn = acc.querySelector('#nav-tools-acc')
    const accPanel = acc.querySelector('#nav-tools-acc-panel')
    accBtn.addEventListener('click', () => {
      const open = accBtn.getAttribute('aria-expanded') === 'true'
      accBtn.setAttribute('aria-expanded', open ? 'false' : 'true')
      accPanel.hidden = open
      acc.classList.toggle('is-open', !open)
    })
    acc.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => header.classList.remove('menu-open'))
    })
  }

  const btn = wrap.querySelector('#nav-tools-btn')
  let openTimer = 0
  let closeTimer = 0
  let open = false

  function items() {
    return [...panel.querySelectorAll('[role="menuitem"]')]
  }

  function setOpen(next) {
    open = next
    btn.setAttribute('aria-expanded', next ? 'true' : 'false')
    panel.hidden = !next
    panel.classList.toggle('is-open', next)
    header.classList.toggle('tools-open', next)
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
