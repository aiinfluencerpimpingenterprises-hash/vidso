import { CLAUDE_ICON, MCP_CONNECT_LABELS, MCP_CONNECT_TOOLS, VIDSO_AGENT_SETUP_PROMPT, VIDSO_CLI } from './landing-media.js'
import { mountLandingIntegrations } from './landing-integrations.js'
import { mountAnnounce, mountFaq, wrapGlowLabels } from './landing-page.js'
import { mountLandingReveals, checkHeadingCenters } from './landing-reveal.js?v=d1f69'
import { mountLandingToolsMenu } from './landing-tools-menu.js'
import { mountLandingFooter } from './landing-footer.js'
import { fillAllMediaSlots, fillMediaSlot, mountAskMock, mountFeatureMocks } from './mcp-mocks.js?v=d1f81'

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

function fillConnectRows(root = document) {
  const list = root.querySelector('[data-mcp-connect-list]')
  if (!list || list.dataset.filled) return
  list.dataset.filled = '1'
  MCP_CONNECT_TOOLS.forEach((name) => {
    const li = document.createElement('li')
    li.hidden = true
    li.setAttribute('data-mcp-step', '')
    li.innerHTML = '<span class="mcp-check" aria-hidden="true"></span><span class="mcp-tool-name"></span>'
    li.querySelector('.mcp-tool-name').textContent = MCP_CONNECT_LABELS[name] || name
    list.appendChild(li)
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

function mountFeatureTabs(root = document, mocks) {
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
    mocks?.sync()
  }
  tabs.forEach((tab) => { tab.tabIndex = tab.classList.contains('is-on') ? 0 : -1 })
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
      if (!slot.querySelector('img,video')) fillMediaSlot(slot)
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
  mountLandingFooter()
  try {
    window.applyVidsoSocialLinks && window.applyVidsoSocialLinks()
    window.applyVidsoSupportLinks && window.applyVidsoSupportLinks()
  } catch (_) {}
  bindBrokenMedia()
  fillCliCommands()
  fillAgentPrompts()
  fillConnectRows()
  fillAllMediaSlots()
  mountClientTabs()
  mountModeToggle()
  const mocks = mountFeatureMocks()
  mountFeatureTabs(document, mocks)
  const askMock = mountAskMock()
  mountAsk(document, askMock)
  mountAskCopy()
  mountFaq()
  mountLandingIntegrations()
  wrapGlowLabels()
  mountLandingReveals()
  mocks.sync()
  window.__checkHeadingCenters = checkHeadingCenters
}
