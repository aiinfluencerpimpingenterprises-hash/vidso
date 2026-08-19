import { api, setSession, clearSession, getToken, WHOP_CHECKOUT } from '/api.js'

window._api = api
window._setSession = setSession
window._clearSession = clearSession
window._getToken = getToken

let currentUser = null
let voices = []
let selectedVoiceId = null
let selectedVoicePreview = null
let captionJobId = null
let captionPollTimer = null

// ── AUTH ─────────────────────────────────────────────────────────────────────
async function checkAuth() {
  // Finish Google OAuth return (tokens in hash/query) before session checks.
  consumeOAuthReturn()
  const oauthErr = consumeOAuthError()
  if (oauthErr) {
    showModal()
    showAuthError(oauthErr)
    return
  }
  if (!getToken()) { showModal(); return }
  try {
    currentUser = await api.user.me()
  } catch {
    // Access token is likely expired (Supabase JWTs last ~1h). Try the
    // refresh_token before giving up — without this, every hard-refresh past
    // the 1h mark dumps the user back at the sign-in modal.
    const rt = localStorage.getItem('clipzo_refresh')
    if (!rt) { clearSession(); showModal(); return }
    try {
      const { session } = await api.auth.refresh(rt)
      if (!session?.access_token) throw new Error('refresh returned no session')
      setSession(session)
      currentUser = await api.user.me()
    } catch { clearSession(); showModal(); return }
  }
  hideModal()
  populateUser()
  loadUsage()
  loadVoices()
  loadFiles()
  restorePanelFromHash() // path routes + legacy #hash bookmarks
  if (hasActivePlan()) closePaywall()
  maybeShowOnboarding()
}

function showModal() { document.getElementById('auth-modal').classList.remove('hidden') }
function hideModal() { document.getElementById('auth-modal').classList.add('hidden') }

window.switchTab = (tab) => {
  document.getElementById('tab-login').style.display  = tab === 'login'  ? '' : 'none'
  document.getElementById('tab-signup').style.display = tab === 'signup' ? '' : 'none'
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (i===0) === (tab==='login')))
}

function setAuthCtaLoading(btn, on) {
  if (!btn) return
  btn.classList.toggle('is-loading', !!on)
  btn.disabled = !!on
  btn.setAttribute('aria-busy', on ? 'true' : 'false')
}

function showAuthError(message) {
  const loginVisible = document.getElementById('tab-login')?.style.display !== 'none'
  const err = document.getElementById(loginVisible ? 'login-err' : 'signup-err')
  if (!err) return
  err.textContent = message
  err.style.display = 'block'
}

function authRedirectTarget() {
  const path = normalizePath(location.pathname)
  if (path === '/login' || path === '/signup') return location.origin + '/dashboard'
  return location.origin + location.pathname + location.search
}

/** Consume OAuth return tokens from hash/query (Supabase-style) if present. */
function consumeOAuthReturn() {
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''))
  const query = new URLSearchParams(location.search || '')
  const access = hash.get('access_token') || query.get('access_token')
  const refresh = hash.get('refresh_token') || query.get('refresh_token')
  if (!access) return false
  setSession({ access_token: access, refresh_token: refresh || '' })
  // Strip token params from the URL so refresh does not re-apply a stale session.
  const cleanQuery = new URLSearchParams(location.search || '')
  ;['access_token','refresh_token','expires_in','token_type','provider_token','provider_refresh_token'].forEach(k => cleanQuery.delete(k))
  const qs = cleanQuery.toString()
  history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''))
  return true
}

/** Surface Supabase/Google OAuth error returns (?error= / #error=). */
function consumeOAuthError() {
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''))
  const query = new URLSearchParams(location.search || '')
  const code = hash.get('error') || query.get('error')
  if (!code) return null
  const desc = hash.get('error_description') || query.get('error_description') || code
  const cleanQuery = new URLSearchParams(location.search || '')
  ;['error','error_code','error_description'].forEach(k => cleanQuery.delete(k))
  const qs = cleanQuery.toString()
  history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''))
  return String(desc).replace(/\+/g, ' ')
}

window.doGoogleLogin = async () => {
  const btn = document.getElementById('google-cta')
  const redirectTo = authRedirectTarget()
  document.getElementById('login-err').style.display = 'none'
  document.getElementById('signup-err').style.display = 'none'
  setAuthCtaLoading(btn, true)
  try {
    // Full-page redirect to Supabase Google OAuth; tokens return via URL hash.
    // Note: Google provider must be enabled on the Supabase project for this to work.
    location.href = api.auth.googleStartUrl(redirectTo)
  } catch (e) {
    showAuthError(e.message || 'Google sign-in failed')
    setAuthCtaLoading(btn, false)
  }
}

window.doLogin = async () => {
  const email = document.getElementById('login-email').value.trim()
  const pass  = document.getElementById('login-pass').value
  const err   = document.getElementById('login-err')
  const btn   = document.getElementById('login-cta')
  err.style.display = 'none'
  setAuthCtaLoading(btn, true)
  try {
    const data = await api.auth.login(email, pass)
    setSession(data.session)
    currentUser = await api.user.me()
    hideModal()
    populateUser()
    loadUsage()
    loadVoices()
    loadFiles()
    maybeShowOnboarding()
  } catch(e) { err.textContent = e.message; err.style.display = 'block' }
  finally { setAuthCtaLoading(btn, false) }
}

window.doSignup = async () => {
  const name  = document.getElementById('su-name').value.trim()
  const email = document.getElementById('su-email').value.trim()
  const pass  = document.getElementById('su-pass').value
  const err   = document.getElementById('signup-err')
  const btn   = document.getElementById('signup-cta')
  err.style.display = 'none'
  setAuthCtaLoading(btn, true)
  try {
    const data = await api.auth.signup(email, pass, name)
    setSession(data.session)
    currentUser = await api.user.me()
    hideModal()
    populateUser()
    loadUsage()
    loadVoices()
    loadFiles()
    maybeShowOnboarding()
  } catch(e) { err.textContent = e.message; err.style.display = 'block' }
  finally { setAuthCtaLoading(btn, false) }
}

window.doLogout = async () => {
  await api.auth.logout().catch(()=>{})
  clearSession()
  currentUser = null
  showModal()
}

window.closeMobileNav = () => {
  document.body.classList.remove('nav-open')
  const backdrop = document.getElementById('nav-backdrop')
  if (backdrop) backdrop.hidden = true
  const toggle = document.getElementById('mobile-nav-toggle')
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', 'Open menu')
  }
}
window.openMobileNav = () => {
  document.body.classList.add('nav-open')
  const backdrop = document.getElementById('nav-backdrop')
  if (backdrop) backdrop.hidden = false
  const toggle = document.getElementById('mobile-nav-toggle')
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true')
    toggle.setAttribute('aria-label', 'Close menu')
  }
}
window.toggleMobileNav = () => {
  if (document.body.classList.contains('nav-open')) window.closeMobileNav()
  else window.openMobileNav()
}

let _settingsPrevFocus = null
window.openAccountSettings = () => {
  if (!currentUser) { showModal(); return }
  const modal = document.getElementById('settings-modal')
  if (!modal) return
  _settingsPrevFocus = document.activeElement
  const email = currentUser.email || '—'
  const name = ((currentUser.name || '').trim() || String(email).split('@')[0] || 'Your account').trim()
  const initial = (currentUser.name || currentUser.email || '').trim().charAt(0)
  const av = document.getElementById('settings-avatar')
  if (av) av.textContent = initial ? initial.toUpperCase() : '?'
  const nameEl = document.getElementById('settings-name')
  if (nameEl) nameEl.textContent = name || 'Your account'
  const emailEl = document.getElementById('settings-email')
  if (emailEl) emailEl.textContent = email
  const creditsEl = document.getElementById('settings-credits')
  if (creditsEl) creditsEl.textContent = String(currentUser.credits ?? 0)
  const planEl = document.getElementById('settings-plan-label')
  if (planEl) {
    planEl.textContent = hasActivePlan()
      ? `${String(currentUser.plan || 'Plan')} · active →`
      : 'Choose a plan →'
  }
  modal.classList.remove('hidden')
  const shell = modal.querySelector('.settings-shell')
  shell?.focus?.()
  window.closeMobileNav?.()
}
window.closeAccountSettings = () => {
  const modal = document.getElementById('settings-modal')
  if (!modal) return
  modal.classList.add('hidden')
  if (_settingsPrevFocus && typeof _settingsPrevFocus.focus === 'function') {
    try { _settingsPrevFocus.focus() } catch (_) {}
  }
  _settingsPrevFocus = null
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  const paywall = document.getElementById('paywall-modal')
  if (paywall && !paywall.classList.contains('hidden')) {
    // Hard paywall — Escape cannot dismiss it
    return
  }
  const onboarding = document.getElementById('onboarding-modal')
  if (onboarding && !onboarding.classList.contains('hidden')) {
    skipOnboarding()
    return
  }
  if (window.isUiTourActive?.()) {
    skipUiTour()
    return
  }
  const settings = document.getElementById('settings-modal')
  if (settings && !settings.classList.contains('hidden')) {
    closeAccountSettings()
    return
  }
  if (document.body.classList.contains('nav-open')) closeMobileNav()
})

// ── ONBOARDING (localStorage until backend profile fields exist) ───────────
// Persistence:
//   vidso_onboarding_seen:<userKey>     -> "1" when completed or skipped (no auto re-open)
//   vidso_onboarding_answers:<userKey>  -> JSON { niche, nicheOther, goal, topicHint, updatedAt }
// userKey = currentUser.email || currentUser.id || 'anon'
// No /api/user profile write endpoint exists in this repo; do not invent a silent backend save.
const OB_NICHE_HINTS = {
  explainers: 'How [topic] actually works (and why most people get it wrong)',
  documentaries: 'The untold story behind [subject]',
  listicles: '12 secrets about [niche] nobody talks about',
  stories: 'The day everything changed: a story worth watching',
  tutorials: 'How to [skill] from scratch, step by step',
  other: ''
}
let _obStep = 1
let _obPrevFocus = null
let _obNiche = ''
let _obGoal = ''
let _obOpening = false

function obUserKey() {
  const u = currentUser || {}
  return String(u.email || u.id || u.user_id || 'anon').trim().toLowerCase() || 'anon'
}
function obSeenKey() { return 'vidso_onboarding_seen:' + obUserKey() }
function obAnswersKey() { return 'vidso_onboarding_answers:' + obUserKey() }
function obHasSeen() {
  try { return localStorage.getItem(obSeenKey()) === '1' } catch (_) { return false }
}
function obMarkSeen() {
  try { localStorage.setItem(obSeenKey(), '1') } catch (_) {}
}
function obLoadAnswers() {
  try { return JSON.parse(localStorage.getItem(obAnswersKey()) || 'null') || {} } catch (_) { return {} }
}
function obSaveAnswers(patch) {
  const next = Object.assign({}, obLoadAnswers(), patch || {}, { updatedAt: Date.now() })
  try { localStorage.setItem(obAnswersKey(), JSON.stringify(next)) } catch (_) {}
  return next
}
function obTopicHint() {
  if (_obNiche === 'other') {
    const custom = (document.getElementById('ob-niche-other-input')?.value || '').trim()
    return custom ? `A long-form video about ${custom}` : ''
  }
  return OB_NICHE_HINTS[_obNiche] || ''
}

function obBindOptionGroup(rootId, onPick) {
  const root = document.getElementById(rootId)
  if (!root || root.dataset.obBound === '1') return
  root.dataset.obBound = '1'
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.ob-option')
    if (!btn || !root.contains(btn)) return
    root.querySelectorAll('.ob-option').forEach(b => {
      b.classList.toggle('is-selected', b === btn)
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false')
    })
    onPick(btn.getAttribute('data-value') || '')
  })
  root.addEventListener('keydown', (e) => {
    const opts = [...root.querySelectorAll('.ob-option')]
    const i = opts.indexOf(document.activeElement)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); opts[Math.min(opts.length - 1, Math.max(0, i) + 1)]?.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); opts[Math.max(0, (i < 0 ? 0 : i) - 1)]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement?.classList?.contains('ob-option')) {
        e.preventDefault(); document.activeElement.click()
      }
    }
  })
}

function obSyncUI() {
  const modal = document.getElementById('onboarding-modal')
  if (!modal) return
  modal.querySelectorAll('.ob-step').forEach(el => {
    el.classList.toggle('is-active', Number(el.getAttribute('data-ob-step')) === _obStep)
  })
  modal.querySelectorAll('[data-ob-dot]').forEach(dot => {
    const n = Number(dot.getAttribute('data-ob-dot'))
    dot.classList.toggle('is-active', n === _obStep)
    dot.classList.toggle('is-done', n < _obStep)
  })
  const label = document.getElementById('ob-step-label')
  if (label) label.textContent = 'Step ' + _obStep + ' of 5'
  const back = document.getElementById('ob-back-btn')
  if (back) back.hidden = _obStep <= 1
  const next = document.getElementById('ob-next-btn')
  const secondary = document.getElementById('ob-secondary-btn')
  const hint = document.getElementById('ob-hint')
  if (hint) hint.textContent = ''
  if (secondary) secondary.hidden = _obStep !== 5
  if (next) {
    if (_obStep === 1) next.textContent = 'Get started'
    else if (_obStep === 5) next.textContent = 'Create your first video'
    else next.textContent = 'Continue'
  }
  const otherWrap = document.getElementById('ob-niche-other')
  if (otherWrap) otherWrap.classList.toggle('is-open', _obNiche === 'other')
  const activateHint = document.getElementById('ob-activate-hint')
  if (activateHint) {
    const t = obTopicHint()
    activateHint.textContent = t
      ? ('Suggested topic: ' + t)
      : 'Start with a topic that fits your niche'
  }
}

function obRestoreFromStorage() {
  const a = obLoadAnswers()
  _obNiche = a.niche || ''
  _obGoal = a.goal || ''
  const nicheRoot = document.getElementById('ob-niche-options')
  nicheRoot?.querySelectorAll('.ob-option').forEach(b => {
    const on = b.getAttribute('data-value') === _obNiche
    b.classList.toggle('is-selected', on)
    b.setAttribute('aria-selected', on ? 'true' : 'false')
  })
  const goalRoot = document.getElementById('ob-goal-options')
  goalRoot?.querySelectorAll('.ob-option').forEach(b => {
    const on = b.getAttribute('data-value') === _obGoal
    b.classList.toggle('is-selected', on)
    b.setAttribute('aria-selected', on ? 'true' : 'false')
  })
  const otherInput = document.getElementById('ob-niche-other-input')
  if (otherInput) otherInput.value = a.nicheOther || ''
}

window.openOnboarding = (opts = {}) => {
  if (!currentUser) { showModal(); return }
  const modal = document.getElementById('onboarding-modal')
  if (!modal || _obOpening) return
  _obOpening = true
  _obPrevFocus = document.activeElement
  _obStep = 1
  obBindOptionGroup('ob-niche-options', (v) => {
    _obNiche = v
    const otherWrap = document.getElementById('ob-niche-other')
    otherWrap?.classList.toggle('is-open', v === 'other')
    if (v === 'other') document.getElementById('ob-niche-other-input')?.focus()
    const hint = document.getElementById('ob-hint')
    if (hint) hint.textContent = ''
  })
  obBindOptionGroup('ob-goal-options', (v) => {
    _obGoal = v
    const hint = document.getElementById('ob-hint')
    if (hint) hint.textContent = ''
  })
  obRestoreFromStorage()
  obSyncUI()
  window.closeMobileNav?.()
  window.closeAccountSettings?.()
  modal.classList.remove('hidden')
  try { window.applyVidsoLogos?.() } catch (_) {}
  const shell = modal.querySelector('.onboarding-shell')
  shell?.focus?.()
  _obOpening = false
  if (opts.fromMenu) {
    // Re-open from menu does not change the seen flag.
  }
}

window.closeOnboarding = () => {
  const modal = document.getElementById('onboarding-modal')
  if (!modal) return
  modal.classList.add('hidden')
  if (_obPrevFocus && typeof _obPrevFocus.focus === 'function') {
    try { _obPrevFocus.focus() } catch (_) {}
  }
  _obPrevFocus = null
}

window.skipOnboarding = () => {
  // Skip closes forever for auto-open, but remains available from the menu.
  if (_obNiche || _obGoal) {
    obSaveAnswers({
      niche: _obNiche || null,
      nicheOther: (document.getElementById('ob-niche-other-input')?.value || '').trim() || null,
      goal: _obGoal || null,
      topicHint: obTopicHint() || null,
      status: 'skipped'
    })
  } else {
    obSaveAnswers({ status: 'skipped' })
  }
  obMarkSeen()
  closeOnboarding()
  maybeStartUiTour()
}

window.onboardingBack = () => {
  if (_obStep <= 1) return
  _obStep -= 1
  obSyncUI()
}

window.onboardingNext = () => {
  const hint = document.getElementById('ob-hint')
  if (_obStep === 2) {
    if (!_obNiche) {
      if (hint) hint.textContent = 'Pick one option to continue'
      return
    }
    if (_obNiche === 'other') {
      const custom = (document.getElementById('ob-niche-other-input')?.value || '').trim()
      if (!custom) {
        if (hint) hint.textContent = 'Add a short niche description'
        document.getElementById('ob-niche-other-input')?.focus()
        return
      }
    }
    obSaveAnswers({
      niche: _obNiche,
      nicheOther: (document.getElementById('ob-niche-other-input')?.value || '').trim() || null,
      topicHint: obTopicHint() || null
    })
  }
  if (_obStep === 3) {
    if (!_obGoal) {
      if (hint) hint.textContent = 'Pick one goal to continue'
      return
    }
    obSaveAnswers({ goal: _obGoal })
  }
  if (_obStep >= 5) {
    finishOnboarding('videogen')
    return
  }
  _obStep += 1
  obSyncUI()
}

window.finishOnboarding = (dest) => {
  const topicHint = obTopicHint()
  obSaveAnswers({
    niche: _obNiche || obLoadAnswers().niche || null,
    nicheOther: (document.getElementById('ob-niche-other-input')?.value || '').trim() || null,
    goal: _obGoal || obLoadAnswers().goal || null,
    topicHint: topicHint || null,
    status: 'completed'
  })
  obMarkSeen()
  closeOnboarding()
  if (dest === 'videogen') {
    try { switchPanel('videogen', null) } catch (_) { location.href = '/video-generation' }
    // Prefill topic when empty so we never overwrite an in-progress draft.
    requestAnimationFrame(() => {
      const topic = document.getElementById('fv-topic')
      if (topic && !String(topic.value || '').trim() && topicHint) {
        topic.value = topicHint
        try { topic.dispatchEvent(new Event('input', { bubbles: true })) } catch (_) {}
      }
    })
  } else {
    try { switchPanel('dashboard', null) } catch (_) {}
  }
  maybeStartUiTour()
}

window.maybeShowOnboarding = () => {
  if (!currentUser) return
  const auth = document.getElementById('auth-modal')
  if (auth && !auth.classList.contains('hidden')) return
  // Preview helper: ?onboarding=1 force-opens (does not clear seen flag until skip/complete)
  const force = /(?:\?|&)onboarding=1(?:&|$)/.test(location.search || '')
  if (!force && obHasSeen()) {
    maybeStartUiTour()
    return
  }
  // Defer so auth shell / panel restore settle first.
  setTimeout(() => {
    if (!currentUser) return
    if (!force && obHasSeen()) {
      maybeStartUiTour()
      return
    }
    if (force) {
      try {
        const url = new URL(location.href)
        url.searchParams.delete('onboarding')
        history.replaceState({}, '', url.pathname + url.search + url.hash)
      } catch (_) {}
    }
    openOnboarding({ auto: true })
  }, 220)
}

// ── UI TOUR (coachmarks) ─────────────────────────────────────────────────
// Persistence: vidso_ui_tour_seen:<userKey> -> "1" when completed or skipped (no auto re-open).
// Re-open anytime via Getting started. Preview: ?tour=1
let _tourStep = 0
let _tourActive = false
let _tourPrevFocus = null
let _tourResizeTimer = 0
let _tourFromMenu = false

function tourSeenKey() { return 'vidso_ui_tour_seen:' + obUserKey() }
function tourHasSeen() {
  try { return localStorage.getItem(tourSeenKey()) === '1' } catch (_) { return false }
}
function tourMarkSeen() {
  try { localStorage.setItem(tourSeenKey(), '1') } catch (_) {}
}
function tourIsMobile() {
  try { return window.matchMedia('(max-width:768px)').matches } catch (_) { return false }
}
function tourReduceMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (_) { return false }
}

const UI_TOUR_STEPS = [
  {
    id: 'welcome',
    kicker: 'App tour',
    title: 'A quick walk through Vidso',
    body: 'We will highlight the real controls you will use. Skip anytime — it will not nag you again.',
    selector: null,
    placement: 'center'
  },
  {
    id: 'clipper',
    kicker: 'Create',
    title: 'Clipping',
    body: 'Turn long videos into short clips you can download and post.',
    selector: '#nav-clipper',
    needsNav: true
  },
  {
    id: 'ranking',
    kicker: 'Create',
    title: 'Ranking',
    body: 'Score clip candidates so you can pick the strongest moments first.',
    selector: '#nav-ranking',
    needsNav: true
  },
  {
    id: 'imagegen',
    kicker: 'Create',
    title: 'Image Generation',
    body: 'Generate still images for thumbnails, frames, and creative assets.',
    selector: '#nav-imagegen',
    needsNav: true
  },
  {
    id: 'videogen',
    kicker: 'Start here',
    title: 'Video Generation',
    body: 'This is the core flow: topic to a full narrated long-form YouTube video.',
    selector: '#nav-videogen',
    needsNav: true,
    panel: 'videogen'
  },
  {
    id: 'upscale',
    kicker: 'Create',
    title: 'Upscale',
    body: 'Coming soon — listed here so you know where higher-resolution tools will land.',
    selector: '#nav-upscale',
    needsNav: true
  },
  {
    id: 'tools',
    kicker: 'Workspace',
    title: 'Tools',
    body: 'Extra utilities for captions, reframing, and other editing helpers.',
    selector: '#nav-tools',
    needsNav: true
  },
  {
    id: 'dashboard',
    kicker: 'Workspace',
    title: 'Dashboard',
    body: 'Your home overview for account activity and quick access back into the app.',
    selector: '#nav-dashboard',
    needsNav: true,
    panel: 'dashboard'
  },
  {
    id: 'credits',
    kicker: 'Account',
    title: 'Credits',
    body: 'Actions spend credits from this balance — buy a plan when you are ready to generate more.',
    selector: '#credits-pill',
    needsNav: false
  },
  {
    id: 'account',
    kicker: 'Account',
    title: 'Account & Getting started',
    body: 'Open settings here, and use Getting started anytime to replay this tour.',
    selector: '#user-getting-started-btn',
    needsNav: true
  }
]

function tourRoot() { return document.getElementById('ui-tour') }
function tourHighlightEl() { return document.getElementById('tour-highlight') }
function tourTooltipEl() { return document.getElementById('tour-tooltip') }

window.isUiTourActive = () => !!_tourActive

async function tourPrepareStep(step) {
  if (step.panel) {
    try { switchPanel(step.panel, null) } catch (_) {}
  }
  if (tourIsMobile()) {
    if (step.needsNav) {
      try { openMobileNav() } catch (_) {}
      await new Promise(r => setTimeout(r, tourReduceMotion() ? 0 : 240))
    } else {
      try { closeMobileNav() } catch (_) {}
      await new Promise(r => setTimeout(r, tourReduceMotion() ? 0 : 160))
    }
  } else {
    try { closeMobileNav() } catch (_) {}
  }
}

function tourPosition() {
  const step = UI_TOUR_STEPS[_tourStep]
  const root = tourRoot()
  const tip = tourTooltipEl()
  const hi = tourHighlightEl()
  if (!step || !root || !tip || !hi) return

  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  let target = step.selector ? document.querySelector(step.selector) : null

  tip.classList.toggle('is-on', true)
  root.classList.toggle('tour-card-mode', !target || step.placement === 'center')

  if (!target || step.placement === 'center') {
    hi.classList.remove('is-on')
    tip.dataset.placement = 'center'
    const tw = tip.offsetWidth || 320
    const th = tip.offsetHeight || 180
    tip.style.left = Math.max(16, (vw - tw) / 2) + 'px'
    tip.style.top = Math.max(16, (vh - th) / 2) + 'px'
    tip.style.setProperty('--tour-arrow-x', '24px')
    return
  }

  try { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: tourReduceMotion() ? 'auto' : 'smooth' }) } catch (_) {}
  const rect = target.getBoundingClientRect()
  const r = {
    top: Math.max(6, rect.top - pad),
    left: Math.max(6, rect.left - pad),
    width: Math.min(vw - 12, rect.width + pad * 2),
    height: Math.min(vh - 12, rect.height + pad * 2)
  }
  hi.style.top = r.top + 'px'
  hi.style.left = r.left + 'px'
  hi.style.width = r.width + 'px'
  hi.style.height = r.height + 'px'
  hi.style.borderRadius = (getComputedStyle(target).borderRadius || '14px')
  hi.classList.add('is-on')

  // Measure tip after content set
  const tw = tip.offsetWidth || 320
  const th = tip.offsetHeight || 180
  const gap = 14
  const spaceBelow = vh - (r.top + r.height)
  const spaceAbove = r.top
  let placement = 'bottom'
  if (spaceBelow < th + gap + 12 && spaceAbove > spaceBelow) placement = 'top'
  // Prefer side placement on desktop if target is in the left sidebar.
  if (!tourIsMobile() && r.left < 320 && vw - (r.left + r.width) > tw + gap + 24) {
    placement = 'right'
  }

  let left = r.left
  let top = r.top + r.height + gap
  if (placement === 'top') top = r.top - th - gap
  if (placement === 'right') {
    left = r.left + r.width + gap
    top = r.top + Math.max(0, (r.height - th) / 2)
  }
  if (placement === 'left') {
    left = r.left - tw - gap
    top = r.top + Math.max(0, (r.height - th) / 2)
  }

  left = Math.min(Math.max(16, left), vw - tw - 16)
  top = Math.min(Math.max(16, top), vh - th - 16)
  tip.dataset.placement = placement
  tip.style.left = left + 'px'
  tip.style.top = top + 'px'

  if (placement === 'bottom' || placement === 'top') {
    const arrowX = Math.min(tw - 28, Math.max(18, (r.left + r.width / 2) - left - 6))
    tip.style.setProperty('--tour-arrow-x', arrowX + 'px')
  } else {
    const arrowY = Math.min(th - 28, Math.max(18, (r.top + r.height / 2) - top - 6))
    tip.style.setProperty('--tour-arrow-y', arrowY + 'px')
  }
}

function tourRender() {
  const step = UI_TOUR_STEPS[_tourStep]
  const tip = tourTooltipEl()
  if (!step || !tip) return
  document.getElementById('tour-kicker').textContent = step.kicker || 'Tour'
  document.getElementById('tour-title').textContent = step.title || ''
  document.getElementById('tour-body').textContent = step.body || ''
  document.getElementById('tour-step-label').textContent = (_tourStep + 1) + ' of ' + UI_TOUR_STEPS.length
  const back = document.getElementById('tour-back-btn')
  const next = document.getElementById('tour-next-btn')
  if (back) {
    back.hidden = _tourStep === 0
    back.disabled = _tourStep === 0
  }
  if (next) next.textContent = _tourStep >= UI_TOUR_STEPS.length - 1 ? 'Done' : 'Next'
  tourPrepareStep(step).then(() => {
    requestAnimationFrame(() => {
      tourPosition()
      tip.focus?.({ preventScroll: true })
    })
  })
}

window.openUiTour = (opts = {}) => {
  if (!currentUser && !opts.force) { showModal(); return }
  const root = tourRoot()
  const tip = tourTooltipEl()
  if (!root || !tip) return
  _tourFromMenu = !!opts.fromMenu
  _tourPrevFocus = document.activeElement
  _tourStep = 0
  _tourActive = true
  window.closeAccountSettings?.()
  window.closeOnboarding?.()
  root.classList.remove('hidden')
  root.classList.add('is-active')
  root.setAttribute('aria-hidden', 'false')
  document.body.classList.add('tour-active')
  tourRender()
}

window.closeUiTour = () => {
  const root = tourRoot()
  if (!root) return
  _tourActive = false
  root.classList.add('hidden')
  root.classList.remove('is-active', 'tour-card-mode')
  root.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('tour-active')
  tourHighlightEl()?.classList.remove('is-on')
  try { closeMobileNav() } catch (_) {}
  if (_tourPrevFocus && typeof _tourPrevFocus.focus === 'function') {
    try { _tourPrevFocus.focus() } catch (_) {}
  }
  _tourPrevFocus = null
}

window.skipUiTour = () => {
  tourMarkSeen()
  closeUiTour()
  maybeShowPaywall()
}

window.finishUiTour = () => {
  tourMarkSeen()
  closeUiTour()
  maybeShowPaywall()
}

window.uiTourBack = () => {
  if (!_tourActive || _tourStep <= 0) return
  _tourStep -= 1
  tourRender()
}

window.uiTourNext = () => {
  if (!_tourActive) return
  if (_tourStep >= UI_TOUR_STEPS.length - 1) {
    finishUiTour()
    return
  }
  _tourStep += 1
  tourRender()
}

window.maybeStartUiTour = () => {
  if (!currentUser) return
  if (_tourActive) return
  const auth = document.getElementById('auth-modal')
  if (auth && !auth.classList.contains('hidden')) return
  const onboarding = document.getElementById('onboarding-modal')
  if (onboarding && !onboarding.classList.contains('hidden')) return
  const force = /(?:\?|&)tour=1(?:&|$)/.test(location.search || '')
  if (!force && tourHasSeen()) {
    maybeShowPaywall()
    return
  }
  if (!force && !obHasSeen()) return // wait until welcome onboarding is done/skipped
  setTimeout(() => {
    if (!currentUser || _tourActive) return
    if (!force && tourHasSeen()) {
      maybeShowPaywall()
      return
    }
    const ob = document.getElementById('onboarding-modal')
    if (ob && !ob.classList.contains('hidden')) return
    if (force) {
      try {
        const url = new URL(location.href)
        url.searchParams.delete('tour')
        history.replaceState({}, '', url.pathname + url.search + url.hash)
      } catch (_) {}
    }
    openUiTour({ auto: true, force })
  }, 280)
}

// ── PAYWALL (hard gate — no feature access without an active plan) ───────
// Flip PAYWALL_ENABLED to false only for temporary testing; keep true in production.
const PAYWALL_ENABLED = true
let _paywallCycle = 'monthly'
let _paywallOpening = false

function hasActivePlan() {
  return !!(currentUser && currentUser.plan_status === 'active')
}

function setPaywallStatus(msg, kind) {
  const el = document.getElementById('paywall-status')
  if (!el) return
  if (!msg) { el.classList.remove('show'); el.textContent = ''; return }
  el.classList.add('show')
  el.style.color = kind === 'err' ? '#f87171' : kind === 'ok' ? '#4ade80' : 'rgba(255,255,255,.7)'
  el.innerHTML = kind === 'loading' ? `<span class="spinner"></span> ${msg}` : msg
}

window.setPaywallCycle = (cycle) => {
  _paywallCycle = cycle === 'yearly' ? 'yearly' : 'monthly'
  const yearly = _paywallCycle === 'yearly'
  document.querySelectorAll('.paywall-tg').forEach(b => b.classList.toggle('active', b.dataset.cycle === _paywallCycle))
  document.querySelectorAll('#paywall-plans .paywall-plan').forEach(card => {
    card.classList.toggle('is-annual', yearly)
    const amt = card.querySelector('.amt')
    const bill = card.querySelector('.bill')
    if (amt) {
      const v = yearly ? amt.dataset.y : amt.dataset.m
      amt.textContent = '$' + v
    }
    if (bill) bill.textContent = yearly ? bill.dataset.y : bill.dataset.m
  })
}

window.startCheckout = (tier) => {
  const url = api.billing.checkoutUrl(tier, _paywallCycle) || WHOP_CHECKOUT[`${tier}_${_paywallCycle}`]
  if (!url) {
    setPaywallStatus('Checkout link missing for this plan', 'err')
    return
  }
  setPaywallStatus('Opening checkout…', 'loading')
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => setPaywallStatus('After paying, come back and tap “I’ve subscribed — refresh”.', null), 800)
}

window.refreshPlanStatus = async () => {
  setPaywallStatus('Checking your subscription…', 'loading')
  try {
    currentUser = await api.user.me()
    populateUser()
    if (hasActivePlan()) {
      setPaywallStatus('Plan active — unlocking Vidso…', 'ok')
      setTimeout(() => closePaywall(), 500)
    } else {
      setPaywallStatus('No active plan yet. Finish checkout on Whop, then try again.', 'err')
    }
  } catch (e) {
    setPaywallStatus(e.message || 'Could not refresh plan status', 'err')
  }
}

window.openPaywall = (opts = {}) => {
  if (!PAYWALL_ENABLED) { closePaywall(); return }
  if (_paywallOpening) return
  if (!opts.force && hasActivePlan()) { closePaywall(); return }
  const modal = document.getElementById('paywall-modal')
  if (!modal) return
  _paywallOpening = true
  window.closeAccountSettings?.()
  window.closeOnboarding?.()
  window.closeUiTour?.()
  setPaywallCycle(_paywallCycle)
  setPaywallStatus('', null)
  modal.classList.remove('hidden')
  document.body.classList.add('paywalled')
  modal.querySelector('.paywall-shell')?.focus?.()
  _paywallOpening = false
}

window.closePaywall = () => {
  const modal = document.getElementById('paywall-modal')
  if (!modal) return
  modal.classList.add('hidden')
  document.body.classList.remove('paywalled')
  setPaywallStatus('', null)
}

