// "Forgot password": the reset email and setting a new password, through Supabase Auth.
// Supabase needs the project's public (anon / publishable) key for these calls. It is read from
// the environment (SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY on Vercel); without it the
// endpoints say reset isn't set up, instead of failing in a confusing way.
import { readJson, send } from './http.js'

const SUPABASE_URL = 'https://ymtmgpgcmrazqeklixwf.supabase.co'

function anonKey(env = process.env) {
  return String(env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '').trim()
}

// A few requests per IP per 10 minutes (per instance), so the form can't be used to spam inboxes.
const hits = new Map()
function limited(req, max = 5, windowMs = 10 * 60 * 1000) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '') || 'unknown'
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(ip, list)
  if (hits.size > 5000) hits.clear()
  return list.length > max
}

const NOT_SET_UP = { error: 'reset_unavailable', message: "Password reset isn't switched on yet. Email support@tubeops.pro and we'll reset it for you." }

/** POST {email}: send the reset email. Always answers the same way, so it never reveals who has an account. */
export async function handlePasswordRecover(req, res, origin) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  const key = anonKey()
  if (!key) return send(res, 501, NOT_SET_UP)
  if (limited(req)) return send(res, 429, { error: 'too_many', message: 'Too many reset requests. Try again in a few minutes.' })
  const body = await readJson(req).catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return send(res, 400, { error: 'bad_email', message: 'Enter a valid email address.' })
  const redirectTo = String(origin || 'https://www.tubeops.pro').replace(/\/+$/, '') + '/login?reset=1'
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(15000),
    })
  } catch (_) { /* same answer either way */ }
  return send(res, 200, { ok: true, message: 'If that email has an account, a reset link is on its way. Check your inbox (and spam).' })
}

/** POST {access_token, password}: set the new password with the recovery session from the email link. */
export async function handlePasswordUpdate(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  const key = anonKey()
  if (!key) return send(res, 501, NOT_SET_UP)
  if (limited(req, 10)) return send(res, 429, { error: 'too_many', message: 'Too many tries. Wait a few minutes.' })
  const body = await readJson(req).catch(() => ({}))
  const token = String(body.access_token || '').trim()
  const password = String(body.password || '')
  if (!token) return send(res, 400, { error: 'missing_token', message: 'This reset link is incomplete. Ask for a new one.' })
  if (password.length < 6 || password.length > 128) return send(res, 400, { error: 'weak_password', message: 'Use 6 to 128 characters for the new password.' })
  let r
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(15000),
    })
  } catch (_) {
    return send(res, 502, { error: 'unreachable', message: "Couldn't reach the sign-in service. Try again." })
  }
  if (r.status === 401 || r.status === 403) return send(res, 401, { error: 'link_expired', message: 'This reset link has expired. Ask for a new one.' })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    return send(res, 400, { error: 'update_failed', message: String(data.msg || data.message || data.error_description || 'Could not set that password. Try another one.').slice(0, 200) })
  }
  return send(res, 200, { ok: true, message: 'Password changed. Sign in with your new password.' })
}
