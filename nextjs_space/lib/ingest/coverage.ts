// Canonical geographic source-coverage resolver.
//
// This is the ONE shared rule every venue/product type must consume to decide
// whether a data source can serve a place:
//
//   PLACE -> JURISDICTION -> AUTHORITY/REGION -> SOURCE REGISTRY
//         -> APPLICABLE CONNECTORS -> COVERAGE STATUS
//
// No product-specific service or UI may hard-code council names, jurisdictions or
// geographic pilot boxes. They resolve coverage here instead, so Ireland reuses the
// existing national/county planning registry rather than a parallel connector.
//
// Coverage is deliberately four-valued and never conflates "unavailable" with
// "absent": CONNECTED (a connector serves this place), PARTIAL (a connector serves
// part of it), UNAVAILABLE (no connector is wired for this place — a coverage gap,
// not evidence of absence) and ERROR (a wired connector was reached but retrieval
// did not complete — determined at retrieval time, not here).
import { getWildCounty } from '../wild-counties/counties'
import { COUNTIES, PLANNING_AUTHORITIES, PLANNING_LICENCE, type County } from './connectors-ireland'

export type CoverageStatus = 'CONNECTED' | 'PARTIAL' | 'UNAVAILABLE' | 'ERROR'
// The planned coverage a place resolves to. ERROR is a retrieval outcome, never a
// planned status, so it is excluded here.
export type PlannedCoverage = Exclude<CoverageStatus, 'ERROR'>
export type CoverageSource = 'planning' | 'epa'

export type ResolvedPlace = {
  countySlug: string | null
  // Human-readable administrative region (the county name), for provenance.
  region: string | null
  jurisdiction: string | null
}

export type SourceCoverage = {
  source: CoverageSource
  status: PlannedCoverage
  jurisdiction: string | null
  region: string | null
  authorities: string[]
  licence: string | null
  note: string
}

// PLACE -> JURISDICTION / REGION. A venue's county slug (stored on the hub profile)
// is resolved through the single shared county registry, never re-derived per product.
export function resolvePlace(countySlug: string | null | undefined): ResolvedPlace {
  if (!countySlug) return { countySlug: null, region: null, jurisdiction: null }
  const slug = countySlug.trim().toLowerCase()
  const county = getWildCounty(slug)
  if (!county) return { countySlug: slug, region: null, jurisdiction: null }
  return { countySlug: slug, region: county.name, jurisdiction: county.jurisdiction }
}

function irishCounty(place: ResolvedPlace): County | undefined {
  if (place.jurisdiction !== 'Ireland' || !place.countySlug) return undefined
  return COUNTIES.find((c) => c.toLowerCase() === place.countySlug)
}

// SOURCE REGISTRY -> APPLICABLE CONNECTORS -> COVERAGE STATUS for planning.
// Ireland reuses the national planning connector's own county->authority registry
// (PLANNING_AUTHORITIES) rather than returning UNAVAILABLE where that connector
// already serves the area. Multi-authority counties are honoured — a county is never
// assumed to equal a single council.
function planningCoverage(place: ResolvedPlace): SourceCoverage {
  const base = { source: 'planning' as const, jurisdiction: place.jurisdiction, region: place.region }
  const county = irishCounty(place)
  if (county) {
    const authorities = [...PLANNING_AUTHORITIES[county]]
    const label = authorities.length > 1
      ? `${authorities.length} planning authorities (${authorities.join(', ')})`
      : authorities[0]
    return {
      ...base,
      status: 'CONNECTED',
      authorities,
      licence: PLANNING_LICENCE,
      note: `Planning applications for ${county} are served by the national Irish planning connector covering ${label}. Records are retrieved within the club's agreed map area; where retrieval is incomplete it is reported as unavailable, never as an absence of applications.`,
    }
  }
  const where = place.region ?? place.countySlug ?? 'this area'
  return {
    ...base,
    status: 'UNAVAILABLE',
    authorities: [],
    licence: null,
    note: place.jurisdiction
      ? `No planning-application connector is currently wired for ${where} (${place.jurisdiction}). This is a coverage gap, not a statement that no planning applications exist here.`
      : `The venue has no resolved county, so no planning connector can be selected. This is a coverage gap, not a statement that no planning applications exist here.`,
  }
}

// EPA waterbody assessments are published nationwide for the Republic of Ireland,
// selected by the club's confirmed waterbody code — one national connector, not a
// per-authority one, so it is never duplicated per product.
function epaCoverage(place: ResolvedPlace): SourceCoverage {
  const base = { source: 'epa' as const, jurisdiction: place.jurisdiction, region: place.region, authorities: [] as string[] }
  if (place.jurisdiction === 'Ireland') {
    return {
      ...base,
      status: 'CONNECTED',
      licence: PLANNING_LICENCE,
      note: `EPA waterbody assessments are retrieved nationwide for the Republic of Ireland by the club's confirmed waterbody code. Where a period is not published it is reported as unavailable, never as an absence of assessment.`,
    }
  }
  const where = place.region ?? 'this area'
  return {
    ...base,
    status: 'UNAVAILABLE',
    licence: null,
    note: place.jurisdiction
      ? `EPA (Republic of Ireland) waterbody assessments do not cover ${where} (${place.jurisdiction}). This is a coverage gap, not a statement that the waterbody is unassessed.`
      : `The venue has no resolved county, so EPA waterbody coverage cannot be selected. This is a coverage gap, not a statement that the waterbody is unassessed.`,
  }
}

// The single resolver every product consumes.
export function resolveCoverage(countySlug: string | null | undefined, source: CoverageSource): SourceCoverage {
  const place = resolvePlace(countySlug)
  return source === 'planning' ? planningCoverage(place) : epaCoverage(place)
}
