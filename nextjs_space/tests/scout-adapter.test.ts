import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { harness } from './support/v1-harness'
import { mapScoutDiscovery, submitScoutDiscovery, ScoutAdapterError } from '../lib/scout/v1-adapter'
import { npwsSac002162Discovery } from './fixtures/scout-npws-sac-002162'

const BASE = 'https://bioveracity.test'
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

const minimal = () => ({
  ingestion_metadata: { source_agent: 'scout', schema_version: '2.1' },
  raw_source: { url: 'https://example.org/record/1', publisher: 'Example Publisher' },
  observations: [{ observation_type: 'community_report', claim: 'Something was noticed.' }],
})

// Reverse key order recursively to prove mapping is order-independent.
const reorder = (v: any): any =>
  Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder(v[k])])) : v

test('mapping is deterministic and key-order independent', () => {
  const a = mapScoutDiscovery(clone(npwsSac002162Discovery))
  const b = mapScoutDiscovery(clone(npwsSac002162Discovery))
  const c = mapScoutDiscovery(reorder(clone(npwsSac002162Discovery)))
  assert.deepEqual(a, b)
  assert.equal(a.idempotencyKey, c.idempotencyKey)
  assert.match(a.idempotencyKey, /^scout-v1:[0-9a-f]{64}$/)
  const d = mapScoutDiscovery({ ...minimal(), observations: [{ observation_type: 'community_report', claim: 'Different.' }] })
  assert.notEqual(d.idempotencyKey, mapScoutDiscovery(minimal()).idempotencyKey)
})

test('batches and arrays are rejected (fail closed)', () => {
  const cases: unknown[] = [
    [minimal()],
    [],
    { ...minimal(), observations: [] },
    { ...minimal(), observations: [minimal().observations[0], minimal().observations[0]] },
    { ...minimal(), observations: undefined },
    'not an object',
    null,
    { ...minimal(), observations: [{ claim: 'no type' }] },
  ]
  for (const input of cases) {
    assert.throws(() => mapScoutDiscovery(input), (e: unknown) => e instanceof ScoutAdapterError)
  }
  assert.throws(() => mapScoutDiscovery([minimal()]), { code: 'batch_rejected' })
  assert.throws(() => mapScoutDiscovery({ ...minimal(), observations: [{ observation_type: 'a' }, { observation_type: 'b' }] }), { code: 'batch_rejected' })
})

test('unknowns stay absent; nothing is inferred', () => {
  const { evidence } = mapScoutDiscovery(minimal())
  for (const k of ['publication_time', 'observation_time', 'observation_precision', 'retrieval_time', 'geography', 'source_external_id']) {
    assert.equal(k in evidence, false, `${k} must be absent`)
  }
  // Half a coordinate pair and precision-without-time are dropped, not completed.
  const partial = mapScoutDiscovery({
    ...minimal(),
    observations: [{ observation_type: 'x', coordinates: { lat: 52.1 }, observation_precision: 'day' }],
  }).evidence
  assert.equal('geography' in partial, false)
  assert.equal('observation_precision' in partial, false)
  // The real-source item asserts no coordinates and no record-level dates.
  const real = mapScoutDiscovery(clone(npwsSac002162Discovery)).evidence
  assert.equal((real.geography as any).latitude, undefined)
  assert.equal((real.geography as any).longitude, undefined)
  assert.equal('publication_time' in real, false)
  assert.equal('observation_time' in real, false)
  assert.equal(real.retrieval_time, '2026-09-27T21:14:53Z')
})

test('real-source item maps exactly to the PROPOSED / NOT SENT payload', () => {
  const mapped = mapScoutDiscovery(clone(npwsSac002162Discovery))
  const golden = JSON.parse(readFileSync('tests/fixtures/scout-npws-sac-002162.proposed.json', 'utf8'))
  assert.equal(golden._label, 'PROPOSED / NOT SENT')
  assert.deepEqual(mapped.evidence, golden.evidence_create)
  assert.equal(mapped.idempotencyKey, golden.idempotency_key)
})

test('raw material and provenance are preserved exactly through the V1 pipeline', async () => {
  const h = await harness({ processor: async () => {} })
  try {
    const { token } = await h.service.createKey({ name: 'scout-adapter', mode: 'test' })
    const res = await submitScoutDiscovery(clone(npwsSac002162Discovery), { apiKey: token, baseUrl: BASE, fetch: h.makeSdkFetch() })
    assert.equal(res.mode, 'test')
    assert.equal(res.processing_status, 'PROCESSED')
    const raw = await h.db.query<any>('SELECT "rawBody" FROM "PlatformRawEvidence" WHERE "id" = $1', [res.raw_evidence_id])
    const body = typeof raw[0].rawBody === 'string' ? JSON.parse(raw[0].rawBody) : raw[0].rawBody
    assert.deepEqual(body.source_data, clone(npwsSac002162Discovery))
    const ev = await h.db.query<any>('SELECT "provenance","sourceData","sourceUrl","publicationTime","observationTime" FROM "PlatformEvidence" WHERE "id" = $1', [res.evidence_id])
    const prov = typeof ev[0].provenance === 'string' ? JSON.parse(ev[0].provenance) : ev[0].provenance
    assert.equal(prov.licence, 'CC BY 4.0')
    assert.deepEqual(prov, mapScoutDiscovery(clone(npwsSac002162Discovery)).evidence.provenance)
    assert.equal(ev[0].sourceUrl, 'https://www.npws.ie/protected-sites/sac/002162')
    assert.equal(ev[0].publicationTime, null)
    assert.equal(ev[0].observationTime, null)
  } finally {
    await h.pg.close()
  }
})

