import {
  YT_CONNECT_STEPS,
  YT_DEMOS,
  YT_FAQ,
  YT_FEATURES,
  YT_HERO,
  YT_PROMO,
} from '/lib/youtube-page.js'
import {
  bindPlaceholders,
  demoHtml,
  faqHtml,
  fanHtml,
  initAccordion,
  initPromo,
  initTabs,
} from '/lib/connect-pages.js'

document.getElementById('hero-fan').innerHTML = fanHtml(5)
document.getElementById('hero-top').textContent = YT_HERO.headingTop
document.getElementById('hero-accent').textContent = YT_HERO.headingAccent
document.getElementById('hero-sub').textContent = YT_HERO.subheading
initPromo(YT_PROMO)

document.getElementById('connect-steps').innerHTML = YT_CONNECT_STEPS.map((step) => {
  const extra = step.href
    ? `<a class="btn btn-primary" href="${step.href}">${step.label || 'Open'}</a>`
    : ''
  return `<div class="step">
    <div class="n">${step.n}</div>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    ${extra}
  </div>`
}).join('')

const demoTabs = document.getElementById('demo-tabs')
const demoRoot = document.getElementById('demo-root')
demoTabs.innerHTML = YT_DEMOS.map((d, i) =>
  `<button type="button" role="tab" id="demo-tab-${d.id}" data-tab="${d.id}" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="demo-panel-${d.id}" tabindex="${i === 0 ? 0 : -1}">${d.label}</button>`
).join('')
demoRoot.innerHTML = YT_DEMOS.map((d, i) =>
  `<div id="demo-panel-${d.id}" role="tabpanel" aria-labelledby="demo-tab-${d.id}" ${i === 0 ? '' : 'hidden'}>${demoHtml(d)}</div>`
).join('')
initTabs({
  tabsId: 'demo-tabs',
  panels: Object.fromEntries(YT_DEMOS.map((d) => [d.id, document.getElementById('demo-panel-' + d.id)])),
})

document.getElementById('features-grid').innerHTML = YT_FEATURES.map((f) =>
  `<article class="feat"><h3>${f.title}</h3><p>${f.body}</p></article>`
).join('')

document.getElementById('faq-list').innerHTML = faqHtml(YT_FAQ)
document.querySelector('#faq-list .faq-item')?.classList.add('is-open')
initAccordion()
bindPlaceholders()
