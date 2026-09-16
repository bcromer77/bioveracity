import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { renderAlertEmail, renderCorrectionEmail } from './email-render'

export type CanonicalOpportunityInput = {
  evidenceDocumentId?: string | null
  verificationState: 'VERIFIED'
  sourceName: string
  sourceUrl: string
  publisher: string
  officialId?: string | null
  procedureId?: string | null
  buyer: string
  title: string
  projectName?: string | null
  country: string
  region?: string | null
  classification: string
  sourceStatus: string
  themes: string[]
  capabilities: string[]
  measurementNeed: string
  publishedValue?: string | null
  valueBasis?: string | null
  publicationDate?: string | null
  eventDate?: string | null
  clarificationDeadline?: string | null
  tenderDeadline?: string | null
  duration?: string | null
  supportedClaim: string
  supportingPassage: string
  accessLimitations?: string | null
  sourceReadable: boolean
  locationType?: string | null
  latitude?: number | null
  longitude?: number | null
  coordSource?: string | null
  precision?: string | null
  waterbody?: string | null
  catchment?: string | null
  port?: string | null
  protectedSite?: string | null
  planningAuthority?: string | null
  awardedSupplierName?: string | null
  awardedSupplierId?: string | null
  awardedValue?: number | null
  buyerContactName?: string | null
  buyerContactEmail?: string | null
  provenance?: Record<string, unknown>
  retrievedAt: Date
  nextAction: string
  clarificationQuestions?: string[]
  seedRecord?: boolean
}

const short = z.string().trim().min(1).max(500)
const optionalShort = z.string().trim().min(1).max(500).nullable().optional()
const sourceUrl = z.string().trim().url().max(2048).refine((value) => {
  const parsed = new URL(value)
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password
}, 'A credential-free HTTPS primary-source URL is required.')
const timestamp = z.string().trim().max(50).refine(
  (value) => /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
  'Retrieval timestamp requires an explicit timezone.',
).transform((value) => new Date(value))
const stringList = z.array(z.string().trim().min(1).max(160)).min(1).max(50)

const canonicalOpportunitySchema = z.object({
  evidenceDocumentId: z.string().trim().min(1).max(200).nullable().optional(),
  verificationState: z.literal('VERIFIED'),
  sourceName: short,
  sourceUrl,
  publisher: short,
  officialId: optionalShort,
  procedureId: optionalShort,
  buyer: short,
  title: z.string().trim().min(1).max(1000),
  projectName: optionalShort,
  country: z.string().trim().min(1).max(160),
  region: optionalShort,
  classification: z.string().trim().min(1).max(100),
  sourceStatus: z.string().trim().min(1).max(100),
  themes: stringList,
  capabilities: stringList,
  measurementNeed: z.string().trim().min(1).max(3000),
  publishedValue: optionalShort,
  valueBasis: z.string().trim().min(1).max(2000).nullable().optional(),
  publicationDate: optionalShort,
  eventDate: optionalShort,
  clarificationDeadline: optionalShort,
  tenderDeadline: optionalShort,
  duration: optionalShort,
  supportedClaim: z.string().trim().min(1).max(3000),
  supportingPassage: z.string().trim().min(1).max(5000),
  accessLimitations: z.string().trim().min(1).max(2000).nullable().optional(),
  sourceReadable: z.boolean(),
  locationType: optionalShort,
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  coordSource: z.string().trim().min(1).max(1000).nullable().optional(),
  precision: optionalShort,
  waterbody: optionalShort,
  catchment: optionalShort,
  port: optionalShort,
  protectedSite: optionalShort,
  planningAuthority: optionalShort,
  awardedSupplierName: optionalShort,
  awardedSupplierId: optionalShort,
  awardedValue: z.number().finite().nonnegative().nullable().optional(),
  buyerContactName: optionalShort,
  buyerContactEmail: z.string().trim().email().max(320).nullable().optional(),
  provenance: z.record(z.unknown()).refine((value) => JSON.stringify(value).length <= 20_000, 'Provenance exceeds the size limit.').optional(),
  retrievedAt: timestamp,
  nextAction: z.string().trim().min(1).max(3000),
  clarificationQuestions: z.array(z.string().trim().min(1).max(1000)).max(30).optional(),
}).strict()

