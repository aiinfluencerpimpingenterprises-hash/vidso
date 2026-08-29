/**
 * Vercel only routes one segment after /api/gate on this project.
 * Nested Studio paths go in ?p= so the function still matches.
 */

export function isStudioGatePath(subpath) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  return p === 'faceless-studio' || p.startsWith('faceless-studio/')
}

export function studioGateSegs(subpath, query) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const nested = p.startsWith('faceless-studio/')
    ? p.split('/').filter(Boolean).slice(1)
    : []
  if (nested.length) return nested
  const fromQuery = String((query && typeof query.get === 'function' && query.get('p')) || '')
    .replace(/^\/+|\/+$/g, '')
  return fromQuery.split('/').filter(Boolean)
}

export function studioGateHref(path) {
  const raw = String(path || '')
  const qIndex = raw.indexOf('?')
  const rest = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).replace(/^\/+/, '')
  const extra = qIndex >= 0 ? raw.slice(qIndex + 1) : ''
  const search = new URLSearchParams(extra)
  if (rest) search.set('p', rest)
  const qs = search.toString()
  return '/api/gate/faceless-studio' + (qs ? '?' + qs : '')
}
