import { normalizeTier } from './entitlements.js'
// Checkout started from a signed-in TubeOps account. Server-only.
// Used to attach a Whop membership that landed under a different email
// (Apple Hide My Email, a second Google account) without letting a stranger
// type someone else's receipt and steal the plan.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { emailsFromUser } from './comped.js'
import { kvConfigured, kvGetJson, kvSetJsonTtl } from './kv.js'

const NS = 'vidso:intent:'

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
  if (extra.fbp) rec.fbp = String(extra.fbp)
  if (extra.fbc) rec.fbc = String(extra.fbc)
  if (extra.ip) rec.ip = String(extra.ip)
  if (extra.ua) rec.ua = String(extra.ua)
  if (extra.eventId) rec.eventId = String(extra.eventId)
  if (extra.testEventCode) rec.testEventCode = String(extra.testEventCode)
  // Earlier checkouts are kept (briefly), so clicking Buy again after paying
  // doesn't hide the checkout the payment actually came from.
  const prior = intentFor(user, Date.parse(rec.at) || Date.now())
  const history = prior ? [{ at: prior.at, tier: prior.tier || null }, ...(Array.isArray(prior.history) ? prior.history : [])] : []
  if (history.length) rec.history = history.slice(0, 5)
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

/** saveIntent, also written to Redis so any Vercel instance can see it (48h). */
export async function saveIntentDurable(user, extra = {}) {
  const rec = saveIntent(user, extra)
  if (kvConfigured()) {
    await Promise.all(keysFor(user).map((key) => kvSetJsonTtl(NS + key, rec, INTENT_TTL_MS / 1000)))
  }
  return rec
}

/** Pull this account's open checkout from Redis into memory (cold instances). */
export async function hydrateIntent(user) {
  if (!kvConfigured()) return intentFor(user)
  const keys = keysFor(user)
  for (const key of keys) {
    if (mem.get(key)?.at) continue
    const rec = await kvGetJson(NS + key)
    if (rec?.at) {
      mem.set(key, rec)
      break
    }
  }
  return intentFor(user)
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

/** A membership found under a different email must start this soon after the checkout. */
export const OFF_EMAIL_WINDOW_MS = 3 * 60 * 60 * 1000

/** When a Whop membership was created, in ms (Whop sends ISO strings; seconds also accepted), or NaN. */
export function membershipCreatedMs(membership) {
  const v = membership?.created_at ?? membership?.createdAt
  if (v == null || v === '') return NaN
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v)
    return n < 1e12 ? n * 1000 : n
  }
  return Date.parse(String(v))
}

/**
 * Whether a membership found by a *different* email may be attached to this
 * account: a checkout for the same tier was started here before the membership
 * was created, and the membership came within 3 hours of it. Otherwise anyone
 * could start a free checkout and then type a stranger's receipt email.
 */
export function offEmailClaimAllowed({ intent, tier, createdAt, windowMs = OFF_EMAIL_WINDOW_MS } = {}) {
  const created = Number(createdAt)
  if (!tier) return { ok: false, reason: 'no_tier' }
  if (!Number.isFinite(created)) return { ok: false, reason: 'unknown_created' }
  const candidates = intent?.at ? [intent, ...(Array.isArray(intent.history) ? intent.history : [])] : []
  if (!candidates.length) return { ok: false, reason: 'no_intent' }
  for (const c of candidates) {
    const at = Date.parse(c?.at || '')
    // Checkout saves the Whop plan key (starter/creator/business); memberships say plus/pro/studio.
    if (!Number.isFinite(at) || normalizeTier(c?.tier) !== normalizeTier(tier)) continue
    if (created >= at && created - at <= windowMs) return { ok: true }
  }
  return { ok: false, reason: 'no_matching_checkout' }
}

export function _resetIntentsForTests() {
  mem.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
