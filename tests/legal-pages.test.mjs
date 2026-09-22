import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pages = ['terms', 'privacy', 'refund'].map((name) => ({
  name,
  html: readFileSync(new URL('../' + name + '/index.html', import.meta.url), 'utf8'),
}))
const js = readFileSync(new URL('../lib/legal-page.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../home/landing-redesign.css', import.meta.url), 'utf8')

test('legal pages use landing chrome and drop the topo SVG', () => {
  for (const page of pages) {
    assert.doesNotMatch(page.html, /topo-bg/, page.name)
    assert.match(page.html, /class="lp-red is-legal-page"/)
    assert.match(page.html, /id="lp-sitehead"/)
    assert.match(page.html, /id="navDrawer"/)
    assert.match(page.html, /mountLegalPage/)
    assert.match(page.html, /<footer>/)
    assert.match(page.html, /nav-plain[\s\S]*Pricing/)
    assert.match(page.html, /satoshi@400/)
    assert.doesNotMatch(page.html, /class="site-header"|class="site-footer"|class="nav-back"/)
  }
  assert.match(js, /mountNavShrink/)
  assert.match(js, /mountLandingFooter/)
  assert.doesNotMatch(js, /topo-bg/)
  assert.doesNotMatch(css, /model-card\.is-target/)
})
