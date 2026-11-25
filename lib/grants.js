// Verified Whop grants: TubeOps's record of who has paid.
//
// Durable in Upstash when it is configured, with the local file and process map
// kept as a short-lived hot cache. The file alone is not enough on Vercel —
// `/tmp` is per-instance and is wiped on cold start, so a file-only grant meant
// a paying customer silently reverted to the free plan the moment their
// request landed on a cold lambda. Server-only (Node).
//
// Access ends when Whop says so: a cancel, refund or dispute webhook revokes
// the membership (see revokeMembership), and a grant that has not been checked
// against Whop for a while is re-checked on use, so a missed webhook cannot
// leave someone on a paid plan forever.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { emailsFromUser } from './comped.js'
import { applyPaidGrant, PAID_MEMBERSHIP_STATUSES } from './paid-grant.js'
import { kvConfigured, kvDel, kvReadJson, kvSetJson, kvSetAdd, kvSetMembers } from './kv.js'
import { retrieveMembership } from './whop-lookup.js'

const FILE = process.env.VIDSO_GRANTS_FILE || path.join(os.tmpdir(), 'vidso-grants.json')
const mem = globalThis.__vidsoGrantMap || (globalThis.__vidsoGrantMap = new Map())
// When each key was last confirmed against Redis on this instance.
const seen = globalThis.__vidsoGrantSeen || (globalThis.__vidsoGrantSeen = new Map())
const revokedLocal = globalThis.__vidsoRevoked || (globalThis.__vidsoRevoked = new Map())

const NS = 'vidso:grant:'
const MEMBERSHIP_NS = 'vidso:membership:'
const REVOKED_NS = 'vidso:revoked:'

/** How long a warm instance trusts its copy before asking Redis again. */
export const GRANT_CACHE_MS = 60 * 1000
/** How often a grant is re-checked against Whop itself. */
export const GRANT_RECHECK_MS = 6 * 60 * 60 * 1000

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

function grantKey(value) {
  return String(value || '').trim().toLowerCase()
}

function keysFor(user) {
  const keys = emailsFromUser(user)
  const id = String(user?.id || user?.user_id || '').trim().toLowerCase()
  if (id) keys.push(id)
  return keys.map(grantKey).filter(Boolean)
}

function cachedGrantFor(user, now) {
  for (const key of keysFor(user)) {
    const rec = mem.get(key)
    if (!rec || !rec.tier) continue
    if (!kvConfigured()) return rec
    if (now - (seen.get(key) || 0) < GRANT_CACHE_MS) return rec
  }
  return null
}

function rememberLocal(keys, rec, now) {
  for (const k of keys) {
    mem.set(k, rec)
    seen.set(k, now)
  }
  saveFile()
}

function forgetLocal(keys, membershipId) {
  let changed = false
  for (const k of keys) {
    const rec = mem.get(k)
    if (rec && (!membershipId || rec.membershipId === membershipId)) {
      mem.delete(k)
      seen.delete(k)
      changed = true
    }
  }
  if (changed) saveFile()
}

/** Revocation record for a membership, or null. */
export async function membershipRevoked(membershipId) {
  const id = String(membershipId || '').trim()
  if (!id) return null
  if (revokedLocal.has(id)) return revokedLocal.get(id)
  if (!kvConfigured()) return null
  const rec = await kvReadJson(REVOKED_NS + id)
  if (rec && rec.at) revokedLocal.set(id, rec)
  return rec || null
}

async function readGrant(keys, now) {
  if (!kvConfigured()) {
    for (const key of keys) {
      const rec = mem.get(key)
      if (rec && rec.tier) return rec
    }
    return null
  }
  let unreadable = false
  for (const key of keys) {
    const rec = await kvReadJson(NS + key)
    if (rec === undefined) {
      unreadable = true
      continue
    }
    if (!rec || !rec.tier) continue
    rememberLocal(keys, rec, now)
    return rec
  }
  // Redis said "no grant" for every key: drop whatever this instance remembered.
  // If Redis could not be read, keep the local copy rather than lock out a payer.
  if (unreadable) {
    for (const key of keys) {
      const rec = mem.get(key)
      if (rec && rec.tier) return rec
    }
    return null
  }
  forgetLocal(keys)
  return null
}

