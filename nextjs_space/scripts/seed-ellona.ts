// Seed the Ellona Opportunity Watch with GENUINE, verified public-source records.
// DEV/PREVIEW ONLY.
//
// Every record is additive and idempotent (upsert by a stable id). Each record
// carries its OWN primary-source URL (no URL is reused across records), the
// publisher, the publication date, the retrieval date, a directly-supporting
// verbatim passage quoted from that source, the honest opportunity status, the
// location, the Ellona relevance, the open unknowns and a recommended next
// action. Nothing here claims Ellona holds an accreditation, is a prime, is
// short-listed, or has any relationship with a buyer. Published values are
// whole-contract / whole-award values attributable to no bidder. Every record is
// labelled "Trial seed record — previously published" so it cannot be mistaken
// for a newly discovered opportunity during Natalia's trial.
//
// Run: yarn tsx --require dotenv/config scripts/seed-ellona.ts

import { prisma } from '../lib/prisma'
import { provisionEllonaTenant } from '../lib/ellona/tenant'
import { routeCanonicalOpportunity } from '../lib/ellona/routing'

// Common retrieval date for the source verification pass in this seed.
const RETRIEVED_AT = new Date('2026-09-15T17:00:00.000Z')

const EPA_SOURCE_URL = 'https://www.etenders.gov.ie/epps/cft/prepareViewCfTWS.do?resourceId=8929884'

