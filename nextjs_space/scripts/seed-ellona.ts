// Seed the Ellona Opportunity Watch with the flagship EPA opportunity and a
// small set of clearly-labelled trial seed records. DEV/PREVIEW ONLY.
//
// Every record is additive and idempotent (upsert by a stable id). Each carries
// seedLabel = 'Trial seed record — previously published' and honest provenance.
// Nothing here claims Ellona holds an accreditation, is a prime, or has any
// relationship with a buyer. Published values are whole-contract values.
//
// Run: yarn tsx --require dotenv/config scripts/seed-ellona.ts

import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { provisionEllonaTenant, originRecord } from '../lib/ellona/tenant'

const EPA_SOURCE_URL = 'https://www.etenders.gov.ie/epps/cft/prepareViewCfTWS.do?resourceId=8929884'

// Verified EPA facts (brief §10). These are used as the fallback when a live
// re-fetch is not possible; a live fetch, when it succeeds, is recorded in
// provenance with its own fetchedAt.
const EPA_FACTS = {
  buyer: 'Environmental Protection Agency, Ireland',
  title:
    'Provision of Air Emissions Monitoring Programme of air-emission compliance monitoring at selected EPA-licensed sites',
  publicationDate: '28 August 2026 03:13 (Europe/Dublin)',
  clarificationDeadline: '16 September 2026 17:00 (Europe/Dublin)',
  tenderDeadline: '23 September 2026 17:00 (Europe/Dublin)',
  duration: '36 months',
  publishedValue: '€1,300,000 (estimated, excluding VAT)',
  officialId: '8929884',
  procedureId: '9d767662-e45a-4f22-98de-b83cb5c583d7',
}

