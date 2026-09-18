import { CLAUDE_ICON, LANDING_R2, MCP_CHAT_MEDIA, MCP_FEATURE_MEDIA } from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'
import { mountAnnounce, mountFaq, wrapGlowLabels } from './landing-page.js'
import { mountLandingReveals, checkHeadingCenters } from './landing-reveal.js?v=d1f28'
import { mountLandingToolsMenu } from './landing-tools-menu.js'

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function probeUrl(url) {
  if (!url) return Promise.resolve(false)
  return fetch(url, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-0' } })
    .then((r) => r.ok || r.status === 206)
    .catch(() => false)
}

function bindBrokenMedia(root = document) {
  root.querySelectorAll('[data-mcp-logo], [data-mcp-media] img, [data-mcp-media] video').forEach((el) => {
    const drop = () => el.remove()
    el.addEventListener('error', drop)
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0 && el.getAttribute('src')) drop()
  })
}

function fillBlankCard(card, rec) {
  if (!card || !rec) return
  const poster = LANDING_R2 + '/' + rec.file + '.jpg'
  const src = LANDING_R2 + '/' + rec.file + '.mp4'
  probeUrl(poster).then((okPoster) => {
    if (okPoster) {
      const img = document.createElement('img')
      img.alt = ''
      img.decoding = 'async'
      img.loading = 'lazy'
      img.src = poster
      img.addEventListener('error', () => img.remove())
      card.appendChild(img)
      card.classList.remove('is-blank')
    }
    probeUrl(src).then((okVid) => {
      if (!okVid) return
      const v = document.createElement('video')
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.preload = 'metadata'
      v.setAttribute('src', src)
      if (okPoster) v.poster = poster
      v.addEventListener('error', () => v.remove())
      card.appendChild(v)
      card.classList.remove('is-blank')
    })
  })
}

function bindTablist(tabs, show) {
  tabs.forEach((btn, idx) => {
    btn.addEventListener('click', () => show(btn))
    btn.addEventListener('keydown', (e) => {
      const go = e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? idx + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? idx - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : null
      if (go == null) return
      e.preventDefault()
      const next = tabs[(go + tabs.length) % tabs.length]
      show(next)
      next.focus()
    })
  })
}

function mountClientTabs(root = document) {
  const tabs = [...root.querySelectorAll('[data-mcp-client]')]
  const panes = [...root.querySelectorAll('[data-mcp-client-pane]')]
  if (!tabs.length) return
  function show(btn) {
    const id = btn.getAttribute('data-mcp-client')
    tabs.forEach((tab) => {
      const on = tab === btn
      tab.classList.toggle('is-on', on)
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
      tab.tabIndex = on ? 0 : -1
    })
    panes.forEach((pane) => {
      const on = pane.getAttribute('data-mcp-client-pane') === id
      pane.classList.toggle('is-on', on)
      pane.hidden = false
      pane.setAttribute('aria-hidden', on ? 'false' : 'true')
      if (on) pane.removeAttribute('inert')
      else pane.setAttribute('inert', '')
    })
  }
  tabs.forEach((tab) => { tab.tabIndex = tab.classList.contains('is-on') ? 0 : -1 })
  bindTablist(tabs, show)
}

function mountFeatureTabs(root = document) {
  const tabs = [...root.querySelectorAll('[data-mcp-feat]')]
  const panes = [...root.querySelectorAll('[data-mcp-feat-pane]')]
  if (!tabs.length) return
  function show(btn) {
    const id = btn.getAttribute('data-mcp-feat')
    tabs.forEach((tab) => {
      const on = tab === btn
      tab.classList.toggle('is-on', on)
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
      tab.tabIndex = on ? 0 : -1
    })
    panes.forEach((pane) => {
      const on = pane.getAttribute('data-mcp-feat-pane') === id
      pane.hidden = !on
      pane.classList.toggle('is-on', on)
    })
    capMediaCards(root)
  }
  tabs.forEach((tab) => { tab.tabIndex = tab.classList.contains('is-on') ? 0 : -1 })
  bindTablist(tabs, show)
  MCP_FEATURE_MEDIA.forEach((rec) => {
    fillBlankCard(root.querySelector(`[data-mcp-media="feat-${rec.tab}"]`), rec)
  })
}

