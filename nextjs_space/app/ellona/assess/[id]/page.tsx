// Server wrapper for the assessment review screen. Enforces the access guard and
// hands the assessment id to the client reviewer, which fetches the reviewed
// extraction from GET /api/ellona/assessment/[id]. The review-before-PDF rule is
// enforced both here-adjacent (the PDF button is disabled until the assessment
// is marked reviewed) and in the PDF route itself (409 until REVIEWED).

import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { ellonaEnabled } from '@/lib/ellona/config'
import { findEllonaWorkspace, trialAllowsWrites } from '@/lib/ellona/access'
import { prisma } from '@/lib/prisma'
import { EllonaShell } from '@/components/ellona/ellona-shell'
import { AssessReview } from '@/components/ellona/assess-review'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

const BAZIL_EMAIL = 'bazil.cromer@ripplexn.com'

export default async function EllonaAssessReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ellonaEnabled()) notFound()
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect(`/login?callbackUrl=/ellona/assess/${id}`)
  const membership = await findEllonaWorkspace(userId)
  if (!membership) redirect('/professionals')

  // Tenant-scoped existence check; a foreign id resolves to notFound, never leaks.
  const owned = await prisma.opportunityAssessment.findFirst({
    where: { id, workspaceId: membership.workspaceId },
    select: { id: true },
  })
  if (!owned) notFound()

  const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId: membership.workspaceId } })
  const readOnly = !tenant || !trialAllowsWrites(tenant.trialState)
  const isAdmin = (session?.user?.email || '').toLowerCase() === BAZIL_EMAIL

  return (
    <EllonaShell showAdmin={isAdmin}>
      <AssessReview id={id} readOnly={readOnly} />
    </EllonaShell>
  )
}