export function parseCanonicalOpportunityInput(input: unknown): CanonicalOpportunityInput {
  return canonicalOpportunitySchema.parse(input) as CanonicalOpportunityInput
}

export type MonitoringProfile = {
  workspaceId: string
  territories: string[]
  themes: string[]
  capabilities: string[]
  immediateClassifications: string[]
  enabled: boolean
}

export type RoutingDecision = {
  matched: boolean
  alertEligible: boolean
  reasons: string[]
  matchedThemes: string[]
  matchedCapabilities: string[]
}

const tidy = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))]

function overlap(left: string[], right: string[]): string[] {
  const normalRight = right.map((value) => ({ value, normal: tidy(value) }))
  return unique(
    left.flatMap((candidate) => {
      const normal = tidy(candidate)
      return normalRight
        .filter((entry) => normal.includes(entry.normal) || entry.normal.includes(normal))
        .map((entry) => entry.value)
    }),
  )
}

export function evaluateOpportunity(input: CanonicalOpportunityInput, profile: MonitoringProfile): RoutingDecision {
  const reasons: string[] = []
  if (!profile.enabled) return { matched: false, alertEligible: false, reasons: ['Monitoring profile disabled.'], matchedThemes: [], matchedCapabilities: [] }

  const territoryMatches = overlap([input.country, input.region || ''], profile.territories)
  const matchedThemes = overlap(input.themes, profile.themes)
  const matchedCapabilities = overlap(input.capabilities, profile.capabilities)
  if (!territoryMatches.length) reasons.push('Outside the workspace territories.')
  if (!matchedThemes.length && !matchedCapabilities.length) reasons.push('No supported workspace theme or capability connection.')

  const matched = territoryMatches.length > 0 && (matchedThemes.length > 0 || matchedCapabilities.length > 0)
  const gate = [
    input.verificationState === 'VERIFIED',
    input.sourceReadable || Boolean(input.accessLimitations?.trim()),
    Boolean(input.supportedClaim.trim() && input.supportingPassage.trim()),
    Boolean(input.buyer.trim()),
    Boolean(input.country.trim() || input.region?.trim()),
    Boolean(input.measurementNeed.trim()),
    Boolean(input.nextAction.trim()),
    profile.immediateClassifications.map(tidy).includes(tidy(input.classification)),
  ]
  if (!gate[1]) reasons.push('Primary source is unreadable and no access limitation is disclosed.')
  if (!gate[2]) reasons.push('Supported claim or supporting passage is missing.')
  if (!gate[7]) reasons.push('Classification is dashboard-only for this workspace.')

  return {
    matched,
    alertEligible: matched && gate.every(Boolean),
    reasons,
    matchedThemes,
    matchedCapabilities,
  }
}

const SNAPSHOT_FIELDS = [
  'sourceName', 'sourceUrl', 'publisher', 'officialId', 'procedureId', 'buyer', 'title', 'projectName',
  'country', 'region', 'classification', 'sourceStatus', 'themes', 'capabilities', 'measurementNeed',
  'publishedValue', 'valueBasis', 'publicationDate', 'eventDate', 'clarificationDeadline', 'tenderDeadline',
  'duration', 'supportedClaim', 'supportingPassage', 'accessLimitations', 'sourceReadable', 'locationType',
  'latitude', 'longitude', 'coordSource', 'precision', 'waterbody', 'catchment', 'port', 'protectedSite',
  'planningAuthority', 'awardedSupplierName', 'awardedSupplierId', 'awardedValue',
  'buyerContactName', 'buyerContactEmail', 'provenance',
] as const

