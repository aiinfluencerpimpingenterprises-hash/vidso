import {
  FEATURE_ROWS,
  TIERS,
  TRUST_LINE,
  formatPrice,
  isAnnualCycle,
  longCycleLabel,
  planView,
  popularTier,
  rowIncluded,
} from '/lib/pricing.js'

const ICO_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>'

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]))
}

const NAMES = { plus: 'Plus', pro: 'Pro', studio: 'Studio', agency: 'Agency' }
const visibleRows = () => FEATURE_ROWS.filter((row) => !row.hidden)

// Numbers that differ by plan ("Channels 3"): the same rows on every card, so the cards line up.
export function specRows(tier) {
  return visibleRows().filter((row) => row.type === 'value').map((row) => ({ label: row.label, value: String(row[tier]) }))
}

// Every feature the plan has, so a pricier plan always shows a longer list.
// What it adds over the plan below comes first and is marked new.
export function planIncludes(tier) {
  const i = TIERS.indexOf(tier)
  const checks = visibleRows().filter((row) => row.type === 'check')
  const all = checks.filter((row) => rowIncluded(row, tier)).map((row) => row.label)
  if (i <= 0) return { heading: 'Includes', items: all.map((label) => ({ label, isNew: false })) }
  const prev = TIERS[i - 1]
  let added = checks.filter((row) => rowIncluded(row, tier) && !rowIncluded(row, prev)).map((row) => row.label)
  if (!added.length) {
    // Same tools as the plan below: say what grows instead.
    const num = (s) => Number(String(s).replace(/[^\d.]/g, '')) || 0
    const credits = planView(tier).credits.replace(' / month', '')
    const times = num(credits) / (num(planView(prev).credits) || 1)
    const channels = FEATURE_ROWS.find((row) => row.label === 'Channels')
    added = [credits + ' credits a month' + (times > 1 ? `, ${Math.round(times * 10) / 10}× ${NAMES[prev]}` : '')]
    if (channels && channels[tier] !== channels[prev]) added.push(`Up to ${channels[tier]} channels`)
  }
  const rest = all.filter((label) => !added.includes(label))
  return {
    heading: 'Includes',
    items: added.map((label) => ({ label, isNew: true })).concat(rest.map((label) => ({ label, isNew: false }))),
  }
}

function cardHtml(tier, opts) {
  const plan = planView(tier)
  const cardClass = opts.variant === 'paywall' ? 'paywall-plan' : 'plan'
  const btnClass = opts.variant === 'paywall' ? 'btn btn-secondary' : 'btn'
  const ctaAttrs = opts.variant === 'paywall'
    ? `type="button" class="${btnClass}" data-tier="${esc(plan.checkoutKey)}"`
    : `type="button" class="${btnClass}" data-signup="1"`
  const specs = specRows(tier).map((r) => `<li><span>${esc(r.label)}</span><b>${esc(r.value)}</b></li>`).join('')
  const incl = planIncludes(tier)
  const feats = incl.items.map((it) => `<li class="feat-row${it.isNew ? ' is-new' : ''}">${ICO_ON}<span class="feat-label">${esc(it.label)}</span></li>`).join('')

  // Every card has the same sections in the same order, so they line up row by row.
  return `<article class="${cardClass}" data-plan="${esc(tier)}">
    <div class="p-head">
      <div class="p-name"><span class="pn">${esc(plan.name)}</span><span class="tag">Most popular</span></div>
      <div class="pd">${esc(plan.tagline)}</div>
    </div>
    <div class="p-price">
      <div class="price">
        <span class="amt" data-m="${esc(formatPrice(plan.monthly))}" data-a="${esc(formatPrice(plan.annualPerMonth))}">$${esc(formatPrice(plan.monthly))}</span>
        <span class="per">/mo</span>
        <span class="was">$${esc(formatPrice(plan.monthly))}</span>
      </div>
      <div class="p-sub"><span class="pct">${esc(plan.savingsLabel)}</span><span class="bill">Billed monthly</span></div>
    </div>
    <button ${ctaAttrs}>${esc(plan.cta)}</button>
    <div class="metrics">
      <div class="metric"><strong>${esc(plan.credits.replace(' / month', ''))}</strong><span>credits a month</span></div>
      <div class="metric"><strong>${esc(plan.minutes)}</strong><span>of video a month</span></div>
    </div>
    <ul class="specs">${specs}</ul>
    <div class="incl"><p class="incl-h">${esc(incl.heading)}</p><ul class="feat">${feats}</ul></div>
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
    if (bill) bill.textContent = annual ? longCycleLabel(tier) : 'Billed monthly'
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