// Verified EPA facts (brief §10). Used as the facts of record; a live re-fetch,
// when it succeeds, is recorded in provenance with its own fetchedAt.
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
  // Provenance fields (Part 3): every record carries these.
  publisher: string
  supportedClaim: string
  supportingPassage: string
  statusNote: string
  ellonaRelevance: string
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
      publisher: 'eTenders — Irish Government procurement portal (Office of Government Procurement)',
      supportedClaim: 'The EPA is procuring an independent air-emissions monitoring programme for 2027–2029.',
      supportingPassage:
        'The EPA wishes to procure, by means of a competitive tender, the programme of independent air emissions monitoring for the period 2027 - 2029.',
      statusNote:
        'Open tender at retrieval. Clarification deadline 16 September 2026 17:00; tender deadline 23 September 2026 17:00 (Europe/Dublin).',
      ellonaRelevance:
        'Directly aligned with Ellona’s air-emissions / air-quality monitoring capability; a national, multi-site programme in the Republic of Ireland.',
      nextAction:
        'Decide whether Ellona should qualify as a bidder, specialist partner or technology subcontractor, and lodge any essential clarification questions before the 16 September deadline.',
      clarificationQuestions: [
        'Which pollutants and site categories are in scope, and are reference methods mandated?',
        'Are specific accreditations (e.g. ISO 17025 for named methods) mandatory at bid stage or award stage?',
      ],
    },
    {
      id: 'ellona-seed-leicester-aq-network',
      status: 'CLOSED',
      classification: 'MONITORING NEED',
      buyer: 'Leicester City Council',
      title: 'Provision of Air Quality Monitoring Network & Associated Services',
      projectName: 'City air-quality sensor network',
      country: 'United Kingdom',
      region: 'England (City of Leicester)',
      themes: ['air quality', 'sensor network', 'hotspot monitoring'],
      capabilities: ['air-quality sensors', 'network deployment', 'data platforms'],
      measurementNeed:
        'Deploy and operate a network of air-quality sensors across a city to measure pollution hotspots and evaluate the effectiveness of air-quality initiatives.',
      publishedValue: '£250,000 (estimated, GBP)',
      valueBasis: 'Whole-contract estimated value published by the buyer in the Find a Tender notice. Not attributable to any bidder.',
      publicationDate: '12 January 2026 16:59 (tender notice 2026/S 000-002430); preliminary market engagement 25 June 2025',
      tenderDeadline: '6 February 2026 10:00 (submissions closed)',
      sourceName: 'Find a Tender (UK)',
      sourceUrl: 'https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-0553ac',
      officialId: 'ocds-h6vhtk-0553ac',
      locationType: 'city',
      latitude: 52.6369,
      longitude: -1.1398,
      coordSource:
        'Approximate Leicester city-centre centroid for map display only; the notice does not publish individual sensor coordinates.',
      precision: 'city',
      publisher: 'Find a Tender — UK Government procurement service (Cabinet Office)',
      supportedClaim: 'Leicester City Council sought 20 air-quality sensors for deployment at city pollution hotspots.',
      supportingPassage:
        'The Council wishes to purchase twenty (20) Air Quality Sensors. The Sensors are to be deployed across the City of Leicester to measure and monitor air quality at various hotspots that have potential poor air quality.',
      statusNote:
        'Tender submissions closed 6 February 2026. Retained as recent, directly-relevant market evidence — an air-quality sensor-network procurement of exactly the kind Ellona supplies. No award notice observed at retrieval; current status should be re-checked at source.',
      ellonaRelevance:
        'A close match to Ellona’s core product — a deployed city air-quality sensor network with associated data services — evidencing genuine UK local-authority demand and a comparable contract scale.',
      nextAction:
        'Treat as a comparable reference; watch for the award outcome and any renewal/expansion, and identify similar UK local authorities preparing sensor-network procurements.',
      clarificationQuestions: [
        'Has the contract been awarded, and if so to whom and at what value?',
        'Which pollutants and sensor performance standards did the specification require?',
      ],
    },
    {
      id: 'ellona-seed-greater-cambridge-sssi',
      status: 'AWARDED',
      classification: 'MONITORING NEED',
      buyer: 'Cambridge City Council and South Cambridgeshire District Council',
      title: 'Air Quality modelling of Sites of Special Scientific Interest (SSSIs) to inform the Greater Cambridge Local Plan',
      projectName: 'Greater Cambridge Local Plan — air-quality evidence',
      country: 'United Kingdom',
      region: 'Cambridge–Peterborough (Greater Cambridge)',
      themes: ['air quality', 'modelling', 'planning evidence'],
      capabilities: ['air-quality modelling', 'road-traffic emissions assessment', 'environmental evidence'],
      measurementNeed:
        'Model road-traffic emissions near Sites of Special Scientific Interest to provide air-quality evidence for a local plan.',
      publishedValue: '£18,562 (award value, GBP)',
      valueBasis: 'Award value published in the Find a Tender contract award notice. Awarded to Air Quality Consultants Ltd.',
      publicationDate: 'Tender published 13 July 2026; contract award notice 9 September 2026 (2026/S 000-085225)',
      tenderDeadline: '24 July 2026 17:00 (tender period ended)',
      sourceName: 'Find a Tender (UK)',
      sourceUrl: 'https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-06c996',
      officialId: 'ocds-h6vhtk-06c996',
      locationType: 'area',
      latitude: 52.2053,
      longitude: 0.1218,
      coordSource:
        'Approximate Cambridge city-centre centroid for map display only; the requirement covers the Greater Cambridge area, not a single point.',
      precision: 'area',
      publisher: 'Find a Tender — UK Government procurement service (Cabinet Office)',
      supportedClaim: 'The Greater Cambridge councils sought consultants to model road-traffic emissions near Sites of Special Scientific Interest.',
      supportingPassage:
        'Cambridge City Council and South Cambridgeshire District Council (the Councils) are seeking suitably qualified consultants to carry out air quality modelling of road traffic emissions in proximity of Sites of Special Scientific Interest (SSSIs) within the area of Cambridge City Council and South Cambridgeshire District Council (Greater Cambridge).',
      statusNote:
        'Contract awarded 9 September 2026 to Air Quality Consultants Ltd (£18,562). Included as a priority-geography market signal — not an open opportunity.',
      ellonaRelevance:
        'Sits in Ellona’s priority Cambridge–Peterborough geography and confirms that the Greater Cambridge authorities commission air-quality work; useful for pipeline and relationship mapping even though this instance is awarded.',
      nextAction:
        'Log the buyers and their air-quality evidence needs; watch the Greater Cambridge Local Plan programme for follow-on monitoring or modelling requirements Ellona could serve.',
      clarificationQuestions: [
        'Will the Local Plan evidence base generate follow-on monitoring (as opposed to one-off modelling) requirements?',
        'Do these authorities run a framework or repeat-buy route Ellona could join?',
      ],
    },
    {
      id: 'ellona-seed-daera-aq-regs',
      status: 'CLOSED',
      classification: 'EARLY SIGNAL — REQUIRES QUALIFICATION',
      buyer: 'Department of Agriculture, Environment and Rural Affairs (DAERA), Northern Ireland',
      title: 'Consultation on the Draft Air Quality (Amendment) Regulations (Northern Ireland) 2026',
      projectName: 'Tightening of PM10 / PM2.5 limits in Northern Ireland',
      country: 'United Kingdom',
      region: 'Northern Ireland',
      themes: ['air quality', 'particulate matter', 'regulation'],
      capabilities: ['particulate monitoring', 'air-quality assessment', 'compliance reporting'],
      measurementNeed:
        'Tighter statutory PM10 and PM2.5 limits increase demand for accurate particulate measurement and compliance assessment across Northern Ireland.',
      valueBasis: 'No procurement value — this is a policy consultation, not a contract.',
      publicationDate: 'Consultation opened 8 June 2026 11:00; closed 31 August 2026 11:59',
      sourceName: 'DAERA (Northern Ireland)',
      sourceUrl:
        'https://www.daera-ni.gov.uk/consultations/consultation-draft-air-quality-amendment-regulations-northern-ireland-2026',
      locationType: 'regional',
      precision: 'regional',
      publisher: 'Department of Agriculture, Environment and Rural Affairs (DAERA), Northern Ireland',
      supportedClaim: 'DAERA launched a consultation proposing tighter annual PM10 and PM2.5 limits in Northern Ireland.',
      supportingPassage:
        'The Department of Agriculture, Environment and Rural Affairs (DAERA) has launched a public consultation on the Draft Air Quality (Amendment) Regulations (Northern Ireland) 2026 to tighten annual average particulate matter (PM10 and PM2.5) limits, targets and objectives in Northern Ireland.',
      statusNote:
        'Consultation closed 31 August 2026. Included as a regulatory driver: tighter PM limits tend to increase demand for monitoring — it is a policy signal, not a procurement.',
      ellonaRelevance:
        'Tighter PM10/PM2.5 limits in a UK+ROI territory strengthen the case for expanded particulate monitoring, the kind of demand Ellona’s sensing addresses; useful as early market-shaping intelligence.',
      nextAction:
        'Track the outcome of the regulations; if adopted, identify the Northern Ireland bodies likely to expand particulate monitoring and position Ellona ahead of any procurement.',
      clarificationQuestions: [
        'Will the tightened limits be adopted, and on what timetable?',
        'Which bodies would be responsible for the additional monitoring the new limits imply?',
      ],
    },
  ]
}

