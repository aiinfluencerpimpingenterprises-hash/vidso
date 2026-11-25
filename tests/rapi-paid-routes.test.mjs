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
  for (const [path, dest] of paid) {
    assert.notEqual(ruleFor('POST', path).type, 'forward', path + ' should be a gated route')
    const i = rewrites.findIndex((r) => r.source === '/rapi/api/' + path)
    assert.ok(i >= 0 && i < catchAll, path + ' must be rewritten before the /rapi catch-all')
    assert.equal(rewrites[i].destination, dest)
  }
})

test('the gate proves itself to Railway only when the secret is set', () => {
  assert.deepEqual(gateSecretHeader({}), {})
  assert.deepEqual(gateSecretHeader({ TUBEOPS_GATE_SECRET: ' s3cret ' }), { 'X-TubeOps-Gate': 's3cret' })
})
