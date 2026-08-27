import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WHOP_PLAN_ENV_DEFAULTS } from '../lib/whop-map.js'
import {
  grantFromMembership,
  membershipMatchesUser,
  pickBestGrant,
  _internals,
} from '../lib/whop-lookup.js'
import { applyPaidGrant } from '../lib/paid-grant.js'
import { grantFor, saveGrant, withStoredGrant, _resetGrantsForTests } from '../lib/grants.js'
import { planIsActive } from '../lib/comped.js'
import { _internalsForTests as diagnostics } from '../api/billing/diagnose.js'
import { saveIntent, mayAttachOffEmail, _resetIntentsForTests } from '../lib/checkout-intents.js'
import { verifyWhopWebhook, vidsoIdentityFromWhop, fulfillWhopEvent } from '../lib/whop-webhook.js'
import { checkoutMetadata } from '../lib/whop-checkout.js'
import { createHmac } from 'node:crypto'

const PRO_MONTHLY = WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_PRO_MONTHLY
const STUDIO_YEARLY = WHOP_PLAN_ENV_DEFAULTS.WHOP_PLAN_STUDIO_YEARLY

test('membership matches Vidso email or checkout metadata user id', () => {
  const row = {
    status: 'active',
    user: { email: 'Buyer@Example.com' },
    metadata: { user_id: 'abc-123' },
    plan: { id: PRO_MONTHLY },
  }
  assert.equal(membershipMatchesUser(row, { email: 'buyer@example.com' }), true)
  assert.equal(membershipMatchesUser(row, { userId: 'abc-123' }), true)
  assert.equal(membershipMatchesUser(row, { email: 'other@example.com' }), false)
})

test('pickBestGrant prefers Studio over Pro and ignores canceled', () => {
  const identity = { email: 'payer@example.com' }
  const grant = pickBestGrant([
    {
      id: 'mem_canceled',
      status: 'canceled',
      user: { email: 'payer@example.com' },
      plan: { id: STUDIO_YEARLY },
    },
    {
      id: 'mem_pro',
      status: 'active',
      user: { email: 'payer@example.com' },
      plan: { id: PRO_MONTHLY },
    },
    {
      id: 'mem_studio',
      status: 'trialing',
      user: { email: 'payer@example.com' },
      plan: { id: STUDIO_YEARLY },
    },
  ], identity)
  assert.equal(grant.tier, 'studio')
  assert.equal(grant.cycle, 'yearly')
  assert.equal(grant.membershipId, 'mem_studio')
})

test('mapped Pro membership becomes an active Vidso grant', () => {
  const grant = grantFromMembership({
    id: 'mem_1',
    status: 'active',
    plan: { id: PRO_MONTHLY },
    user: { email: 'ntuamassoma@gmail.com' },
  })
  assert.equal(grant.active, true)
  assert.equal(grant.tier, 'pro')
  assert.equal(grant.cycle, 'monthly')
  const user = applyPaidGrant({
    email: 'ntuamassoma@gmail.com',
    plan: 'free',
    plan_status: 'inactive',
  }, grant)
  assert.equal(user.plan, 'pro')
  assert.equal(user.plan_status, 'active')
  assert.equal(planIsActive(user), true)
})

test('list filters use the array param names Whop actually reads', () => {
  const qs = _internals.buildQuery({
    company_id: 'biz_1',
    first: 100,
    statuses: ['active', 'trialing'],
    plan_ids: [PRO_MONTHLY],
    user_ids: ['user_1'],
    after: undefined,
  })
  assert.match(qs, /statuses\[\]=active&statuses\[\]=trialing/)
  assert.match(qs, new RegExp('plan_ids\\[\\]=' + PRO_MONTHLY))
  assert.match(qs, /user_ids\[\]=user_1/)
  // Whop ignores `status` and `user_id`, so a buyer would never be found.
  assert.doesNotMatch(qs, /(^|&)status=/)
  assert.doesNotMatch(qs, /(^|&)user_id=/)
  assert.doesNotMatch(qs, /after=/)
})

