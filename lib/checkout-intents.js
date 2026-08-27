// Checkout started from a signed-in Vidso account. Server-only.
// Used to attach a Whop membership that landed under a different email
// (Apple Hide My Email, a second Google account) without letting a stranger
// type someone else's receipt and steal the plan.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { emailsFromUser } from './comped.js'

const FILE = process.env.VIDSO_INTENTS_FILE || path.join(os.tmpdir(), 'vidso-intents.json')
const mem = globalThis.__vidsoIntentMap || (globalThis.__vidsoIntentMap = new Map())
export const INTENT_TTL_MS = 48 * 60 * 60 * 1000

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
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(mem)))
  } catch (_) {}
}

loadFile()

function keysFor(user) {
  const out = emailsFromUser(user)
  const id = String(user?.id || user?.user_id || '').trim().toLowerCase()
  if (id) out.push(id)
  return out.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean)
}

export function saveIntent(user, extra = {}) {
  const rec = {
    at: extra.at || new Date().toISOString(),
    tier: extra.tier || null,
    cycle: extra.cycle || null,
  }
  for (const key of keysFor(user)) mem.set(key, rec)
  saveFile()
  return rec
}

export function intentFor(user, now = Date.now()) {
  for (const key of keysFor(user)) {
    const rec = mem.get(key)
    if (!rec?.at) continue
    const at = Date.parse(rec.at)
    if (!Number.isFinite(at) || now - at > INTENT_TTL_MS) continue
    return rec
  }
  return null
}

export function isPrivateRelayEmail(email) {
  const id = String(email || '').trim().toLowerCase()
  return id.endsWith('@inbox.appleid.apple.com') || id.endsWith('@privaterelay.appleid.com')
}

/** Off-email claims are only allowed while a checkout from this account is still open,
 *  or when the receipt is an Apple private-relay address (unguessable). */
export function mayAttachOffEmail(user, paidEmail, now = Date.now()) {
  if (isPrivateRelayEmail(paidEmail)) return true
  return !!intentFor(user, now)
}

export function _resetIntentsForTests() {
  mem.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
