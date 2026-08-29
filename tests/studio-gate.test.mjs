import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  gateApiSubpath,
  isStudioGatePath,
  studioGateHref,
  studioGateRest,
  studioGateSegs,
  studioRouteFromReq,
} from '../lib/studio-gate.js'

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

test('gate subpath is read from the URL when Vercel omits query.path', () => {
  assert.equal(gateApiSubpath({ query: { path: 'faceless-studio' } }), 'faceless-studio')
  assert.equal(gateApiSubpath({ url: '/api/gate/faceless-studio?p=projects' }), 'faceless-studio')
  assert.equal(gateApiSubpath({ url: '/api/gate/usage' }), 'usage')
  assert.equal(studioGateRest('/projects/abc/jobs?x=1'), 'projects/abc/jobs')
  const routed = studioRouteFromReq({
    url: '/api/gate/faceless-studio?limit=40',
    headers: { 'x-vidso-studio': 'projects' },
  })
  assert.equal(routed.subpath, 'faceless-studio')
  assert.deepEqual(routed.segs, ['projects'])
  const fromP = studioRouteFromReq({
    url: '/api/gate/faceless-studio?p=projects%2Fabc%2Fjobs',
    query: {},
    headers: {},
  })
  assert.deepEqual(fromP.segs, ['projects', 'abc', 'jobs'])
})
