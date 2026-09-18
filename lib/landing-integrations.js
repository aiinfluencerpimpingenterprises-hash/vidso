import { bindMediaPlaceholders, fillPlaceholderEl } from './media-placeholder.js'

/** Swap `src` for a finished screenshot. Empty keeps the mock. */
export const INTEGRATION_PROOF = {
  claude: {
    src: '',
    thumb: 'https://pub-f40c956471ff49feab622906892ec527.r2.dev/claudemcpthumbnail.png',
    alt: 'Airport secrets video thumbnail',
  },
}

export function mcpLandingUrl() {
  return 'https://www.vidso.pro/mcp'
}

function idleLabel(btn) {
  return btn.getAttribute('data-mcp-idle') || 'Copy'
}

function paintCopy(btn, copied) {
  const label = btn.querySelector('[data-mcp-copy-label]')
  if (copied) {
    btn.dataset.copied = '1'
    if (label) label.textContent = 'Copied'
  } else {
    delete btn.dataset.copied
    if (label) label.textContent = idleLabel(btn)
  }
}

function dropBrokenLogos(root) {
  root.querySelectorAll('[data-mcp-logo]').forEach((el) => {
    const drop = () => el.remove()
    el.addEventListener('error', drop)
    if (el.tagName === 'IMG' && el.complete && el.naturalWidth === 0 && el.getAttribute('src')) drop()
  })
}

export function mountLandingIntegrations(root = document) {
  const doc = root.querySelectorAll ? root : document
  bindMediaPlaceholders(doc)
  dropBrokenLogos(doc)

  const url = mcpLandingUrl()
  const live = doc.querySelector('[data-mcp-live]') || document.querySelector('[data-mcp-live]')
  const buttons = [...doc.querySelectorAll('[data-mcp-copy]')]

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const custom = btn.getAttribute('data-mcp-copy-text')
      const payload = custom || url
      try {
        await navigator.clipboard.writeText(payload)
        const peers = custom ? [btn] : buttons.filter((other) => !other.getAttribute('data-mcp-copy-text'))
        peers.forEach((other) => paintCopy(other, true))
        if (live) live.textContent = 'Copied'
        setTimeout(() => {
          peers.forEach((other) => paintCopy(other, false))
          if (live) live.textContent = ''
        }, 2000)
      } catch (_) {
        btn.dataset.copied = '0'
        if (live) live.textContent = 'Copy failed'
      }
    })
  })

  Object.entries(INTEGRATION_PROOF).forEach(([key, rec]) => {
    const frame = doc.querySelector(`[data-proof="${key}"]`)
    const thumb = doc.querySelector(`[data-proof-thumb="${key}"]`)
    const src = String(rec?.src || '').trim()
    const thumbSrc = String(rec?.thumb || '').trim()
    if (src && frame) {
      fillPlaceholderEl(frame, src, { alt: rec.alt || '' })
      const mock = frame.querySelector('[data-proof-mock]')
      if (mock) mock.hidden = true
    }
    if (thumbSrc && thumb) fillPlaceholderEl(thumb, thumbSrc, { alt: rec.alt || '' })
  })
}