/** Ask Whop whether the membership behind a grant is still paid. */
async function recheck(user, rec, now, env) {
  if (!rec?.membershipId || rec.source === 'comped') return rec
  const last = Date.parse(rec.checkedAt || rec.at || '') || 0
  if (now - last < GRANT_RECHECK_MS) return rec
  const membership = await retrieveMembership(rec.membershipId, env)
  if (!membership) return rec // Whop unreachable or no key: keep access, try again later
  const status = String(membership.status || '').trim().toLowerCase()
  if (!PAID_MEMBERSHIP_STATUSES.has(status)) {
    await revokeMembership(rec.membershipId, { reason: 'status:' + (status || 'unknown'), now })
    return null
  }
  const next = { ...rec, checkedAt: new Date(now).toISOString() }
  const keys = rec.owners?.length ? rec.owners : keysFor(user)
  rememberLocal(keys, next, now)
  if (kvConfigured()) await Promise.all(keys.map((key) => kvSetJson(NS + key, next)))
  return next
}

export async function grantFor(user, { now = Date.now(), env } = {}) {
  const keys = keysFor(user)
  if (!keys.length) return null
  const rec = cachedGrantFor(user, now) || await readGrant(keys, now)
  if (!rec) return null
  if (rec.membershipId && await membershipRevoked(rec.membershipId)) {
    forgetLocal(keys, rec.membershipId)
    return null
  }
  return recheck(user, rec, now, env)
}

/** Owners of a membership, across every instance that has ever seen it. */
async function membershipOwners(membershipId) {
  const owners = new Set()
  for (const rec of mem.values()) {
    if (rec?.membershipId === membershipId) {
      for (const owner of rec.owners || []) owners.add(grantKey(owner))
    }
  }
  if (kvConfigured()) {
    for (const owner of await kvSetMembers(MEMBERSHIP_NS + membershipId)) {
      owners.add(grantKey(owner))
    }
  }
  return [...owners].filter(Boolean)
}

export async function saveGrant(user, grant, { now = Date.now() } = {}) {
  if (grant?.membershipId && await membershipRevoked(grant.membershipId)) {
    const err = new Error('This Whop membership was cancelled or refunded.')
    err.code = 'membership_revoked'
    throw err
  }
  if (!grant || !grant.tier) return grant
  const keys = keysFor(user)
  if (grant.membershipId) {
    const owners = await membershipOwners(grant.membershipId)
    if (owners.length && !keys.some((k) => owners.includes(k))) {
      const err = new Error('This payment is already attached to another TubeOps account.')
      err.code = 'membership_taken'
      throw err
    }
  }
  const at = new Date(now).toISOString()
  const rec = {
    tier: grant.tier,
    cycle: grant.cycle || 'monthly',
    planId: grant.planId || null,
    membershipId: grant.membershipId || null,
    at,
    checkedAt: at,
    source: grant.source || 'whop',
    owners: keys,
  }
  rememberLocal(keys, rec, now)
  if (kvConfigured()) {
    await Promise.all([
      ...keys.map((key) => kvSetJson(NS + key, rec)),
      rec.membershipId ? kvSetAdd(MEMBERSHIP_NS + rec.membershipId, keys) : Promise.resolve(true),
    ])
  }
  return rec
}

/**
 * End access for a Whop membership: every account it was attached to loses the
 * grant, and the membership cannot be claimed again until Whop shows a newer
 * payment for it (clearRevocation).
 */
export async function revokeMembership(membershipId, { reason = 'revoked', now = Date.now() } = {}) {
  const id = String(membershipId || '').trim()
  if (!id) return { revoked: false, owners: [] }
  const mark = { at: new Date(now).toISOString(), reason }
  revokedLocal.set(id, mark)
  const owners = await membershipOwners(id)
  forgetLocal(owners, id)
  if (kvConfigured()) {
    await kvSetJson(REVOKED_NS + id, mark)
    await Promise.all(owners.map(async (key) => {
      const rec = await kvReadJson(NS + key)
      if (rec && rec.membershipId === id) await kvDel(NS + key)
    }))
  }
  return { revoked: true, owners }
}

/** A newer payment on a revoked membership (a real renewal) lifts the revocation. */
export async function clearRevocation(membershipId, paidAt) {
  const id = String(membershipId || '').trim()
  if (!id) return false
  const mark = await membershipRevoked(id)
  if (!mark) return true
  const paid = Date.parse(paidAt || '')
  if (!Number.isFinite(paid) || paid <= Date.parse(mark.at)) return false
  revokedLocal.delete(id)
  if (kvConfigured()) await kvDel(REVOKED_NS + id)
  return true
}

export async function withStoredGrant(user) {
  return applyPaidGrant(user, await grantFor(user))
}

export function _resetGrantsForTests() {
  mem.clear()
  seen.clear()
  revokedLocal.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