test('idempotency is deterministic: repeat submission replays, no duplicate', async () => {
  const h = await harness()
  try {
    const { token } = await h.service.createKey({ name: 'scout-adapter', mode: 'test' })
    const opts = { apiKey: token, baseUrl: BASE, fetch: h.makeSdkFetch() }
    const first = await submitScoutDiscovery(clone(npwsSac002162Discovery), opts)
    const second = await submitScoutDiscovery(reorder(clone(npwsSac002162Discovery)), opts)
    assert.equal(second.evidence_id, first.evidence_id)
    assert.equal(second.replayed, true)
    assert.equal(first.idempotency_key, second.idempotency_key)
    const counts = await h.db.query<any>(
      'SELECT (SELECT COUNT(*) FROM "PlatformEvidence")::int AS e, (SELECT COUNT(*) FROM "PlatformRawEvidence")::int AS r, (SELECT COUNT(*) FROM "PlatformIdempotency")::int AS i',
      [],
    )
    assert.deepEqual({ e: Number(counts[0].e), r: Number(counts[0].r), i: Number(counts[0].i) }, { e: 1, r: 1, i: 1 })
    const idem = await h.db.query<any>('SELECT "idempotencyKey" FROM "PlatformIdempotency"', [])
    assert.equal(idem[0].idempotencyKey, first.idempotency_key)
  } finally {
    await h.pg.close()
  }
})

test('test/live separation: default is test-only; live needs explicit opt-in and a live key', async () => {
  const h = await harness()
  try {
    const testKey = (await h.service.createKey({ name: 't', mode: 'test' })).token
    const liveKey = (await h.service.createKey({ name: 'l', mode: 'live' })).token
    let calls = 0
    const inner = h.makeSdkFetch()
    const counting = (async (i: any, init: any) => { calls++; return inner(i, init) }) as typeof fetch

    await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: liveKey, baseUrl: BASE, fetch: counting }), { code: 'mode_mismatch' })
    await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: liveKey, baseUrl: BASE, mode: 'live', fetch: counting }), { code: 'live_not_allowed' })
    await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: testKey, baseUrl: BASE, mode: 'live', allowLive: true, fetch: counting }), { code: 'mode_mismatch' })
    await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: testKey, baseUrl: '', fetch: counting }), { code: 'missing_base_url' })
    assert.equal(calls, 0, 'no request may be sent when the mode guard fails')

    const t = await submitScoutDiscovery(minimal(), { apiKey: testKey, baseUrl: BASE, fetch: counting })
    assert.equal(t.mode, 'test')
    const l = await submitScoutDiscovery(minimal(), { apiKey: liveKey, baseUrl: BASE, mode: 'live', allowLive: true, fetch: counting })
    assert.equal(l.mode, 'live')
    assert.equal(calls, 2)
  } finally {
    await h.pg.close()
  }
})

test('credentials are redacted from errors and never logged; exactly one HTTP attempt', async () => {
  const h = await harness()
  try {
    const { token } = await h.service.createKey({ name: 't', mode: 'test' })
    const logged: string[] = []
    const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) (console as any)[k] = (...a: unknown[]) => logged.push(a.map(String).join(' '))
    let attempts = 0
    try {
      const leaky = (async () => { attempts++; throw new Error(`socket closed while sending Bearer ${token}`) }) as typeof fetch
      await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: token, baseUrl: BASE, fetch: leaky }), (e: any) => {
        assert.equal(String(e.message).includes(token), false)
        assert.equal(JSON.stringify(e).includes(token), false)
        return true
      })
      assert.equal(attempts, 1, 'no retry fan-out')
      const failing = (async () => { attempts++; return new Response('{}', { status: 500 }) }) as typeof fetch
      await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: token, baseUrl: BASE, fetch: failing }))
      assert.equal(attempts, 2)
      // A revoked-looking/unknown key yields an auth error that carries no secret.
      const bogus = 'bv_test_' + 'a'.repeat(24) + '_' + 'b'.repeat(48)
      await assert.rejects(submitScoutDiscovery(minimal(), { apiKey: bogus, baseUrl: BASE, fetch: h.makeSdkFetch() }), (e: any) => {
        assert.equal(String(e.message).includes('b'.repeat(48)), false)
        return true
      })
    } finally {
      Object.assign(console, orig)
    }
    assert.equal(logged.some((l) => l.includes(token)), false)
    const stored = await h.db.query<any>('SELECT * FROM "PlatformRequest"', [])
    assert.equal(JSON.stringify(stored).includes(token), false, 'no plaintext token in the audit trail')
  } finally {
    await h.pg.close()
  }
})
