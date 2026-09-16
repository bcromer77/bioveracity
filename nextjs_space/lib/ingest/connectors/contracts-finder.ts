/**
 * Contracts Finder OCDS connector (zero-token public ingestion).
 *
 * Fetches published UK procurement notices from the Contracts Finder Open
 * Contracting Data Standard (OCDS) search endpoint and transforms each release
 * into a retained evidence record for the canonical ingestion pipeline. Only
 * real, fetched OCDS values are transformed — nothing is invented. Data is
 * published under the Open Government Licence v3.0, so acquisition is permitted.
 *
 * Endpoint (documented, GET, JSON):
 *   https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search
 *   params: publishedFrom, publishedTo, stages (planning|tender|award|implementation),
 *           limit (default 100), cursor (pagination).
 * Individual release citation:
 *   https://www.contractsfinder.service.gov.uk/Published/Notice/Releases/{ocid}.json
 *
 * The connector is importable and testable with an injected `fetcher`; it does
 * not run any live scrape loops on import. Callers submit the returned evidence
 * records to /api/ingest/evidence (x-bioveracity-evidence-key). Canonical
 * opportunity creation still requires the downstream verified-evidence step —
 * this connector never auto-publishes.
 */
import { object, id, record } from '../connectors-scotland'
import type { ConnectorResult, EvidenceInput, Options } from '../connectors-scotland'

export const CONTRACTS_FINDER_SEARCH = 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search'
export const CONTRACTS_FINDER_RELEASE = 'https://www.contractsfinder.service.gov.uk/Published/Notice/Releases'
const OGL_LICENCE = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
const MAX_BYTES = 4 * 1024 * 1024

export type ContractsFinderOptions = Options & {
  /** OCDS stages to include; defaults to award + tender notices. */
  stages?: Array<'planning' | 'tender' | 'award' | 'implementation'>
  /** ISO 8601 lower bound for the publication window. */
  publishedFrom?: string
  /** ISO 8601 upper bound for the publication window. */
  publishedTo?: string
  /** Opaque pagination cursor returned by a previous page (links.next). */
  cursor?: string
}

/** Bounded JSON fetch mirroring the shared source reader (size-capped, timed out, no redirects). */
async function fetchJson(url: string, options: Options): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  // Contracts Finder's OCDS Search endpoint is legitimately slow (observed ~22s
  // for a small page), so allow a generous ceiling before aborting.
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await (options.fetcher ?? fetch)(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    if (res.status === 403 || res.status === 429) throw new Error('Upstream rate limit; honour Retry-After before retrying')
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Empty source response')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Source response too large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let at = 0
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
    return object(JSON.parse(new TextDecoder().decode(bytes)))
  } finally {
    clearTimeout(timer)
  }
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 300) : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Collect deduplicated postcodes from the addresses present in a release. */
function extractPostcodes(release: Record<string, unknown>): string[] {
  const found = new Set<string>()
  const push = (value: unknown) => {
    const code = str(value)
    if (code) found.add(code.toUpperCase())
  }
  const parties = Array.isArray(release.parties) ? release.parties : []
  for (const party of parties) {
    if (party && typeof party === 'object') {
      const address = (party as Record<string, unknown>).address
      if (address && typeof address === 'object') push((address as Record<string, unknown>).postalCode)
    }
  }
  const tender = release.tender && typeof release.tender === 'object' ? (release.tender as Record<string, unknown>) : null
  const items = tender && Array.isArray(tender.items) ? tender.items : []
  for (const item of items) {
    if (item && typeof item === 'object') {
      const addresses = (item as Record<string, unknown>).deliveryAddresses
      if (Array.isArray(addresses)) for (const a of addresses) {
        if (a && typeof a === 'object') push((a as Record<string, unknown>).postalCode)
      }
    }
  }
  return [...found].slice(0, 25)
}

