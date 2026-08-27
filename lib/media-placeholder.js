/** Config-driven 16:9 (or other) image with a tinted fallback when the URL is empty or fails. */

export function mediaPlaceholderHtml({
  src = '',
  ratio = '16 / 9',
  className = '',
  alt = '',
  icon = '',
} = {}) {
  const srcSafe = String(src || '').trim()
  const img = srcSafe
    ? `<img src="${escAttr(srcSafe)}" alt="${escAttr(alt)}" loading="lazy" decoding="async">`
    : ''
  const ph = icon ? `<div class="media-ph-icon" aria-hidden="true">${icon}</div>` : ''
  return `<div class="media-ph${className ? ' ' + className : ''}" style="aspect-ratio:${ratio}" data-media-ph>${ph}${img}</div>`
}

export function bindMediaPlaceholders(root = document) {
  ;(root.querySelectorAll ? root : document).querySelectorAll('[data-media-ph] img').forEach((img) => {
    if (img.dataset.phBound) return
    img.dataset.phBound = '1'
    img.addEventListener('error', () => img.remove())
  })
}

export function fillPlaceholderEl(el, src, { alt = '' } = {}) {
  if (!el) return
  const url = String(src || '').trim()
  el.querySelectorAll('img').forEach((n) => n.remove())
  if (!url) return
  const img = document.createElement('img')
  img.src = url
  img.alt = alt
  img.loading = 'lazy'
  img.decoding = 'async'
  img.addEventListener('error', () => img.remove())
  el.appendChild(img)
}

export function fillPlaceholderFan(container, urls) {
  if (!container) return
  const cards = [...container.querySelectorAll('[data-media-ph], .img-empty-card')]
  ;(urls || []).forEach((url, i) => {
    const card = cards[i]
    if (!card) return
    fillPlaceholderEl(card, url)
  })
}

function escAttr(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}
