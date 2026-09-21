import { CLAUDE_ICON, VIDSO_AGENT_SETUP_PROMPT, VIDSO_CLI } from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'
import { mountAnnounce, mountFaq, wrapGlowLabels } from './landing-page.js?v=d1f93'
import { mountLandingReveals, checkHeadingCenters } from './landing-reveal.js?v=d1f95'
import { mountLandingToolsMenu } from './landing-tools-menu.js'
import { mountLandingFooter } from './landing-footer.js'
import { fillAllMediaSlots, fillMediaSlot, mountAskMock } from './mcp-mocks.js?v=d1f96'
import { CATALOG_CLIP_FILES, mcpLatestModels, modelCardClipSrc, modelCardSrc, modelHref, modelSlug } from './vidso-models.js?v=d1f98'

function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function applyLogoFallback(el) {
  const next = el.getAttribute('data-mcp-fallback')
  if (next && el.getAttribute('src') !== next) {
    el.removeAttribute('data-mcp-fallback')
    el.src = next
    return true
  }
  return false
}

function bindBrokenMedia(root = document) {
  root.querySelectorAll('[data-mcp-logo], [data-mcp-media] img, [data-mcp-media] video').forEach((el) => {
    if (el.dataset.mcpBound === '1') return
    el.dataset.mcpBound = '1'
    el.addEventListener('error', () => {
      if (applyLogoFallback(el)) return
      const src = el.getAttribute('src') || ''
      if (/\.svg(\?|$)/i.test(src)) return
      el.remove()
    })
    const src = el.getAttribute('src') || ''
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0 && src) {
      if (applyLogoFallback(el)) return
      if (!/\.svg(\?|$)/i.test(src)) el.remove()
    }
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

function mountModeToggle(root = document) {
  const panel = root.querySelector('.mcp-panel')
  const mcpBtns = [...root.querySelectorAll('[data-mcp-mode="mcp"]')]
  const cliBtns = [...root.querySelectorAll('[data-mcp-mode="cli"]')]
  const mcpPanes = root.querySelector('[data-mcp-client-panes]')
  const cliPane = root.querySelector('[data-mcp-cli-pane]')
  if (!mcpBtns.length || !cliBtns.length || !mcpPanes || !cliPane) return
  function show(mode) {
    const cli = mode === 'cli'
    panel?.classList.toggle('is-cli', cli)
    mcpBtns.forEach((btn) => {
      btn.classList.toggle('is-on', !cli)
      btn.setAttribute('aria-pressed', cli ? 'false' : 'true')
    })
    cliBtns.forEach((btn) => {
      btn.classList.toggle('is-on', cli)
      btn.setAttribute('aria-pressed', cli ? 'true' : 'false')
    })
    mcpPanes.hidden = cli
    cliPane.hidden = !cli
  }
  mcpBtns.forEach((btn) => btn.addEventListener('click', () => show('mcp')))
  cliBtns.forEach((btn) => btn.addEventListener('click', () => show('cli')))
}

function fillCliCommands(root = document) {
  root.querySelectorAll('[data-cli-cmd]').forEach((el) => {
    const key = el.getAttribute('data-cli-cmd')
    const text = VIDSO_CLI[key]
    if (!text) return
    const code = el.matches('code,pre') ? el : el.querySelector('code')
    if (code) code.textContent = text
    const btn = el.closest('.mcp-term, .mcp-step')?.querySelector('[data-mcp-copy]')
    if (btn) btn.setAttribute('data-mcp-copy-text', text)
  })
}

function fillAgentPrompts(root = document) {
  root.querySelectorAll('[data-mcp-agent-prompt]').forEach((el) => {
    el.textContent = VIDSO_AGENT_SETUP_PROMPT
    const btn = el.closest('.mcp-prompt, .mcp-step')?.querySelector('[data-mcp-copy]')
    if (btn) btn.setAttribute('data-mcp-copy-text', VIDSO_AGENT_SETUP_PROMPT)
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
      pane.hidden = !on
      pane.setAttribute('aria-hidden', on ? 'false' : 'true')
      if (on) pane.removeAttribute('inert')
      else pane.setAttribute('inert', '')
    })
  }
  tabs.forEach((tab) => { tab.tabIndex = tab.classList.contains('is-on') ? 0 : -1 })
  panes.forEach((pane) => {
    const on = pane.classList.contains('is-on')
    pane.hidden = !on
    if (on) pane.removeAttribute('inert')
    else pane.setAttribute('inert', '')
  })
  bindTablist(tabs, show)
}

function mountAsk(root = document, askMock) {
  const items = [...root.querySelectorAll('[data-mcp-ask]')]
  if (!items.length) return
  let i = 0
  let timer = 0
  let paused = false

  function paint(next) {
    i = (next + items.length) % items.length
    items.forEach((el, idx) => {
      el.classList.toggle('is-on', idx === i)
    })
    const prompt = items[i].querySelector('[data-mcp-prompt]')?.textContent?.trim() || ''
    const file = items[i].getAttribute('data-mcp-ask-file') || ''
    const ext = items[i].getAttribute('data-mcp-ask-ext') || 'mp4'
    const slot = root.querySelector('[data-mcp-ask-slot]')
    if (slot) {
      slot.setAttribute('data-mcp-file', file)
      slot.setAttribute('data-mcp-ext', ext)
      slot.classList.toggle('is-v', items[i].getAttribute('data-mcp-ask-ratio') === '9:16')
      if (ext === 'mp4') slot.setAttribute('data-mcp-loop-seconds', '15')
      else slot.removeAttribute('data-mcp-loop-seconds')
      if (ext === 'mp4' && file === 'mcplongformchatplaceholder') {
        slot.setAttribute('data-mcp-hover-audio', '')
      } else {
        slot.removeAttribute('data-mcp-hover-audio')
      }
      fillMediaSlot(slot, { replace: true })
    }
    askMock?.show(prompt)
  }

  function tick() {
    if (reduceMotion() || paused) return
    timer = window.setTimeout(() => {
      paint(i + 1)
      tick()
    }, 5000)
  }

  function muteAskPreview() {
    root.querySelectorAll('[data-mcp-hover-audio] video, [data-mcp-ask-slot] video').forEach((video) => {
      video.muted = true
    })
  }

  items.forEach((el, idx) => {
    el.addEventListener('pointerenter', muteAskPreview)
    el.addEventListener('click', () => {
      window.clearTimeout(timer)
      paint(idx)
      tick()
    })
  })
  const list = root.querySelector('.mcp-ask-list')
  list?.addEventListener('pointerenter', () => {
    paused = true
    window.clearTimeout(timer)
    muteAskPreview()
  })
  list?.addEventListener('pointerleave', () => { paused = false; tick() })

  paint(0)
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

function mountMcpModels(root = document) {
  const grid = root.querySelector('[data-mcp-models]')
  if (!grid || grid.dataset.filled) return
  grid.dataset.filled = '1'
  const models = mcpLatestModels()
  const icons = {
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9l6 3-6 3z"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v18M8 8v8M16 8v8M4 11v2M20 11v2"/></svg>',
    script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  }
  grid.innerHTML = models.map((model, i) => {
    const slug = modelSlug(model.id)
    const icon = icons[model.group] || icons.image
    return `<a class="mcp-model-tile" href="${modelHref(model.id)}" data-model="${slug}" style="--i:${i}">
      <span class="mcp-model-shot is-blank" data-mcp-model-shot></span>
      <span class="mcp-model-pill">${icon}<span>${model.name}</span></span>
    </a>`
  }).join('')
  grid.querySelectorAll('.mcp-model-tile').forEach((tile, i) => {
    tile.style.transitionDelay = reduceMotion() ? '0ms' : (Math.min(i, 24) * 40) + 'ms'
    const model = models[i]
    if (model) bindMcpModelTile(tile, model)
  })
  const section = grid.closest('.mcp-models')
  if (!section) return
  const playTiles = () => {
    if (reduceMotion()) return
    section.querySelectorAll('video').forEach((v) => {
      try { v.muted = true; v.play().catch(() => {}) } catch (_) {}
    })
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      section.classList.add('is-in')
      playTiles()
    }
  }, { threshold: 0.12 })
  io.observe(section)
  if (reduceMotion()) section.classList.add('is-in')
}

