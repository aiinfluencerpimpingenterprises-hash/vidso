import { MODELS_HREF, VIDSO_MODELS, modelHref, modelSlug } from './vidso-models.js'

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function col(title, links) {
  return `<div class="fcol">
    <p class="fcol-h">${esc(title)}</p>
    ${links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}
  </div>`
}

export function footerInnerHtml() {
  const home = '/home'
  const models = VIDSO_MODELS.map((m) => ({ href: modelHref(m.id), label: m.name }))
  return `<div class="foot">
    <div class="foot-brand">
      <p class="foot-tag">Create videos with AI.</p>
      <p class="fdesc">Script, voice, footage, and captions. One workspace for any video you want to make.</p>
      <div class="foot-social" data-vidso-socials></div>
    </div>
    ${col('Product', [
      { href: '/video-generation', label: 'Long Form Generator' },
      { href: '/image-generation', label: 'Thumbnail Generator' },
      { href: '/clipping', label: 'Clipping' },
      { href: '/ranking', label: 'Ranking' },
      { href: '/editor', label: 'Video Editor' },
      { href: '/mcp', label: 'MCP' },
      { href: home + '#how', label: 'Workflow' },
      { href: home + '#pricing', label: 'Plans' },
    ])}
    ${col('Models', models)}
    ${col('Resources', [
      { href: home + '#faq', label: 'FAQ' },
      { href: '/tutorials', label: 'Tutorials' },
      { href: home + '#faq', label: 'Help' },
    ])}
    ${col('Account', [
      { href: '/login', label: 'Log in' },
      { href: '/signup', label: 'Sign up' },
      { href: '/overview', label: 'Dashboard' },
    ])}
    ${col('Legal', [
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/refund', label: 'Refund policy' },
    ])}
  </div>
  <div class="foot-copy">© 2026 Vidso · vidso.pro</div>
  <div class="foot-mega" aria-hidden="true"><span class="word">Vidso</span></div>`
}

export function mountLandingFooter() {
  const foot = document.querySelector('footer')
  if (!foot) return
  const wrap = foot.querySelector('.wrap') || foot
  const support = foot.querySelector('[data-vidso-support]')
  wrap.innerHTML = footerInnerHtml()
  const legal = wrap.querySelector('.fcol:last-of-type')
  if (legal) {
    const a = document.createElement('a')
    a.setAttribute('data-vidso-support', '')
    a.setAttribute('data-label', 'Contact support')
    a.setAttribute('data-fill-text', '')
    if (support) {
      a.href = support.getAttribute('href') || '#'
      a.textContent = support.textContent || 'Contact support'
    } else {
      a.textContent = 'Contact support'
    }
    legal.appendChild(a)
  }
  wrap.querySelectorAll('a[href^="' + MODELS_HREF + '#"]').forEach((a) => {
    const id = (a.getAttribute('href') || '').split('#')[1]
    if (id) a.setAttribute('data-model', modelSlug(id))
  })
}
