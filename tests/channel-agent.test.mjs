import test from 'node:test'
import assert from 'node:assert/strict'
import { channelPrompt, parseChannelResponse } from '../lib/channel-agent.js'

test('channel prompt carries the genre and the user words', () => {
  const p = channelPrompt({ genre: 'Education', about: 'channel about physics' })
  assert.match(p, /Genre: Education/)
  assert.match(p, /channel about physics/)
})

test('channel response is cleaned and validated', () => {
  const out = parseChannelResponse('Sure! {"name":"“Physics Unlocked” 🚀","topics":["Why Time Slows Near Black Holes","why time slows near black holes","How Quantum Tunneling Powers Everyday Tech","ok","The Physics of Roller Coasters"]}')
  assert.equal(out.name, 'Physics Unlocked')
  assert.deepEqual(out.topics, ['Why Time Slows Near Black Holes', 'How Quantum Tunneling Powers Everyday Tech', 'The Physics of Roller Coasters'])
  assert.equal(parseChannelResponse('{"name":"","topics":[]}'), null)
  assert.equal(parseChannelResponse('no json'), null)
})

test('channel agent: picks a genre from the topic when none is given', () => {
  const p = channelPrompt({ about: 'Channel about famous heists' })
  assert.ok(!/^Genre:/m.test(p))
  assert.match(p, /genre: the format that fits best/)
  assert.equal(parseChannelResponse('{"name":"Vault Files","genre":"Mystery","topics":["The heist that fooled everyone","How the Antwerp vault was emptied"]}').genre, 'mystery')
  assert.equal(parseChannelResponse('{"name":"Vault Files","genre":"cooking","topics":["The heist that fooled everyone","How the Antwerp vault was emptied"]}').genre, '')
  assert.match(channelPrompt({ genre: 'History', about: 'x' }), /^Genre: History\.$/m)
})
