// Vidso-side plan grants — Clipzo does not expose a plan admin API.
// Keep these lists in sync with the dashboard boot script (cannot import modules there).

export const COMPED_STUDIO_EMAILS = [
  'stormdecoded@gmail.com',
  'xenonforyou@gmail.com',
  'xenonforyou@gmai.com',
  'rishavvashisht347@gmail.com',
  'work.krishlulla@gmail.com',
]

export const COMPED_PRO_EMAILS = [
  'ntuamassoma@gmail.com',
  'faisalym3@gmail.com',
  'margik2803@gmail.com',
  'subramaniamvishwak@gmail.com',
  'subramaniam.vishwak@gmail.com',
]

/** Time-boxed comps. Dropped automatically after `until`. */
export const COMPED_TERM_GRANTS = [
  {
    email: 'jacoblewiswrestling@gmail.com',
    tier: 'studio',
    cycle: 'monthly',
    until: '2026-10-01T00:00:00.000Z',
  },
]

const DEFAULT_CYCLE = { studio: 'yearly', pro: 'monthly', plus: 'monthly' }

/** Gmail ignores dots and +tags — Whop receipts often use a different spelling than Vidso login. */
export function emailKeys(email) {
  const raw = String(email || '').trim().toLowerCase()
  if (!raw.includes('@')) return []
  const at = raw.lastIndexOf('@')
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  const out = [raw]
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const base = local.split('+')[0].replace(/\./g, '')
    const canon = base + '@gmail.com'
    if (!out.includes(canon)) out.push(canon)
  }
  return out
}

export function emailsMatch(a, b) {
  const left = new Set(emailKeys(a))
  if (!left.size) return false
  return emailKeys(b).some((k) => left.has(k))
}

export function emailsFromUser(user) {
  const out = []
  const add = (value) => {
    for (const email of emailKeys(value)) {
      if (email && !out.includes(email)) out.push(email)
    }
  }
  if (!user || typeof user !== 'object') return out
  add(user.email)
  add(user.user_email)
  add(user.user?.email)
  add(user.profile?.email)
  return out
}

export function compedGrantForEmail(email, now = new Date()) {
  for (const id of emailKeys(email)) {
    if (COMPED_STUDIO_EMAILS.some((listed) => emailsMatch(listed, id))) {
      return { email: id, tier: 'studio', cycle: DEFAULT_CYCLE.studio }
    }
    if (COMPED_PRO_EMAILS.some((listed) => emailsMatch(listed, id))) {
      return { email: id, tier: 'pro', cycle: DEFAULT_CYCLE.pro }
    }
    const term = COMPED_TERM_GRANTS.find((row) => emailsMatch(row.email, id))
    if (term && new Date(now).getTime() < new Date(term.until).getTime()) {
      return { email: id, tier: term.tier, cycle: term.cycle || DEFAULT_CYCLE[term.tier] }
    }
  }
  return null
}

export function compedTierForEmail(email, now = new Date()) {
  return compedGrantForEmail(email, now)?.tier || null
}

export function compedGrant(user, now = new Date()) {
  for (const email of emailsFromUser(user)) {
    const grant = compedGrantForEmail(email, now)
    if (grant) return grant
  }
  return null
}

export function compedTier(user, now = new Date()) {
  return compedGrant(user, now)?.tier || null
}

export function isCompedEmail(email) {
  return !!compedTierForEmail(email)
}

export function isCompedStudio(user) {
  return compedTier(user) === 'studio'
}

function rawPlanStatus(user) {
  if (!user) return ''
  return String(user.plan_status || '').trim().toLowerCase()
}

export function planIsActive(user) {
  if (!user) return false
  if (compedTier(user)) return true
  return rawPlanStatus(user) === 'active' || user.active === true
}

export function withCompedPlan(user, now = new Date()) {
  if (!user || typeof user !== 'object') return user
  const status = rawPlanStatus(user)
  const active = status === 'active' || user.active === true
  const plan = user.plan || user.plan_tier || user.tier
  const mapped = {
    ...user,
    plan: plan || user.plan,
    plan_tier: user.plan_tier || plan,
    plan_status: active ? 'active' : (user.plan_status || status || 'inactive'),
    active: active || user.active === true,
  }
  const grant = compedGrant(mapped, now)
  if (!grant) return mapped
  return {
    ...mapped,
    plan: grant.tier,
    plan_tier: grant.tier,
    plan_status: 'active',
    plan_interval: mapped.plan_interval || grant.cycle || DEFAULT_CYCLE[grant.tier] || 'monthly',
    active: true,
  }
}