function probeUrl(url) {
  if (!url) return Promise.resolve(false)
  return fetch(url, { method: 'GET', mode: 'cors', headers: { Range: 'bytes=0-0' } })
    .then((r) => r.ok || r.status === 206)
    .catch(() => false)
}

function attachMcpClip(host, url) {
  const v = document.createElement('video')
  v.muted = true
  v.defaultMuted = true
  v.volume = 0
  v.loop = true
  v.playsInline = true
  v.autoplay = true
  v.preload = 'metadata'
  v.setAttribute('muted', '')
  v.setAttribute('playsinline', '')
  v.setAttribute('autoplay', '')
  v.setAttribute('type', 'video/mp4')
  v.src = url
  v.addEventListener('loadeddata', () => {
    host.classList.remove('is-blank')
    if (reduceMotion()) return
    try { v.play().catch(() => {}) } catch (_) {}
  })
  v.addEventListener('error', () => { try { v.remove() } catch (_) {} })
  host.appendChild(v)
}

function bindMcpModelTile(tile, model) {
  const host = tile.querySelector('[data-mcp-model-shot]')
  if (!host) return
  const poster = modelCardSrc(model.id)
  const clip = modelCardClipSrc(model.id)
  probeUrl(poster).then((ok) => {
    if (!ok) return
    const img = document.createElement('img')
    img.alt = ''
    img.decoding = 'async'
    img.loading = 'lazy'
    img.src = poster
    host.appendChild(img)
    host.classList.remove('is-blank')
  })
  if (CATALOG_CLIP_FILES[model.id] || CATALOG_CLIP_FILES[modelSlug(model.id)]) {
    attachMcpClip(host, clip)
    return
  }
  probeUrl(clip).then((ok) => { if (ok) attachMcpClip(host, clip) })
}

export function mountMcpPage() {
  const claude = document.querySelector('[data-claude-icon]')
  if (claude && CLAUDE_ICON) claude.setAttribute('src', CLAUDE_ICON)
  mountAnnounce()
  mountLandingToolsMenu()
  mountLandingFooter()
  try {
    window.applyVidsoSocialLinks && window.applyVidsoSocialLinks()
    window.applyVidsoSupportLinks && window.applyVidsoSupportLinks()
  } catch (_) {}
  bindBrokenMedia()
  fillCliCommands()
  fillAgentPrompts()
  fillAllMediaSlots()
  mountClientTabs()
  mountModeToggle()
  const askMock = mountAskMock()
  mountAsk(document, askMock)
  mountAskCopy()
  mountMcpModels()
  mountFaq()
  mountLandingIntegrations()
  wrapGlowLabels()
  mountLandingReveals()
  window.__checkHeadingCenters = checkHeadingCenters
}
