import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compedTierForEmail,
  emailKeys,
  emailsFromUser,
  emailsMatch,
  withCompedPlan,
} from '../lib/comped.js'
import { membershipMatchesUser } from '../lib/whop-lookup.js'

test('Gmail dots and plus-tags collapse to the same account', () => {
  assert.deepEqual(emailKeys('subramaniam.vishwak@gmail.com'), [
    'subramaniam.vishwak@gmail.com',
    'subramaniamvishwak@gmail.com',
  ])
  assert.equal(emailsMatch('subramaniam.vishwak@gmail.com', 'subramaniamvishwak@gmail.com'), true)
  assert.equal(emailsMatch('Buyer+whop@gmail.com', 'buyer@gmail.com'), true)
  assert.equal(emailsMatch('a@example.com', 'b@example.com'), false)
})

test('timed Studio comp expires after a month', () => {
  const email = 'jacoblewiswrestling@gmail.com'
  const during = withCompedPlan({
    email,
    plan: 'free',
    plan_status: 'inactive',
  }, new Date('2026-09-15T00:00:00Z'))
  assert.equal(during.plan, 'studio')
  assert.equal(during.plan_status, 'active')
  assert.equal(during.plan_interval, 'monthly')
  assert.equal(compedTierForEmail(email, new Date('2026-10-01T00:00:00Z')), null)
})

test('login with dotted Gmail still gets the Pro grant', () => {
  assert.equal(compedTierForEmail('subramaniam.vishwak@gmail.com'), 'pro')
  const user = withCompedPlan({
    email: 'subramaniam.vishwak@gmail.com',
    plan: 'free',
    plan_status: 'inactive',
  })
  assert.equal(user.plan, 'pro')
  assert.equal(user.plan_status, 'active')
  assert.deepEqual(emailsFromUser({ email: 'Subramaniam.Vishwak@gmail.com' }).sort(), [
    'subramaniam.vishwak@gmail.com',
    'subramaniamvishwak@gmail.com',
  ].sort())
})

test('Whop receipt email matches Vidso login when only the dots differ', () => {
  const row = {
    status: 'active',
    user: { email: 'subramaniam.vishwak@gmail.com' },
    plan: { id: 'plan_pro' },
  }
  assert.equal(membershipMatchesUser(row, { email: 'subramaniamvishwak@gmail.com' }), true)
  assert.equal(membershipMatchesUser(row, { emails: ['subramaniamvishwak@gmail.com'] }), true)
})
