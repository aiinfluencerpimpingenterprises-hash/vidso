import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  cookieDomainAttr,
  cookiePayloadFits,
  jwtExpMs,
  normalizeSecret,
  parseCookieValue,
  sessionFromAuthPayload,
  tokenNeedsRefresh,
  isExpiredAuthError,
  isInvalidRefreshError,
} from '../lib/session-store.js'

test('normalizeSecret drops missing and stringified empties', () => {
  assert.equal(normalizeSecret(undefined), '')
  assert.equal(normalizeSecret(null), '')
  assert.equal(normalizeSecret('undefined'), '')
  assert.equal(normalizeSecret('null'), '')
  assert.equal(normalizeSecret('  abc  '), 'abc')
})

test('vidso.pro cookies are shared across www and apex', () => {
  assert.equal(cookieDomainAttr('vidso.pro'), '; Domain=.vidso.pro')
  assert.equal(cookieDomainAttr('www.vidso.pro'), '; Domain=.vidso.pro')
  assert.equal(cookieDomainAttr('localhost'), '')
})

test('parseCookieValue reads encoded secrets', () => {
  const header = 'a=1; clipzo_token=' + encodeURIComponent('tok.en') + '; x=y'
  assert.equal(parseCookieValue(header, 'clipzo_token'), 'tok.en')
  assert.equal(parseCookieValue(header, 'missing'), '')
})

test('sessionFromAuthPayload accepts nested and flat auth payloads', () => {
  assert.deepEqual(
    sessionFromAuthPayload({ session: { access_token: 'a', refresh_token: 'r' } }),
    { access_token: 'a', refresh_token: 'r' },
  )
  assert.deepEqual(
    sessionFromAuthPayload({ access_token: 'a', refresh_token: 'r' }),
    { access_token: 'a', refresh_token: 'r' },
  )
  assert.equal(sessionFromAuthPayload({ ok: true }), null)
})

test('tokenNeedsRefresh uses JWT exp with a one-minute skew', () => {
  const exp = Math.floor(Date.now() / 1000) + 30
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  const token = `x.${payload}.y`
  assert.equal(jwtExpMs(token), exp * 1000)
  assert.equal(tokenNeedsRefresh(token), true)
  const later = Buffer.from(JSON.stringify({ exp: exp + 3600 })).toString('base64url')
  assert.equal(tokenNeedsRefresh(`x.${later}.y`), false)
})

test('isExpiredAuthError catches Railway auth copy', () => {
  assert.equal(isExpiredAuthError('Invalid or expired token'), true)
  assert.equal(isExpiredAuthError({ message: 'jwt expired' }), true)
  assert.equal(isExpiredAuthError('Upload failed', 500), false)
  assert.equal(isExpiredAuthError('nope', 401), true)
})

test('isInvalidRefreshError does not treat a network blip as a logout', () => {
  assert.equal(isInvalidRefreshError('Invalid refresh token', 401), true)
  assert.equal(isInvalidRefreshError('invalid_grant', 400), true)
  assert.equal(isInvalidRefreshError('Cannot reach Clipzo API', 503), false)
  assert.equal(isInvalidRefreshError('That request timed out'), false)
})

test('oversized JWTs are not stuffed into a cookie', () => {
  assert.equal(cookiePayloadFits('short'), true)
  assert.equal(cookiePayloadFits('x'.repeat(5000)), false)
})

test('dashboard refresh keeps a refresh-only session instead of bouncing to login', () => {
  const html = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8')
  assert.match(html, /if \(!token && !refreshTok\)/)
  assert.match(html, /await restoreSession\(\)/)
  assert.doesNotMatch(html, /e.status === 401 \|\| e.status === 403/)
})

test('api.js does not double-export restoreSession', () => {
  const src = readFileSync(new URL('../api.js', import.meta.url), 'utf8')
  const fn = (src.match(/export async function restoreSession/g) || []).length
  const list = /export \{[^}]*\brestoreSession\b/.test(src) ? 1 : 0
  assert.equal(fn + list, 1)
})