window.maybeShowPaywall = () => {
  if (!PAYWALL_ENABLED) { closePaywall(); return }
  if (!currentUser) return
  if (hasActivePlan()) { closePaywall(); return }
  const auth = document.getElementById('auth-modal')
  if (auth && !auth.classList.contains('hidden')) return
  const onboarding = document.getElementById('onboarding-modal')
  if (onboarding && !onboarding.classList.contains('hidden')) return
  if (_tourActive) return
  // Wait until both welcome onboarding and interactive tour are done/skipped
  if (!obHasSeen() || !tourHasSeen()) return
  const force = /(?:\?|&)paywall=1(?:&|$)/.test(location.search || '')
  if (force) {
    try {
      const url = new URL(location.href)
      url.searchParams.delete('paywall')
      history.replaceState({}, '', url.pathname + url.search + url.hash)
    } catch (_) {}
  }
  openPaywall({ force: true })
}

document.addEventListener('visibilitychange', () => {
  if (!PAYWALL_ENABLED) return
  if (document.visibilityState !== 'visible') return
  const modal = document.getElementById('paywall-modal')
  if (!modal || modal.classList.contains('hidden')) return
  refreshPlanStatus()
})

window.requireActivePlan = (opts = {}) => {
  if (!PAYWALL_ENABLED) return true
  if (hasActivePlan()) return true
  openPaywall({ force: true, reason: opts.reason || 'plan_required' })
  return false
}

document.addEventListener('keydown', (e) => {
  if (!_tourActive) return
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    // Don't steal Enter from buttons that already handle click
    if (e.key === 'Enter' && e.target && e.target.closest && e.target.closest('.tour-btn, .tour-close')) return
    e.preventDefault()
    uiTourNext()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    uiTourBack()
  }
})
window.addEventListener('resize', () => {
  if (!_tourActive) return
  clearTimeout(_tourResizeTimer)
  _tourResizeTimer = setTimeout(() => tourPosition(), 80)
})
window.addEventListener('scroll', () => {
  if (!_tourActive) return
  tourPosition()
}, true)

function populateUser() {
  document.getElementById('user-email').textContent = currentUser.email || ''
  const nameEl = document.getElementById('user-name')
  const displayName = ((currentUser.name || '').trim() || String(currentUser.email || '').split('@')[0] || '').trim()
  if (nameEl) nameEl.textContent = displayName || 'Your account'
  const av = document.getElementById('user-avatar')
  if (av) {
    const initial = (currentUser.name || currentUser.email || '').trim().charAt(0)
    av.textContent = initial ? initial.toUpperCase() : '?'
  }
  const creditsCount = document.getElementById('credits-count')
  if (creditsCount) creditsCount.textContent = String(currentUser.credits ?? 0)
  else document.getElementById('credits-pill').textContent = `${currentUser.credits} credits`
  const welcome = document.getElementById('dash-welcome-name')
  if (welcome) {
    const display = (currentUser.name || '').trim() || String(currentUser.email || '').split('@')[0] || ''
    welcome.textContent = display ? `, ${display}` : ''
  }
}

// ── PANELS + clean URL routes (Vidso-style) ───────────────────────────────
const titles = {
  home:'Dashboard', clipper:'Clipping', ranking:'Ranking', imagegen:'Image Generation',
  videogen:'Video Generation', upscale:'Upscale', tools:'Tools', dashboard:'Dashboard',
  captions:'AI Captions', voiceover:'AI Voiceover', editor:'Video Editor', reframe:'AI Reframe',
  downloader:'Video Downloader', files:'My Files', commentary:'Video Commentary'
}
const PANEL_PATHS = {
  home:'/dashboard', clipper:'/clipping', ranking:'/ranking', imagegen:'/image-generation',
  videogen:'/video-generation', upscale:'/upscale', tools:'/tools', dashboard:'/dashboard',
  captions:'/captions', voiceover:'/voiceover', editor:'/editor', reframe:'/reframe',
  downloader:'/downloader', files:'/files', commentary:'/commentary'
}
const PATH_TO_PANEL = Object.fromEntries(Object.entries(PANEL_PATHS).map(([k,v]) => [v,k]))
PATH_TO_PANEL['/analytics'] = 'dashboard'
PATH_TO_PANEL['/overview'] = 'dashboard'
function normalizePath(p) {
  if (!p) return '/'
  return ('/' + String(p).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')).replace(/\/+/g, '/')
}
function pathForPanel(id) { return PANEL_PATHS[id] || '/dashboard' }
function panelFromPath() { return PATH_TO_PANEL[normalizePath(location.pathname)] || 'dashboard' }
function isAuthPath() {
  const p = normalizePath(location.pathname)
  return p === '/login' || p === '/signup'
}
window.switchPanel = (id, btn, opts = {}) => {
  if (id === 'home') id = 'dashboard'
  if (!titles[id]) id = 'dashboard'
  // Hard gate: after signup onboarding + tour, block every tool until a plan is active.
  // Tour itself may navigate panels — allow while tour/onboarding is open.
  const tourOpen = _tourActive || (document.getElementById('ui-tour') && !document.getElementById('ui-tour').classList.contains('hidden'))
  const obOpen = document.getElementById('onboarding-modal') && !document.getElementById('onboarding-modal').classList.contains('hidden')
  if (PAYWALL_ENABLED && currentUser && !hasActivePlan() && obHasSeen() && tourHasSeen() && !tourOpen && !obOpen && !opts.allowLocked) {
    openPaywall({ force: true })
    return
  }
  const panel = document.getElementById('panel-'+id)
  if (!panel) id = 'dashboard'
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.getElementById('panel-'+id).classList.add('active')
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
  const nestedUnderTools = ['captions','voiceover','editor','reframe','downloader','commentary','files']
  if (btn) btn.classList.add('active')
  else if (nestedUnderTools.includes(id)) document.querySelector('[data-panel="tools"]')?.classList.add('active')
  else document.querySelector(`[data-panel="${id}"]`)?.classList.add('active')
  const titleEl = document.getElementById('topbar-title')
  if (titleEl) {
    titleEl.textContent = titles[id]
    const hasPageHeader = ['clipper','dashboard','tools','ranking','imagegen','videogen','upscale'].includes(id)
    titleEl.classList.toggle('is-hidden', hasPageHeader)
  }
  window.closeMobileNav?.()
  if (id === 'voiceover') loadVoiceLibrary()
  if (id === 'videogen') fvInit()
  if (!opts.silent) {
    const next = pathForPanel(id)
    if (normalizePath(location.pathname) !== normalizePath(next)) {
      history.pushState({ panel: id }, '', next)
    }
  }
}
function restorePanelFromPath() {
  if (isAuthPath()) {
    showModal()
    if (normalizePath(location.pathname) === '/signup') switchTab('signup')
    else switchTab('login')
    return
  }
  const p = normalizePath(location.pathname)
  if (p === '/overview' || p === '/analytics' || p === '/') {
    history.replaceState(null, '', '/dashboard')
  }
  switchPanel(panelFromPath(), null, { silent: true })
}
function migrateHashToPath() {
  const h = (location.hash || '').replace(/^#/, '').toLowerCase()
  if (!h) return false
  if (h === 'login' || h === 'signin') { location.replace('/login'); return true }
  if (h === 'signup') { location.replace('/signup'); return true }
  if (titles[h]) { location.replace(pathForPanel(h)); return true }
  return false
}
function restorePanelFromHash() {
  if (migrateHashToPath()) return
  restorePanelFromPath()
}
window.addEventListener('popstate', restorePanelFromPath)
window.addEventListener('hashchange', restorePanelFromHash)

// ── USAGE ────────────────────────────────────────────────────────────────────
async function loadUsage() {
  try {
    const u = await api.user.usage()
    const d1 = document.getElementById('dash-transcriptions')
    const d2 = document.getElementById('dash-voiceovers')
    const d3 = document.getElementById('dash-images')
    if (d1) d1.textContent = u.transcriptions
    if (d2) d2.textContent = u.voiceovers
    if (d3) d3.textContent = u.images
  } catch {}
}

// ── VOICES ───────────────────────────────────────────────────────────────────
let voicesLoadState = 'idle' // idle | loading | ready | error
let voicesLoadError = ''
let voicesLoadStatus = null
window.loadVoices = async function loadVoices() {
  voicesLoadState = 'loading'
  voicesLoadError = ''
  voicesLoadStatus = null
  fvPopulateVoices()
  try {
    if (!getToken()) {
      const err = new Error('Missing token')
      err.status = 401
      throw err
    }
    voices = await api.tts.voices()
    if (!Array.isArray(voices)) voices = (voices && voices.voices) || []
    voicesLoadState = 'ready'
    const grid = document.getElementById('voices-grid')
    if (grid) {
      if (!voices.length) {
        grid.innerHTML = '<div style="color:var(--muted);font-size:.8rem">No voices returned from the API.</div>'
      } else {
        grid.innerHTML = voices.map(v => `
          <div class="voice-card" data-id="${v.id}" data-preview="${v.preview_url||''}" onclick="selectVoice('${v.id}','${v.preview_url||''}','${v.name}')">
            <div class="voice-name">${v.name.split(' - ')[0]}</div>
            <div class="voice-cat">${v.name.includes(' - ') ? v.name.split(' - ')[1].split(',')[0] : v.category}</div>
          </div>`).join('')
      }
    }
    fvPopulateVoices()
  } catch(e) {
    voices = []
    voicesLoadState = 'error'
    voicesLoadStatus = e && e.status != null ? e.status : null
    voicesLoadError = (e && e.message) ? String(e.message) : 'Failed to load voices'
    console.warn('[voices]', voicesLoadStatus || '', voicesLoadError)
    const grid = document.getElementById('voices-grid')
    if (grid) grid.innerHTML = '<div style="color:var(--muted);font-size:.8rem">Voices unavailable. <button type="button" class="btn btn-ghost btn-sm" onclick="loadVoices()">Retry</button></div>'
    fvPopulateVoices()
  }
}

window.selectVoice = (id, preview, name) => {
  selectedVoiceId = id
  selectedVoicePreview = preview
  document.querySelectorAll('.voice-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id))
  if (preview) {
    document.getElementById('voice-preview-audio').src = preview
    document.getElementById('voice-preview-row').style.display = ''
  }
}

// ── FACELESS VIDEO GENERATOR (Phase 1–2) ─────────────────────────────────────
const FV_DURATIONS = {
  shorts: [
    { id: 'shorts_30', label: '30s', seconds: 30 },
    { id: 'shorts_45', label: '45s', seconds: 45 },
    { id: 'shorts_60', label: '60s', seconds: 60 },
  ],
  long: [
    { id: 'long_180', label: '3 min', seconds: 180 },
    { id: 'long_300', label: '5 min', seconds: 300 },
    { id: 'long_600', label: '10 min', seconds: 600 },
    { id: 'long_900', label: '15 min', seconds: 900 },
    { id: 'long_1200', label: '20 min', seconds: 1200 },
    { id: 'long_1800', label: '30 min', seconds: 1800 },
  ],
}

window.fvState = {
  format: 'long',
  durationId: 'long_180',
  aspect: '9:16',
  voiceId: null,
  voicePreview: null,
  script: null,
  media: null,
  mediaJobId: null,
  mediaPoll: null,
  preview: null,
  renderJobId: null,
  renderPoll: null,
  renderUrl: null,
  phase: 1,
  inited: false,
}

function fvSetScriptActionsVisible(show) {
  document.getElementById('fv-script-actions')?.classList.toggle('show', !!show)
  const help = document.getElementById('fv-help')
  if (help) help.style.display = show ? '' : 'none'
}

/** Wipe the generated script UI and return to the Generate Script form. */
window.fvClearScript = () => {
  try { if (fvState.mediaPoll) clearInterval(fvState.mediaPoll) } catch (_) {}
  try { if (fvState.renderPoll) clearInterval(fvState.renderPoll) } catch (_) {}
  fvState.script = null
  fvState.media = null
  fvState.mediaJobId = null
  fvState.mediaPoll = null
  fvState.preview = null
  fvState.renderJobId = null
  fvState.renderPoll = null
  fvState.renderUrl = null
  fvState.phase = 1

  const box = document.getElementById('fv-script-box')
  if (box) box.classList.remove('show')
  document.getElementById('fv-media-box')?.classList.remove('show')
  document.getElementById('fv-preview-box')?.classList.remove('show')
  document.getElementById('fv-export-box')?.classList.remove('show')
  document.getElementById('fv-setup')?.classList.remove('collapsed')

  const title = document.getElementById('fv-script-title')
  if (title) title.textContent = ''
  const meta = document.getElementById('fv-script-meta')
  if (meta) meta.innerHTML = ''
  const sections = document.getElementById('fv-sections')
  if (sections) sections.innerHTML = ''

  fvSetScriptActionsVisible(false)
  fvSetStatus('', null)
  fvSetStatus('', null, 2)
  fvSetPills(1)

  try { sessionStorage.removeItem('vidso_faceless_draft') } catch (_) {}
  try { sessionStorage.removeItem('vidso_faceless_media') } catch (_) {}
  try { sessionStorage.removeItem('vidso_faceless_preview') } catch (_) {}

  document.getElementById('fv-topic')?.focus?.()
}

function fvSetStatus(msg, kind, which) {
  const el = document.getElementById(which === 2 ? 'fv-status-2' : 'fv-status')
  if (!el) return
  if (!msg) { el.style.display = 'none'; return }
  el.style.display = 'flex'
  el.className = 'status' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '')
  el.innerHTML = kind === 'loading'
    ? `<span class="spinner"></span> ${msg}`
    : msg
}

function fvSetPills(active) {
  for (let i = 1; i <= 4; i++) {
    const p = document.getElementById('fv-pill-' + i)
    if (!p) continue
    p.classList.toggle('active', i === active)
    p.classList.toggle('done', i < active)
  }
}

function fvRenderDurationChips() {
  const row = document.getElementById('fv-duration-chips')
  if (!row) return
  const list = FV_DURATIONS[fvState.format] || FV_DURATIONS.shorts
  if (!list.some(d => d.id === fvState.durationId)) {
    fvState.durationId = list[list.length - 1].id
  }
  row.innerHTML = list.map(d =>
    `<button type="button" class="fv-chip${d.id === fvState.durationId ? ' active' : ''}" data-dur="${d.id}" onclick="fvSetDuration('${d.id}')">${d.label}</button>`
  ).join('')
}

window.fvSetFormat = (format) => {
  fvState.format = format === 'long' ? 'long' : 'shorts'
  document.querySelectorAll('#fv-format-seg .fv-seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === fvState.format)
  })
  fvState.durationId = FV_DURATIONS[fvState.format][fvState.format === 'shorts' ? 2 : 0].id
  fvRenderDurationChips()
}

window.fvSetDuration = (id) => {
  fvState.durationId = id
  fvRenderDurationChips()
}

window.fvSetAspect = (aspect) => {
  fvState.aspect = aspect === '16:9' ? '16:9' : '9:16'
  document.querySelectorAll('#fv-aspect-chips .fv-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.aspect === fvState.aspect)
  })
}

function fvPopulateVoices() {
  const sel = document.getElementById('fv-voice')
  if (!sel) return
  const btn = document.getElementById('fv-voice-preview-btn')
  const skel = document.getElementById('fv-voice-skel')
  const errBox = document.getElementById('fv-voice-error')
  const show = (mode) => {
    if (skel) skel.hidden = mode !== 'loading'
    if (errBox) errBox.hidden = mode !== 'error'
    sel.hidden = mode !== 'ready' && mode !== 'empty'
  }
  if (voicesLoadState === 'loading' || voicesLoadState === 'idle') {
    sel.innerHTML = '<option value="">Loading voices…</option>'
    sel.disabled = true
    if (btn) btn.disabled = true
    show('loading')
    return
  }
  if (voicesLoadState === 'error') {
    sel.innerHTML = '<option value="">Voices unavailable</option>'
    sel.disabled = true
    if (btn) btn.disabled = true
    show('error')
    return
  }
  if (!voices.length) {
    sel.innerHTML = '<option value="">No voices returned</option>'
    sel.disabled = true
    if (btn) btn.disabled = true
    show('empty')
    return
  }
  show('ready')
  sel.disabled = false
  const prev = fvState.voiceId || selectedVoiceId || voices[0].id
  sel.innerHTML = voices.map(v => {
    const label = v.name.split(' - ')[0]
    const cat = v.name.includes(' - ') ? v.name.split(' - ')[1].split(',')[0] : (v.category || '')
    return `<option value="${v.id}" data-preview="${v.preview_url || ''}">${label}${cat ? ' · ' + cat : ''}</option>`
  }).join('')
  sel.value = voices.some(v => v.id === prev) ? prev : voices[0].id
  fvOnVoiceChange()
}

window.fvOnVoiceChange = () => {
  const sel = document.getElementById('fv-voice')
  if (!sel) return
  const opt = sel.options[sel.selectedIndex]
  fvState.voiceId = sel.value || null
  fvState.voicePreview = opt?.dataset?.preview || null
  const btn = document.getElementById('fv-voice-preview-btn')
  if (btn) btn.disabled = !fvState.voicePreview
  const box = document.getElementById('fv-voice-preview')
  if (box) box.classList.remove('show')
  const audio = document.getElementById('fv-voice-audio')
  if (audio) { audio.pause(); audio.removeAttribute('src') }
}

window.fvPreviewVoice = () => {
  if (!fvState.voicePreview) return
  const box = document.getElementById('fv-voice-preview')
  const audio = document.getElementById('fv-voice-audio')
  box.classList.add('show')
  audio.src = fvState.voicePreview
  audio.play().catch(() => {})
}

window.fvInit = () => {
  fvRenderDurationChips()
  if (voices.length) fvPopulateVoices()
  else loadVoices().then(() => fvPopulateVoices())
  fvState.inited = true
}

function fvRebuildFullScriptFromSections() {
  if (!fvState.script) return
  const areas = document.querySelectorAll('#fv-sections textarea[data-sid]')
  const map = {}
  areas.forEach(t => { map[t.dataset.sid] = t.value.trim() })
  fvState.script.sections = (fvState.script.sections || []).map(s => ({
    ...s,
    text: map[s.id] != null ? map[s.id] : s.text,
  }))
  fvState.script.full_script = fvState.script.sections.map(s => s.text).filter(Boolean).join('\n\n')
  if (fvState.script.sections[0]) fvState.script.hook = fvState.script.sections[0].text
  try { sessionStorage.setItem('vidso_faceless_draft', JSON.stringify(fvState.script)) } catch {}
}
window.fvRebuildFullScriptFromSections = fvRebuildFullScriptFromSections

window.fvEditSectionManually = (sid) => {
  const card = document.getElementById('fv-sec-' + sid)
  if (!card) return
  card.classList.add('editing')
  const ta = card.querySelector(`textarea[data-sid="${sid}"]`)
  if (ta) ta.focus()
}

window.fvFinishSectionEdit = (sid) => {
  fvRebuildFullScriptFromSections()
  const card = document.getElementById('fv-sec-' + sid)
  const sec = fvState.script?.sections?.find(s => s.id === sid)
  const preview = card?.querySelector('.fv-section-preview')
  if (preview && sec) preview.textContent = sec.text || ''
  card?.classList.remove('editing')
}

function fvEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')
}

function fvRenderScript(script) {
  fvState.script = script
  fvState.phase = 1
  const box = document.getElementById('fv-script-box')
  box.classList.add('show')
  document.getElementById('fv-setup')?.classList.remove('collapsed')
  fvSetPills(1)
  document.getElementById('fv-script-title').textContent = script.title || 'Untitled'
  const dur = script.estimated_duration_sec || 0
  const durLabel = dur >= 120 ? `${Math.round(dur / 60)} min` : `${dur}s`
  document.getElementById('fv-script-meta').innerHTML =
    `<span><b>${durLabel}</b> target</span>` +
    `<span><b>${script.aspect || fvState.aspect}</b></span>` +
    `<span><b>${(script.sections || []).length}</b> sections</span>` +
    (script.keywords?.length ? `<span>B-roll: <b>${fvEsc(script.keywords.slice(0, 4).join(', '))}</b></span>` : '')

  const wrap = document.getElementById('fv-sections')
  wrap.innerHTML = (script.sections || []).map(s => `
    <div class="fv-section" id="fv-sec-${fvEsc(s.id)}">
      <div class="fv-section-head">
        <label>${fvEsc(s.heading || s.id)}</label>
        <div class="fv-section-actions">
          <button type="button" class="fv-regen-btn" onclick="fvEditSectionManually('${fvEsc(s.id)}')">Edit manually</button>
          <button type="button" class="fv-regen-btn" onclick="fvRegenerateSection('${fvEsc(s.id)}')">↻ Regenerate</button>
        </div>
      </div>
      <div class="fv-section-preview">${fvEsc(s.text || '')}</div>
      <textarea data-sid="${fvEsc(s.id)}" oninput="fvRebuildFullScriptFromSections()" onblur="fvFinishSectionEdit('${fvEsc(s.id)}')">${fvEsc(s.text || '')}</textarea>
    </div>`).join('') || '<p style="color:var(--muted);font-size:.85rem">Generate a script to see sections here.</p>'

  const help = document.getElementById('fv-help')
  if (help) help.textContent = 'Use Edit manually on any section, or Regenerate with AI. Then continue to media.'
  fvSetScriptActionsVisible(!!((script.sections || []).length || script.full_script))
}

window.fvEnterEditor = () => {
  if (!fvState.script) return fvSetStatus('Generate a script first', 'err')
  fvRebuildFullScriptFromSections()
  fvState.phase = 1
  fvRenderScript(fvState.script)
  fvSetStatus('', null)
  fvSetStatus('Edit any section, then continue to media', 'ok', 2)
  try { sessionStorage.setItem('vidso_faceless_draft', JSON.stringify(fvState.script)) } catch {}
}

window.fvContinueToMedia = () => {
  fvRebuildFullScriptFromSections()
  if (!fvState.script?.full_script) return fvSetStatus('Script is empty', 'err', 2)
  if (!fvState.voiceId && !fvState.script.voice_id) return fvSetStatus('Select a narrator voice', 'err', 2)
  try { sessionStorage.setItem('vidso_faceless_draft', JSON.stringify(fvState.script)) } catch {}
  fvState.phase = 2
  document.getElementById('fv-setup')?.classList.add('collapsed')
  document.getElementById('fv-script-box')?.classList.remove('show')
  const mediaBox = document.getElementById('fv-media-box')
  mediaBox.classList.add('show')
  fvSetPills(2)
  fvStartMedia(false)
}

window.fvBackToEditor = () => {
  if (fvState.mediaPoll) { clearInterval(fvState.mediaPoll); fvState.mediaPoll = null }
  fvPausePreview()
  fvState.phase = 1
  document.getElementById('fv-media-box')?.classList.remove('show')
  document.getElementById('fv-preview-box')?.classList.remove('show')
  document.getElementById('fv-setup')?.classList.remove('collapsed')
  document.getElementById('fv-script-box')?.classList.add('show')
  fvSetPills(1)
  if (fvState.script) fvRenderScript(fvState.script)
}

function fvSetMediaStatus(msg, kind) {
  const el = document.getElementById('fv-media-status')
  if (!el) return
  el.style.display = 'flex'
  el.className = 'status' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '')
  el.innerHTML = kind === 'loading'
    ? `<span class="spinner"></span> ${msg}`
    : msg
}

function fvRenderMediaResult(job) {
  fvState.media = job
  document.getElementById('fv-media-progress-wrap').style.display = 'none'
  document.getElementById('fv-media-result').style.display = ''
  document.getElementById('fv-media-title').textContent = fvState.script?.title || 'Media ready'
  const dur = job.duration || 0
  const durLabel = dur >= 120 ? `${(dur / 60).toFixed(1)} min` : `${Math.round(dur)}s`
  document.getElementById('fv-media-meta').innerHTML =
    `<span><b>${durLabel}</b> voiceover</span>` +
    `<span><b>${(job.words || []).length}</b> words timed</span>` +
    `<span><b>${(job.clips || []).length}</b> B-roll clips</span>` +
    (job.warning ? `<span style="color:#f0c674">${fvEsc(job.warning)}</span>` : '')

  const audio = document.getElementById('fv-media-audio')
  audio.src = job.voiceover_url || ''
  audio.onplay = () => fvSyncWordHighlight(audio)
  audio.ontimeupdate = () => fvSyncWordHighlight(audio)

  const wordsEl = document.getElementById('fv-media-words')
  wordsEl.innerHTML = (job.words || []).map((w, i) =>
    `<span class="fv-word" data-i="${i}" data-start="${w.start}" data-end="${w.end}">${fvEsc(w.text)}</span>`
  ).join('') || '<span style="color:var(--muted);font-size:.78rem">No word timings returned</span>'

  const portrait = (job.aspect || fvState.aspect) !== '16:9'
  const clipsEl = document.getElementById('fv-media-clips')
  clipsEl.innerHTML = (job.clips || []).length
    ? job.clips.map(c => `
      <div class="fv-clip-card${portrait ? '' : ' landscape'}">
        ${c.preview ? `<img src="${fvEsc(c.preview)}" alt="" loading="lazy">` : `<video src="${fvEsc(c.url)}" muted playsinline></video>`}
        <div class="tag">${fvEsc(c.query || 'clip')}</div>
      </div>`).join('')
    : '<div style="color:var(--muted);font-size:.78rem;grid-column:1/-1">No B-roll yet. Add a Pexels API key on the backend, or re-run after richer keywords.</div>'

  const tl = document.getElementById('fv-media-timeline')
  const total = job.duration || 1
  tl.innerHTML = (job.timeline || []).map(seg => {
    const pct = Math.max(2, ((seg.end - seg.start) / total) * 100)
    return `<i style="width:${pct}%" title="${fvEsc(seg.query || '')} ${seg.start.toFixed(1)}s–${seg.end.toFixed(1)}s"></i>`
  }).join('') || '<i style="width:100%;opacity:.25"></i>'

  try {
    sessionStorage.setItem('vidso_faceless_media', JSON.stringify({
      jobId: job.jobId,
      voiceover_url: job.voiceover_url,
      duration: job.duration,
      words: job.words,
      clips: job.clips,
      timeline: job.timeline,
      aspect: job.aspect,
      voice_id: job.voice_id,
    }))
  } catch {}
}

function fvSyncWordHighlight(audio) {
  const t = audio.currentTime || 0
  document.querySelectorAll('#fv-media-words .fv-word').forEach(el => {
    const s = parseFloat(el.dataset.start)
    const e = parseFloat(el.dataset.end)
    el.classList.toggle('on', t >= s && t < e)
  })
}

window.fvStartMedia = async (force) => {
  if (!fvState.script) return
  fvRebuildFullScriptFromSections()
  if (fvState.mediaPoll) { clearInterval(fvState.mediaPoll); fvState.mediaPoll = null }

  document.getElementById('fv-media-progress-wrap').style.display = ''
  document.getElementById('fv-media-result').style.display = 'none'
  document.getElementById('fv-media-bar').style.width = '5%'
  fvSetMediaStatus('Queuing voiceover + B-roll…', 'loading')

  const voiceId = fvState.voiceId || fvState.script.voice_id
  try {
    const { jobId } = await api.faceless.startMedia({
      script: {
        title: fvState.script.title,
        topic: fvState.script.topic || (document.getElementById('fv-topic')?.value || '').trim(),
        full_script: fvState.script.full_script,
        keywords: fvState.script.keywords || [],
        sections: fvState.script.sections || [],
        aspect: fvState.script.aspect || fvState.aspect,
        voice_id: voiceId,
      },
      voice_id: voiceId,
      aspect: fvState.script.aspect || fvState.aspect,
    })
    fvState.mediaJobId = jobId
    fvState.mediaPoll = setInterval(async () => {
      try {
        const job = await api.faceless.pollMedia(jobId)
        document.getElementById('fv-media-bar').style.width = Math.max(5, job.progress || 0) + '%'
        if (job.status === 'processing' || job.status === 'queued') {
          fvSetMediaStatus(job.step || 'Processing…', 'loading')
          return
        }
        clearInterval(fvState.mediaPoll)
        fvState.mediaPoll = null
        if (job.status === 'error') {
          fvSetMediaStatus(job.error || 'Media failed', 'err')
          return
        }
        fvSetMediaStatus('Ready', 'ok')
        fvRenderMediaResult(job)
      } catch (e) {
        clearInterval(fvState.mediaPoll)
        fvState.mediaPoll = null
        fvSetMediaStatus(e.message || 'Poll failed', 'err')
      }
    }, 1200)
  } catch (e) {
    fvSetMediaStatus(e.message || 'Could not start media job', 'err')
  }
}

window.fvContinueToPreview = () => {
  if (!fvState.media?.voiceover_url) return fvSetMediaStatus('Wait for media to finish', 'err')
  fvPausePreview()
  fvState.phase = 3
  document.getElementById('fv-media-box')?.classList.remove('show')
  document.getElementById('fv-preview-box')?.classList.add('show')
  fvSetPills(3)
  fvInitPreview()
}

window.fvBackToMedia = () => {
  fvPausePreview()
  fvState.phase = 2
  document.getElementById('fv-preview-box')?.classList.remove('show')
  document.getElementById('fv-media-box')?.classList.add('show')
  fvSetPills(2)
}

