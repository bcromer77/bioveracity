import type { Database, Sql } from '@/lib/workspaces/service'
import type { PlaceMemoryProjectorAdapter } from './registry'
import {
  KERRY_BIRD_TERMS,
  KERRY_PLACE_ID,
  KERRY_PLACE_SLUG,
  KERRY_SPA_AREA_ID,
  NPWS_SPA_BOUNDARY_QUERY_URL,
  NPWS_SPA_DATASET_URL,
  normaliseMemoryTerm,
  parseKerry001Evidence,
  stableMemoryId,
  type Kerry001Record,
} from './kerry-001'

const json = (value: unknown) => JSON.stringify(value)

async function assertPlace(tx: Sql, record: Kerry001Record) {
  await tx.query(
    `INSERT INTO "Asset" (id,slug,name,type,subtype,region,"regionSlug",status,summary,jurisdiction,"updatedAt")
     VALUES ($1,$2,$3,'living_place','evidence_memory','kerry','kerry','active',$4,'Ireland',$5::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [KERRY_PLACE_ID, KERRY_PLACE_SLUG, record.metadata.place_label,
      'Logical evidence container; not a manufactured scientific or legal polygon.', record.retrievalTime],
  )
  const rows = await tx.query<{ id: string; slug: string; name: string; type: string }>(
    'SELECT id,slug,name,type FROM "Asset" WHERE id=$1', [KERRY_PLACE_ID],
  )
  const place = rows[0]
  if (!place || place.slug !== KERRY_PLACE_SLUG || place.name !== record.metadata.place_label || place.type !== 'living_place') {
    throw new Error('place_memory_conflict:place_identity')
  }
}

async function assertArea(tx: Sql, record: Kerry001Record) {
  await tx.query(
    `INSERT INTO "Area" (id,slug,name,type,jurisdiction,"officialIdentifier","sourceDocumentId",geometry,"createdAt","updatedAt")
     VALUES ($1,'npws-spa-004188','Tralee Bay Complex SPA','PROTECTED_AREA','Ireland','004188',NULL,NULL,$2::timestamptz,$2::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [KERRY_SPA_AREA_ID, record.retrievalTime],
  )
  const rows = await tx.query<{ id: string; officialIdentifier: string; name: string; type: string }>(
    'SELECT id,"officialIdentifier",name,type FROM "Area" WHERE id=$1', [KERRY_SPA_AREA_ID],
  )
  const area = rows[0]
  if (!area || area.officialIdentifier !== '004188' || area.name !== 'Tralee Bay Complex SPA' || area.type !== 'PROTECTED_AREA') {
    throw new Error('place_memory_conflict:spatial_identity')
  }
}

async function spatialVersion(tx: Sql, record: Kerry001Record): Promise<string> {
  const id = stableMemoryId('spv', KERRY_SPA_AREA_ID, record.versionKey)
  const a = record.boundary.attributes
  await tx.query(
    `INSERT INTO "PlaceSpatialVersion"
      (id,"areaId","platformEvidenceId","versionKey",geometry,"geometryFormat",crs,"sourceCrs","sourceScale",
       "spatialPrecision","effectiveFrom","effectiveTo","effectivePrecision","retrievedAt",publisher,dataset,
       "sourceExternalId","sourceUrl",licence,"rightsState","contentHash")
     VALUES ($1,$2,$3,$4,$5::jsonb,'esri_json','EPSG:2157',$6,$7,$8,NULL,NULL,'unknown',$9::timestamptz,
       'National Parks and Wildlife Service','NPWS Designated Areas — Special Protection Areas','SPA:004188',$10,
       'CC BY 4.0','CLEARED_FOR_INGEST',$11)
     ON CONFLICT ("areaId","versionKey") DO NOTHING`,
    [id, KERRY_SPA_AREA_ID, record.evidence.id, record.versionKey, json(record.boundary.geometry),
      String(a.Source_CRS ?? 'ITM'), String(a.SourcScale ?? '1:5000'),
      `source polygon; ${String(a.SourcScale ?? 'scale retained from source')}`,
      record.retrievalTime, NPWS_SPA_BOUNDARY_QUERY_URL, record.geometryHash],
  )
  const rows = await tx.query<{ id: string; contentHash: string; crs: string }>(
    'SELECT id,"contentHash",crs FROM "PlaceSpatialVersion" WHERE "areaId"=$1 AND "versionKey"=$2',
    [KERRY_SPA_AREA_ID, record.versionKey],
  )
  if (!rows[0] || rows[0].contentHash !== record.geometryHash || rows[0].crs !== 'EPSG:2157') {
    throw new Error('place_memory_conflict:spatial_version')
  }
  return rows[0].id
}

async function placeAreaRelation(tx: Sql, record: Kerry001Record, areaVersionId: string) {
  const id = stableMemoryId('par', KERRY_PLACE_ID, KERRY_SPA_AREA_ID, 'DEFINES_PROTECTED_AREA')
  await tx.query(
    `INSERT INTO "AssetArea"
      (id,"assetId","areaId","relationshipType","sourceDocumentId","verificationState","platformEvidenceId",
       "areaVersionId","relationBasis","relationMethod","calculatedAt",uncertainty)
     VALUES ($1,$2,$3,'DEFINES_PROTECTED_AREA',NULL,'SOURCE_BACKED',$4,$5,'SOURCE_ASSERTION',
       'Reviewed KERRY-001 manifest association; no geometry union or inferred containment',NULL,$6::jsonb)
     ON CONFLICT ("assetId","areaId","relationshipType") DO NOTHING`,
    [id, KERRY_PLACE_ID, KERRY_SPA_AREA_ID, record.evidence.id, areaVersionId,
      json({ note: 'Logical Living Place association; SPA geometry remains independent.' })],
  )
  const rows = await tx.query<{ platformEvidenceId: string | null; areaVersionId: string | null }>(
    'SELECT "platformEvidenceId","areaVersionId" FROM "AssetArea" WHERE "assetId"=$1 AND "areaId"=$2 AND "relationshipType"=$3',
    [KERRY_PLACE_ID, KERRY_SPA_AREA_ID, 'DEFINES_PROTECTED_AREA'],
  )
  if (!rows[0] || rows[0].areaVersionId !== areaVersionId) throw new Error('place_memory_conflict:place_area_relation')
}

async function memoryItem(tx: Sql, record: Kerry001Record, areaVersionId: string): Promise<string> {
  const id = stableMemoryId('mem', record.sourceIndependenceKey)
  await tx.query(
    `INSERT INTO "PlaceMemoryItem"
      (id,"itemKey","placeId","platformEvidenceId","spatialVersionId",kind,"evidenceClass",visibility,
       "rightsState","originalStatement","sourceIndependenceKey","eventStart","eventEnd","timePrecision",
       "timeBasis","geographyPrecision","locationDisclosure",uncertainty,status)
     VALUES ($1,'designation:SPA:004188',$2,$3,$4,'DESIGNATION','AUTHORITATIVE_STATUTORY','PUBLIC',
       'CLEARED_FOR_INGEST','Tralee Bay Complex SPA',$5,NULL,NULL,'unknown','source',$6,'NAMED_ONLY',$7::jsonb,'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [id, KERRY_PLACE_ID, record.evidence.id, areaVersionId, record.sourceIndependenceKey,
      `source polygon; ${String(record.boundary.attributes.SourcScale ?? 'scale retained from source')}`,
      json({
        designation_not_observation: true,
        current_presence_not_established: true,
        abundance_not_established: true,
        condition_not_established: true,
        observation_time_unknown: true,
        publication_time_unknown: true,
      })],
  )
  const rows = await tx.query<{ id: string; sourceIndependenceKey: string; platformEvidenceId: string }>(
    'SELECT id,"sourceIndependenceKey","platformEvidenceId" FROM "PlaceMemoryItem" WHERE id=$1', [id],
  )
  if (!rows[0] || rows[0].sourceIndependenceKey !== record.sourceIndependenceKey) {
    throw new Error('place_memory_conflict:memory_item')
  }
  const relationship = rows[0].platformEvidenceId === record.evidence.id ? 'PRIMARY' : 'SAME_UNDERLYING_RECORD'
  await tx.query(
    `INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey")
     VALUES ($1,$2,$3,$4) ON CONFLICT ("itemId","platformEvidenceId") DO NOTHING`,
    [id, record.evidence.id, relationship, record.sourceIndependenceKey],
  )
  return id
}

type EntityInput = {
  id: string
  kind: string
  label: string
  authority: string
  externalId: string
  relationType: string
  sourceAssertion: unknown
  terms: Array<{ term: string; language: string; termType: string; status: 'SOURCE' | 'CURATED'; provenance: unknown }>
}

function entities(record: Kerry001Record): EntityInput[] {
  const birds = record.qualifyingInterests.map((row) => {
    const code = String(row['SPECIES CODE'])
    const scientific = String(row['SPECIES NAME'])
    const source = { dataset: NPWS_SPA_DATASET_URL, source_row: row }
    return {
      id: `entity_npws_spa_bird_${code.toLowerCase()}`,
      kind: 'TAXON',
      label: scientific,
      authority: 'NPWS_SPA_SCI',
      externalId: code,
      relationType: 'QUALIFYING_INTEREST',
      sourceAssertion: row,
      terms: [
        { term: scientific, language: 'la', termType: 'SCIENTIFIC_NAME', status: 'SOURCE' as const, provenance: source },
        ...(KERRY_BIRD_TERMS[code] ?? []).map((term) => ({
          term,
          language: 'en',
          termType: term.includes('bird with') ? 'DESCRIPTION' : 'COMMON_NAME',
          status: 'CURATED' as const,
          provenance: {
            representation: 'BioVeracity controlled retrieval vocabulary',
            evidence_mutated: false,
            note: 'Search vocabulary only; it does not identify a new observation.',
          },
        })),
      ],
    }
  })
  return [...birds, {
    id: 'entity_npws_spa_wetland_ie0004188',
    kind: 'ECOLOGICAL_FEATURE',
    label: 'Wetland and waterbirds',
    authority: 'NPWS_SPA_WETLAND_SCI',
    externalId: 'IE0004188',
    relationType: 'QUALIFYING_INTEREST',
    sourceAssertion: record.wetlandInterest,
    terms: [{
      term: 'Wetland and waterbirds', language: 'en', termType: 'SOURCE_DATASET_LABEL', status: 'CURATED' as const,
      provenance: { dataset: NPWS_SPA_DATASET_URL, source_file: 'Wetland_SCI_Data' },
    }],
  }]
}

async function itemEntities(tx: Sql, record: Kerry001Record, itemId: string): Promise<string[]> {
  const allTerms: string[] = []
  for (const entity of entities(record)) {
    await tx.query(
      `INSERT INTO "PlaceMemoryEntity" (id,kind,"canonicalLabel",authority,"externalId",metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (id) DO NOTHING`,
      [entity.id, entity.kind, entity.label, entity.authority, entity.externalId,
        json({ evidence_role: 'qualifying_interest', current_presence_not_established: true })],
    )
    const rows = await tx.query<{ canonicalLabel: string; externalId: string | null }>(
      'SELECT "canonicalLabel","externalId" FROM "PlaceMemoryEntity" WHERE id=$1', [entity.id],
    )
    if (!rows[0] || rows[0].canonicalLabel !== entity.label || rows[0].externalId !== entity.externalId) {
      throw new Error('place_memory_conflict:entity')
    }
    for (const term of entity.terms) {
      const normalized = normaliseMemoryTerm(term.term)
      allTerms.push(term.term)
      await tx.query(
        `INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status,provenance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT ("entityId",language,normalized,"termType") DO NOTHING`,
        [stableMemoryId('term', entity.id, term.language, normalized, term.termType), entity.id, term.term,
          normalized, term.language, term.termType, term.status, json(term.provenance)],
      )
    }
    await tx.query(
      `INSERT INTO "PlaceMemoryItemEntity"
        ("itemId","entityId","relationType","assertionState","sourceAssertion",uncertainty)
       VALUES ($1,$2,$3,'SOURCE_ASSERTION',$4::jsonb,$5::jsonb)
       ON CONFLICT ("itemId","entityId","relationType","assertionState") DO NOTHING`,
      [itemId, entity.id, entity.relationType, json(entity.sourceAssertion),
        json({ qualifying_interest_not_current_observation: true })],
    )
  }
  return allTerms
}

async function searchDocument(tx: Sql, itemId: string, terms: string[]) {
  const content = [
    'Tralee Bay Complex SPA',
    'SPA 004188 IE0004188',
    'Special Protection Area designation',
    'qualifying interests protected birds important birds associated with Tralee Bay',
    'designation evidence not a current observation and not a statement of present-day abundance',
    ...terms,
  ].join('\n')
  await tx.query(
    `INSERT INTO "PlaceMemorySearchDocument"
      ("itemId",content,language,"representationVersion","conceptTerms")
     VALUES ($1,$2,'en','place-memory-search-v1',$3::jsonb)
     ON CONFLICT ("itemId") DO UPDATE SET content=EXCLUDED.content,
       "representationVersion"=EXCLUDED."representationVersion", "conceptTerms"=EXCLUDED."conceptTerms",
       "updatedAt"=CURRENT_TIMESTAMP`,
    [itemId, content, json(terms)],
  )
}

export async function projectKerry001(db: Database, record: Kerry001Record) {
  // Test credentials remain useful for transport qualification but can never
  // populate public Place Memory. A future private projection must have its own
  // explicit policy rather than treating test data as customer evidence.
  if (record.evidence.mode !== 'live') return { projected: false, reason: 'test_mode' as const }
  return db.transaction(async (tx) => {
    await assertPlace(tx, record)
    await assertArea(tx, record)
    const areaVersionId = await spatialVersion(tx, record)
    await placeAreaRelation(tx, record, areaVersionId)
    const itemId = await memoryItem(tx, record, areaVersionId)
    const terms = await itemEntities(tx, record, itemId)
    await searchDocument(tx, itemId, terms)
    return { projected: true, placeId: KERRY_PLACE_ID, areaVersionId, itemId, entityCount: 23 }
  })
}

export const kerry001ProjectionAdapter = Object.freeze({
  id: 'KERRY-001',
  adapt: parseKerry001Evidence,
  project: projectKerry001,
} satisfies PlaceMemoryProjectorAdapter<Kerry001Record>)
