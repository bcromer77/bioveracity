// Server wrapper for the "Analyse your own opportunity" upload step. It enforces
// the same access guard as the dashboard (feature flag, authenticated member of
// the Ellona workspace, trial not read-only) and passes the pre-upload notice
// and decision options into the client uploader. The actual create call is the
// tenant-scoped POST /api/ellona/assessment.

import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { ellonaEnabled } from '@/lib/ellona/config'
import { findEllonaWorkspace, trialAllowsWrites } from '@/lib/ellona/access'
import { prisma } from '@/lib/prisma'
import { PRE_UPLOAD_NOTICE } from '@/lib/ellona/flow-format-policy'
import { DECISION_TYPES, DECISION_LABELS } from '@/lib/ellona/config'
import { EllonaShell } from '@/components/ellona/ellona-shell'
import { AssessUploader } from '@/components/ellona/assess-uploader'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

const BAZIL_EMAIL = 'bazil.cromer@ripplexn.com'

export default async function EllonaAssessPage() {
  if (!ellonaEnabled()) notFound()
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login?callbackUrl=/ellona/assess')
  const membership = await findEllonaWorkspace(userId)
  if (!membership) redirect('/professionals')

  const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId: membership.workspaceId } })
  const readOnly = !tenant || !trialAllowsWrites(tenant.trialState)
  const isAdmin = (session?.user?.email || '').toLowerCase() === BAZIL_EMAIL

  const decisions = DECISION_TYPES.map((d) => ({ value: d, label: DECISION_LABELS[d] }))

  return (
    <EllonaShell showAdmin={isAdmin}>
      <div className="bv-eyebrow">Analyse your own opportunity</div>
      <h1 style={{ marginTop: 8 }}>Bring an opportunity for private analysis</h1>
      <p className="bv-lead" style={{ marginTop: 8, maxWidth: 720 }}>
        Upload a public opportunity document and BioVeracity will read it and lay out the qualification picture for
        you to review. Nothing you upload here is published, added to the evidence base, or shared outside your
        workspace. It is private working material for your team only.
      </p>
      <AssessUploader notice={PRE_UPLOAD_NOTICE} decisions={decisions} readOnly={readOnly} />
    </EllonaShell>
  )
}
