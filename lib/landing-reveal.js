function reduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

function wrapLines(el) {
  if (!el || el.dataset.rvLined) return
  const parts = [...el.querySelectorAll(':scope > .l1, :scope > .l2, :scope > .h1-l')]
  if (parts.length) {
    parts.forEach((line) => {
      const clip = document.createElement('span')
      clip.className = 'rv-clip'
      line.parentNode.insertBefore(clip, line)
      line.classList.add('rv-line')
      clip.appendChild(line)
    })
    el.dataset.rvLined = '1'
    return
  }
  const clip = document.createElement('span')
  clip.className = 'rv-clip'
  const line = document.createElement('span')
  line.className = 'rv-line'
  while (el.firstChild) line.appendChild(el.firstChild)
  clip.appendChild(line)
  el.appendChild(clip)
  el.dataset.rvLined = '1'
}

function startAt(pct) {
  return 'top ' + pct + '%'
}

export function revealNow(root) {
  if (!root || !window.gsap) return
  root.querySelectorAll('.rv-copy, .rv-line, .rv-media, .rv-item, .rv-eye, .rv-sub').forEach((el) => {
    window.gsap.set(el, { opacity: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)' })
  })
}

function inkBox(el) {
  const restore = []
  ;[el, ...el.querySelectorAll('.rv-line, .rv-clip, .rv-copy, .rv-eye, .rv-sub')].forEach((node) => {
    restore.push([node, node.style.transform, node.style.filter])
    node.style.transform = 'none'
    node.style.filter = 'none'
  })
  let left = Infinity
  let right = -Infinity
  try {
    const range = document.createRange()
    range.selectNodeContents(el)
    ;[...range.getClientRects()].forEach((r) => {
      if (r.width < 2 || r.height < 2) return
      left = Math.min(left, r.left)
      right = Math.max(right, r.right)
    })
  } catch (_) {}
  if (!Number.isFinite(left) || right <= left) {
    const r = el.getBoundingClientRect()
    left = r.left
    right = r.right
  }
  restore.forEach(([node, t, f]) => {
    node.style.transform = t
    node.style.filter = f
  })
  return { left, width: right - left }
}

export function checkHeadingCenters(root = document) {
  const skip = (el) => !!(
    el.closest('.feat-copy') ||
    el.closest('footer') ||
    el.closest('.faq-grid') ||
    el.closest('table') ||
    el.closest('.plan') ||
    el.closest('.cmp') ||
    el.closest('.mcp-step') ||
    el.closest('.fmt-float') ||
    el.closest('.wf-tile') ||
    el.closest('.model-card') ||
    el.closest('.fcol') ||
    el.closest('.top-models-tile') ||
    el.closest('.yt-stat') ||
    el.closest('.ugc-card')
  )
  const secs = [...root.querySelectorAll('.showcase, .shorts, .workflow-tiles, .top-models, .models-hero, .models-index, .mcp-hero, .mcp-excerpt, .mcp-setup, .mcp-ask, .mcp-models, .formats-float, .why-stack, .faq, .final, .format-econ, .compare, .comp-compare, .pricing, .results, .yt-compact, .ugc-row')].filter((sec) => !sec.hasAttribute('data-roadmap'))
  return secs.flatMap((sec) => {
    const sr = sec.getBoundingClientRect()
    const mid = sr.left + sr.width / 2
    return [...sec.querySelectorAll('h2')].filter((h) => !skip(h)).map((h) => {
      const r = inkBox(h)
      const hMid = r.left + r.width / 2
      const delta = Math.round(hMid - mid)
      return {
        text: (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 64),
        delta,
        ok: Math.abs(delta) <= 4,
      }
    })
  })
}

export function mountLandingReveals() {
  const page = document.querySelector('.lp-red')
  if (!page) return

  if (reduceMotion() || !document.documentElement.classList.contains('js-reveal')) {
    document.documentElement.classList.remove('js-reveal')
    return
  }

  const gsap = window.gsap
  const ST = window.ScrollTrigger
  if (!gsap || !ST) {
    document.documentElement.classList.remove('js-reveal')
    return
  }

  const scopes = [...page.querySelectorAll('.showcase, .shorts, .workflow-tiles, .top-models, .models-hero, .models-index, .lp-feat, .mcp-hero, .mcp-excerpt, .mcp-setup, .mcp-ask, .mcp-models, .formats-float, .why-stack, .faq, .final, .format-econ, .compare, .comp-compare, .pricing, .results, .yt-compact, .ugc-row')].filter((sec) => !sec.hasAttribute('data-roadmap') && !sec.hidden)
  scopes.forEach((sec) => {
    const eyebrow = sec.querySelector('.s-head .eyebrow, .shorts-head .eyebrow')
    if (eyebrow) eyebrow.classList.add('rv-eye')
    sec.querySelectorAll('h2.two-line, h2.h-split, .shorts-title, .s-head h2, .final-box h2, .models-hero h1, .top-models-copy h2').forEach(wrapLines)
    sec.querySelectorAll('.s-head .lp-sub, .shorts-head .lp-sub, .mcp-sub, .final-box p, .wf-punch, .formats-float .lp-sub, .mcp-excerpt .lp-sub, .mcp-ask .lp-sub, .mcp-models .lp-sub, .top-models-copy .lp-sub, .models-hero .lp-sub, .yt-compact .lp-sub, .ugc-row .lp-sub').forEach((p) => p.classList.add('rv-sub'))
    sec.querySelectorAll('.feat-media, .coverflow, .shorts-stage, .results-shot, .tab-still, .mcp-keys, .mcp-blank, .comp-table-wrap, .final-box, .top-models-orbit, .models-grid, .ugc-row-track, .yt-stats').forEach((m) => m.classList.add('rv-media'))
    const items = sec.querySelectorAll('.wf-tile, .fmt-float, .cmp, .plan, .faq-grid details, .yt-stat, .ugc-card')
    items.forEach((el, i) => {
      el.classList.add('rv-item')
      el.dataset.rvI = String(i)
    })
    if (sec.classList.contains('lp-feat')) {
      const copy = sec.querySelector('.feat-copy')
      const media = sec.querySelector('.feat-media')
      const flip = sec.classList.contains('is-flip')
      if (copy) copy.classList.add('rv-copy', flip ? 'rv-from-left' : 'rv-from-right')
      if (media) media.classList.add('rv-media')
    }
  })

  const compact = window.innerWidth < 768
  const yMain = compact ? 48 : 80
  const ySub = compact ? 28 : 40
  const yMedia = compact ? 48 : 120
  const scaleMain = compact ? 0.95 : 0.92
  const scaleMedia = compact ? 0.95 : 0.88
  const blurFrom = compact ? 'blur(0px)' : 'blur(8px)'

  function scrub(el, from, start, end) {
    if (!el) return
    gsap.fromTo(el, from, {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      filter: 'blur(0px)',
      ease: 'none',
      immediateRender: true,
      transformOrigin: '50% 50%',
      force3D: true,
      scrollTrigger: { trigger: el, start, end, scrub: 0.6 },
    })
  }

  document.querySelectorAll('.rv-line').forEach((line) => {
    const i = [...line.parentNode.parentNode.querySelectorAll('.rv-line')].indexOf(line)
    scrub(line, { opacity: 0, y: yMain, scale: scaleMain, filter: blurFrom }, startAt(i === 0 ? 95 : 92), startAt(65))
  })
  document.querySelectorAll('.rv-eye').forEach((el) => {
    scrub(el, { opacity: 0, y: ySub, scale: 1, filter: blurFrom }, startAt(93), startAt(65))
  })
  document.querySelectorAll('.rv-sub').forEach((el) => {
    scrub(el, { opacity: 0, y: ySub, scale: 1, filter: blurFrom }, startAt(91), startAt(65))
  })
  document.querySelectorAll('.rv-media').forEach((el) => {
    scrub(el, { opacity: 0, y: yMedia, scale: scaleMedia, filter: blurFrom }, startAt(95), startAt(65))
  })
  document.querySelectorAll('.rv-item').forEach((el) => {
    const i = Number(el.dataset.rvI || 0)
    scrub(el, { opacity: 0, y: yMedia, scale: scaleMedia, filter: blurFrom }, startAt(Math.max(85, 95 - i * 2)), startAt(65))
  })
  document.querySelectorAll('.rv-copy').forEach((el) => {
    const x = el.classList.contains('rv-from-left') ? -60 : el.classList.contains('rv-from-right') ? 60 : 0
    scrub(el, { opacity: 0, x, y: 0, scale: 1, filter: blurFrom }, startAt(95), startAt(65))
  })

  const refresh = () => { try { ST.refresh() } catch (_) {} }
  document.querySelectorAll('img, video').forEach((el) => {
    el.addEventListener('load', refresh, { once: true })
    el.addEventListener('loadeddata', refresh, { once: true })
  })
  window.addEventListener('load', refresh)

  function settleHash() {
    const id = (location.hash || '').slice(1)
    if (!id) return
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ block: 'start', behavior: 'auto' })
    requestAnimationFrame(() => {
      try { ST.update() } catch (_) {}
      revealNow(target)
    })
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = (a.getAttribute('href') || '').slice(1)
      const target = document.getElementById(id)
      if (!target) return
      e.preventDefault()
      history.pushState(null, '', '#' + id)
      target.scrollIntoView({ block: 'start', behavior: 'auto' })
      setTimeout(settleHash, 80)
    })
  })
  window.addEventListener('hashchange', settleHash)
  if (location.hash) setTimeout(settleHash, 80)

  window.__checkHeadingCenters = checkHeadingCenters
}
