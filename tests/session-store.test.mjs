import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cookieDomainAttr,
  jwtExpMs,
  normalizeSecret,
  parseCookieValue,
  sessionFromAuthPayload,
  tokenNeedsRefresh,
  isExpiredAuthError,
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
