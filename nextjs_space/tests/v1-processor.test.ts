// Gate 3D-C: the production V1 processor completes the frozen lifecycle
// RAW_PERSISTED → PROCESSING → PROCESSED | PROCESSING_FAILED without altering raw
// evidence or provenance. Runs the REAL service + processor on in-memory PGlite.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { harness, type Harness } from './support/v1-harness'
import { createV1Processor, ProcessingCheckError } from '../lib/v1/processor'
import type { EvidencePublic } from '../lib/v1/service'

// A dateless, coordinate-free site record: unknowns must stay unknown.
const body = {
  provider: 'npws',
  source_external_id: 'SAC:002162',
  evidence_type: 'protected_site_designation',
  source_data: { site_code: '002162', site_name: 'River Barrow and River Nore SAC', designation: 'SAC' },
  geography: { kind: 'site', name: 'River Barrow and River Nore SAC', admin_code: '002162' },
  source_url: 'https://www.npws.ie/protected-sites/sac/002162',
  publisher: 'National Parks and Wildlife Service',
  provenance: { licence: 'CC BY 4.0', attribution: 'NPWS', temporal_uncertainty: 'publication and observation dates unknown' },
}

async function withStatusLog(h: Harness) {
  await h.pg.exec(`
    CREATE TABLE status_log (seq serial PRIMARY KEY, ev text, status text);
    CREATE FUNCTION log_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO status_log (ev, status) VALUES (NEW."id", NEW."processingStatus"); RETURN NEW; END $$;
    CREATE TRIGGER status_log_t AFTER INSERT OR UPDATE OF "processingStatus" ON "PlatformEvidence"
      FOR EACH ROW EXECUTE FUNCTION log_status();`)
  return async () => (await h.db.query<{ status: string }>('SELECT status FROM status_log ORDER BY seq', [])).map((r) => r.status)
}

async function rows(h: Harness) {
  const raw = await h.db.query<any>('SELECT * FROM "PlatformRawEvidence"', [])
  const ev = await h.db.query<any>('SELECT * FROM "PlatformEvidence"', [])
  return { raw, ev }
}

test('production processor: request → raw → evidence → PROCESSING → PROCESSED → retrievable, provenance intact', async () => {
  let calls = 0
  const h: Harness = await harness({ processor: (e) => (calls++, createV1Processor(h.db)(e)) })
  try {
    const log = await withStatusLog(h)
    const key = await h.service.createKey({ name: 'k', mode: 'test' })
    const res = await h.handle('POST', '/api/v1/evidence', { token: key.token, body, headers: { 'idempotency-key': 'gate3d-c-1' } })
    assert.equal(res.status, 201)
    assert.equal(res.json.processing_status, 'PROCESSED')
    assert.equal(res.json.contract_version, 'v1')
    assert.deepEqual(await log(), ['RAW_PERSISTED', 'PROCESSING', 'PROCESSED'])

    const { raw, ev } = await rows(h)
    assert.equal(raw.length, 1)
    assert.equal(ev.length, 1)
    assert.deepEqual(raw[0].rawBody, body) // raw preserved exactly
    assert.equal(ev[0].rawEvidenceId, raw[0].id)
    assert.equal(ev[0].processingError, null)

    const got = await h.handle('GET', `/api/v1/evidence/${res.json.id}`, { token: key.token })
    assert.equal(got.status, 200)
    assert.equal(got.json.processing_status, 'PROCESSED')
    for (const f of ['provider', 'source_external_id', 'evidence_type', 'source_url', 'publisher'] as const) assert.equal(got.json[f], body[f])
    assert.deepEqual(got.json.source_data, body.source_data)
    assert.deepEqual(got.json.geography, body.geography)
    assert.deepEqual(got.json.provenance, body.provenance)
    assert.equal(got.json.observation_time, null)
    assert.equal(got.json.observation_precision, null)
    assert.equal(got.json.publication_time, null)
    assert.equal(got.json.retrieval_time, null)
    assert.equal('latitude' in got.json.geography || 'longitude' in got.json.geography, false)

    const trace = await h.handle('GET', `/api/v1/requests/${res.requestId}`, { token: key.token })
    const stages = trace.json.trace.map((t: any) => t.stage)
    assert.deepEqual(stages, ['received', 'authenticated', 'validated', 'raw_persisted', 'evidence_id', 'processing'])
    assert.equal(trace.json.trace.at(-1).detail, 'PROCESSED')
    assert.equal(calls, 1)
    console.log('LIFECYCLE_EVIDENCE ' + JSON.stringify({ http: res.status, transitions: await log(), trace: trace.json.trace, evidence: got.json }))

    // Idempotency unchanged: replay returns the same item, processor NOT re-run.
    const again = await h.handle('POST', '/api/v1/evidence', { token: key.token, body, headers: { 'idempotency-key': 'gate3d-c-1' } })
    assert.equal(again.status, 200)
    assert.equal(again.json.replayed, true)
    assert.equal(again.json.id, res.json.id)
    assert.equal(again.json.processing_status, 'PROCESSED')
    const dedup = await h.handle('POST', '/api/v1/evidence', { token: key.token, body })
    assert.equal(dedup.status, 200)
    assert.equal(dedup.json.id, res.json.id)
    const conflict = await h.handle('POST', '/api/v1/evidence', {
      token: key.token, body: { ...body, source_data: { changed: true } }, headers: { 'idempotency-key': 'gate3d-c-1' },
    })
    assert.equal(conflict.status, 409)
    assert.equal(conflict.json.error.type, 'idempotency_error')
    assert.equal(calls, 1)
    assert.deepEqual(await log(), ['RAW_PERSISTED', 'PROCESSING', 'PROCESSED'])
    const after = await rows(h)
    assert.equal(after.raw.length, 1)
    assert.equal(after.ev.length, 1)
  } finally {
    await h.pg.close()
  }
})

