/**
 * Vercel only routes one segment after /api/gate on this project.
 * Nested Studio paths go in ?p= so the function still matches.
 * query.path is often omitted; read the URL the same way YouTube does.
 */

function firstQuery(value) {
  if (Array.isArray(value)) return String(value[0] || '')
  return value == null ? '' : String(value)
}

export function isStudioGatePath(subpath) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  return p === 'faceless-studio' || p.startsWith('faceless-studio/')
}

export function gateApiSubpath(req) {
  const fromQuery = [].concat(req?.query?.path || []).filter(Boolean).join('/')
  if (fromQuery) return fromQuery.replace(/\/+$/, '')
  const pathOnly = String(req?.url || '').split('?')[0]
  const m = pathOnly.match(/\/api\/gate\/?(.*)$/i)
  return String(m?.[1] || '').replace(/\/+$/, '')
}

export function studioGateSegs(subpath, query) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const nested = p.startsWith('faceless-studio/')
    ? p.split('/').filter(Boolean).slice(1)
    : []
  if (nested.length) return nested
  let fromQuery = ''
  if (query && typeof query.get === 'function') fromQuery = String(query.get('p') || '')
  else fromQuery = firstQuery(query?.p)
  fromQuery = fromQuery.replace(/^\/+|\/+$/g, '')
  return fromQuery.split('/').filter(Boolean)
}

export function studioRouteFromReq(req) {
  const subpath = gateApiSubpath(req)
  const search = new URL(req?.url || '/', 'http://localhost').searchParams
  const header = String(req?.headers?.['x-vidso-studio'] || req?.headers?.['X-Vidso-Studio'] || '')
    .replace(/^\/+|\/+$/g, '')
  if (header) return { subpath, segs: header.split('/').filter(Boolean), query: search }
  const qp = search.get('p') || firstQuery(req?.query?.p)
  if (qp && !search.get('p')) search.set('p', qp)
  return { subpath, segs: studioGateSegs(subpath, search), query: search }
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

export function studioGateRest(path) {
  const raw = String(path || '')
  const qIndex = raw.indexOf('?')
  return (qIndex >= 0 ? raw.slice(0, qIndex) : raw).replace(/^\/+|\/+$/g, '')
}
