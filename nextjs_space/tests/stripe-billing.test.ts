import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { billingConfig, billingPlans, planForCheckout, subscriptionState, verifyStripeSignature } from '../lib/billing/stripe'
import { WorkspaceError } from '../lib/workspaces/service'

const keys = [
  'BIOVERACITY_BILLING_ENABLED',
  'BIOVERACITY_BILLING_LIVE_ALLOWED',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_WILD_MONTHLY_PRICE_ID',
  'STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID',
  'STRIPE_WILD_SELF_SERVE_ENABLED',
  'STRIPE_PROFESSIONAL_SELF_SERVE_ENABLED',
] as const

function reset() { for (const key of keys) delete process.env[key] }

test('billing is disabled by default and live keys fail closed without explicit live permission', () => {
  reset()
  assert.equal(billingConfig().enabled, false)
  process.env.BIOVERACITY_BILLING_ENABLED = 'true'
  assert.throws(() => billingConfig(), (e: unknown) => e instanceof WorkspaceError && e.status === 503)
  process.env.STRIPE_SECRET_KEY = 'sk_live_example'
  assert.throws(() => billingConfig(), (e: unknown) => e instanceof WorkspaceError && e.status === 503)
  process.env.BIOVERACITY_BILLING_LIVE_ALLOWED = 'true'
  assert.equal(billingConfig().live, true)
  reset()
})

test('only explicitly enabled plans with configured price IDs can reach checkout', () => {
  reset()
  process.env.STRIPE_WILD_MONTHLY_PRICE_ID = 'price_wild'
  process.env.STRIPE_WILD_SELF_SERVE_ENABLED = 'true'
  assert.equal(billingPlans().find(p => p.key === 'WILD_MONTHLY')?.enabled, true)
  assert.equal(planForCheckout('WILD_MONTHLY').priceId, 'price_wild')
  assert.throws(() => planForCheckout('PROFESSIONAL_MONTHLY'), WorkspaceError)
  reset()
})

test('Stripe signatures are verified against timestamped raw payload and stale signatures fail', () => {
  const payload = '{"id":"evt_1"}'
  const secret = 'whsec_test'
  const timestamp = 1_789_835_000
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp + 10), timestamp)
  assert.throws(() => verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp + 301), WorkspaceError)
  assert.throws(() => verifyStripeSignature(payload + 'x', `t=${timestamp},v1=${signature}`, secret, timestamp + 10), WorkspaceError)
})

test('subscription state is derived from Stripe metadata without treating payment as application truth', () => {
  const state = subscriptionState({
    created: 123,
    data: { object: {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: false,
      metadata: { bioveracityUserId: 'u1', planKey: 'WILD_MONTHLY' },
      items: { data: [{ price: { id: 'price_wild' }, current_period_end: 1_800_000_000 }] },
    } },
  })
  assert.equal(state.userId, 'u1')
  assert.equal(state.status, 'ACTIVE')
  assert.equal(state.priceId, 'price_wild')
  assert.equal(state.currentPeriodEnd?.toISOString(), new Date(1_800_000_000 * 1000).toISOString())
})
