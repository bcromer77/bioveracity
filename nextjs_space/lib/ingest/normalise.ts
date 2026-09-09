// ==========================================================================
// §O — Normalisation engine.
//
// Maps a VERIFIED ObservationCandidate into the correct canonical table. This
// is a two-step, honest process:
//   * computeNormalisation() derives the canonical shape WITHOUT writing it, so
//     a human can review the plan. Nothing becomes public here.
//   * commitNormalisation() writes the reviewed shape into the public table.
//
// It never publishes unsupported causation and never turns analysis fields into
// facts — it only reshapes the record the candidate already represents.
// ==========================================================================

import { prisma } from '@/lib/prisma'
import { pickStr, pickNum } from '@/lib/ingest/schema-2-1'
import { parseEvidenceDate } from '@/lib/evidence-contract'

// The canonical tables the engine can target.
export type NormalisationTarget =
  | 'AssetIdentifier'
  | 'Authorisation'
  | 'RegulatoryActivity'
  | 'CapitalProject'
  | 'Measurement'
  | 'CommunityReport'
  | 'NewsItem'
  | 'Event'
  | 'DatasetCoverage'

// candidateType (upper-cased) → canonical table (§O mapping).
const TYPE_MAP: Record<string, NormalisationTarget> = {
  WFD_WATER_BODY_IDENTITY: 'AssetIdentifier',
  WFD_CLASSIFICATION: 'RegulatoryActivity',
  CLASSIFICATION: 'RegulatoryActivity',
  PERMIT: 'Authorisation',
  DISCHARGE_PERMIT: 'Authorisation',
  DISCHARGE_CONSENT: 'Authorisation',
  REGULATORY_ACTIVITY: 'RegulatoryActivity',
  ENFORCEMENT: 'RegulatoryActivity',
  INSPECTION: 'RegulatoryActivity',
  PROJECT: 'CapitalProject',
  CAPITAL_PROJECT: 'CapitalProject',
  MEASUREMENT: 'Measurement',
  SAMPLE: 'Measurement',
  LAB_SAMPLE: 'Measurement',
  EDM_ASSET: 'Event',
  EDM_COUNTY_LEVEL_TOTAL: 'DatasetCoverage',
  COMMUNITY_REPORT: 'CommunityReport',
  NEWS_REPORT: 'NewsItem',
  NEWS: 'NewsItem',
  VERIFIED_RECORD_CANDIDATE: 'Event',
}

// Candidate rows we operate on (the Prisma model shape, loosely typed).
type Candidate = {
  id: string
  candidateType: string | null
  observationType: string | null
  title: string | null
  description: string | null
  resolvedAssetId: string | null
  sourceUrl: string | null
  publishedAt: Date | null
  retrievedAt: Date | null
  datasetIdentifier: string | null
  jurisdiction: string | null
  reportingYear: number | null
  metricWithSpillCount: number | null
  metricSumSpills: number | null
  metricSumDurationHoursParsed: number | null
  metricAssetsInCa: number | null
  geoFilteringMethodology: string | null
  demoTag: string | null
  rawObservation: unknown
}

export interface NormalisationPlan {
  ok: boolean
  target?: NormalisationTarget
  // canonical payload, ready to hand to prisma.<model>.create({ data })
  payload?: Record<string, any>
  reason?: string
}