function capOne(copy, media) {
  if (!copy || !media) return
  const cap = Math.round(copy.getBoundingClientRect().height + 40)
  const width = media.getBoundingClientRect().width
  const natural = width ? width * 9 / 16 : cap
  const h = Math.min(natural, cap)
  media.style.maxHeight = cap + 'px'
  media.style.height = h + 'px'
  media.style.aspectRatio = 'auto'
}

function capMediaCards(root = document) {
  root.querySelectorAll('.mcp-feat-pane.is-on, .mcp-feat-pane:not([hidden])').forEach((pane) => {
    if (pane.hidden) return
    capOne(pane.querySelector('.mcp-feat-copy'), pane.querySelector('.mcp-blank'))
  })
  const ask = root.querySelector('.mcp-ask-grid')
  if (ask) capOne(ask.querySelector('.mcp-ask-list'), ask.querySelector('.mcp-ask-media'))
}

function mountAsk(root = document) {
  const items = [...root.querySelectorAll('[data-mcp-ask]')]
  const media = root.querySelector('[data-mcp-ask-media]')
  if (!items.length) return
  let i = 0
  let timer = 0
  let paused = false

  function paint(next) {
    i = (next + items.length) % items.length
    const id = items[i].getAttribute('data-mcp-ask')
    items.forEach((el, idx) => {
      el.classList.toggle('is-on', idx === i)
    })
    if (media) {
      media.querySelectorAll('[data-mcp-media]').forEach((card) => {
        card.hidden = card.getAttribute('data-mcp-media') !== 'chat-' + id
      })
    }
    capMediaCards(root)
  }

  function tick() {
    if (reduceMotion() || paused) return
    timer = window.setTimeout(() => {
      paint(i + 1)
      tick()
    }, 5000)
  }

  items.forEach((el, idx) => {
    el.addEventListener('click', () => {
      window.clearTimeout(timer)
      paint(idx)
      tick()
    })
  })
  const list = root.querySelector('.mcp-ask-list')
  list?.addEventListener('pointerenter', () => { paused = true; window.clearTimeout(timer) })
  list?.addEventListener('pointerleave', () => { paused = false; tick() })

  paint(0)
  MCP_CHAT_MEDIA.forEach((rec) => {
    const card = root.querySelector(`[data-mcp-media="chat-${rec.item}"]`)
    if (card) fillBlankCard(card, rec)
  })
  if (!reduceMotion()) tick()
}

function copyPrompt(text) {
  return navigator.clipboard.writeText(text)
}

function mountAskCopy(root = document) {
  root.querySelectorAll('[data-mcp-ask-copy]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const card = btn.closest('[data-mcp-ask]')
      const prompt = card?.querySelector('[data-mcp-prompt]')?.textContent?.trim()
      if (!prompt) return
      try {
        await copyPrompt(prompt)
        const label = btn.querySelector('[data-mcp-copy-label]')
        const prev = label?.textContent || 'Copy'
        if (label) label.textContent = 'Copied'
        btn.dataset.copied = '1'
        setTimeout(() => {
          delete btn.dataset.copied
          if (label) label.textContent = prev
        }, 2000)
      } catch (_) {}
    })
  })
}

export function mountMcpPage() {
  const claude = document.querySelector('[data-claude-icon]')
  if (claude && CLAUDE_ICON) claude.setAttribute('src', CLAUDE_ICON)
  mountAnnounce()
  mountLandingToolsMenu()
  bindBrokenMedia()
  mountClientTabs()
  mountFeatureTabs()
  mountAsk()
  mountAskCopy()
  mountFaq()
  mountLandingIntegrations()
  wrapGlowLabels()
  mountLandingReveals()
  capMediaCards()
  window.addEventListener('resize', () => capMediaCards())
  window.__checkHeadingCenters = checkHeadingCenters
}
