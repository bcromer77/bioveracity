// Authorised, immutable portfolio snapshot across the tenant's routed records.

import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EllonaAccessError } from '@/lib/ellona/access'
import { requireReader, jsonError } from '@/lib/ellona/http'
import { renderPortfolio, type PortfolioItem } from '@/lib/ellona/pdf'
import { ELLONA } from '@/lib/ellona/config'
import { workspaceOpportunities, type ComposedOpportunity } from '@/lib/ellona/routing'
import { formatDublin } from '@/lib/ellona/trial'
import { parseDisplayDate } from '@/lib/ellona/display-date'
import {
  parseFiltersFromParams,
  filterOpportunities,
  buildScopeLabel,
  type FilterableOpportunity,
} from '@/lib/ellona/filter-opportunities'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ReportContext = {
  lastReportAt: Date | null
  correctedIds: Set<string>
  followedIds: Set<string>
}

function bucketFor(opportunity: ComposedOpportunity, context: ReportContext): PortfolioItem['bucket'] {
  if (context.correctedIds.has(opportunity.id)) return 'CORRECTION'
  if (context.followedIds.has(opportunity.id)) return 'FOLLOWING'
  if (opportunity.seedLabel) return 'SEED'
  if (/closed|awarded|expired|cancelled|withdrawn|superseded/i.test(`${opportunity.status} ${opportunity.sourceStatus}`)) return 'CLOSED'
  if (!context.lastReportAt || (opportunity.routedAt && opportunity.routedAt > context.lastReportAt)) return 'NEW'
  return 'OPEN'
}

function asPortfolioItems(opportunities: ComposedOpportunity[], context: ReportContext, base: string): PortfolioItem[] {
  return opportunities
    .filter((opportunity) => opportunity.status !== 'NOT RELEVANT')
    .map((opportunity) => ({
      buyer: opportunity.buyer,
      title: opportunity.title,
      classification: opportunity.classification,
      status: opportunity.status,
      measurementNeed: opportunity.measurementNeed,
      deadline: opportunity.tenderDeadline || opportunity.clarificationDeadline || null,
      location: [opportunity.region, opportunity.country].filter(Boolean).join(', ') || null,
      recordUrl: `${base}/ellona/opportunity/${opportunity.id}`,
      bucket: bucketFor(opportunity, context),
      accessLimitation: opportunity.accessLimitations,
      nextAction: opportunity.nextAction,
      awardedSupplierName: opportunity.awardedSupplierName ?? null,
      awardedValue: opportunity.awardedValue ?? null,
      buyerContactName: opportunity.buyerContactName ?? null,
      buyerContactEmail: opportunity.buyerContactEmail ?? null,
    }))
    .sort((left, right) => (left.deadline || '9999').localeCompare(right.deadline || '9999'))
}

async function reportContext(workspaceId: string, opportunityIds: string[], lastReportAt: Date | null): Promise<ReportContext> {
  const [events, actions] = await Promise.all([
    prisma.opportunityEvent.findMany({
      where: {
        opportunityId: { in: opportunityIds },
        ...(lastReportAt ? { createdAt: { gt: lastReportAt } } : {}),
        kind: { in: ['CORRECTION', 'DEADLINE_CHANGE', 'STATUS_CHANGE', 'MATERIAL_CHANGE'] },
      },
      select: { opportunityId: true },
    }),
    prisma.opportunityAction.findMany({
      where: { workspaceId, opportunityId: { in: opportunityIds }, kind: { in: ['FOLLOW', 'UNFOLLOW'] } },
      orderBy: { createdAt: 'desc' },
      select: { opportunityId: true, kind: true },
    }),
  ])
  const latestFollow = new Map<string, string>()
  for (const action of actions) if (!latestFollow.has(action.opportunityId)) latestFollow.set(action.opportunityId, action.kind)
  return {
    lastReportAt,
    correctedIds: new Set(events.map((event) => event.opportunityId)),
    followedIds: new Set([...latestFollow].filter(([, kind]) => kind === 'FOLLOW').map(([id]) => id)),
  }
}

