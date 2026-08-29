import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStudioGatePath, studioGateHref, studioGateSegs } from '../lib/studio-gate.js'

test('studio gate href stays on one /api/gate segment', () => {
  const list = new URL('https://x' + studioGateHref('/projects?limit=40&sort=updated'))
  assert.equal(list.pathname, '/api/gate/faceless-studio')
  assert.equal(list.searchParams.get('p'), 'projects')
  assert.equal(list.searchParams.get('limit'), '40')
  assert.equal(list.searchParams.get('sort'), 'updated')
  const job = new URL('https://x' + studioGateHref('/projects/abc/jobs'))
  assert.equal(job.pathname, '/api/gate/faceless-studio')
  assert.equal(job.searchParams.get('p'), 'projects/abc/jobs')
})

test('studio gate segs come from nested path or p query', () => {
  assert.equal(isStudioGatePath('faceless-studio'), true)
  assert.equal(isStudioGatePath('faceless-studio/projects'), true)
  assert.equal(isStudioGatePath('usage'), false)
  assert.deepEqual(studioGateSegs('faceless-studio', new URLSearchParams('p=projects')), ['projects'])
  assert.deepEqual(
    studioGateSegs('faceless-studio/projects/abc/jobs', new URLSearchParams()),
    ['projects', 'abc', 'jobs'],
  )
  assert.deepEqual(
    studioGateSegs('faceless-studio', new URLSearchParams('p=projects/abc/refs&limit=24')),
    ['projects', 'abc', 'refs'],
  )
})
