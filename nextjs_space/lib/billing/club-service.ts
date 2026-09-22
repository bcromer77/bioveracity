import { TERMS_VERSION } from '../data-rights/policy'
import { createHash, randomUUID } from 'node:crypto'
import { WorkspaceError, type Database, type Sql } from '../workspaces/service'
import { CLUB_AMOUNT, checkoutUrl, uuid, verifyRevolutWebhook, type RevolutApi, type RevolutConfig, type Subscription } from './revolut'

export type ClubSubscription = { id: string; hubId: string; ownerId: string; mode: string; planId: string; variationId: string; customerId: string | null; subscriptionId: string | null; setupOrderId: string | null; state: string; paidUntil: Date | null; paymentState: string; revision: number; checkedAt: Date | null }
export async function ownedClub(db: Sql, hubId: string, userId: string) {
  const [hub] = await db.query<{ id: string; email: string; name: string }>('SELECT h.id,u.email,h.profile->>\'name\' AS name FROM "WildHub" h JOIN "User" u ON u.id=h."ownerId" WHERE h.id=$1 AND h."ownerId"=$2', [hubId,userId])
  if (!hub) throw new WorkspaceError(404, 'Club not found.')
  return hub
}
export async function clubBilling(db: Sql, hubId: string, userId: string) {
  await ownedClub(db,hubId,userId)
  const [row] = await db.query<ClubSubscription>('SELECT * FROM "ClubSubscription" WHERE "hubId"=$1 AND "ownerId"=$2',[hubId,userId])
  return row ? { state:row.state, paymentState:row.paymentState, paidUntil:row.paidUntil, checkedAt:row.checkedAt, canCancel:Boolean(row.subscriptionId && !['cancelled','finished'].includes(row.state)), canCheckout:row.state==='pending', needsReconciliation:['CREATING','UNKNOWN'].includes(row.state) } : null
}
function identity(row: ClubSubscription, remote: Subscription) {
  if (!uuid(remote.id) || remote.external_reference !== row.id || remote.customer_id !== row.customerId || remote.plan_id !== row.planId || remote.plan_variation_id !== row.variationId || (row.subscriptionId && remote.id !== row.subscriptionId) || !['pending','active','overdue','paused','cancelled','finished'].includes(remote.state) || !Number.isFinite(Date.parse(remote.updated_at))) throw new WorkspaceError(503, 'Subscription identity could not be verified. Contact support.')
}
export async function syncClubBilling(db: Sql, row: ClubSubscription, api: RevolutApi, config: RevolutConfig, now = new Date()) {
  if (row.mode !== config.mode || !row.subscriptionId) throw new WorkspaceError(409, 'Billing needs operator reconciliation before it can continue.')
  const remote = await api.subscription(row.subscriptionId)
  identity(row,remote)
  let paidUntil = row.paidUntil, paymentState = row.paymentState
  if (uuid(remote.current_cycle_id)) {
    const cycle = await api.cycle(remote.id, remote.current_cycle_id)
    if (cycle.id !== remote.current_cycle_id || cycle.subscription_id !== remote.id || cycle.plan_variation_id !== row.variationId) throw new WorkspaceError(503,'Billing cycle did not match the subscription.')
    if (uuid(cycle.order_id)) {
      const order = await api.order(cycle.order_id)
      if (order.id !== cycle.order_id) throw new WorkspaceError(503,'Payment did not match the billing cycle.')
      paymentState = order.state
      const amount = order.amount, currency = order.currency
      if (order.state === 'completed' && amount === CLUB_AMOUNT && currency === 'EUR' && cycle.trial !== true && cycle.end_date && Number.isFinite(Date.parse(cycle.end_date))) {
        const end = new Date(cycle.end_date)
        if (!paidUntil || end > paidUntil) paidUntil = end
      }
    }
  }
  // Revision prevents a slow response overwriting a newer checkout/cancellation/poll.
  // Provider timestamp also prevents out-of-order webhook fetches regressing state.
  await db.query('UPDATE "ClubSubscription" SET state=$2,"providerUpdatedAt"=$3,"paidUntil"=$4,"paymentState"=$5,"checkedAt"=$6,revision=revision+1 WHERE id=$1 AND revision=$7 AND ("providerUpdatedAt" IS NULL OR "providerUpdatedAt"<=$3::timestamptz) RETURNING id',[row.id,remote.state,remote.updated_at,paidUntil,paymentState,now,row.revision])
}
export function clubBillingService(db: Database, userId: string, api: RevolutApi, config: RevolutConfig) {
  async function stored(hubId: string) {
    await ownedClub(db,hubId,userId)
    const [row] = await db.query<ClubSubscription>('SELECT * FROM "ClubSubscription" WHERE "hubId"=$1 AND "ownerId"=$2',[hubId,userId])
    if (!row || row.mode !== config.mode) throw new WorkspaceError(409,'No subscription is available in this payment environment.')
    return row
  }
  async function urlFor(row: ClubSubscription) {
    if (!row.setupOrderId || row.state !== 'pending') throw new WorkspaceError(409,'Refresh billing status. A second subscription will not be created.')
    const order = await api.order(row.setupOrderId)
    if (order.id !== row.setupOrderId || ['completed','cancelled','failed'].includes(order.state)) throw new WorkspaceError(503,'Checkout order did not match.')
    return { url:checkoutUrl(order.checkout_url,config.mode) }
  }
  return {
    async checkout(hubId: string, confirmed: unknown) {
      if (confirmed !== true) throw new WorkspaceError(400,'Confirm the €80 monthly recurring subscription before continuing.')
      const hub = await ownedClub(db,hubId,userId)
      const verified = await db.query('SELECT id FROM "User" WHERE id=$1 AND "emailVerified" IS NOT NULL',[userId])
      if (!verified.length) throw new WorkspaceError(403,'Verify your email before subscribing.')
      await api.checkPlan()
      // Never start a competing subscription for an existing Stripe customer.
      const stripe = await db.query('SELECT id FROM "BillingAccount" WHERE "userId"=$1 AND status NOT IN (\'NONE\',\'CANCELED\',\'INCOMPLETE_EXPIRED\')',[userId])
      if (stripe.length) throw new WorkspaceError(409,'An existing billing plan needs to be reconciled before switching provider.')
      const id = randomUUID()
      const inserted = await db.query<ClubSubscription>('INSERT INTO "ClubSubscription" (id,"hubId","ownerId",mode,"planId","variationId","termsVersion","taxLabel") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("hubId") DO NOTHING RETURNING *',[id,hubId,userId,config.mode,config.planId,config.variationId,TERMS_VERSION,config.taxLabel])
      if (!inserted.length) return urlFor(await stored(hubId))
      try {
        const customer = await api.customer(hub.email)
        if (!uuid(customer.id)) throw Error('Invalid customer')
        await db.query('UPDATE "ClubSubscription" SET "customerId"=$2 WHERE id=$1',[id,customer.id])
        const remote = await api.create(id,customer.id,hubId)
        identity({...inserted[0],customerId:customer.id},remote)
        if (!uuid(remote.setup_order_id)) throw Error('Missing setup order')
        const [row] = await db.query<ClubSubscription>('UPDATE "ClubSubscription" SET "subscriptionId"=$2,"setupOrderId"=$3,state=$4,"providerUpdatedAt"=$5,revision=revision+1 WHERE id=$1 RETURNING *',[id,remote.id,remote.setup_order_id,remote.state,remote.updated_at])
        return await urlFor(row)
      } catch (error) {
        // The provider may have accepted a write even if the response was lost.
        // Do not repeat customer creation or start a second subscription.
        await db.query('UPDATE "ClubSubscription" SET state=\'UNKNOWN\' WHERE id=$1 AND "subscriptionId" IS NULL',[id])
        throw error instanceof WorkspaceError ? error : new WorkspaceError(503,'Checkout needs reconciliation. Contact support; no automatic retry will create a second subscription.')
      }
    },
    async refresh(hubId: string) { await syncClubBilling(db,await stored(hubId),api,config); return clubBilling(db,hubId,userId) },
    async cancel(hubId: string, confirmed: unknown) {
      if (confirmed !== 'CANCEL SUBSCRIPTION') throw new WorkspaceError(400,'Confirm cancellation.')
      const row = await stored(hubId)
      if (!row.subscriptionId) throw new WorkspaceError(409,'The pending checkout needs operator reconciliation.')
      const current = await api.subscription(row.subscriptionId); identity(row,current)
      if (!['cancelled','finished'].includes(current.state)) await api.cancel(row.subscriptionId)
      // Only a provider-confirmed response changes local state. Data is untouched.
      await syncClubBilling(db,row,api,config)
      return clubBilling(db,hubId,userId)
    },
  }
}
export async function receiveRevolut(db: Sql, config: RevolutConfig, raw: string, timestamp: string|null, signature: string|null, now = Date.now()) {
  const event = verifyRevolutWebhook(raw,timestamp,signature,config.signingSecret,now)
  const hash = createHash('sha256').update(`${config.mode}:${timestamp}:${raw}`).digest('hex')
  await db.query('INSERT INTO "RevolutReceipt" (hash,"subscriptionId",event) VALUES ($1,$2,$3) ON CONFLICT (hash) DO NOTHING',[hash,event.subscriptionId,event.event])
}
export async function reconcileRevolut(db: Sql, api: RevolutApi, config: RevolutConfig) {
  // Includes pending: Revolut does not emit an activation webhook.
  const rows = await db.query<ClubSubscription>('SELECT * FROM "ClubSubscription" WHERE mode=$1 AND "subscriptionId" IS NOT NULL ORDER BY "checkedAt" NULLS FIRST LIMIT 100',[config.mode])
  let failed=0
  for (const row of rows) {
    const started=new Date()
    try {
      await syncClubBilling(db,row,api,config)
      await db.query('UPDATE "RevolutReceipt" SET "processedAt"=$2 WHERE "subscriptionId"=$1 AND "processedAt" IS NULL AND "receivedAt"<$2',[row.subscriptionId,started])
    } catch { failed++ }
  }
  const unresolved = await db.query('SELECT id FROM "ClubSubscription" WHERE mode=$1 AND "subscriptionId" IS NULL',[config.mode])
  return { checked:rows.length, failed, unresolved:unresolved.length }
}
