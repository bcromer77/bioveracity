import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { billingConfig, subscriptionState, verifyStripeSignature } from '@/lib/billing/stripe'
import { WorkspaceError } from '@/lib/workspaces/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type StripeEvent = {
  id: string
  type: string
  created: number
  livemode: boolean
  data?: { object?: any }
}

async function persistSubscription(event: StripeEvent) {
  const state = subscriptionState(event)
  await prisma.$transaction(async tx => {
    const seen = await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } })
    if (seen) return

    const existing = await tx.billingAccount.findUnique({ where: { userId: state.userId } })
    if (existing?.lastStripeEventCreated && existing.lastStripeEventCreated > state.eventCreated) {
      await tx.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type, created: event.created, livemode: event.livemode },
      })
      return
    }

    await tx.billingAccount.upsert({
      where: { userId: state.userId },
      create: {
        id: randomUUID(),
        userId: state.userId,
        stripeCustomerId: state.stripeCustomerId,
        stripeSubscriptionId: state.stripeSubscriptionId,
        planKey: state.planKey,
        priceId: state.priceId,
        status: state.status,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        currentPeriodEnd: state.currentPeriodEnd,
        lastStripeEventCreated: state.eventCreated,
      },
      update: {
        stripeCustomerId: state.stripeCustomerId || existing?.stripeCustomerId || null,
        stripeSubscriptionId: state.stripeSubscriptionId,
        planKey: state.planKey,
        priceId: state.priceId,
        status: state.status,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        currentPeriodEnd: state.currentPeriodEnd,
        lastStripeEventCreated: state.eventCreated,
      },
    })

    await tx.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type, created: event.created, livemode: event.livemode },
    })
  })
}

async function persistCheckout(event: StripeEvent) {
  const object = event.data?.object
  const userId = object?.metadata?.bioveracityUserId || object?.client_reference_id
  const customerId = typeof object?.customer === 'string' ? object.customer : null
  if (!userId || !customerId) return

  await prisma.$transaction(async tx => {
    const seen = await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } })
    if (seen) return
    await tx.billingAccount.upsert({
      where: { userId: String(userId) },
      create: { id: randomUUID(), userId: String(userId), stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    })
    await tx.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type, created: event.created, livemode: event.livemode },
    })
  })
}

export async function POST(request: Request) {
  try {
    const cfg = billingConfig()
    if (!cfg.enabled || !cfg.webhookSecret) throw new WorkspaceError(503, 'Stripe webhook is not configured')
    const declaredLength = Number(request.headers.get('content-length') || '0')
    if (declaredLength > 1024 * 1024) throw new WorkspaceError(413, 'Stripe webhook payload is too large')
    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) throw new WorkspaceError(413, 'Stripe webhook payload is too large')
    verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), cfg.webhookSecret)
    const event = JSON.parse(rawBody) as StripeEvent
    if (!event?.id || !event?.type || !Number.isFinite(event.created)) throw new WorkspaceError(400, 'Invalid Stripe event')

    if (cfg.live !== Boolean(event.livemode)) throw new WorkspaceError(400, 'Stripe event mode does not match this deployment')

    if (event.type === 'checkout.session.completed') {
      await persistCheckout(event)
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await persistSubscription(event)
    } else {
      try {
        await prisma.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type, created: event.created, livemode: event.livemode },
        })
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error
      }
    }

    return Response.json({ received: true })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Stripe webhook failed' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
    })
  }
}
