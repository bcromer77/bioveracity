// Guarded trigger for the standalone acquisition connectors (UK Contracts
// Finder OCDS + Modern.Gov committee RSS). Designed to be called by a platform
// scheduled task on a recurring interval.
//
// Integrity guarantees, unchanged from the rest of the intake:
//  - Nothing runs without a valid INGEST_CRON_SECRET (Bearer header or ?key=).
//  - Nothing is WRITTEN unless CONNECTOR_WRITE_ENABLED === 'true'. Without it the
//    run still fetches and reports counts (a dry run) but persists nothing.
//  - Records flow through the same validated receiveEvidence() path as every
//    other source. Source intake is NEVER automatic verification or publication;
//    licence-unknown material (e.g. committee signals) stays catalogue-only.

import { timingSafeEqual } from 'node:crypto'
import { receiveEvidence } from '@/lib/evidence-store'
import { validCronKey } from '@/lib/ingest/scotland-pipeline'
import { fetchContractsFinderOcds } from '@/lib/ingest/connectors/contracts-finder'
import { fetchModGovCommitteeSignals } from '@/lib/ingest/connectors/modgov-rss'
import type { ConnectorResult } from '@/lib/ingest/connectors-scotland'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Accept the secret either as `Authorization: Bearer <secret>` (matching the
// existing cron pattern) or as a `?key=<secret>` query param, both constant-time.
function authorised(request: Request): boolean {
  const secret = process.env.INGEST_CRON_SECRET
  if (validCronKey(request.headers.get('authorization'), secret)) return true
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) return false
  const provided = new URL(request.url).searchParams.get('key')
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(request: Request): Promise<Response> {
  if (!authorised(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })

  const writeEnabled = process.env.CONNECTOR_WRITE_ENABLED === 'true'
  const results: ConnectorResult[] = []

  // UK Contracts Finder OCDS (Open Government Licence v3.0) — a bounded page.
  results.push(await fetchContractsFinderOcds({ limit: 20 }))

  // Modern.Gov committee RSS feeds are configured, not guessed. Each configured
  // https feed is fetched; if none are configured the connector is skipped and
  // reported honestly rather than pointed at a fabricated URL.
  const feeds = (process.env.MODGOV_FEED_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const feed of feeds) results.push(await fetchModGovCommitteeSignals(feed))

  let created = 0
  let duplicates = 0
  let catalogueOnly = 0
  let failedWrites = 0
  let rejected = 0
  let totalFetched = 0
  const sources: Array<Record<string, unknown>> = []

  for (const r of results) {
    rejected += r.rejected
    totalFetched += r.records.length
    let srcCreated = 0
    let srcDuplicates = 0
    let srcCatalogueOnly = 0
    let srcFailedWrites = 0

    if (writeEnabled) {
      for (const record of r.records) {
        try {
          const out = await receiveEvidence(record)
          if (out.duplicate) {
            duplicates++
            srcDuplicates++
          } else {
            created++
            srcCreated++
            if (record.acquisition_permitted !== true) {
              catalogueOnly++
              srcCatalogueOnly++
            }
          }
        } catch {
          failedWrites++
          srcFailedWrites++
        }
      }
    }

    sources.push({
      source: r.source,
      status: r.status,
      coverage: r.coverage,
      fetched: r.records.length,
      rejected: r.rejected,
      created: srcCreated,
      duplicates: srcDuplicates,
      catalogueOnly: srcCatalogueOnly,
      failedWrites: srcFailedWrites,
      error: r.error ?? null,
    })
  }

  const incomplete = failedWrites > 0 || results.some((r) => r.status !== 'ok')
  return Response.json(
    {
      success: !incomplete,
      writeEnabled,
      writesAcknowledged: writeEnabled,
      triggeredAt: new Date().toISOString(),
      modGovFeedsConfigured: feeds.length,
      totalFetched,
      created,
      duplicates,
      catalogueOnly,
      failedWrites,
      rejected,
      meaning:
        'Source intake only — never automatic verification or publication. With CONNECTOR_WRITE_ENABLED unset the run fetches and reports but writes nothing (dry run). Modern.Gov committee signals are catalogue-only unless a redistributable licence is resolved. A scheduler should require writeEnabled and failedWrites === 0 before treating a run as a completed write pass.',
      sources,
    },
    { status: incomplete ? 207 : 200 },
  )
}

export async function POST(request: Request) {
  return run(request)
}

export async function GET(request: Request) {
  return run(request)
}
