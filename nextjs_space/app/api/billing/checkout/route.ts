import { randomUUID } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { body, privateHeaders } from '@/lib/workspaces/http'
import { WorkspaceError } from '@/lib/workspaces/service'
import { billingConfig, createCheckoutSession, createStripeCustomer, planForCheckout } from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function publicOrigin(request: Request) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '')
  if (!host || !['http', 'https'].includes(proto)) throw new WorkspaceError(400, 'Unable to determine return address')
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.email) throw new WorkspaceError(401, 'Authentication required')
    if (!billingConfig().enabled) throw new WorkspaceError(503, 'Billing is not enabled on this deployment')
    const input = await body(request) as Record<string, unknown>
    const plan = planForCheckout(input.planKey)

    let account = await prisma.billingAccount.findUnique({ where: { userId: session.user.id } })
    let customerId = account?.stripeCustomerId || null
    if (!customerId) {
      const customer = await createStripeCustomer(session.user.email, session.user.id)
      customerId = customer.id
      account = await prisma.billingAccount.upsert({
        where: { userId: session.user.id },
        create: { id: randomUUID(), userId: session.user.id, stripeCustomerId: customerId },
        update: { stripeCustomerId: customerId },
      })
    }

    const origin = publicOrigin(request)
    const checkout = await createCheckoutSession({
      customerId,
      userId: session.user.id,
      plan,
      successUrl: `${origin}/account?billing=return`,
      cancelUrl: `${origin}/account?billing=cancelled`,
    })
    if (!checkout.url) throw new WorkspaceError(503, 'Stripe did not return a checkout address')
    return Response.json({ url: checkout.url }, { headers: privateHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Checkout could not be started' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
      headers: privateHeaders,
    })
  }
}
