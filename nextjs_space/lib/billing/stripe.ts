import { createHmac, timingSafeEqual } from 'node:crypto'
import { WorkspaceError } from '@/lib/workspaces/service'

export type BillingPlanKey = 'WILD_MONTHLY' | 'PROFESSIONAL_MONTHLY'

type PlanConfig = { key: BillingPlanKey; label: string; priceId: string; enabled: boolean }

function envFlag(name: string) { return process.env[name] === 'true' }

export function billingConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  const enabled = envFlag('BIOVERACITY_BILLING_ENABLED')
  const live = secretKey.startsWith('sk_live_')
  if (enabled && process.env.BILLING_PROVIDER && process.env.BILLING_PROVIDER !== 'stripe') throw new WorkspaceError(503, 'The selected payment provider is not available on this deployment')
  if (enabled && !secretKey) throw new WorkspaceError(503, 'Billing is not configured on this deployment')
  if (live && !envFlag('BIOVERACITY_BILLING_LIVE_ALLOWED')) throw new WorkspaceError(503, 'Live billing is not enabled on this deployment')
  return {
    enabled,
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    apiVersion: process.env.STRIPE_API_VERSION || '',
    live,
  }
}

export function billingPlans(): PlanConfig[] {
  return [
    {
      key: 'WILD_MONTHLY',
      label: 'Wild venue membership',
      priceId: process.env.STRIPE_WILD_MONTHLY_PRICE_ID || '',
      enabled: envFlag('STRIPE_WILD_SELF_SERVE_ENABLED'),
    },
    {
      key: 'PROFESSIONAL_MONTHLY',
      label: 'Professional workspace',
      priceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || '',
      enabled: envFlag('STRIPE_PROFESSIONAL_SELF_SERVE_ENABLED'),
    },
  ]
}

export function planForCheckout(value: unknown): PlanConfig {
  if (typeof value !== 'string') throw new WorkspaceError(400, 'Choose an available plan')
  const plan = billingPlans().find(p => p.key === value)
  if (!plan || !plan.enabled || !plan.priceId) throw new WorkspaceError(400, 'That plan is not available for self-service billing')
  return plan
}

function stripeHeaders(idempotencyKey?: string) {
  const cfg = billingConfig()
  if (!cfg.enabled) throw new WorkspaceError(503, 'Billing is not enabled on this deployment')
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (cfg.apiVersion) headers['Stripe-Version'] = cfg.apiVersion
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return headers
}

export async function stripeRequest<T>(path: string, params: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: stripeHeaders(idempotencyKey),
    body: params,
    cache: 'no-store',
  })
  const data = await response.json() as { error?: { message?: string } } & T
  if (!response.ok) throw new WorkspaceError(response.status >= 500 ? 503 : 400, data.error?.message || 'Stripe request failed')
  return data
}

export async function createStripeCustomer(email: string, userId: string) {
  const params = new URLSearchParams()
  params.set('email', email)
  params.set('metadata[bioveracityUserId]', userId)
  return stripeRequest<{ id: string }>('customers', params, `bioveracity-customer-${userId}`)
}

export async function createCheckoutSession(input: {
  customerId: string
  userId: string
  plan: PlanConfig
  successUrl: string
  cancelUrl: string
}) {
  const params = new URLSearchParams()
  params.set('mode', 'subscription')
  params.set('customer', input.customerId)
  params.set('line_items[0][price]', input.plan.priceId)
  params.set('line_items[0][quantity]', '1')
  params.set('success_url', input.successUrl)
  params.set('cancel_url', input.cancelUrl)
  params.set('client_reference_id', input.userId)
  params.set('metadata[bioveracityUserId]', input.userId)
  params.set('metadata[planKey]', input.plan.key)
  params.set('subscription_data[metadata][bioveracityUserId]', input.userId)
  params.set('subscription_data[metadata][planKey]', input.plan.key)
  return stripeRequest<{ id: string; url: string | null }>('checkout/sessions', params)
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const params = new URLSearchParams()
  params.set('customer', customerId)
  params.set('return_url', returnUrl)
  return stripeRequest<{ id: string; url: string }>('billing_portal/sessions', params)
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!signatureHeader || !secret) throw new WorkspaceError(400, 'Invalid Stripe webhook signature')
  let timestamp = 0
  const signatures: string[] = []
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=', 2)
    if (key === 't') timestamp = Number(value)
    if (key === 'v1' && value) signatures.push(value)
  }
  if (!Number.isFinite(timestamp) || !timestamp || Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new WorkspaceError(400, 'Invalid Stripe webhook signature')
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  const valid = signatures.some(sig => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false
    const candidate = Buffer.from(sig, 'hex')
    return candidate.length === expectedBytes.length && timingSafeEqual(candidate, expectedBytes)
  })
  if (!valid) throw new WorkspaceError(400, 'Invalid Stripe webhook signature')
  return timestamp
}

export function subscriptionState(event: any) {
  const object = event?.data?.object
  const userId = object?.metadata?.bioveracityUserId
  const planKey = object?.metadata?.planKey || null
  const item = Array.isArray(object?.items?.data) ? object.items.data[0] : null
  if (!userId || !object?.id) throw new WorkspaceError(400, 'Stripe subscription is missing BioVeracity metadata')
  return {
    userId: String(userId),
    stripeSubscriptionId: String(object.id),
    stripeCustomerId: typeof object.customer === 'string' ? object.customer : null,
    planKey: typeof planKey === 'string' ? planKey : null,
    priceId: typeof item?.price?.id === 'string' ? item.price.id : null,
    status: String(object.status || 'unknown').toUpperCase(),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    currentPeriodEnd: Number.isFinite(item?.current_period_end) ? new Date(item.current_period_end * 1000) : null,
    eventCreated: Number(event.created || 0),
  }
}
