/** App chrome: announcement banner, nav badges, and top-nav grouping. */

export const APP_BANNER = {
  id: 'seedream-5-pro',
  message: 'Seedream 5.0 Pro is live in the Thumbnail Generator',
  ctaLabel: 'Try it',
  ctaHref: '/image-generation',
  enabled: true,
}

/** Set a panel id to a short label (e.g. 'New') to show a badge. Unused by default. */
export const NAV_BADGES = {}

export const TOOL_PANELS = [
  'clipper',
  'ranking',
  'captions',
  'voiceover',
  'reframe',
  'editor',
  'downloader',
  'commentary',
]

export const NAV_SEARCH_ITEMS = [
  { id: 'imagegen', label: 'Thumbnail Generator' },
  { id: 'videogen', label: 'Long Form Generator' },
  { id: 'clipper', label: 'Clipping' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'captions', label: 'AI Captions' },
  { id: 'voiceover', label: 'AI Voiceover' },
  { id: 'reframe', label: 'AI Reframe' },
  { id: 'editor', label: 'Video Editor' },
  { id: 'downloader', label: 'Video Downloader' },
  { id: 'commentary', label: 'Video Commentary' },
  { id: 'files', label: 'My Files' },
  { id: 'tools', label: 'All tools' },
]

const BANNER_KEY = (id) => 'vidso_banner_dismissed:' + id
const openDrops = new Map()

export function bannerDismissed(id) {
  try { return localStorage.getItem(BANNER_KEY(id)) === '1' } catch (_) { return false }
}

export function dismissBanner(id) {
  try { localStorage.setItem(BANNER_KEY(id), '1') } catch (_) {}
}

export function applyNavBadges() {
  document.querySelectorAll('[data-panel][data-nav-badge]').forEach((el) => {
    el.removeAttribute('data-nav-badge')
    el.querySelector('.nav-new')?.remove()
  })
  Object.entries(NAV_BADGES).forEach(([panel, label]) => {
    const text = String(label || '').trim()
    if (!text) return
    document.querySelectorAll(`[data-panel="${panel}"]`).forEach((el) => {
      el.setAttribute('data-nav-badge', text)
      if (el.querySelector('.nav-new')) return
      const span = document.createElement('span')
      span.className = 'nav-new'
      span.textContent = text
      el.appendChild(span)
    })
  })
}

export function initBanner() {
  const bar = document.getElementById('app-banner')
  if (!bar) return
  const cfg = APP_BANNER
  const show = !!(cfg && cfg.enabled && cfg.message && !bannerDismissed(cfg.id))
  bar.hidden = !show
  document.body.classList.toggle('has-banner', show)
  if (!show) return
  const msg = document.getElementById('app-banner-msg')
  const cta = document.getElementById('app-banner-cta')
  if (msg) msg.textContent = cfg.message
  if (cta) {
    cta.textContent = cfg.ctaLabel || 'Open'
    cta.setAttribute('href', cfg.ctaHref || '#')
    cta.addEventListener('click', (e) => {
      const href = cta.getAttribute('href') || ''
      if (href === '/image-generation') {
        e.preventDefault()
        window.switchPanel?.('imagegen')
      }
    })
  }
  document.getElementById('app-banner-dismiss')?.addEventListener('click', () => {
    dismissBanner(cfg.id)
    bar.hidden = true
    document.body.classList.remove('has-banner')
  })
}

function portalRoot() {
  let el = document.getElementById('nav-portal')
  if (!el) {
    el = document.createElement('div')
    el.id = 'nav-portal'
    document.body.appendChild(el)
  }
  // Keep the overlay at the end of <body> so dashboard stacking cannot cover it.
  if (el.parentElement !== document.body || document.body.lastElementChild !== el) {
    document.body.appendChild(el)
  }
  return el
}

function closeNavMenus(except) {
  openDrops.forEach((state, wrap) => {
    if (except && wrap === except) return
    closeDrop(wrap)
  })
}

function menuOptions(menu) {
  return [...(menu?.querySelectorAll('[role="menuitem"], .nav-search-item') || [])].filter((el) => !el.hidden)
}

function positionMenu(state) {
  const { btn, menu, align } = state
  const portal = portalRoot()
  if (menu.parentElement !== portal) portal.appendChild(menu)
  const r = btn.getBoundingClientRect()
  menu.classList.add('is-open')
  menu.style.position = 'fixed'
  menu.style.top = Math.round(r.bottom + 6) + 'px'
  menu.style.zIndex = '400'
  const mw = menu.offsetWidth || 280
  let left = align === 'left' ? r.left : r.right - mw
  left = Math.min(Math.max(8, left), window.innerWidth - mw - 8)
  menu.style.left = Math.round(left) + 'px'
  menu.style.right = 'auto'
}

function openDrop(wrap) {
  const state = openDrops.get(wrap)
  if (!state) return
  closeNavMenus(wrap)
  wrap.classList.add('is-open')
  state.btn.setAttribute('aria-expanded', 'true')
  positionMenu(state)
  requestAnimationFrame(() => positionMenu(state))
}

