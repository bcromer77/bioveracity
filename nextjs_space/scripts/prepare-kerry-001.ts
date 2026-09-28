// Build the proposed one-record KERRY-001 payload from the two reviewed NPWS
// CC BY 4.0 structured sources. This script only writes JSON locally/stdout. It
// has no API token input, SDK import, POST path, scheduler or backlog access.

import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import {
  KERRY_001_EXTERNAL_ID,
  KERRY_BOUNDARY_RESPONSE_SHA256,
  KERRY_MANIFEST_SHA256,
  KERRY_PLACE_ID,
  KERRY_PLACE_SLUG,
  KERRY_SPA_AREA_ID,
  KERRY_SPA_ZIP_SHA256,
  NPWS_SPA_BOUNDARY_DATASET_URL,
  NPWS_SPA_BOUNDARY_QUERY_URL,
  NPWS_SPA_DATASET_URL,
  NPWS_SPA_PAGE_URL,
  NPWS_SPA_ZIP_URL,
} from '../lib/place-memory/kerry-001'

const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')
const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index < 0 ? null : args[index + 1] ?? null
}

async function bounded(url: string, max: number): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: '*/*' } })
  if (!response.ok) throw new Error(`Source unavailable (${response.status})`)
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > max) throw new Error('Source response exceeds bound')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > max) throw new Error('Source response exceeds bound')
  return bytes
}

async function jsonFile(zip: JSZip, name: string): Promise<Record<string, Record<string, unknown>>> {
  const file = zip.file(name)
  if (!file) throw new Error(`Missing source member ${name}`)
  return JSON.parse(await file.async('string'))
}