export function canonicalSnapshot(input: CanonicalOpportunityInput): Record<string, unknown> {
  return Object.fromEntries(SNAPSHOT_FIELDS.map((key) => [key, input[key] ?? null]))
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function opportunityVersionHash(input: CanonicalOpportunityInput): string {
  return createHash('sha256').update(stable(canonicalSnapshot(input))).digest('hex')
}

export function opportunityCanonicalKey(input: Pick<CanonicalOpportunityInput, 'publisher' | 'officialId' | 'sourceUrl'>): string {
  if (input.officialId?.trim()) return `${tidy(input.publisher)}:${tidy(input.officialId)}`
  const url = new URL(input.sourceUrl)
  url.hash = ''
  const sortedParams = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  )
  url.search = ''
  for (const [key, value] of sortedParams) url.searchParams.append(key, value)
  return `${tidy(input.publisher)}:${url.toString()}`
}

export function changedValues(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const changedFields: Record<string, unknown> = {}
  const previousValues: Record<string, unknown> = {}
  for (const key of SNAPSHOT_FIELDS) {
    if (stable(previous[key] ?? null) !== stable(next[key] ?? null)) {
      changedFields[key] = next[key] ?? null
      previousValues[key] = previous[key] ?? null
    }
  }
  return { changedFields, previousValues }
}

export function classifyChange(changed: Record<string, unknown>, isNew: boolean): string {
  if (isNew) return 'RECORD_ADDED'
  if ('tenderDeadline' in changed || 'clarificationDeadline' in changed) return 'DEADLINE_CHANGE'
  if ('sourceStatus' in changed) return 'STATUS_CHANGE'
  return 'MATERIAL_CHANGE'
}

function publicData(input: CanonicalOpportunityInput, versionHash: string) {
  return {
    evidenceDocumentId: input.evidenceDocumentId ?? null,
    verificationState: input.verificationState,
    currentVersionHash: versionHash,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    publisher: input.publisher,
    officialId: input.officialId ?? null,
    procedureId: input.procedureId ?? null,
    buyer: input.buyer,
    title: input.title,
    projectName: input.projectName ?? null,
    country: input.country,
    region: input.region ?? null,
    classification: input.classification,
    sourceStatus: input.sourceStatus,
    themes: input.themes,
    measurementNeed: input.measurementNeed,
    publishedValue: input.publishedValue ?? null,
    valueBasis: input.valueBasis ?? null,
    publicationDate: input.publicationDate ?? null,
    eventDate: input.eventDate ?? null,
    clarificationDeadline: input.clarificationDeadline ?? null,
    tenderDeadline: input.tenderDeadline ?? null,
    duration: input.duration ?? null,
    supportedClaim: input.supportedClaim,
    supportingPassage: input.supportingPassage,
    accessLimitations: input.accessLimitations ?? null,
    sourceReadable: input.sourceReadable,
    locationType: input.locationType ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    coordSource: input.coordSource ?? null,
    precision: input.precision ?? null,
    waterbody: input.waterbody ?? null,
    catchment: input.catchment ?? null,
    port: input.port ?? null,
    protectedSite: input.protectedSite ?? null,
    planningAuthority: input.planningAuthority ?? null,
    awardedSupplierName: input.awardedSupplierName ?? null,
    awardedSupplierId: input.awardedSupplierId ?? null,
    awardedValue: input.awardedValue ?? null,
    buyerContactName: input.buyerContactName ?? null,
    buyerContactEmail: input.buyerContactEmail ?? null,
    provenance: input.provenance ?? {},
    retrievedAt: input.retrievedAt,
  }
}

function jsonStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function visibleStatus(sourceStatus: string, existing?: string | null, changed = false): string {
  if (/awarded/i.test(sourceStatus)) return 'AWARDED'
  if (/closed|expired|cancelled|withdrawn/i.test(sourceStatus)) return 'CLOSED'
  if (existing === 'NOT RELEVANT') return existing
  if (changed && existing) return 'ACTION REQUIRED'
  return existing || 'NEW'
}

