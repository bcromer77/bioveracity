import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { IngestMonitor } from '@/components/admin/ingest-monitor'

export const dynamic = 'force-dynamic'

// Pipeline states, in order, for the status tiles.
const PIPELINE = [
  'FOUND',
  'PARSED',
  'VERIFICATION_PENDING',
  'VERIFIED',
  'NORMALISED',
  'PUBLISHED',
  'FAILED',
] as const

export default async function AdminIngestPage() {
  const session = await auth()
  // Admin-only monitor. Non-admins are sent to login.
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'admin') redirect('/')

  const [rows, statusGroups, dupAgg, total] = await Promise.all([
    prisma.rawIngest.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 200,
      include: {
        _count: {
          select: { observations: true, commercialSignals: true, entityCandidates: true },
        },
        observations: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            candidateType: true,
            observationType: true,
            resolvedAssetId: true,
            resolutionStatus: true,
            status: true,
            verificationMethod: true,
            verificationNote: true,
            rejectionReason: true,
            normalisedTargetType: true,
            normalisedRecordType: true,
            normalisedRecordId: true,
            sourceUrl: true,
          },
        },
      },
    }),
    prisma.rawIngest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.rawIngest.aggregate({ _sum: { duplicateHits: true } }),
    prisma.rawIngest.count(),
  ])

  // Resolve the display name of every resolved asset referenced by a candidate.
  const assetIds = Array.from(
    new Set(
      rows
        .flatMap((r) => r.observations.map((o) => o.resolvedAssetId))
        .filter((x): x is string => Boolean(x)),
    ),
  )
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, name: true, slug: true },
      })
    : []
  const assetById = new Map(assets.map((a) => [a.id, a]))

  const statusCounts: Record<string, number> = {}
  for (const s of PIPELINE) statusCounts[s] = 0
  for (const g of statusGroups) statusCounts[g.status] = g._count._all

  const tiles = [
    { key: 'RECEIVED', label: 'Received', value: total },
    { key: 'PARSED', label: 'Parsed', value: statusCounts['PARSED'] ?? 0 },
    { key: 'VERIFICATION_PENDING', label: 'Verification pending', value: statusCounts['VERIFICATION_PENDING'] ?? 0 },
    { key: 'VERIFIED', label: 'Verified', value: statusCounts['VERIFIED'] ?? 0 },
    { key: 'NORMALISED', label: 'Normalised', value: statusCounts['NORMALISED'] ?? 0 },
    { key: 'PUBLISHED', label: 'Published', value: statusCounts['PUBLISHED'] ?? 0 },
    { key: 'FAILED', label: 'Failed', value: statusCounts['FAILED'] ?? 0 },
    { key: 'DUPLICATE', label: 'Duplicate', value: dupAgg._sum.duplicateHits ?? 0 },
  ]

  const serialised = rows.map((r) => {
    const firstAssetId = r.observations[0]?.resolvedAssetId
    const asset = firstAssetId ? assetById.get(firstAssetId) : undefined
    return {
      id: r.id,
      sourceAgent: r.sourceAgent,
      category: r.category,
      assetName: asset?.name ?? null,
      assetSlug: asset?.slug ?? null,
      targetRegion: r.targetRegion,
      demoTag: r.demoTag,
      receivedAt: r.receivedAt.toISOString(),
      schemaVersion: r.schemaVersion,
      stream: r.stream,
      observationCount: r._count.observations,
      commercialCount: r._count.commercialSignals,
      entityCandidateCount: r._count.entityCandidates,
      duplicateHits: r.duplicateHits,
      status: r.status,
      error: r.error,
      rawPayload: r.rawPayload,
      candidates: r.observations.map((o) => ({
        id: o.id,
        title: o.title,
        candidateType: o.candidateType ?? o.observationType,
        assetName: o.resolvedAssetId ? assetById.get(o.resolvedAssetId)?.name ?? null : null,
        resolutionStatus: o.resolutionStatus,
        status: o.status,
        verificationMethod: o.verificationMethod,
        verificationNote: o.verificationNote,
        rejectionReason: o.rejectionReason,
        normalisedTargetType: o.normalisedTargetType,
        normalisedRecordType: o.normalisedRecordType,
        normalisedRecordId: o.normalisedRecordId,
        sourceUrl: o.sourceUrl,
      })),
    }
  })

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <IngestMonitor tiles={tiles} rows={serialised} />
      </main>
      <SiteFooter />
    </div>
  )
}