const FV_MUSIC = [
  { id: 'none', name: 'No music', url: '' },
  { id: 'pulse', name: 'Pulse Drive', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'groove', name: 'Night Groove', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'energy', name: 'High Energy', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'chill', name: 'Chill Wave', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'cinematic', name: 'Cinematic Rise', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' },
  { id: 'algorithms', name: 'Algorithms', url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Chad_Crouch/Arps/Chad_Crouch_-_Algorithms.mp3' },
]

function fvFmtTime(s) {
  s = Math.max(0, Math.floor(s || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function fvCapStyle() {
  return {
    font: document.getElementById('fv-cap-font')?.value || 'Bangers, cursive',
    size: parseInt(document.getElementById('fv-cap-size')?.value || '42', 10),
    color: document.getElementById('fv-cap-color')?.value || '#ffffff',
    highlight: document.getElementById('fv-cap-hl')?.value || '#ff3b4a',
    letterSpacing: parseFloat(document.getElementById('fv-cap-ls')?.value || '0'),
  }
}

window.fvApplyCapStyle = () => {
  const cap = document.getElementById('fv-prev-cap')
  if (!cap) return
  const s = fvCapStyle()
  cap.style.fontFamily = s.font
  cap.style.fontSize = s.size + 'px'
  cap.style.color = s.color
  cap.style.letterSpacing = s.letterSpacing + 'px'
  cap.style.textShadow = '0 2px 8px rgba(0,0,0,.85), 0 0 2px #000'
  cap.querySelectorAll('span.on').forEach(el => {
    el.style.color = s.highlight
    el.style.background = 'transparent'
  })
  fvPersistPreviewSettings()
}

function fvPersistPreviewSettings() {
  try {
    sessionStorage.setItem('vidso_faceless_preview', JSON.stringify({
      caption: fvCapStyle(),
      musicId: fvState.preview?.musicId || 'none',
      musicVol: fvState.preview?.musicVol ?? 0.25,
    }))
  } catch {}
}

function fvMusicEl() {
  return document.getElementById('fv-prev-music')
}

function fvMusicTrackSrc() {
  return (fvMusicEl()?.getAttribute('src') || '').trim()
}

function fvSyncMusicToVoice() {
  const voice = document.getElementById('fv-prev-voice')
  const music = fvMusicEl()
  if (!fvMusicTrackSrc() || !voice || !music) return
  const t = voice.currentTime || 0
  const md = music.duration
  if (Number.isFinite(md) && md > 0) music.currentTime = t % md
  else music.currentTime = 0
}

function fvRenderMusicList() {
  const list = document.getElementById('fv-music-list')
  if (!list) return
  const active = fvState.preview?.musicId || 'none'
  list.innerHTML = FV_MUSIC.map(m => `
    <button type="button" class="fv-music-item${m.id === active ? ' active' : ''}" onclick="fvSelectMusic('${m.id}')">
      <span>${m.id === 'none' ? '∅' : '♪'}</span>
      <span style="flex:1;text-align:left">${fvEsc(m.name)}</span>
      ${m.url ? `<span class="fv-music-preview-btn" onclick="event.stopPropagation();fvAuditionMusic('${m.id}')">Hear</span>` : ''}
    </button>`).join('')
}

window.fvAuditionMusic = (id) => {
  const track = FV_MUSIC.find(m => m.id === id)
  if (!track?.url) return
  if (!fvState.preview) fvState.preview = {}
  // Select the track, then play a short audition even if main preview is paused
  fvSelectMusic(id)
  const music = fvMusicEl()
  if (!music) return
  music.volume = fvState.preview.musicVol ?? 0.25
  music.currentTime = 0
  music.play().catch(() => {})
  // If full preview isn't running, stop audition after a few seconds so it doesn't loop forever
  if (!fvState.preview.playing) {
    clearTimeout(fvState.preview._auditionTimer)
    fvState.preview._auditionTimer = setTimeout(() => {
      if (!fvState.preview?.playing) music.pause()
    }, 6000)
  }
}

window.fvSelectMusic = (id) => {
  const track = FV_MUSIC.find(m => m.id === id) || FV_MUSIC[0]
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.musicId = track.id
  const music = fvMusicEl()
  if (!music) return
  clearTimeout(fvState.preview._auditionTimer)
  if (!track.url) {
    music.pause()
    music.removeAttribute('src')
    music.load()
  } else {
    const needLoad = music.getAttribute('src') !== track.url
    if (needLoad) {
      music.src = track.url
      music.load()
    }
    music.volume = fvState.preview.musicVol ?? 0.25
    music.loop = true
    if (fvState.preview.playing) {
      const start = () => {
        fvSyncMusicToVoice()
        music.play().catch(() => {})
      }
      if (needLoad) music.oncanplay = () => { music.oncanplay = null; start() }
      else start()
    }
  }
  fvRenderMusicList()
  fvRenderPreviewTimeline()
  fvPersistPreviewSettings()
}

window.fvSetMusicVol = (v) => {
  document.getElementById('fv-music-vol-val').textContent = v
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.musicVol = Number(v) / 100
  const music = fvMusicEl()
  if (music) music.volume = fvState.preview.musicVol
  fvPersistPreviewSettings()
}

function fvRenderPreviewTimeline() {
  const wrap = document.getElementById('fv-prev-tracks')
  if (!wrap || !fvState.media) return
  const dur = fvState.media.duration || 1
  const segs = (fvState.media.timeline || []).map(seg => {
    const left = (seg.start / dur) * 100
    const width = Math.max(1, ((seg.end - seg.start) / dur) * 100)
    return `<div class="seg" style="left:${left}%;width:${width}%" title="${fvEsc(seg.query || 'clip')}"></div>`
  }).join('')
  const hasMusic = fvState.preview?.musicId && fvState.preview.musicId !== 'none'
  wrap.innerHTML = `
    <div class="fv-track"><span>B-roll</span><div class="fv-track-bar" id="fv-tl-video">${segs}<div class="playhead" id="fv-tl-ph-v" style="left:0"></div></div></div>
    <div class="fv-track"><span>Voice</span><div class="fv-track-bar"><div class="seg audio" style="left:0;width:100%"></div><div class="playhead" id="fv-tl-ph-a" style="left:0"></div></div></div>
    <div class="fv-track"><span>Music</span><div class="fv-track-bar">${hasMusic ? '<div class="seg music" style="left:0;width:100%"></div>' : ''}<div class="playhead" id="fv-tl-ph-m" style="left:0"></div></div></div>`
}

function fvActiveClipAt(t) {
  const tl = fvState.media?.timeline || []
  return tl.find(s => t >= s.start && t < s.end) || tl[0] || null
}

function fvEnsureClip(t) {
  const video = document.getElementById('fv-prev-video')
  const clip = fvActiveClipAt(t)
  if (!clip || !video) return
  if (fvState.preview?.clipUrl !== clip.url) {
    fvState.preview.clipUrl = clip.url
    const wasPlaying = fvState.preview.playing
    video.src = clip.url
    video.currentTime = Math.max(0, t - clip.start)
    if (wasPlaying) video.play().catch(() => {})
  } else if (Math.abs((video.currentTime || 0) - Math.max(0, t - clip.start)) > 0.45) {
    video.currentTime = Math.max(0, t - clip.start)
  }
}

function fvUpdateCaptions(t) {
  const words = fvState.media?.words || []
  if (!words.length) {
    document.getElementById('fv-prev-cap').innerHTML = ''
    return
  }
  let idx = words.findIndex(w => t >= w.start && t < w.end)
  if (idx < 0) {
    // nearest upcoming / last spoken
    idx = words.findIndex(w => w.start > t)
    if (idx < 0) idx = words.length - 1
    else idx = Math.max(0, idx - 1)
  }
  const start = Math.max(0, idx - 1)
  const end = Math.min(words.length, idx + 3)
  const slice = words.slice(start, end)
  const style = fvCapStyle()
  document.getElementById('fv-prev-cap').innerHTML = slice.map((w, i) => {
    const global = start + i
    const on = global === idx && t >= words[idx].start && t < words[idx].end
    return `<span class="${on ? 'on' : ''}" style="${on ? 'color:' + style.highlight : ''}">${fvEsc(w.text)}</span>`
  }).join(' ')
  fvApplyCapStyle()
}

function fvTickPreview() {
  const voice = document.getElementById('fv-prev-voice')
  if (!voice) return
  const t = voice.currentTime || 0
  const dur = fvState.media?.duration || voice.duration || 1
  document.getElementById('fv-prev-seek').value = String(Math.round((t / dur) * 1000))
  document.getElementById('fv-prev-time').textContent = `${fvFmtTime(t)} / ${fvFmtTime(dur)}`
  const pct = (t / dur) * 100 + '%'
  ;['fv-tl-ph-v', 'fv-tl-ph-a', 'fv-tl-ph-m'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.left = pct
  })
  fvEnsureClip(t)
  fvUpdateCaptions(t)
  if (voice.ended) fvPausePreview()
}

window.fvTogglePreview = () => {
  if (fvState.preview?.playing) fvPausePreview()
  else fvPlayPreview()
}

window.fvPlayPreview = () => {
  const voice = document.getElementById('fv-prev-voice')
  const music = fvMusicEl()
  const video = document.getElementById('fv-prev-video')
  if (!voice?.src) return
  if (!fvState.preview) fvState.preview = {}
  clearTimeout(fvState.preview._auditionTimer)
  fvState.preview.playing = true
  document.getElementById('fv-prev-play').textContent = '⏸ Pause'
  fvEnsureClip(voice.currentTime || 0)
  voice.play().catch(() => {})
  video?.play().catch(() => {})
  if (fvMusicTrackSrc() && music) {
    music.volume = fvState.preview.musicVol ?? 0.25
    music.loop = true
    const startMusic = () => {
      fvSyncMusicToVoice()
      music.play().catch(() => {})
    }
    if (music.readyState >= 2) startMusic()
    else {
      music.oncanplay = () => { music.oncanplay = null; startMusic() }
      music.load()
    }
  }
  if (fvState.preview.raf) cancelAnimationFrame(fvState.preview.raf)
  const loop = () => {
    fvTickPreview()
    if (fvState.preview.playing) fvState.preview.raf = requestAnimationFrame(loop)
  }
  fvState.preview.raf = requestAnimationFrame(loop)
}

window.fvPausePreview = () => {
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.playing = false
  document.getElementById('fv-prev-play') && (document.getElementById('fv-prev-play').textContent = '▶ Play')
  document.getElementById('fv-prev-voice')?.pause()
  document.getElementById('fv-prev-music')?.pause()
  document.getElementById('fv-prev-video')?.pause()
  if (fvState.preview.raf) { cancelAnimationFrame(fvState.preview.raf); fvState.preview.raf = null }
}

window.fvSeekPreview = (v) => {
  const voice = document.getElementById('fv-prev-voice')
  const dur = fvState.media?.duration || voice?.duration || 1
  const t = (Number(v) / 1000) * dur
  if (voice) voice.currentTime = t
  if (fvMusicTrackSrc()) fvSyncMusicToVoice()
  fvState.preview && (fvState.preview.clipUrl = null)
  fvEnsureClip(t)
  fvUpdateCaptions(t)
  fvTickPreview()
}

function fvPersistMedia() {
  if (!fvState.media) return
  try {
    sessionStorage.setItem('vidso_faceless_media', JSON.stringify({
      jobId: fvState.media.jobId,
      voiceover_url: fvState.media.voiceover_url,
      duration: fvState.media.duration,
      words: fvState.media.words,
      clips: fvState.media.clips,
      timeline: fvState.media.timeline,
      aspect: fvState.media.aspect,
      voice_id: fvState.media.voice_id,
    }))
  } catch {}
}

window.fvSideTab = (pane) => {
  document.querySelectorAll('.fv-side-tab').forEach(b => b.classList.toggle('active', b.dataset.pane === pane))
  document.querySelectorAll('.fv-side-pane').forEach(p => p.classList.toggle('active', p.id === 'fv-pane-' + pane))
}

function fvSetBrollStatus(msg, kind) {
  const el = document.getElementById('fv-broll-status')
  if (!el) return
  if (!msg) { el.style.display = 'none'; return }
  el.style.display = 'flex'
  el.className = 'status' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '')
  el.innerHTML = kind === 'loading' ? `<span class="spinner"></span> ${msg}` : msg
}

function fvNormalizeTimelineTimes() {
  if (!fvState.media?.timeline?.length) return
  const dur = fvState.media.duration || 1
  const n = fvState.media.timeline.length
  const slice = dur / n
  fvState.media.timeline = fvState.media.timeline.map((seg, i) => ({
    ...seg,
    start: Number((i * slice).toFixed(3)),
    end: Number((i === n - 1 ? dur : (i + 1) * slice).toFixed(3)),
  }))
}

function fvRenderBrollEditor() {
  const list = document.getElementById('fv-seg-list')
  if (!list || !fvState.media) return
  const landscape = (fvState.media.aspect || fvState.aspect) === '16:9'
  const tl = fvState.media.timeline || []
  const sel = fvState.preview?.segIdx ?? 0
  list.innerHTML = tl.map((seg, i) => `
    <div class="fv-seg-row${i === sel ? ' active' : ''}" onclick="fvSelectSeg(${i})">
      <div class="fv-seg-thumb${landscape ? ' landscape' : ''}">
        ${seg.preview ? `<img src="${fvEsc(seg.preview)}" alt="">` : (seg.url ? `<video src="${fvEsc(seg.url)}" muted></video>` : '')}
      </div>
      <div class="fv-seg-info">
        <div class="t">${fvEsc(seg.query || seg.photographer || 'Clip ' + (i + 1))}</div>
        <div class="s">${fvFmtTime(seg.start)} – ${fvFmtTime(seg.end)} · ${Math.max(0.1, (seg.end - seg.start)).toFixed(1)}s</div>
      </div>
      <div class="fv-seg-actions" onclick="event.stopPropagation()">
        <button type="button" class="replace" title="Replace this clip" onclick="fvReplaceSeg(${i})">Replace</button>
        <button type="button" title="Move up" onclick="fvMoveSeg(${i},-1)">↑</button>
        <button type="button" title="Move down" onclick="fvMoveSeg(${i},1)">↓</button>
        <button type="button" title="Remove" onclick="fvRemoveSeg(${i})">✕</button>
      </div>
    </div>`).join('') || '<div style="color:var(--muted);font-size:.78rem">No clips yet. Search or upload below.</div>'

  fvRenderClipPicker()
  fvRenderPreviewTimeline()
  const pick = document.getElementById('fv-clip-pick')
  if (pick) pick.classList.toggle('replace-mode', !!fvState.preview?.replaceMode)
}

function fvRenderClipPicker(extraClips) {
  const pick = document.getElementById('fv-clip-pick')
  if (!pick) return
  const landscape = (fvState.media?.aspect || fvState.aspect) === '16:9'
  const pool = [
    ...(extraClips || fvState.preview?.searchClips || []),
    ...(fvState.media?.clips || []),
  ]
  // de-dupe by id/url
  const seen = new Set()
  const clips = []
  for (const c of pool) {
    const key = c.id || c.url
    if (!key || seen.has(key)) continue
    seen.add(key)
    clips.push(c)
  }
  fvState.preview = fvState.preview || {}
  fvState.preview.library = clips

  pick.innerHTML = clips.length
    ? clips.map((c, i) => `
      <button type="button" class="pick${landscape ? ' landscape' : ''}" title="${fvEsc(c.query || '')}" onclick="fvApplyLibraryClip(${i})">
        ${c.preview ? `<img src="${fvEsc(c.preview)}" alt="" loading="lazy">` : `<video src="${fvEsc(c.url)}" muted></video>`}
      </button>`).join('')
    : '<div style="grid-column:1/-1;color:var(--muted);font-size:.75rem">Search Pexels or upload a clip to fill the library.</div>'
}

window.fvSelectSeg = (i) => {
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.segIdx = i
  fvState.preview.replaceMode = false
  fvRenderBrollEditor()
  const seg = fvState.media?.timeline?.[i]
  if (seg) {
    const voice = document.getElementById('fv-prev-voice')
    if (voice) {
      voice.currentTime = seg.start
      fvState.preview.clipUrl = null
      fvEnsureClip(seg.start)
      fvUpdateCaptions(seg.start)
      fvTickPreview()
    }
  }
}

window.fvReplaceSeg = (i) => {
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.segIdx = i
  fvState.preview.replaceMode = true
  fvSideTab('broll')
  fvRenderBrollEditor()
  const pick = document.getElementById('fv-clip-pick')
  pick?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  document.getElementById('fv-broll-query')?.focus()
  fvSetBrollStatus('Replace mode: pick a library clip or search/upload a new one for segment ' + (i + 1), 'ok')
  const seg = fvState.media?.timeline?.[i]
  if (seg) {
    const voice = document.getElementById('fv-prev-voice')
    if (voice) {
      voice.currentTime = seg.start
      fvState.preview.clipUrl = null
      fvEnsureClip(seg.start)
      fvUpdateCaptions(seg.start)
      fvTickPreview()
    }
  }
}

window.fvMoveSeg = (i, dir) => {
  const tl = fvState.media?.timeline
  if (!tl) return
  const j = i + dir
  if (j < 0 || j >= tl.length) return
  const tmp = tl[i]; tl[i] = tl[j]; tl[j] = tmp
  fvNormalizeTimelineTimes()
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.segIdx = j
  fvState.preview.clipUrl = null
  fvPersistMedia()
  fvRenderBrollEditor()
}

window.fvRemoveSeg = (i) => {
  const tl = fvState.media?.timeline
  if (!tl || tl.length <= 1) return fvSetBrollStatus('Keep at least one clip', 'err')
  tl.splice(i, 1)
  fvNormalizeTimelineTimes()
  if (!fvState.preview) fvState.preview = {}
  fvState.preview.segIdx = Math.min(i, tl.length - 1)
  fvState.preview.clipUrl = null
  fvPersistMedia()
  fvRenderBrollEditor()
  fvSetBrollStatus('Segment removed', 'ok')
}

window.fvApplyLibraryClip = (libIdx) => {
  const clip = fvState.preview?.library?.[libIdx]
  const tl = fvState.media?.timeline
  if (!clip || !tl?.length) return
  const i = fvState.preview.segIdx ?? 0
  const prev = tl[i] || { start: 0, end: 3 }
  tl[i] = {
    ...prev,
    id: clip.id || ('custom-' + Date.now()),
    url: clip.url,
    preview: clip.preview || null,
    query: clip.query || clip.photographer || 'Custom',
    width: clip.width,
    height: clip.height,
    duration: clip.duration || 0,
    photographer: clip.photographer || null,
    pexels_url: clip.pexels_url || null,
  }
  // Also add to pool if new
  if (!fvState.media.clips) fvState.media.clips = []
  if (clip.id && !fvState.media.clips.some(c => c.id === clip.id)) fvState.media.clips.unshift(clip)
  fvState.preview.clipUrl = null
  fvState.preview.replaceMode = false
  fvPersistMedia()
  fvRenderBrollEditor()
  fvEnsureClip(tl[i].start)
  fvSetBrollStatus('Replaced segment ' + (i + 1), 'ok')
}

window.fvShuffleBroll = () => {
  const tl = fvState.media?.timeline
  const pool = fvState.media?.clips || []
  if (!tl?.length) return
  if (pool.length) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    tl.forEach((seg, i) => {
      const c = shuffled[i % shuffled.length]
      Object.assign(seg, {
        id: c.id, url: c.url, preview: c.preview, query: c.query,
        width: c.width, height: c.height, duration: c.duration,
        photographer: c.photographer, pexels_url: c.pexels_url,
      })
    })
  } else {
    for (let i = tl.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = tl[i]; tl[i] = tl[j]; tl[j] = t
    }
    fvNormalizeTimelineTimes()
  }
  fvState.preview.clipUrl = null
  fvPersistMedia()
  fvRenderBrollEditor()
  fvSetBrollStatus('B-roll shuffled', 'ok')
}

window.fvRedistributeBroll = () => {
  fvNormalizeTimelineTimes()
  fvState.preview.clipUrl = null
  fvPersistMedia()
  fvRenderBrollEditor()
  fvSetBrollStatus('Timing evened across clips', 'ok')
}

window.fvSearchBroll = async () => {
  const q = (document.getElementById('fv-broll-query')?.value || '').trim()
  if (!q) return fvSetBrollStatus('Enter a search term', 'err')
  fvSetBrollStatus('Searching Pexels…', 'loading')
  try {
    const data = await api.faceless.searchBroll({
      query: q,
      aspect: fvState.media?.aspect || fvState.aspect,
      per_page: 10,
    })
    if (!fvState.preview) fvState.preview = {}
    fvState.preview.searchClips = (data.clips || []).map(c => ({ ...c, query: q }))
    fvRenderClipPicker(fvState.preview.searchClips)
    fvSetBrollStatus((data.clips?.length || 0) + ' clips found. Click one to apply', 'ok')
  } catch (e) {
    fvSetBrollStatus(e.message || 'Search failed', 'err')
  }
}

window.fvUploadBroll = async (input) => {
  const file = input?.files?.[0]
  if (!file) return
  fvSetBrollStatus('Uploading…', 'loading')
  try {
    const fd = new FormData()
    fd.append('file', file)
    const data = await api.upload.file(fd)
    const url = data.url || data.file_url || data.publicUrl
    if (!url) throw new Error('Upload returned no URL')
    const clip = {
      id: 'upload-' + Date.now(),
      url,
      preview: null,
      query: file.name.replace(/\.[^.]+$/, ''),
      duration: 0,
    }
    if (!fvState.media.clips) fvState.media.clips = []
    fvState.media.clips.unshift(clip)
    if (!fvState.media.timeline?.length) {
      fvState.media.timeline = [{
        ...clip,
        start: 0,
        end: fvState.media.duration || 5,
        clip_start: 0,
      }]
    } else {
      // apply to selected segment
      const i = fvState.preview?.segIdx ?? 0
      const prev = fvState.media.timeline[i]
      fvState.media.timeline[i] = { ...prev, ...clip, start: prev.start, end: prev.end, clip_start: 0 }
    }
    fvState.preview.clipUrl = null
    fvState.preview.replaceMode = false
    input.value = ''
    fvPersistMedia()
    fvRenderBrollEditor()
    fvSetBrollStatus('Uploaded and applied', 'ok')
  } catch (e) {
    fvSetBrollStatus(e.message || 'Upload failed', 'err')
  }
}

function fvInitPreview() {
  const media = fvState.media
  if (!media) return
  fvState.preview = fvState.preview || { musicId: 'none', musicVol: 0.25, playing: false, clipUrl: null, segIdx: 0 }
  if (fvState.preview.segIdx == null) fvState.preview.segIdx = 0
  const landscape = (media.aspect || fvState.aspect) === '16:9'
  document.getElementById('fv-stage')?.classList.toggle('landscape', landscape)
  document.getElementById('fv-prev-title').textContent = fvState.script?.title || 'Preview'
  document.getElementById('fv-prev-meta').innerHTML =
    `<span><b>${fvFmtTime(media.duration)}</b></span>` +
    `<span><b>${landscape ? '16:9' : '9:16'}</b></span>` +
    `<span><b>${(media.words || []).length}</b> words</span>` +
    `<span><b>${(media.timeline || []).length}</b> clips</span>`

  const voice = document.getElementById('fv-prev-voice')
  voice.src = media.voiceover_url
  voice.onended = () => fvPausePreview()

  document.getElementById('fv-music-vol').value = String(Math.round((fvState.preview.musicVol ?? 0.25) * 100))
  document.getElementById('fv-music-vol-val').textContent = document.getElementById('fv-music-vol').value
  // Migrate removed Mixkit track ids to a working default
  const musicId = FV_MUSIC.some(m => m.id === fvState.preview.musicId)
    ? fvState.preview.musicId
    : 'none'
  fvState.preview.musicId = musicId
  fvRenderMusicList()
  fvSelectMusic(musicId)
  fvSideTab('broll')
  fvRenderBrollEditor()
  fvApplyCapStyle()
  fvSeekPreview(0)
}

window.fvContinueToExport = () => {
  if (!fvState.media?.voiceover_url) return
  fvPausePreview()
  fvPersistPreviewSettings()
  fvState.phase = 4
  document.getElementById('fv-preview-box')?.classList.remove('show')
  document.getElementById('fv-export-box')?.classList.add('show')
  fvSetPills(4)
  document.getElementById('fv-export-title').textContent = fvState.script?.title || 'Render final MP4'
  document.getElementById('fv-export-meta').innerHTML =
    `<span><b>${fvFmtTime(fvState.media.duration)}</b></span>` +
    `<span><b>${(fvState.media.aspect || fvState.aspect)}</b></span>` +
    `<span><b>${(fvState.media.timeline || []).length}</b> clips</span>`
  document.getElementById('fv-export-result').style.display = 'none'
  document.getElementById('fv-export-progress-wrap').style.display = ''
  document.getElementById('fv-export-actions').style.display = ''
  document.getElementById('fv-export-bar').style.width = '0%'
  fvSetExportStatus('Ready. Click Render video', null)
}

window.fvBackToPreview = () => {
  if (fvState.renderPoll) { clearInterval(fvState.renderPoll); fvState.renderPoll = null }
  fvState.phase = 3
  document.getElementById('fv-export-box')?.classList.remove('show')
  document.getElementById('fv-preview-box')?.classList.add('show')
  fvSetPills(3)
}

function fvSetExportStatus(msg, kind) {
  const el = document.getElementById('fv-export-status')
  if (!el) return
  el.style.display = 'flex'
  el.className = 'status' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '')
  el.innerHTML = kind === 'loading'
    ? `<span class="spinner"></span> ${msg}`
    : (msg || '')
}

window.fvStartExport = async () => {
  if (!fvState.media?.voiceover_url) return fvSetExportStatus('Missing voiceover', 'err')
  if (fvState.renderPoll) { clearInterval(fvState.renderPoll); fvState.renderPoll = null }

  const btn = document.getElementById('fv-export-btn')
  if (btn) btn.disabled = true
  document.getElementById('fv-export-result').style.display = 'none'
  document.getElementById('fv-export-progress-wrap').style.display = ''
  document.getElementById('fv-export-bar').style.width = '3%'
  fvSetExportStatus('Starting render…', 'loading')

  const musicTrack = FV_MUSIC.find(m => m.id === (fvState.preview?.musicId || 'none'))
  const caption = fvCapStyle()

  try {
    const { jobId } = await api.faceless.startRender({
      voiceover_url: fvState.media.voiceover_url,
      duration: fvState.media.duration,
      words: fvState.media.words || [],
      timeline: fvState.media.timeline || [],
      aspect: fvState.media.aspect || fvState.aspect,
      caption: {
        font: caption.font,
        size: caption.size,
        color: caption.color,
        highlight: caption.highlight,
        letterSpacing: caption.letterSpacing,
      },
      music: musicTrack?.url
        ? { url: musicTrack.url, volume: fvState.preview?.musicVol ?? 0.25 }
        : null,
    })
    fvState.renderJobId = jobId
    fvState.renderPoll = setInterval(async () => {
      try {
        const job = await api.faceless.pollRender(jobId)
        document.getElementById('fv-export-bar').style.width = Math.max(3, job.progress || 0) + '%'
        if (job.status === 'queued' || job.status === 'processing') {
          fvSetExportStatus(job.step || 'Rendering…', 'loading')
          return
        }
        clearInterval(fvState.renderPoll)
        fvState.renderPoll = null
        if (btn) btn.disabled = false
        if (job.status === 'error') {
          fvSetExportStatus(job.error || 'Render failed', 'err')
          return
        }
        fvSetExportStatus('Render complete', 'ok')
        document.getElementById('fv-export-bar').style.width = '100%'
        const url = await api.faceless.downloadRender(jobId)
        if (fvState.renderUrl) URL.revokeObjectURL(fvState.renderUrl)
        fvState.renderUrl = url
        const vid = document.getElementById('fv-export-video')
        vid.src = url
        const dl = document.getElementById('fv-export-dl')
        dl.href = url
        document.getElementById('fv-export-result').style.display = ''
        document.getElementById('fv-export-actions').style.display = 'none'
      } catch (e) {
        clearInterval(fvState.renderPoll)
        fvState.renderPoll = null
        if (btn) btn.disabled = false
        fvSetExportStatus(e.message || 'Poll failed', 'err')
      }
    }, 1500)
  } catch (e) {
    if (btn) btn.disabled = false
    if (e.needsPlan) fvSetExportStatus(e.message || 'Active plan required to export', 'err')
    else fvSetExportStatus(e.message || 'Could not start render', 'err')
  }
}

window.fvRegenerateSection = async (sectionId) => {
  if (!fvState.script) return
  fvRebuildFullScriptFromSections()
  const sec = (fvState.script.sections || []).find(s => s.id === sectionId)
  if (!sec) return
  const card = document.getElementById('fv-sec-' + sectionId)
  if (card) card.classList.add('busy')
  fvSetStatus('Rewriting section…', 'loading', 2)
  try {
    const topic = fvState.script.topic || (document.getElementById('fv-topic')?.value || '').trim()
    const data = await api.faceless.rewriteSection({
      topic,
      section_id: sec.id,
      heading: sec.heading,
      text: sec.text,
      full_script: fvState.script.full_script,
    })
    sec.text = data.text
    if (data.heading) sec.heading = data.heading
    fvRebuildFullScriptFromSections()
    fvRenderScript(fvState.script)
    fvSetStatus('Section updated', 'ok', 2)
  } catch (e) {
    fvSetStatus(e.message || 'Rewrite failed', 'err', 2)
  } finally {
    if (card) card.classList.remove('busy')
  }
}

window.fvGenerateScript = async () => {
  const topic = (document.getElementById('fv-topic')?.value || '').trim()
  if (!topic) return fvSetStatus('Enter a topic or prompt first', 'err')
  if (!fvState.voiceId) return fvSetStatus('Select a narrator voice', 'err')

  const btn = document.getElementById('fv-gen-script-btn')
  if (btn) btn.disabled = true
  fvSetStatus('', null)
  fvSetScriptActionsVisible(false)
  document.getElementById('fv-script-box')?.classList.add('show')
  fvSetStatus('Writing your script…', 'loading', 2)
  try {
    const data = await api.faceless.script({
      topic,
      duration_id: fvState.durationId,
      aspect: fvState.aspect,
    })
    data.voice_id = fvState.voiceId
    data.voice_preview = fvState.voicePreview
    data.duration_id = fvState.durationId
    data.topic = topic
    fvState.phase = 1
    fvRenderScript(data)
    fvSetStatus('Script ready', 'ok', 2)
    try { sessionStorage.setItem('vidso_faceless_draft', JSON.stringify(data)) } catch {}
  } catch (e) {
    fvSetStatus('', null)
    fvSetStatus(e.message || 'Script generation failed', 'err', 2)
    fvSetScriptActionsVisible(!!fvState.script)
    if (!fvState.script) document.getElementById('fv-script-box')?.classList.remove('show')
  } finally {
    if (btn) btn.disabled = false
  }
}

window.updateCharCount = () => {
  const l = document.getElementById('tts-text').value.length
  document.getElementById('char-count').textContent = `(${l}/5000)`
}

window.generateVoiceover = async () => {
  const text = document.getElementById('tts-text').value.trim()
  if (!text) return setStatus('tts-status','Please enter your script','err')
  if (!selectedVoiceId) return setStatus('tts-status','Please select a voice','err')
  const btn = document.getElementById('tts-btn')
  btn.disabled = true
  setStatus('tts-status','Generating voiceover...','loading')
  try {
    const data = await api.tts.generate({
      text,
      voice_id: selectedVoiceId,
      stability: parseFloat(document.getElementById('stab-range').value),
      speed:     parseFloat(document.getElementById('speed-range').value),
    })
    const res = document.getElementById('tts-result')
    document.getElementById('tts-audio').src = data.url
    document.getElementById('tts-dl').href   = data.url
    res.style.display = ''
    setStatus('tts-status','Done!','ok')
    loadUsage()
    loadVoiceLibrary()
  } catch(e) { setStatus('tts-status', e.message, 'err') }
  finally { btn.disabled = false }
}

// ── VOICE LIBRARY ───────────────────────────────────────────────────────────
async function loadVoiceLibrary() {
  const container = document.getElementById('voice-library')
  if (!container) return
  try {
    const items = await api.tts.library()
    if (!items.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px">No voiceovers yet. Generate one above!</div>'
      return
    }
    container.innerHTML = items.map(item => {
      const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const snippet = (item.text || '').length > 80 ? item.text.slice(0, 80) + '…' : (item.text || 'Untitled')
      return `<div class="result-box" style="padding:12px" data-lib-id="${item.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${snippet}</div>
            <div style="font-size:.68rem;color:var(--muted);margin-top:2px">${date}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <a href="${item.audio_url}" download="voiceover.mp3" class="btn btn-ghost btn-sm" style="font-size:.68rem;padding:4px 8px">⬇</a>
            <button class="btn btn-ghost btn-sm" style="font-size:.68rem;padding:4px 8px;color:var(--err)" onclick="deleteVoiceItem('${item.id}')">✕</button>
          </div>
        </div>
        <audio controls style="width:100%;height:32px" preload="none" src="${item.audio_url}"></audio>
      </div>`
    }).join('')
  } catch (e) {
    container.innerHTML = '<div style="color:var(--err);font-size:.8rem;padding:8px">Failed to load library</div>'
  }
}

window.deleteVoiceItem = async (id) => {
  try {
    await api.tts.deleteVo(id)
    const el = document.querySelector(`[data-lib-id="${id}"]`)
    if (el) el.remove()
    const container = document.getElementById('voice-library')
    if (container && !container.children.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px">No voiceovers yet. Generate one above!</div>'
    }
  } catch (e) {
    alert('Failed to delete voiceover')
  }
}

// ── CAPTIONS ─────────────────────────────────────────────────────────────────
const zone = document.getElementById('upload-zone')
zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag') })
zone?.addEventListener('dragleave', () => zone.classList.remove('drag'))
zone?.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('drag')
  const f = e.dataTransfer.files[0]
  if (f) handleCapFile(f)
})
document.getElementById('cap-file-input')?.addEventListener('change', e => {
  if (e.target.files[0]) handleCapFile(e.target.files[0])
})

async function handleCapFile(file) {
  setStatus('cap-status', `Uploading ${file.name}...`, 'loading')
  try {
    const fd = new FormData(); fd.append('file', file)
    const up = await api.upload.file(fd)
    document.getElementById('cap-url').value = up.url
    setStatus('cap-status', 'Uploaded. Click Transcribe', 'ok')
    loadFiles()
  } catch(e) { setStatus('cap-status', e.message, 'err') }
}

window.startTranscription = async () => {
  const url = document.getElementById('cap-url').value.trim()
  if (!url) return setStatus('cap-status','Enter a URL or upload a file','err')
  const btn = document.getElementById('cap-btn')
  btn.disabled = true
  document.getElementById('cap-result').style.display = 'none'
  setStatus('cap-status','Starting transcription...','loading')
  try {
    const data = await api.transcribe.start(url)
    captionJobId = data.job_id
    setStatus('cap-status','Processing...','loading')
    pollTranscription()
  } catch(e) { setStatus('cap-status', e.message, 'err'); btn.disabled = false }
}

function pollTranscription() {
  clearTimeout(captionPollTimer)
  captionPollTimer = setTimeout(async () => {
    try {
      const data = await api.transcribe.poll(captionJobId)
      if (data.status === 'completed') {
        document.getElementById('cap-text').value = data.text
        document.getElementById('cap-srt').value  = data.srt
        document.getElementById('cap-result').style.display = ''
        setStatus('cap-status','Transcription complete!','ok')
        document.getElementById('cap-btn').disabled = false
        loadUsage()
      } else if (data.status === 'error') {
        setStatus('cap-status','Transcription failed','err')
        document.getElementById('cap-btn').disabled = false
      } else {
        setStatus('cap-status','Processing...','loading')
        pollTranscription()
      }
    } catch(e) { setStatus('cap-status', e.message, 'err'); document.getElementById('cap-btn').disabled = false }
  }, 3000)
}

window.downloadSRT = () => {
  const srt  = document.getElementById('cap-srt').value
  const blob = new Blob([srt], { type:'text/plain' })
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download:'captions.srt' })
  a.click(); URL.revokeObjectURL(a.href)
}

let capStyle = 'karaoke'
let capCustom = null
window.setCapStyle = (s, btn) => {
  capStyle = s
  document.querySelectorAll('.cap-style-btn').forEach(b => b.classList.remove('active'))
  btn?.classList.add('active')
}

window.burnCaptions = async () => {
  const url = document.getElementById('cap-url').value.trim()
  if (!captionJobId || !url) return setStatus('cap-burn-status', 'Transcribe a video first', 'err')
  const btn = document.getElementById('cap-burn-btn')
  btn.disabled = true
  document.getElementById('cap-burn-result').style.display = 'none'
  setStatus('cap-burn-status', 'Burning captions… this can take a minute', 'loading')
  try {
    const blobUrl = await api.caption.burn(captionJobId, url, capStyle, undefined, capCustom)
    document.getElementById('cap-burn-video').src = blobUrl
    document.getElementById('cap-burn-dl').href = blobUrl
    document.getElementById('cap-burn-result').style.display = ''
    setStatus('cap-burn-status', 'Done!', 'ok')
    loadUsage()
  } catch (e) {
    setStatus('cap-burn-status', e.needsPlan ? e.message + '. Upgrade to continue' : e.message, 'err')
  } finally {
    btn.disabled = false
  }
}