test('controlled integrity failure → PROCESSING_FAILED; raw and provenance preserved; failure exposed safely', async () => {
  // The REAL processor is handed a deliberately corrupted in-memory projection.
  const h: Harness = await harness({ processor: (e) => createV1Processor(h.db)({ ...e, publisher: 'TAMPERED-VALUE' }) })
  try {
    const log = await withStatusLog(h)
    const key = await h.service.createKey({ name: 'k', mode: 'test' })
    const res = await h.handle('POST', '/api/v1/evidence', { token: key.token, body })
    assert.equal(res.status, 201)
    assert.equal(res.json.processing_status, 'PROCESSING_FAILED')
    assert.deepEqual(await log(), ['RAW_PERSISTED', 'PROCESSING', 'PROCESSING_FAILED'])

    const { raw, ev } = await rows(h)
    assert.deepEqual(raw[0].rawBody, body)
    assert.equal(ev[0].publisher, body.publisher) // stored row untouched
    assert.deepEqual(ev[0].provenance, body.provenance)
    assert.equal(ev[0].processingError, 'integrity_check_failed: publisher_mismatch')
    assert.equal(ev[0].processingError.includes('TAMPERED'), false) // no values echoed

    const got = await h.handle('GET', `/api/v1/evidence/${res.json.id}`, { token: key.token })
    assert.equal(got.status, 200)
    assert.equal(got.json.processing_status, 'PROCESSING_FAILED')
    assert.deepEqual(got.json.provenance, body.provenance)
    assert.equal('processing_error' in got.json, false) // public contract unchanged
    const trace = await h.handle('GET', `/api/v1/requests/${res.requestId}`, { token: key.token })
    assert.equal(trace.json.trace.at(-1).stage, 'processing')
    assert.equal(trace.json.trace.at(-1).detail, 'PROCESSING_FAILED')
    console.log('FAILURE_EVIDENCE ' + JSON.stringify({ http: res.status, transitions: await log(), processingError: ev[0].processingError, trace: trace.json.trace, evidence: got.json }))
  } finally {
    await h.pg.close()
  }
})

test('processor never accepts manufactured dates, coordinates or out-of-lifecycle calls', async () => {
  let captured: EvidencePublic | null = null
  const h: Harness = await harness({ processor: async (e) => { captured = e } })
  try {
    const key = await h.service.createKey({ name: 'k', mode: 'test' })
    await h.handle('POST', '/api/v1/evidence', { token: key.token, body })
    const e = captured as unknown as EvidencePublic
    const p = createV1Processor(h.db)
    await p(e) // faithful projection passes
    const expectCheck = async (ev: EvidencePublic, check: string) =>
      assert.rejects(p(ev), (err: unknown) => err instanceof ProcessingCheckError && err.check === check)
    await expectCheck({ ...e, processing_status: 'RAW_PERSISTED' }, 'status_not_processing')
    await expectCheck({ ...e, contract_version: 'v2' }, 'contract_version')
    await expectCheck({ ...e, observation_time: '2020-01-01T00:00:00.000Z' }, 'observation_time_presence')
    await expectCheck({ ...e, publication_time: '2020-01-01T00:00:00.000Z' }, 'publication_time_presence')
    await expectCheck({ ...e, geography: { ...body.geography, latitude: 52.6, longitude: -7.2 } }, 'geography_mismatch')
    await expectCheck({ ...e, provenance: { ...body.provenance, licence: 'unknown' } }, 'provenance_mismatch')
    await expectCheck({ ...e, raw_evidence_id: 'raw_missing' }, 'raw_evidence_missing')
  } finally {
    await h.pg.close()
  }
})

test('production wiring: getService() supplies the V1 processor', () => {
  const src = readFileSync(join(process.cwd(), 'lib/v1/http.ts'), 'utf8')
  assert.match(src, /return platformService\(platformDb, v1ServiceOptions\(platformDb\)\)/)
})
