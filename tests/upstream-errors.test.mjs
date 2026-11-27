import { test } from 'node:test'
import assert from 'node:assert/strict'
import { upstreamError } from '../lib/gate-run.js'

test('a plain-text upstream failure becomes a readable message, never a bare "Request failed"', () => {
  const t = upstreamError({ status: 504, data: { raw: 'upstream request timeout' }, text: 'upstream request timeout' }, 'faceless/script')
  assert.match(t.message, /took too long writing the script/)
  assert.equal(t.upstream_status, 504)
  const b = upstreamError({ status: 502, data: { raw: '<html>Application failed to respond</html>' } }, 'faceless/media')
  assert.match(b.message, /busy while recording the narration/)
  const other = upstreamError({ status: 500, data: { raw: '' } }, 'faceless/render')
  assert.match(other.message, /rendering the video \(error 500\)/)
})

test('an upstream error that already has a message is passed through', () => {
  const data = { error: 'credits_exhausted', message: 'Not enough credits' }
  assert.equal(upstreamError({ status: 402, data }, 'faceless/media'), data)
})