// ── IMAGE GEN ─────────────────────────────────────────────────────────────────
window.fillImgPrompt = (text) => {
  const el = document.getElementById('img-prompt')
  if (el) el.value = text
}
window.setImgRatio = (ratio, btn) => {
  const sel = document.getElementById('img-ratio')
  if (sel) sel.value = ratio
  document.querySelectorAll('#img-ratio-seg .ui-seg-btn').forEach(b => b.classList.toggle('active', b === btn || b.dataset.ratio === ratio))
}
window.stepImgCount = (delta) => {
  const sel = document.getElementById('img-count')
  const label = document.getElementById('img-count-label')
  if (!sel) return
  const opts = Array.from(sel.options).map(o => parseInt(o.value, 10))
  let idx = opts.indexOf(parseInt(sel.value, 10))
  if (idx < 0) idx = 0
  idx = Math.max(0, Math.min(opts.length - 1, idx + delta))
  sel.value = String(opts[idx])
  if (label) label.textContent = opts[idx] === 1 ? '1 image' : `${opts[idx]} images`
}
window.generateImage = async () => {
  const prompt = document.getElementById('img-prompt').value.trim()
  if (!prompt) return setStatus('img-status','Enter a prompt','err')
  const btn = document.getElementById('img-btn')
  btn.disabled = true
  btn.classList.add('is-loading')
  setStatus('img-status','Generating...','loading')
  const count = parseInt(document.getElementById('img-count').value, 10) || 1
  document.getElementById('img-grid').innerHTML = `<div class="img-skel-grid">${Array.from({length:count}).map(()=>'<div class="ui-skeleton ui-skeleton-thumb"></div>').join('')}</div>`
  try {
    const data = await api.generate.image({
      prompt,
      aspect_ratio: document.getElementById('img-ratio').value,
      num_images:   count,
    })
    const grid = document.getElementById('img-grid')
    grid.innerHTML = data.urls.map(url => `
      <div class="img-wrap">
        <img src="${url}" loading="lazy"/>
        <a href="${url}" download class="img-dl">⬇</a>
      </div>`).join('')
    setStatus('img-status','Done!','ok')
    loadUsage()
  } catch(e) {
    document.getElementById('img-grid').innerHTML = `<div class="ui-empty" id="img-empty">
      <div class="ui-empty-icon" aria-hidden="true"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
      <div class="ui-empty-title">No images yet</div>
      <div class="ui-empty-sub">Write a prompt and generate to see results here.</div>
    </div>`
    setStatus('img-status', e.message, 'err')
  }
  finally { btn.disabled = false; btn.classList.remove('is-loading') }
}

