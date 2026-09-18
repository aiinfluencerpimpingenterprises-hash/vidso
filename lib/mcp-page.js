import { CLAUDE_ICON, LANDING_R2, MCP_CHAT_MEDIA, MCP_FEATURE_MEDIA } from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'
import { mountAnnounce, mountFaq, wrapGlowLabels } from './landing-page.js'
import { mountLandingReveals, checkHeadingCenters } from './landing-reveal.js?v=d1f26'
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
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0) drop()
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

function mountFeatureTabs(root = document) {
  const tabs = [...root.querySelectorAll('[data-mcp-feat]')]
  const panes = [...root.querySelectorAll('[data-mcp-feat-pane]')]
  if (!tabs.length) return
  function show(id) {
    tabs.forEach((btn) => {
      const on = btn.getAttribute('data-mcp-feat') === id
      btn.classList.toggle('is-on', on)
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    panes.forEach((pane) => {
      const on = pane.getAttribute('data-mcp-feat-pane') === id
      pane.hidden = !on
      pane.classList.toggle('is-on', on)
    })
  }
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => show(btn.getAttribute('data-mcp-feat')))
  })
  MCP_FEATURE_MEDIA.forEach((rec) => {
    fillBlankCard(root.querySelector(`[data-mcp-media="feat-${rec.tab}"]`), rec)
  })
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
      const on = idx === i
      el.classList.toggle('is-on', on)
      const body = el.querySelector('[data-mcp-ask-body]')
      if (body) body.hidden = !on
    })
    if (media) {
      media.querySelectorAll('[data-mcp-media]').forEach((card) => {
        card.hidden = card.getAttribute('data-mcp-media') !== 'chat-' + id
      })
    }
  }

  function tick() {
    if (reduceMotion() || paused) return
    timer = window.setTimeout(() => {
      paint(i + 1)
      tick()
    }, 5600)
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
  mountFeatureTabs()
  mountAsk()
  mountAskCopy()
  mountFaq()
  mountLandingIntegrations()
  wrapGlowLabels()
  mountLandingReveals()
  window.__checkHeadingCenters = checkHeadingCenters
}
