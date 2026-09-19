import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { body, privateHeaders } from '@/lib/workspaces/http'
import { WorkspaceError } from '@/lib/workspaces/service'
import { billingConfig, createPortalSession } from '@/lib/billing/stripe'

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
    if (!session?.user?.id) throw new WorkspaceError(401, 'Authentication required')
    if (!billingConfig().enabled) throw new WorkspaceError(503, 'Billing is not enabled on this deployment')
    await body(request)
    const account = await prisma.billingAccount.findUnique({ where: { userId: session.user.id } })
    if (!account?.stripeCustomerId) throw new WorkspaceError(404, 'No billing account is available yet')
    const portal = await createPortalSession(account.stripeCustomerId, `${publicOrigin(request)}/account`)
    return Response.json({ url: portal.url }, { headers: privateHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Billing portal could not be opened' }, {
      status: error instanceof WorkspaceError ? error.status : 500,
      headers: privateHeaders,
    })
  }
}
