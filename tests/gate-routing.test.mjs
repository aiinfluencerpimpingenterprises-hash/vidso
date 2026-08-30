import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  gateFullSubpath,
  gateHref,
  gateRestParam,
  isStudioGatePath,
  studioRouteFromReq,
} from '../lib/studio-gate.js'

/** Every gated path the client can ask for, and the subpath the gate must see. */
const GATED_PATHS = [
  '/api/usage',
  '/api/autoclip',
  '/api/media/concat',
  '/api/faceless/script',
  '/api/faceless/media',
  '/api/faceless/render',
  '/api/download/analyze',
]

test('gated requests never use more than one segment after /api/gate', () => {
  for (const path of GATED_PATHS) {
    const href = gateHref(path)
    const url = new URL('https://vidso.pro' + href)
    const segs = url.pathname.replace(/^\/api\/gate\/?/, '').split('/').filter(Boolean)
    assert.equal(
      segs.length,
      1,
      `${path} produced ${url.pathname}, which the gate function cannot match`,
    )
  }
})

test('the gate rebuilds the original subpath from what the client sent', () => {
  for (const path of GATED_PATHS) {
    const href = gateHref(path)
    const expected = path.replace(/^\/api\//, '')
    assert.equal(gateFullSubpath({ url: href }), expected, `round trip failed for ${path}`)
  }
})

test('media/concat reaches its handler instead of forwarding upstream', () => {
  // Regression: sent nested this 404d at Vercel and fell through to Railway,
  // which answered "Cannot POST /api/media/concat".
  const href = gateHref('/api/media/concat')
  assert.equal(href, '/api/gate/media?p=concat')
  assert.equal(gateFullSubpath({ url: href }), 'media/concat')
})

test('query strings survive alongside the rewritten path', () => {
  const href = gateHref('/api/faceless/media?limit=5')
  const url = new URL('https://vidso.pro' + href)
  assert.equal(url.pathname, '/api/gate/faceless')
  assert.equal(url.searchParams.get('p'), 'media')
  assert.equal(url.searchParams.get('limit'), '5')
  assert.equal(gateFullSubpath({ url: href }), 'faceless/media')
})

test('single segment paths are left exactly as they were', () => {
  assert.equal(gateHref('/api/usage'), '/api/gate/usage')
  assert.equal(gateHref('/api/autoclip'), '/api/gate/autoclip')
  assert.equal(gateFullSubpath({ url: '/api/gate/usage' }), 'usage')
})

test('a nested URL still resolves if Vercel ever delivers it whole', () => {
  assert.equal(gateFullSubpath({ url: '/api/gate/media/concat' }), 'media/concat')
  // Rewritten by vercel.json: path and ?p= describe the same request.
  assert.equal(gateFullSubpath({ url: '/api/gate/media/concat?p=concat' }), 'media/concat')
  assert.equal(gateRestParam({ url: '/api/gate/media?p=concat' }), 'concat')
  assert.equal(gateRestParam({ url: '/api/gate/usage' }), '')
})

test('subpath comes from query.path when Vercel omits the URL form', () => {
  assert.equal(gateFullSubpath({ query: { path: 'media', p: 'concat' } }), 'media/concat')
  assert.equal(gateFullSubpath({ query: { path: ['faceless'], p: 'script' } }), 'faceless/script')
})

test('studio routing is unchanged by the subpath merge', () => {
  const routed = studioRouteFromReq({
    url: '/api/gate/faceless-studio?p=projects%2Fabc%2Fjobs',
    query: {},
    headers: {},
  })
  assert.equal(isStudioGatePath(routed.subpath), true)
  assert.deepEqual(routed.segs, ['projects', 'abc', 'jobs'])

  const header = studioRouteFromReq({
    url: '/api/gate/faceless-studio?limit=40',
    headers: { 'x-vidso-studio': 'projects' },
  })
  assert.equal(header.subpath, 'faceless-studio')
  assert.deepEqual(header.segs, ['projects'])
})

test('quota rules still match the rebuilt subpaths', async () => {
  // The rules live in the gate handler; assert the strings they compare against.
  const script = gateFullSubpath({ url: gateHref('/api/faceless/script') })
  const render = gateFullSubpath({ url: gateHref('/api/faceless/render') })
  const analyze = gateFullSubpath({ url: gateHref('/api/download/analyze') })
  assert.equal(script, 'faceless/script')
  assert.equal(render, 'faceless/render')
  assert.equal(analyze, 'download/analyze')
})