async function tryFetchEpa(): Promise<{ ok: boolean; fetchedAt: Date | null; note: string }> {
  try {
    const res = await fetch(EPA_SOURCE_URL, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { ok: false, fetchedAt: null, note: `Live re-fetch returned HTTP ${res.status}; using verified facts of record.` }
    await res.text()
    return {
      ok: true,
      fetchedAt: new Date(),
      note: 'Source reachable at seed time; facts below are the verified facts of record and were not overwritten by automated scraping.',
    }
  } catch (e) {
    return { ok: false, fetchedAt: null, note: `Live re-fetch not possible at seed time (${(e as Error).message}); using verified facts of record.` }
  }
}

type Seed = {
  id: string
  status: string
  classification: string
  buyer: string
  title: string
  projectName?: string
  country: string
  region?: string
  themes: string[]
  capabilities: string[]
  measurementNeed: string
  publishedValue?: string
  valueBasis?: string
  publicationDate?: string
  clarificationDeadline?: string
  tenderDeadline?: string
  duration?: string
  sourceName: string
  sourceUrl: string
  officialId?: string
  procedureId?: string
  locationType?: string
  latitude?: number
  longitude?: number
  coordSource?: string
  precision?: string
  nextAction: string
  clarificationQuestions: string[]
}

function seeds(): Seed[] {
  return [
    {
      id: 'ellona-seed-epa-air',
      status: 'NEW',
      classification: 'OPEN TENDER',
      buyer: EPA_FACTS.buyer,
      title: EPA_FACTS.title,
      projectName: 'Air Emissions Monitoring Programme',
      country: 'Republic of Ireland',
      region: 'National (EPA-licensed sites)',
      themes: ['air quality', 'emissions', 'compliance monitoring'],
      capabilities: ['air-emission monitoring', 'sensor networks', 'data reporting'],
      measurementNeed:
        'Air-emission compliance monitoring at selected EPA-licensed sites over the contract term.',
      publishedValue: EPA_FACTS.publishedValue,
      valueBasis: 'Whole-contract estimated value published by the buyer (excludes VAT). Not attributable to any bidder.',
      publicationDate: EPA_FACTS.publicationDate,
      clarificationDeadline: EPA_FACTS.clarificationDeadline,
      tenderDeadline: EPA_FACTS.tenderDeadline,
      duration: EPA_FACTS.duration,
      sourceName: 'eTenders (Ireland)',
      sourceUrl: EPA_SOURCE_URL,
      officialId: EPA_FACTS.officialId,
      procedureId: EPA_FACTS.procedureId,
      locationType: 'national',
      precision: 'national',
      nextAction:
        'Decide whether Ellona should qualify as a bidder, specialist partner or technology subcontractor, and identify any essential clarification questions before the deadline.',
      clarificationQuestions: [
        'Which pollutants and site categories are in scope, and are reference methods mandated?',
        'Are specific accreditations (e.g. ISO 17025 for named methods) mandatory at bid stage or award stage?',
      ],
    },
    {
      id: 'ellona-seed-water-hydrometry',
      status: 'NEW',
      classification: 'MONITORING NEED',
      buyer: 'A UK water authority (trial seed — illustrative)',
      title: 'Continuous hydrometry and water-quality monitoring across a river catchment',
      projectName: 'Catchment water-quality monitoring',
      country: 'United Kingdom',
      region: 'England',
      themes: ['water quality', 'hydrometry', 'catchment'],
      capabilities: ['water-quality sensors', 'telemetry', 'analytics'],
      measurementNeed:
        'Continuous measurement of flow and key water-quality determinands to detect pollution events and support compliance.',
      valueBasis: 'No published value in this seed record.',
      publicationDate: 'Trial seed — previously published',
      sourceName: 'Trial seed record',
      sourceUrl: EPA_SOURCE_URL,
      locationType: 'area',
      latitude: 52.2,
      longitude: 0.12,
      coordSource: 'Indicative catchment centroid (trial seed)',
      precision: 'area',
      nextAction: 'Confirm whether the requirement is a framework, a direct award or an early market engagement.',
      clarificationQuestions: ['Is real-time telemetry required, or is periodic sampling acceptable?'],
    },
    {
      id: 'ellona-seed-marine-sampling',
      status: 'NEW',
      classification: 'EARLY SIGNAL — REQUIRES QUALIFICATION',
      buyer: 'A marine/port body (trial seed — illustrative)',
      title: 'Marine water and sediment sampling programme for a port development',
      projectName: 'Port environmental baseline',
      country: 'Republic of Ireland',
      region: 'Coastal',
      themes: ['marine', 'sediment', 'baseline survey'],
      capabilities: ['marine sampling', 'laboratory analysis coordination'],
      measurementNeed: 'Baseline and ongoing marine water/sediment quality measurement around a proposed development.',
      valueBasis: 'No published value in this seed record.',
      publicationDate: 'Trial seed — previously published',
      sourceName: 'Trial seed record',
      sourceUrl: EPA_SOURCE_URL,
      locationType: 'approximate',
      latitude: 53.35,
      longitude: -6.2,
      coordSource: 'Indicative port location (trial seed)',
      precision: 'approximate',
      nextAction: 'Qualify whether this is a live procurement or a signal requiring verification before action.',
      clarificationQuestions: ['Is this confirmed as funded, and what is the anticipated procurement route?'],
    },
    {
      id: 'ellona-seed-ecology-survey',
      status: 'NEW',
      classification: 'FUNDED PROJECT',
      buyer: 'A local authority (trial seed — illustrative)',
      title: 'Ecological monitoring for a nature-restoration scheme',
      projectName: 'Nature-restoration monitoring',
      country: 'United Kingdom',
      region: 'Cambridge–Peterborough',
      themes: ['ecology', 'biodiversity', 'restoration'],
      capabilities: ['environmental monitoring', 'biodiversity data'],
      measurementNeed: 'Measure environmental change to evidence outcomes of a funded nature-restoration scheme.',
      valueBasis: 'No published value in this seed record.',
      publicationDate: 'Trial seed — previously published',
      sourceName: 'Trial seed record',
      sourceUrl: EPA_SOURCE_URL,
      locationType: 'area',
      latitude: 52.57,
      longitude: -0.24,
      coordSource: 'Indicative Cambridge–Peterborough area (trial seed)',
      precision: 'area',
      nextAction: 'Assess fit against the scheme’s measurement plan and identify the commissioning route.',
      clarificationQuestions: ['What indicators and reporting cadence does the funder require?'],
    },
    {
      id: 'ellona-seed-env-monitoring-ni',
      status: 'NEW',
      classification: 'PRE-MARKET ENGAGEMENT',
      buyer: 'A Northern Ireland public body (trial seed — illustrative)',
      title: 'Pre-market engagement on environmental monitoring technology',
      projectName: 'Environmental monitoring pre-market engagement',
      country: 'United Kingdom',
      region: 'Northern Ireland',
      themes: ['environmental monitoring', 'air quality', 'water quality'],
      capabilities: ['sensor technology', 'data platforms'],
      measurementNeed: 'Understand available technology to measure multiple environmental parameters cost-effectively.',
      valueBasis: 'No published value in this seed record.',
      publicationDate: 'Trial seed — previously published',
      sourceName: 'Trial seed record',
      sourceUrl: EPA_SOURCE_URL,
      locationType: 'regional',
      precision: 'regional',
      nextAction: 'Consider responding to the engagement to position Ellona’s technology ahead of any procurement.',
      clarificationQuestions: ['What is the anticipated timeline from engagement to procurement?'],
    },
  ]
}

async function main() {
  const prov = await provisionEllonaTenant()
  const workspaceId = prov.workspaceId
  const origin = originRecord(workspaceId, prov.originatorUserId)
  const epaFetch = await tryFetchEpa()

  let created = 0
  let updated = 0
  for (const s of seeds()) {
    const isEpa = s.id === 'ellona-seed-epa-air'
    const provenance = {
      ...origin,
      source_of_record: s.sourceName,
      source_url: s.sourceUrl,
      ...(isEpa
        ? {
            fetch_note: epaFetch.note,
            fetched_at: epaFetch.fetchedAt ? epaFetch.fetchedAt.toISOString() : null,
            facts_basis: 'Verified facts of record (brief §10). Live scraping did not overwrite these facts.',
          }
        : { facts_basis: 'Illustrative trial seed record; not a live procurement.' }),
    }
    const data = {
      workspaceId,
      status: s.status,
      classification: s.classification,
      buyer: s.buyer,
      title: s.title,
      projectName: s.projectName ?? null,
      country: s.country,
      region: s.region ?? null,
      themes: s.themes,
      capabilities: s.capabilities,
      measurementNeed: s.measurementNeed,
      publishedValue: s.publishedValue ?? null,
      valueBasis: s.valueBasis ?? null,
      publicationDate: s.publicationDate ?? null,
      clarificationDeadline: s.clarificationDeadline ?? null,
      tenderDeadline: s.tenderDeadline ?? null,
      duration: s.duration ?? null,
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      officialId: s.officialId ?? null,
      procedureId: s.procedureId ?? null,
      provenance,
      locationType: s.locationType ?? null,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      coordSource: s.coordSource ?? null,
      precision: s.precision ?? null,
      nextAction: s.nextAction,
      clarificationQuestions: s.clarificationQuestions,
      seedLabel: 'Trial seed record — previously published',
      fetchedAt: isEpa ? epaFetch.fetchedAt : null,
    }
    const existing = await prisma.opportunity.findUnique({ where: { id: s.id }, select: { id: true } })
    await prisma.opportunity.upsert({ where: { id: s.id }, update: data, create: { id: s.id, ...data } })
    if (existing) {
      updated++
    } else {
      created++
      await prisma.opportunityEvent.create({
        data: {
          id: randomUUID(),
          opportunityId: s.id,
          kind: 'CREATED',
          summary: `Seed record added to the Ellona watch (${s.classification}).`,
          changedFields: {},
          previousValues: {},
        },
      })
    }
  }

  console.log(`Ellona tenant workspaceId=${workspaceId} (created=${prov.created})`)
  console.log(`Opportunities: created=${created}, updated=${updated}`)
  console.log(`EPA live re-fetch ok=${epaFetch.ok}; note: ${epaFetch.note}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
