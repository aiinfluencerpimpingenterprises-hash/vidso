// Per-user monthly counters for Option 1. Server-only (Node).
// File + memory so a warm Vercel instance keeps counts. Reset on the
// subscription anniversary window from lib/entitlements.js.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { quotaWindow } from './entitlements.js'
import { kvConfigured, kvGetJson, kvSetJson } from './kv.js'

const USAGE_NS = 'vidso:usage:'

const FILE = process.env.VIDSO_USAGE_FILE || path.join(os.tmpdir(), 'vidso-usage.json')

const mem = globalThis.__vidsoUsageMap || (globalThis.__vidsoUsageMap = new Map())

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
  return { long_form_used: 0, short_form_used: 0, studio_credits_used: 0, windowStart: null }
}

function applyWindow(rec, user, now) {
  const next = {
    long_form_used: rec.long_form_used || 0,
    short_form_used: rec.short_form_used || 0,
    studio_credits_used: rec.studio_credits_used || 0,
    windowStart: rec.windowStart || null,
  }
  const anchor = user?.current_period_start || user?.period_start || user?.created_at || next.windowStart || now
  const window = quotaWindow(anchor, now)
  if (window && next.windowStart) {
    const startMs = new Date(next.windowStart).getTime()
    if (Number.isFinite(startMs) && startMs < window.start.getTime()) {
      next.long_form_used = 0
      next.short_form_used = 0
      next.studio_credits_used = 0
    }
  }
  next.windowStart = window ? window.start.toISOString() : (next.windowStart || new Date(now).toISOString())
  return next
}

function snapshot(rec, known = true) {
  return {
    long_form_used: rec.long_form_used || 0,
    short_form_used: rec.short_form_used || 0,
    studio_credits_used: rec.studio_credits_used || 0,
    known,
    windowStart: rec.windowStart || null,
  }
}

export function readUsage(user, now = new Date()) {
  const key = userKey(user)
  if (!key) return snapshot(emptyRec(), false)
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  mem.set(key, rec)
  return snapshot(rec, true)
}

async function persistUsage(user, rec) {
  const key = userKey(user)
  if (!key) return
  mem.set(key, rec)
  saveFile()
  if (!kvConfigured()) return
  await kvSetJson(USAGE_NS + key, {
    long_form_used: rec.long_form_used || 0,
    short_form_used: rec.short_form_used || 0,
    studio_credits_used: rec.studio_credits_used || 0,
    windowStart: rec.windowStart || null,
  })
}

/** Pull durable counters from Upstash so a cold lambda does not reset spend. */
export async function hydrateUsage(user, now = new Date()) {
  const key = userKey(user)
  if (!key) return readUsage(user, now)
  if (kvConfigured()) {
    const remote = await kvGetJson(USAGE_NS + key)
    if (remote && typeof remote === 'object') {
      const local = mem.get(key) || emptyRec()
      mem.set(key, {
        long_form_used: Math.max(local.long_form_used || 0, remote.long_form_used || 0),
        short_form_used: Math.max(local.short_form_used || 0, remote.short_form_used || 0),
        studio_credits_used: Math.max(local.studio_credits_used || 0, remote.studio_credits_used || 0),
        windowStart: remote.windowStart || local.windowStart || null,
      })
    }
  }
  return readUsage(user, now)
}

export function incrementUsage(user, kind, now = new Date()) {
  const key = userKey(user)
  if (!key) return readUsage(user, now)
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  if (kind === 'short_form') rec.short_form_used += 1
  else rec.long_form_used += 1
  mem.set(key, rec)
  saveFile()
  return snapshot(rec)
}

export async function incrementStudioCredits(user, amount, now = new Date()) {
  const key = userKey(user)
  const add = Math.max(0, Math.floor(Number(amount) || 0))
  if (!key || !add) return readUsage(user, now)
  await hydrateUsage(user, now)
  const rec = applyWindow(mem.get(key) || emptyRec(), user, now)
  rec.studio_credits_used = (rec.studio_credits_used || 0) + add
  await persistUsage(user, rec)
  return snapshot(rec)
}

export function _resetStoreForTests() {
  mem.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
