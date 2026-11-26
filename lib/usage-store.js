// Per-user monthly credit usage. Server-only (Node).
//
// Upstash Redis is the record when it is configured: one hash per user per
// billing window, changed only with atomic HINCRBY so two Vercel instances can
// never overwrite each other's counts. Process memory (and a /tmp file) is the
// fallback when Redis is not set up, and a hot copy when it is.
//
// Resets on the subscription anniversary window from lib/entitlements.js.
// Unused credits roll over into the next window, capped at one month's worth,
// and never more than the window actually granted (`granted`, the plan's credits
// when it opened), so a free or stub window can't turn into a free month.
// The window is anchored on the paid plan's start (plan_started_at) when known.
// scene_free is the free Z-Image scene allowance from paid videos.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { quotaWindow } from './entitlements.js'
import {
  kvConfigured,
  kvExpire,
  kvGet,
  kvHashGetAll,
  kvHashIncr,
  kvHashSetNx,
  kvSet,
  kvSetNxGet,
} from './kv.js'
import { creditsLimitForUser } from './studio-credits.js'

const NS = 'vidso:usage2:'
// A window's hash outlives the window so the next one can read its leftovers.
const WINDOW_TTL_SEC = 75 * 24 * 60 * 60
const FIELDS = ['long_form_used', 'short_form_used', 'studio_credits_used', 'credits_carry', 'scene_free', 'granted']

const FILE = process.env.VIDSO_USAGE_FILE || path.join(os.tmpdir(), 'vidso-usage.json')

const mem = globalThis.__vidsoUsageMap || (globalThis.__vidsoUsageMap = new Map())
// Redis writes started by the synchronous incrementUsage; settleUsageWrites waits for them.
const pending = globalThis.__vidsoUsageWrites || (globalThis.__vidsoUsageWrites = new Set())

function userKey(user) {
  return String(user?.id || user?.user_id || user?.email || '').trim().toLowerCase()
}

function loadFile() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) mem.set(k, v)
    }
  } catch (_) {}
}

function saveFile() {
  try {
    const obj = Object.fromEntries(mem)
    fs.writeFileSync(FILE, JSON.stringify(obj))
  } catch (_) {}
}

loadFile()

function emptyRec() {
  return { long_form_used: 0, short_form_used: 0, studio_credits_used: 0, credits_carry: 0, scene_free: 0, granted: null, windowStart: null }
}

const DAY_MS = 86400000

/** Credits left at the end of a window roll over, at most one month's worth. */
export function rolloverCredits({ limit, carry = 0, used = 0, windowsPassed = 1, granted } = {}) {
  const cap = Math.max(0, Number(limit) || 0)
  // What the finished window gave: its own grant when recorded (older windows: the plan's credits).
  const base = granted == null || granted === '' ? cap : Math.max(0, Number(granted) || 0)
  if (windowsPassed > 1) return Math.min(cap, base) // a whole month went unused
  return Math.min(cap, Math.max(0, base + (Number(carry) || 0) - (Number(used) || 0)))
}

function windowsBetween(prevStart, nextStart) {
  return (new Date(nextStart).getTime() - new Date(prevStart).getTime()) > 40 * DAY_MS ? 2 : 1
}

function userAnchor(user) {
  return user?.current_period_start || user?.period_start || user?.plan_started_at || user?.created_at || null
}

function applyWindow(rec, user, now, anchorOverride) {
  const next = {
    long_form_used: rec.long_form_used || 0,
    short_form_used: rec.short_form_used || 0,
    studio_credits_used: rec.studio_credits_used || 0,
    credits_carry: rec.credits_carry || 0,
    scene_free: rec.scene_free || 0,
    granted: rec.granted == null ? null : rec.granted,
    windowStart: rec.windowStart || null,
    anchor: rec.anchor || null,
  }
  const anchor = userAnchor(user) || anchorOverride || next.anchor || next.windowStart || now
  const window = quotaWindow(anchor, now)
  if (window && next.windowStart) {
    const startMs = new Date(next.windowStart).getTime()
    if (Number.isFinite(startMs) && startMs < window.start.getTime()) {
      next.credits_carry = rolloverCredits({
        limit: creditsLimitForUser(user),
        carry: next.credits_carry,
        used: next.studio_credits_used,
        windowsPassed: windowsBetween(next.windowStart, window.start),
        granted: next.granted,
      })
      next.long_form_used = 0
      next.short_form_used = 0
      next.studio_credits_used = 0
      next.granted = null
    }
  }
  if (next.granted == null) next.granted = creditsLimitForUser(user)
  next.windowStart = window ? window.start.toISOString() : (next.windowStart || new Date(now).toISOString())
  return next
}

