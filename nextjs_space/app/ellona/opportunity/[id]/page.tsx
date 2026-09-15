import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ellonaEnabled, ELLONA, REPRESENTATION_LINE } from '@/lib/ellona/config'
import { resolveEllonaView, trialAllowsWrites } from '@/lib/ellona/access'
import { EllonaShell } from '@/components/ellona/ellona-shell'
import { EllonaMap } from '@/components/ellona/ellona-map'
import { OpportunityActions } from '@/components/ellona/opportunity-actions'
import type { MapPoint } from '@/components/ellona/ellona-map-inner'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Opportunity record | BioVeracity', robots: { index: false, follow: false } }

const BAZIL_EMAIL = 'bazil.cromer@ripplexn.com'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

export default async function OpportunityRecordPage({ params }: { params: Promise<{ id: string }> }) {
  if (!ellonaEnabled()) notFound()
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect(`/login?callbackUrl=/ellona/opportunity/${id}`)
  const view = await resolveEllonaView(userId, session?.user?.email)
  if (!view) redirect('/professionals')
  const workspaceId = view.workspaceId
  const preview = view.preview

  const opp = await prisma.opportunity.findFirst({ where: { id, workspaceId } })
  if (!opp) notFound()

  const [events, followActions, tenant] = await Promise.all([
    prisma.opportunityEvent.findMany({ where: { opportunityId: opp.id }, orderBy: { createdAt: 'asc' } }),
    prisma.opportunityAction.findMany({
      where: { workspaceId, opportunityId: opp.id, kind: { in: ['FOLLOW', 'UNFOLLOW'] } },
      orderBy: { createdAt: 'asc' },
      select: { kind: true },
    }),
    prisma.partnerTenant.findUnique({ where: { workspaceId } }),
  ])

  const following = followActions.length ? followActions[followActions.length - 1].kind === 'FOLLOW' : opp.status === 'FOLLOWING'
  // Read-only when there is no writable trial, and always in the originator preview.
  const readOnly = preview || !tenant || !trialAllowsWrites(tenant.trialState)
  const isAdmin = (session?.user?.email || '').toLowerCase() === BAZIL_EMAIL

  const themes = (opp.themes as unknown as string[]) || []
  const capabilities = (opp.capabilities as unknown as string[]) || []
  const questions = (opp.clarificationQuestions as unknown as string[]) || []
  const provenance = (opp.provenance as Record<string, unknown>) || {}

  const points: MapPoint[] =
    opp.latitude != null && opp.longitude != null
      ? [
          {
            id: opp.id,
            lat: opp.latitude,
            lng: opp.longitude,
            title: opp.title,
            classification: opp.classification,
            buyer: opp.buyer,
            location: [opp.region, opp.country].filter(Boolean).join(', '),
            precision: opp.precision || 'regional',
            deadline: opp.tenderDeadline || opp.clarificationDeadline,
            nextAction: opp.nextAction || '',
          },
        ]
      : []

  return (
    <EllonaShell showAdmin={isAdmin} preview={preview}>
      <p className="bv-eyebrow" style={{ color: '#7d7148' }}>
        <Link href="/ellona">← Back to dashboard</Link>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="bv-tag bv-tag-status">{opp.status}</span>
        <span className="bv-tag bv-tag-class">{opp.classification}</span>
        {following ? <span className="bv-tag bv-tag-cat">Following</span> : null}
        {opp.seedLabel ? <span className="bv-tag bv-tag-cat">{opp.seedLabel}</span> : null}
      </div>
      <h1>{opp.nextAction || opp.title}</h1>
      <p className="bv-lead">{opp.title}</p>
      <p className="bv-ellona-rep">{REPRESENTATION_LINE}</p>

      <div className="bv-ellona-cta">
        <a className="bv-button bv-green" href={`/api/ellona/opportunity/${opp.id}/pdf`}>
          Download opportunity brief (PDF)
        </a>
      </div>

      <h2>Record</h2>
      <div className="bv-ellona-panel">
        <dl>
          <Row label="Buyer / commissioning organisation">{opp.buyer}</Row>
          <Row label="Project">{opp.projectName}</Row>
          <Row label="Project location">{[opp.region, opp.country].filter(Boolean).join(', ')}</Row>
          <Row label="Location precision">{opp.precision ? `${opp.precision} (${opp.locationType || 'scope'})` : opp.locationType}</Row>
          <Row label="Environmental themes">{themes.join(', ')}</Row>
          <Row label="Measurement requirement">{opp.measurementNeed}</Row>
          <Row label="Relevant Ellona capabilities (analysis)">{capabilities.join(', ')}</Row>
          <Row label="Primary source">
            <a href={opp.sourceUrl} target="_blank" rel="noreferrer">
              {opp.sourceName} ↗
            </a>
          </Row>
          <Row label="Official reference">{opp.officialId}</Row>
          <Row label="Procedure id">{opp.procedureId}</Row>
          <Row label="Publication date">{opp.publicationDate}</Row>
          <Row label="Clarification deadline">{opp.clarificationDeadline}</Row>
          <Row label="Submission deadline">{opp.tenderDeadline}</Row>
          <Row label="Duration">{opp.duration}</Row>
          <Row label="Published value">{opp.publishedValue}</Row>
          <Row label="Value basis">{opp.valueBasis}</Row>
          <Row label="Recommended next action">{opp.nextAction}</Row>
        </dl>
      </div>

      {questions.length ? (
        <>
          <h2>Questions requiring clarification</h2>
          <div className="bv-ellona-panel">
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {points.length ? (
        <>
          <h2>Supported location</h2>
          <EllonaMap points={points} />
          <div className="bv-ellona-legend">
            <span>Precision shown: {opp.precision || 'indicative'}. Project location is kept separate from any buyer HQ.</span>
          </div>
        </>
      ) : (
        <>
          <h2>Supported location</h2>
          <div className="bv-notice">
            This opportunity has {opp.locationType || 'national'} scope. No precise coordinate is asserted from a
            regional or national notice.
          </div>
        </>
      )}

      <h2>Reviewer actions</h2>
      <OpportunityActions id={opp.id} following={following} readOnly={readOnly} preview={preview} />

      <h2>Change chronology</h2>
      <div className="bv-ellona-panel">
        {events.length === 0 ? (
          <p style={{ margin: 0 }}>No recorded changes yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            {events.map((e) => (
              <li key={e.id}>
                <strong>{e.kind}</strong> — {e.summary}{' '}
                <span style={{ color: '#7d7148', fontSize: 12 }}>
                  ({new Intl.DateTimeFormat('en-IE', { timeZone: 'Europe/Dublin', dateStyle: 'medium', timeStyle: 'short' }).format(e.createdAt)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2>Publisher and provenance</h2>
      <div className="bv-ellona-panel">
        <dl>
          <Row label="Source of record">{String((provenance as any).source_of_record || opp.sourceName)}</Row>
          <Row label="Facts basis">{String((provenance as any).facts_basis || '')}</Row>
          <Row label="Fetch note">{String((provenance as any).fetch_note || '')}</Row>
          <Row label="Delivered through">{ELLONA.deliveryProduct}</Row>
        </dl>
      </div>
    </EllonaShell>
  )
}
