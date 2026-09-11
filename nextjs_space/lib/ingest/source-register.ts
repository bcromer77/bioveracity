// Source registration for the ingestion-to-search connection.
//
// A retrieved record can only become searchable when it is associated with a
// source-register row carrying a genuine licence, required attribution and an
// explicit permitted-use list (see evidence-eligibility). This module resolves a
// register template from a source's authority and the licence string carried on
// the record. It never invents a licence: if the licence is unknown or not
// redistributable (e.g. non-commercial or no-derivatives), it returns null and
// the record is retained with provenance but stays out of public search.
//
// Licences established for the two Irish source families (verified 2026-09-11):
//  - NBDC species via GBIF: GBIF normalises occurrence licences to a controlled
//    vocabulary (CC0-1.0, CC-BY-4.0 or CC-BY-NC-4.0). CC0/CC-BY are registrable
//    and publishable with attribution; CC-BY-NC is non-commercial and returns
//    null (kept out of public search).
//  - Irish planning (ArcGIS org NzlPQPKn5QF9v2US / IrishPlanningApplications):
//    the identical service is published on data.gov.ie as the national
//    "IrishPlanningApplications" dataset by the Department of Housing, Local
//    Government and Heritage under CC-BY-4.0. The connector sets that licence.

export type SourceRegisterTemplate = {
  publisher: string
  datasetIdentifier: string
  licence: string
  licenceVersion?: string
  link?: string
  requiredAttribution: string
  permittedUses: string
  commercialUseConditions?: string
  spatialResolution?: string
  specificPermissions?: string
}

export type NormalisedLicence = { code: string; version: string | null }

// Normalise a raw licence string or URL to a controlled, redistributable code.
// Returns null for anything non-commercial, no-derivatives, unknown or empty so
// that only genuinely publishable material can ever be registered. Share-alike
// (CC-BY-SA) is redistributable with attribution and is preserved as such.
export function normaliseLicence(raw: string | null | undefined): NormalisedLicence | null {
  if (typeof raw !== 'string') return null
  // GBIF returns its `license` field as underscore-delimited enum values
  // (e.g. CC0_1_0, CC_BY_4_0, CC_BY_NC_4_0). Underscores are word characters, so
  // normalise them to hyphens before matching, otherwise `\bnc\b` and friends
  // silently fail and a non-commercial licence would wrongly pass.
  const s = raw.trim().toLowerCase().replace(/_/g, '-')
  if (!s) return null
  const versionMatch = s.match(/([1-4])[.-]0(?![0-9])/)
  const version = versionMatch ? `${versionMatch[1]}.0` : null
  // Public domain dedication.
  if (/cc0|creativecommons\.org\/publicdomain\/zero|(^|[^a-z])public\s*domain([^a-z]|$)/.test(s)) {
    return { code: 'CC0-1.0', version: '1.0' }
  }
  // Non-commercial or no-derivatives are not redistributable for public display here.
  if (/\bnc\b|by-nc|non-?commercial/.test(s)) return null
  if (/\bnd\b|by-nd|no-?deriv/.test(s)) return null
  // Attribution / attribution-share-alike.
  if (/cc-?by-?sa|by-sa|attribution-?sharealike|attribution share/.test(s)) {
    return { code: `CC-BY-SA-${version ?? '4.0'}`, version: version ?? '4.0' }
  }
  if (/cc-?by|creativecommons\.org\/licenses\/by(\/|$)|(^|[^a-z])attribution([^a-z]|$)/.test(s)) {
    return { code: `CC-BY-${version ?? '4.0'}`, version: version ?? '4.0' }
  }
  return null
}

// Resolve the register template for a record, or null when it must not be
// published. Register rows are shared per (publisher, dataset) so upserts are
// idempotent across counties and repeated retrievals.
export function resolveSourceRegister(opts: {
  authorityId: string
  publisher: string
  sourceLicence?: string | null
}): SourceRegisterTemplate | null {
  const norm = normaliseLicence(opts.sourceLicence)
  if (!norm) return null
  const authority = opts.authorityId.trim().toLowerCase()

  // NBDC species records (authority_id 'ie:nbdc'), published via GBIF.
  if (authority === 'ie:nbdc') {
    return {
      publisher: 'National Biodiversity Data Centre',
      datasetIdentifier: `gbif:nbdc:${norm.code.toLowerCase()}`,
      licence: norm.code,
      licenceVersion: norm.version ?? undefined,
      link: 'https://www.gbif.org/publisher/d2b97690-bfd6-11de-b279-d52977ace833',
      requiredAttribution: `National Biodiversity Data Centre, via GBIF (${norm.code})`,
      permittedUses: 'display,export',
      spatialResolution: 'County/year projection via GADM level-1 area; precise coordinates removed at intake.',
      specificPermissions: 'Public occurrence records; withheld or generalised records are excluded at intake.',
    }
  }

  // Irish planning application metadata. The connector assigns authority_id
  // 'ie:bioveracity:<county>-county-council' and carries the national dataset
  // licence established from data.gov.ie. One national register row is shared
  // across every county and planning authority.
  if (authority.startsWith('ie:bioveracity:') && authority.endsWith('-county-council')) {
    return {
      publisher: 'Department of Housing, Local Government and Heritage',
      datasetIdentifier: 'datagovie:irishplanningapplications',
      licence: norm.code,
      licenceVersion: norm.version ?? undefined,
      link: 'https://data.gov.ie/dataset/irishplanningapplications2',
      requiredAttribution: `Department of Housing, Local Government and Heritage — data.gov.ie (${norm.code})`,
      permittedUses: 'display,export',
      spatialResolution: 'Application metadata only (authority, reference, status, type); no geometry, applicant names or addresses.',
      specificPermissions: 'National planning-application dataset; authority match is explicit per county.',
    }
  }

  return null
}
