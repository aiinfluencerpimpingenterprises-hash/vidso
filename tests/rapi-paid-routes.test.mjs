import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gateSecretHeader, ruleFor } from '../lib/gate-run.js'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

test('paid paths on the /rapi proxy are sent through the gate, before the catch-all', () => {
  const rewrites = vercel.rewrites
  const catchAll = rewrites.findIndex((r) => r.source === '/rapi/:path*')
  assert.ok(catchAll > 0)
  const paid = [
    ['faceless/script', '/api/gate/faceless?p=script'],
    ['faceless/media', '/api/gate/faceless?p=media'],
    ['faceless/render', '/api/gate/faceless?p=render'],
    ['download/analyze', '/api/gate/download?p=analyze'],
    ['autoclip', '/api/gate/autoclip'],
  ]
  // The rewrite sources are path-to-regexp params with a custom pattern; test them as regexes.
  const matcher = (source) => {
    const m = /^\/rapi\/api\/:paid\((.+)\)$/.exec(source)
    return m ? new RegExp('^/rapi/api/(?:' + m[1] + ')$') : null
  }
  const find = (url) => rewrites.findIndex((r) => (matcher(r.source) || { test: () => r.source === url }).test(url))
  for (const [path, dest] of paid) {
    assert.notEqual(ruleFor('POST', path).type, 'forward', path + ' should be a gated route')
    // Railway (Express) ignores case and a trailing slash, so every variant must hit the gate.
    for (const url of ['/rapi/api/' + path, '/rapi/api/' + path.toUpperCase(), '/rapi/api/' + path + '/']) {
      const i = find(url)
      assert.ok(i >= 0 && i < catchAll, url + ' must be rewritten before the /rapi catch-all')
      assert.equal(rewrites[i].destination, dest)
    }
  }
  // Polling a job is not paid and must keep going straight to Railway.
  assert.equal(find('/rapi/api/faceless/media/job_123'), -1)
})

test('the gate proves itself to Railway only when the secret is set', () => {
  assert.deepEqual(gateSecretHeader({}), {})
  assert.deepEqual(gateSecretHeader({ TUBEOPS_GATE_SECRET: ' s3cret ' }), { 'X-TubeOps-Gate': 's3cret' })
})
