import { fingerprint } from '@/lib/v1/contract'
import type { EvidencePublic } from '@/lib/v1/service'

export const KERRY_PLACE_ID = 'bv_place_ie_kerry_tralee_bay'
export const KERRY_PLACE_SLUG = 'tralee-bay'
export const KERRY_SPA_AREA_ID = 'geo_npws_spa_004188'
export const KERRY_MANIFEST_SHA256 = '330ee5f6f6bae640ed2e8361441cd3f7fd14b3e577836d402c8c45c7e6241c43'
export const KERRY_001_EXTERNAL_ID = 'SPA:004188:datasheet:2023-10-17:boundary:3.03'
export const KERRY_SPA_ZIP_SHA256 = 'e5f1129cd794024badb270e3e344b6d8a71c0a85984f09e337d99633de0f6f76'
export const KERRY_BOUNDARY_RESPONSE_SHA256 = '5be5413e11e54da2c0d297fe95d22482e0e8fae0f273c5211c650579a13f894e'

export const NPWS_SPA_DATASET_URL = 'https://data.gov.ie/dataset/spa-datasheets'
export const NPWS_SPA_BOUNDARY_DATASET_URL = 'https://data.gov.ie/dataset/special-protection-areas'
export const NPWS_SPA_PAGE_URL = 'https://www.npws.ie/protected-sites/spa/004188'
export const NPWS_SPA_ZIP_URL = 'https://www.npws.ie/sites/default/files/files/SPA_datasheets_20231017.zip'
export const NPWS_SPA_BOUNDARY_QUERY_URL =
  "https://services-eu1.arcgis.com/Jhij7i46ouO8Cc0N/arcgis/rest/services/NPWSDesignatedAreas/FeatureServer/0/query?where=SITECODE%3D%27004188%27&outFields=*&returnGeometry=true&f=json"

const QI_NAMES: Record<string, string> = {
  A054: 'Anas acuta', A052: 'Anas crecca', A050: 'Anas penelope', A053: 'Anas platyrhynchos',
  A169: 'Arenaria interpres', A062: 'Aythya marila', A046: 'Branta bernicla hrota', A144: 'Calidris alba',
  A149: 'Calidris alpina', A137: 'Charadrius hiaticula', A179: 'Chroicocephalus ridibundus',
  A038: 'Cygnus cygnus', A130: 'Haematopus ostralegus', A182: 'Larus canus', A157: 'Limosa lapponica',
  A156: 'Limosa limosa', A160: 'Numenius arquata', A140: 'Pluvialis apricaria',
  A141: 'Pluvialis squatarola', A048: 'Tadorna tadorna', A162: 'Tringa totanus', A142: 'Vanellus vanellus',
}

// These are search vocabulary, not replacements for the NPWS source assertion.
// The canonical evidence keeps the exact scientific name and code from the
// licensed datasheet. Common/descriptive terms remain separately attributable
// representations and can be corrected without rewriting evidence.
export const KERRY_BIRD_TERMS: Record<string, string[]> = {
  A054: ['Pintail'],
  A052: ['Teal'],
  A050: ['Wigeon'],
  A053: ['Mallard'],
  A169: ['Turnstone'],
  A062: ['Scaup'],
  A046: ['Light-bellied Brent Goose'],
  A144: ['Sanderling'],
  A149: ['Dunlin'],
  A137: ['Ringed Plover'],
  A179: ['Black-headed Gull'],
  A038: ['Whooper Swan'],
  A130: ['Eurasian oystercatcher', 'Oystercatcher', 'black and white bird with a long orange beak'],
  A182: ['Common Gull'],
  A157: ['Bar-tailed Godwit'],
  A156: ['Black-tailed Godwit'],
  A160: ['Curlew'],
  A140: ['Golden Plover'],
  A141: ['Grey Plover'],
  A048: ['Shelduck'],
  A162: ['Redshank'],
  A142: ['Lapwing'],
}

type SourceRow = Record<string, unknown>
type KerryMetadata = {
  train: 'KERRY-001'
  manifest_sha256: string
  place_id: string
  place_label: string
  place_slug: string
  spatial_object_id: string
  relationship: 'DEFINES_PROTECTED_AREA'
}

export type Kerry001Record = {
  evidence: EvidencePublic
  metadata: KerryMetadata
  site: SourceRow
  mapping: SourceRow
  qualifyingInterests: SourceRow[]
  wetlandInterest: SourceRow
  boundary: { geometry: SourceRow; attributes: SourceRow; spatialReference: SourceRow }
  geometryHash: string
  versionKey: string
  retrievalTime: string
  sourceIndependenceKey: string
}

const object = (value: unknown, field: string): SourceRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`kerry_001_invalid:${field}`)
  return value as SourceRow
}

const string = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`kerry_001_invalid:${field}`)
  return value.trim()
}

const siteCode = (row: SourceRow): string => string(row['SITE CODE'], 'site_code')

export { normaliseMemoryTerm, stableMemoryId } from './memory-utils'

