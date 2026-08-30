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

export function gateRestParam(req) {
  let raw = ''
  try {
    raw = new URL(req?.url || '/', 'http://localhost').searchParams.get('p') || ''
  } catch (_) {
    raw = ''
  }
  if (!raw) raw = firstQuery(req?.query?.p)
  return String(raw || '').replace(/^\/+|\/+$/g, '')
}

/**
 * Vercel only matches one segment after /api/gate on this project, so nested
 * gated calls arrive as /api/gate/<first>?p=<rest>. Rebuild the real subpath so
 * entitlement rules and the upstream forward still see e.g. faceless/script.
 */
export function gateFullSubpath(req) {
  const base = gateApiSubpath(req)
  const rest = gateRestParam(req)
  if (!rest) return base
  if (!base) return rest
  if (base === rest || base.endsWith('/' + rest)) return base
  return base + '/' + rest
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
  const subpath = gateFullSubpath(req)
  const search = new URL(req?.url || '/', 'http://localhost').searchParams
  const header = String(req?.headers?.['x-vidso-studio'] || req?.headers?.['X-Vidso-Studio'] || '')
    .replace(/^\/+|\/+$/g, '')
  if (header) return { subpath, segs: header.split('/').filter(Boolean), query: search }
  const qp = search.get('p') || firstQuery(req?.query?.p)
  if (qp && !search.get('p')) search.set('p', qp)
  return { subpath, segs: studioGateSegs(subpath, search), query: search }
}

/**
 * Client half of the one-segment rule: /api/faceless/script has to be requested
 * as /api/gate/faceless?p=script. Kept beside gateFullSubpath, which undoes it,
 * so the two halves cannot drift apart.
 */
export function gateHref(path) {
  const raw = String(path || '').replace(/^\/api(?=\/|$)/, '').replace(/^\/+/, '')
  const qIndex = raw.indexOf('?')
  const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw
  const search = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : '')
  const segs = pathOnly.split('/').filter(Boolean)
  const first = segs.shift() || ''
  if (segs.length) search.set('p', segs.join('/'))
  const qs = search.toString()
  return '/api/gate/' + first + (qs ? '?' + qs : '')
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