/** Transform one OCDS release into the retained structured subset (real values only). */
function transform(release: Record<string, unknown>, retrieved: string): EvidenceInput {
  const ocid = id(release.ocid)
  const tender = release.tender && typeof release.tender === 'object' ? (release.tender as Record<string, unknown>) : {}
  const buyer = release.buyer && typeof release.buyer === 'object' ? (release.buyer as Record<string, unknown>) : {}
  const tenderValue = tender.value && typeof tender.value === 'object' ? (tender.value as Record<string, unknown>) : {}
  const tags = Array.isArray(release.tag) ? release.tag.filter((t): t is string => typeof t === 'string') : []
  const awards = Array.isArray(release.awards) ? release.awards : []

  // First award with a named supplier drives the award badge downstream.
  let awardedSupplierName: string | null = null
  let awardedSupplierId: string | null = null
  let awardedValue: number | null = null
  let awardDate: string | null = null
  for (const award of awards) {
    if (!award || typeof award !== 'object') continue
    const a = award as Record<string, unknown>
    const suppliers = Array.isArray(a.suppliers) ? a.suppliers : []
    const first = suppliers.find((s) => s && typeof s === 'object') as Record<string, unknown> | undefined
    if (first) {
      awardedSupplierName = str(first.name)
      awardedSupplierId = str(first.id)
    }
    const value = a.value && typeof a.value === 'object' ? (a.value as Record<string, unknown>) : {}
    awardedValue = finiteNumber(value.amount)
    awardDate = str(a.date)
    if (awardedSupplierName) break
  }

  const title = str(tender.title) || `Contracts Finder notice ${ocid}`
  const eventDay = /^\d{4}-\d{2}-\d{2}/.test(awardDate || '') ? (awardDate as string).slice(0, 10)
    : /^\d{4}-\d{2}-\d{2}/.test(str(release.date) || '') ? (str(release.date) as string).slice(0, 10)
    : null

  // Retained subset: only fields extracted from the real release.
  const selected = {
    ocid,
    stages: tags,
    title,
    buyerName: str(buyer.name),
    tenderValueAmount: finiteNumber(tenderValue.amount),
    tenderValueCurrency: str(tenderValue.currency),
    awardedSupplierName,
    awardedSupplierId,
    awardedValue,
    awardedValueCurrency: str((awards[0] as Record<string, unknown>)?.value && typeof (awards[0] as Record<string, unknown>).value === 'object' ? ((awards[0] as Record<string, unknown>).value as Record<string, unknown>).currency : null),
    postcodes: extractPostcodes(release),
    releaseDate: str(release.date),
  }

  const url = `${CONTRACTS_FINDER_RELEASE}/${encodeURIComponent(ocid)}.json`
  const r = record(url, `Contracts Finder: ${title}`.slice(0, 200), 'Crown Commercial Service', 'uk:contracts-finder', `contracts-finder:${ocid}`, selected, retrieved, eventDay)
  r.jurisdiction = 'United Kingdom'
  r.acquisition_permitted = true
  r.source_licence = OGL_LICENCE
  return r
}

export async function fetchContractsFinderOcds(options: ContractsFinderOptions = {}): Promise<ConnectorResult> {
  const source = 'contracts-finder-ocds'
  const coverage = 'Bounded page of Contracts Finder OCDS award and tender notices (Open Government Licence v3.0). Not the full national notice set; cursor-paginated by the caller.'
  try {
    const limit = options.limit ?? 20
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid page limit')
    const stages = options.stages && options.stages.length ? options.stages : ['award', 'tender']
    const params = new URLSearchParams({ stages: stages.join(','), limit: String(limit) })
    if (options.publishedFrom) params.set('publishedFrom', options.publishedFrom)
    if (options.publishedTo) params.set('publishedTo', options.publishedTo)
    if (options.cursor) params.set('cursor', options.cursor)
    const data = await fetchJson(`${CONTRACTS_FINDER_SEARCH}?${params}`, options)
    if (data.error || data.errors) throw new Error('Upstream API error')

    // The OCDS Search endpoint returns a single release package with a top-level
    // `releases` array. Some mirrors/older shapes instead return `results` as an
    // array of packages (each { releases: [...] }) or of bare releases. Handle all
    // three defensively so live and archived responses both extract correctly.
    const results = Array.isArray(data.results) ? data.results
      : Array.isArray(data.releases) ? [data]
      : []
    const now = (options.now?.() ?? new Date()).toISOString()
    const records: EvidenceInput[] = []
    let rejected = 0
    for (const entry of results.slice(0, limit)) {
      try {
        const pkg = object(entry)
        const releases = Array.isArray(pkg.releases) ? pkg.releases : [pkg]
        for (const release of releases) records.push(transform(object(release), now))
      } catch {
        rejected++
      }
    }

    const next = data.links && typeof data.links === 'object' ? (data.links as Record<string, unknown>).next : null
    const hasMore = typeof next === 'string' && next.trim().length > 0
    return {
      source,
      coverage,
      status: rejected ? 'partial' : 'ok',
      records,
      rejected,
      // Pagination is cursor-based upstream; nextOffset is not an offset chain.
      nextOffset: hasMore ? (options.offset ?? 0) + limit : null,
    }
  } catch (error) {
    return { source, coverage, status: 'error', records: [], rejected: 0, nextOffset: null, error: error instanceof Error ? error.message : 'error' }
  }
}
