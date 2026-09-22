import { createHmac, timingSafeEqual } from 'node:crypto'
import { WorkspaceError } from '../workspaces/service'

export const CLUB_AMOUNT = 8000
export const REVOLUT_VERSION = '2026-08-17'
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
export type RevolutConfig = { mode: 'sandbox' | 'live'; key: string; signingSecret: string; origin: string; planId: string; variationId: string; taxLabel: string }
export function revolutConfig(env: Record<string,string|undefined> = process.env): RevolutConfig {
  if (env.BIOVERACITY_BILLING_ENABLED !== 'true' || env.BILLING_PROVIDER !== 'revolut') throw new WorkspaceError(503, 'Revolut billing is not enabled.')
  const mode = env.REVOLUT_MODE
  if (mode !== 'sandbox' && mode !== 'live') throw new WorkspaceError(503, 'Revolut environment is not configured.')
  if (mode === 'live' && (env.BIOVERACITY_BILLING_LIVE_ALLOWED !== 'true' || env.REVOLUT_LIVE_LAUNCH_APPROVED !== 'true')) throw new WorkspaceError(503, 'Live billing has not been approved.')
  const origin = new URL(env.APP_BASE_URL || 'https://invalid.local')
  if (!env.APP_BASE_URL || origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new WorkspaceError(503, 'Billing requires the configured HTTPS application origin.')
  if (!env.REVOLUT_SECRET_KEY || !env.REVOLUT_WEBHOOK_SECRET || !uuid(env.REVOLUT_CLUB_PLAN_ID) || !uuid(env.REVOLUT_CLUB_VARIATION_ID) || !env.REVOLUT_CLUB_TAX_LABEL?.trim()) throw new WorkspaceError(503, 'The club plan, tax wording and Revolut credentials must be configured.')
  return { mode, key: env.REVOLUT_SECRET_KEY, signingSecret: env.REVOLUT_WEBHOOK_SECRET, origin: origin.origin, planId: env.REVOLUT_CLUB_PLAN_ID, variationId: env.REVOLUT_CLUB_VARIATION_ID, taxLabel: env.REVOLUT_CLUB_TAX_LABEL.trim().slice(0,160) }
}
export function checkoutUrl(value: unknown, mode: RevolutConfig['mode']) {
  if (typeof value !== 'string') throw new WorkspaceError(503, 'Checkout is not available yet. Refresh billing status.')
  const url = new URL(value)
  const host = mode === 'live' ? 'checkout.revolut.com' : 'sandbox-checkout.revolut.com'
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password) throw new WorkspaceError(503, 'Unexpected payment address. Contact support.')
  return url.href
}
export type Subscription = { id: string; state: string; external_reference?: string; customer_id: string; plan_id: string; plan_variation_id: string; updated_at: string; setup_order_id?: string; current_cycle_id?: string }
export type Cycle = { id: string; subscription_id: string; plan_variation_id: string; end_date?: string; order_id?: string; trial?: boolean }
export type Order = { id: string; state: string; currency: string; amount?: number; checkout_url?: string }
export type RevolutApi = ReturnType<typeof revolutApi>
export function revolutApi(config: RevolutConfig, transport: typeof fetch = fetch) {
  async function request<T>(path: string, input?: unknown, key?: string): Promise<T> {
    const response = await transport(`${config.mode === 'live' ? 'https://merchant.revolut.com' : 'https://sandbox-merchant.revolut.com'}/api/${path}`, {
      method: input === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.key}`, 'Revolut-Api-Version': REVOLUT_VERSION, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: input === undefined ? undefined : JSON.stringify(input),
    })
    if (!response.ok) throw new WorkspaceError(503, 'Revolut could not confirm this operation. Refresh status before trying again.')
    if (response.status === 204) return undefined as T
    const text = await response.text()
    if (text.length > 500000) throw new WorkspaceError(503, 'Unexpected payment response.')
    return JSON.parse(text) as T
  }
  return {
    async checkPlan() {
      const plan = await request<{ id: string; state: string; trial_duration?: string; variations: { id: string; trial_duration?: string; phases: { ordinal: number; cycle_duration: string; amount: number; currency: string; cycle_count?: number | null; subscription_items?: unknown[] }[] }[] }>(`subscription-plans/${config.planId}`)
      const variation = plan.variations?.find(v => v.id === config.variationId), phase = variation?.phases?.[0]
      if (plan.id !== config.planId || plan.state !== 'active' || plan.trial_duration || variation?.trial_duration || variation?.phases.length !== 1 || !phase || phase.ordinal !== 1 || phase.cycle_duration !== 'P1M' || phase.amount !== CLUB_AMOUNT || phase.currency !== 'EUR' || phase.cycle_count != null || phase.subscription_items?.length) throw new WorkspaceError(503, 'The Revolut plan must be exactly €80 EUR each month with no trial, extra items or scheduled price change.')
    },
    customer: (email: string) => request<{ id: string }>('customers', { email }),
    create: (id: string, customerId: string, hubId: string) => request<Subscription>('subscriptions', { customer_id: customerId, plan_variation_id: config.variationId, external_reference: id, setup_order_redirect_url: `${config.origin}/wild/studio/${encodeURIComponent(hubId)}/club?billing=return` }, id),
    subscription: (id: string) => request<Subscription>(`subscriptions/${id}`),
    cycle: (id: string, cycle: string) => request<Cycle>(`subscriptions/${id}/cycles/${cycle}`),
    order: (id: string) => request<Order>(`orders/${id}`),
    cancel: (id: string) => request<void>(`subscriptions/${id}/cancel`, {}),
  }
}
export function verifyRevolutWebhook(raw: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()) {
  if (!secret || !timestamp || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000 || !signature || raw.length > 65536) throw new WorkspaceError(400, 'Invalid webhook signature.')
  const expected = createHmac('sha256', secret).update(`v1.${timestamp}.${raw}`).digest()
  const valid = signature.split(',').some(s => { const m = /^v1=([a-f0-9]{64})$/i.exec(s.trim()); return m ? timingSafeEqual(Buffer.from(m[1], 'hex'), expected) : false })
  if (!valid) throw new WorkspaceError(400, 'Invalid webhook signature.')
  let event: { event?: unknown; subscription_id?: unknown }
  try { event=JSON.parse(raw); if(!event || typeof event!=='object')throw Error('Invalid event') } catch { throw new WorkspaceError(400,'Invalid webhook body.') }
  if (!uuid(event.subscription_id) || !['SUBSCRIPTION_INITIATED','SUBSCRIPTION_FINISHED','SUBSCRIPTION_CANCELLED','SUBSCRIPTION_OVERDUE'].includes(String(event.event))) throw new WorkspaceError(400, 'Unsupported webhook.')
  return { subscriptionId: event.subscription_id, event: String(event.event) }
}