async function main() {
  const retrievalTime = option('--retrieved-at') ?? new Date().toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(retrievalTime)) {
    throw new Error('--retrieved-at must be an RFC3339 UTC timestamp')
  }
  const output = option('--output')

  const [metadataBytes, boundaryMetadataBytes, zipBytes, boundaryBytes] = await Promise.all([
    bounded('https://data.gov.ie/api/3/action/package_show?id=spa-datasheets', 100_000),
    bounded('https://data.gov.ie/api/3/action/package_show?id=special-protection-areas', 150_000),
    bounded(NPWS_SPA_ZIP_URL, 2_000_000),
    bounded(NPWS_SPA_BOUNDARY_QUERY_URL, 1_000_000),
  ])
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes))
  const boundaryMetadata = JSON.parse(new TextDecoder().decode(boundaryMetadataBytes))
  if (metadata?.result?.license_id !== 'CC-BY-4.0') throw new Error('SPA datasheet licence is not the reviewed CC-BY-4.0')
  if (boundaryMetadata?.result?.license_id !== 'CC-BY-4.0') throw new Error('SPA boundary licence is not the reviewed CC-BY-4.0')
  if (sha256(zipBytes) !== KERRY_SPA_ZIP_SHA256 || sha256(boundaryBytes) !== KERRY_BOUNDARY_RESPONSE_SHA256) {
    throw new Error('Reviewed NPWS source snapshot changed; rights/content review is required before preparing KERRY-001')
  }
  const zip = await JSZip.loadAsync(zipBytes)
  const base = 'SPA/JSON/SPA_datasheets_October_2023_'
  const [birds, wetlands, sites, mappings] = await Promise.all([
    jsonFile(zip, `${base}Bird_SCI_Data.json`),
    jsonFile(zip, `${base}Wetland_SCI_Data.json`),
    jsonFile(zip, `${base}Site_Data.json`),
    jsonFile(zip, `${base}Site_Mapping_Data.json`),
  ])
  const rows = (data: Record<string, Record<string, unknown>>) => Object.values(data).filter((row) => row['SITE CODE'] === 'IE0004188')
  const qualifyingInterests = rows(birds)
  const wetland = rows(wetlands)
  const site = rows(sites)
  const mapping = rows(mappings)
  if (qualifyingInterests.length !== 22 || wetland.length !== 1 || site.length !== 1 || mapping.length !== 1) {
    throw new Error('NPWS SPA 004188 source cardinality changed; review before preparing cargo')
  }

  const boundary = JSON.parse(new TextDecoder().decode(boundaryBytes))
  if (boundary?.features?.length !== 1) throw new Error('NPWS boundary query did not return exactly one feature')
  const feature = boundary.features[0]
  if (feature?.attributes?.SITECODE !== '004188' || feature?.attributes?.SITE_NAME !== 'Tralee Bay Complex SPA') {
    throw new Error('NPWS boundary identity mismatch')
  }
  if (boundary?.spatialReference?.wkid !== 2157 || feature?.attributes?.VERSION !== 3.03) {
    throw new Error('NPWS boundary CRS/version changed; review before preparing cargo')
  }

  const payload = {
    provider: 'npws',
    source_external_id: KERRY_001_EXTERNAL_ID,
    evidence_type: 'protected_site_designation_snapshot',
    source_data: {
      dataset_snapshot: {
        datasheet_date: '2023-10-17',
        datasheet_zip_url: NPWS_SPA_ZIP_URL,
        datasheet_zip_sha256: KERRY_SPA_ZIP_SHA256,
        boundary_query_url: NPWS_SPA_BOUNDARY_QUERY_URL,
        boundary_response_sha256: KERRY_BOUNDARY_RESPONSE_SHA256,
      },
      site: site[0],
      mapping: mapping[0],
      qualifying_interests: qualifyingInterests,
      wetland_interest: wetland[0],
    },
    geography: {
      kind: 'source_polygon',
      name: 'Tralee Bay Complex SPA',
      admin_code: '004188',
      precision: 'source polygon at source scale 1:5000',
      geometry_format: 'esri_json',
      crs: 'EPSG:2157',
      source_crs: feature.attributes.Source_CRS,
      source_scale: feature.attributes.SourcScale,
      boundary_version: String(feature.attributes.VERSION),
      // Preserve the source feature exactly and retain the ArcGIS response-level
      // CRS beside it. No coordinate transformation or synthetic polygon occurs.
      boundary_feature: { ...feature, spatialReference: boundary.spatialReference },
    },
    // A designation is not an observation. Publication semantics for the source
    // DATE field are not asserted, so observation_time/publication_time remain absent.
    retrieval_time: retrievalTime,
    source_url: NPWS_SPA_PAGE_URL,
    publisher: 'National Parks and Wildlife Service',
    metadata: {
      place_memory: {
        train: 'KERRY-001',
        manifest_sha256: KERRY_MANIFEST_SHA256,
        place_id: KERRY_PLACE_ID,
        place_label: 'Tralee Bay, County Kerry',
        place_slug: KERRY_PLACE_SLUG,
        spatial_object_id: KERRY_SPA_AREA_ID,
        relationship: 'DEFINES_PROTECTED_AREA',
      },
      chronology_scope: 'current reference anchor; not an observation inside the 1995-2025 chronology',
    },
    provenance: {
      publisher: 'National Parks and Wildlife Service',
      licence: 'CC BY 4.0',
      rights_class: 'CLEARED_FOR_INGEST',
      attribution: 'National Parks and Wildlife Service / Government of Ireland, licensed CC BY 4.0',
      datasheet_dataset_url: NPWS_SPA_DATASET_URL,
      boundary_dataset_url: NPWS_SPA_BOUNDARY_DATASET_URL,
      manifest_sha256: KERRY_MANIFEST_SHA256,
      source_geometry_preserved: true,
      source_geometry_crs: 'EPSG:2157',
      source_scale_preserved: true,
      current_presence_not_asserted: true,
      abundance_not_asserted: true,
      condition_not_asserted: true,
    },
  }
  const rendered = `${JSON.stringify(payload, null, 2)}\n`
  if (Buffer.byteLength(rendered) > 900_000) throw new Error('Payload exceeds the reviewed V1 preparation bound')
  if (output) await writeFile(output, rendered, { encoding: 'utf8', flag: 'w' })
  else process.stdout.write(rendered)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'KERRY-001 preparation failed')
  process.exitCode = 1
})
