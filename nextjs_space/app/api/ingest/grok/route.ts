export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  schema21,
  readMeta,
  fingerprint,
  pickStr,
  pickNum,
  pickInt,
  pickDate,
  type Schema21Payload,
} from '@/lib/ingest/schema-2-1'
import { resolveAsset } from '@/lib/ingest/resolve'
import { assessCandidate } from '@/lib/ingest/verify'
import { rollupRawIngestStatus } from '@/lib/ingest/lifecycle'

const INGEST_HEADER = 'x-bioveracity-ingest-key'

function rec(v: unknown): Record<string, any> {
  return v && typeof v === 'object' ? (v as Record<string, any>) : {}
}

// Build the per-observation candidate row from a raw observation object.
function buildObservation(o: Record<string, any>, demoTag: string | null) {
  const coords = rec(o.coordinates_proposal ?? o.coordinatesProposal)
  const lat = pickNum(coords, 'lat', 'latitude') ?? pickNum(o, 'lat', 'latitude')
  const lng = pickNum(coords, 'lng', 'lon', 'longitude') ?? pickNum(o, 'lng', 'lon', 'longitude')

  return {
    candidateType: pickStr(o, 'type', 'candidate_type', 'observation_type'),
    observationType: pickStr(o, 'observation_type', 'type', 'label'),
    // Sensible title fallback: use the observation type/label when an explicit
    // title/name/headline is absent (§M).
    title: pickStr(o, 'title', 'name', 'headline') ?? pickStr(o, 'observation_type', 'type', 'label'),
    description: pickStr(o, 'claim', 'description', 'summary', 'detail'),
    coordinatesProposalLat: lat,
    coordinatesProposalLng: lng,
    confidenceProposal: pickStr(o, 'confidence_proposal', 'confidence', 'confidenceProposal'),
    // EDM_COUNTY_LEVEL_TOTAL structured metrics (stored verbatim, never interpreted)
    metricAssetsInCa: pickInt(o, 'metric_assets_in_ca', 'metricAssetsInCa'),
    metricWithSpillCount: pickInt(o, 'metric_with_spill_count', 'metricWithSpillCount'),
    metricSumSpills: pickInt(o, 'metric_sum_spills', 'metricSumSpills'),
    metricSumDurationHoursParsed: pickNum(o, 'metric_sum_duration_hours_parsed', 'metricSumDurationHoursParsed'),
    reportingYear: pickInt(o, 'reporting_year', 'reportingYear'),
    geoFilteringMethodology: pickStr(o, 'geographic_filtering_methodology', 'geo_filtering_methodology', 'geographicFilteringMethodology'),
    datasetIdentifier: pickStr(o, 'dataset_identifier', 'dataset_id', 'datasetIdentifier'),
    jurisdiction: pickStr(o, 'jurisdiction'),
    sourceUrl: pickStr(o, 'source_url', 'sourceUrl', 'url'),
    publishedAt: pickDate(o, 'publication_timestamp', 'published_at', 'publishedAt', 'published'),
    retrievedAt: pickDate(o, 'retrieval_timestamp', 'retrieved_at', 'retrievedAt', 'retrieved'),
    demoTag,
    rawObservation: o as any,
  }
}

