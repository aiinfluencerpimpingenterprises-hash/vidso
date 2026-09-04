/** Shared Railway gate used by /api/gate and Claude MCP tools. */

import { evaluateFeature, evaluateGeneration, evaluateLength, toHttp } from './enforce.js'
import { enrichScriptBody, scriptUpstreamBody } from './faceless-length.js'
import { durationFromBody, generationKindFromSeconds } from './quota.js'
import { studioCreditView } from './studio-credits.js'
import { hydrateUsage, incrementUsage } from './usage-store.js'
import { isJsonSyntaxError, recoverScriptData } from './json-repair.js'
import { withCompedPlan, planIsActive } from './comped.js'
import { applyPaidGrant } from './paid-grant.js'
import { saveGrant, withStoredGrant } from './grants.js'
import { lookupPaidMembership } from './whop-lookup.js'

export const UPSTREAM = process.env.UPSTREAM_API || 'https://vibrant-patience-production-a7f0.up.railway.app'

function emailFromJwt(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return ''
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return String(json.email || json.user_email || '').trim()
  } catch {
    return ''
  }
}

export async function resolveVidsoUser(token) {
  const res = await fetch(UPSTREAM + '/api/user/me', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Unauthorized')
    err.status = res.status
    err.body = data
    throw err
  }
  let user = await withStoredGrant(withCompedPlan({ ...data, email: data.email || emailFromJwt(token) }))
  if (planIsActive(user)) return user
  try {
    const hit = await lookupPaidMembership(user)
    if (hit?.active && hit.tier) {
      user = applyPaidGrant(user, await saveGrant(user, hit))
    } else if (hit?.active && hit.legacy) {
      user = { ...user, plan_status: 'active', active: true }
    }
  } catch (_) {}
  return user
}

export function ruleFor(method, subpath) {
  const p = String(subpath || '').replace(/^\/+|\/+$/g, '')
  if (method === 'GET' && (p === 'usage' || p === 'quota')) return { type: 'usage' }
  if (method === 'POST' && p === 'faceless/script') return { type: 'length' }
  if (method === 'POST' && p === 'faceless/media') return { type: 'length' }
  if (method === 'POST' && p === 'faceless/render') return { type: 'generate' }
  if (method === 'POST' && p === 'download/analyze') return { type: 'feature', feature: 'viral_moment_clipping' }
  if (method === 'POST' && (p === 'autoclip' || p.startsWith('autoclip/'))) return { type: 'feature', feature: 'viral_moment_clipping' }
  return { type: 'forward' }
}

function queryString(query) {
  if (!query) return ''
  const params = query instanceof URLSearchParams
    ? new URLSearchParams(query)
    : typeof query === 'string'
      ? new URLSearchParams(query.replace(/^\?/, ''))
      : (() => {
        const next = new URLSearchParams()
        for (const [k, v] of Object.entries(query || {})) {
          if (v == null || v === '') continue
          next.set(k, String(v))
        }
        return next
      })()
  params.delete('p')
  params.delete('path')
  return params.toString()
}

export async function railwayFetch(token, method, subpath, body, query) {
  const path = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const qs = queryString(query)
  const url = UPSTREAM + '/api/' + path + (qs ? '?' + qs : '')
  const headers = { Authorization: 'Bearer ' + token }
  const verb = String(method || 'GET').toUpperCase()
  let payload
  if (verb !== 'GET' && verb !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body || {})
  }
  const res = await fetch(url, { method: verb, headers, body: payload })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  return { status: res.status, data, text }
}

export function usageBody(user, usage) {
  const credits = studioCreditView(user, usage)
  return {
    long_form_used: usage.long_form_used,
    short_form_used: usage.short_form_used,
    studio_credits_used: usage.studio_credits_used,
    studio_credits_limit: credits.limit,
    studio_credits_remaining: credits.remaining,
    known: true,
    plan: user.plan || user.plan_tier,
    plan_status: user.plan_status,
  }
}

export async function runGatedApi({ token, user, method, subpath, body = {}, query }) {
  const verb = String(method || 'GET').toUpperCase()
  const path = String(subpath || '').replace(/^\/+|\/+$/g, '')
  const rule = ruleFor(verb, path)
  const usage = await hydrateUsage(user)

  if (rule.type === 'usage') {
    return { status: 200, body: usageBody(user, usage) }
  }

  let payload = body && typeof body === 'object' ? { ...body } : {}
  const seconds = durationFromBody(payload)
  const kind = generationKindFromSeconds(seconds)
  if (verb === 'POST' && path === 'faceless/script') {
    payload = enrichScriptBody(payload, seconds)
  }

  if (rule.type === 'feature') {
    const gate = evaluateFeature({ user, feature: rule.feature })
    if (!gate.ok) {
      const http = toHttp(gate)
      return { status: http.status, body: http.body }
    }
  }

  if (rule.type === 'length' || rule.type === 'generate') {
    const gate = rule.type === 'generate'
      ? evaluateGeneration({
        user,
        durationSeconds: seconds,
        kind: kind || undefined,
        used: kind === 'short_form' ? usage.short_form_used : usage.long_form_used,
      })
      : evaluateLength({ user, durationSeconds: seconds })
    if (!gate.ok) {
      const http = toHttp(gate)
      return { status: http.status, body: http.body }
    }
  }

  const forwardBody = path === 'faceless/script' ? scriptUpstreamBody(payload) : payload
  const upstream = await railwayFetch(token, verb, path, forwardBody, query)
  if (path === 'faceless/script') {
    const recovered = recoverScriptData(upstream.data, upstream.text)
    if (recovered && (
      upstream.status < 400 ||
      isJsonSyntaxError(upstream.data?.error || upstream.data?.message || upstream.text)
    )) {
      upstream.status = 200
      upstream.data = recovered
    }
  }
  if (upstream.status >= 200 && upstream.status < 300 && rule.type === 'generate') {
    const g = evaluateGeneration({
      user,
      durationSeconds: seconds,
      kind: kind || undefined,
      used: kind === 'short_form' ? usage.short_form_used : usage.long_form_used,
    })
    if (g.ok && g.increment) incrementUsage(user, g.kind)
  }
  return { status: upstream.status, body: upstream.data, text: upstream.text }
}