async function main() {
  const prov = await provisionEllonaTenant()
  const workspaceId = prov.workspaceId
  const epaFetch = await tryFetchEpa()

  let created = 0
  let updated = 0
  for (const s of seeds()) {
    const isEpa = s.id === 'ellona-seed-epa-air'
    const provenance = {
      source_of_record: s.sourceName,
      source_url: s.sourceUrl,
      publisher: s.publisher,
      publication_date: s.publicationDate ?? null,
      retrieved_at: RETRIEVED_AT.toISOString(),
      status_note: s.statusNote,
      facts_basis:
        'Human-reviewed public-source record. The supporting passage is preserved separately from workspace interpretation.',
      ...(isEpa
        ? {
            fetch_note: epaFetch.note,
            fetched_at: epaFetch.fetchedAt ? epaFetch.fetchedAt.toISOString() : null,
          }
        : {}),
    }
    const result = await routeCanonicalOpportunity({
      verificationState: 'VERIFIED',
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      publisher: s.publisher,
      officialId: s.officialId ?? null,
      procedureId: s.procedureId ?? null,
      buyer: s.buyer,
      title: s.title,
      projectName: s.projectName ?? null,
      country: s.country,
      region: s.region ?? null,
      classification: s.classification,
      sourceStatus: s.status,
      themes: s.themes,
      capabilities: s.capabilities,
      measurementNeed: s.measurementNeed,
      publishedValue: s.publishedValue ?? null,
      valueBasis: s.valueBasis ?? null,
      publicationDate: s.publicationDate ?? null,
      clarificationDeadline: s.clarificationDeadline ?? null,
      tenderDeadline: s.tenderDeadline ?? null,
      duration: s.duration ?? null,
      supportedClaim: s.supportedClaim,
      supportingPassage: s.supportingPassage,
      sourceReadable: !isEpa || epaFetch.ok,
      accessLimitations: isEpa && !epaFetch.ok ? epaFetch.note : null,
      provenance,
      locationType: s.locationType ?? null,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      coordSource: s.coordSource ?? null,
      precision: s.precision ?? null,
      nextAction: s.nextAction,
      clarificationQuestions: s.clarificationQuestions,
      retrievedAt: isEpa && epaFetch.fetchedAt ? epaFetch.fetchedAt : RETRIEVED_AT,
      seedRecord: true,
    }, {
      [workspaceId]: {
        relevance: s.ellonaRelevance,
        nextAction: s.nextAction,
        clarificationQuestions: s.clarificationQuestions,
      },
    })
    if (result.duplicate) updated++
    else created++
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
