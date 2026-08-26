// Verified Whop grants. Server-only (Node). Same file+memory pattern as usage-store.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { emailsFromUser } from './comped.js'
import { applyPaidGrant } from './paid-grant.js'

const FILE = process.env.VIDSO_GRANTS_FILE || path.join(os.tmpdir(), 'vidso-grants.json')
const mem = globalThis.__vidsoGrantMap || (globalThis.__vidsoGrantMap = new Map())

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

export function grantFor(user) {
  const keys = emailsFromUser(user)
  const id = String(user?.id || user?.user_id || '').trim().toLowerCase()
  if (id) keys.push(id)
  for (const key of keys) {
    const rec = mem.get(grantKey(key))
    if (rec && rec.tier) return rec
  }
  return null
}

export function saveGrant(user, grant) {
  if (!grant || !grant.tier) return grant
  const rec = {
    tier: grant.tier,
    cycle: grant.cycle || 'monthly',
    planId: grant.planId || null,
    membershipId: grant.membershipId || null,
    at: new Date().toISOString(),
    source: grant.source || 'whop',
  }
  const keys = emailsFromUser(user)
  const id = String(user?.id || user?.user_id || '').trim().toLowerCase()
  if (id) keys.push(id)
  for (const key of keys) {
    const k = grantKey(key)
    if (k) mem.set(k, rec)
  }
  saveFile()
  return rec
}

export function withStoredGrant(user) {
  return applyPaidGrant(user, grantFor(user))
}

export function _resetGrantsForTests() {
  mem.clear()
  try { fs.unlinkSync(FILE) } catch (_) {}
}