export async function POST(request: Request) {
  // ---- 1. Authentication (never exposed to the browser) ----
  const provided = request.headers.get(INGEST_HEADER)
  const expected = process.env.BIOVERACITY_INGEST_KEY
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ success: false, error: 'Invalid or missing ingest key' }, { status: 401 })
  }

  // ---- 2. Parse JSON body ----
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed JSON body' }, { status: 400 })
  }

  // ---- 3. Validate schema 2.1 ----
  const parsed = schema21.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Payload does not conform to schema 2.1', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const payload: Schema21Payload = parsed.data

  // ---- 4. Deterministic fingerprint + duplicate guard ----
  const fp = fingerprint(body)
  const existing = await prisma.rawIngest.findUnique({
    where: { payloadFingerprint: fp },
    select: { id: true },
  })
  if (existing) {
    // Record the duplicate hit for the ingest monitor, but never ingest twice.
    await prisma.rawIngest.update({
      where: { id: existing.id },
      data: { duplicateHits: { increment: 1 } },
    })
    return NextResponse.json({ success: true, duplicate: true, rawIngestId: existing.id })
  }

  const meta = readMeta(payload)
  const observations = Array.isArray(payload.observations) ? payload.observations : []
  const now = new Date()

  // ---- 5. Raw storage FIRST (status FOUND) ----
  let rawIngestId: string
  try {
    const raw = await prisma.rawIngest.create({
      data: {
        sourceAgent: meta.sourceAgent,
        schemaVersion: meta.schemaVersion,
        category: meta.category,
        targetRegion: meta.targetRegion,
        demoTag: meta.demoTag,
        stream: meta.stream,
        rawPayload: body as any,
        analysis: (payload.analysis ?? {}) as any,
        payloadFingerprint: fp,
        observationCount: observations.length,
        status: 'FOUND',
        foundAt: now,
      },
      select: { id: true },
    })
    rawIngestId = raw.id
  } catch (e: any) {
    // Unique-constraint race: another request stored the same fingerprint first.
    if (e?.code === 'P2002') {
      const dup = await prisma.rawIngest.findUnique({
        where: { payloadFingerprint: fp },
        select: { id: true },
      })
      if (dup) {
        await prisma.rawIngest.update({
          where: { id: dup.id },
          data: { duplicateHits: { increment: 1 } },
        })
      }
      return NextResponse.json({ success: true, duplicate: true, rawIngestId: dup?.id })
    }
    throw e
  }

  // ---- 6. Interpretation layer (candidates + separation) ----
  try {
    // 6a. Observation candidates — one per observations[] item.
    for (const item of observations) {
      const o = rec(item)
      const data = buildObservation(o, meta.demoTag)

      // Incoming asset_alias may be a single string or an array; normalise to string[]
      // so an aliased place (e.g. "Cam (Stapleford to Hauxton Junction)" carrying
      // alias "River Cam") can resolve conservatively to the canonical record.
      const aliasRaw = o.asset_alias ?? o.assetAlias
      const aliases: string[] = Array.isArray(aliasRaw)
        ? aliasRaw.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
        : typeof aliasRaw === 'string'
          ? aliasRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []

      // Additional official identifiers may arrive as identifier_list/identifiers
      // (string or array) on the observation (§N). Prefer these before names.
      const idListRaw = o.identifier_list ?? o.identifiers
      const identifiers: string[] = Array.isArray(idListRaw)
        ? idListRaw.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
        : typeof idListRaw === 'string'
          ? idListRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []

      // Conservative entity resolution (never creates a public asset).
      const officialIdentifier = pickStr(o, 'official_identifier', 'asset_id', 'identifier')
      const matchedAssetId = await resolveAsset({
        slug: pickStr(o, 'asset_slug', 'slug'),
        name: pickStr(o, 'asset_name', 'canonical_name', 'place', 'name'),
        officialIdentifier,
        identifiers,
        aliases,
      })

      // §L verification gate: only deterministically-checkable candidates are
      // auto-verified; everything else is sent to human review. Nothing here
      // becomes public — that only happens at the normalise/publish steps.
      const assessment = await assessCandidate({
        resolvedAssetId: matchedAssetId,
        resolutionStatus: matchedAssetId ? 'RESOLVED' : 'UNRESOLVED',
        sourceUrl: data.sourceUrl,
        officialIdentifier,
        identifiers,
      })
      const autoVerified = assessment.decision === 'AUTO_VERIFY'

      await prisma.observationCandidate.create({
        data: {
          rawIngestId,
          ...data,
          resolvedAssetId: matchedAssetId,
          resolutionStatus: matchedAssetId ? 'RESOLVED' : 'UNRESOLVED',
          status: autoVerified ? 'VERIFIED' : 'NEEDS_REVIEW',
          verificationMethod: assessment.method,
          verificationNote: assessment.reason,
          verifiedAt: autoVerified ? new Date() : null,
        },
      })
    }

    // 6b. Commercial signals — stored SEPARATELY from factual chronology.
    const commercial = rec(payload.commercial)
    if (Object.keys(commercial).length > 0) {
      await prisma.commercialSignal.create({
        data: {
          rawIngestId,
          possibleBuyer: pickStr(commercial, 'possible_buyer', 'possibleBuyer', 'buyer'),
          commercialOpportunity: pickStr(commercial, 'commercial_opportunity', 'commercialOpportunity', 'opportunity'),
          sensorOpportunity: pickStr(commercial, 'sensor_opportunity', 'sensorOpportunity'),
          proofOfEffectOpportunity: pickStr(commercial, 'proof_of_effect_opportunity', 'proofOfEffectOpportunity'),
          rawCommercial: commercial as any,
        },
      })
    }

    // 6c. Entity-resolution proposals — matched conservatively, else UNRESOLVED.
    const erp = payload.entity_resolution_proposals
    if (erp && typeof erp === 'object') {
      const proposals: any[] = Array.isArray(erp) ? erp : [erp]
      for (const p of proposals) {
        const prop = rec(p)
        // A proposal object may itself carry several typed entity keys; if it
        // has no recognisable identity fields, skip it.
        const canonicalName = pickStr(prop, 'canonical_name', 'canonicalName', 'name')
        const officialIdentifier = pickStr(prop, 'official_identifier', 'officialIdentifier', 'identifier')
        if (!canonicalName && !officialIdentifier && Object.keys(prop).length === 0) continue

        const aliasesRaw = prop.aliases
        const aliasesArr: string[] = Array.isArray(aliasesRaw)
          ? aliasesRaw.filter((x) => typeof x === 'string')
          : typeof aliasesRaw === 'string'
            ? aliasesRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
            : []

        const matchedAssetId = await resolveAsset({
          slug: pickStr(prop, 'slug', 'asset_slug'),
          name: canonicalName,
          officialIdentifier,
          aliases: aliasesArr,
        })

        await prisma.entityCandidate.create({
          data: {
            rawIngestId,
            proposedType: pickStr(prop, 'type', 'entity_type', 'proposedType'),
            officialIdentifier,
            canonicalName,
            aliases: aliasesArr.length ? aliasesArr.join(', ') : null,
            jurisdiction: pickStr(prop, 'jurisdiction'),
            matchedAssetId,
            resolutionStatus: matchedAssetId ? 'RESOLVED' : 'UNRESOLVED',
            rawProposal: prop as any,
          },
        })
      }
    }

    // ---- 7. Mark parsed, then roll the pipeline forward from the candidate
    //         verification outcomes (VERIFICATION_PENDING / VERIFIED). ----
    await prisma.rawIngest.update({
      where: { id: rawIngestId },
      data: { status: 'PARSED', parsedAt: new Date() },
    })
    const rolledStatus = await rollupRawIngestStatus(rawIngestId)

    return NextResponse.json({
      success: true,
      rawIngestId,
      observationsReceived: observations.length,
      status: rolledStatus,
    })
  } catch (e: any) {
    // Interpretation failed — the raw payload is preserved; mark FAILED.
    await prisma.rawIngest.update({
      where: { id: rawIngestId },
      data: { status: 'FAILED', failedAt: new Date(), error: String(e?.message ?? e).slice(0, 2000) },
    })
    return NextResponse.json(
      { success: false, rawIngestId, status: 'FAILED', error: 'Ingestion stored but interpretation failed' },
      { status: 500 },
    )
  }
}

// Any non-POST method is not allowed on the ingest endpoint.
export async function GET() {
  return NextResponse.json({ success: false, error: 'Use POST to submit schema 2.1 payloads' }, { status: 405 })
}