export type RouteResult = {
  canonicalId: string
  versionId: string | null
  duplicate: boolean
  routedWorkspaceIds: string[]
  notificationIds: string[]
}

export type WorkspaceInterpretation = { relevance: string; nextAction?: string; clarificationQuestions?: string[] }

export async function routeCanonicalOpportunity(
  input: CanonicalOpportunityInput,
  workspaceInterpretations: Record<string, WorkspaceInterpretation> = {},
  database: typeof prisma = prisma,
): Promise<RouteResult> {
  if (input.verificationState !== 'VERIFIED') throw new Error('Only verified evidence can enter the public opportunity substrate.')
  if (!/^https:\/\//i.test(input.sourceUrl)) throw new Error('A canonical HTTPS primary-source URL is required.')
  if (!input.supportedClaim.trim() || !input.supportingPassage.trim()) throw new Error('A supported claim and supporting passage are required.')
  if (input.evidenceDocumentId) {
    const evidence = await database.evidenceDocument.findUnique({ where: { id: input.evidenceDocumentId }, select: { status: true, activeReviewId: true } })
    if (!evidence || evidence.status !== 'VERIFIED' || !evidence.activeReviewId) throw new Error('The linked evidence document is not currently verified.')
  }

  const canonicalKey = opportunityCanonicalKey(input)
  const snapshot = canonicalSnapshot(input)
  const versionHash = opportunityVersionHash(input)
  return database.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canonicalKey}))`
    const existing = await tx.publicOpportunity.findUnique({ where: { canonicalKey }, include: { versions: { orderBy: { detectedAt: 'desc' }, take: 1 } } })
    const duplicate = existing?.currentVersionHash === versionHash
    const previous = existing?.versions[0]?.snapshot as Record<string, unknown> | undefined
    const delta = changedValues(previous || {}, snapshot)
    const changeType = classifyChange(delta.changedFields, !existing)
    const canonicalId = existing?.id || randomUUID()

    const canonical = await tx.publicOpportunity.upsert({
      where: { canonicalKey },
      update: { ...publicData(input, duplicate ? existing!.currentVersionHash : versionHash), provenance: inputJson(input.provenance ?? {}) },
      create: { id: canonicalId, canonicalKey, ...publicData(input, versionHash), provenance: inputJson(input.provenance ?? {}) },
    })

    const version = duplicate ? null : await tx.publicOpportunityVersion.create({
      data: { id: randomUUID(), publicOpportunityId: canonical.id, versionHash, changeType, snapshot: inputJson(snapshot), changedFields: inputJson(delta.changedFields), previousValues: inputJson(delta.previousValues) },
    })

    const profiles = await tx.partnerMonitoringProfile.findMany({ where: { enabled: true } })
    const routedWorkspaceIds: string[] = []
    const notificationIds: string[] = []
    for (const row of profiles) {
      const profile: MonitoringProfile = {
        workspaceId: row.workspaceId,
        territories: jsonStrings(row.territories),
        themes: jsonStrings(row.themes),
        capabilities: jsonStrings(row.capabilities),
        immediateClassifications: jsonStrings(row.immediateClassifications),
        enabled: row.enabled,
      }
      const decision = evaluateOpportunity(input, profile)
      const lastEvidenceRefreshAt = !row.lastEvidenceRefreshAt || input.retrievedAt > row.lastEvidenceRefreshAt
        ? input.retrievedAt
        : row.lastEvidenceRefreshAt
      await tx.partnerMonitoringProfile.update({ where: { workspaceId: row.workspaceId }, data: { lastEvidenceRefreshAt, lastSourceAccessStatus: input.sourceReadable ? 'READABLE' : 'LIMITED' } })
      if (!decision.matched) continue

      const interpretation = workspaceInterpretations[row.workspaceId]
      const relevance = interpretation?.relevance ||
        `Matches this workspace through ${[...decision.matchedThemes, ...decision.matchedCapabilities].join(', ')}.`
      const nextAction = interpretation?.nextAction || input.nextAction
      const questions = interpretation?.clarificationQuestions || input.clarificationQuestions || []

      const oldLink = await tx.opportunity.findFirst({ where: { workspaceId: row.workspaceId, publicOpportunityId: canonical.id } })
      const status = visibleStatus(input.sourceStatus, oldLink?.status, Boolean(version && oldLink))
      const link = await tx.opportunity.upsert({
        where: { workspaceId_publicOpportunityId: { workspaceId: row.workspaceId, publicOpportunityId: canonical.id } },
        update: {
          status,
          classification: input.classification,
          themes: decision.matchedThemes,
          capabilities: decision.matchedCapabilities,
          measurementNeed: input.measurementNeed,
          nextAction,
          clarificationQuestions: questions,
          workspaceRelevance: relevance,
          alertEligible: decision.alertEligible,
          lastEvaluatedAt: input.retrievedAt,
          seedLabel: input.seedRecord ? 'Trial seed record — previously published' : undefined,
        },
        create: {
          id: randomUUID(), workspaceId: row.workspaceId, publicOpportunityId: canonical.id, status,
          classification: input.classification, themes: decision.matchedThemes, capabilities: decision.matchedCapabilities,
          measurementNeed: input.measurementNeed, nextAction,
          clarificationQuestions: questions, workspaceRelevance: relevance,
          alertEligible: decision.alertEligible, routedAt: input.retrievedAt, lastEvaluatedAt: input.retrievedAt,
          seedLabel: input.seedRecord ? 'Trial seed record — previously published' : null,
        },
      })
      routedWorkspaceIds.push(row.workspaceId)

      if (version) {
        const kind = oldLink ? (changeType === 'DEADLINE_CHANGE' ? 'CORRECTION' : changeType) : 'CREATED'
        await tx.opportunityEvent.create({ data: {
          id: randomUUID(), opportunityId: link.id, publicVersionId: version.id, kind,
          summary: oldLink ? `Canonical public record changed (${changeType}).` : 'Canonical public record routed to this workspace.',
          changedFields: inputJson(delta.changedFields), previousValues: inputJson(delta.previousValues),
        } })
      }

      const tenant = decision.alertEligible && !input.seedRecord
        ? await tx.partnerTenant.findUnique({ where: { workspaceId: row.workspaceId } })
        : null
      const trialOpen = Boolean(tenant?.trialEndsAt && tenant.trialEndsAt.getTime() > Date.now())
      if (tenant && tenant.trialState === 'ACTIVE' && trialOpen && !tenant.alertsPaused && version) {
        const url = `${process.env.NEXTAUTH_URL || 'https://bioveracity.com'}/ellona/opportunity/${link.id}`
        const line = { buyer: input.buyer, title: input.title, measurementNeed: input.measurementNeed, deadline: input.tenderDeadline || input.clarificationDeadline || null, url, classification: input.classification }
        const rendered = oldLink
          ? renderCorrectionEmail({ opp: line, whatChanged: Object.keys(delta.changedFields).join(', ') })
          : renderAlertEmail(line)
        const dedupKey = `${rendered.kind.toLowerCase()}:${canonical.id}:${versionHash}`
        const email = await tx.partnerEmail.upsert({
          where: { workspaceId_dedupKey: { workspaceId: row.workspaceId, dedupKey } },
          update: {},
          create: { id: randomUUID(), workspaceId: row.workspaceId, kind: rendered.kind, senderIdentity: rendered.senderIdentity, subject: rendered.subject, recipient: tenant.contactEmail, renderedHtml: rendered.html, status: 'RENDERED', dedupKey, sandbox: true },
        })
        notificationIds.push(email.id)
      }
    }

    return { canonicalId: canonical.id, versionId: version?.id ?? null, duplicate, routedWorkspaceIds, notificationIds }
  })
}

export type WorkspaceOpportunityRow = Prisma.OpportunityGetPayload<{ include: { publicOpportunity: true } }>

export type ComposedOpportunity = Omit<WorkspaceOpportunityRow, 'buyer' | 'title' | 'country' | 'sourceName' | 'sourceUrl'> & {
  buyer: string
  title: string
  country: string
  sourceName: string
  sourceUrl: string
  sourceStatus: string
  supportedClaim: string
  supportingPassage: string
  accessLimitations: string | null
  awardedSupplierName: string | null
  awardedSupplierId: string | null
  awardedValue: number | null
  buyerContactName: string | null
  buyerContactEmail: string | null
  evidenceRefreshedAt: Date
}

export function composeOpportunity(row: WorkspaceOpportunityRow): ComposedOpportunity {
  const source = row.publicOpportunity
  return {
    ...row,
    buyer: source?.buyer ?? row.buyer ?? '',
    title: source?.title ?? row.title ?? '',
    projectName: source?.projectName ?? row.projectName,
    country: source?.country ?? row.country ?? '',
    region: source?.region ?? row.region,
    classification: row.classification || source?.classification || '',
    themes: row.themes,
    capabilities: row.capabilities,
    measurementNeed: row.measurementNeed ?? source?.measurementNeed ?? null,
    publishedValue: source?.publishedValue ?? row.publishedValue,
    valueBasis: source?.valueBasis ?? row.valueBasis,
    publicationDate: source?.publicationDate ?? row.publicationDate,
    clarificationDeadline: source?.clarificationDeadline ?? row.clarificationDeadline,
    tenderDeadline: source?.tenderDeadline ?? row.tenderDeadline,
    duration: source?.duration ?? row.duration,
    sourceName: source?.sourceName ?? row.sourceName ?? '',
    sourceUrl: source?.sourceUrl ?? row.sourceUrl ?? '',
    officialId: source?.officialId ?? row.officialId,
    procedureId: source?.procedureId ?? row.procedureId,
    provenance: source?.provenance ?? row.provenance,
    locationType: source?.locationType ?? row.locationType,
    latitude: source?.latitude ?? row.latitude,
    longitude: source?.longitude ?? row.longitude,
    coordSource: source?.coordSource ?? row.coordSource,
    precision: source?.precision ?? row.precision,
    waterbody: source?.waterbody ?? row.waterbody,
    catchment: source?.catchment ?? row.catchment,
    port: source?.port ?? row.port,
    protectedSite: source?.protectedSite ?? row.protectedSite,
    planningAuthority: source?.planningAuthority ?? row.planningAuthority,
    awardedSupplierName: source?.awardedSupplierName ?? null,
    awardedSupplierId: source?.awardedSupplierId ?? null,
    awardedValue: source?.awardedValue ?? null,
    buyerContactName: source?.buyerContactName ?? null,
    buyerContactEmail: source?.buyerContactEmail ?? null,
    sourceStatus: source?.sourceStatus ?? row.status,
    supportedClaim: source?.supportedClaim ?? '',
    supportingPassage: source?.supportingPassage ?? '',
    accessLimitations: source?.accessLimitations ?? null,
    evidenceRefreshedAt: source?.retrievedAt ?? row.fetchedAt ?? row.updatedAt,
  } as ComposedOpportunity
}

export async function workspaceOpportunities(workspaceId: string) {
  const rows = await prisma.opportunity.findMany({ where: { workspaceId }, include: { publicOpportunity: true }, orderBy: { createdAt: 'asc' } })
  return rows.map(composeOpportunity)
}

export async function workspaceOpportunity(workspaceId: string, id: string) {
  const row = await prisma.opportunity.findFirst({ where: { workspaceId, id }, include: { publicOpportunity: true } })
  return row ? composeOpportunity(row) : null
}
