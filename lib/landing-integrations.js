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

export function mountLandingIntegrations(root = document) {
  const doc = root.querySelectorAll ? root : document
  bindMediaPlaceholders(doc)

  const url = mcpLandingUrl()
  doc.querySelectorAll('[data-mcp-url]').forEach((el) => {
    el.textContent = url
  })

  doc.querySelectorAll('[data-mcp-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url)
        btn.dataset.copied = '1'
        const label = btn.querySelector('[data-mcp-copy-label]')
        if (label) label.textContent = 'Copied'
        setTimeout(() => {
          delete btn.dataset.copied
          if (label) label.textContent = 'Copy'
        }, 1600)
      } catch (_) {
        btn.dataset.copied = '0'
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
