import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './support/v1-harness'
import { BioVeracity } from '../packages/sdk/src/index'

// ==========================================================================
// ACCEPTANCE — an independent client that knows ONLY: the base URL, an API
// credential and the documented EvidenceCreate contract. It uses the real
// @bioveracity/sdk over a fetch wired to the real service + real migration.
// ==========================================================================

test('independent client: create → retrieve → retry (no duplicate) → trace', async () => {
  const h = await harness()
  try {
    // Only these three facts cross to the "client".
    const { token } = await h.service.createKey({ name: 'acceptance', mode: 'test' })
    const baseUrl = 'https://bioveracity.test'
    const bio = new BioVeracity({ apiKey: token, baseUrl, fetch: h.makeSdkFetch() })

    // 1. CREATE — HTTP success + ev_* + req_*
    const created = await bio.evidence.create(
      {
        provider: 'cso',
        source_external_id: 'FY003A',
        evidence_type: 'population_statistic',
        source_data: { area: 'Kerry County Council', measure: 'Population', value: 156458 },
        geography: { kind: 'county', name: 'Kerry County Council' },
        publication_time: '2023-05-30',
        source_url: 'https://data.cso.ie/table/FY003A',
        publisher: 'Central Statistics Office',
      },
      { idempotencyKey: 'acceptance-op-1' },
    )
    assert.ok(created.id.startsWith('ev_'), 'evidence id must be ev_*')
    assert.ok(created.request_id.startsWith('req_'), 'request id must be req_*')

    // 2. RETRIEVE status
    const fetched = await bio.evidence.retrieve(created.id)
    assert.equal(fetched.id, created.id)
    assert.ok(['RAW_PERSISTED', 'PROCESSED'].includes(fetched.processing_status))

    // 3. RETRY safely — same idempotency key, same result
    const retried = await bio.evidence.create(
      {
        provider: 'cso',
        source_external_id: 'FY003A',
        evidence_type: 'population_statistic',
        source_data: { area: 'Kerry County Council', measure: 'Population', value: 156458 },
        geography: { kind: 'county', name: 'Kerry County Council' },
        publication_time: '2023-05-30',
        source_url: 'https://data.cso.ie/table/FY003A',
        publisher: 'Central Statistics Office',
      },
      { idempotencyKey: 'acceptance-op-1' },
    )
    assert.equal(retried.id, created.id)

    // 4. PROVE no duplicate (observed in the datastore)
    const count = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformEvidence"', [])
    assert.equal(Number(count[0].c), 1, 'exactly one evidence record must exist')

    // 5. TRACE the request through persistence
    const trace = await bio.requests.retrieve(created.request_id)
    const stages = trace.trace.map((t) => t.stage)
    assert.ok(['received', 'authenticated', 'validated', 'raw_persisted', 'evidence_id'].every((s) => stages.includes(s)))
    assert.equal(trace.evidence_id, created.id)
  } finally {
    await h.pg.close()
  }
})

test('Scout migration: SCOUT → SDK → V1 API → RAW PERSISTENCE → EVIDENCE ID → STATUS', async () => {
  const h = await harness()
  try {
    const { token } = await h.service.createKey({ name: 'scout', mode: 'test' })
    const bio = new BioVeracity({ apiKey: token, baseUrl: 'https://bioveracity.test', fetch: h.makeSdkFetch() })

    // A Scout push in its native shape. The adapter (below) lives OUTSIDE the
    // SDK — source-specific extraction stays in the adapter, per the contract.
    const scoutPush = {
      ingestion_metadata: { source_agent: 'scout', schema_version: '2.1', category: 'water', target_region: 'cambridgeshire' },
      raw_source: { url: 'https://example.org/scout/record/42', publisher: 'Scout' },
      observations: [
        {
          observation_type: 'community_report',
          claim: 'Discoloured discharge observed at outfall.',
          source_url: 'https://example.org/scout/record/42',
          retrieval_timestamp: '2026-09-30T09:00:00Z',
        },
      ],
    }

    // Scout adapter: map the native push to the canonical EvidenceCreate. No
    // interpretation, no invented fields; uncertainty preserved (no coordinates).
    const evidenceCreate = {
      provider: 'scout',
      source_external_id: 'scout/record/42',
      evidence_type: scoutPush.observations[0].observation_type,
      source_data: scoutPush,
      source_url: scoutPush.observations[0].source_url,
      publisher: scoutPush.raw_source.publisher,
      retrieval_time: scoutPush.observations[0].retrieval_timestamp,
      provenance: { migrated_from: 'ingest/grok', schema_version: scoutPush.ingestion_metadata.schema_version },
    }

    const created = await bio.evidence.create(evidenceCreate, { idempotencyKey: 'scout-42' })
    assert.ok(created.id.startsWith('ev_'), 'SCOUT → EVIDENCE ID')

    // RAW PERSISTENCE: the untouched Scout push is durably stored and linked.
    const raws = await h.db.query<any>('SELECT * FROM "PlatformRawEvidence" WHERE "id" = $1', [created.raw_evidence_id])
    assert.equal(raws.length, 1, 'raw Scout submission persisted')
    const storedRaw = typeof raws[0].rawBody === 'string' ? JSON.parse(raws[0].rawBody) : raws[0].rawBody
    assert.equal(storedRaw.source_data.ingestion_metadata.source_agent, 'scout')

    // STATUS retrievable end-to-end.
    const status = await bio.evidence.retrieve(created.id)
    assert.equal(status.provider, 'scout')
    assert.ok(['RAW_PERSISTED', 'PROCESSED'].includes(status.processing_status))
  } finally {
    await h.pg.close()
  }
})