function closeDrop(wrap) {
  const state = openDrops.get(wrap)
  if (!state) return
  wrap.classList.remove('is-open')
  state.btn.setAttribute('aria-expanded', 'false')
  state.menu.classList.remove('is-open')
  if (state.menu.parentElement !== wrap) wrap.appendChild(state.menu)
  state.menu.style.position = ''
  state.menu.style.top = ''
  state.menu.style.left = ''
  state.menu.style.right = ''
  state.menu.style.zIndex = ''
}

function bindDrop(wrap, { onOpen, align = 'right' } = {}) {
  const btn = wrap?.querySelector('[aria-haspopup]')
  const menu = wrap?.querySelector('[role="menu"], .nav-search-pop')
  if (!wrap || !btn || !menu) return
  const state = { btn, menu, align, onOpen }
  openDrops.set(wrap, state)

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeDrop(wrap)
      btn.focus()
      return
    }
    if (e.target === btn) return
    const opts = menuOptions(menu)
    if (!opts.length) return
    const i = Math.max(0, opts.indexOf(document.activeElement))
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      opts[(i + 1) % opts.length]?.focus()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      opts[(i - 1 + opts.length) % opts.length]?.focus()
    }
    if (e.key === 'Home') {
      e.preventDefault()
      opts[0]?.focus()
    }
    if (e.key === 'End') {
      e.preventDefault()
      opts[opts.length - 1]?.focus()
    }
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const open = !wrap.classList.contains('is-open')
    if (open) {
      openDrop(wrap)
      onOpen?.()
      requestAnimationFrame(() => positionMenu(state))
      if (e.detail === 0) {
        const first = menuOptions(menu)[0]
        if (first && first.tagName !== 'INPUT') first.focus()
        else menu.querySelector('input')?.focus()
      }
    } else closeDrop(wrap)
  })
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      btn.click()
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      openDrop(wrap)
      onOpen?.()
      menuOptions(menu)[0]?.focus()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      openDrop(wrap)
      onOpen?.()
      const opts = menuOptions(menu)
      opts[opts.length - 1]?.focus()
    }
    if (e.key === 'Escape') {
      closeDrop(wrap)
      btn.focus()
    }
  })
  wrap.addEventListener('keydown', onKey)
  menu.addEventListener('keydown', onKey)
}

function renderSearchList(q) {
  const list = document.getElementById('nav-search-list')
  if (!list) return
  const needle = String(q || '').trim().toLowerCase()
  const items = NAV_SEARCH_ITEMS.filter((it) => !needle || it.label.toLowerCase().includes(needle))
  list.innerHTML = items.length
    ? items.map((it) => `<button type="button" class="nav-search-item" role="menuitem" data-go="${it.id}">${it.label}</button>`).join('')
    : '<p class="nav-search-empty">No matching tools</p>'
}

function updateNavFade() {
  const el = document.getElementById('topnav-primary')
  if (!el) return
  const overflow = el.scrollWidth > el.clientWidth + 2
  el.classList.toggle('is-overflow', overflow)
  el.classList.toggle('is-flush-end', !overflow || el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
}

export function initTopNav() {
  applyNavBadges()
  bindDrop(document.getElementById('nav-tools-wrap'), { align: 'left' })
  bindDrop(document.getElementById('nav-avatar-wrap'), { align: 'right' })
  bindDrop(document.getElementById('nav-search-wrap'), {
    align: 'right',
    onOpen: () => {
      const input = document.getElementById('nav-search-input')
      renderSearchList(input?.value || '')
      input?.focus()
    },
  })
  document.getElementById('nav-search-input')?.addEventListener('input', (e) => {
    renderSearchList(e.target.value)
  })
  document.getElementById('nav-search-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]')
    if (!btn) return
    closeNavMenus()
    window.closeMobileNav?.()
    window.switchPanel?.(btn.getAttribute('data-go'), null)
  })
  document.addEventListener('click', (e) => {
    if (e.target.closest('.topnav-drop') || e.target.closest('#nav-portal')) return
    closeNavMenus()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNavMenus()
  })
  const repos = () => {
    openDrops.forEach((state, wrap) => {
      if (wrap.classList.contains('is-open')) positionMenu(state)
    })
  }
  window.addEventListener('resize', () => {
    updateNavFade()
    repos()
  })
  window.addEventListener('scroll', repos, true)
  const primary = document.getElementById('topnav-primary')
  if (primary) {
    primary.addEventListener('scroll', updateNavFade, { passive: true })
    updateNavFade()
  }
}

export function markNavActive(panelId) {
  document.querySelectorAll('[data-panel]').forEach((el) => el.classList.remove('active'))
  document.querySelectorAll('[data-panel="' + panelId + '"]').forEach((el) => el.classList.add('active'))
  const toolsOn = panelId === 'tools' || TOOL_PANELS.includes(panelId)
  document.getElementById('nav-tools-btn')?.classList.toggle('active', toolsOn)
}

export function openAvatarMenu() {
  openDrop(document.getElementById('nav-avatar-wrap'))
}

export function closeNavMenusPublic() {
  closeNavMenus()
}
