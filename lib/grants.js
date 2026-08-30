// Verified Whop grants: Vidso's record of who has paid.
//
// Durable in Upstash when it is configured, with the local file and process map
// kept as a hot cache. The file alone is not enough on Vercel — `/tmp` is
// per-instance and is wiped on cold start, so a file-only grant meant a paying
// customer silently reverted to the free plan the moment their request landed
// on a cold lambda. Server-only (Node).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { emailsFromUser } from './comped.js'
import { applyPaidGrant } from './paid-grant.js'
import { kvConfigured, kvGetJson, kvSetJson, kvSetAdd, kvSetMembers } from './kv.js'

const FILE = process.env.VIDSO_GRANTS_FILE || path.join(os.tmpdir(), 'vidso-grants.json')
const mem = globalThis.__vidsoGrantMap || (globalThis.__vidsoGrantMap = new Map())

const NS = 'vidso:grant:'
const MEMBERSHIP_NS = 'vidso:membership:'

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

function cachedGrantFor(user) {
  for (const key of keysFor(user)) {
    const rec = mem.get(key)
    if (rec && rec.tier) return rec
  }
  return null
}

export async function grantFor(user) {
  const keys = keysFor(user)
  const local = cachedGrantFor(user)
  if (local) return local
  if (!kvConfigured()) return null
  for (const key of keys) {
    const rec = await kvGetJson(NS + key)
    if (!rec || !rec.tier) continue
    // Warm the local cache so the rest of this instance's life is a free read.
    for (const k of keys) mem.set(k, rec)
    saveFile()
    return rec
  }
  return null
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

export async function saveGrant(user, grant) {
  if (!grant || !grant.tier) return grant
  const keys = keysFor(user)
  if (grant.membershipId) {
    const owners = await membershipOwners(grant.membershipId)
    if (owners.length && !keys.some((k) => owners.includes(k))) {
      const err = new Error('This payment is already attached to another Vidso account.')
      err.code = 'membership_taken'
      throw err
    }
  }
  const rec = {
    tier: grant.tier,
    cycle: grant.cycle || 'monthly',
    planId: grant.planId || null,
    membershipId: grant.membershipId || null,
    at: new Date().toISOString(),
    source: grant.source || 'whop',
    owners: keys,
  }
  for (const key of keys) mem.set(key, rec)
  saveFile()
  if (kvConfigured()) {
    await Promise.all([
      ...keys.map((key) => kvSetJson(NS + key, rec)),
      rec.membershipId ? kvSetAdd(MEMBERSHIP_NS + rec.membershipId, keys) : Promise.resolve(true),
    ])
  }
  return rec
}

export async function withStoredGrant(user) {
  return applyPaidGrant(user, await grantFor(user))
}

export function _resetGrantsForTests() {
  mem.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