function rec(v: unknown): Record<string, any> {
  return v && typeof v === 'object' ? (v as Record<string, any>) : {}
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// Preserve only explicit event dates; publication/retrieval are separate facts.
function recordDate(c: Candidate, o: Record<string, any>): Date | null {
  const d = parseEvidenceDate(o.event_date ?? o.eventDate, o.event_date_precision ?? o.datePrecision)
  if (!d.value) return null
  const padded = d.precision === 'year' ? `${d.value}-01-01` : d.precision === 'month' ? `${d.value}-01` : d.value
  return new Date(`${padded}T00:00:00Z`)
}

// Derive the canonical shape for a verified candidate. Pure — writes nothing.
export function computeNormalisation(c: Candidate): NormalisationPlan {
  try { return computePlan(c) }
  catch { return { ok: false, reason: 'A source date is invalid or cannot retain its precision in this destination. Retain the candidate for review.' } }
}

// No precision carrier on these legacy columns: never manufacture day 1.
function pickDate(o: Record<string, any>, ...keys: string[]): string | null {
  let result: string | null = null
  for (const key of keys) {
    if (o[key] == null || o[key] === '') continue
    const date = parseEvidenceDate(o[key])
    if (date.precision !== 'day' || !date.value) throw new Error('Unsupported precision')
    const iso = `${date.value}T00:00:00.000Z`
    if (result && result !== iso) throw new Error('Conflicting dates')
    result = iso
  }
  return result
}

function computePlan(c: Candidate): NormalisationPlan {
  const o = rec(c.rawObservation)
  const type = (c.candidateType ?? c.observationType ?? '').trim().toUpperCase()
  let target: NormalisationTarget | undefined = TYPE_MAP[type]

  // Generic fallback: a verified, asset-resolved record with a title becomes a
  // chronology Event. Unknown types with no resolved asset need a human mapping.
  if (!target) {
    if (c.resolvedAssetId && (c.title || c.description)) target = 'Event'
    else
      return {
        ok: false,
        reason: `No automatic normalisation mapping for candidate type "${type || 'UNKNOWN'}". Needs a human mapping.`,
      }
  }

  const assetId = c.resolvedAssetId ?? undefined
  const requiresAsset = target !== 'DatasetCoverage' && target !== 'NewsItem'
  if (requiresAsset && !assetId) {
    return {
      ok: false,
      reason: `Target ${target} is asset-scoped but the candidate is not resolved to a canonical asset.`,
    }
  }

  let date: Date | null
  let precision: string
  try {
    date = recordDate(c, o)
    precision = parseEvidenceDate(o.event_date ?? o.eventDate, o.event_date_precision ?? o.datePrecision).precision
  } catch { return { ok: false, reason: 'Event date is invalid or its precision is inconsistent. Review required.' } }
  if (date && precision !== 'day' && target !== 'Event') {
    return { ok: false, reason: `${target} cannot currently represent ${precision}-only event dates honestly. Retain for review.` }
  }
  const dateIso = date ? date.toISOString() : null

  switch (target) {
    case 'AssetIdentifier': {
      const value =
        pickStr(o, 'water_body_id', 'wfd_water_body_id', 'value', 'identifier', 'official_identifier') ??
        null
      if (!value) return { ok: false, reason: 'No identifier value found to normalise into AssetIdentifier.' }
      return {
        ok: true,
        target,
        payload: {
          assetId,
          authority: pickStr(o, 'authority', 'publisher') ?? 'Environment Agency',
          identifierType: pickStr(o, 'identifier_type', 'identifierType') ?? 'WFD_WATER_BODY_ID',
          value,
          sourceUrl: c.sourceUrl,
          verified: true,
          validFrom: pickDate(o, 'valid_from', 'validFrom'),
        },
      }
    }
    case 'Authorisation':
      return {
        ok: true,
        target,
        payload: {
          assetId,
          permitRef: pickStr(o, 'permit_ref', 'permitRef', 'permit_reference', 'reference'),
          type: pickStr(o, 'permit_type', 'authorisation_type', 'type') ?? 'environmental_permit',
          grantedDate: pickDate(o, 'granted_date', 'grantedDate', 'issued_date'),
          expiryDate: pickDate(o, 'expiry_date', 'expiryDate'),
          status: pickStr(o, 'permit_status', 'status') ?? 'active',
          authority: pickStr(o, 'authority', 'regulator', 'publisher'),
          conditions: pickStr(o, 'conditions'),
          description: c.description ?? c.title,
          sourceUrl: c.sourceUrl,
          evidenceClass: 'R',
        },
      }
    case 'RegulatoryActivity':
      if (!c.title && !c.description)
        return { ok: false, reason: 'RegulatoryActivity needs a title/description.' }
      return {
        ok: true,
        target,
        payload: {
          assetId,
          title: c.title ?? c.description ?? 'Regulatory record',
          description: c.description,
          date: dateIso,
          regulator: pickStr(o, 'regulator', 'authority', 'publisher'),
          type: pickStr(o, 'activity_type', 'regulatory_type', 'type') ?? 'classification',
          outcome: pickStr(o, 'outcome', 'classification', 'result', 'status'),
          sourceUrl: c.sourceUrl,
          evidenceClass: 'R',
        },
      }
    case 'CapitalProject':
      return {
        ok: true,
        target,
        payload: {
          assetId,
          name: c.title ?? pickStr(o, 'project_name', 'name') ?? 'Capital project',
          description: c.description,
          value: pickStr(o, 'value', 'capex', 'project_value'),
          status: pickStr(o, 'project_status', 'status') ?? 'planned',
          startDate: pickDate(o, 'start_date', 'startDate'),
          endDate: pickDate(o, 'end_date', 'endDate'),
          contractor: pickStr(o, 'contractor'),
          sourceUrl: c.sourceUrl,
          evidenceClass: 'O',
        },
      }
    case 'Measurement': {
      const parameter = pickStr(o, 'parameter', 'determinand', 'metric')
      const value = pickNum(o, 'value', 'result', 'measurement_value')
      if (!parameter) return { ok: false, reason: 'Measurement needs a parameter.' }
      if (value == null) return { ok: false, reason: 'Measurement needs a numeric value (no fabricated values).' }
      if (!dateIso) return { ok: false, reason: 'Measurement needs a date.' }
      return {
        ok: true,
        target,
        payload: {
          assetId,
          parameter,
          value,
          unit: pickStr(o, 'unit', 'units'),
          date: dateIso,
          station: pickStr(o, 'station', 'monitoring_point', 'sampling_point'),
          validated: true,
          sourceUrl: c.sourceUrl,
          evidenceClass: 'R',
        },
      }
    }
    case 'CommunityReport':
      if (!c.title && !c.description)
        return { ok: false, reason: 'CommunityReport needs a title/description.' }
      return {
        ok: true,
        target,
        payload: {
          assetId,
          title: c.title ?? c.description ?? 'Community report',
          description: c.description,
          date: dateIso,
          reportedBy: pickStr(o, 'reported_by', 'reportedBy', 'source_type'),
          type: pickStr(o, 'report_type', 'type') ?? 'other',
          corroborated: false,
          sourceUrl: c.sourceUrl,
          evidenceClass: 'C',
        },
      }
    case 'NewsItem':
      if (!c.title) return { ok: false, reason: 'NewsItem needs a title.' }
      if (!dateIso) return { ok: false, reason: 'NewsItem needs a date.' }
      return {
        ok: true,
        target,
        payload: {
          assetId: assetId ?? null,
          title: c.title,
          summary: c.description,
          date: dateIso,
          sourceDomain: hostOf(c.sourceUrl),
          sourceUrl: c.sourceUrl,
          region: c.jurisdiction,
          category: pickStr(o, 'category'),
          evidenceClass: 'M',
        },
      }
    case 'DatasetCoverage': {
      const metrics: string[] = []
      if (c.metricAssetsInCa != null) metrics.push(`assets in area: ${c.metricAssetsInCa}`)
      if (c.metricWithSpillCount != null) metrics.push(`with-spill count: ${c.metricWithSpillCount}`)
      if (c.metricSumSpills != null) metrics.push(`sum spills: ${c.metricSumSpills}`)
      if (c.metricSumDurationHoursParsed != null)
        metrics.push(`sum duration hours: ${c.metricSumDurationHoursParsed}`)
      const methodologyParts = [
        c.geoFilteringMethodology,
        metrics.length ? `Reported metrics (stored verbatim, not interpreted as harm): ${metrics.join('; ')}.` : null,
      ].filter(Boolean)
      return {
        ok: true,
        target,
        payload: {
          datasetName: c.datasetIdentifier ?? pickStr(o, 'dataset_identifier', 'dataset') ?? 'EDM aggregate',
          publisher: pickStr(o, 'publisher', 'authority'),
          jurisdiction: c.jurisdiction,
          reportingPeriod: c.reportingYear != null ? String(c.reportingYear) : pickStr(o, 'reporting_year'),
          sourceUrl: c.sourceUrl,
          status: 'PARTIAL',
          recordsAvailable: c.metricAssetsInCa,
          methodology: methodologyParts.join(' ') || null,
        },
      }
    }
    case 'Event':
    default:
      if (!c.title && !c.description)
        return { ok: false, reason: 'Event needs a title/description.' }
      if (!dateIso) return { ok: false, reason: 'Event needs a date (no fabricated chronology position).' }
      return {
        ok: true,
        target: 'Event',
        payload: {
          assetId,
          title: c.title ?? c.description ?? 'Environmental record',
          description: c.description,
          date: dateIso,
          eventType: pickStr(o, 'event_type', 'eventType') ?? 'environmental',
          datePrecision: precision,
          evidenceClass: pickStr(o, 'evidence_class', 'evidenceClass') ?? 'R',
          sourceUrl: c.sourceUrl,
          sourceDomain: hostOf(c.sourceUrl),
          verified: true,
        },
      }
  }
}

// Commit a reviewed plan into the public canonical table. Returns the created
// record's id. Idempotency is enforced by the caller (candidate.normalisedRecordId).
export async function commitNormalisation(
  target: NormalisationTarget,
  payload: Record<string, any>,
): Promise<{ recordType: string; recordId: string }> {
  let recordId: string
  switch (target) {
    case 'AssetIdentifier':
      recordId = (await prisma.assetIdentifier.create({ data: payload as any, select: { id: true } })).id
      break
    case 'Authorisation':
      recordId = (await prisma.authorisation.create({ data: payload as any, select: { id: true } })).id
      break
    case 'RegulatoryActivity':
      recordId = (await prisma.regulatoryActivity.create({ data: payload as any, select: { id: true } })).id
      break
    case 'CapitalProject':
      recordId = (await prisma.capitalProject.create({ data: payload as any, select: { id: true } })).id
      break
    case 'Measurement':
      recordId = (await prisma.measurement.create({ data: payload as any, select: { id: true } })).id
      break
    case 'CommunityReport':
      recordId = (await prisma.communityReport.create({ data: payload as any, select: { id: true } })).id
      break
    case 'NewsItem':
      recordId = (await prisma.newsItem.create({ data: payload as any, select: { id: true } })).id
      break
    case 'DatasetCoverage':
      recordId = (await prisma.datasetCoverage.create({ data: payload as any, select: { id: true } })).id
      break
    case 'Event':
    default:
      recordId = (await prisma.event.create({ data: payload as any, select: { id: true } })).id
      break
  }
  return { recordType: target, recordId }
}

// Convenience: the fields computeNormalisation needs, for the Prisma select.
export const CANDIDATE_SELECT = {
  id: true,
  candidateType: true,
  observationType: true,
  title: true,
  description: true,
  resolvedAssetId: true,
  sourceUrl: true,
  publishedAt: true,
  retrievedAt: true,
  datasetIdentifier: true,
  jurisdiction: true,
  reportingYear: true,
  metricWithSpillCount: true,
  metricSumSpills: true,
  metricSumDurationHoursParsed: true,
  metricAssetsInCa: true,
  geoFilteringMethodology: true,
  demoTag: true,
  rawObservation: true,
} as const
