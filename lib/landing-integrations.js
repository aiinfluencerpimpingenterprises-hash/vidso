import { bindMediaPlaceholders, fillPlaceholderEl } from '/lib/media-placeholder.js'

/** Swap these src values for finished screenshots. Empty keeps the in-page mock. */
export const INTEGRATION_PROOF = {
  claude: {
    src: '',
    alt: 'Claude conversation uploading a finished Vidso video to YouTube',
  },
  youtube: {
    src: '',
    alt: 'Vidso YouTube publish form with title and description from the project',
  },
}

export function mountLandingIntegrations(root = document) {
  bindMediaPlaceholders(root)
  Object.entries(INTEGRATION_PROOF).forEach(([key, rec]) => {
    const el = (root.querySelectorAll ? root : document).querySelector(`[data-proof="${key}"]`)
    if (!el) return
    const src = String(rec?.src || '').trim()
    if (!src) return
    fillPlaceholderEl(el, src, { alt: rec.alt || '' })
    const mock = el.querySelector('[data-proof-mock]')
    if (mock) mock.hidden = true
  })
}
