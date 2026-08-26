import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WHOP_PLAN_ENV_DEFAULTS } from '../lib/whop-map.js'
import {
  grantFromMembership,
  membershipMatchesUser,
  pickBestGrant,
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
