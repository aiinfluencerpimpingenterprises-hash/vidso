import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUSY_NOTE, videoBusy, lengthOptions, effectiveLength, channelCapInfo } from '../lib/agents-chat.js'
import { planView, FEATURE_ROWS, rowIncluded, TIERS } from '../lib/pricing.js'

const src = readFileSync(new URL('../lib/agents-chat.js', import.meta.url), 'utf8')
const home = readFileSync(new URL('../home/index.html', import.meta.url), 'utf8')

test('a running video blocks the next one', () => {
  assert.equal(videoBusy({ running: true }), true)
  assert.equal(videoBusy({ busyScript: true }), true)
  assert.equal(videoBusy({ running: false, renderUrl: 'x' }), false)
  assert.equal(videoBusy(null), false)
  assert.match(BUSY_NOTE, /still being made/)
})

test('approve, own script and New chat check for a running video before archiving or resetting', () => {
  const approve = src.slice(src.indexOf('async function approveReview'), src.indexOf('function reviewSeconds'))
  assert.ok(approve.indexOf('videoBusy(st)') > -1 && approve.indexOf('videoBusy(st)') < approve.indexOf('archiveCurrent'))
  const own = src.slice(src.indexOf('async function runOwnScript'), src.indexOf('function bindOwnScriptExtras'))
  assert.ok(own.indexOf('videoBusy(st0)') > -1 && own.indexOf('videoBusy(st0)') < own.indexOf('archiveCurrent'))
  const fresh = src.slice(src.indexOf('function newChatNow()'), src.indexOf('function chatList()'))
  assert.ok(fresh.indexOf('videoBusy(live)') > -1 && fresh.indexOf('videoBusy(live)') < fresh.indexOf('archiveCurrent'))
})

test('lengths above the plan cap are locked and name the plan that unlocks them', () => {
  const plus = lengthOptions(600)
  assert.deepEqual(plus.filter((o) => !o.locked).map((o) => o.id), ['long_180', 'long_300', 'long_600'])
  assert.deepEqual(plus.filter((o) => o.locked).map((o) => o.unlock), ['Pro', 'Pro', 'Studio'])
  assert.equal(lengthOptions(1200).find((o) => o.id === 'long_1800').unlock, 'Studio')
  assert.equal(lengthOptions(Infinity).some((o) => o.locked), false)
  assert.equal(lengthOptions(0).some((o) => o.locked), false)
})

test('the review uses the length the run will really use', () => {
  assert.equal(effectiveLength('long_1800', 600).id, 'long_600')
  assert.equal(effectiveLength('long_1800', 600).seconds, 600)
  assert.equal(effectiveLength('long_900', 1200).id, 'long_900')
  assert.equal(effectiveLength('long_1800', Infinity).id, 'long_1800')
  assert.equal(effectiveLength('long_420', 600).seconds, 420)
  assert.equal(effectiveLength('', 600).id, 'long_600')
})

test('channel limit message uses the real plan and suggests the next plan', () => {
  const plus = channelCapInfo('plus', 1)
  assert.match(plus.message, /Your Plus plan runs 1 channel\./)
  assert.match(plus.message, /Pro runs 2/)
  assert.equal(plus.upgrade, 'pro')
  assert.doesNotMatch(plus.message, /extra channel|Brand/)
  const pro = channelCapInfo('pro', 2)
  assert.match(pro.message, /Studio runs 3/)
  const agency = channelCapInfo('agency', 4)
  assert.equal(agency.upgrade, '')
  assert.match(agency.message, /delete one under Channels/)
  assert.match(channelCapInfo('plus', 1, 'https://whop.com/checkout/x').message, /extra channel/)
})

test('review caption chips set the look for the next video only', () => {
  const bind = src.slice(src.indexOf("rv.querySelectorAll('[data-rv-cap]')"), src.indexOf('function bindHero'))
  assert.match(bind, /fvSetCaptionLook/)
  assert.doesNotMatch(bind, /fvAgentsCaptions/)
})

test('an uploaded script goes through the review before anything starts', () => {
  const submit = src.slice(src.indexOf("form?.addEventListener('submit'"), src.indexOf('bindHero()\n    bindReview()'))
  assert.match(submit, /openOwnReview\(\{ fromHero: true \}\)/)
  assert.doesNotMatch(submit, /runOwnScript\(\)/)
  assert.doesNotMatch(src, /starting episode 1 now/)
})

test('pricing: value rows never show a cross, savings read per year', () => {
  for (const row of FEATURE_ROWS.filter((r) => r.type === 'value')) {
    for (const tier of TIERS) assert.ok(row[tier], `${row.label} has a value on ${tier}`)
  }
  const support = FEATURE_ROWS.find((r) => r.label === 'Support')
  assert.equal(rowIncluded(support, 'plus'), false) // shown with a neutral mark, not crossed out
  const ui = readFileSync(new URL('../lib/pricing-ui.js', import.meta.url), 'utf8')
  // Value rows are a plain spec list; higher plans list only what they add, so nothing is crossed out.
  assert.match(ui, /export function specRows/)
  assert.match(ui, /export function planIncludes/)
  assert.doesNotMatch(ui, /ICO_OFF|feat-row off/)
  for (const t of TIERS) assert.match(planView(t).savingsLabel, /^Save \$[\d,]+ (a year|every 3 months)$/)
  assert.equal(planView('agency').savingsLabel, 'Save $360 every 3 months')
})

test('home page copy matches the product', () => {
  assert.doesNotMatch(home, /claude — vidso|vidso · make_video/)
  assert.doesNotMatch(home, /Agency plan: \$479\/mo billed annually/)
  assert.doesNotMatch(home, /re-record a line|millions of stock clips for the rest/)
})
