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
