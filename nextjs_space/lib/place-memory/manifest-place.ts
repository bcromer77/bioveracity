// Generic Place Memory projector for reviewed Place manifests (PILOT-001).
// Replaces the need for a code-registered, Place-specific projector: every
// evidence record is checked field-by-field against the committed manifest and
// only then projected. Place-neutral — no individual Place is named here.

import type { EvidencePublic } from '@/lib/v1/service'
import type { Database, Sql } from '@/lib/workspaces/service'
import { PLACE_MANIFESTS } from '@/data/places'
import { normaliseMemoryTerm, stableMemoryId } from './memory-utils'
import {
  PLACE_MANIFEST_TRAIN,
  manifestSource,
  type PlaceManifestItem,
  type PlaceManifestSource,
  type ValidatedPlaceManifest,
} from './place-manifest'
import type { PlaceMemoryProjectorAdapter } from './registry'

export type ManifestPlaceRecord = {
  evidence: EvidencePublic
  manifest: ValidatedPlaceManifest
  item: PlaceManifestItem
  source: PlaceManifestSource
  sourceIndependenceKey: string
}

const json = (value: unknown) => JSON.stringify(value)
const fail = (field: string): never => { throw new Error(`place_manifest_evidence_invalid:${field}`) }
const obj = (v: unknown, f: string): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(f)
const sameInstant = (a: string | null, b: string) => a != null && Date.parse(a) === Date.parse(b)

export function parseManifestPlaceEvidence(
  evidence: EvidencePublic,
  manifests: readonly ValidatedPlaceManifest[] = PLACE_MANIFESTS,
): ManifestPlaceRecord | null {
  if (evidence.metadata == null) return null
  const root = obj(evidence.metadata, 'metadata')
  if (root.place_memory == null) return null
  const meta = obj(root.place_memory, 'metadata.place_memory')
  if (meta.train !== PLACE_MANIFEST_TRAIN) return null // other adapters dispatch independently

  const manifest = manifests.find((m) => m.place.id === meta.place_id) ?? fail('place_id')
  if (meta.manifest_sha256 !== manifest.sha256) fail('manifest_sha256')
  const item = manifest.items.find((i) => i.item_key === meta.item_key) ?? fail('item_key')
  const source = manifestSource(manifest, item)

  if (evidence.provider !== source.provider) fail('provider')
  if (evidence.evidence_type !== item.evidence_type) fail('evidence_type')
  if (evidence.source_external_id !== item.source_external_id) fail('source_external_id')
  if (evidence.publisher !== source.publisher) fail('publisher')
  if (evidence.source_url !== source.url) fail('source_url')
  // Designation and descriptive records carry no observation or publication
  // instant; one may never be invented to populate a timeline.
  if (evidence.observation_time !== null || evidence.publication_time !== null) fail('invented_time')
  if (!sameInstant(evidence.retrieval_time, source.retrieved_at)) fail('retrieval_time')

  const data = obj(evidence.source_data, 'source_data')
  if (data.statement !== item.statement) fail('statement')
  if (data.source_sha256 !== source.sha256) fail('source_sha256')

  const prov = obj(evidence.provenance, 'provenance')
  if (
    prov.rights_class !== 'CLEARED_FOR_INGEST' ||
    prov.licence !== source.licence ||
    prov.attribution !== source.attribution ||
    prov.manifest_sha256 !== manifest.sha256
  ) fail('rights')

  return {
    evidence, manifest, item, source,
    sourceIndependenceKey: `${source.provider}:${item.source_external_id}:${source.sha256.slice(0, 16)}`,
  }
}

async function assertPlace(tx: Sql, record: ManifestPlaceRecord) {
  const p = record.manifest.place
  await tx.query(
    `INSERT INTO "Asset" (id,slug,name,type,subtype,region,"regionSlug",status,summary,jurisdiction,"updatedAt")
     VALUES ($1,$2,$3,'living_place','evidence_memory',$4,$5,'active',$6,$7,$8::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [p.id, p.slug, p.label, p.region, p.region_slug, p.summary, p.jurisdiction, record.source.retrieved_at],
  )
  const rows = await tx.query<{ slug: string; name: string; type: string }>(
    'SELECT slug,name,type FROM "Asset" WHERE id=$1', [p.id],
  )
  const place = rows[0]
  if (!place || place.slug !== p.slug || place.name !== p.label || place.type !== 'living_place') {
    throw new Error('place_memory_conflict:place_identity')
  }
}

async function memoryItem(tx: Sql, record: ManifestPlaceRecord): Promise<string> {
  const { item, evidence, sourceIndependenceKey } = record
  const id = stableMemoryId('mem', record.manifest.place.id, item.item_key)
  await tx.query(
    `INSERT INTO "PlaceMemoryItem"
      (id,"itemKey","placeId","platformEvidenceId","spatialVersionId",kind,"evidenceClass",visibility,
       "rightsState","originalStatement","sourceIndependenceKey","eventStart","eventEnd","timePrecision",
       "timeBasis","geographyPrecision","locationDisclosure",uncertainty,status)
     VALUES ($1,$2,$3,$4,NULL,$5,'AUTHORITATIVE_STATUTORY','PUBLIC','CLEARED_FOR_INGEST',$6,$7,NULL,NULL,
       'unknown','source',NULL,'NAMED_ONLY',$8::jsonb,'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [id, item.item_key, record.manifest.place.id, evidence.id, item.kind, item.statement, sourceIndependenceKey,
      json(Object.fromEntries(item.uncertainty.map((flag) => [flag, true])))],
  )
  const rows = await tx.query<{ originalStatement: string; placeId: string; platformEvidenceId: string }>(
    'SELECT "originalStatement","placeId","platformEvidenceId" FROM "PlaceMemoryItem" WHERE id=$1', [id],
  )
  if (!rows[0] || rows[0].originalStatement !== item.statement || rows[0].placeId !== record.manifest.place.id) {
    throw new Error('place_memory_conflict:memory_item')
  }
  const relationship = rows[0].platformEvidenceId === evidence.id ? 'PRIMARY' : 'SAME_UNDERLYING_RECORD'
  await tx.query(
    `INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey")
     VALUES ($1,$2,$3,$4) ON CONFLICT ("itemId","platformEvidenceId") DO NOTHING`,
    [id, evidence.id, relationship, sourceIndependenceKey],
  )
  return id
}

