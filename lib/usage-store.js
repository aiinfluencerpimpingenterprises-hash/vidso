// Per-user monthly counters for Option 1. Server-only (Node).
// File + memory so a warm Vercel instance keeps counts. Reset on the
// subscription anniversary window from lib/entitlements.js.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { quotaWindow } from './entitlements.js'

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

export function readUsage(user, now = new Date()) {
  const key = userKey(user)
  if (!key) return { long_form_used: 0, short_form_used: 0, known: false }
  const rec = mem.get(key) || { long_form_used: 0, short_form_used: 0, windowStart: null }
  const anchor = user.current_period_start || user.period_start || user.created_at || rec.windowStart || now
  const window = quotaWindow(anchor, now)
  if (window && rec.windowStart) {
    const startMs = new Date(rec.windowStart).getTime()
    if (Number.isFinite(startMs) && startMs < window.start.getTime()) {
      rec.long_form_used = 0
      rec.short_form_used = 0
    }
  }
  rec.windowStart = window ? window.start.toISOString() : (rec.windowStart || new Date(now).toISOString())
  mem.set(key, rec)
  return {
    long_form_used: rec.long_form_used || 0,
    short_form_used: rec.short_form_used || 0,
    known: true,
    windowStart: rec.windowStart,
  }
}

export function incrementUsage(user, kind, now = new Date()) {
  const key = userKey(user)
  if (!key) return readUsage(user, now)
  const rec = readUsage(user, now)
  if (kind === 'short_form') rec.short_form_used += 1
  else rec.long_form_used += 1
  mem.set(key, rec)
  saveFile()
  return rec
}

export function _resetStoreForTests() {
  mem.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
