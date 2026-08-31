import {
  FEATURE_ROWS,
  TIERS,
  TRUST_LINE,
  formatPrice,
  isAnnualCycle,
  planView,
  popularTier,
  rowIncluded,
} from '/lib/pricing.js'

const ICO_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>'
const ICO_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}

function featureCell(row, tier) {
  const on = rowIncluded(row, tier)
  const val = row.type === 'value' ? `<span class="feat-val">${esc(row[tier])}</span>` : ''
  return `<li class="feat-row${on ? '' : ' off'}">
      ${on ? ICO_ON : ICO_OFF}
      <span class="feat-label">${esc(row.label)}</span>
      ${val}
    </li>`
}

function cardHtml(tier, opts) {
  const plan = planView(tier)
  const cardClass = opts.variant === 'paywall' ? 'paywall-plan' : 'plan'
  const btnClass = opts.variant === 'paywall' ? 'btn btn-secondary' : 'btn'
  const quotaClass = plan.highlightQuota ? 'hl' : ''
  const ctaAttrs = opts.variant === 'paywall'
    ? `type="button" class="${btnClass}" data-tier="${esc(plan.checkoutKey)}"`
    : `type="button" class="${btnClass}" data-signup="1"`
  const cta = `<button ${ctaAttrs}>${esc(plan.cta)}</button>`
  const metrics = `<div class="metrics">
      <div class="metric"><span>Long-form videos</span><strong class="${quotaClass}">${esc(plan.longForm)}</strong></div>
      <div class="metric"><span>Short-form videos</span><strong class="${quotaClass}">${esc(plan.shortForm)}</strong></div>
    </div>`
  const features = `<ul class="feat">${FEATURE_ROWS.filter((row) => !row.hidden).map((row) => featureCell(row, tier)).join('')}</ul>`
  const body = opts.variant === 'paywall'
    ? `${metrics}${features}${cta}`
    : `${cta}${metrics}${features}`

  return `<article class="${cardClass}" data-plan="${esc(tier)}">
    <span class="tag">Most popular</span>
    <div class="pn">${esc(plan.name)}</div>
    <div class="pd">${esc(plan.tagline)}</div>
    <div class="price">
      <span class="was">$${esc(formatPrice(plan.monthly))}</span>
      <span class="amt" data-m="${esc(formatPrice(plan.monthly))}" data-a="${esc(formatPrice(plan.annualPerMonth))}">$${esc(formatPrice(plan.monthly))}</span>
      <span class="per">/mo</span>
      <span class="pct">${esc(plan.savingsLabel)}</span>
    </div>
    <div class="bill" data-m="Billed monthly" data-a="Billed annually">Billed monthly</div>
    ${body}
  </article>`
}

function applyCycle(root, cycle) {
  const annual = isAnnualCycle(cycle)
  const pop = popularTier(cycle)
  const cardSel = root.querySelector('.paywall-plan') ? '.paywall-plan' : '.plan'
  root.querySelectorAll(cardSel).forEach((card) => {
    const tier = card.getAttribute('data-plan')
    const view = planView(tier)
    card.classList.toggle('is-annual', annual)
    card.classList.toggle('pop', tier === pop)
    const amt = card.querySelector('.amt')
    const bill = card.querySelector('.bill')
    const pct = card.querySelector('.pct')
    if (amt) amt.textContent = '$' + (annual ? formatPrice(view.annualPerMonth) : formatPrice(view.monthly))
    if (bill) bill.textContent = annual ? 'Billed annually' : 'Billed monthly'
    if (pct) pct.textContent = view.savingsLabel
    const btn = card.querySelector('[data-tier], [data-signup]')
    if (btn && card.classList.contains('paywall-plan')) {
      const on = tier === pop
      btn.classList.toggle('btn-primary', on)
      btn.classList.toggle('btn-secondary', !on)
    }
  })
}

export function mountPricing(root, opts = {}) {
  if (!root) return null
  const variant = opts.variant === 'paywall' ? 'paywall' : 'landing'
  root.innerHTML = TIERS.map((tier) => cardHtml(tier, { variant })).join('')
  applyCycle(root, opts.cycle || 'monthly')

  root.querySelectorAll('[data-signup]').forEach((btn) => {
    btn.addEventListener('click', () => { location.href = '/signup' })
  })
  if (typeof opts.onCta === 'function') {
    root.querySelectorAll('[data-tier]').forEach((btn) => {
      btn.addEventListener('click', () => opts.onCta(btn.getAttribute('data-tier')))
    })
  }

  return {
    setCycle(cycle) { applyCycle(root, cycle) },
  }
}

export function bindLandingToggle(toggleRoot, plansRoot) {
  if (!toggleRoot || !plansRoot) return
  const thumb = toggleRoot.querySelector('.bill-thumb') || document.getElementById('billThumb')
  function moveThumb(btn) {
    if (!thumb || !btn) return
    thumb.style.width = btn.offsetWidth + 'px'
    thumb.style.transform = 'translateX(' + (btn.offsetLeft - 4) + 'px)'
  }
  function sync() {
    const on = toggleRoot.querySelector('.bill-tg.active') || toggleRoot.querySelector('.bill-tg')
    moveThumb(on)
  }
  toggleRoot.querySelectorAll('.bill-tg').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleRoot.querySelectorAll('.bill-tg').forEach((el) => el.classList.remove('active'))
      btn.classList.add('active')
      moveThumb(btn)
      applyCycle(plansRoot, btn.getAttribute('data-cycle'))
    })
  })
  window.addEventListener('resize', sync)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync)
  requestAnimationFrame(sync)
}

export { TRUST_LINE, applyCycle }
