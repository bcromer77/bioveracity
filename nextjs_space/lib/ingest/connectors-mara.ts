/** MARA GIS determination metadata, not the operative instrument or a compliance finding.
 * Server-side adapter only. It is not registered with a scheduler or public route.
 * Schema source: MARA's official Data Downloads -> determined applications service.
 * Exact project-to-register identifier mappings still require hosted acceptance.
 */
import { json, object, page, record, failure, safeReason } from './connectors-scotland'
import type { Options, ConnectorResult, EvidenceInput, RejectionNote } from './connectors-scotland'

export const MARA_DETERMINATIONS = 'https://services-eu1.arcgis.com/wTJ77B55ryKaMXuv/arcgis/rest/services/MARA_MAC_MUL_Determined_Applications/FeatureServer'
export type MaraSelection = { kind: 'MAC' | 'MUL'; reference: string }
const FIELDS = ['OBJECTID', 'MARA_FileRecordNumber', 'MARA_SiteReference',
  'MARA_AuthorisationStatus', 'MARA_AuthorisationType', 'MARA_StartDate', 'MARA_ExpiryDate'] as const
const TEXT_FIELDS = ['MARA_SiteReference', 'MARA_AuthorisationStatus', 'MARA_AuthorisationType'] as const
const DATE_FIELDS = ['MARA_StartDate', 'MARA_ExpiryDate'] as const
const COVERAGE = 'One bounded page of exact-reference MARA GIS register metadata only. No document contents or geometry. Empty or incomplete results do not establish absence of permission. Register dates and status are not legal applicability, commencement, compliance or delivery findings.'

export function maraSelection(value: unknown): MaraSelection {
  const input = object(value)
  if (input.kind !== 'MAC' && input.kind !== 'MUL') throw new Error('Invalid MARA selection')
  // Exact identifiers only: no company-name search, URL, wildcard or arbitrary SQL.
  if (typeof input.reference !== 'string' || !/^[A-Z0-9][A-Z0-9-]{3,63}$/.test(input.reference)) {
    throw new Error('Invalid MARA reference')
  }
  return { kind: input.kind, reference: input.reference }
}

function attributes(raw: unknown, reference: string): Record<string, unknown> {
  const a = object(object(raw).attributes)
  if (FIELDS.some(key => !Object.prototype.hasOwnProperty.call(a, key))) throw new Error('MARA schema changed')
  if (!Number.isSafeInteger(a.OBJECTID) || Number(a.OBJECTID) < 0) throw new Error('Missing source identity')
  if (a.MARA_FileRecordNumber !== reference) throw new Error('Unexpected MARA reference')
  for (const key of TEXT_FIELDS) {
    if (a[key] !== null && (typeof a[key] !== 'string' || String(a[key]).length > 500)) throw new Error('Invalid MARA field')
  }
  for (const key of DATE_FIELDS) {
    const v = a[key]
    if (v !== null && (typeof v !== 'number' || !Number.isSafeInteger(v) || !Number.isFinite(new Date(v).getTime()))) {
      throw new Error('Invalid MARA date')
    }
  }
  // Stable order and an explicit field projection: unrequested text/PII cannot enter a record.
  // Raw nullable register milliseconds are retained, not relabelled as an event/publication date.
  return Object.fromEntries(FIELDS.map(key => [key, a[key]]))
}

export async function fetchMaraDeterminationMetadata(selection: MaraSelection, options: Options = {}): Promise<ConnectorResult> {
  let source = 'mara-determination-metadata'
  try {
    const chosen = maraSelection(selection)
    source = `mara-${chosen.kind.toLowerCase()}:${chosen.reference}:metadata-v1`
    const { offset, limit } = page(options)
    const layer = chosen.kind === 'MAC' ? 0 : 1
    const params = new URLSearchParams({ f: 'json', where: `MARA_FileRecordNumber='${chosen.reference}'`,
      outFields: FIELDS.join(','), returnGeometry: 'false', orderByFields: 'OBJECTID ASC',
      resultOffset: String(offset), resultRecordCount: String(limit) })
    const data = object(await json(`${MARA_DETERMINATIONS}/${layer}/query?${params}`, options))
    if (!Array.isArray(data.features) || data.features.length > limit) throw new Error('Invalid MARA page')
    if (data.exceededTransferLimit !== undefined && typeof data.exceededTransferLimit !== 'boolean') throw new Error('Invalid MARA cursor')
    if (data.exceededTransferLimit === true && data.features.length === 0) throw new Error('MARA pagination did not advance')
    const records: EvidenceInput[] = [], rejections: RejectionNote[] = [], seen = new Set<number>()
    const retrieved = (options.now?.() ?? new Date()).toISOString()
    for (const feature of data.features) {
      try {
        const a = attributes(feature, chosen.reference), oid = Number(a.OBJECTID)
        if (seen.has(oid)) throw new Error('Duplicate MARA feature')
        seen.add(oid)
        const locator = `mara:${layer}:${oid}:metadata-v1`
        const sourceQuery = new URLSearchParams({ f: 'json', objectIds: String(oid), outFields: FIELDS.join(','), returnGeometry: 'false' })
        const r = record(`${MARA_DETERMINATIONS}/${layer}/query?${sourceQuery}`,
          `MARA ${chosen.kind} register metadata: ${chosen.reference}`, 'Maritime Area Regulatory Authority',
          'ie:mara', locator, a, retrieved)
        r.jurisdiction = 'Republic of Ireland'
        // record() defaults acquisition_permitted to false. No reuse licence is inferred from
        // an empty copyright field, nor is a public map an approved project evidence finding.
        records.push(r)
      } catch (error) {
        rejections.push({ locator: null, reason: safeReason(error) })
      }
    }
    return { source, coverage: COVERAGE, status: rejections.length ? 'partial' : 'ok', records,
      rejected: rejections.length, rejections, nextOffset: data.exceededTransferLimit === true ? offset + limit : null }
  } catch (error) { return failure(source, COVERAGE, error) }
}

/** Call this from a protected job/route, never from an unauthenticated browser.
 * The resolver must check fresh identity, case access AND any time-limited grant,
 * then return the operator-approved, server-stored source selection for that case.
 * A client cannot choose a URL, reference, workspace or actor through this helper.
 * This seam does not itself implement the resolver or the future HTTP endpoint.
 */
export async function fetchMaraForAuthorisedCase(
  resolveAuthorisedSelection: () => Promise<MaraSelection>, options: Options = {},
): Promise<ConnectorResult> {
  const selection = await resolveAuthorisedSelection()
  return fetchMaraDeterminationMetadata(selection, options)
}
