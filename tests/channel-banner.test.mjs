import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { channelBannerPrompt, BANNER_ASPECT, BANNER_MODEL } from '../lib/channel-banner.js'

test('a channel banner is a wide, text-free scene about the channel, in its style', () => {
  const p = channelBannerPrompt({ name: 'Scamproof School', about: 'channel about scams', visualStyle: 'stick' })
  assert.match(p, /Scamproof School/)
  assert.match(p, /about scams/)
  assert.match(p, /stick figure/)
  assert.match(p, /No text/)
  assert.equal(BANNER_ASPECT, '21:9')
  assert.equal(BANNER_MODEL, 'nano-banana')
})

test('Studio shows the channel banner behind the header, not its profile picture', () => {
  const src = readFileSync(new URL('../lib/studio-hub.js', import.meta.url), 'utf8')
  assert.match(src, /p\.bannerUrl/)
  assert.doesNotMatch(src, /data-cf-go="brand" aria-label="Change channel"/)
  assert.match(src, /fvEnsureChannelBanner/)
})