const CURATED_PROVENANCE = Object.freeze({
  representation: 'BioVeracity controlled retrieval vocabulary',
  evidence_mutated: false,
  note: 'Search vocabulary only; it does not identify a new observation.',
})

async function itemEntities(tx: Sql, record: ManifestPlaceRecord, itemId: string): Promise<string[]> {
  const allTerms: string[] = []
  const sourceProvenance = { source_url: record.source.url, source_sha256: record.source.sha256, locator: record.item.source_locator }
  for (const entity of record.item.entities) {
    const entityId = stableMemoryId('entity', entity.authority, entity.external_id)
    await tx.query(
      `INSERT INTO "PlaceMemoryEntity" (id,kind,"canonicalLabel",authority,"externalId",metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (id) DO NOTHING`,
      [entityId, entity.kind, entity.label, entity.authority, entity.external_id,
        json({ evidence_role: 'qualifying_interest', current_presence_not_established: true })],
    )
    const rows = await tx.query<{ canonicalLabel: string; externalId: string | null }>(
      'SELECT "canonicalLabel","externalId" FROM "PlaceMemoryEntity" WHERE id=$1', [entityId],
    )
    if (!rows[0] || rows[0].canonicalLabel !== entity.label || rows[0].externalId !== entity.external_id) {
      throw new Error('place_memory_conflict:entity')
    }
    const terms = [
      { term: entity.label, language: entity.kind === 'TAXON' ? 'la' : 'en',
        termType: entity.kind === 'TAXON' ? 'SCIENTIFIC_NAME' : 'SOURCE_LABEL', status: 'SOURCE', provenance: sourceProvenance },
      ...entity.source_terms.map((term) => ({ term, language: 'en', termType: 'COMMON_NAME', status: 'SOURCE', provenance: sourceProvenance })),
      ...entity.curated_terms.map((term) => ({ term, language: 'en', termType: 'COMMON_NAME', status: 'CURATED', provenance: CURATED_PROVENANCE })),
    ]
    for (const term of terms) {
      const normalized = normaliseMemoryTerm(term.term)
      allTerms.push(term.term)
      await tx.query(
        `INSERT INTO "PlaceMemoryTerm" (id,"entityId",term,normalized,language,"termType",status,provenance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT ("entityId",language,normalized,"termType") DO NOTHING`,
        [stableMemoryId('term', entityId, term.language, normalized, term.termType), entityId, term.term,
          normalized, term.language, term.termType, term.status, json(term.provenance)],
      )
    }
    await tx.query(
      `INSERT INTO "PlaceMemoryItemEntity"
        ("itemId","entityId","relationType","assertionState","sourceAssertion",uncertainty)
       VALUES ($1,$2,'QUALIFYING_INTEREST','SOURCE_ASSERTION',$3::jsonb,$4::jsonb)
       ON CONFLICT ("itemId","entityId","relationType","assertionState") DO NOTHING`,
      [itemId, entityId, json({ code: entity.external_id, label: entity.label, assertion: entity.source_assertion }),
        json({ qualifying_interest_not_current_observation: true })],
    )
  }
  return allTerms
}

async function searchDocument(tx: Sql, record: ManifestPlaceRecord, itemId: string, terms: string[]) {
  const content = [record.item.statement, record.manifest.place.label, ...record.item.search_terms, ...terms].join('\n')
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

export async function projectManifestPlace(db: Database, record: ManifestPlaceRecord) {
  // Test-mode credentials can never populate public Place Memory.
  if (record.evidence.mode !== 'live') return { projected: false, reason: 'test_mode' as const }
  return db.transaction(async (tx) => {
    await assertPlace(tx, record)
    const itemId = await memoryItem(tx, record)
    const terms = await itemEntities(tx, record, itemId)
    await searchDocument(tx, record, itemId, terms)
    return { projected: true, placeId: record.manifest.place.id, itemId, entityCount: record.item.entities.length }
  })
}

export const manifestPlaceProjectionAdapter = Object.freeze({
  id: PLACE_MANIFEST_TRAIN,
  adapt: (evidence: EvidencePublic) => parseManifestPlaceEvidence(evidence),
  project: projectManifestPlace,
} satisfies PlaceMemoryProjectorAdapter<ManifestPlaceRecord>)
