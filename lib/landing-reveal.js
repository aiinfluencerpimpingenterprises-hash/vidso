function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function markIn(el) {
  if (!el || el.classList.contains('is-in')) return
  el.style.opacity = ''
  el.style.transform = ''
  el.style.filter = ''
  el.classList.add('is-in')
  el.addEventListener('transitionend', () => {
    el.style.willChange = 'auto'
  }, { once: true })
}

function wrapLines(el) {
  if (!el || el.dataset.rvLined) return
  const parts = [...el.querySelectorAll(':scope > .l1, :scope > .l2, :scope > .h1-l')]
  if (parts.length) {
    parts.forEach((line, i) => {
      const clip = document.createElement('span')
      clip.className = 'rv-clip'
      line.parentNode.insertBefore(clip, line)
      line.classList.add('rv-line')
      line.style.setProperty('--rv-delay', (100 + i * 80) + 'ms')
      clip.appendChild(line)
    })
    el.dataset.rvLined = '1'
    return
  }
  if (el.children.length) {
    el.classList.add('rv')
    return
  }
  const clip = document.createElement('span')
  clip.className = 'rv-clip'
  const line = document.createElement('span')
  line.className = 'rv-line'
  line.textContent = el.textContent
  el.textContent = ''
  clip.appendChild(line)
  el.appendChild(clip)
  el.dataset.rvLined = '1'
}

export function revealNow(root) {
  if (!root) return
  root.querySelectorAll('.rv, .rv-line, .rv-media, .rv-item').forEach(markIn)
  markIn(root)
}

export function mountLandingReveals() {
  const page = document.querySelector('.lp-red')
  if (!page || !document.documentElement.classList.contains('js-reveal')) return

  const scopes = [...page.querySelectorAll('.loved, .showcase, .shorts, .workflow-tiles, .lp-feat, .mcp-hero, .formats-float, .why-stack, .faq, .final, .format-econ, .compare, .comp-compare, .pricing, .results, footer')]
  scopes.forEach((sec) => {
    sec.classList.add('rv-scope')
    const eyebrow = sec.querySelector('.eyebrow')
    if (eyebrow) {
      eyebrow.classList.add('rv', 'rv-eye')
    }
    sec.querySelectorAll('h2.two-line, h2.h-split, .shorts-title, .mcp-title, .s-head h2, .feat-copy h2, .final-box h2').forEach(wrapLines)
    sec.querySelectorAll('.lp-sub, .feat-copy p, .mcp-sub, .final-box p, .wf-punch').forEach((p) => p.classList.add('rv', 'rv-sub'))
    sec.querySelectorAll('.feat-media, .coverflow, .shorts-row, .results-shot, .tab-still, .fmt-vis, .mcp-chat, .mcp-panel, .mcp-keys').forEach((m) => m.classList.add('rv-media'))
    const items = sec.querySelectorAll('.wf-tile, .fmt-float, .mcp-step, .cmp, .plan, .faq-grid details, .cover-dots button')
    items.forEach((el, i) => {
      el.classList.add('rv-item')
      el.style.setProperty('--rv-delay', (i * 80) + 'ms')
    })
    sec.querySelectorAll('.btn, .prompt-box, .mcp-urlbar, .mcp-cta').forEach((b) => b.classList.add('rv', 'rv-btn'))
    const feat = sec.classList.contains('lp-feat')
    if (feat) {
      const copy = sec.querySelector('.feat-copy')
      const media = sec.querySelector('.feat-media')
      const flip = sec.classList.contains('is-flip')
      if (copy) copy.classList.add('rv', flip ? 'rv-from-left' : 'rv-from-right')
      if (media) media.classList.add('rv-media')
    }
  })

  if (reduceMotion()) {
    document.querySelectorAll('.rv, .rv-line, .rv-media, .rv-item').forEach(markIn)
    return
  }

  const nodes = [...document.querySelectorAll('.rv, .rv-line, .rv-media, .rv-item')]
  nodes.forEach((el) => { el.style.willChange = 'opacity, transform, filter' })

  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return
      markIn(en.target)
      io.unobserve(en.target)
    })
  }, { rootMargin: '0px 0px -15% 0px', threshold: 0.01 })
  nodes.forEach((el) => io.observe(el))

  const hash = (location.hash || '').slice(1)
  if (hash) {
    const target = document.getElementById(hash)
    if (target) revealNow(target)
  }
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').slice(1)
    if (!id) return
    revealNow(document.getElementById(id))
  })

  setTimeout(() => {
    document.querySelectorAll('.rv:not(.is-in), .rv-line:not(.is-in), .rv-media:not(.is-in), .rv-item:not(.is-in)').forEach(markIn)
  }, 3000)
}