test('membership matches on the Whop user id when the API key cannot read emails', () => {
  const row = {
    id: 'mem_hidden',
    status: 'active',
    user: { id: 'user_42', email: null },
    plan: { id: PRO_MONTHLY },
  }
  const identity = { emails: ['buyer@example.com'], whopUserIds: ['user_42'] }
  assert.equal(membershipMatchesUser(row, identity), true)
  assert.equal(pickBestGrant([row], identity).tier, 'pro')
  assert.equal(membershipMatchesUser(row, { emails: ['buyer@example.com'] }), false)
})

test('membership matches when Whop returns the plan and user as bare ids', () => {
  const row = {
    id: 'mem_flat',
    status: 'active',
    user: 'user_77',
    plan_id: PRO_MONTHLY,
  }
  const grant = pickBestGrant([row], { emails: ['x@y.com'], whopUserIds: ['user_77'] })
  assert.equal(grant.tier, 'pro')
  assert.equal(grant.legacy, false)
})

test('a settled one-time purchase still grants access', () => {
  const grant = grantFromMembership({
    id: 'mem_done',
    status: 'completed',
    plan: { id: STUDIO_YEARLY },
    user: { email: 'buyer@example.com' },
  })
  assert.equal(grant.active, true)
  assert.equal(grant.tier, 'studio')
})

test('a single hidden-email member is still matched, and reported as a warning not a failure', () => {
  const { verdict, warningsFor, summarizeMemberSearch } = diagnostics
  const hidden = summarizeMemberSearch({
    ok: true,
    data: { data: [{ user: { id: 'user_1', email: null } }] },
  }, 'buyer@example.com')
  assert.equal(hidden.emailReadable, false)
  assert.deepEqual(hidden.whopUserIds, ['user_1'])
  assert.equal(hidden.matchedBy, 'single_query_hit')

  const memberships = { ok: true, rows: 3 }
  assert.match(verdict({
    configured: true,
    member: hidden,
    memberships,
    lookup: { active: true, tier: 'pro', cycle: 'monthly' },
  }), /active membership on pro monthly/)
  assert.match(warningsFor({ member: hidden, memberships }).join(' '), /member:email:read/)
})

test('diagnostics blame the permission only when the search is genuinely ambiguous', () => {
  const { verdict, summarizeMemberSearch } = diagnostics
  const ambiguous = summarizeMemberSearch({
    ok: true,
    data: { data: [{ user: { id: 'user_1', email: null } }, { user: { id: 'user_2', email: null } }] },
  }, 'buyer@example.com')
  assert.deepEqual(ambiguous.whopUserIds, [])
  assert.match(verdict({
    configured: true,
    member: ambiguous,
    memberships: { ok: true, rows: 3 },
    lookup: { active: false },
  }), /member:email:read/)

  assert.match(verdict({
    configured: false,
    member: {},
    memberships: {},
    lookup: {},
  }), /WHOP_API_KEY is not set/)

  const found = summarizeMemberSearch({
    ok: true,
    data: { data: [{ user: { id: 'user_1', email: 'Buyer@Example.com' } }] },
  }, 'buyer@example.com')
  assert.deepEqual(found.whopUserIds, ['user_1'])
  assert.equal(found.matchedBy, 'email')
})

test('grant store unlocks the same email on a later request', () => {
  _resetGrantsForTests()
  const user = { id: 'u9', email: 'paid@example.com', plan_status: 'inactive' }
  saveGrant(user, { tier: 'pro', cycle: 'monthly', planId: PRO_MONTHLY, source: 'whop' })
  const again = withStoredGrant({ email: 'paid@example.com', plan: 'free', plan_status: 'inactive' })
  assert.equal(again.plan, 'pro')
  assert.equal(again.active, true)
  assert.equal(grantFor(user).tier, 'pro')
  _resetGrantsForTests()
})

