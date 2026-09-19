import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { billingConfig, billingPlans } from '@/lib/billing/stripe'
import { privateHeaders } from '@/lib/workspaces/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Authentication required' }, { status: 401, headers: privateHeaders })
  let enabled = false
  try { enabled = billingConfig().enabled } catch { enabled = false }
  const account = await prisma.billingAccount.findUnique({ where: { userId: session.user.id } })
  return Response.json({
    enabled,
    plans: enabled ? billingPlans().filter(p => p.enabled && p.priceId).map(({ key, label }) => ({ key, label })) : [],
    account: account ? {
      status: account.status,
      planKey: account.planKey,
      cancelAtPeriodEnd: account.cancelAtPeriodEnd,
      currentPeriodEnd: account.currentPeriodEnd,
      canManage: Boolean(account.stripeCustomerId),
    } : null,
  }, { headers: privateHeaders })
}
