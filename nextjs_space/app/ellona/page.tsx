import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ellonaEnabled, ELLONA, REPRESENTATION_LINE } from '@/lib/ellona/config'
import { resolveEllonaView } from '@/lib/ellona/access'
import { onPartnerLogin, computeTrialInfo, formatDublin } from '@/lib/ellona/trial'
import { parseDisplayDate } from '@/lib/ellona/display-date'
import { EllonaShell } from '@/components/ellona/ellona-shell'
import { EllonaDashboard } from '@/components/ellona/dashboard'
import type { OpportunityDTO } from '@/components/ellona/types'
import { workspaceOpportunities } from '@/lib/ellona/routing'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Opportunity Watch | BioVeracity', robots: { index: false, follow: false } }

const BAZIL_EMAIL = 'bazil.cromer@ripplexn.com'
const CLOSED = new Set(['CLOSED', 'NOT RELEVANT', 'SUPERSEDED'])

export default async function EllonaDashboardPage() {
  if (!ellonaEnabled()) notFound()
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login?callbackUrl=/ellona')
  const view = await resolveEllonaView(userId, session?.user?.email)
  if (!view) redirect('/professionals')
  const workspaceId = view.workspaceId
  const preview = view.preview

  // Start the 14-day trial atomically on the first CUSTOMER login only, and
  // refresh lastLoginAt. The originator (Bazil) reviews through a READ-ONLY
  // preview view — his visits must never start, shorten or touch the trial or
  // record any engagement, so onPartnerLogin is skipped entirely in preview.
  if (!preview) {
    await onPartnerLogin(workspaceId)
  }

  const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId } })
  if (!tenant) redirect('/professionals')
  const trial = computeTrialInfo(tenant)

  const [opps, followActions, monitoringProfile, previousPortfolio] = await Promise.all([
    workspaceOpportunities(workspaceId),
    prisma.opportunityAction.findMany({
      where: { workspaceId, kind: { in: ['FOLLOW', 'UNFOLLOW'] } },
      orderBy: { createdAt: 'asc' },
      select: { opportunityId: true, kind: true },
    }),
    prisma.partnerMonitoringProfile.findUnique({ where: { workspaceId } }),
    prisma.partnerReport.findFirst({
      where: { workspaceId, kind: 'OPPORTUNITY_PORTFOLIO' },
      orderBy: { version: 'desc' },
      select: { createdAt: true },
    }),
  ])

  // Latest FOLLOW/UNFOLLOW wins per opportunity.
  const followState = new Map<string, boolean>()
  for (const a of followActions) followState.set(a.opportunityId, a.kind === 'FOLLOW')

  const corrEvents = await prisma.opportunityEvent.findMany({
    where: {
      opportunityId: { in: opps.map((o) => o.id) },
      kind: { in: ['CORRECTION', 'DEADLINE_CHANGE', 'STATUS_CHANGE', 'MATERIAL_CHANGE'] },
    },
    select: { opportunityId: true },
  })
  const corrected = new Set(corrEvents.map((e) => e.opportunityId))

  const dtos: OpportunityDTO[] = opps.map((o) => {
    const deadlineDate = parseDisplayDate(o.tenderDeadline) || parseDisplayDate(o.clarificationDeadline)
    return {
      id: o.id,
      status: o.status,
      classification: o.classification,
      buyer: o.buyer,
      title: o.title,
      country: o.country,
      region: o.region,
      themes: (o.themes as unknown as string[]) || [],
      capabilities: (o.capabilities as unknown as string[]) || [],
      measurementNeed: o.measurementNeed,
      publishedValue: o.publishedValue,
      clarificationDeadline: o.clarificationDeadline,
      tenderDeadline: o.tenderDeadline,
      nextAction: o.nextAction,
      latitude: o.latitude,
      longitude: o.longitude,
      precision: o.precision,
      following: followState.get(o.id) ?? o.status === 'FOLLOWING',
      hasCorrection: corrected.has(o.id),
      deadlineSort: deadlineDate ? deadlineDate.getTime() : null,
      routedAt: (o.routedAt || o.createdAt).toISOString(),
      evidenceRefreshedAt: o.evidenceRefreshedAt.toISOString(),
      isSeed: Boolean(o.seedLabel),
      accessLimited: Boolean(o.accessLimitations),
      newSinceLastPortfolio: !previousPortfolio || Boolean(o.routedAt && o.routedAt > previousPortfolio.createdAt),
    }
  })

  // Hero stats.
  const openCount = dtos.filter((o) => !CLOSED.has(o.status)).length
  const now = Date.now()
  const upcoming = dtos
    .filter((o) => o.deadlineSort != null && (o.deadlineSort as number) >= now && !CLOSED.has(o.status))
    .sort((a, b) => (a.deadlineSort as number) - (b.deadlineSort as number))
  const nearest = upcoming[0] || null
  const recommended = nearest || dtos.find((o) => o.id === 'ellona-seed-epa-air') || dtos[0] || null

  const profileTerritories = (monitoringProfile?.territories as string[] | undefined) || []
  const profileThemes = (monitoringProfile?.themes as string[] | undefined) || []
  const monitoredCountries = profileTerritories.join(', ') || ELLONA.territories
  const monitoredThemes = profileThemes.slice(0, 8).join(', ') || Array.from(new Set(dtos.flatMap((o) => o.themes))).slice(0, 8).join(', ')
  const evidenceRefreshedAt = monitoringProfile?.lastEvidenceRefreshAt

  const isAdmin = (session?.user?.email || '').toLowerCase() === BAZIL_EMAIL

  return (
    <EllonaShell showAdmin={isAdmin} preview={preview}>
      <p className="bv-eyebrow" style={{ color: '#7d7148' }}>
        Welcome, {ELLONA.contactName.split(' ')[0]} — {ELLONA.workspaceName}
      </p>
      <h1>Find where environmental uncertainty becomes a measurement need.</h1>
      <p className="bv-lead">
        BioVeracity monitors public procurement, regulatory, infrastructure and environmental sources for developments
        relevant to Ellona. Each opportunity shows what changed, where it is happening, who may need measurement, what
        the evidence supports and what still requires verification.
      </p>
      <p className="bv-ellona-rep">{REPRESENTATION_LINE}</p>

      <div className="bv-ellona-stats">
        <div className="bv-ellona-stat">
          <div className="k">Trial</div>
          <div className="v">
            {trial.state === 'ACTIVE'
              ? `Day ${trial.dayNumber ?? 1} of ${ELLONA.trialDays}`
              : trial.state === 'INVITED_NOT_ACTIVATED'
              ? preview
                ? 'Not activated'
                : 'Starting now'
              : trial.state}
          </div>
          <div className="s">
            {trial.startedAt
              ? `Started ${formatDublin(trial.startedAt)}`
              : preview
              ? 'Starts when Natalia first signs in'
              : 'Starts on first sign-in'}
            {trial.endsAt ? ` · ends ${formatDublin(trial.endsAt)}` : ''}
          </div>
        </div>
        <div className="bv-ellona-stat">
          <div className="k">Open opportunities</div>
          <div className="v">{openCount}</div>
          <div className="s">Across {monitoredCountries}</div>
        </div>
        <div className="bv-ellona-stat">
          <div className="k">Nearest deadline</div>
          <div className="v" style={{ fontSize: 18, lineHeight: 1.3 }}>
            {nearest ? nearest.tenderDeadline || nearest.clarificationDeadline : 'See records'}
          </div>
          <div className="s">{nearest ? nearest.buyer : 'No dated deadline in view'}</div>
        </div>
        <div className="bv-ellona-stat">
          <div className="k">Monitored themes</div>
          <div className="v" style={{ fontSize: 15, lineHeight: 1.4 }}>{monitoredThemes || '—'}</div>
          <div className="s">Priority geography: {ELLONA.priorityGeography}</div>
        </div>
      </div>

      <p className="bv-ellona-refresh">
        Shared public evidence last refreshed:{' '}
        {evidenceRefreshedAt ? formatDublin(evidenceRefreshedAt, true) : 'No canonical evidence refresh recorded yet'}.
        {' '}Each generated portfolio records its own later snapshot time and version.
      </p>

      {recommended ? (
        <div className="bv-notice">
          <strong>Today’s recommended action.</strong> {recommended.buyer} — {recommended.title}.{' '}
          {recommended.nextAction}{' '}
          <Link href={`/ellona/opportunity/${recommended.id}`} style={{ fontWeight: 700 }}>
            Open record →
          </Link>
        </div>
      ) : null}

      <div className="bv-ellona-cta">
        <a className="bv-button bv-green" href="#opportunities">
          View current opportunities
        </a>
        <a className="bv-button" href="/api/ellona/portfolio/pdf">
          Generate opportunity portfolio (PDF)
        </a>
        {preview ? null : (
          <Link className="bv-text-link" href="/ellona/assess">
            Analyse your own opportunity →
          </Link>
        )}
      </div>

      <div id="opportunities" />
      <EllonaDashboard opportunities={dtos} />
    </EllonaShell>
  )
}