test('a receipt email can be claimed only after checkout from this account', () => {
  _resetIntentsForTests()
  const gmail = { id: 'u-gmail', email: 'buyer@gmail.com' }
  assert.equal(mayAttachOffEmail(gmail), false)
  saveIntent(gmail, { tier: 'pro' })
  assert.equal(mayAttachOffEmail(gmail), true)
  assert.equal(mayAttachOffEmail({ email: 'stranger@gmail.com' }), false)
  assert.equal(mayAttachOffEmail(gmail, 'uuid@inbox.appleid.apple.com'), true)
  _resetIntentsForTests()
  assert.equal(mayAttachOffEmail({ email: 'buyer@gmail.com' }, 'uuid@inbox.appleid.apple.com'), true)
  assert.equal(mayAttachOffEmail({ email: 'buyer@gmail.com' }, 'other@gmail.com'), false)
  const apple = 'uuid@inbox.appleid.apple.com'
  const row = {
    id: 'mem_apple',
    status: 'active',
    plan: { id: PRO_MONTHLY },
    user: { email: apple },
  }
  assert.equal(membershipMatchesUser(row, { emails: ['buyer@gmail.com'] }), false)
  assert.equal(membershipMatchesUser(row, { emails: ['buyer@gmail.com', apple] }), true)
  _resetIntentsForTests()
})

test('the same Whop membership cannot be attached to a second account', () => {
  _resetGrantsForTests()
  saveGrant({ email: 'first@example.com' }, {
    tier: 'pro',
    cycle: 'yearly',
    planId: PRO_MONTHLY,
    membershipId: 'mem_once',
    source: 'whop',
  })
  assert.throws(
    () => saveGrant({ email: 'second@example.com' }, {
      tier: 'pro',
      cycle: 'yearly',
      planId: PRO_MONTHLY,
      membershipId: 'mem_once',
      source: 'whop',
    }),
    /already attached/,
  )
  _resetGrantsForTests()
})

test('checkout metadata stamps the Vidso account, not the Whop email', () => {
  const meta = checkoutMetadata({ userId: 'u-1', email: 'Buyer@Gmail.com', tier: 'pro' })
  assert.equal(meta.user_id, 'u-1')
  assert.equal(meta.vidso_user_id, 'u-1')
  assert.equal(meta.email, 'buyer@gmail.com')
  assert.equal(meta.tier, 'pro')
})

test('webhook signature rejects a bad hmac and accepts a valid one', () => {
  const secret = 'ws_testsecret'
  const body = '{"type":"payment.succeeded","data":{}}'
  const id = 'msg_1'
  const ts = String(Math.floor(Date.now() / 1000))
  assert.throws(() => verifyWhopWebhook(body, {
    'webhook-id': id,
    'webhook-timestamp': ts,
    'webhook-signature': 'v1,nope',
  }, secret))
  const sig = createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest('base64')
  const event = verifyWhopWebhook(body, {
    'webhook-id': id,
    'webhook-timestamp': ts,
    'webhook-signature': 'v1,' + sig,
  }, secret)
  assert.equal(event.type, 'payment.succeeded')
})

test('webhook identity prefers checkout metadata over the Apple relay email', () => {
  const id = vidsoIdentityFromWhop({
    user: { email: 'uuid@inbox.appleid.apple.com' },
    metadata: { user_id: 'vidso-1', email: 'buyer@gmail.com' },
  })
  assert.equal(id.id, 'vidso-1')
  assert.equal(id.email, 'buyer@gmail.com')
})

test('membership.activated with checkout metadata grants the Vidso account', async () => {
  _resetGrantsForTests()
  const result = await fulfillWhopEvent({
    type: 'membership.activated',
    data: {
      id: 'mem_auto',
      status: 'active',
      plan: { id: PRO_MONTHLY },
      user: { email: 'uuid@inbox.appleid.apple.com' },
      metadata: { user_id: 'u-auto', email: 'buyer@gmail.com' },
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.tier, 'pro')
  const user = withStoredGrant({ id: 'u-auto', email: 'buyer@gmail.com', plan_status: 'inactive' })
  assert.equal(user.plan, 'pro')
  _resetGrantsForTests()
})
