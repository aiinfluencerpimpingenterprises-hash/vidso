import { APP_HOME_HREF } from './public-tools.js'
import { CATALOG_MODELS, MODELS_HREF, modelHref, modelSlug } from './vidso-models.js'

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
  const models = CATALOG_MODELS.map((m) => ({ href: modelHref(m.id), label: m.name }))
  return `<div class="foot">
    <div class="foot-brand">
      <p class="foot-tag">Create videos with AI.</p>
      <p class="fdesc">Script, voice, footage, and captions. One workspace for any video you want to make.</p>
      <div class="foot-social" data-vidso-socials></div>
    </div>
    ${col('Start Creating', [
      { href: home, label: 'Home' },
      { href: APP_HOME_HREF, label: 'Long Form Generator' },
      { href: APP_HOME_HREF, label: 'Thumbnail Generator' },
      { href: APP_HOME_HREF, label: 'Clipping' },
      { href: APP_HOME_HREF, label: 'Ranking' },
      { href: APP_HOME_HREF, label: 'AI Voiceover' },
      { href: APP_HOME_HREF, label: 'AI Captions' },
      { href: APP_HOME_HREF, label: 'Video Editor' },
      { href: '/mcp', label: 'MCP' },
    ])}
    ${col('AI Models', models)}
    ${col('Features', [
      { href: APP_HOME_HREF, label: 'AI Video Generator' },
      { href: APP_HOME_HREF, label: 'AI Thumbnail Generator' },
      { href: APP_HOME_HREF, label: 'AI Voiceover' },
      { href: APP_HOME_HREF, label: 'AI Captions' },
      { href: APP_HOME_HREF, label: 'Auto Clipping' },
      { href: APP_HOME_HREF, label: 'Ranking Videos' },
      { href: APP_HOME_HREF, label: 'AI Reframe' },
      { href: APP_HOME_HREF, label: 'Video Editor' },
      { href: APP_HOME_HREF, label: 'Video Downloader' },
      { href: APP_HOME_HREF, label: 'Video Commentary' },
      { href: '/mcp', label: 'Vidso MCP' },
    ])}
    ${col('Resources', [
      { href: home + '#faq', label: 'FAQ' },
      { href: '/tutorials', label: 'Tutorials' },
      { href: home + '#faq', label: 'Help Center' },
    ])}
    ${col('Company', [
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/refund', label: 'Refund policy' },
      { href: '/login', label: 'Log in' },
      { href: '/signup', label: 'Sign up' },
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