export function parseKerry001Evidence(evidence: EvidencePublic): Kerry001Record | null {
  const metadataRoot = evidence.metadata == null ? null : object(evidence.metadata, 'metadata')
  const placeMemory = metadataRoot?.place_memory
  if (placeMemory == null) return null // Other V1 records are unaffected.
  const metadata = object(placeMemory, 'metadata.place_memory') as KerryMetadata
  if (metadata.train !== 'KERRY-001') return null // Future source adapters dispatch independently.

  if (evidence.provider !== 'npws') throw new Error('kerry_001_invalid:provider')
  if (evidence.evidence_type !== 'protected_site_designation_snapshot') throw new Error('kerry_001_invalid:evidence_type')
  if (evidence.source_external_id !== KERRY_001_EXTERNAL_ID) throw new Error('kerry_001_invalid:source_external_id')
  if (evidence.publisher !== 'National Parks and Wildlife Service') throw new Error('kerry_001_invalid:publisher')
  if (evidence.source_url !== NPWS_SPA_PAGE_URL) throw new Error('kerry_001_invalid:source_url')
  if (evidence.observation_time !== null || evidence.publication_time !== null) {
    throw new Error('kerry_001_invalid:invented_time')
  }
  if (!evidence.retrieval_time) throw new Error('kerry_001_invalid:retrieval_time')
  if (
    metadata.manifest_sha256 !== KERRY_MANIFEST_SHA256 ||
    metadata.place_id !== KERRY_PLACE_ID ||
    metadata.place_slug !== KERRY_PLACE_SLUG ||
    metadata.spatial_object_id !== KERRY_SPA_AREA_ID ||
    metadata.relationship !== 'DEFINES_PROTECTED_AREA'
  ) throw new Error('kerry_001_invalid:place_metadata')

  const sourceData = object(evidence.source_data, 'source_data')
  const snapshot = object(sourceData.dataset_snapshot, 'source_data.dataset_snapshot')
  if (
    snapshot.datasheet_date !== '2023-10-17' ||
    snapshot.datasheet_zip_url !== NPWS_SPA_ZIP_URL ||
    snapshot.datasheet_zip_sha256 !== KERRY_SPA_ZIP_SHA256 ||
    snapshot.boundary_query_url !== NPWS_SPA_BOUNDARY_QUERY_URL ||
    snapshot.boundary_response_sha256 !== KERRY_BOUNDARY_RESPONSE_SHA256
  ) throw new Error('kerry_001_invalid:source_snapshot')
  const site = object(sourceData.site, 'source_data.site')
  const mapping = object(sourceData.mapping, 'source_data.mapping')
  const wetlandInterest = object(sourceData.wetland_interest, 'source_data.wetland_interest')
  if (!Array.isArray(sourceData.qualifying_interests)) throw new Error('kerry_001_invalid:qualifying_interests')
  const qualifyingInterests = sourceData.qualifying_interests.map((row, index) => object(row, `qualifying_interests.${index}`))
  if (qualifyingInterests.length !== 22) throw new Error('kerry_001_invalid:qualifying_interest_count')
  if ([site, mapping, wetlandInterest, ...qualifyingInterests].some((row) => siteCode(row) !== 'IE0004188')) {
    throw new Error('kerry_001_invalid:site_code')
  }
  const codes = qualifyingInterests.map((row) => string(row['SPECIES CODE'], 'species_code'))
  if (new Set(codes).size !== 22 || Object.keys(QI_NAMES).some((code) => !codes.includes(code))) {
    throw new Error('kerry_001_invalid:qualifying_interest_codes')
  }
  for (const row of qualifyingInterests) {
    const code = string(row['SPECIES CODE'], 'species_code')
    if (string(row['SPECIES NAME'], 'species_name') !== QI_NAMES[code]) {
      throw new Error('kerry_001_invalid:qualifying_interest_name')
    }
  }

  const geography = object(evidence.geography, 'geography')
  if (geography.kind !== 'source_polygon' || geography.admin_code !== '004188') throw new Error('kerry_001_invalid:geography')
  if (geography.crs !== 'EPSG:2157' || geography.geometry_format !== 'esri_json') throw new Error('kerry_001_invalid:crs')
  const boundary = object(geography.boundary_feature, 'geography.boundary_feature')
  const geometry = object(boundary.geometry, 'boundary.geometry')
  const attributes = object(boundary.attributes, 'boundary.attributes')
  // ArcGIS returns the source CRS once at the query-response level rather than
  // duplicating it inside each feature geometry. The preparation script keeps
  // the untouched feature geometry and carries that response-level object next
  // to it so neither the coordinates nor their reference system are inferred.
  const spatialReference = object(boundary.spatialReference ?? geometry.spatialReference, 'boundary.spatialReference')
  if (!Array.isArray(geometry.rings) || geometry.rings.length < 1 || spatialReference.wkid !== 2157) {
    throw new Error('kerry_001_invalid:boundary_geometry')
  }
  if (attributes.SITECODE !== '004188' || attributes.SITE_NAME !== 'Tralee Bay Complex SPA') {
    throw new Error('kerry_001_invalid:boundary_identity')
  }
  if (String(attributes.VERSION) !== '3.03' || mapping['Boundary Version(s)'] !== '3.03') {
    throw new Error('kerry_001_invalid:boundary_version')
  }

  const provenance = object(evidence.provenance, 'provenance')
  if (
    provenance.rights_class !== 'CLEARED_FOR_INGEST' ||
    provenance.licence !== 'CC BY 4.0' ||
    provenance.manifest_sha256 !== KERRY_MANIFEST_SHA256 ||
    provenance.datasheet_dataset_url !== NPWS_SPA_DATASET_URL ||
    provenance.boundary_dataset_url !== NPWS_SPA_BOUNDARY_DATASET_URL
  ) throw new Error('kerry_001_invalid:rights')
  string(provenance.attribution, 'provenance.attribution')

  const geometryHash = fingerprint(geometry)
  const versionKey = `npws-spa-004188:${String(attributes.VERSION)}:${geometryHash}`
  const sourceIndependenceKey = `npws:spa:004188:datasheet:2023-10-17:boundary:${String(attributes.VERSION)}`
  return {
    evidence,
    metadata,
    site,
    mapping,
    qualifyingInterests,
    wetlandInterest,
    boundary: { geometry, attributes, spatialReference },
    geometryHash,
    versionKey,
    retrievalTime: evidence.retrieval_time,
    sourceIndependenceKey,
  }
}