function snapshot(rec, known = true) {
  return {
    long_form_used: rec.long_form_used || 0,
    short_form_used: rec.short_form_used || 0,
    studio_credits_used: rec.studio_credits_used || 0,
    credits_carry: rec.credits_carry || 0,
    scene_free: rec.scene_free || 0,
    known,
    windowStart: rec.windowStart || null,
  }
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// ---------------------------------------------------------------- Redis side

const windowKey = (key, start) => NS + key + ':w:' + start
const lastKey = (key) => NS + key + ':last'
const anchorKey = (key) => NS + key + ':anchor'

/**
 * A user with no billing date from the backend gets one stored in Redis on
 * first use, so every instance agrees on when their month starts.
 */
async function sharedAnchor(user, key, now) {
  const own = userAnchor(user)
  if (own) return own
  return kvSetNxGet(anchorKey(key), new Date(now).toISOString())
}

/** The current window's hash, opening it (with rolled-over credits) on first touch. */
async function openRemoteWindow(user, key, now) {
  const anchor = await sharedAnchor(user, key, now)
  const local = applyWindow(mem.get(key) || emptyRec(), user, now, anchor)
  local.anchor = anchor
  const start = local.windowStart
  const hk = windowKey(key, start)
  let remote = await kvHashGetAll(hk)
  if (remote === null) return { rec: local, hk: null } // store down: keep going on memory
  if (!Object.keys(remote).length) {
    const prevStart = await kvGet(lastKey(key))
    let carry = 0
    if (prevStart && prevStart !== start && new Date(prevStart) < new Date(start)) {
      const prev = (await kvHashGetAll(windowKey(key, prevStart))) || {}
      carry = rolloverCredits({
        limit: creditsLimitForUser(user),
        carry: num(prev.credits_carry),
        used: num(prev.studio_credits_used),
        windowsPassed: windowsBetween(prevStart, start),
        granted: prev.granted,
      })
    }
    await kvHashSetNx(hk, 'credits_carry', carry)
    await kvHashSetNx(hk, 'granted', creditsLimitForUser(user))
    await kvExpire(hk, WINDOW_TTL_SEC)
    await kvSet(lastKey(key), start)
    remote = (await kvHashGetAll(hk)) || { credits_carry: carry }
  }
  const rec = { ...emptyRec(), windowStart: start, anchor }
  for (const f of FIELDS) rec[f] = f === 'granted' && remote[f] == null ? null : Math.max(0, num(remote[f]))
  return { rec, hk }
}

function remember(key, rec) {
  mem.set(key, rec)
  saveFile()
}

function track(promise) {
  pending.add(promise)
  promise.finally(() => pending.delete(promise)).catch(() => {})
  return promise
}

/** Wait for Redis writes started by incrementUsage (call before the response ends). */
export async function settleUsageWrites() {
  await Promise.allSettled([...pending])
}

// ---------------------------------------------------------------- public API

export function readUsage(user, now = new Date()) {
  const key = userKey(user)
  if (!key) return snapshot(emptyRec(), false)
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  mem.set(key, rec)
  return snapshot(rec, true)
}

/** Read the shared counts from Redis so a cold lambda does not reset spend. */
export async function hydrateUsage(user, now = new Date()) {
  const key = userKey(user)
  if (!key || !kvConfigured()) return readUsage(user, now)
  await settleUsageWrites()
  const { rec } = await openRemoteWindow(user, key, now)
  remember(key, rec)
  return snapshot(rec, true)
}

/** Add to one counter: atomically in Redis when it is there, else in memory. */
async function bump(user, field, by, now) {
  const key = userKey(user)
  if (!key) return null
  if (kvConfigured()) {
    const { rec, hk } = await openRemoteWindow(user, key, now)
    if (hk) {
      const value = await kvHashIncr(hk, field, by)
      if (value !== null) {
        rec[field] = value
        remember(key, rec)
        return rec
      }
    }
  }
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  rec[field] = (rec[field] || 0) + by
  remember(key, rec)
  return rec
}

export function incrementUsage(user, kind, now = new Date()) {
  const key = userKey(user)
  if (!key) return readUsage(user, now)
  const field = kind === 'short_form' ? 'short_form_used' : 'long_form_used'
  // Callers read the new count straight away, so memory moves first.
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  rec[field] += 1
  remember(key, rec)
  if (kvConfigured()) {
    track((async () => {
      const { hk } = await openRemoteWindow(user, key, now)
      if (hk) await kvHashIncr(hk, field, 1)
    })())
  }
  return snapshot(rec)
}

/**
 * Take credits before the paid work starts, atomically: two requests at the
 * same moment can't both spend the last credits. `limit` is the most this window
 * may use (plan credits + carry). Returns { ok, used }; on ok:false nothing was taken.
 */
export async function reserveStudioCredits(user, amount, limit, now = new Date()) {
  const add = Math.max(0, Math.floor(Number(amount) || 0))
  if (!userKey(user) || !add) return { ok: true, used: readUsage(user, now).studio_credits_used }
  const rec = await bump(user, 'studio_credits_used', add, now)
  const used = Number(rec?.studio_credits_used) || 0
  if (Number.isFinite(Number(limit)) && used > Number(limit)) {
    await bump(user, 'studio_credits_used', -add, now)
    return { ok: false, used: used - add }
  }
  return { ok: true, used }
}

/** Give back credits taken for work that failed. */
export async function releaseStudioCredits(user, amount, now = new Date()) {
  const back = Math.max(0, Math.floor(Number(amount) || 0))
  if (!userKey(user) || !back) return readUsage(user, now)
  const rec = await bump(user, 'studio_credits_used', -back, now)
  if (rec && rec.studio_credits_used < 0) {
    await bump(user, 'studio_credits_used', -rec.studio_credits_used, now)
    rec.studio_credits_used = 0
  }
  return snapshot(rec || emptyRec())
}

export async function incrementStudioCredits(user, amount, now = new Date()) {
  const add = Math.max(0, Math.floor(Number(amount) || 0))
  if (!userKey(user) || !add) return readUsage(user, now)
  const rec = await bump(user, 'studio_credits_used', add, now)
  return snapshot(rec)
}

/** Add free Z-Image scenes after a video's minutes are paid for. */
export async function addSceneAllowance(user, count, now = new Date()) {
  const add = Math.max(0, Math.floor(Number(count) || 0))
  if (!userKey(user) || !add) return readUsage(user, now)
  const rec = await bump(user, 'scene_free', add, now)
  return snapshot(rec)
}

/** Take one free scene; false when the allowance is used up. */
export async function takeSceneAllowance(user, now = new Date()) {
  const key = userKey(user)
  if (!key) return false
  if (kvConfigured()) {
    const { rec, hk } = await openRemoteWindow(user, key, now)
    if (hk) {
      const left = await kvHashIncr(hk, 'scene_free', -1)
      if (left !== null) {
        if (left < 0) {
          await kvHashIncr(hk, 'scene_free', 1)
          rec.scene_free = 0
          remember(key, rec)
          return false
        }
        rec.scene_free = left
        remember(key, rec)
        return true
      }
    }
  }
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  if ((rec.scene_free || 0) <= 0) return false
  rec.scene_free -= 1
  remember(key, rec)
  return true
}

export function _resetStoreForTests() {
  mem.clear()
  pending.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
