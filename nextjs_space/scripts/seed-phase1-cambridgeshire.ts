// Phase 1 — §W Cambridgeshire Layer A corrections + core canonical seed.
// Idempotent (explicit ids / upserts). NO deletes. Safe on the shared DB.
//
// Run: cd nextjs_space && set -a && . ./.env && set +a && yarn tsx scripts/seed-phase1-cambridgeshire.ts
import { prisma } from '../lib/prisma'

// §E deterministic alias normalisation: trim, lowercase, collapse whitespace.
function normalizeAlias(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function main() {
  // ---- Area: Cambridgeshire & Peterborough (region) ----
  const area = await prisma.area.upsert({
    where: { slug: 'cambridgeshire-peterborough' },
    update: { name: 'Cambridgeshire & Peterborough', type: 'REGION', jurisdiction: 'England' },
    create: {
      slug: 'cambridgeshire-peterborough',
      name: 'Cambridgeshire & Peterborough',
      type: 'REGION',
      jurisdiction: 'England',
    },
    select: { id: true },
  })
  console.log('Area cambridgeshire-peterborough:', area.id)

  // ---- Link existing Cambridgeshire assets to the area (AssetArea) ----
  const cambsAssets = await prisma.asset.findMany({
    where: { regionSlug: 'cambridgeshire' },
    select: { id: true, slug: true },
  })
  for (const a of cambsAssets) {
    await prisma.assetArea.upsert({
      where: { assetId_areaId_relationshipType: { assetId: a.id, areaId: area.id, relationshipType: 'WITHIN' } },
      update: { verificationState: 'VERIFIED' },
      create: { assetId: a.id, areaId: area.id, relationshipType: 'WITHIN', verificationState: 'VERIFIED' },
    })
  }
  console.log('Linked assets to area:', cambsAssets.map((a) => a.slug).join(', '))

  const bySlug = (slug: string) => cambsAssets.find((a) => a.slug === slug)?.id ?? null

  // ---- SourceDocuments (provenance) ----
  const sdWfd = await prisma.sourceDocument.upsert({
    where: { id: 'sd-ea-wfd-cycle4-cam' },
    update: {},
    create: {
      id: 'sd-ea-wfd-cycle4-cam',
      publisher: 'Environment Agency',
      title: 'Water Framework Directive classification — Cam (GB105033042750)',
      url: 'https://environment.data.gov.uk/catchment-planning/WaterBody/GB105033042750',
      documentIdentifier: 'GB105033042750',
      documentType: 'WFD_CLASSIFICATION',
      jurisdiction: 'England',
      sourceTier: 'REGULATORY',
    },
    select: { id: true },
  })
  const sdEdm = await prisma.sourceDocument.upsert({
    where: { id: 'sd-ea-edm-cambs' },
    update: {},
    create: {
      id: 'sd-ea-edm-cambs',
      publisher: 'Environment Agency',
      title: 'Event Duration Monitoring (EDM) annual return — storm overflow spills',
      url: 'https://environment.data.gov.uk/',
      documentType: 'EDM_ANNUAL_RETURN',
      jurisdiction: 'England',
      sourceTier: 'REGULATORY',
    },
    select: { id: true },
  })

  // ---- §W: River Cam WFD identifier (GB105033042750) ----
  const riverCamId = bySlug('river-cam')
  if (riverCamId) {
    await prisma.assetIdentifier.upsert({
      where: { authority_identifierType_value: { authority: 'Environment Agency', identifierType: 'WFD_WATER_BODY_ID', value: 'GB105033042750' } },
      update: { assetId: riverCamId, verified: true, sourceDocumentId: sdWfd.id, sourceUrl: 'https://environment.data.gov.uk/catchment-planning/WaterBody/GB105033042750' },
      create: {
        assetId: riverCamId,
        authority: 'Environment Agency',
        identifierType: 'WFD_WATER_BODY_ID',
        value: 'GB105033042750',
        verified: true,
        sourceDocumentId: sdWfd.id,
        sourceUrl: 'https://environment.data.gov.uk/catchment-planning/WaterBody/GB105033042750',
      },
    })
    console.log('AssetIdentifier GB105033042750 -> river-cam')
  }

  // ---- §E: Milton/Cambridge WRC aliases (all resolve to one canonical asset) ----
  const miltonId = bySlug('milton-wrc')
  if (miltonId) {
    const aliases = ['Cambridge Water Recycling Centre', 'Cambridge WRC', 'Milton WRC', 'Cambridge (Milton) WRC']
    for (const alias of aliases) {
      const aliasNormalized = normalizeAlias(alias)
      await prisma.assetAlias.upsert({
        where: { assetId_aliasNormalized: { assetId: miltonId, aliasNormalized } },
        update: { alias, verificationState: 'VERIFIED' },
        create: { assetId: miltonId, alias, aliasNormalized, verificationState: 'VERIFIED' },
      })
    }
    console.log('Aliases attached to milton-wrc:', aliases.length)
  }

  // ---- §W: WFD Cycle 4 = AVAILABLE CORPUS (143 records), NOT a gap ----
  await prisma.datasetCoverage.upsert({
    where: { id: 'dc-wfd-cycle4-cambs' },
    update: {
      status: 'AVAILABLE',
      recordsAvailable: 143,
      areaId: area.id,
      methodology: 'WFD Cycle 4 classifications for water bodies in the Cambridgeshire scope. 143 water-body records are available and linked in the current scope. Availability of the corpus is recorded as coverage, not as an evidence gap.',
    },
    create: {
      id: 'dc-wfd-cycle4-cambs',
      datasetName: 'WFD Cycle 4 classifications (Cambridgeshire scope)',
      publisher: 'Environment Agency',
      jurisdiction: 'England',
      areaId: area.id,
      reportingPeriod: 'Cycle 4',
      sourceUrl: 'https://environment.data.gov.uk/catchment-planning/',
      status: 'AVAILABLE',
      recordsAvailable: 143,
      methodology: 'WFD Cycle 4 classifications for water bodies in the Cambridgeshire scope. 143 water-body records are available and linked in the current scope. Availability of the corpus is recorded as coverage, not as an evidence gap.',
    },
  })
  console.log('DatasetCoverage WFD Cycle 4 = AVAILABLE (143 records)')

  // ---- §W: EDM coverage = PARTIAL / METHOD_UNRESOLVED (Scout 178 vs CoS 216) ----
  await prisma.datasetCoverage.upsert({
    where: { id: 'dc-edm-cambs' },
    update: {
      status: 'PARTIAL',
      methodology: 'Storm-overflow / Event Duration Monitoring counts for the Cambridgeshire scope differ by method and neither is certified complete: Scout result = 178; Consent-of-Sewerage (CoS) result = 216. Coverage is PARTIAL / METHOD_UNRESOLVED — neither figure is treated as authoritative. Note on Isleham: absence from the current EDM filter means no storm/EO permit is represented in that filter, NOT that the asset is missing. Isleham carries official identifiers AN/AECNF10271/010 and AN/AECNF10271/009; associated CapEx is UNKNOWN and is not asserted.',
    },
    create: {
      id: 'dc-edm-cambs',
      datasetName: 'EDM / storm-overflow returns (Cambridgeshire scope)',
      publisher: 'Environment Agency',
      jurisdiction: 'England',
      areaId: area.id,
      sourceUrl: 'https://environment.data.gov.uk/',
      status: 'PARTIAL',
      recordsUnresolved: 216,
      methodology: 'Storm-overflow / Event Duration Monitoring counts for the Cambridgeshire scope differ by method and neither is certified complete: Scout result = 178; Consent-of-Sewerage (CoS) result = 216. Coverage is PARTIAL / METHOD_UNRESOLVED — neither figure is treated as authoritative. Note on Isleham: absence from the current EDM filter means no storm/EO permit is represented in that filter, NOT that the asset is missing. Isleham carries official identifiers AN/AECNF10271/010 and AN/AECNF10271/009; associated CapEx is UNKNOWN and is not asserted.',
    },
  })
  console.log('DatasetCoverage EDM = PARTIAL / METHOD_UNRESOLVED (178 vs 216)')

  // ---- §W: ASCNF1033 permit — genuine unresolved item ----
  const uq = await prisma.unresolvedQuestion.upsert({
    where: { id: 'uq-ascnf1033-cambs' },
    update: {
      status: 'OPEN',
      resolutionSummary: 'BioVeracity has not located the full permit document in the public sources reviewed.',
    },
    create: {
      id: 'uq-ascnf1033-cambs',
      areaId: area.id,
      title: 'Full permit condition for ASCNF1033',
      question: 'What is the full permit condition associated with ASCNF1033?',
      status: 'OPEN',
      materialityInternal: 'UNRESOLVED',
      resolutionSummary: 'BioVeracity has not located the full permit document in the public sources reviewed.',
    },
    select: { id: true },
  })
  await prisma.resolutionPath.upsert({
    where: { id: 'rp-ascnf1033-doc' },
    update: {
      description: 'Locate the full ASCNF1033 permit document from the Environment Agency public register.',
      evidenceType: 'REGULATORY_RECORD',
      status: 'IDENTIFIED',
    },
    create: {
      id: 'rp-ascnf1033-doc',
      unresolvedQuestionId: uq.id,
      evidenceType: 'REGULATORY_RECORD',
      description: 'Locate the full ASCNF1033 permit document from the Environment Agency public register.',
      priorityInternal: 'HIGH',
      status: 'IDENTIFIED',
    },
  })
  console.log('UnresolvedQuestion + ResolutionPath for ASCNF1033')

  console.log('Phase 1 Cambridgeshire §W seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