// ── FILES ─────────────────────────────────────────────────────────────────────
function renderDashRecent(files) {
  const el = document.getElementById('dash-recent')
  if (!el) return
  if (!files?.length) {
    el.innerHTML = `<div class="ui-empty" style="min-height:180px;border:1px solid var(--border);border-radius:var(--radius-card);background:rgba(255,255,255,.02)">
      <div class="ui-empty-icon" aria-hidden="true"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
      <div class="ui-empty-title">No recent files</div>
      <div class="ui-empty-sub">Uploads and exports will show up here.</div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="switchPanel('files',null)">Open My Files</button>
    </div>`
    return
  }
  const recent = files.slice(0, 5)
  el.innerHTML = `<div class="dash-recent">${recent.map(f => `
    <div class="dash-recent-row">
      <div class="dash-recent-name">${f.original_name || 'Untitled'}</div>
      <div class="dash-recent-meta">${f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</div>
      <a href="${f.url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm">Open</a>
    </div>`).join('')}</div>`
}

async function loadFiles() {
  try {
    const files = await api.upload.list()
    renderDashRecent(files)
    const list  = document.getElementById('files-list')
    if (!list) return
    if (!files.length) { list.innerHTML = '<div style="color:var(--muted);font-size:.82rem">No files yet.</div>'; return }
    list.innerHTML = files.map(f => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;background:var(--card);margin-bottom:8px">
        <div style="font-size:1.2rem">${f.mime_type?.startsWith('video') ? '🎥' : f.mime_type?.startsWith('audio') ? '🔊' : '🖼️'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.original_name}</div>
          <div style="font-size:.7rem;color:var(--muted)">${(f.size/1024/1024).toFixed(1)} MB · ${new Date(f.created_at).toLocaleDateString()}</div>
        </div>
        <a href="${f.url}" target="_blank" class="btn btn-ghost btn-sm">Open</a>
        <button class="btn btn-ghost btn-sm" onclick="delFile('${f.id}',this)">✕</button>
      </div>`).join('')
  } catch(e) {
    renderDashRecent([])
    const list = document.getElementById('files-list')
    if (list) list.innerHTML = `<div style="color:var(--muted);">${e.message}</div>`
  }
}

window.uploadFile = async (input) => {
  const file = input.files[0]; if (!file) return
  const fd = new FormData(); fd.append('file', file)
  try {
    await api.upload.file(fd)
    loadFiles()
  } catch(e) { alert(e.message) }
  input.value = ''
}

window.delFile = async (id, btn) => {
  btn.disabled = true
  try { await api.upload.del(id); loadFiles() }
  catch(e) { alert(e.message); btn.disabled = false }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function setStatus(id, msg, type) {
  const el = document.getElementById(id)
  el.style.display = 'flex'
  el.className = `status ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : ''}`
  if (type === 'loading') {
    el.innerHTML = `<div class="spinner"></div> ${msg}`
  } else {
    el.textContent = msg
  }
}

checkAuth()

// ── VIDEO CLIPPER ─────────────────────────────────────────────────────────────
let clipDuration = 0
let clipInPoint  = 0
let clipOutPoint = 0
let clipFile     = null
let clipMode     = 'file'   // 'file' | 'url'
let clipSourceUrl = null
let ffmpegLoaded = false
let ffmpegInst   = null
let dragging     = null
let dragStartX   = 0
let dragStartPct = 0

const titles2 = { clipper: 'Video Clipper' }
Object.assign(titles, titles2)

// Drop zone
const clipDrop = document.getElementById('clip-drop-zone')
clipDrop?.addEventListener('dragover',  e => { e.preventDefault(); clipDrop.classList.add('drag') })
clipDrop?.addEventListener('dragleave', () => clipDrop.classList.remove('drag'))
clipDrop?.addEventListener('drop', e => { e.preventDefault(); clipDrop.classList.remove('drag'); loadClipFile(e.dataTransfer.files[0]) })
document.getElementById('clip-file-input')?.addEventListener('change', e => { if (e.target.files[0]) loadClipFile(e.target.files[0]) })

// Lay out the clipper by mode. URL mode: viral moments are primary (under the
// thumbnail) and manual clipping is an optional collapsed panel on the side.
// File mode: manual clipping is primary (under the thumbnail), no viral panel.
function arrangeClipper(mode) {
  const note = document.getElementById('clip-url-note')
  const viral = document.getElementById('clip-viral-section')
  const manual = document.getElementById('clip-manual-tools')
  const rightCol = document.getElementById('clip-right-col')
  if (!note || !viral || !manual || !rightCol) return
  if (mode === 'url') {
    note.after(viral)             // viral moments directly under the thumbnail
    rightCol.appendChild(manual)  // manual clip → optional side panel
    manual.open = false
    rightCol.style.display = ''
  } else {
    note.after(manual)            // manual clip primary, under the thumbnail
    manual.open = true
    rightCol.appendChild(viral)   // park the hidden viral section in the side col
    rightCol.style.display = 'none'
  }
}

window.loadClipFromUrl = async () => {
  const url = document.getElementById('clip-url').value.trim()
  if (!url) { setStatus('clip-url-status', 'Paste a video link first', 'err'); return false }
  const btn = document.getElementById('clip-url-btn')
  btn.disabled = true
  setStatus('clip-url-status', 'Reading video info…', 'loading')
  try {
    const info = await api.download.info(url)
    if (!info?.duration) throw new Error('Could not read this video. Make sure it is public.')
    // Set up server-side clip mode — no full download
    clipMode = 'url'
    clipSourceUrl = url
    clipFile = null
    clipDuration = info.duration
    clipInPoint  = 0
    clipOutPoint = Math.min(info.duration, 60)
    // UI: show thumbnail instead of video, show note, hide source-preview button
    const vid = document.getElementById('clip-preview')
    vid.pause(); vid.removeAttribute('src'); vid.load()
    vid.style.display = 'none'
    const thumb = document.getElementById('clip-thumb')
    thumb.src = info.thumbnail || ''
    thumb.style.display = info.thumbnail ? '' : 'none'
    document.getElementById('clip-url-note').style.display = ''
    document.getElementById('clip-preview-btn').style.display = 'none'
    document.getElementById('clip-editor').style.display = ''
    document.getElementById('clip-loader').style.display = 'none'
    document.getElementById('clip-output').style.display = 'none'
    arrangeClipper('url')
    document.getElementById('clip-viral-section').style.display = ''
    document.getElementById('clip-viral-results').style.display = 'none'
    document.getElementById('clip-viral-status').style.display = 'none'
    document.getElementById('clip-dur-label').textContent = fmtTime(clipDuration)
    document.getElementById('clip-url-status').style.display = 'none'
    updateHandles()
    updateInputs()
    btn.disabled = false
    return true
  } catch (e) {
    setStatus('clip-url-status', e.message || 'Could not load video', 'err')
    btn.disabled = false
    return false
  }
}

// Primary CTA — load the URL, then kick off AI viral-moment analysis.
window.findClipsFromUrl = async () => {
  const sel = document.getElementById('clip-content-type')
  if (sel) setClipContentType(sel.value)
  const ok = await loadClipFromUrl()
  if (ok) clipFindViral()
}

window.setClipContentType = (g) => {
  cvGenre = g || 'auto'
  const sel = document.getElementById('clip-content-type')
  if (sel && sel.value !== cvGenre) sel.value = cvGenre
  const btn = document.querySelector(`#clip-viral-genres .cv-genre-btn[data-genre="${cvGenre}"]`)
  document.querySelectorAll('#clip-viral-genres .cv-genre-btn').forEach((b) => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  else {
    const autoBtn = document.querySelector('#clip-viral-genres .cv-genre-btn[data-genre="auto"]')
    autoBtn?.classList.add('active')
  }
}

// Popular video catalog for the discover grid (curated long-form sources).
const CLIP_DISCOVER = [
  { id: 'DXVHmGoCTco', title: '50 Streamers Fight for $1,000,000', channel: 'MrBeast', cats: ['recommended', 'entertainment'] },
  { id: 'MmGzzlRNjFA', title: 'MAKE US LAUGH, WIN $1,000 (ft. Deji)', channel: 'KSI', cats: ['recommended', 'entertainment'] },
  { id: '5hTAg2ThHAo', title: 'I Spent 30 Days Exploring All Of Africa!', channel: 'IShowSpeed', cats: ['recommended', 'entertainment'] },
  { id: 'WLgwMvBHti4', title: 'MAKE US LAUGH, WIN $1,000 (ft. Deji) 2', channel: 'KSI', cats: ['entertainment'] },
  { id: '0e3GPea1Tyg', title: 'I Spent 50 Hours Buried Alive', channel: 'MrBeast', cats: ['recommended', 'entertainment'] },
  { id: 'erLbbextvyE', title: '100 Kids Vs 1 Giant Pizza', channel: 'MrBeast', cats: ['entertainment'] },
  { id: 'asioCrI0MfY', title: 'Sidemen Charity Match 2023', channel: 'Sidemen', cats: ['recommended', 'sport'] },
  { id: 'lBkd0vQmslE', title: 'Sidemen Charity Match 2022', channel: 'Sidemen', cats: ['sport'] },
  { id: 'tqK8aWqV0p4', title: 'Sidemen Among Us But Imposters Can Talk', channel: 'Sidemen', cats: ['entertainment'] },
  { id: 'LXb3EKWsInQ', title: 'COSTA RICA IN 4K', channel: 'Jacob + Katie Schwarz', cats: ['entertainment'] },
  { id: 'UF8uR6Z6KLc', title: "Steve Jobs' 2005 Stanford Commencement Address", channel: 'Stanford', cats: ['recommended', 'podcasts'] },
  { id: 'T4CID6Qvq8E', title: 'Joe Rogan Experience #1169 — Elon Musk', channel: 'PowerfulJRE', cats: ['recommended', 'podcasts'] },
  { id: 'ycPr5-27vSI', title: 'Joe Rogan Experience #1554 — Kanye West', channel: 'PowerfulJRE', cats: ['podcasts'] },
  { id: 'dxhZ7xHhR3s', title: 'Lex Fridman Podcast — Mark Zuckerberg', channel: 'Lex Fridman', cats: ['podcasts'] },
  { id: 'cdZZpaB2kDM', title: 'Impaulsive EP. 348', channel: 'Impaulsive', cats: ['podcasts'] },
  { id: 'pRpeEdMmmQ0', title: 'Shakira — Waka Waka (This Time for Africa)', channel: 'Shakira', cats: ['sport'] },
  { id: '6DhJR8_iV4s', title: 'I Survived 24 Hours Straight In The Desert', channel: 'MrBeast', cats: ['sport', 'entertainment'] },
  { id: 'djszH7QDYxI', title: 'World\'s Fastest Car Vs World\'s Fastest Man', channel: 'MrBeast', cats: ['sport'] },
  { id: '9bZkp7q19f0', title: 'PSY — GANGNAM STYLE', channel: 'officialpsy', cats: ['entertainment'] },
  { id: 'JGwWNGJdvx8', title: 'Ed Sheeran — Shape of You', channel: 'Ed Sheeran', cats: ['entertainment'] },
  { id: 'kJQP7kiw5Fk', title: 'Luis Fonsi — Despacito ft. Daddy Yankee', channel: 'Luis Fonsi', cats: ['entertainment'] },
  { id: 'RgKAFK5djSk', title: 'Wiz Khalifa — See You Again ft. Charlie Puth', channel: 'Wiz Khalifa', cats: ['entertainment'] },
  { id: 'OPf0YbXqDm0', title: 'Mark Ronson — Uptown Funk ft. Bruno Mars', channel: 'Mark Ronson', cats: ['entertainment'] },
  { id: 'fHI8X4OXluQ', title: 'The Weeknd — Blinding Lights', channel: 'The Weeknd', cats: ['entertainment'] },
  { id: 'e-ORhEE9VVg', title: 'Taylor Swift — Blank Space', channel: 'Taylor Swift', cats: ['entertainment'] },
  { id: 'YQHsXMglC9A', title: 'Adele — Hello', channel: 'Adele', cats: ['entertainment'] },
  { id: '8jPQjjsBbIc', title: "Drake — God's Plan", channel: 'Drake', cats: ['entertainment'] },
  { id: 'zSWdZVtXT7E', title: 'Interstellar — Official Trailer', channel: 'Interstellar', cats: ['entertainment'] },
]

let clipDiscoverCat = 'recommended'
let clipDiscoverSearchTimer = null
let clipDiscoverSearchSeq = 0
let clipDiscoverResults = null // null = curated mode; array = live YouTube search results

window.setClipDiscoverCat = (cat, btn) => {
  clipDiscoverCat = cat
  document.querySelectorAll('#clip-discover-tabs .clip-tab').forEach((b) => b.classList.remove('active'))
  btn?.classList.add('active')
  // Switching tabs clears live search and shows curated for that category
  const input = document.getElementById('clip-discover-q')
  if (input) input.value = ''
  clipDiscoverResults = null
  renderClipDiscover()
}

function paintClipDiscoverCards(list) {
  const grid = document.getElementById('clip-discover-grid')
  if (!grid) return
  const countEl = document.getElementById('clip-discover-count')
  const shown = Array.isArray(list) ? Math.min(list.length, 12) : 0
  if (countEl) countEl.textContent = shown ? `${shown} result${shown === 1 ? '' : 's'}` : ''
  if (!list.length) {
    grid.innerHTML = '<div class="clip-discover-empty">No videos found. Try another keyword or paste a link above.</div>'
    return
  }
  grid.innerHTML = list.slice(0, 12).map((v) => {
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
    const initial = (v.channel || '?').trim().charAt(0).toUpperCase()
    const safeTitle = String(v.title || '').replace(/"/g, '&quot;')
    const safeId = String(v.id || '').replace(/'/g, '')
    return `<button type="button" class="clip-pick" onclick="pickClipDiscover('${safeId}')" title="${safeTitle}">
      <div class="clip-pick-thumb">
        <img src="${thumb}" alt="" loading="lazy" referrerpolicy="no-referrer"/>
        <div class="clip-pick-overlay">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
          Find clips
        </div>
      </div>
      <div class="clip-pick-meta">
        <div class="clip-pick-avatar">${initial}</div>
        <div>
          <div class="clip-pick-title">${String(v.title || '').replace(/</g, '&lt;')}</div>
          <div class="clip-pick-channel">${String(v.channel || '').replace(/</g, '&lt;')}</div>
        </div>
      </div>
    </button>`
  }).join('')
}

window.renderClipDiscover = () => {
  if (clipDiscoverResults) {
    paintClipDiscoverCards(clipDiscoverResults)
    return
  }
  const seen = new Set()
  const list = CLIP_DISCOVER.filter((v) => {
    if (seen.has(v.id)) return false
    seen.add(v.id)
    return v.cats.includes(clipDiscoverCat)
  })
  paintClipDiscoverCards(list)
}

window.onClipDiscoverSearch = () => {
  clearTimeout(clipDiscoverSearchTimer)
  const q = (document.getElementById('clip-discover-q')?.value || '').trim()
  if (!q) {
    clipDiscoverResults = null
    renderClipDiscover()
    return
  }
  clipDiscoverSearchTimer = setTimeout(() => searchClipDiscover(false), 450)
}

window.searchClipDiscover = async (immediate) => {
  clearTimeout(clipDiscoverSearchTimer)
  const q = (document.getElementById('clip-discover-q')?.value || '').trim()
  const grid = document.getElementById('clip-discover-grid')
  if (!q) {
    clipDiscoverResults = null
    renderClipDiscover()
    return
  }
  if (!grid) return
  const seq = ++clipDiscoverSearchSeq
  grid.innerHTML = `<div class="clip-skel-grid">${Array.from({length:6}).map(()=>`<div><div class="ui-skeleton ui-skeleton-thumb"></div><div class="ui-skeleton ui-skeleton-line" style="width:80%;margin-top:10px"></div><div class="ui-skeleton ui-skeleton-line" style="width:50%"></div></div>`).join('')}</div>`
  try {
    const { videos } = await api.download.search(q, 12)
    if (seq !== clipDiscoverSearchSeq) return // stale response
    clipDiscoverResults = videos || []
    paintClipDiscoverCards(clipDiscoverResults)
  } catch (e) {
    if (seq !== clipDiscoverSearchSeq) return
    grid.innerHTML = `<div class="clip-discover-empty">${(e.message || 'Search failed').replace(/</g, '&lt;')}</div>`
  }
}

window.pickClipDiscover = (id) => {
  const url = `https://www.youtube.com/watch?v=${id}`
  document.getElementById('clip-url').value = url
  // Map category tab → content type hint when user hasn't chosen one
  const sel = document.getElementById('clip-content-type')
  if (sel && (!sel.value || sel.value === 'auto')) {
    if (clipDiscoverCat === 'sport') sel.value = 'sports'
    else if (clipDiscoverCat === 'podcasts') sel.value = 'podcast'
    else if (clipDiscoverCat === 'entertainment') sel.value = 'entertainment'
  }
  findClipsFromUrl()
}

;(function initClipDiscover() { renderClipDiscover() })()

window.resetClipper = () => {
  clearTimeout(cvPollTimer)
  cvJobId = null
  cvClips = []
  clipMode = null
  clipSourceUrl = null
  clipFile = null
  const vid = document.getElementById('clip-preview')
  if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load() }
  document.getElementById('clip-editor').style.display = 'none'
  document.getElementById('clip-loader').style.display = ''
  document.getElementById('clip-output').style.display = 'none'
  document.getElementById('clip-viral-results').style.display = 'none'
  document.getElementById('clip-viral-status').style.display = 'none'
  document.getElementById('clip-url-status').style.display = 'none'
  const btn = document.getElementById('clip-url-btn')
  if (btn) btn.disabled = false
  const vBtn = document.getElementById('clip-viral-btn')
  if (vBtn) vBtn.disabled = false
}

function loadClipFile(file) {
  if (!file?.type.startsWith('video/')) return
  clipMode = 'file'
  clipSourceUrl = null
  clipFile = file
  // UI: show video, hide thumbnail/note, show preview button
  document.getElementById('clip-thumb').style.display = 'none'
  document.getElementById('clip-url-note').style.display = 'none'
  document.getElementById('clip-preview-btn').style.display = ''
  document.getElementById('clip-viral-section').style.display = 'none'
  arrangeClipper('file')
  const vid  = document.getElementById('clip-preview')
  vid.style.display = ''
  const url = URL.createObjectURL(file)
  vid.src = url
  vid.onloadedmetadata = () => {
    clipDuration = vid.duration
    clipInPoint  = 0
    clipOutPoint = clipDuration
    document.getElementById('clip-editor').style.display = ''
    document.getElementById('clip-loader').style.display = 'none'
    document.getElementById('clip-output').style.display = 'none'
    document.getElementById('clip-dur-label').textContent = fmtTime(clipDuration)
    updateHandles()
    updateInputs()
  }
  vid.addEventListener('timeupdate', () => {
    const pct = vid.currentTime / clipDuration
    document.getElementById('clip-playhead').style.left = (pct * 100) + '%'
  })
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2,'0')}`
}

function updateHandles() {
  const inPct  = (clipInPoint  / clipDuration) * 100
  const outPct = (clipOutPoint / clipDuration) * 100
  const sel    = document.getElementById('clip-selection')
  document.getElementById('handle-in').style.left  = inPct  + '%'
  document.getElementById('handle-out').style.left = outPct + '%'
  sel.style.left  = inPct  + '%'
  sel.style.width = (outPct - inPct) + '%'
}

function updateInputs() {
  document.getElementById('clip-in-input').value  = clipInPoint.toFixed(2)
  document.getElementById('clip-out-input').value = clipOutPoint.toFixed(2)
  document.getElementById('clip-len-label').value = (clipOutPoint - clipInPoint).toFixed(2) + 's'
}

// Handle dragging
;['handle-in','handle-out'].forEach(id => {
  document.getElementById(id)?.addEventListener('mousedown', e => {
    e.preventDefault()
    dragging = id
    dragStartX = e.clientX
    dragStartPct = id === 'handle-in'
      ? clipInPoint / clipDuration
      : clipOutPoint / clipDuration
  })
})

document.addEventListener('mousemove', e => {
  if (!dragging) return
  const track = document.getElementById('clip-track')
  const rect  = track.getBoundingClientRect()
  const pct   = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  if (dragging === 'handle-in') {
    clipInPoint = Math.min(pct * clipDuration, clipOutPoint - 0.1)
  } else {
    clipOutPoint = Math.max(pct * clipDuration, clipInPoint + 0.1)
  }
  updateHandles()
  updateInputs()
})

document.addEventListener('mouseup', () => { dragging = null })

// Click on track to seek
document.getElementById('clip-track')?.addEventListener('click', e => {
  if (dragging || clipMode === 'url') return
  const rect = document.getElementById('clip-track').getBoundingClientRect()
  const pct  = (e.clientX - rect.left) / rect.width
  const vid  = document.getElementById('clip-preview')
  vid.currentTime = pct * clipDuration
})

// Manual input
document.getElementById('clip-in-input')?.addEventListener('change', e => {
  clipInPoint = Math.max(0, Math.min(parseFloat(e.target.value)||0, clipOutPoint - 0.1))
  updateHandles(); updateInputs()
})
document.getElementById('clip-out-input')?.addEventListener('change', e => {
  clipOutPoint = Math.min(clipDuration, Math.max(parseFloat(e.target.value)||0, clipInPoint + 0.1))
  updateHandles(); updateInputs()
})

window.clipPreviewRange = () => {
  const vid = document.getElementById('clip-preview')
  vid.currentTime = clipInPoint
  vid.play()
  const stop = () => { if (vid.currentTime >= clipOutPoint) { vid.pause(); vid.removeEventListener('timeupdate', stop) } }
  vid.addEventListener('timeupdate', stop)
}

// ── VIDEO EDITOR ─────────────────────────────────────────────────────────────
const ED_PX = 80

const ED_STYLES = {
  tiktok:   { label:'TikTok',    font:'Geist',       w:'800', color:'#ffffff', sc:'#000000', sw:7,  glow:0,  glowC:'transparent', bg:'' },
  viral:    { label:'Viral Red', font:'Anton',        w:'400', color:'#ff1c1c', sc:'#ffffff', sw:9,  glow:0,  glowC:'transparent', bg:'' },
  youtube:  { label:'YouTube',   font:'Anton',        w:'400', color:'#ffee00', sc:'#000000', sw:7,  glow:0,  glowC:'transparent', bg:'' },
  bebas:    { label:'Bebas',     font:'Bebas Neue',   w:'400', color:'#ffffff', sc:'#000000', sw:5,  glow:0,  glowC:'transparent', bg:'' },
  neon:     { label:'Neon',      font:'Geist',        w:'800', color:'#ff2244', sc:'transparent', sw:0, glow:22, glowC:'#ff0033', bg:'' },
  subtitle: { label:'Subtitle',  font:'Geist',        w:'600', color:'#ffffff', sc:'transparent', sw:0, glow:0,  glowC:'transparent', bg:'rgba(0,0,0,0.72)' },
  glitch:   { label:'Glitch',    font:'Oswald',       w:'700', color:'#00ffe0', sc:'#ff0055', sw:4,  glow:14, glowC:'#00ffe0', bg:'' },
  impact:   { label:'Impact',    font:'Black Han Sans',w:'400',color:'#ffffff', sc:'#111111', sw:8,  glow:0,  glowC:'transparent', bg:'' },
}

function edBuildStyleGrid() {
  const grid = document.getElementById('ep-style-grid')
  if (!grid) return
  grid.innerHTML = Object.entries(ED_STYLES).map(([key]) =>
    `<button class="txt-style-btn" data-key="${key}" onclick="edApplyStyle('${key}')">
       <canvas id="sprev-${key}" width="180" height="52" style="width:100%;height:52px;display:block"></canvas>
     </button>`
  ).join('')
  document.fonts.ready.then(() => {
    Object.entries(ED_STYLES).forEach(([key, s]) => edDrawStylePreview(key, s))
  })
}

function edDrawStylePreview(key, s) {
  const cv = document.getElementById('sprev-' + key)
  if (!cv) return
  const ctx = cv.getContext('2d')
  const W = 180, H = 52
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = s.bg || '#0d0d0d'
  ctx.fillRect(0, 0, W, H)
  const sz = 22
  ctx.font = `${s.w} ${sz}px '${s.font}', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (s.bg) {
    const m = ctx.measureText(s.label)
    ctx.fillStyle = s.bg
    ctx.fillRect(W/2 - m.width/2 - 8, H/2 - sz*0.72, m.width + 16, sz*1.44)
  }
  ctx.shadowBlur = s.glow > 0 ? s.glow * 0.55 : 0
  ctx.shadowColor = s.glowC || 'transparent'
  if (s.sc !== 'transparent' && s.sw > 0) {
    ctx.lineWidth = s.sw * 0.65
    ctx.lineJoin = 'round'
    ctx.strokeStyle = s.sc
    ctx.strokeText(s.label, W/2, H/2)
  }
  ctx.fillStyle = s.color
  ctx.fillText(s.label, W/2, H/2)
  ctx.shadowBlur = 0
}

window.edApplyStyle = (key) => {
  if (!edSel || edSel.type !== 'text') return
  const t = edTexts.find(x => x.id === edSel.id); if (!t) return
  const s = ED_STYLES[key]; if (!s) return
  t.preset = key
  t.fontFamily = s.font
  t.color      = s.color
  t.strokeColor = s.sc
  t.strokeW    = s.sw
  t.glow       = s.glow
  t.glowColor  = s.glowC
  t.bgColor    = s.bg
  // sync UI
  document.getElementById('ep-tcol').value = s.color
  document.getElementById('ep-scol').value = s.sc === 'transparent' ? '#000000' : s.sc
  document.getElementById('ep-sw').value   = s.sw
  document.querySelectorAll('.txt-style-btn').forEach(b => b.classList.toggle('active', b.dataset.key === key))
  edDrawCanvas()
}

let edClips = []     // {id, file, url, dur, tStart, trimIn, trimOut, trimDur}
let edTexts = []     // {id, text, start, end, x, y, size, color, bold}
let edAudio = null   // {file, url, volume}
let edFilters = { br: 0, ct: 0, sat: 1 }
let edTotalDur = 0
let edCurTime = 0
let edSel = null     // {type:'clip'|'text'|'audio'|'frame', id}
let edPlaying = false
let edRaf = null
let edAudioEl = null
let edFrame = { mode: 'none', crop: 'fit' }   // mode: 'none'|'white'|'black'|'blur'  crop: 'fit'|'16:9'|'4:3'|'1:1'|'3:4'

window.edAddMedia = () => document.getElementById('ed-media-in').click()
window.edAddMusic = () => document.getElementById('ed-music-in').click()

window.edHandleMedia = async (inp) => {
  for (const file of Array.from(inp.files)) {
    if (!file.type.startsWith('video/')) continue
    const url = URL.createObjectURL(file)
    const dur = await getEdVidDur(url)
    const id = 'c' + Date.now() + Math.random().toString(36).slice(2,6)
    edClips.push({ id, file, url, dur, tStart: 0, trimIn: 0, trimOut: dur, trimDur: dur })
  }
  inp.value = ''
  edRecalc()
  edRenderTL()
  edShowPreview()
  edLoadAt(0)
}

window.edHandleMusic = (inp) => {
  const file = inp.files[0]; if (!file) return
  inp.value = ''
  const url = URL.createObjectURL(file)
  edAudio = { file, url, volume: 0.5 }
  if (!edAudioEl) { edAudioEl = new Audio(); edAudioEl.loop = false }
  edAudioEl.src = url
  edAudioEl.volume = 0.5
  edSel = { type: 'audio', id: 'audio' }
  edShowProps('audio')
  edRenderTL()
}

function getEdVidDur(url) {
  return new Promise(res => {
    const v = document.createElement('video'); v.src = url
    v.onloadedmetadata = () => res(v.duration)
    v.onerror = () => res(10)
  })
}

function edRecalc() {
  let t = 0
  for (const c of edClips) { c.trimDur = c.trimOut - c.trimIn; c.tStart = t; t += c.trimDur }
  edTotalDur = t
}

function edShowPreview() {
  document.getElementById('ed-empty').style.display = 'none'
  document.getElementById('ed-stage').style.display = ''
  document.getElementById('ed-timebar').style.display = ''
}

function edLoadAt(time) {
  let t = 0
  for (const c of edClips) {
    if (time < t + c.trimDur || t + c.trimDur >= edTotalDur - 0.01) {
      const vid = document.getElementById('ed-vid')
      if (vid.src !== c.url) { vid.src = c.url }
      vid.currentTime = c.trimIn + (time - t)
      edApplyFilter()
      return
    }
    t += c.trimDur
  }
}

function edDrawCanvas() {
  const vid = document.getElementById('ed-vid')
  const cv = document.getElementById('ed-canvas')
  const ctx = cv.getContext('2d')
  let w, h
  if (edFrame.mode !== 'none') {
    // portrait 9:16 surface — canvas draws everything
    w = 540; h = 960
    cv.width = w; cv.height = h
    const vw = vid.videoWidth, vh = vid.videoHeight
    // background fill
    if (edFrame.mode === 'blur' && vw && vh) {
      const cover = Math.max(w / vw, h / vh)
      const bw = vw * cover, bh = vh * cover
      ctx.filter = 'blur(16px) brightness(0.92)'
      ctx.drawImage(vid, (w - bw) / 2, (h - bh) / 2, bw, bh)
      ctx.filter = 'none'
    } else {
      ctx.fillStyle = edFrame.mode === 'white' ? '#ffffff' : '#000000'
      ctx.fillRect(0, 0, w, h)
    }
    // foreground video — crop to selected ratio, then fit inside the 9:16 canvas
    if (vw && vh) {
      let sx = 0, sy = 0, sw = vw, sh = vh
      const crop = edFrame.crop
      if (crop !== 'fit') {
        const [cw, ch] = crop.split(':').map(Number)
        const targetAR = cw / ch
        const srcAR = vw / vh
        if (srcAR > targetAR) {
          sw = Math.round(vh * targetAR); sx = Math.round((vw - sw) / 2)
        } else {
          sh = Math.round(vw / targetAR); sy = Math.round((vh - sh) / 2)
        }
      }
      const cropAR = sw / sh
      let dw, dh
      if (cropAR > w / h) { dw = w; dh = w / cropAR }
      else { dh = h; dw = h * cropAR }
      const dx = (w - dw) / 2, dy = (h - dh) / 2
      ctx.filter = `brightness(${1 + edFilters.br}) contrast(${1 + edFilters.ct}) saturate(${edFilters.sat})`
      ctx.drawImage(vid, sx, sy, sw, sh, dx, dy, dw, dh)
      ctx.filter = 'none'
    }
  } else {
    w = vid.clientWidth || 640
    h = vid.clientHeight || 360
    if (!w || !h) return
    cv.width = w; cv.height = h
    ctx.clearRect(0, 0, w, h)
  }
  for (const t of edTexts) {
    if (edCurTime < t.start || edCurTime > t.end) continue
    const sz = Math.round((t.size || 48) * w / 640)
    const font = t.fontFamily || 'Geist'
    ctx.font = `${t.bold ? 'bold ' : ''}${sz}px '${font}', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const x = (t.x / 100) * w
    const y = (t.y / 100) * h
    // background bar (subtitle style)
    if (t.bgColor) {
      const m = ctx.measureText(t.text)
      const pad = sz * 0.32
      ctx.fillStyle = t.bgColor
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x - m.width/2 - pad, y - sz*0.72, m.width + pad*2, sz*1.44, 6)
      else ctx.rect(x - m.width/2 - pad, y - sz*0.72, m.width + pad*2, sz*1.44)
      ctx.fill()
    }
    // glow
    const glow = t.glow || 0
    ctx.shadowBlur = glow * w / 640
    ctx.shadowColor = t.glowColor || 'transparent'
    // stroke
    const sc = t.strokeColor || 'transparent'
    const sw = (t.strokeW || 0) * w / 640
    if (sc !== 'transparent' && sw > 0) {
      ctx.lineWidth = sw * 2
      ctx.lineJoin = 'round'
      ctx.strokeStyle = sc
      ctx.strokeText(t.text, x, y)
    }
    // fill
    ctx.fillStyle = t.color || '#ffffff'
    ctx.fillText(t.text, x, y)
    ctx.shadowBlur = 0
  }
}

window.edApplyFilter = () => {
  const vid = document.getElementById('ed-vid')
  const br = 1 + parseFloat(document.getElementById('ep-br')?.value || 0)
  const ct = 1 + parseFloat(document.getElementById('ep-ct')?.value || 0)
  const sat = parseFloat(document.getElementById('ep-sat')?.value || 1)
  vid.style.filter = `brightness(${br}) contrast(${ct}) saturate(${sat})`
  edFilters = { br: br - 1, ct: ct - 1, sat }
}

// ── TIMELINE ──────────────────────────────────────────────────────────────────
function edRenderTL() {
  const W = Math.max(edTotalDur * ED_PX, 300)
  // Video track
  const vtEl = document.getElementById('tl-vid')
  vtEl.style.width = W + 'px'
  vtEl.innerHTML = ''
  for (const c of edClips) {
    const el = document.createElement('div')
    el.className = 'tl-clip video' + (edSel?.id === c.id ? ' selected' : '')
    el.style.cssText = `left:${c.tStart * ED_PX}px;width:${c.trimDur * ED_PX}px`
    el.textContent = c.file.name.replace(/\.[^.]+$/, '')
    el.onclick = (e) => { e.stopPropagation(); edSelectClip(c.id) }
    vtEl.appendChild(el)
  }
  // Text track
  const ttEl = document.getElementById('tl-txt')
  ttEl.style.width = W + 'px'
  ttEl.innerHTML = ''
  for (const t of edTexts) {
    const el = document.createElement('div')
    el.className = 'tl-clip text-cl' + (edSel?.id === t.id ? ' selected' : '')
    el.style.cssText = `left:${t.start * ED_PX}px;width:${Math.max((t.end - t.start) * ED_PX, 20)}px`
    el.textContent = t.text
    el.onclick = (e) => { e.stopPropagation(); edSelectText(t.id) }
    ttEl.appendChild(el)
  }
  // Audio track
  const atEl = document.getElementById('tl-aud')
  atEl.style.width = W + 'px'
  atEl.innerHTML = ''
  if (edAudio) {
    const el = document.createElement('div')
    el.className = 'tl-clip audio-cl' + (edSel?.type === 'audio' ? ' selected' : '')
    el.style.cssText = `left:0;width:${W}px`
    el.textContent = '♪ ' + edAudio.file.name
    el.onclick = (e) => { e.stopPropagation(); edSel = { type:'audio', id:'audio' }; edShowProps('audio'); edRenderTL() }
    atEl.appendChild(el)
  }
  edDrawRuler(W)
  edMovePH()
}

function edDrawRuler(W) {
  const cv = document.getElementById('ed-ruler-cv')
  cv.width = W + 66; cv.height = 22
  cv.style.width = (W + 66) + 'px'
  const ctx = cv.getContext('2d')
  ctx.clearRect(0, 0, cv.width, 22)
  const step = ED_PX >= 60 ? 1 : ED_PX >= 30 ? 2 : 5
  for (let t = 0; t <= edTotalDur + step; t += step) {
    const x = t * ED_PX + 66
    ctx.fillStyle = 'rgba(255,59,74,.5)'
    ctx.fillRect(x, 14, 1, 8)
    ctx.fillStyle = 'rgba(200,190,230,.55)'
    ctx.font = '9px Geist, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.floor(t/60)}:${String(t % 60).padStart(2,'0')}`, x, 10)
  }
}

function edMovePH() {
  const x = edCurTime * ED_PX + 66
  document.getElementById('ed-ph-r').style.left = x + 'px'
  document.getElementById('ed-ph-t').style.left = x + 'px'
}

window.edRulerSeek = (e) => {
  const rect = document.getElementById('ed-ruler').getBoundingClientRect()
  edSeekTo(Math.max(0, (e.clientX - rect.left - 66) / ED_PX))
}

window.edTrackSeek = (e) => {
  if (e.target.classList.contains('tl-clip')) return
  const rect = e.currentTarget.getBoundingClientRect()
  edSeekTo(Math.max(0, (e.clientX - rect.left) / ED_PX))
}

function edSeekTo(t) {
  edCurTime = Math.min(Math.max(t, 0), edTotalDur)
  edLoadAt(edCurTime)
  edMovePH()
  edUpdScrub()
  edDrawCanvas()
}

function edUpdScrub() {
  const sc = document.getElementById('ed-scrubber')
  sc.max = edTotalDur; sc.value = edCurTime
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
  document.getElementById('ed-time-lbl').textContent = `${fmt(edCurTime)} / ${fmt(edTotalDur)}`
}

window.edScrub = (v) => edSeekTo(parseFloat(v))

window.edTogglePlay = () => {
  const vid = document.getElementById('ed-vid')
  if (edPlaying) {
    vid.pause(); edAudioEl?.pause()
    edPlaying = false; document.getElementById('ed-play-btn').textContent = '▶'
    cancelAnimationFrame(edRaf)
  } else {
    vid.play(); edAudioEl?.play()
    edPlaying = true; document.getElementById('ed-play-btn').textContent = '⏸'
    edTick()
  }
}

function edTick() {
  const vid = document.getElementById('ed-vid')
  for (let i = 0; i < edClips.length; i++) {
    const c = edClips[i]
    if (vid.src === c.url) {
      edCurTime = c.tStart + Math.max(0, vid.currentTime - c.trimIn)
      if (vid.currentTime >= c.trimOut - 0.05) {
        if (i + 1 < edClips.length) {
          const n = edClips[i+1]; vid.src = n.url; vid.currentTime = n.trimIn; vid.play()
        } else {
          vid.pause(); edAudioEl?.pause()
          edPlaying = false; document.getElementById('ed-play-btn').textContent = '▶'
          return
        }
      }
      break
    }
  }
  edMovePH(); edUpdScrub(); edDrawCanvas()
  if (edPlaying) edRaf = requestAnimationFrame(edTick)
}

// ── SELECTION & PROPS ─────────────────────────────────────────────────────────
function edShowProps(type) {
  document.getElementById('ep-default').style.display = type ? 'none' : ''
  document.getElementById('ep-clip').style.display  = type === 'clip'  ? '' : 'none'
  document.getElementById('ep-text').style.display  = type === 'text'  ? '' : 'none'
  document.getElementById('ep-audio').style.display = type === 'audio' ? '' : 'none'
  document.getElementById('ep-frame').style.display = type === 'frame' ? '' : 'none'
  document.getElementById('ed-del-btn').style.display = (type && type !== 'frame') ? '' : 'none'
}

window.edOpenFrame = () => {
  edSel = null
  edShowProps('frame')
  document.querySelectorAll('.frame-btn[data-fr]').forEach(b => b.classList.toggle('active', b.dataset.fr === edFrame.mode))
  document.querySelectorAll('.frame-btn[data-crop]').forEach(b => b.classList.toggle('active', b.dataset.crop === edFrame.crop))
  document.getElementById('crop-section').style.display = edFrame.mode !== 'none' ? '' : 'none'
  edRenderTL()
}

window.edSetFrame = (mode) => {
  edFrame.mode = mode
  document.querySelectorAll('.frame-btn[data-fr]').forEach(b => b.classList.toggle('active', b.dataset.fr === mode))
  document.getElementById('crop-section').style.display = mode !== 'none' ? '' : 'none'
  const stage = document.getElementById('ed-stage')
  stage.classList.toggle('framed', mode !== 'none')
  edResizeFrameCanvas()
  edSeekTo(edCurTime)
  edDrawCanvas()
}

window.edSetCrop = (crop) => {
  edFrame.crop = crop
  document.querySelectorAll('.frame-btn[data-crop]').forEach(b => b.classList.toggle('active', b.dataset.crop === crop))
  edDrawCanvas()
}

function edResizeFrameCanvas() {
  const cv = document.getElementById('ed-canvas')
  if (edFrame.mode === 'none') { cv.style.width = ''; cv.style.height = ''; return }
  // portrait 9:16 surface sized to the preview height
  const H = 340
  cv.style.height = H + 'px'
  cv.style.width = Math.round(H * 9 / 16) + 'px'
}

;['seeked','loadeddata','play'].forEach(ev =>
  document.getElementById('ed-vid')?.addEventListener(ev, () => { if (edFrame.mode !== 'none') edDrawCanvas() })
)

function edSelectClip(id) {
  edSel = { type: 'clip', id }; edShowProps('clip'); edRenderTL()
}

function edSelectText(id) {
  edSel = { type: 'text', id }
  const t = edTexts.find(x => x.id === id); if (!t) return
  edBuildStyleGrid()
  document.getElementById('ep-txt').value  = t.text
  document.getElementById('ep-tsz').value  = t.size || 48
  document.getElementById('ep-tcol').value = t.color || '#ffffff'
  document.getElementById('ep-scol').value = (t.strokeColor && t.strokeColor !== 'transparent') ? t.strokeColor : '#000000'
  document.getElementById('ep-sw').value   = t.strokeW || 0
  document.getElementById('ep-ts').value   = t.start
  document.getElementById('ep-te').value   = t.end
  document.getElementById('ep-tx').value   = t.x
  document.getElementById('ep-ty').value   = t.y
  document.querySelectorAll('.txt-style-btn').forEach(b => b.classList.toggle('active', b.dataset.key === (t.preset || 'tiktok')))
  edShowProps('text'); edRenderTL()
}

window.edUpdateText = () => {
  if (!edSel || edSel.type !== 'text') return
  const t = edTexts.find(x => x.id === edSel.id); if (!t) return
  t.text        = document.getElementById('ep-txt').value
  t.size        = parseFloat(document.getElementById('ep-tsz').value)
  t.color       = document.getElementById('ep-tcol').value
  t.strokeColor = document.getElementById('ep-scol').value
  t.strokeW     = parseFloat(document.getElementById('ep-sw').value)
  t.start       = parseFloat(document.getElementById('ep-ts').value) || 0
  t.end         = parseFloat(document.getElementById('ep-te').value) || 3
  t.x           = parseFloat(document.getElementById('ep-tx').value)
  t.y           = parseFloat(document.getElementById('ep-ty').value)
  edRenderTL(); edDrawCanvas()
}

window.edAudioVol = () => {
  if (edAudio) edAudio.volume = parseFloat(document.getElementById('ep-vol').value)
  if (edAudioEl) edAudioEl.volume = edAudio.volume
}

window.edAddText = () => {
  if (!edClips.length) return
  const id = 't' + Date.now()
  // In a frame, default to a clean caption in the top bar; otherwise TikTok style mid-low
  const framed = edFrame.mode !== 'none'
  const preset = framed ? (edFrame.mode === 'blur' ? 'tiktok' : 'subtitle') : 'tiktok'
  const s = ED_STYLES[preset]
  const t = { id, text: framed ? 'Your caption here' : 'YOUR TEXT',
    start: 0, end: edTotalDur || 3,
    x: 50, y: framed ? 11 : 80, size: framed ? 38 : 64,
    color: s.color, fontFamily: s.font,
    strokeColor: s.sc, strokeW: s.sw, glow: s.glow, glowColor: s.glowC, bgColor: s.bg, preset }
  edTexts.push(t); edSelectText(id); edRenderTL(); edDrawCanvas()
}

window.edSplit = () => {
  if (!edClips.length) return
  let t = 0
  for (let i = 0; i < edClips.length; i++) {
    const c = edClips[i]
    if (edCurTime >= t && edCurTime < t + c.trimDur) {
      const at = c.trimIn + (edCurTime - t)
      if (at <= c.trimIn + 0.1 || at >= c.trimOut - 0.1) break
      const nc = { id: 'c'+Date.now(), file: c.file, url: c.url, dur: c.dur, tStart: 0, trimIn: at, trimOut: c.trimOut, trimDur: 0 }
      c.trimOut = at; edClips.splice(i + 1, 0, nc); edRecalc(); edRenderTL(); break
    }
    t += c.trimDur
  }
}

window.edDeleteSelected = () => {
  if (!edSel) return
  if (edSel.type === 'clip') {
    edClips = edClips.filter(c => c.id !== edSel.id); edRecalc()
    if (!edClips.length) {
      document.getElementById('ed-empty').style.display = ''
      document.getElementById('ed-stage').style.display = 'none'
      document.getElementById('ed-timebar').style.display = 'none'
    }
  } else if (edSel.type === 'text') {
    edTexts = edTexts.filter(t => t.id !== edSel.id)
  } else if (edSel.type === 'audio') {
    edAudioEl?.pause(); edAudio = null
  }
  edSel = null; edShowProps(null); edRenderTL(); edDrawCanvas()
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
window.edExport = async () => {
  if (!edClips.length) return
  const btn = document.getElementById('ed-export-btn')
  btn.disabled = true
  setStatus('ed-export-status', 'Loading processor...', 'loading')
  try {
    if (!ffmpegLoaded) {
      const { createFFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js')
      ffmpegInst = createFFmpeg({ log: false })
      await ffmpegInst.load()
      ffmpegLoaded = true
    }
    const { fetchFile } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js')
    const ff = ffmpegInst
    setStatus('ed-export-status', 'Processing...', 'loading')

    // Write all clip files to ffmpeg FS
    for (let i = 0; i < edClips.length; i++) {
      ff.FS('writeFile', `src${i}.mp4`, await fetchFile(edClips[i].file))
    }

    const framed = edFrame.mode !== 'none'

    // Build eq filter
    const eq = `eq=brightness=${edFilters.br}:contrast=${1 + edFilters.ct}:saturation=${edFilters.sat}`

    // Landscape drawtext (only baked into base pass when NOT framed)
    const dtFilters = edTexts.map(t => {
      const esc = t.text.replace(/[\\':]/g, c => '\\' + c)
      const hex = (t.color || '#ffffff').replace('#', '')
      return `drawtext=text='${esc}':fontsize=${t.size||48}:fontcolor=0x${hex}:x=w*${t.x/100}-text_w/2:y=h*${t.y/100}-text_h/2:enable='between(t,${t.start},${t.end})'`
    }).join(',')

    const vf = framed ? eq : (dtFilters ? `${eq},${dtFilters}` : eq)
    const stageOut = framed ? 'stage.mp4' : 'out.mp4'

    if (edClips.length === 1) {
      const c = edClips[0]
      const args = ['-i','src0.mp4','-ss',c.trimIn.toFixed(3),'-to',c.trimOut.toFixed(3),'-vf',vf,'-c:v','libx264','-preset','ultrafast','-crf','23']
      if (edAudio) {
        ff.FS('writeFile', 'mus.mp3', await fetchFile(edAudio.file))
        args.push('-i','mus.mp3','-filter_complex',`[1:a]volume=${edAudio.volume}[a]`,'-map','0:v','-map','[a]','-c:a','aac','-shortest')
      } else { args.push('-an') }
      args.push(stageOut)
      await ff.run(...args)
    } else {
      // Trim each clip individually, then concat
      const trimFiles = []
      for (let i = 0; i < edClips.length; i++) {
        const c = edClips[i]; const fname = `tr${i}.mp4`
        await ff.run('-i',`src${i}.mp4`,'-ss',c.trimIn.toFixed(3),'-to',c.trimOut.toFixed(3),'-c','copy',fname)
        trimFiles.push(fname)
      }
      const enc = new TextEncoder()
      ff.FS('writeFile','list.txt', enc.encode(trimFiles.map(f => `file '${f}'`).join('\n')))
      const concatArgs = ['-f','concat','-safe','0','-i','list.txt','-vf',vf,'-c:v','libx264','-preset','ultrafast','-crf','23']
      if (edAudio) {
        ff.FS('writeFile','mus.mp3', await fetchFile(edAudio.file))
        concatArgs.push('-i','mus.mp3','-filter_complex',`[1:a]volume=${edAudio.volume}[a]`,'-map','0:v','-map','[a]','-c:a','aac','-shortest')
      } else { concatArgs.push('-an') }
      concatArgs.push(stageOut)
      await ff.run(...concatArgs)
    }

    // ── FRAME PASS: reframe stage.mp4 → 9:16 portrait with bg + caption ──
    if (framed) {
      setStatus('ed-export-status', 'Applying frame...', 'loading')
      const SF = 1080 / 640
      const cropFilter = edFrame.crop !== 'fit'
        ? (() => { const [cw,ch] = edFrame.crop.split(':').map(Number); const ar = cw/ch; return `crop=if(gt(a\\,${ar})\\,ih*${ar}\\,iw):if(gt(a\\,${ar})\\,ih\\,iw/${ar})` })()
        : null
      let fc
      if (edFrame.mode === 'blur') {
        const src = cropFilter ? `[0:v]${cropFilter}[cr];[cr]` : '[0:v]'
        fc = `${src}split=2[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:2[bg];[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`
      } else {
        const col = edFrame.mode === 'white' ? 'white' : 'black'
        const pre = cropFilter ? `${cropFilter},` : ''
        fc = `[0:v]${pre}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=${col}[v]`
      }
      const portraitDt = edTexts.map(t => {
        const esc = t.text.replace(/[\\':]/g, c => '\\' + c)
        const hex = (t.color || '#ffffff').replace('#', '')
        const fs = Math.round((t.size || 38) * SF)
        let s = `drawtext=text='${esc}':fontsize=${fs}:fontcolor=0x${hex}:x=w*${t.x/100}-text_w/2:y=h*${t.y/100}-text_h/2`
        if (t.strokeColor && t.strokeColor !== 'transparent' && t.strokeW > 0)
          s += `:bordercolor=0x${t.strokeColor.replace('#','')}:borderw=${Math.max(1, Math.round(t.strokeW * SF / 4))}`
        if (t.bgColor) s += `:box=1:boxcolor=black@0.6:boxborderw=20`
        s += `:enable='between(t,${t.start},${t.end})'`
        return s
      })
      let last = '[v]'
      if (portraitDt.length) { fc += `;[v]${portraitDt.join(',')}[vo]`; last = '[vo]' }
      await ff.run('-i','stage.mp4','-filter_complex',fc,'-map',last,'-map','0:a?','-c:v','libx264','-preset','ultrafast','-crf','23','-c:a','aac','out.mp4')
    }

    const data = ff.FS('readFile', 'out.mp4')
    // Cleanup
    try { ff.FS('unlink','out.mp4') } catch {}
    try { ff.FS('unlink','stage.mp4') } catch {}
    for (let i=0;i<edClips.length;i++) { try { ff.FS('unlink',`src${i}.mp4`) } catch {} try { ff.FS('unlink',`tr${i}.mp4`) } catch {} }
    try { ff.FS('unlink','list.txt') } catch {}
    try { ff.FS('unlink','mus.mp3') } catch {}

    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'clipzo_edit.mp4'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setStatus('ed-export-status', 'Exported!', 'ok')
    setTimeout(() => { document.getElementById('ed-export-status').style.display = 'none' }, 3000)
  } catch (e) {
    console.error('Editor export:', e)
    setStatus('ed-export-status', 'Export failed: ' + e.message, 'err')
  }
  btn.disabled = false
}


// ── AI REFRAME ────────────────────────────────────────────────────────────────
let rfAspect = '9:16'
let rfLayout = 'fill'
let rfFitCrop = 'original'
let rfJobId = null
let rfPollTimer = null
let rfLastSig = null   // last rendered settings signature, so flipping back to an
let rfLastUrl = null   // already-rendered combo redownloads instantly instead of re-encoding
let rfSourceUrl = null  // the URL currently loaded — used for thumbnail + clip preview
let rfSourceThumb = null // source video thumbnail, shown on each viral clip card

function rfSig() { return `${rfAspect}|${rfLayout}|${rfLayout === 'fit' ? rfFitCrop : ''}` }

window.setRfAspect = (a, btn) => {
  rfAspect = a
  document.querySelectorAll('#rf-aspect-row .rf-chip').forEach((b) => b.classList.remove('active'))
  btn.classList.add('active')
}
window.setRfLayout = (l, btn) => {
  rfLayout = l
  document.querySelectorAll('#rf-layout-row .rf-chip').forEach((b) => b.classList.remove('active'))
  btn.classList.add('active')
  // The Fit-crop sub-section only makes sense for the Fit layout — hide it
  // otherwise so the panel stays clean.
  document.getElementById('rf-fitcrop-section').style.display = l === 'fit' ? '' : 'none'
}
window.setRfFitCrop = (c, btn) => {
  rfFitCrop = c
  document.querySelectorAll('#rf-fitcrop-row .rf-chip').forEach((b) => b.classList.remove('active'))
  btn.classList.add('active')
}

window.startReframeAnalysis = async () => {
  const url = document.getElementById('rf-url').value.trim()
  if (!url) return setStatus('rf-status', 'Paste a video URL first', 'err')
  if (rfPollTimer) clearTimeout(rfPollTimer)
  rfJobId = null
  rfLastSig = null
  rfLastUrl = null
  rfSourceUrl = url
  rfSourceThumb = null
  document.getElementById('rf-result').style.display = 'none'
  document.getElementById('rf-options').style.display = 'none'
  document.getElementById('rf-options').style.opacity = '.4'
  document.getElementById('rf-options').style.pointerEvents = 'none'
  const btn = document.getElementById('rf-analyze-btn')
  btn.disabled = true
  setStatus('rf-status', 'Downloading & tracking the subject (this can take 30-90s)…', 'loading')
  // Fetch the thumbnail in parallel — purely cosmetic for the viral-clip cards,
  // so a failure here must never block the actual reframe analysis.
  api.download.info(url).then((info) => { rfSourceThumb = info?.thumbnail || null }).catch(() => {})
  try {
    const { jobId } = await api.reframe.start(url)
    rfJobId = jobId
    pollReframeJob()
  } catch (e) {
    setStatus('rf-status', e.needsPlan ? e.message + '. Upgrade to continue' : e.message, 'err')
    btn.disabled = false
  }
}

async function pollReframeJob() {
  if (!rfJobId) return
  try {
    const data = await api.reframe.poll(rfJobId)
    if (data.status === 'processing') {
      rfPollTimer = setTimeout(pollReframeJob, 2500)
      return
    }
    document.getElementById('rf-analyze-btn').disabled = false
    if (data.status === 'error') {
      setStatus('rf-status', data.error || 'Analysis failed', 'err')
      return
    }
    // ready — reveal aspect/layout/render controls + viral moments finder
    document.getElementById('rf-options').style.display = ''
    document.getElementById('rf-options').style.opacity = '1'
    document.getElementById('rf-options').style.pointerEvents = ''
    document.getElementById('rf-viral-section').style.display = ''
    document.querySelectorAll('[id^="rf-clip-render-"]').forEach((b) => { b.disabled = false })
    setStatus('rf-status', 'Video loaded. Pick a format and render, or find viral moments below.', 'ok')
    setTimeout(() => { const s = document.getElementById('rf-status'); if (s) s.style.display = 'none' }, 3000)
  } catch (e) {
    document.getElementById('rf-analyze-btn').disabled = false
    setStatus('rf-status', e.message, 'err')
  }
}

window.renderReframe = async () => {
  if (!rfJobId) return setStatus('rf-status', 'Load a video first', 'err')
  const btn = document.getElementById('rf-render-btn')
  const result = document.getElementById('rf-result')
  const sig = rfSig()
  btn.disabled = true
  setStatus('rf-status', sig === rfLastSig ? 'Loading…' : 'Rendering this format…', 'loading')
  try {
    const blobUrl = sig === rfLastSig && rfLastUrl ? rfLastUrl : await api.reframe.render(rfJobId, { aspect: rfAspect, layout: rfLayout, fitCrop: rfFitCrop })
    rfLastSig = sig
    rfLastUrl = blobUrl
    document.getElementById('rf-preview').src = blobUrl
    document.getElementById('rf-download').href = blobUrl
    result.style.display = ''
    setStatus('rf-status', 'Reframed!', 'ok')
    setTimeout(() => { const s = document.getElementById('rf-status'); if (s) s.style.display = 'none' }, 3000)
  } catch (e) {
    setStatus('rf-status', e.needsPlan ? e.message + '. Upgrade to continue' : e.message, 'err')
  } finally {
    btn.disabled = false
  }
}

// ── VIDEO DOWNLOADER ──────────────────────────────────────────────────────────
let dlInfo = null

window.fetchVideoInfo = async () => {
  const url = document.getElementById('dl-url').value.trim()
  if (!url) return setStatus('dl-status', 'Please enter a URL', 'err')
  const btn = document.getElementById('dl-fetch-btn')
  btn.disabled = true
  document.getElementById('dl-result').style.display = 'none'
  setStatus('dl-status', 'Fetching video info...', 'loading')
  try {
    dlInfo = await api.download.info(url)
    btn.disabled = false
    document.getElementById('dl-status').style.display = 'none'
    document.getElementById('dl-thumb').src = dlInfo.thumbnail || ''
    document.getElementById('dl-title').textContent = dlInfo.title || '(no title)'
    document.getElementById('dl-uploader').textContent = dlInfo.uploader ? `by ${dlInfo.uploader}` : (dlInfo.platform || '')
    const d = dlInfo.duration || 0
    const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = Math.floor(d%60)
    document.getElementById('dl-duration').textContent = d ? (h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`) : ''
    document.getElementById('dl-result').style.display = ''
  } catch (e) {
    btn.disabled = false
    setStatus('dl-status', e.message, 'err')
  }
}

window.downloadVideo = () => {
  const url = document.getElementById('dl-url').value.trim()
  if (!url) return
  const streamUrl = api.download.streamUrl(url)
  const a = document.createElement('a')
  a.href = streamUrl
  a.download = ((dlInfo?.title || 'video').replace(/[^\w\s-]/g, '').trim() || 'video') + '.mp4'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── VIDEO RANKING ───────────────────────────────────────────────────────────
let vrCards = [] // [{ link, file, streamUrl, duration, start, end, volume, clipTitle, loaded }]

function vrNewCard() {
  return { link: '', file: null, streamUrl: null, duration: 0, start: 0, end: 0, volume: 100, clipTitle: '', loaded: false }
}

function clampVrCount(input) {
  if (!input) return
  if (input.value === '' || input.value == null) return
  let v = parseInt(input.value, 10)
  if (Number.isNaN(v)) return
  v = Math.min(15, Math.max(2, v))
  input.value = String(v)
}

function vrUpdatePreviewStatus() {
  const st = document.getElementById('vr-preview-status')
  if (!st) return
  if (!vrCards.length) {
    st.textContent = 'Add videos to preview your ranking'
    return
  }
  const ready = vrCards.filter(c => c && (c.loaded || c.streamUrl || c.link)).length
  st.textContent = ready ? `${ready} of ${vrCards.length} videos ready` : 'Add videos to preview your ranking'
}

window.vrSetCount = () => {
  const input = document.getElementById('vr-count')
  if (!input || input.value === '' || input.value == null) return
  clampVrCount(input)
  const n = parseInt(input.value, 10)
  if (Number.isNaN(n)) return
  while (vrCards.length < n) vrCards.push(vrNewCard())
  vrCards.length = n
  vrRenderCards()
  window.vrSyncStage?.()
  vrUpdatePreviewStatus()
}

window.vrStepCount = (delta) => {
  const input = document.getElementById('vr-count')
  if (!input) return
  const cur = parseInt(input.value, 10)
  const base = Number.isNaN(cur) ? 3 : cur
  const next = Math.min(15, Math.max(2, base + (delta || 0)))
  input.value = String(next)
  vrSetCount()
}

function vrFmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

function vrTimelineTicks(dur) {
  if (dur <= 0) return ''
  const step = dur <= 10 ? 1 : dur <= 30 ? 2 : dur <= 120 ? 10 : 30
  const ticks = []
  for (let t = 0; t <= dur; t += step) ticks.push(`<span>${t.toFixed(1)}s</span>`)
  return ticks.join('')
}

// Pull any live values out of the current card inputs into the model before we
// rebuild the DOM, so edits (esp. the title) aren't wiped by a re-render. The
// oninput handlers don't always fire, so this is the source of truth.
function vrCaptureCardInputs() {
  vrCards.forEach((c, i) => {
    const t = document.getElementById(`vr-ctitle-${i}`)
    if (t) c.clipTitle = t.value
    const f = document.getElementById(`vr-cfont-${i}`)
    if (f) c._clipFont = f.value
    const s = document.getElementById(`vr-csize-${i}`)
    if (s) c._clipSize = s.value
    const col = document.getElementById(`vr-ccolor-${i}`)
    if (col) c._clipColor = col.value
  })
}

function vrRenderCards() {
  vrCaptureCardInputs()
  const wrap = document.getElementById('vr-cards')
  wrap.innerHTML = vrCards.map((c, i) => {
    const hasVideo = !!c.streamUrl
    const status = hasVideo ? 'File added' : (c.link ? 'Link added' : 'Empty')
    const statusCls = hasVideo || c.link ? ' is-ready' : ''
    return `
    <div class="vr-card" id="vr-card-${i}">
      <div class="vr-card-head" onclick="vrToggleCard(${i})">
        <div class="title">
          <svg id="vr-chevron-${i}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="transition:transform .15s"><polyline points="18 15 12 9 6 15"/></svg>
          Rank ${i + 1}
          <span class="vr-card-status${statusCls}">${status}</span>
        </div>
        <div class="vr-card-actions" onclick="event.stopPropagation()">
          ${hasVideo ? `<button onclick="vrClearVideo(${i})" title="Change video"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.68-9.72L1 10"/></svg></button>` : ''}
          <button onclick="vrRemoveCard(${i})" title="Remove"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
          <button onclick="vrMoveCard(${i},-1)" title="Move up"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
          <button onclick="vrMoveCard(${i},1)" title="Move down"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></button>
        </div>
      </div>
      <div class="vr-card-body" id="vr-card-body-${i}">
        ${hasVideo ? vrEditorHtml(c, i) : vrInputHtml(c, i)}
      </div>
    </div>`
  }).join('')

  // Attach loadedmetadata listeners for any videos that just rendered
  vrCards.forEach((c, i) => {
    if (c.streamUrl) {
      const vid = document.getElementById(`vr-vid-${i}`)
      if (vid && !c.loaded) {
        vid.addEventListener('loadedmetadata', () => {
          if (!c.duration) {
            c.duration = vid.duration
            c.end = vid.duration
            document.getElementById(`vr-end-${i}`).value = vid.duration.toFixed(1)
            const fill = document.getElementById(`vr-tl-fill-${i}`)
            if (fill) { fill.style.left = '0%'; fill.style.right = '0%' }
            const ticks = document.getElementById(`vr-tl-ticks-${i}`)
            if (ticks) ticks.innerHTML = vrTimelineTicks(vid.duration)
          }
          c.loaded = true
        })
      }
    }
  })
  window.vrSyncStage?.()
}

function vrInputHtml(c, i) {
  return `
    <div id="vr-input-area-${i}">
      <label class="vr-mini-label">Video Link</label>
      <div class="vr-link-row">
        <div class="platforms">📺 🎵 📷</div>
        <input type="text" placeholder="TikTok, Instagram, or YouTube video link" value="${c.link || ''}" oninput="vrCards[${i}].link=this.value"/>
        <button onclick="vrSubmitLink(${i})" id="vr-submit-btn-${i}">→</button>
      </div>
      <div id="vr-link-status-${i}" style="display:none;margin-top:8px" class="status"></div>
      <div class="vr-or">OR</div>
      <label class="vr-mini-label">Upload Video</label>
      <div class="upload-zone" id="vr-upload-${i}"
           onclick="document.getElementById('vr-file-${i}').click()"
           ondragover="event.preventDefault();this.classList.add('drag')"
           ondragleave="this.classList.remove('drag')"
           ondrop="vrHandleDrop(event,${i})">
        <div class="uz-icon">☁️</div>
        <p><strong>Choose a clip</strong> or drop it here</p>
        <p style="margin-top:2px;font-size:.72rem">MP4, up to 500MB</p>
      </div>
      <input type="file" id="vr-file-${i}" accept="video/mp4" style="display:none" onchange="vrHandleFile(event,${i})"/>
    </div>`
}

function vrEditorHtml(c, i) {
  const startPct = c.duration > 0 ? ((c.start / c.duration) * 100).toFixed(2) : '0'
  const endPct   = c.duration > 0 ? (100 - (c.end / c.duration) * 100).toFixed(2) : '0'
  return `
    <div class="vr-editor">
      <video id="vr-vid-${i}" controls src="${c.streamUrl}" preload="metadata" style="width:100%;max-height:320px;border-radius:10px;background:#000;display:block;margin:0 auto 14px"></video>

      <div class="vr-trim-row">
        <div class="vr-trim-pill"><span class="dot" style="background:#22c55e"></span>Start at <input id="vr-start-${i}" type="text" value="${c.start.toFixed(1)}" onchange="vrSetTrim(${i},'start',this.value)"/>s</div>
        <div class="vr-trim-pill"><span class="dot" style="background:#ef4444"></span>End at <input id="vr-end-${i}" type="text" value="${c.end.toFixed(1)}" onchange="vrSetTrim(${i},'end',this.value)"/>s</div>
        <div class="vr-vol-row">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
          Volume
          <input type="range" min="0" max="100" value="${c.volume}" oninput="vrCards[${i}].volume=parseInt(this.value)"/>
        </div>
      </div>

      <div class="vr-timeline" onclick="vrSeek(event,${i})">
        <div class="vr-timeline-fill" id="vr-tl-fill-${i}" style="left:${startPct}%;right:${endPct}%"></div>
        <div class="vr-timeline-ticks" id="vr-tl-ticks-${i}">${vrTimelineTicks(c.duration)}</div>
      </div>

      <div class="vr-tabs">
        <button class="vr-tab active" onclick="vrSwitchTab(${i},'title',this)">Video Title</button>
        <button class="vr-tab" onclick="vrSwitchTab(${i},'number',this)">Number Appearance</button>
        <button class="vr-tab" onclick="vrSwitchTab(${i},'size',this)">Size &amp; Position</button>
        <button class="vr-tab" onclick="vrSwitchTab(${i},'voiceover',this)">Voiceover</button>
        <button class="vr-tab" onclick="vrSwitchTab(${i},'transition',this)">Animation &amp; Transition</button>
        <button class="vr-tab" onclick="vrSwitchTab(${i},'sound',this)">Sound Effect</button>
      </div>

      <div id="vr-tabp-${i}-title" class="vr-tab-panel active">
        <label class="vr-mini-label">Video Title</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <select id="vr-cfont-${i}" class="vr-count-input" style="width:auto;padding:7px 10px" onchange="vrCards[${i}]._clipFont=this.value;vrSyncStage()">
            ${['Archivo Black','Montserrat','Anton','Bangers','Luckiest Guy'].map(f => `<option${(c._clipFont || 'Archivo Black') === f ? ' selected' : ''}>${f}</option>`).join('')}
          </select>
          <select id="vr-csize-${i}" class="vr-count-input" style="width:auto;padding:7px 10px" onchange="vrCards[${i}]._clipSize=this.value;vrSyncStage()">
            ${['16px','20px','24px','28px'].map(s => `<option${(c._clipSize || '20px') === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
          <input id="vr-ccolor-${i}" type="color" value="${c._clipColor || '#ffffff'}" style="width:28px;height:28px;border:none;border-radius:7px;background:none;cursor:pointer" onchange="vrCards[${i}]._clipColor=this.value;vrSyncStage()"/>
        </div>
        <input id="vr-ctitle-${i}" type="text" placeholder="Enter video title..." value="${c.clipTitle || ''}" style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:9px;color:#fff;font-size:.85rem;padding:11px 14px" oninput="vrCards[${i}].clipTitle=this.value;vrSyncStage()"/>
      </div>
      <div id="vr-tabp-${i}-number" class="vr-tab-panel">
        <p style="color:var(--muted);font-size:.78rem">Number appearance customisation coming soon.</p>
      </div>
      <div id="vr-tabp-${i}-size" class="vr-tab-panel">
        <p style="color:var(--muted);font-size:.78rem">Size &amp; position customisation coming soon.</p>
      </div>
      <div id="vr-tabp-${i}-voiceover" class="vr-tab-panel">
        <p style="color:var(--muted);font-size:.78rem">Per-clip voiceover coming soon.</p>
      </div>
      <div id="vr-tabp-${i}-transition" class="vr-tab-panel">
        <p style="color:var(--muted);font-size:.78rem">Animation &amp; transition effects coming soon.</p>
      </div>
      <div id="vr-tabp-${i}-sound" class="vr-tab-panel">
        <p style="color:var(--muted);font-size:.78rem">Sound effects coming soon.</p>
      </div>
    </div>`
}

window.vrToggleCard = (i) => {
  const body = document.getElementById(`vr-card-body-${i}`)
  const chev = document.getElementById(`vr-chevron-${i}`)
  const collapsed = body.style.display === 'none'
  body.style.display = collapsed ? '' : 'none'
  chev.style.transform = collapsed ? '' : 'rotate(180deg)'
}

window.vrRemoveCard = (i) => {
  if (vrCards[i].streamUrl?.startsWith('blob:')) URL.revokeObjectURL(vrCards[i].streamUrl)
  vrCards.splice(i, 1)
  document.getElementById('vr-count').value = vrCards.length
  vrRenderCards()
}

window.vrMoveCard = (i, dir) => {
  const j = i + dir
  if (j < 0 || j >= vrCards.length) return
  ;[vrCards[i], vrCards[j]] = [vrCards[j], vrCards[i]]
  vrRenderCards()
}

window.vrClearVideo = (i) => {
  if (vrCards[i].streamUrl?.startsWith('blob:')) URL.revokeObjectURL(vrCards[i].streamUrl)
  Object.assign(vrCards[i], vrNewCard())
  vrRenderCards()
}

window.vrSubmitLink = async (i) => {
  const input = document.querySelector(`#vr-card-body-${i} .vr-link-row input[type=text]`)
  const link = (input?.value || vrCards[i].link || '').trim()
  if (!link) return
  vrCards[i].link = link
  const btn = document.getElementById(`vr-submit-btn-${i}`)
  const statusEl = document.getElementById(`vr-link-status-${i}`)
  btn.disabled = true
  btn.textContent = '…'
  statusEl.style.display = 'block'
  statusEl.className = 'status loading'
  statusEl.textContent = 'Fetching video info…'
  try {
    const info = await api.download.info(link)
    const streamUrl = api.download.streamUrl(link)
    Object.assign(vrCards[i], {
      streamUrl,
      duration: info.duration || 0,
      start: 0,
      end: info.duration || 0,
      loaded: false,
    })
    vrPreviewIdx = i
    vrRenderCards()
  } catch (e) {
    statusEl.className = 'status err'
    statusEl.textContent = e.message || 'Failed to fetch video'
    btn.disabled = false
    btn.textContent = '→'
  }
}

window.vrHandleFile = (e, i) => {
  const file = e.target.files?.[0]
  if (!file) return
  const objectUrl = URL.createObjectURL(file)
  Object.assign(vrCards[i], {
    file,
    streamUrl: objectUrl,
    duration: 0,
    start: 0,
    end: 0,
    loaded: false,
  })
  vrPreviewIdx = i
  vrRenderCards()
}

window.vrHandleDrop = (e, i) => {
  e.preventDefault()
  e.currentTarget.classList.remove('drag')
  const file = e.dataTransfer.files?.[0]
  if (!file) return
  const objectUrl = URL.createObjectURL(file)
  Object.assign(vrCards[i], {
    file,
    streamUrl: objectUrl,
    duration: 0,
    start: 0,
    end: 0,
    loaded: false,
  })
  vrPreviewIdx = i
  vrRenderCards()
}

window.vrSetTrim = (i, which, val) => {
  const v = Math.max(0, parseFloat(val) || 0)
  const c = vrCards[i]
  if (which === 'start') { c.start = Math.min(v, c.end - 0.5) }
  else { c.end = c.duration > 0 ? Math.min(v, c.duration) : v; if (c.end <= c.start) c.end = c.start + 0.5 }
  const fill = document.getElementById(`vr-tl-fill-${i}`)
  if (fill && c.duration > 0) {
    fill.style.left  = ((c.start / c.duration) * 100).toFixed(2) + '%'
    fill.style.right  = (100 - (c.end / c.duration) * 100).toFixed(2) + '%'
  }
}

window.vrSeek = (e, i) => {
  const vid = document.getElementById(`vr-vid-${i}`)
  const rect = e.currentTarget.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  if (vid && vrCards[i].duration > 0) vid.currentTime = pct * vrCards[i].duration
}

window.vrSwitchTab = (i, tab, btn) => {
  const tabs = ['title','number','size','voiceover','transition','sound']
  tabs.forEach(t => {
    const panel = document.getElementById(`vr-tabp-${i}-${t}`)
    if (panel) panel.classList.toggle('active', t === tab)
  })
  btn.closest('.vr-tabs').querySelectorAll('.vr-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
}

function vrStrokeShadow(color, width) {
  if (!width || width <= 0) return 'none'
  const steps = []
  const n = 8
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    steps.push(`${(Math.cos(a) * width).toFixed(1)}px ${(Math.sin(a) * width).toFixed(1)}px 0 ${color}`)
  }
  return steps.join(',')
}

window.vrRenderTitlePreview = () => {
  const raw = document.getElementById('vr-title-text')?.value || ''
  const text = raw.trim()
  const font = document.getElementById('vr-title-font').value
  const size = document.getElementById('vr-title-size').value
  const color = document.getElementById('vr-title-color').value
  const strokeColor = document.getElementById('vr-stroke-color').value
  const strokeWidth = parseFloat(document.getElementById('vr-stroke-width').value) || 0

  const preview = document.getElementById('vr-title-preview')
  if (preview) {
    preview.textContent = text || 'Enter your ranking title'
    preview.style.fontFamily = font
    preview.style.fontSize = size
    preview.style.color = text ? color : 'rgba(255,255,255,.35)'
    preview.style.fontWeight = text ? '800' : '600'
    preview.style.textShadow = text ? vrStrokeShadow(strokeColor, strokeWidth) : 'none'
  }

  const stageTitle = document.getElementById('vr-stage-title')
  if (stageTitle) {
    stageTitle.textContent = text || 'Your ranking title'
    stageTitle.classList.toggle('is-placeholder', !text)
    stageTitle.style.fontFamily = font
    stageTitle.style.fontSize = `clamp(.7rem, ${parseFloat(size) / 22}rem, 1.3rem)`
    stageTitle.style.color = text ? color : 'rgba(255,255,255,.28)'
    stageTitle.style.fontWeight = text ? '800' : '600'
    stageTitle.style.textShadow = text ? vrStrokeShadow(strokeColor, strokeWidth) : 'none'
  }
}

let vrPreviewIdx = 0
const VR_NUM_COLORS = ['c0','c1','c2','c3','c4']

window.vrSyncStage = () => {
  const stage = document.getElementById('vr-stage')
  const inner = document.getElementById('vr-stage-inner')
  const time = document.getElementById('vr-stage-time')
  if (!stage || !inner) return

  const bgColor = document.getElementById('vr-bg-color').value
  const hexEl = document.getElementById('vr-bg-hex')
  if (hexEl) hexEl.value = bgColor.toUpperCase()
  stage.style.background = bgColor

  const n = vrCards.length
  let totalDur = 0
  vrCards.forEach(c => { if (c.duration) totalDur += (c.end || c.duration) - (c.start || 0) })
  const mins = Math.floor(totalDur / 60)
  const secs = Math.floor(totalDur % 60)
  if (time) time.textContent = `0:00 / ${mins}:${String(secs).padStart(2, '0')}`

  if (n && vrPreviewIdx >= n) vrPreviewIdx = 0
  const loadedIdxs = vrCards.map((c, i) => c.streamUrl ? i : -1).filter(x => x >= 0)
  if (loadedIdxs.length && !loadedIdxs.includes(vrPreviewIdx)) vrPreviewIdx = loadedIdxs[0]
  const cur = n ? (vrCards[vrPreviewIdx] || {}) : {}
  const anyReady = loadedIdxs.length > 0

  let html = ''
  if (cur.streamUrl) {
    html += `<video src="${cur.streamUrl}" muted preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`
  }

  if (n > 0) {
    const ranks = vrCards.map((c, i) => {
      const colorCls = VR_NUM_COLORS[i % VR_NUM_COLORS.length]
      const thumb = c.streamUrl
        ? `<video src="${c.streamUrl}" muted preload="metadata"></video>`
        : `<span class="vr-stage-thumb-ph">Empty</span>`
      return `<div class="vr-stage-rank-row">
        <span class="vr-stage-badge ${colorCls}">${i + 1}</span>
        <div class="vr-stage-thumb">${thumb}</div>
      </div>`
    }).join('')
    html += `<div class="vr-stage-list">${ranks}</div>`
  }

  if (!anyReady) {
    html += `<div class="vr-stage-empty"><span>Add videos to preview your ranking</span></div>`
  }

  inner.innerHTML = html
  window.vrRenderTitlePreview?.()
  vrUpdatePreviewStatus()
}

window.vrSyncFromHex = () => {
  const hex = document.getElementById('vr-bg-hex').value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    document.getElementById('vr-bg-color').value = hex
    vrSyncStage()
  }
}

window.vrGenerate = async () => {
  const countInput = document.getElementById('vr-count')
  if (countInput && (countInput.value === '' || countInput.value == null)) {
    alert('Add at least 2 videos before generating.')
    return
  }
  if (vrCards.length < 2) {
    alert('Add at least 2 videos before generating.')
    return
  }
  for (let i = 0; i < vrCards.length; i++) {
    if (!vrCards[i].streamUrl && !vrCards[i].link?.trim() && !vrCards[i].file) {
      alert(`Video Rank ${i + 1} is empty. Add a link or upload a file first.`)
      return
    }
  }

  const btn       = document.getElementById('vr-generate-btn')
  const statusEl  = document.getElementById('vr-generate-status')
  const stepEl    = document.getElementById('vr-status-step')
  const pctEl     = document.getElementById('vr-status-pct')
  const bar       = document.getElementById('vr-progress-bar')
  const dlBtn     = document.getElementById('vr-download-btn')

  const setStep = (text, pct) => {
    stepEl.textContent = text
    pctEl.textContent  = pct + '%'
    bar.style.width    = pct + '%'
    bar.style.background = 'linear-gradient(90deg,var(--a1),var(--a2))'
  }

  btn.disabled        = true
  statusEl.style.display = 'block'
  dlBtn.style.display    = 'none'
  setStep('Starting…', 2)

  try {
    // 1. Upload any local file cards to get storage URLs
    const resolved = []
    for (let i = 0; i < vrCards.length; i++) {
      let url = vrCards[i].link?.trim() || ''
      if (!url && vrCards[i].file) {
        setStep(`Uploading clip ${i + 1} of ${vrCards.length}…`, 5 + Math.round((i / vrCards.length) * 15))
        const fd = new FormData()
        fd.append('file', vrCards[i].file)
        const result = await window._api.upload.file(fd)
        url = result.url
      }
      const c = vrCards[i]
      // Read title + its styling straight from the DOM (oninput/onchange don't
      // always populate the model — same reason vrSubmitLink reads the input).
      const clipTitle  = (document.getElementById(`vr-ctitle-${i}`)?.value ?? c.clipTitle ?? '').trim()
      const titleFont  = document.getElementById(`vr-cfont-${i}`)?.value  ?? c._clipFont  ?? 'Archivo Black'
      const titleSize  = document.getElementById(`vr-csize-${i}`)?.value  ?? c._clipSize  ?? '20px'
      const titleColor = document.getElementById(`vr-ccolor-${i}`)?.value ?? c._clipColor ?? '#ffffff'
      c.clipTitle = clipTitle
      resolved.push({
        url,
        rank:      i + 1, // 1-based rank (card order); drives the number column
        start:     c.start || 0,
        end:       c.end || 0,
        volume:    c.volume ?? 100,
        clipTitle,
        titleFont,
        titleSize,
        titleColor,
      })
    }

    // 2. Playback order: default = reverse (build-up to rank 1 last), custom = as-is
    const customOrder   = document.getElementById('vr-custom-order').checked
    const orderedVideos = customOrder ? resolved : [...resolved].reverse()

    // 3. Collect title + settings from the form
    const title = {
      text:        document.getElementById('vr-title-text').value.trim(),
      font:        document.getElementById('vr-title-font').value,
      size:        document.getElementById('vr-title-size').value,
      color:       document.getElementById('vr-title-color').value,
      strokeColor: document.getElementById('vr-stroke-color').value,
      strokeWidth: parseInt(document.getElementById('vr-stroke-width').value) || 0,
    }
    const settings = {
      bgColor:    document.getElementById('vr-bg-color').value,
      heightPct:  parseInt(document.getElementById('vr-height').value) || 80,
      caption:    document.getElementById('vr-enable-caption').checked,
    }

    // 4. Kick off the backend job
    setStep('Starting job…', 22)
    const { jobId } = await window._api.ranking.start({ videos: orderedVideos, title, settings })

    // 5. Poll until done
    await new Promise((resolve, reject) => {
      const tick = setInterval(async () => {
        try {
          const { status, step, progress, error } = await window._api.ranking.poll(jobId)
          if (status === 'error') { clearInterval(tick); reject(new Error(error || 'Processing failed')); return }
          setStep(step || 'Processing…', Math.max(22, progress || 0))
          if (status === 'done') { clearInterval(tick); resolve() }
        } catch (e) { clearInterval(tick); reject(e) }
      }, 2500)
    })

    // 6. Ready — wire download button
    setStep('Ready!', 100)
    dlBtn.style.display = 'block'
    dlBtn.onclick = async () => {
      dlBtn.disabled = true
      dlBtn.querySelector('svg + *') // just reference; update textContent directly
      const orig = dlBtn.innerHTML
      dlBtn.textContent = 'Preparing download…'
      try {
        const objectUrl = await window._api.ranking.download(jobId)
        const a = document.createElement('a')
        a.href = objectUrl; a.download = 'ranking-video.mp4'; a.click()
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      } catch (e) {
        alert('Download failed: ' + e.message)
      } finally {
        dlBtn.innerHTML  = orig
        dlBtn.disabled   = false
      }
    }
  } catch (err) {
    setStep('Error: ' + err.message, 0)
    bar.style.background = '#ef4444'
  } finally {
    btn.disabled = false
  }
}

;(function initVrPanel() {
  const count = document.getElementById('vr-count')
  if (count) count.value = ''
  const title = document.getElementById('vr-title-text')
  if (title) title.value = ''
  vrCards = []
  const cards = document.getElementById('vr-cards')
  if (cards) cards.innerHTML = ''
  window.vrRenderTitlePreview?.()
  window.vrSyncStage?.()
})()

let clipFormat = 'original'  // 'original'|'blur'|'black'|'white'
let clipCropRatio = 'fit'    // 'fit'|'16:9'|'4:3'|'1:1'|'3:4'

window.setClipFormat = (fmt) => {
  clipFormat = fmt
  document.querySelectorAll('.clip-fmt-btn').forEach(b => b.classList.toggle('active', b.dataset.fmt === fmt))
  document.getElementById('clip-crop-row').style.display = fmt === 'original' ? 'none' : ''
  const labels = { original: 'Export clip (16:9)', blur: 'Export 9:16 Blur', black: 'Export 9:16 Black', white: 'Export 9:16 White' }
  const btn = document.getElementById('clip-export-btn')
  if (btn) {
    const svg = btn.querySelector('svg')?.outerHTML || ''
    btn.innerHTML = svg + ' ' + (labels[fmt] || 'Export clip')
  }
  // Match the caption position pad to the chosen output aspect ratio.
  const pad = document.getElementById('clip-cap-pad')
  if (pad) {
    pad.style.aspectRatio = fmt === 'original' ? '16/9' : '9/16'
    pad.style.width = fmt === 'original' ? '240px' : '160px'
  }
}

window.setClipCrop = (crop) => {
  clipCropRatio = crop
  document.querySelectorAll('.clip-crop-btn').forEach(b => b.classList.toggle('active', b.dataset.crop === crop))
}

// ── Shared "Font & stroke settings" panel — used by Captions, Clipper, and the
// viral per-clip controls. Each instance is addressed by a unique idPrefix and
// keeps its own custom={font,sizePct,outline,outlineWidthPct} object.
const CAP_FONTS = [
  ['', 'Auto (style default)'],
  ['Anton', 'Anton'],
  ['Bangers', 'Bangers'],
  ['Montserrat', 'Montserrat'],
  ['Baloo 2 ExtraBold', 'Baloo 2'],
  ['Permanent Marker', 'Permanent Marker'],
  ['Luckiest Guy', 'Luckiest Guy'],
  ['TikTok Sans 18pt', 'TikTok Sans'],
]
function capSettingsHTML(idPrefix) {
  return `<div class="cap-settings">
    <button type="button" class="cap-settings-toggle" onclick="toggleCapSettings('${idPrefix}',this)">🎨 Captions</button>
    <div class="cap-settings-body" id="${idPrefix}-settings-body" style="display:none">
      <div class="cap-set-row">
        <label>Font Size</label>
        <input type="range" min="0" max="100" value="50" id="${idPrefix}-size" data-touched="0" oninput="onCapSizeInput('${idPrefix}')"/>
      </div>
      <div class="cap-set-row">
        <label>Stroke</label>
        <div class="cap-stroke-row">
          <button type="button" class="cap-swatch active" data-color="#000000" data-touched="0" style="background:#000" onclick="setCapStrokeColor('${idPrefix}','#000000',this)" title="Black stroke"></button>
          <button type="button" class="cap-swatch" data-color="#ffffff" data-touched="0" style="background:#fff" onclick="setCapStrokeColor('${idPrefix}','#ffffff',this)" title="White stroke"></button>
          <input type="range" min="0" max="100" value="50" id="${idPrefix}-stroke-width" data-touched="0" oninput="onCapStrokeWidthInput('${idPrefix}')"/>
        </div>
      </div>
      <div class="cap-set-row" id="${idPrefix}-case-row">
        <label>Capitalization</label>
        <div class="cap-stroke-row">
          <button type="button" class="cap-case-btn active" data-upper="0" data-touched="0" onclick="setCapCase('${idPrefix}',false,this)">Normal</button>
          <button type="button" class="cap-case-btn" data-upper="1" data-touched="0" onclick="setCapCase('${idPrefix}',true,this)">CAPS</button>
        </div>
      </div>
    </div>
  </div>`
}
// Fill the static settings slots (standalone Captions panel + Clipper) once.
// The viral per-clip slots are filled per card inside cvRenderResults instead.
document.getElementById('cap-settings-slot')?.insertAdjacentHTML('beforeend', capSettingsHTML('cap'))
document.getElementById('clip-cap-settings-slot')?.insertAdjacentHTML('beforeend', capSettingsHTML('clip-cap'))

window.toggleCapSettings = (prefix, btn) => {
  const body = document.getElementById(`${prefix}-settings-body`)
  if (!body) return
  const open = body.style.display === 'none'
  body.style.display = open ? '' : 'none'
  // Also toggle the style-preset row that sits in the same logical section so
  // styles + fonts/size/stroke open and close together as one "Captions" group.
  const stylesRow = document.getElementById(`${prefix}-styles-row`)
  if (stylesRow) stylesRow.style.display = open ? '' : 'none'
  btn?.classList.toggle('active', open)
}
// Only a control the user has actually touched should override the style
// preset's tuned defaults — e.g. the Font Size slider sits at 50 visually,
// but if we always sent that as sizePct it would silently blow up presets
// like Headline (whose default heightPct is much smaller than the generic
// 50%-slider value), starving the line-wrap math down to ~1 word per line.
function readCapCustom(prefix) {
  const sizeEl = document.getElementById(`${prefix}-size`)
  const strokeWEl = document.getElementById(`${prefix}-stroke-width`)
  const activeSwatch = document.querySelector(`#${prefix}-settings-body .cap-swatch.active`)
  const activeCase = document.querySelector(`#${prefix}-settings-body .cap-case-btn.active`)
  return {
    sizePct: sizeEl?.dataset.touched === '1' ? Number(sizeEl.value) : undefined,
    outlineWidthPct: strokeWEl?.dataset.touched === '1' ? Number(strokeWEl.value) : undefined,
    outline: activeSwatch?.dataset.touched === '1' ? activeSwatch.dataset.color : undefined,
    upper: activeCase?.dataset.touched === '1' ? activeCase.dataset.upper === '1' : undefined,
  }
}
// Store the freshly-read custom settings into the right place for this prefix,
// and (when this instance has a position-pad chip) refresh the live preview.
window.onCapCustomChange = (prefix) => {
  const custom = readCapCustom(prefix)
  let chipId = null, style = null
  if (prefix === 'cap') {
    capCustom = custom // standalone Captions panel has no position-pad chip
  } else if (prefix === 'clip-cap') {
    clipCaptionCustom = custom
    chipId = 'clip-cap-chip'
    style = clipCaptionStyle
  } else {
    const m = /^cv-cap-(\d+)$/.exec(prefix)
    if (m) {
      cvSettings[Number(m[1])].custom = custom
      chipId = `cv-chip-${m[1]}`
      style = cvSettings[Number(m[1])].style
    }
  }
  const chip = chipId && document.getElementById(chipId)
  if (chip) applyCustomPreview(chip, style, custom)
}
window.onCapSizeInput = (prefix) => {
  const el = document.getElementById(`${prefix}-size`)
  if (el) el.dataset.touched = '1'
  onCapCustomChange(prefix)
}
window.onCapStrokeWidthInput = (prefix) => {
  const el = document.getElementById(`${prefix}-stroke-width`)
  if (el) el.dataset.touched = '1'
  onCapCustomChange(prefix)
}
window.setCapCase = (prefix, upper, btn) => {
  document.querySelectorAll(`#${prefix}-settings-body .cap-case-btn`).forEach((b) => b.classList.remove('active'))
  btn.classList.add('active')
  btn.dataset.touched = '1'
  onCapCustomChange(prefix)
}
window.setCapStrokeColor = (prefix, color, btn) => {
  document.querySelectorAll(`#${prefix}-settings-body .cap-swatch`).forEach((b) => b.classList.remove('active'))
  btn.classList.add('active')
  btn.dataset.touched = '1'
  onCapCustomChange(prefix)
}

// ── Clip auto-captions ─────────────────────────────────────────────────────────
let clipCaptionsOn = false
let clipCaptionStyle = 'karaoke'
let clipCaptionPos = { x: 0.5, y: 0.72 } // 0..1 within the output frame
let clipCaptionCustom = null // { font, sizePct, outline, outlineWidthPct } manual overrides

window.toggleClipCaptions = (on) => {
  clipCaptionsOn = on
  document.getElementById('clip-caption-section').style.display = on ? '' : 'none'
}

// Make the "CAPTIONS" preview chip render in the selected style's real font/colour.
const CAP_STYLE_PREVIEW = {
  karaoke:        { font: "'Anton',sans-serif",         color: '#16ff5d', upper: true,  box: false },
  karaoke_yellow: { font: "'Anton',sans-serif",         color: '#ffe000', upper: true,  box: false },
  clean:          { font: "'Montserrat',sans-serif",    color: '#ffffff', upper: false, box: false, weight: 700 },
  boxed:          { font: "'Montserrat',sans-serif",    color: '#ffffff', upper: false, box: true,  weight: 700 },
  bangers:        { font: "'Bangers',cursive",          color: '#ffffff', upper: true,  box: false },
  random:         { font: "'Anton',sans-serif",         color: '#16ff5d', upper: true,  box: false, multi: ['#16ff5d', '#ffffff', '#ffa200', '#ff66ff'] },
  rounded:        { font: "'Baloo 2',sans-serif",       color: '#ffffff', upper: false, box: false, weight: 800 },
  meme:           { font: "'Luckiest Guy',cursive",     color: '#ff0000', upper: true,  box: false, outline: '#ffe000' },
  neon:           { font: "'Baloo 2',sans-serif",       color: '#e93cb2', upper: true,  box: false, weight: 800 },
  script:         { font: "'Permanent Marker',cursive", color: '#ff0000', upper: false, box: false },
  alternate:      { font: "'Anton',sans-serif",         color: '#16ff5d', upper: true,  box: false, multi: ['#16ff5d', '#ffffff'] },
  badge:          { font: "'Baloo 2',sans-serif",       color: '#ffffff', upper: false, box: true, bg: '#7c3aed', weight: 800 },
  headline:       { font: "'TikTok Sans 18pt',sans-serif", color: '#000000', upper: false, box: true, bg: '#ffffff', radius: '12px', weight: 700 },
  font_anton:      { font: "'Anton',sans-serif",            color: '#ffffff', upper: false, box: false },
  font_bangers:    { font: "'Bangers',cursive",             color: '#ffffff', upper: false, box: false },
  font_montserrat: { font: "'Montserrat',sans-serif",       color: '#ffffff', upper: false, box: false, weight: 700 },
  font_baloo:      { font: "'Baloo 2',sans-serif",          color: '#ffffff', upper: false, box: false, weight: 800 },
  font_marker:     { font: "'Permanent Marker',cursive",    color: '#ffffff', upper: false, box: false },
  font_luckiest:   { font: "'Luckiest Guy',cursive",        color: '#ffffff', upper: false, box: false },
  font_tiktok:     { font: "'TikTok Sans 18pt',sans-serif", color: '#ffffff', upper: false, box: false, weight: 700 },
}
function applyChipStyle(chip, style) {
  if (!chip) return
  const p = CAP_STYLE_PREVIEW[style] || CAP_STYLE_PREVIEW.karaoke
  chip.style.fontFamily = p.font
  chip.style.fontWeight = p.weight || 400
  chip.style.color = p.color
  chip.style.textTransform = p.upper ? 'uppercase' : 'none'
  chip.style.fontSize = '.95rem'
  chip.style.letterSpacing = '.5px'
  chip.style.background = p.box ? (p.bg || 'rgba(0,0,0,.7)') : 'transparent'
  chip.style.boxShadow = 'none'
  chip.style.borderRadius = p.radius || ''
  // Thick coloured or black outline so text reads on the dark pad — mirrors the burned caption look.
  const oc = p.outline || '#000'
  chip.style.textShadow = p.box ? 'none' : `-1.5px -1.5px 0 ${oc},1.5px -1.5px 0 ${oc},-1.5px 1.5px 0 ${oc},1.5px 1.5px 0 ${oc}`
  // Multi-colour styles (Random/Alternate): paint each letter a different colour.
  if (p.multi) {
    const text = chip.textContent.replace(/<[^>]+>/g, '')
    chip.innerHTML = text.split('').map((ch, i) =>
      `<span style="color:${p.multi[i % p.multi.length]}">${ch}</span>`
    ).join('')
  } else if (chip.querySelector('span')) {
    chip.textContent = chip.textContent // strip any leftover per-letter spans
  }
}

// Layer the user's font/size/stroke/case overrides on top of the chosen
// style's baseline chip preview, so dragging the sliders reflects live.
function applyCustomPreview(chip, style, custom) {
  if (!chip) return
  applyChipStyle(chip, style)
  if (custom.font) chip.style.fontFamily = `'${custom.font}',sans-serif`
  if (typeof custom.upper === 'boolean') chip.style.textTransform = custom.upper ? 'uppercase' : 'none'
  if (Number.isFinite(custom.sizePct)) {
    chip.style.fontSize = (0.6 + (custom.sizePct / 100) * 0.8) + 'rem'
  }
  if (custom.outline === 'none') {
    chip.style.textShadow = 'none'
  } else if (custom.outline || Number.isFinite(custom.outlineWidthPct)) {
    const oc = custom.outline || (CAP_STYLE_PREVIEW[style]?.outline || '#000')
    const w = Number.isFinite(custom.outlineWidthPct) ? (custom.outlineWidthPct / 100) * 3 : 1.5
    chip.style.textShadow = `-${w}px -${w}px 0 ${oc},${w}px -${w}px 0 ${oc},-${w}px ${w}px 0 ${oc},${w}px ${w}px 0 ${oc}`
  }
}

window.setClipCaptionStyle = (s, btn) => {
  clipCaptionStyle = s
  document.querySelectorAll('#clip-cap-styles .cap-style-btn').forEach(b => b.classList.remove('active'))
  btn?.classList.add('active')
  applyChipStyle(document.getElementById('clip-cap-chip'), s)
}

// Drag the caption chip around the pad to set its position (x,y as 0..1).
;(function initCaptionPad() {
  const pad = document.getElementById('clip-cap-pad')
  const chip = document.getElementById('clip-cap-chip')
  if (!pad || !chip) return
  let dragging = false
  const place = (clientX, clientY) => {
    const r = pad.getBoundingClientRect()
    let x = (clientX - r.left) / r.width
    let y = (clientY - r.top) / r.height
    x = Math.min(0.98, Math.max(0.02, x))
    y = Math.min(0.98, Math.max(0.02, y))
    clipCaptionPos = { x, y }
    chip.style.left = x * 100 + '%'
    chip.style.top = y * 100 + '%'
  }
  const down = (e) => { dragging = true; chip.setPointerCapture?.(e.pointerId); e.preventDefault() }
  const move = (e) => { if (dragging) place(e.clientX, e.clientY) }
  const up = () => { dragging = false }
  chip.addEventListener('pointerdown', down)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  // Tapping anywhere on the pad also moves the caption there.
  pad.addEventListener('pointerdown', (e) => { if (e.target !== chip) place(e.clientX, e.clientY) })
  applyChipStyle(chip, clipCaptionStyle)
})()

// Orchestrate captioning a produced clip blob: upload -> transcribe -> burn.
// Returns an object URL for the captioned video.
async function captionizeBlob(blob, baseName, opts = {}) {
  const statusId = opts.statusId || 'clip-status'
  const style = opts.style || clipCaptionStyle
  const position = opts.position || clipCaptionPos
  // 'custom' may be legitimately null (no manual overrides for this clip) — only
  // fall back to the Clipper's global custom settings when the key is omitted.
  const custom = 'custom' in opts ? opts.custom : clipCaptionCustom
  setStatus(statusId, 'Uploading clip for captioning…', 'loading')
  const fd = new FormData()
  fd.append('file', new File([blob], (baseName || 'clip') + '.mp4', { type: 'video/mp4' }))
  const up = await api.upload.file(fd)

  setStatus(statusId, 'Transcribing audio…', 'loading')
  const t = await api.transcribe.start(up.url)
  const jobId = t.job_id
  let result = null
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const p = await api.transcribe.poll(jobId)
    if (p.status === 'completed') { result = p; break }
    if (p.status === 'error') { result = { failed: true }; break }
    setStatus(statusId, `Transcribing audio… ${i * 3}s`, 'loading')
  }
  if (!result) throw new Error('Transcription timed out. Try a shorter clip')

  // No speech (silence) or couldn't transcribe → export the clip clean, no text.
  const usable = !result.failed && (result.words || [])
    .filter((w) => w.text && w.text.trim() && (w.confidence == null || w.confidence >= 0.35)).length > 0
  if (!usable) {
    setStatus(statusId, 'No speech detected. Exported without captions', 'ok')
    return URL.createObjectURL(blob)
  }

  setStatus(statusId, 'Burning captions onto your clip…', 'loading')
  return api.caption.burn(jobId, up.url, style, position, custom)
}

// Fill the title/meta line on the exported-clip card.
function fillClipOutputMeta(durSec, captioned) {
  const fmtLabel = clipFormat === 'original' ? '16:9' : `9:16 ${clipFormat}`
  document.getElementById('clip-output-meta').innerHTML =
    `<span>⏱ ${durSec.toFixed(1)}s</span><span>· ${fmtLabel}</span>` +
    (captioned ? '<span style="color:var(--a2)">· captioned</span>' : '')
}

window.openLastClipInEditor = async () => {
  const vid = document.getElementById('clip-output-video')
  if (!vid?.src) return setStatus('clip-status', 'Export a clip first, then click Edit', 'err')
  await openClipInEditor(null)
}

window.exportClip = async () => {
  const btn = document.getElementById('clip-export-btn')

  // Server-side clip for URL sources — downloads only the selected range
  if (clipMode === 'url') {
    if (!clipSourceUrl) return
    btn.disabled = true
    document.getElementById('clip-output').style.display = 'none'
    const fmtNote = clipFormat === 'original'
      ? 'Clipping on server… only your selected range is downloaded'
      : `Clipping on server in 9:16 ${clipFormat} frame… this re-encodes so it takes a bit longer`
    setStatus('clip-status', fmtNote, 'loading')
    try {
      const res = await fetch(api.download.clipUrl(clipSourceUrl, clipInPoint.toFixed(2), clipOutPoint.toFixed(2), clipFormat, clipCropRatio))
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const e = new Error(err.message || err.error || 'Server clip failed')
        e.needsPlan = res.status === 402
        throw e
      }
      const blob = await res.blob()
      const base = `clip_${clipInPoint.toFixed(1)}-${clipOutPoint.toFixed(1)}`
      const url = clipCaptionsOn ? await captionizeBlob(blob, base) : URL.createObjectURL(blob)
      document.getElementById('clip-output-video').src = url
      document.getElementById('clip-dl').href = url
      document.getElementById('clip-dl').download = `${base}${clipCaptionsOn ? '_captioned' : ''}.mp4`
      fillClipOutputMeta(clipOutPoint - clipInPoint, clipCaptionsOn)
      document.getElementById('clip-output').style.display = ''
      setStatus('clip-status','Done!','ok')
    } catch(e) {
      setStatus('clip-status', e.needsPlan ? e.message + '. Upgrade to continue' : (e.message || 'Clip failed'), 'err')
    }
    btn.disabled = false
    return
  }

  if (!clipFile) return
  btn.disabled = true
  document.getElementById('clip-output').style.display = 'none'
  setStatus('clip-status','','loading')

  try {
    // Lazy-load ffmpeg.wasm
    if (!ffmpegLoaded) {
      document.getElementById('ffmpeg-loading').style.display = ''
      setStatus('clip-status','Loading processor...','loading')
      const { createFFmpeg, fetchFile } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js')
      ffmpegInst = createFFmpeg({ log: false })
      await ffmpegInst.load()
      ffmpegLoaded = true
      document.getElementById('ffmpeg-loading').style.display = 'none'
    }

    setStatus('clip-status','Exporting clip...','loading')
    const { fetchFile } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js')
    const ffmpeg = ffmpegInst

    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(clipFile))
    await ffmpeg.run(
      '-i', 'input.mp4',
      '-ss', clipInPoint.toFixed(3),
      '-to', clipOutPoint.toFixed(3),
      '-c', 'copy',
      'output.mp4'
    )
    const data = ffmpeg.FS('readFile', 'output.mp4')
    ffmpeg.FS('unlink', 'input.mp4')
    ffmpeg.FS('unlink', 'output.mp4')

    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    const base = `clip_${clipInPoint.toFixed(1)}-${clipOutPoint.toFixed(1)}`
    const url = clipCaptionsOn ? await captionizeBlob(blob, base) : URL.createObjectURL(blob)
    document.getElementById('clip-output-video').src = url
    document.getElementById('clip-dl').href = url
    document.getElementById('clip-dl').download = `${base}${clipCaptionsOn ? '_captioned' : ''}.mp4`
    fillClipOutputMeta(clipOutPoint - clipInPoint, clipCaptionsOn)
    document.getElementById('clip-output').style.display = ''
    setStatus('clip-status','Done!','ok')
  } catch(e) {
    console.error(e)
    setStatus('clip-status', e.needsPlan ? e.message + '. Upgrade to continue' : ('Export failed: ' + e.message), 'err')
  }
  btn.disabled = false
}

window.openClipInEditor = async (frameMode) => {
  const vid = document.getElementById('clip-output-video')
  if (!vid?.src) return
  try {
    const blob = await fetch(vid.src).then(r => r.blob())
    const fileName = document.getElementById('clip-dl').download || 'clip.mp4'
    const file = new File([blob], fileName, { type: 'video/mp4' })
    const url = URL.createObjectURL(file)
    const dur = await getEdVidDur(url)
    const id = 'c' + Date.now() + Math.random().toString(36).slice(2, 6)
    edClips.push({ id, file, url, dur, tStart: 0, trimIn: 0, trimOut: dur, trimDur: dur })
    edRecalc()
    edRenderTL()
    edShowPreview()
    edLoadAt(0)
    const navBtn = document.querySelector('[data-panel="editor"]')
    switchPanel('editor', navBtn)
    if (frameMode) {
      setTimeout(() => edSetFrame(frameMode), 300)
    }
  } catch (e) {
    console.error('openClipInEditor:', e)
  }
}

// ── VIRAL MOMENTS (Video Clipper) ────────────────────────────────────────────
let cvJobId = null
let cvPollTimer = null
let cvClips = []
let cvGenre = 'auto' // selected content genre — steers the Claude scoring prompt

// Genre chips for "Find Viral Moments" — keyed values match the backend's
// GENRE_HINTS map in autoclip.js. Each click swaps which scoring criteria
// Claude uses to rank moments (sports look for big plays, podcasts look for
// hot takes, etc.). 'auto' lets the AI guess.
const CV_GENRES = [
  ['auto', '🤖', 'Let AI detect'],
  ['podcast', '🎙️', 'Podcast'], ['lifestyle', '🌿', 'Lifestyle'], ['vlog', '🎬', 'Vlog'], ['travel', '✈️', 'Travel'],
  ['food', '🍔', 'Food & Cooking'], ['beauty', '💄', 'Beauty & Fashion'], ['fitness', '🏋️', 'Fitness'], ['sports', '🏅', 'Sports'],
  ['basketball', '🏀', 'Basketball'], ['soccer', '⚽', 'Soccer'], ['football', '🏈', 'American football'], ['marketing', '📈', 'Marketing & Webinar'],
  ['talking', '🗣️', 'Talking head & Speech'], ['motivational', '💪', 'Motivational speech'], ['commentary', '💬', 'Commentary'],
  ['interview', '🎤', 'Interview'], ['entertainment', '🎭', 'Entertainment'], ['movies', '🎞️', 'Movies'], ['drama', '🎭', 'Drama shows'],
  ['reality', '📺', 'Reality & Talk shows'], ['news', '📰', 'News'], ['educational', '📚', 'Informative & Educational'],
  ['product', '📦', 'Product reviews'], ['history', '🏛️', 'History'], ['science', '🔬', 'Science & Tech'], ['music', '🎵', 'Music'], ['gaming', '🎮', 'Gaming'],
  ['other', '🔄', 'Other'],
]

// Build the genre chips on first paint and bind the click handler.
;(function initCvGenres() {
  const row = document.getElementById('clip-viral-genres')
  if (!row) return
  row.innerHTML = CV_GENRES.map(([k, ic, l]) =>
    `<button class="cv-genre-btn${k === 'auto' ? ' active' : ''}" data-genre="${k}" onclick="setCvGenre('${k}',this)">${ic} ${l}</button>`
  ).join('')
})()

// Clamp the Clips number input to 1-15 so the user can't push past the limit
// (also prevents an empty/NaN value from breaking the analyze request).
window.clampClipCount = (el) => {
  let n = parseInt(el.value, 10)
  if (!Number.isFinite(n)) n = 5
  n = Math.min(15, Math.max(1, n))
  if (String(n) !== el.value) el.value = String(n)
}

window.setCvGenre = (g, btn) => {
  cvGenre = g
  document.querySelectorAll('#clip-viral-genres .cv-genre-btn').forEach((b) => b.classList.remove('active'))
  btn?.classList.add('active')
  const sel = document.getElementById('clip-content-type')
  if (sel) {
    const opt = [...sel.options].find((o) => o.value === g)
    sel.value = opt ? g : 'auto'
  }
}

// ── AI REFRAME — Find Viral Moments (per-clip aspect/layout) ──────────────────
let rfViralJobId = null
let rfViralGenre = 'auto'
let rfClips = []
let rfClipSettings = []

;(function initRfGenres() {
  const row = document.getElementById('rf-viral-genres')
  if (!row) return
  row.innerHTML = CV_GENRES.map(([k, ic, l]) =>
    `<button class="cv-genre-btn${k === 'auto' ? ' active' : ''}" data-genre="${k}" onclick="setRfViralGenre('${k}',this)">${ic} ${l}</button>`
  ).join('')
})()

window.setRfViralGenre = (g, btn) => {
  rfViralGenre = g
  document.querySelectorAll('#rf-viral-genres .cv-genre-btn').forEach((b) => b.classList.remove('active'))
  btn?.classList.add('active')
}

window.rfFindViral = async () => {
  const url = document.getElementById('rf-url').value.trim()
  if (!url) return
  const btn = document.getElementById('rf-viral-btn')
  btn.disabled = true
  rfClips = []
  document.getElementById('rf-viral-results').style.display = 'none'
  setStatus('rf-viral-status', 'Analyzing speech for viral moments (this may take a minute)...', 'loading')
  try {
    const { jobId } = await api.download.analyze(url)
    rfViralJobId = jobId
    rfPollViral()
  } catch (e) {
    setStatus('rf-viral-status', e.message, 'err')
    btn.disabled = false
  }
}

function rfPollViral() {
  const count = parseInt(document.getElementById('rf-viral-count').value) || 5
  setTimeout(async () => {
    try {
      const result = await api.autoclip.poll(rfViralJobId, count, rfViralGenre)
      if (result.status === 'completed') {
        document.getElementById('rf-viral-btn').disabled = false
        rfRenderViralResults(result)
        document.getElementById('rf-viral-status').style.display = 'none'
      } else if (result.status === 'error') {
        document.getElementById('rf-viral-btn').disabled = false
        setStatus('rf-viral-status', result.error || 'Analysis failed', 'err')
      } else {
        setStatus('rf-viral-status', `Analyzing for viral moments... (${result.status})`, 'loading')
        rfPollViral()
      }
    } catch (e) {
      document.getElementById('rf-viral-btn').disabled = false
      setStatus('rf-viral-status', e.message, 'err')
    }
  }, 3000)
}

function rfRenderViralResults(result) {
  rfClips = result.clips || []
  rfClipSettings = rfClips.map(() => ({ aspect: '9:16', layout: 'fill', fitCrop: 'original', captionsOn: false, style: 'karaoke', pos: { x: 0.5, y: 0.72 }, custom: null, lastSig: null, lastUrl: null, rawUrl: null }))
  document.getElementById('rf-viral-results').style.display = ''
  const list = document.getElementById('rf-viral-list')
  if (!rfClips.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:12px">No viral moments detected. Try a longer video with more speech.</div>'
    return
  }
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
  const thumbBg = rfSourceThumb ? `background-image:url('${rfSourceThumb}');background-size:cover;background-position:center;` : 'background:var(--card);'
  list.innerHTML = rfClips.map((clip, i) => {
    const dur = clip.duration || (clip.end - clip.start)
    return `<div id="rf-clip-${i}" class="clip-card">
      <div class="cv-thumb" onclick="rfPreviewOne(${i})" title="Click to preview this clip" style="width:128px;flex-shrink:0;align-self:flex-start;aspect-ratio:9/16;${thumbBg}border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,.4)"></div>
        <div style="position:absolute;top:6px;left:6px;background:var(--a1);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:.66rem;font-weight:700;color:#ffffff;z-index:1">${i+1}</div>
        <svg width="30" height="30" fill="currentColor" viewBox="0 0 24 24" style="color:#fff;opacity:.92;position:relative;z-index:1"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      </div>
      <div class="clip-card-info" style="flex:1">
        <div class="clip-card-title">#${i+1} Viral Moment</div>
        <div class="clip-card-meta">
          <span class="clip-card-score">🔥 ${clip.rank}/100</span>
          <span>· ${Math.round(dur)}s</span>
          <span class="cv-time-edit">
            · <button class="cv-time-btn" onclick="rfClipAdjustTime(${i},'start',-1)">−</button>
            <span id="rf-clip-start-${i}">${fmt(clip.start)}</span>
            <button class="cv-time-btn" onclick="rfClipAdjustTime(${i},'start',1)">+</button>
            – <button class="cv-time-btn" onclick="rfClipAdjustTime(${i},'end',-1)">−</button>
            <span id="rf-clip-end-${i}">${fmt(clip.end)}</span>
            <button class="cv-time-btn" onclick="rfClipAdjustTime(${i},'end',1)">+</button>
          </span>
        </div>
        <div class="clip-card-desc">"${clip.text}"</div>
        <div class="cv-ctrl-label">Aspect ratio</div>
        <div class="cv-mini-row" id="rf-clip-aspect-row-${i}">
          ${['9:16','1:1','16:9','4:5'].map(a => `<button class="cv-mini-btn ${a==='9:16'?'active':''}" onclick="rfClipSetAspect(${i},'${a}',this)">${a}</button>`).join('')}
        </div>
        <div class="cv-ctrl-label">Applicable auto layout</div>
        <div class="rf-chip-row" id="rf-clip-layout-row-${i}" style="margin-bottom:2px">
          <button class="rf-chip active" data-layout="fill" onclick="rfClipSetLayout(${i},'fill',this)">⛶ Fill</button>
          <button class="rf-chip" data-layout="fit" onclick="rfClipSetLayout(${i},'fit',this)">▣ Fit</button>
          <button class="rf-chip" data-layout="gameplay" onclick="rfClipSetLayout(${i},'gameplay',this)">🎮 Gameplay</button>
        </div>
        <label class="cv-cap-toggle"><input type="checkbox" onchange="toggleRfItemCaptions(${i},this.checked)"/> 🔥 Add captions</label>
        <div id="rf-cap-sec-${i}" style="display:none;margin-top:6px">
          <div id="rf-cap-${i}-styles-row">
            <div class="cv-mini-row" style="margin-bottom:0">
              ${CV_STYLES.map(([k, l], j) => `<button class="cap-style-btn cv-mini-btn ${j === 0 ? 'active' : ''}" data-style="${k}" onclick="setRfItemStyle(${i},'${k}',this)">${l}</button>`).join('')}
            </div>
          </div>
          <div style="font-size:.66rem;color:var(--muted);margin-bottom:4px;margin-top:8px">Drag the caption where you want it</div>
          <div class="cap-pad" id="rf-pad-${i}" style="width:110px"><div class="cap-chip" id="rf-cap-chip-${i}">Captions</div></div>
        </div>
        <div class="clip-card-actions" style="margin-top:10px">
          <button class="btn btn-primary btn-sm" id="rf-clip-render-${i}" onclick="rfClipRender(${i})" ${rfJobId ? '' : 'disabled'}>
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Render &amp; Download
          </button>
        </div>
        <div id="rf-clip-result-${i}" style="display:none;margin-top:10px">
          <video controls style="width:100%;max-width:220px;border-radius:8px;background:#000;display:block"></video>
        </div>
      </div>
    </div>`
  }).join('')
  // Wire each card's caption position pad + default chip font.
  rfClips.forEach((_, i) => {
    initRfItemPad(i)
    applyChipStyle(document.getElementById(`rf-cap-chip-${i}`), rfClipSettings[i].style)
  })
}

// Click-to-preview on a viral clip's thumbnail — mirrors cvPreviewOne. For
// YouTube sources it embeds the player at the exact moment (no server render);
// for everything else it cuts the raw clip once (cached) and plays it.
window.rfPreviewOne = async (i) => {
  const clip = rfClips[i]
  if (!clip || !rfSourceUrl) return
  const modal = document.getElementById('cv-preview-modal')
  const body = document.getElementById('cv-preview-body')
  const vid = ytId(rfSourceUrl)

  if (vid) {
    const start = Math.max(0, Math.floor(clip.start))
    const end = Math.ceil(clip.end)
    body.innerHTML =
      `<div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden">` +
      `<iframe src="https://www.youtube.com/embed/${vid}?start=${start}&end=${end}&autoplay=1&rel=0" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe></div>` +
      `<p style="text-align:center;color:#aaa;font-size:.74rem;margin-top:10px">Preview of the moment. Your rendered clip uses the aspect ratio &amp; layout you pick.</p>`
    modal.style.display = 'flex'
    return
  }

  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#fff;gap:10px"><div class="spinner"></div> Loading preview…</div>'
  modal.style.display = 'flex'
  try {
    let url = rfClipSettings[i].rawUrl
    if (!url) {
      const res = await fetch(api.download.clipUrl(rfSourceUrl, clip.start.toFixed(2), clip.end.toFixed(2)))
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const er = new Error(e.message || e.error || 'Preview failed'); er.needsPlan = res.status === 402; throw er
      }
      url = URL.createObjectURL(await res.blob())
      rfClipSettings[i].rawUrl = url
    }
    body.innerHTML = `<video src="${url}" controls autoplay playsinline style="width:100%;max-height:75vh;border-radius:10px;background:#000"></video>`
  } catch (e) {
    body.innerHTML = `<p style="color:#fff;text-align:center;padding:24px">${e.needsPlan ? e.message + '. Upgrade to continue' : e.message}</p>`
  }
}

window.rfClipAdjustTime = (i, field, delta) => {
  const clip = rfClips[i]
  if (!clip) return
  const next = clip[field] + delta
  if (field === 'start' && (next < 0 || next >= clip.end)) return
  if (field === 'end' && (next <= clip.start)) return
  clip[field] = next
  document.getElementById(`rf-clip-${field}-${i}`).textContent = `${Math.floor(next/60)}:${String(Math.floor(next%60)).padStart(2,'0')}`
  rfClipSettings[i].lastSig = null // invalidate cache — times changed
  rfClipSettings[i].rawUrl = null
}

window.rfClipSetAspect = (i, a, btn) => {
  rfClipSettings[i].aspect = a
  document.querySelectorAll(`#rf-clip-aspect-row-${i} .cv-mini-btn`).forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
}
window.rfClipSetLayout = (i, l, btn) => {
  rfClipSettings[i].layout = l
  document.querySelectorAll(`#rf-clip-layout-row-${i} .rf-chip`).forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
}

window.toggleRfItemCaptions = (i, on) => {
  rfClipSettings[i].captionsOn = on
  document.getElementById(`rf-cap-sec-${i}`).style.display = on ? '' : 'none'
}
window.setRfItemStyle = (i, s, btn) => {
  rfClipSettings[i].style = s
  document.querySelectorAll(`#rf-cap-sec-${i} .cap-style-btn`).forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  applyChipStyle(document.getElementById(`rf-cap-chip-${i}`), s)
}
// Drag-to-place pad for one card's caption chip — mirrors initCvItemPad.
function initRfItemPad(i) {
  const pad = document.getElementById(`rf-pad-${i}`)
  const chip = document.getElementById(`rf-cap-chip-${i}`)
  if (!pad || !chip) return
  let dragging = false
  const place = (cx, cy) => {
    const r = pad.getBoundingClientRect()
    const x = Math.min(0.98, Math.max(0.02, (cx - r.left) / r.width))
    const y = Math.min(0.98, Math.max(0.02, (cy - r.top) / r.height))
    rfClipSettings[i].pos = { x, y }
    chip.style.left = x * 100 + '%'
    chip.style.top = y * 100 + '%'
  }
  chip.addEventListener('pointerdown', (e) => { dragging = true; chip.setPointerCapture?.(e.pointerId); e.preventDefault() })
  chip.addEventListener('pointermove', (e) => { if (dragging) place(e.clientX, e.clientY) })
  chip.addEventListener('pointerup', () => { dragging = false })
  pad.addEventListener('pointerdown', (e) => { if (e.target !== chip) place(e.clientX, e.clientY) })
}

function rfClipSettingsSig(s, clip) {
  return JSON.stringify({
    a: s.aspect, l: s.layout, st: clip.start, en: clip.end, cap: s.captionsOn,
    cst: s.captionsOn ? s.style : null,
    pos: s.captionsOn ? s.pos : null,
    cu: s.captionsOn ? (s.custom || null) : null,
  })
}

window.rfClipRender = async (i) => {
  // Guard: per-clip render must only run once viral clips are loaded AND the
  // underlying reframe analysis job is ready (rfJobId is set once analysis completes).
  if (!rfClips.length || !rfClips[i]) return
  if (!rfJobId) return setStatus('rf-viral-status', 'The video is still loading. Wait for "Video loaded" above.', 'err')
  const s = rfClipSettings[i]
  const clip = rfClips[i]
  const sig = rfClipSettingsSig(s, clip)
  const btn = document.getElementById(`rf-clip-render-${i}`)
  const result = document.getElementById(`rf-clip-result-${i}`)
  btn.disabled = true
  try {
    let blobUrl
    if (sig === s.lastSig && s.lastUrl) {
      blobUrl = s.lastUrl
    } else {
      const rawUrl = await api.reframe.render(rfJobId, {
        aspect: s.aspect, layout: s.layout, fitCrop: s.fitCrop, start: clip.start, end: clip.end,
      })
      if (s.captionsOn) {
        setStatus('rf-viral-status', `Adding captions to clip ${i + 1}…`, 'loading')
        const rawBlob = await (await fetch(rawUrl)).blob()
        blobUrl = await captionizeBlob(rawBlob, `viral_clip_${i + 1}`, {
          statusId: 'rf-viral-status', style: s.style, position: s.pos, custom: s.custom,
        })
        document.getElementById('rf-viral-status').style.display = 'none'
      } else {
        blobUrl = rawUrl
      }
    }
    s.lastSig = sig
    s.lastUrl = blobUrl
    const video = result.querySelector('video')
    video.src = blobUrl
    result.style.display = ''
    const a = document.createElement('a'); a.href = blobUrl; a.download = `viral-clip-${i+1}${s.captionsOn ? '_captioned' : ''}.mp4`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  } catch (e) {
    setStatus('rf-viral-status', e.needsPlan ? e.message + '. Upgrade to continue' : e.message, 'err')
  } finally {
    btn.disabled = false
  }
}

window.clipFindViral = async () => {
  if (!clipSourceUrl) return
  const btn = document.getElementById('clip-viral-btn')
  btn.disabled = true
  cvClips = []
  document.getElementById('clip-viral-results').style.display = 'none'
  setStatus('clip-viral-status', 'Downloading & analyzing video (this may take a minute)...', 'loading')
  try {
    const { jobId } = await api.download.analyze(clipSourceUrl)
    cvJobId = jobId
    cvPollViral()
  } catch (e) {
    setStatus('clip-viral-status', e.message, 'err')
    btn.disabled = false
  }
}

function cvPollViral() {
  clearTimeout(cvPollTimer)
  const count = parseInt(document.getElementById('clip-viral-count').value) || 5
  cvPollTimer = setTimeout(async () => {
    try {
      const result = await api.autoclip.poll(cvJobId, count, cvGenre)
      if (result.status === 'completed') {
        document.getElementById('clip-viral-btn').disabled = false
        cvRenderResults(result)
        document.getElementById('clip-viral-status').style.display = 'none'
      } else if (result.status === 'error') {
        document.getElementById('clip-viral-btn').disabled = false
        setStatus('clip-viral-status', result.error || 'Analysis failed', 'err')
      } else {
        setStatus('clip-viral-status', `Analyzing for viral moments... (${result.status})`, 'loading')
        cvPollViral()
      }
    } catch (e) {
      document.getElementById('clip-viral-btn').disabled = false
      setStatus('clip-viral-status', e.message, 'err')
    }
  }, 3000)
}

// Per-clip settings: each viral clip carries its own format/captions/position.
let cvSettings = []
const CV_FMTS = [['original', '16:9'], ['blur', '9:16 Blur'], ['black', '9:16 Black'], ['white', '9:16 White']]
const CV_STYLES = [
  ['karaoke', '🟢 Green'], ['karaoke_yellow', '🟡 Yellow'], ['clean', '⬜ Clean'], ['boxed', '▪️ Box'], ['bangers', '💥 Comic'],
  ['random', '🌈 Random'], ['rounded', '🔵 Rounded'], ['meme', '😂 Meme'], ['neon', '💖 Neon'], ['script', '✍️ Script'], ['alternate', '🔁 Alt'], ['badge', '🏷️ Badge'], ['headline', '📰 Headline'],
  ['font_anton', 'Aa Anton'], ['font_bangers', 'Aa Bangers'], ['font_montserrat', 'Aa Mont'], ['font_baloo', 'Aa Baloo'], ['font_marker', 'Aa Marker'], ['font_luckiest', 'Aa Lucky'], ['font_tiktok', 'Aa TikTok'],
]

// A small visual mockup of what a chosen output format looks like. Uses the
// source thumbnail (or a gradient placeholder) as the stand-in clip.
function cvFmtEl(cls, thumb, style = '') {
  return thumb
    ? `<img class="${cls}" src="${thumb}" style="${style}" alt=""/>`
    : `<div class="${cls}" style="${style};background:linear-gradient(135deg,#5b3fa0,#9a7be0)"></div>`
}
// Height of the centered main clip as a % of the 9:16 frame, for a given crop.
// The clip fills the frame width, so height% = (9/16) / cropAspectRatio.
const CV_CROP_AR = { fit: 16 / 9, '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '3:4': 3 / 4 }
function cvFgHeightPct(crop) {
  const ar = CV_CROP_AR[crop] || 16 / 9
  return Math.min(96, ((9 / 16) / ar) * 100)
}
function fmtPreviewHTML(format, thumb, crop) {
  if (format === 'original') return `<div class="fmtp fmtp-wide">${cvFmtEl('cover', thumb)}</div>`
  const bgColor = format === 'white' ? '#fff' : '#000'
  const bg = format === 'blur' ? cvFmtEl('cover blur', thumb) : ''
  const fg = cvFmtEl('fg', thumb, `height:${cvFgHeightPct(crop).toFixed(1)}%`)
  return `<div class="fmtp fmtp-tall" style="background:${bgColor}">${bg}${fg}</div>`
}

function cvRenderResults(result) {
  cvClips = result.clips || []
  cvSettings = cvClips.map(() => ({ format: 'original', crop: 'fit', captionsOn: false, style: 'karaoke', pos: { x: 0.5, y: 0.72 }, custom: null }))
  document.getElementById('clip-viral-results').style.display = ''
  document.getElementById('clip-viral-dl-all').style.display = cvClips.length > 1 ? '' : 'none'
  const list = document.getElementById('clip-viral-list')
  if (!cvClips.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:12px">No viral moments detected. Try a longer video with more speech.</div>'
    return
  }
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
  const thumbBg = document.getElementById('clip-thumb')?.src
  list.innerHTML = cvClips.map((clip, i) => {
    const dur = clip.duration || (clip.end - clip.start)
    const bg = thumbBg ? `background-image:url('${thumbBg}');background-size:cover;background-position:center;` : 'background:var(--card);'
    return `<div id="cv-item-${i}" class="clip-card">
      <div class="cv-thumb" onclick="cvPreviewOne(${i})" title="Click to preview this clip" style="width:128px;flex-shrink:0;align-self:flex-start;aspect-ratio:9/16;${bg}border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,.4)"></div>
        <div style="position:absolute;top:6px;left:6px;background:var(--a1);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:.66rem;font-weight:700;color:#ffffff;z-index:1">${i+1}</div>
        <svg width="30" height="30" fill="currentColor" viewBox="0 0 24 24" style="color:#fff;opacity:.92;position:relative;z-index:1"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      </div>
      <div class="clip-card-info">
        <div class="clip-card-title">#${i+1} Viral Moment</div>
        <div class="clip-card-meta">
          <span class="clip-card-score">🔥 ${clip.rank}/100</span>
          <span>· <span id="cv-dur-${i}">${Math.round(dur)}</span>s</span>
          <span class="cv-time-edit">
            ·
            <button class="cv-time-btn" onclick="cvAdjustTime(${i},'start',-1)" title="Trim 1s off the start">−</button>
            <span id="cv-start-${i}">${fmt(clip.start)}</span>
            <button class="cv-time-btn" onclick="cvAdjustTime(${i},'start',1)" title="Add 1s before the start">+</button>
            –
            <button class="cv-time-btn" onclick="cvAdjustTime(${i},'end',-1)" title="Trim 1s off the end">−</button>
            <span id="cv-end-${i}">${fmt(clip.end)}</span>
            <button class="cv-time-btn" onclick="cvAdjustTime(${i},'end',1)" title="Add 1s past the end">+</button>
          </span>
        </div>
        <div class="clip-card-desc">"${clip.text}"</div>
        <div class="cv-ctrl-label">Format</div>
        <div class="cv-mini-row">
          ${CV_FMTS.map(([f, l]) => `<button class="cv-mini-btn ${f === 'original' ? 'active' : ''}" onclick="setCvItemFormat(${i},'${f}',this)">${l}</button>`).join('')}
        </div>
        <div class="cv-fmt-preview" id="cv-fmt-prev-${i}">${fmtPreviewHTML('original', thumbBg)}</div>
        <div id="cv-crop-${i}" style="display:none">
          <div class="cv-ctrl-label">Crop main clip</div>
          <div class="cv-mini-row">
            ${['fit', '16:9', '4:3', '1:1', '3:4'].map(c => `<button class="cv-mini-btn ${c === 'fit' ? 'active' : ''}" onclick="setCvItemCrop(${i},'${c}',this)">${c === 'fit' ? 'Fit' : c}</button>`).join('')}
          </div>
        </div>
        <label class="cv-cap-toggle"><input type="checkbox" onchange="toggleCvItemCaptions(${i},this.checked)"/> 🔥 Add captions</label>
        <div id="cv-cap-sec-${i}" style="display:none;margin-top:6px">
          <div id="cv-cap-settings-slot-${i}"></div>
          <div id="cv-cap-${i}-styles-row" style="display:none;margin-top:8px">
            <div class="cv-mini-row" style="margin-bottom:0">
              ${CV_STYLES.map(([k, l], j) => `<button class="cap-style-btn cv-mini-btn ${j === 0 ? 'active' : ''}" data-style="${k}" onclick="setCvItemStyle(${i},'${k}',this)">${l}</button>`).join('')}
            </div>
          </div>
          <div style="font-size:.66rem;color:var(--muted);margin-bottom:4px;margin-top:8px">Drag the caption where you want it</div>
          <div class="cap-pad" id="cv-pad-${i}" style="width:110px"><div class="cap-chip" id="cv-chip-${i}">Captions</div></div>
        </div>
        <div class="clip-card-actions">
          <button class="btn btn-primary btn-sm" id="cv-render-${i}" style="display:inline-flex" onclick="cvDownloadOne(${i})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Render &amp; Download
          </button>
          <button class="btn btn-ghost btn-sm" onclick="cvEditClip(${clip.start},${clip.end})" style="gap:4px">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
            Edit
          </button>
        </div>
      </div>
    </div>`
  }).join('')
  // Wire each card's caption position pad + default chip font.
  cvClips.forEach((_, i) => {
    initCvItemPad(i)
    applyChipStyle(document.getElementById(`cv-chip-${i}`), cvSettings[i].style)
    const slot = document.getElementById(`cv-cap-settings-slot-${i}`)
    if (slot) slot.innerHTML = capSettingsHTML(`cv-cap-${i}`)
  })
}

// ── Per-clip control handlers ───────────────────────────────────────────────────
window.setCvItemFormat = (i, f, btn) => {
  cvSettings[i].format = f
  const card = document.getElementById(`cv-item-${i}`)
  card.querySelectorAll('.cv-mini-row .cv-mini-btn:not(.cap-style-btn)').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  const pad = document.getElementById(`cv-pad-${i}`)
  if (pad) pad.style.aspectRatio = f === 'original' ? '16/9' : '9/16'
  const prev = document.getElementById(`cv-fmt-prev-${i}`)
  if (prev) prev.innerHTML = fmtPreviewHTML(f, document.getElementById('clip-thumb')?.src, cvSettings[i].crop)
  // Crop only applies when reframing to 9:16.
  const crop = document.getElementById(`cv-crop-${i}`)
  if (crop) crop.style.display = f === 'original' ? 'none' : ''
}
window.setCvItemCrop = (i, c, btn) => {
  cvSettings[i].crop = c
  document.querySelectorAll(`#cv-crop-${i} .cv-mini-btn`).forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  // Reflect the crop in the format preview (the centered clip resizes).
  const prev = document.getElementById(`cv-fmt-prev-${i}`)
  if (prev) prev.innerHTML = fmtPreviewHTML(cvSettings[i].format, document.getElementById('clip-thumb')?.src, c)
}
window.toggleCvItemCaptions = (i, on) => {
  cvSettings[i].captionsOn = on
  document.getElementById(`cv-cap-sec-${i}`).style.display = on ? '' : 'none'
}
window.setCvItemStyle = (i, s, btn) => {
  cvSettings[i].style = s
  document.querySelectorAll(`#cv-cap-sec-${i} .cap-style-btn`).forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  applyChipStyle(document.getElementById(`cv-chip-${i}`), s)
}
// Drag-to-place pad for one card (chip uses pointer capture, so listeners stay on
// the chip and are cleaned up when the list re-renders — no window-listener leak).
function initCvItemPad(i) {
  const pad = document.getElementById(`cv-pad-${i}`)
  const chip = document.getElementById(`cv-chip-${i}`)
  if (!pad || !chip) return
  let dragging = false
  const place = (cx, cy) => {
    const r = pad.getBoundingClientRect()
    const x = Math.min(0.98, Math.max(0.02, (cx - r.left) / r.width))
    const y = Math.min(0.98, Math.max(0.02, (cy - r.top) / r.height))
    cvSettings[i].pos = { x, y }
    chip.style.left = x * 100 + '%'
    chip.style.top = y * 100 + '%'
  }
  chip.addEventListener('pointerdown', (e) => { dragging = true; chip.setPointerCapture?.(e.pointerId); e.preventDefault() })
  chip.addEventListener('pointermove', (e) => { if (dragging) place(e.clientX, e.clientY) })
  chip.addEventListener('pointerup', () => { dragging = false })
  pad.addEventListener('pointerdown', (e) => { if (e.target !== chip) place(e.clientX, e.clientY) })
}

window.cvJumpTo = (start, end) => {
  clipInPoint = start
  clipOutPoint = end
  updateHandles()
  updateInputs()
}

// Swap a card's media (placeholder thumb or existing video) for a video at url.
function cvSetCardVideo(idx, url, autoplay) {
  const item = document.getElementById(`cv-item-${idx}`)
  if (!item) return
  const media = item.querySelector('.cv-thumb, video.clip-card-video')
  const v = document.createElement('video')
  v.src = url; v.controls = true; v.playsInline = true; v.className = 'clip-card-video'
  if (autoplay) { v.muted = true; v.autoplay = true }
  if (media) media.replaceWith(v)
  if (autoplay) v.play?.().catch(() => {})
}

// Put a spinner overlay on a card's placeholder thumb while it renders.
function cvCardLoader(idx, on) {
  const thumb = document.querySelector(`#cv-item-${idx} .cv-thumb`)
  if (!thumb) return
  let loader = thumb.querySelector('.cv-loader')
  if (on) {
    if (!loader) {
      loader = document.createElement('div')
      loader.className = 'cv-loader'
      loader.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:3'
      loader.innerHTML = '<div class="spinner"></div>'
      thumb.appendChild(loader)
    }
  } else { loader?.remove() }
}

// Extract a YouTube video id from a URL (watch / youtu.be / shorts / embed / live).
function ytId(url) {
  const m = (url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

// A reusable preview lightbox (created once).
;(function cvBuildPreviewModal() {
  if (document.getElementById('cv-preview-modal')) return
  const m = document.createElement('div')
  m.id = 'cv-preview-modal'
  m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:1000;align-items:center;justify-content:center;padding:20px'
  m.innerHTML = `<div style="position:relative;width:min(92vw,760px)"><button id="cv-preview-close" style="position:absolute;top:-36px;right:0;background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;line-height:1">✕</button><div id="cv-preview-body" style="width:100%"></div></div>`
  document.body.appendChild(m)
  m.addEventListener('click', (e) => { if (e.target === m) window.cvClosePreview() })
  document.getElementById('cv-preview-close').addEventListener('click', () => window.cvClosePreview())
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.cvClosePreview() })
})()
window.cvClosePreview = () => {
  const body = document.getElementById('cv-preview-body')
  if (body) body.innerHTML = '' // stops any playback
  const m = document.getElementById('cv-preview-modal')
  if (m) m.style.display = 'none'
}

// Instant preview: for YouTube sources, embed the player at the exact moment
// (no server render). For other sources, cut the clip once and play it.
// Nudge a clip's start or end timestamp by ±N seconds. Updates the in-memory
// clip, the visible mm:ss text, the duration display, and clears any cached
// pre-render / cached download blob so the next preview & download re-cut
// the clip with the new bounds. Enforces start>=0 and end>start+1.
window.cvAdjustTime = (i, field, delta) => {
  const clip = cvClips[i]
  if (!clip) return
  let start = clip.start, end = clip.end
  if (field === 'start') start = Math.max(0, start + delta)
  else end = end + delta
  if (end - start < 1) {
    // Keep at least a 1-second window — push the other side instead of clamping.
    if (field === 'start') start = end - 1
    else end = start + 1
    if (start < 0) { start = 0; end = Math.max(1, end) }
  }
  clip.start = Math.round(start * 100) / 100
  clip.end = Math.round(end * 100) / 100
  clip.duration = Math.round((end - start) * 10) / 10
  const fmt = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
  const ss = document.getElementById(`cv-start-${i}`); if (ss) ss.textContent = fmt(clip.start)
  const se = document.getElementById(`cv-end-${i}`); if (se) se.textContent = fmt(clip.end)
  const sd = document.getElementById(`cv-dur-${i}`); if (sd) sd.textContent = String(Math.round(clip.duration))
  // Invalidate every cached render for this clip — the bounds have changed so
  // any previously rendered/preview blob is stale.
  const s = cvSettings[i]
  if (s) { s.lastSig = null; s.lastUrl = null; s.rawUrl = null }
}

window.cvPreviewOne = async (i) => {
  const clip = cvClips[i]
  if (!clip || !clipSourceUrl) return
  const modal = document.getElementById('cv-preview-modal')
  const body = document.getElementById('cv-preview-body')
  const vid = ytId(clipSourceUrl)

  if (vid) {
    const start = Math.max(0, Math.floor(clip.start))
    const end = Math.ceil(clip.end)
    body.innerHTML =
      `<div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden">` +
      `<iframe src="https://www.youtube.com/embed/${vid}?start=${start}&end=${end}&autoplay=1&rel=0" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe></div>` +
      `<p style="text-align:center;color:#aaa;font-size:.74rem;margin-top:10px">Preview of the moment. Your downloaded clip uses the format &amp; captions you pick.</p>`
    modal.style.display = 'flex'
    return
  }

  // Non-YouTube → render the clip once (cached) and play it.
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#fff;gap:10px"><div class="spinner"></div> Loading preview…</div>'
  modal.style.display = 'flex'
  try {
    let url = cvSettings[i].rawUrl
    if (!url) {
      const res = await fetch(api.download.clipUrl(clipSourceUrl, clip.start.toFixed(2), clip.end.toFixed(2)))
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const er = new Error(e.message || e.error || 'Preview failed'); er.needsPlan = res.status === 402; throw er
      }
      url = URL.createObjectURL(await res.blob())
      cvSettings[i].rawUrl = url
    }
    body.innerHTML = `<video src="${url}" controls autoplay playsinline style="width:100%;max-height:75vh;border-radius:10px;background:#000"></video>`
  } catch (e) {
    body.innerHTML = `<p style="color:#fff;text-align:center;padding:24px">${e.needsPlan ? e.message + '. Upgrade to continue' : e.message}</p>`
  }
}

// A signature that captures every setting that would change the output. If
// it matches what we last rendered, the click is just a redownload; if not,
// the cached blob is stale and we need a fresh render.
function cvSettingsSig(s) {
  return JSON.stringify({
    f: s.format, c: s.crop, cap: s.captionsOn,
    st: s.captionsOn ? s.style : null,
    pos: s.captionsOn ? s.pos : null,
    cu: s.captionsOn ? (s.custom || null) : null,
  })
}

window.cvDownloadOne = async (idx, opts = {}) => {
  const clip = cvClips[idx]
  if (!clip || !clipSourceUrl) return
  const s = cvSettings[idx] || { format: 'original', crop: 'fit', captionsOn: false, style: 'karaoke', pos: { x: 0.5, y: 0.72 } }
  const renderBtn = document.getElementById(`cv-render-${idx}`)

  const sig = cvSettingsSig(s)
  const dlName = `viral_clip_${idx + 1}${s.captionsOn ? '_captioned' : ''}.mp4`

  // Fast path 1: settings match what we already rendered — just redownload the cached blob.
  if (s.lastSig === sig && s.lastUrl) {
    const dl = document.createElement('a')
    dl.href = s.lastUrl; dl.download = dlName
    document.body.appendChild(dl); dl.click(); dl.remove()
    setStatus('clip-viral-status', `Clip ${idx + 1} downloaded!`, 'ok')
    setTimeout(() => { document.getElementById('clip-viral-status').style.display = 'none' }, 3000)
    return s.lastUrl
  }
  // Fast path 2: untouched clip (original framing, no captions) we pre-rendered for preview.
  const isRaw = s.format === 'original' && (s.crop === 'fit' || !s.crop) && !s.captionsOn
  if (isRaw && s.rawUrl) {
    s.lastSig = sig; s.lastUrl = s.rawUrl
    const dl = document.createElement('a')
    dl.href = s.rawUrl; dl.download = dlName
    document.body.appendChild(dl); dl.click(); dl.remove()
    setStatus('clip-viral-status', `Clip ${idx + 1} downloaded!`, 'ok')
    setTimeout(() => { document.getElementById('clip-viral-status').style.display = 'none' }, 3000)
    return s.rawUrl
  }

  if (renderBtn) renderBtn.disabled = true
  setStatus('clip-viral-status', `Rendering clip ${idx + 1}${s.captionsOn ? ' with captions' : ''}…`, 'loading')
  try {
    const clipUrl = api.download.clipUrl(clipSourceUrl, clip.start.toFixed(2), clip.end.toFixed(2), s.format, s.crop)
    const res = await fetch(clipUrl)
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      const er = new Error(e.message || e.error || 'Render failed'); er.needsPlan = res.status === 402; throw er
    }
    const blob = await res.blob()
    const outUrl = s.captionsOn
      ? await captionizeBlob(blob, `viral_clip_${idx + 1}`, { statusId: 'clip-viral-status', style: s.style, position: s.pos, custom: s.custom })
      : URL.createObjectURL(blob)

    // Cache the result against the settings sig — a future click with the
    // SAME settings will reuse this URL; a click after changing crop/format/
    // captions/style/stroke will re-enter the render path here.
    s.lastSig = sig; s.lastUrl = outUrl
    // Show the rendered (reframed/captioned) result in the card.
    cvSetCardVideo(idx, outUrl, true)
    // Keep the button as a button (so it re-renders on next click) — just re-enable it.
    if (renderBtn) renderBtn.disabled = false
    // Trigger the download now (unless batching — Download All handles its own).
    if (!opts.noAutoDownload) {
      const dl = document.createElement('a')
      dl.href = outUrl; dl.download = dlName
      document.body.appendChild(dl); dl.click(); dl.remove()
    }
    setStatus('clip-viral-status', `Clip ${idx + 1} ready!`, 'ok')
    setTimeout(() => { document.getElementById('clip-viral-status').style.display = 'none' }, 3000)
    return outUrl
  } catch (e) {
    if (renderBtn) renderBtn.disabled = false
    setStatus('clip-viral-status', e.needsPlan ? e.message + '. Upgrade to continue' : e.message, 'err')
  }
}

window.clipViralDownloadAll = async () => {
  if (!cvClips.length || !clipSourceUrl) return
  const btn = document.getElementById('clip-viral-dl-all')
  btn.disabled = true
  for (let i = 0; i < cvClips.length; i++) {
    setStatus('clip-viral-status', `Rendering clip ${i + 1} of ${cvClips.length}…`, 'loading')
    await cvDownloadOne(i) // renders the card with its own settings + triggers download
  }
  setStatus('clip-viral-status', `All ${cvClips.length} clips ready!`, 'ok')
  setTimeout(() => { document.getElementById('clip-viral-status').style.display = 'none' }, 5000)
  btn.disabled = false
}

window.cvEditClip = (start, end) => {
  clipInPoint = start
  clipOutPoint = end
  updateHandles()
  updateInputs()
  document.getElementById('clip-viral-results').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ============ VIDEO COMMENTARY WIZARD ============ */
const CM_PRESETS = [
  { key: 'karaoke',        label: 'Viral Green',  bg: '#000', color: '#0f0', font: 'Anton',                outline: '#000' },
  { key: 'karaoke_yellow', label: 'Viral Yellow', bg: '#000', color: '#ff0', font: 'Anton',                outline: '#000' },
  { key: 'clean',          label: 'Clean White',  bg: '#000', color: '#fff', font: 'Montserrat',           outline: '#000' },
  { key: 'boxed',          label: 'Box',          bg: '#000', color: '#fff', font: 'Montserrat',           outline: '#000', boxed: true },
  { key: 'bangers',        label: 'Comic',        bg: '#000', color: '#fff', font: 'Bangers',              outline: '#000' },
  { key: 'random',         label: 'Random Color', bg: '#000', color: '#0f0', font: 'Anton',                outline: '#000' },
  { key: 'rounded',        label: 'Rounded',      bg: '#000', color: '#fff', font: 'Baloo 2 ExtraBold',    outline: '#000' },
  { key: 'meme',           label: 'Meme',         bg: '#000', color: '#f00', font: 'Luckiest Guy',         outline: '#ff0' },
  { key: 'neon',           label: 'Neon',         bg: '#000', color: '#f3c', font: 'Baloo 2 ExtraBold',    outline: '#000' },
  { key: 'script',         label: 'Script',       bg: '#000', color: '#f00', font: 'Permanent Marker',     outline: '#000' },
]

const cmState = {
  step: 1,
  totalSteps: 5,
  file: null,           // File object if uploaded
  fileUrl: null,        // Direct URL (Supabase or platform link)
  localPreviewUrl: null,// blob: URL for the preview pane
  duration: 0,
  trim: { start: 0, end: 0 },
  script: '',
  subtitle: {
    enabled: true, preset: 'bangers', font: 'Bangers', size: 60,
    strokeColor: '#000000', strokeWidth: 2, bgColor: '#000000', position: 'center',
  },
  shape: { aspect: '9:16', bg: '#000000' },
  audio: {
    voiceOn: true, voiceId: '', voiceVol: 100,
    muteVideo: true, videoVol: 100,
    bgOn: false, bgTab: 'library', bgUrl: '', bgFile: null, bgVol: 40,
  },
  jobId: null, pollTimer: null, downloadUrl: null,
}

window.cmGoStep = (n) => {
  if (n < 1) n = 1
  if (n > cmState.totalSteps) n = cmState.totalSteps
  cmState.step = n
  document.querySelectorAll('.cm-pane').forEach(p => p.style.display = 'none')
  document.querySelector(`.cm-pane[data-pane="${n}"]`).style.display = ''
  document.querySelectorAll('.cm-step-pill').forEach(p => {
    const s = +p.dataset.step
    p.classList.toggle('active', s === n)
    p.classList.toggle('done', s < n)
  })
  document.getElementById('cm-prev-btn').style.visibility = n === 1 ? 'hidden' : ''
  document.getElementById('cm-next-btn').style.display = n === cmState.totalSteps ? 'none' : ''
  document.getElementById('cm-final-btn').style.display = n === cmState.totalSteps ? '' : 'none'
  cmUpdatePreview()
}
window.cmStepNext = () => {
  if (cmState.step === 1 && !cmState.fileUrl && !cmState.file) { cmShowError('Please upload a video first.'); return }
  cmClearError()
  cmGoStep(cmState.step + 1)
}
window.cmStepPrev = () => { cmClearError(); cmGoStep(cmState.step - 1) }

function cmShowError(msg) {
  const el = document.getElementById('cm-error')
  if (!el) return
  el.textContent = msg
  el.style.display = 'block'
}
function cmClearError() {
  const el = document.getElementById('cm-error')
  if (el) el.style.display = 'none'
}

/* ---- Step 1: upload + trim ---- */
const CM_MAX_BYTES = 50 * 1024 * 1024
window.cmHandleFile = async (file) => {
  if (!file) return
  cmClearError()
  if (file.size > CM_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    cmShowError(`File is ${mb} MB (limit 50 MB). Trim or compress the video first.`)
    const inp = document.getElementById('cm-file-input')
    if (inp) inp.value = ''
    return
  }
  cmState.file = file
  cmState.localPreviewUrl = URL.createObjectURL(file)

  // Try uploading to Supabase via existing upload route. If it fails (e.g. not
  // logged in), we still let the user preview locally and they can paste a URL
  // instead.
  try {
    const fd = new FormData(); fd.append('file', file)
    const r = await api.upload.file(fd)
    if (r.url) cmState.fileUrl = r.url
  } catch (e) { console.warn('upload failed', e.message) }
  cmAttachVideo(cmState.localPreviewUrl)
}
const CM_PLATFORM_RE = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|reddit\.com|facebook\.com/i

window.cmSubmitUrl = () => {
  const url = document.getElementById('cm-url-input').value.trim()
  if (!url) return
  cmState.fileUrl = url
  cmState.localPreviewUrl = url
  if (CM_PLATFORM_RE.test(url)) cmAttachPlatformLink(url)
  else cmAttachVideo(url)
}
window.cmPickFile = (url) => {
  if (!url) return
  cmState.fileUrl = url
  cmState.localPreviewUrl = url
  if (CM_PLATFORM_RE.test(url)) cmAttachPlatformLink(url)
  else cmAttachVideo(url)
}

// Platform URLs (YouTube/TikTok/IG/X/Reddit/FB) can't be played directly by a
// <video> tag, but /api/download/stream proxies them via yt-dlp so the browser
// can fetch a regular video stream. We point both the source player AND the
// right-side preview at the proxy URL; the original link stays in cmState
// because the backend wants to yt-dlp it again at generate time.
function cmAttachPlatformLink(url) {
  document.getElementById('cm-uploader').style.display = 'none'
  document.getElementById('cm-uploaded').style.display = ''
  const player = document.getElementById('cm-source-player')
  player.style.display = ''
  const ph = document.getElementById('cm-platform-card')
  if (ph) ph.style.display = 'none'

  // Loading banner over the player while the backend pulls + transcodes.
  let banner = document.getElementById('cm-source-loading')
  if (!banner) {
    banner = document.createElement('div')
    banner.id = 'cm-source-loading'
    banner.style.cssText = 'padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:9px;color:var(--muted);font-size:.82rem;text-align:center;margin-bottom:10px'
    player.parentNode.insertBefore(banner, player)
  }
  const host = (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return 'link' } })()
  banner.textContent = `Loading video from ${host}… (this can take 10–30s for long videos)`
  banner.style.display = ''

  const proxied = api.download.streamUrl(url)
  cmState.localPreviewUrl = proxied
  player.src = proxied
  player.onloadedmetadata = () => {
    banner.style.display = 'none'
    const dur = Number.isFinite(player.duration) ? player.duration : 60
    cmState.duration = dur
    cmState.trim = { start: 0, end: dur }
    cmRenderTrim()
    cmUpdatePreview()
  }
  player.onerror = () => {
    banner.style.color = '#ff6677'
    banner.textContent = `Could not load video from ${host}. Will still try at generate time. Trim defaulted to 60s.`
    cmState.duration = 60
    cmState.trim = { start: 0, end: 60 }
    cmRenderTrim()
    cmUpdatePreview()
  }
  cmUpdatePreview()
}
window.cmReupload = () => {
  cmState.file = null; cmState.fileUrl = null; cmState.localPreviewUrl = null
  cmState.duration = 0; cmState.trim = { start: 0, end: 0 }
  document.getElementById('cm-uploader').style.display = ''
  document.getElementById('cm-uploaded').style.display = 'none'
  document.getElementById('cm-url-input').value = ''
  document.getElementById('cm-file-picker').value = ''
  document.getElementById('cm-file-input').value = ''
  const ph = document.getElementById('cm-platform-card')
  if (ph) ph.style.display = 'none'
  const player = document.getElementById('cm-source-player')
  if (player) { player.removeAttribute('src'); player.load?.(); player.style.display = '' }
  cmUpdatePreview()
}

function cmAttachVideo(src) {
  document.getElementById('cm-uploader').style.display = 'none'
  document.getElementById('cm-uploaded').style.display = ''
  const ph = document.getElementById('cm-platform-card')
  if (ph) ph.style.display = 'none'
  const v = document.getElementById('cm-source-player')
  v.style.display = ''
  v.src = src
  v.onloadedmetadata = () => {
    const dur = Number.isFinite(v.duration) ? v.duration : 0
    cmState.duration = dur
    cmState.trim = { start: 0, end: dur }
    cmRenderTrim()
  }
  cmUpdatePreview()
}

function cmRenderTrim() {
  const dur = cmState.duration || 1
  const sPct = (cmState.trim.start / dur) * 100
  const ePct = (cmState.trim.end / dur) * 100
  document.getElementById('cm-trim-handle-start').style.left = sPct + '%'
  document.getElementById('cm-trim-handle-end').style.left = ePct + '%'
  document.getElementById('cm-trim-fill').style.left = sPct + '%'
  document.getElementById('cm-trim-fill').style.width = (ePct - sPct) + '%'
  document.getElementById('cm-trim-start-lbl').textContent = cmState.trim.start.toFixed(1) + 's'
  document.getElementById('cm-trim-end-lbl').textContent = cmState.trim.end.toFixed(1) + 's'
  const ticks = document.getElementById('cm-trim-ticks')
  if (ticks && ticks.children.length === 0) {
    for (let i = 0; i <= 7; i++) {
      const span = document.createElement('span')
      span.textContent = (dur * i / 7).toFixed(1) + 's'
      ticks.appendChild(span)
    }
  }
}

window.cmTrimDrag = (e, which) => {
  e.preventDefault()
  const track = document.getElementById('cm-trim-track')
  const rect = track.getBoundingClientRect()
  const move = (ev) => {
    const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left
    let pct = Math.max(0, Math.min(1, x / rect.width))
    const t = pct * (cmState.duration || 0)
    if (which === 'start') cmState.trim.start = Math.min(t, cmState.trim.end - 0.1)
    else cmState.trim.end = Math.max(t, cmState.trim.start + 0.1)
    cmRenderTrim()
  }
  const up = () => {
    window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
    window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up)
  }
  window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  window.addEventListener('touchmove', move); window.addEventListener('touchend', up)
}

/* ---- Step 2: script ---- */
window.cmGenerateScript = async () => {
  const btn = document.getElementById('cm-script-btn')
  btn.disabled = true; btn.textContent = 'Generating…'
  try {
    const body = {
      topic:  document.getElementById('cm-topic').value.trim() || 'this video',
      tone:   document.getElementById('cm-tone').value,
      length: +document.getElementById('cm-length').value || 20,
      hook:   document.getElementById('cm-hook').value.trim(),
      cta:    document.getElementById('cm-cta').value.trim(),
    }
    const r = await api.commentary.script(body)
    document.getElementById('cm-script').value = r.script || ''
  } catch (e) { cmShowError(e.message || 'Script generation failed') }
  btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2zM17 13l1.5 3 3 1.5-3 1.5L17 22l-1.5-3-3-1.5 3-1.5z"/></svg> Generate Script`
}

/* ---- Step 3: subtitle preset cards ---- */
function cmRenderPresets() {
  const wrap = document.getElementById('cm-sub-presets')
  if (!wrap || wrap.children.length) return
  CM_PRESETS.forEach(p => {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'cm-sub-preset-card' + (p.key === cmState.subtitle.preset ? ' active' : '')
    card.dataset.preset = p.key
    card.style.fontFamily = p.font
    card.style.color = p.color
    card.style.background = p.bg
    card.style.textShadow = `2px 2px 0 ${p.outline},-2px 2px 0 ${p.outline},2px -2px 0 ${p.outline},-2px -2px 0 ${p.outline}`
    card.textContent = p.label
    card.onclick = () => cmPickPreset(p.key)
    wrap.appendChild(card)
  })
}
window.cmPickPreset = (key) => {
  cmState.subtitle.preset = key
  const p = CM_PRESETS.find(x => x.key === key)
  if (p) { cmState.subtitle.font = p.font; document.getElementById('cm-sub-font').value = p.font }
  document.querySelectorAll('.cm-sub-preset-card').forEach(c => c.classList.toggle('active', c.dataset.preset === key))
  cmUpdatePreview()
}

/* ---- Step 4: shape ---- */
window.cmPickAspect = (btn) => {
  document.querySelectorAll('.cm-shape-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  cmState.shape.aspect = btn.dataset.aspect
  cmUpdatePreview()
}

/* ---- Step 5: audio ---- */
window.cmBgTab = (btn, tab) => {
  document.querySelectorAll('.cm-audio-tab').forEach(t => t.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('cm-bg-library').style.display = tab === 'library' ? '' : 'none'
  document.getElementById('cm-bg-upload').style.display  = tab === 'upload'  ? '' : 'none'
  cmState.audio.bgTab = tab
}

window.cmSyncBgHex = (val) => {
  const hex = document.getElementById('cm-sub-bg-hex')
  if (hex) hex.value = val
  cmUpdatePreview()
}
window.cmSyncBgColor = (val) => {
  if (!/^#[0-9a-f]{6}$/i.test(val)) return cmUpdatePreview()
  const c = document.getElementById('cm-sub-bg-color')
  if (c) c.value = val
  cmUpdatePreview()
}

/* ---- Preview pane (right side) ---- */
window.cmUpdatePreview = function cmUpdatePreview() {
  const stage = document.getElementById('cm-preview-stage')
  if (!stage) return
  const aspect = cmState.shape?.aspect || '9:16'
  stage.dataset.aspect = aspect
  stage.style.background = cmState.shape?.bg || '#000'
  const v = document.getElementById('cm-preview-vid')
  if (cmState.localPreviewUrl && v.src !== cmState.localPreviewUrl) v.src = cmState.localPreviewUrl

  const sub = document.getElementById('cm-preview-sub')
  if (!sub) return

  const enabled = document.getElementById('cm-sub-enabled')?.checked ?? true
  if (!enabled) { sub.style.display = 'none'; return }
  sub.style.display = ''

  // Pull live values from the DOM so the preview reflects every keystroke.
  const presetKey = cmState.subtitle?.preset || 'bangers'
  const preset = CM_PRESETS.find(p => p.key === presetKey) || CM_PRESETS[4]
  const font   = document.getElementById('cm-sub-font')?.value     || preset.font
  const size   = +(document.getElementById('cm-sub-size')?.value   || 60)
  const sc     = document.getElementById('cm-sub-stroke-color')?.value || '#000'
  const sw     = +(document.getElementById('cm-sub-stroke-w')?.value || 2)
  const bgCol  = document.getElementById('cm-sub-bg-color')?.value || '#000'
  const bgOn   = document.getElementById('cm-sub-bg-on')?.checked  || false
  const pos    = document.getElementById('cm-sub-position')?.value || 'center'

  sub.style.fontFamily = font
  sub.style.color = preset.color
  // Scale the preview font roughly proportional to the stage width so the
  // slider visibly changes size in the small preview, not just on the final
  // export. 60 in the slider ≈ 1.2rem here.
  sub.style.fontSize = Math.max(0.6, (size / 60) * 1.2) + 'rem'
  sub.style.textShadow = `${sw}px ${sw}px 0 ${sc},-${sw}px ${sw}px 0 ${sc},${sw}px -${sw}px 0 ${sc},-${sw}px -${sw}px 0 ${sc}`
  sub.style.padding = bgOn ? '4px 10px' : '0'
  sub.style.background = bgOn ? bgCol : 'transparent'
  sub.style.borderRadius = bgOn ? '4px' : '0'
  sub.style.display = ''

  // Position via top/bottom + transform so it sits cleanly in the stage box.
  sub.style.left = '6%'; sub.style.right = '6%'
  sub.style.width = 'auto'
  if (pos === 'top') { sub.style.top = '8%'; sub.style.bottom = 'auto'; sub.style.transform = 'none' }
  else if (pos === 'center') { sub.style.top = '50%'; sub.style.bottom = 'auto'; sub.style.transform = 'translateY(-50%)' }
  else { sub.style.top = 'auto'; sub.style.bottom = '10%'; sub.style.transform = 'none' }

  // Use the first ~12 words of the actual script so users see their copy
  // styled the way it'll burn into the final video.
  const txt = (document.getElementById('cm-script')?.value || '').trim()
  sub.textContent = txt
    ? txt.split(/\s+/).slice(0, 12).join(' ')
    : 'YOUR CAPTIONS HERE'
}

/* ---- Final submit ---- */
window.cmGenerate = async () => {
  cmClearError()
  if (!cmState.fileUrl) { cmShowError('Please upload a video first.'); return }
  cmState.script = document.getElementById('cm-script').value.trim()
  if (!cmState.script) { cmShowError('Please write or generate a script.'); cmGoStep(2); return }

  // Snapshot UI state into cmState.audio + cmState.subtitle right before submit.
  cmState.subtitle.enabled = document.getElementById('cm-sub-enabled').checked
  cmState.subtitle.font = document.getElementById('cm-sub-font').value
  cmState.subtitle.size = +document.getElementById('cm-sub-size').value
  cmState.subtitle.strokeColor = document.getElementById('cm-sub-stroke-color').value
  cmState.subtitle.strokeWidth = +document.getElementById('cm-sub-stroke-w').value
  cmState.subtitle.bgColor = document.getElementById('cm-sub-bg-color').value
  cmState.subtitle.position = document.getElementById('cm-sub-position').value
  cmState.shape.bg = document.getElementById('cm-shape-bg').value
  cmState.audio.voiceOn = document.getElementById('cm-vo-on').checked
  cmState.audio.voiceId = document.getElementById('cm-voice').value
  cmState.audio.voiceVol = +document.getElementById('cm-vo-vol').value
  cmState.audio.muteVideo = document.getElementById('cm-mute-vid').checked
  cmState.audio.videoVol = +document.getElementById('cm-vid-vol').value
  cmState.audio.bgOn = document.getElementById('cm-bg-on').checked
  cmState.audio.bgUrl = document.getElementById('cm-bg-lib').value
  cmState.audio.bgVol = +document.getElementById('cm-bg-vol').value

  // If user picked an uploaded bg music file, push it through /api/upload to
  // hand the backend a fetchable URL.
  const bgFile = document.getElementById('cm-bg-file').files[0]
  if (cmState.audio.bgOn && cmState.audio.bgTab === 'upload' && bgFile) {
    try {
      const fd = new FormData(); fd.append('file', bgFile)
      const r = await api.upload.file(fd)
      cmState.audio.bgUrl = r.url
    } catch (e) { cmShowError('BG music upload failed: ' + e.message); return }
  }

  const payload = {
    file_url: cmState.fileUrl,
    trim: cmState.trim,
    script: cmState.script,
    subtitle: cmState.subtitle,
    shape: cmState.shape,
    audio: cmState.audio,
  }

  const btn = document.getElementById('cm-final-btn')
  btn.disabled = true
  document.getElementById('cm-status').style.display = 'block'
  document.getElementById('cm-result').style.display = 'none'

  try {
    const { jobId } = await api.commentary.start(payload)
    cmState.jobId = jobId
    cmPoll()
  } catch (e) {
    cmShowError(e.message || 'Failed to start job')
    btn.disabled = false
  }
}

async function cmPoll() {
  clearTimeout(cmState.pollTimer)
  if (!cmState.jobId) return
  try {
    const r = await api.commentary.poll(cmState.jobId)
    document.getElementById('cm-step-lbl').textContent = r.step || r.status
    document.getElementById('cm-pct').textContent = (r.progress ?? 0) + '%'
    document.getElementById('cm-progress').style.width = (r.progress ?? 0) + '%'

    if (r.status === 'done') {
      document.getElementById('cm-final-btn').disabled = false
      const blobUrl = await api.commentary.download(cmState.jobId)
      cmState.downloadUrl = blobUrl
      document.getElementById('cm-player').src = blobUrl
      document.getElementById('cm-result').style.display = 'block'
      return
    }
    if (r.status === 'error') {
      cmShowError(r.error || 'Job failed')
      document.getElementById('cm-final-btn').disabled = false
      return
    }
    cmState.pollTimer = setTimeout(cmPoll, 3000)
  } catch (e) {
    cmShowError(e.message || 'Polling failed')
    document.getElementById('cm-final-btn').disabled = false
  }
}
window.cmDownload = () => {
  if (!cmState.downloadUrl) return
  const a = document.createElement('a')
  a.href = cmState.downloadUrl; a.download = 'commentary.mp4'
  document.body.appendChild(a); a.click(); a.remove()
}

window.cmResetWizard = () => {
  if (cmState.downloadUrl) { try { URL.revokeObjectURL(cmState.downloadUrl) } catch {} }
  cmState.jobId = null
  cmState.downloadUrl = null
  const player = document.getElementById('cm-player')
  if (player) { player.pause?.(); player.removeAttribute('src'); player.load?.() }
  document.getElementById('cm-result').style.display = 'none'
  document.getElementById('cm-status').style.display = 'none'
  document.getElementById('cm-final-btn').disabled = false
  window.cmReupload?.()
  window.cmGoStep?.(1)
}

async function cmLoadHelpers() {
  try {
    const voices = await api.tts.voices()
    const sel = document.getElementById('cm-voice')
    if (sel && sel.children.length <= 1) {
      voices.slice(0, 60).forEach(v => {
        const o = document.createElement('option')
        o.value = v.id; o.textContent = v.name
        sel.appendChild(o)
      })
    }
  } catch {}
  try {
    const files = await api.upload.list()
    const sel = document.getElementById('cm-file-picker')
    if (sel && sel.children.length <= 1) {
      files.filter(f => /video|mp4|mov|webm/i.test(f.type || '') || /\.mp4|\.mov|\.webm/i.test(f.url || ''))
        .forEach(f => {
          const o = document.createElement('option')
          o.value = f.url; o.textContent = f.name || 'video'
          sel.appendChild(o)
        })
    }
  } catch {}
  cmRenderPresets()
  cmGoStep(1)
}

const _origSwitchPanel = window.switchPanel
if (typeof _origSwitchPanel === 'function') {
  window.switchPanel = (id, btn, opts) => {
    _origSwitchPanel(id, btn, opts)
    if (id === 'commentary') cmLoadHelpers()
  }
}

// Any paid-feature 402 should open the hard paywall so users can't poke around unpaid.
window.addEventListener('unhandledrejection', (ev) => {
  if (!PAYWALL_ENABLED) return
  const err = ev?.reason
  if (err && err.needsPlan) {
    try { openPaywall({ force: true }) } catch (_) {}
  }
})
