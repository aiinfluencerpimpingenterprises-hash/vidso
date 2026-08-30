/** Persist Vidso auth across refresh, www/apex, and expired access JWTs. */

export const TOKEN_KEY = 'clipzo_token'
export const REFRESH_KEY = 'clipzo_refresh'
const MAX_AGE = 60 * 60 * 24 * 30
const REFRESH_SKEW_MS = 60 * 1000

export function normalizeSecret(v) {
  if (v == null) return ''
  const s = String(v).trim()
  if (!s || s === 'undefined' || s === 'null') return ''
  return s
}

export function cookieDomainAttr(hostname) {
  const host = String(hostname || '')
  if (host === 'vidso.pro' || host.endsWith('.vidso.pro')) return '; Domain=.vidso.pro'
  return ''
}

export function parseCookieValue(cookieHeader, name) {
  const raw = String(cookieHeader || '')
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() !== name) continue
    const rawVal = part.slice(i + 1).trim()
    try { return normalizeSecret(decodeURIComponent(rawVal)) } catch {
      return normalizeSecret(rawVal)
    }
  }
  return ''
}

export function jwtExpMs(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return 0
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    let json = ''
    if (typeof atob === 'function') {
      const bin = atob(b64)
      try { json = decodeURIComponent(escape(bin)) } catch { json = bin }
    } else {
      json = Buffer.from(b64, 'base64').toString('utf8')
    }
    const exp = JSON.parse(json).exp
    return typeof exp === 'number' ? exp * 1000 : 0
  } catch {
    return 0
  }
}

export function tokenNeedsRefresh(token, now = Date.now()) {
  const exp = jwtExpMs(token)
  if (!exp) return false
  return now >= exp - REFRESH_SKEW_MS
}

export function isExpiredAuthError(err, status = err?.status) {
  if (Number(status) === 401) return true
  const msg = typeof err === 'string' ? err : String(err?.message || err?.error || '')
  return /invalid or expired token|jwt expired|token expired|session expired|not authenticated|unauthorized/i.test(msg)
}

function liveHostname() {
  try { return location.hostname || '' } catch { return '' }
}

function liveProtocol() {
  try { return location.protocol || '' } catch { return '' }
}

function lsGet(key) {
  try {
    if (typeof localStorage === 'undefined') return ''
    return normalizeSecret(localStorage.getItem(key))
  } catch {
    return ''
  }
}

function lsSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch (_) {}
}

function cookieGet(name) {
  try {
    if (typeof document === 'undefined') return ''
    return parseCookieValue(document.cookie, name)
  } catch {
    return ''
  }
}

function cookieSet(name, value, maxAge = MAX_AGE) {
  try {
    if (typeof document === 'undefined') return
    const secure = liveProtocol() === 'https:' ? '; Secure' : ''
    const domain = cookieDomainAttr(liveHostname())
    if (!value) {
      document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax' + domain + secure
      return
    }
    document.cookie = name + '=' + encodeURIComponent(value)
      + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + domain + secure
  } catch (_) {}
}

export function readSecret(key) {
  const fromLs = lsGet(key)
  const fromCk = cookieGet(key)
  const value = fromLs || fromCk
  if (!value) return ''
  if (!fromLs) lsSet(key, value)
  if (!fromCk) cookieSet(key, value)
  return value
}

export function writeSecret(key, value) {
  const v = normalizeSecret(value)
  lsSet(key, v)
  cookieSet(key, v)
}

export function getToken() {
  return readSecret(TOKEN_KEY)
}

export function getRefreshToken() {
  return readSecret(REFRESH_KEY)
}

export function setSession(session) {
  const access = normalizeSecret(session?.access_token || session?.accessToken)
  if (!access) return
  writeSecret(TOKEN_KEY, access)
  const refresh = normalizeSecret(session?.refresh_token || session?.refreshToken)
  if (refresh) writeSecret(REFRESH_KEY, refresh)
}

export function clearSession() {
  writeSecret(TOKEN_KEY, '')
  writeSecret(REFRESH_KEY, '')
}

export function sessionFromAuthPayload(data) {
  if (!data || typeof data !== 'object') return null
  const s = data.session || data.data?.session || data
  const access = normalizeSecret(s.access_token || s.accessToken)
  if (!access) return null
  return {
    access_token: access,
    refresh_token: normalizeSecret(s.refresh_token || s.refreshToken),
  }
}