function coverageNotes(profile: { lastEvidenceRefreshAt: Date | null; lastSourceAccessStatus: string | null } | null): string[] {
  const notes: string[] = []
  if (!profile?.lastEvidenceRefreshAt) notes.push('No canonical evidence refresh has been recorded for this monitoring profile yet.')
  if (profile?.lastSourceAccessStatus === 'LIMITED') notes.push('At least one source in the latest refresh reported an access limitation; review the affected record before acting.')
  return notes
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

// Map a tenant-isolated ComposedOpportunity onto the shared filter shape. The
// authoritative current follow-state comes from reportContext.followedIds
// (latest FOLLOW/UNFOLLOW per opportunity) — never an invented DB field. The
// deadline is normalised with the same parser the dashboard uses.
function toFilterable(opportunity: ComposedOpportunity, followedIds: Set<string>): FilterableOpportunity {
  const deadline = parseDisplayDate(opportunity.tenderDeadline) || parseDisplayDate(opportunity.clarificationDeadline)
  return {
    id: opportunity.id,
    status: opportunity.status,
    classification: opportunity.classification,
    buyer: opportunity.buyer,
    title: opportunity.title,
    country: opportunity.country,
    region: opportunity.region,
    themes: Array.isArray(opportunity.themes) ? (opportunity.themes as string[]) : [],
    capabilities: Array.isArray(opportunity.capabilities) ? (opportunity.capabilities as string[]) : [],
    measurementNeed: opportunity.measurementNeed,
    nextAction: opportunity.nextAction,
    supportedClaim: opportunity.supportedClaim,
    deadlineEpoch: deadline ? deadline.getTime() : null,
    following: followedIds.has(opportunity.id),
  }
}

export async function GET(request: Request) {
  try {
    const { userId, membership, preview } = await requireReader()
    const base = process.env.NEXTAUTH_URL || 'https://bioveracity.com'
    const filters = parseFiltersFromParams(new URL(request.url).searchParams)
    const scopeLabel = buildScopeLabel(filters)
    const snapshotAt = new Date()
    const [opportunities, profile, previousReport] = await Promise.all([
      workspaceOpportunities(membership.workspaceId),
      prisma.partnerMonitoringProfile.findUnique({
        where: { workspaceId: membership.workspaceId },
        select: { lastEvidenceRefreshAt: true, lastSourceAccessStatus: true },
      }),
      prisma.partnerReport.findFirst({
        where: { workspaceId: membership.workspaceId, kind: 'OPPORTUNITY_PORTFOLIO' },
        orderBy: { version: 'desc' },
        select: { version: true, createdAt: true },
      }),
    ])
    const context = await reportContext(membership.workspaceId, opportunities.map((item) => item.id), previousReport?.createdAt ?? null)
    // Apply the SHARED deterministic filter to the tenant-isolated result BEFORE
    // building portfolio items. When the filters match nothing we render an
    // honest empty portfolio — we never fall back to the full workspace.
    const filteredOpportunities = filterOpportunities(
      opportunities,
      (opportunity) => toFilterable(opportunity, context.followedIds),
      filters,
    )
    const items = asPortfolioItems(filteredOpportunities, context, base)
    const evidenceRefreshedAt = profile?.lastEvidenceRefreshAt ?? null
    const notes = coverageNotes(profile)

    if (preview) {
      const pdf = await renderPortfolio({
        dashboardUrl: `${base}/ellona`,
        generatedForLabel: `${ELLONA.workspaceName} — originator preview`,
        snapshotLabel: formatDublin(snapshotAt, true),
        evidenceRefreshedLabel: evidenceRefreshedAt ? formatDublin(evidenceRefreshedAt, true) : 'Not yet recorded',
        versionLabel: 'PREVIEW — not issued',
        scopeLabel,
        coverageNotes: notes,
        items,
      })
      return new Response(new Uint8Array(pdf), { status: 200, headers: pdfHeaders('ellona-opportunity-portfolio-preview.pdf', 'PREVIEW') })
    }

    const issued = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portfolio:${membership.workspaceId}`}))`
      const latest = await tx.partnerReport.findFirst({
        where: { workspaceId: membership.workspaceId, kind: 'OPPORTUNITY_PORTFOLIO' },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      const version = (latest?.version ?? 0) + 1
      const pdf = await renderPortfolio({
        dashboardUrl: `${base}/ellona`,
        generatedForLabel: ELLONA.workspaceName,
        snapshotLabel: formatDublin(snapshotAt, true),
        evidenceRefreshedLabel: evidenceRefreshedAt ? formatDublin(evidenceRefreshedAt, true) : 'Not yet recorded',
        versionLabel: `v${version}`,
        scopeLabel,
        coverageNotes: notes,
        items,
      })
      await tx.partnerReport.create({
        data: {
          id: randomUUID(),
          workspaceId: membership.workspaceId,
          kind: 'OPPORTUNITY_PORTFOLIO',
          version,
          generatedBy: userId,
          evidenceRefreshedAt,
          snapshot: jsonSnapshot({ snapshotAt, evidenceRefreshedAt, filters, scopeLabel, items, coverageNotes: notes }),
          contentHash: createHash('sha256').update(pdf).digest('hex'),
          pdfBytes: pdf,
        },
      })
      return { pdf, version }
    })

    return new Response(new Uint8Array(issued.pdf), {
      status: 200,
      headers: pdfHeaders(`ellona-opportunity-portfolio-v${issued.version}.pdf`, `v${issued.version}`),
    })
  } catch (error) {
    if (error instanceof EllonaAccessError) return jsonError(error.status, error.message)
    return jsonError(500, 'The portfolio could not be generated.')
  }
}

function pdfHeaders(filename: string, version: string) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-BioVeracity-Report-Version': version,
  }
}
