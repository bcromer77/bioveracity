import test from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './support/v1-harness'
import { redactSecrets, parseToken, generateApiKey } from '../lib/v1/keys'
import { fixedWindowLimiter } from '../lib/v1/ratelimit'
import { BioVeracity, BioVeracityError } from '../packages/sdk/src/index'

const sampleEvidence = {
  provider: 'cso',
  source_external_id: 'FY003A',
  evidence_type: 'population_statistic',
  source_data: { area: 'Kerry County Council', measure: 'Population', value: 156458 },
  geography: { kind: 'county', name: 'Kerry County Council' },
  observation_time: '2022-04-03',
  observation_precision: 'day',
  publication_time: '2023-05-30',
  source_url: 'https://data.cso.ie/table/FY003A',
  publisher: 'Central Statistics Office',
}

async function keyFor(h: Awaited<ReturnType<typeof harness>>, mode: 'test' | 'live' = 'live') {
  return h.service.createKey({ name: `${mode}-key`, mode })
}

// ---- Authentication ------------------------------------------------------

test('valid authentication accepts a correctly-formed live key', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h, 'live')
    const res = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    assert.equal(res.status, 201)
    assert.ok(res.json.id.startsWith('ev_'))
  } finally {
    await h.pg.close()
  }
})

test('invalid credential is rejected with a structured authentication error', async () => {
  const h = await harness()
  try {
    for (const token of ['', 'not-a-key', 'bv_live_deadbeef_deadbeef', 'sk_live_x']) {
      const res = await h.handle('POST', '/api/v1/evidence', { token, body: sampleEvidence })
      assert.equal(res.status, 401)
      assert.equal(res.json.error.type, 'authentication_error')
      assert.ok(res.json.error.request_id)
    }
  } finally {
    await h.pg.close()
  }
})

test('revoked credential can no longer authenticate', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h, 'live')
    assert.equal(await h.service.revokeKey(key.id), true)
    const res = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    assert.equal(res.status, 401)
    assert.equal(res.json.error.code, 'revoked_api_key')
  } finally {
    await h.pg.close()
  }
})

// ---- Test/live isolation -------------------------------------------------

test('test/live isolation: a test key cannot read live evidence and payloads do not collide across modes', async () => {
  const h = await harness()
  try {
    const live = await keyFor(h, 'live')
    const testKey = await keyFor(h, 'test')
    const created = await h.handle('POST', '/api/v1/evidence', { token: live.token, body: sampleEvidence })
    assert.equal(created.json.mode, 'live')

    // Same payload under a test key creates a SEPARATE record (unique per mode).
    const testCreated = await h.handle('POST', '/api/v1/evidence', { token: testKey.token, body: sampleEvidence })
    assert.equal(testCreated.json.mode, 'test')
    assert.notEqual(testCreated.json.id, created.json.id)

    // The test key cannot retrieve the live evidence id.
    const cross = await h.handle('GET', `/api/v1/evidence/${created.json.id}`, { token: testKey.token })
    assert.equal(cross.status, 404)
  } finally {
    await h.pg.close()
  }
})

// ---- Per-key dedup isolation (release blocker: PR #81) --------------------

test('two independent keys in the same mode submitting an identical payload never collide or cross-resolve', async () => {
  const h = await harness()
  try {
    // Two DISTINCT keys, SAME mode. Dedup must be scoped per key, not global.
    const keyA = await h.service.createKey({ name: 'tenant-a', mode: 'test' })
    const keyB = await h.service.createKey({ name: 'tenant-b', mode: 'test' })
    assert.notEqual(keyA.id, keyB.id)

    const a = await h.handle('POST', '/api/v1/evidence', { token: keyA.token, body: sampleEvidence })
    const b = await h.handle('POST', '/api/v1/evidence', { token: keyB.token, body: sampleEvidence })

    // Both submissions succeed as genuinely NEW records (201, never a replay).
    assert.equal(a.status, 201)
    assert.equal(b.status, 201)
    assert.notEqual(b.json.replayed, true)

    // Each key receives its own distinct canonical + raw ids.
    assert.notEqual(a.json.id, b.json.id)
    assert.notEqual(a.json.raw_evidence_id, b.json.raw_evidence_id)

    // Two separate raw rows and two separate evidence rows exist — no global dedup.
    const raws = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformRawEvidence"', [])
    const ev = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformEvidence"', [])
    assert.equal(Number(raws[0].c), 2)
    assert.equal(Number(ev[0].c), 2)

    // Neither key can RETRIEVE the other key's evidence object.
    const bReadsA = await h.handle('GET', `/api/v1/evidence/${a.json.id}`, { token: keyB.token })
    const aReadsB = await h.handle('GET', `/api/v1/evidence/${b.json.id}`, { token: keyA.token })
    assert.equal(bReadsA.status, 404)
    assert.equal(aReadsB.status, 404)

    // Each key can still read its OWN evidence — the object returned is its own id.
    const aReadsA = await h.handle('GET', `/api/v1/evidence/${a.json.id}`, { token: keyA.token })
    const bReadsB = await h.handle('GET', `/api/v1/evidence/${b.json.id}`, { token: keyB.token })
    assert.equal(aReadsA.status, 200)
    assert.equal(bReadsB.status, 200)
    assert.equal(aReadsA.json.id, a.json.id)
    assert.equal(bReadsB.json.id, b.json.id)

    // Per-key idempotency is preserved: the SAME key resubmitting the identical
    // payload still dedups to its own single record (no new row).
    const aAgain = await h.handle('POST', '/api/v1/evidence', { token: keyA.token, body: sampleEvidence })
    assert.equal(aAgain.json.id, a.json.id)
    const rawsAfter = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformRawEvidence"', [])
    assert.equal(Number(rawsAfter[0].c), 2)
  } finally {
    await h.pg.close()
  }
})

// ---- Evidence submission + validation ------------------------------------

test('valid evidence submission returns ev_* id, req_* id and preserved uncertainty', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const res = await h.handle('POST', '/api/v1/evidence', {
      token: key.token,
      body: { provider: 'scout', evidence_type: 'observation', source_data: { note: 'otter sighting reported' } },
    })
    assert.equal(res.status, 201)
    assert.ok(res.json.id.startsWith('ev_'))
    assert.ok(res.json.request_id.startsWith('req_'))
    // Absent time/geography preserved as null — never invented.
    assert.equal(res.json.observation_time, null)
    assert.equal(res.json.geography, null)
    assert.equal(res.json.contract_version, 'v1')
  } finally {
    await h.pg.close()
  }
})

test('malformed evidence is rejected with a validation error naming the offending field', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const missing = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: { evidence_type: 'x', source_data: {} } })
    assert.equal(missing.status, 400)
    assert.equal(missing.json.error.type, 'validation_error')
    assert.equal(missing.json.error.param, 'provider')

    // Coordinates must come as a pair; a lone latitude is rejected, never completed.
    const halfCoord = await h.handle('POST', '/api/v1/evidence', {
      token: key.token,
      body: { provider: 'p', evidence_type: 't', source_data: {}, geography: { latitude: 52.1 } },
    })
    assert.equal(halfCoord.status, 400)
    assert.equal(halfCoord.json.error.param, 'geography')
  } finally {
    await h.pg.close()
  }
})

// ---- Raw first -----------------------------------------------------------

test('raw-first persistence: the untouched submission is stored and linked to the evidence id', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const res = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    const raws = await h.db.query<any>('SELECT * FROM "PlatformRawEvidence"', [])
    assert.equal(raws.length, 1)
    assert.equal(res.json.raw_evidence_id, raws[0].id)
    const stored = typeof raws[0].rawBody === 'string' ? JSON.parse(raws[0].rawBody) : raws[0].rawBody
    assert.equal(stored.source_external_id, 'FY003A')
  } finally {
    await h.pg.close()
  }
})

// ---- Idempotency ---------------------------------------------------------

test('idempotent replay with the same key returns the same evidence and creates no duplicate', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const a = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence, headers: { 'idempotency-key': 'op-1' } })
    const b = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence, headers: { 'idempotency-key': 'op-1' } })
    assert.equal(a.json.id, b.json.id)
    assert.equal(a.status, 201)
    assert.equal(b.status, 200)
    assert.equal(b.json.replayed, true)
    const count = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformEvidence"', [])
    assert.equal(Number(count[0].c), 1)
  } finally {
    await h.pg.close()
  }
})

test('identical payload without an idempotency key still dedups via fingerprint', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const a = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    const b = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    assert.equal(a.json.id, b.json.id)
    const count = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformRawEvidence"', [])
    assert.equal(Number(count[0].c), 1)
  } finally {
    await h.pg.close()
  }
})

test('concurrent duplicate submissions resolve to one evidence record', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const apiKey = await h.service.findKeyByLookup(parseToken(key.token)!.lookupId)
    const [a, b] = await Promise.all([
      h.service.createEvidence({ apiKey: apiKey!, body: sampleEvidence as any, rawBody: sampleEvidence, requestId: 'req_a' }),
      h.service.createEvidence({ apiKey: apiKey!, body: sampleEvidence as any, rawBody: sampleEvidence, requestId: 'req_b' }),
    ])
    assert.equal(a.evidence.id, b.evidence.id)
    const count = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformEvidence"', [])
    assert.equal(Number(count[0].c), 1)
  } finally {
    await h.pg.close()
  }
})

test('reusing an idempotency key with a different payload is a deterministic conflict', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence, headers: { 'idempotency-key': 'op-2' } })
    const conflict = await h.handle('POST', '/api/v1/evidence', {
      token: key.token,
      body: { ...sampleEvidence, evidence_type: 'different' },
      headers: { 'idempotency-key': 'op-2' },
    })
    assert.equal(conflict.status, 409)
    assert.equal(conflict.json.error.type, 'idempotency_error')
  } finally {
    await h.pg.close()
  }
})

// ---- Downstream failure isolation ---------------------------------------

test('downstream processing failure leaves raw and canonical evidence intact', async () => {
  const h = await harness({ processor: async () => { throw new Error('normaliser exploded') } })
  try {
    const key = await keyFor(h)
    const res = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    // The submission still succeeds and yields a durable evidence id.
    assert.equal(res.status, 201)
    assert.ok(res.json.id.startsWith('ev_'))
    assert.equal(res.json.processing_status, 'PROCESSING_FAILED')
    // Raw + canonical rows both survive the downstream failure.
    const raws = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformRawEvidence"', [])
    const ev = await h.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM "PlatformEvidence"', [])
    assert.equal(Number(raws[0].c), 1)
    assert.equal(Number(ev[0].c), 1)
    // The stored processing error carries no raw secret material.
    const stored = await h.db.query<any>('SELECT "processingError" FROM "PlatformEvidence"', [])
    assert.match(stored[0].processingError, /normaliser exploded/)
  } finally {
    await h.pg.close()
  }
})

// ---- Rate limiting -------------------------------------------------------

test('rate limiting returns a structured 429 once the window is exhausted', async () => {
  const h = await harness({ limiter: fixedWindowLimiter({ limit: 2, windowMs: 60_000 }) })
  try {
    const key = await keyFor(h)
    await h.handle('POST', '/api/v1/evidence', { token: key.token, body: { ...sampleEvidence, source_data: { n: 1 } } })
    await h.handle('POST', '/api/v1/evidence', { token: key.token, body: { ...sampleEvidence, source_data: { n: 2 } } })
    const limited = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: { ...sampleEvidence, source_data: { n: 3 } } })
    assert.equal(limited.status, 429)
    assert.equal(limited.json.error.type, 'rate_limit_error')
  } finally {
    await h.pg.close()
  }
})

// ---- Structured errors + request tracing --------------------------------

test('structured errors always carry type, code, message and request_id', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const notFound = await h.handle('GET', '/api/v1/evidence/ev_does_not_exist', { token: key.token })
    assert.equal(notFound.status, 404)
    for (const f of ['type', 'code', 'message', 'request_id']) assert.ok(f in notFound.json.error, `missing ${f}`)
  } finally {
    await h.pg.close()
  }
})

test('request tracing records the full lifecycle and is retrievable by req_ id', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const created = await h.handle('POST', '/api/v1/evidence', { token: key.token, body: sampleEvidence })
    const traced = await h.handle('GET', `/api/v1/requests/${created.json.request_id}`, { token: key.token })
    assert.equal(traced.status, 200)
    const stages = traced.json.trace.map((t: any) => t.stage)
    for (const s of ['received', 'authenticated', 'validated', 'raw_persisted', 'evidence_id']) {
      assert.ok(stages.includes(s), `trace missing ${s}`)
    }
    assert.equal(traced.json.evidence_id, created.json.id)
  } finally {
    await h.pg.close()
  }
})

// ---- Secret handling -----------------------------------------------------

test('secret redaction: plaintext token is never stored and is scrubbed from log lines', async () => {
  const h = await harness()
  try {
    const key = await keyFor(h)
    const parsed = parseToken(key.token)!
    const secret = key.token.split('_')[3]
    // No column in the key row contains the plaintext secret.
    const rows = await h.db.query<any>('SELECT * FROM "PlatformApiKey" WHERE "lookupId" = $1', [parsed.lookupId])
    const serialised = JSON.stringify(rows[0])
    assert.equal(serialised.includes(secret), false)
    assert.equal(serialised.includes(key.token), false)
    // The log redactor removes token-shaped substrings.
    assert.equal(redactSecrets(`submitted with ${key.token} ok`).includes(secret), false)
    assert.match(redactSecrets(`x ${key.token} y`), /bv_\[REDACTED\]/)
  } finally {
    await h.pg.close()
  }
})

test('generated tokens are well-formed and mode-scoped', () => {
  const live = generateApiKey('live')
  const parsed = parseToken(live.token)
  assert.equal(parsed?.mode, 'live')
  assert.equal(parseToken(live.token.replace('bv_live', 'bv_test'))?.mode, 'test')
})

// ---- SDK behaviour -------------------------------------------------------

test('SDK retries transient failures, reuses one idempotency key, and does not retry validation errors', async () => {
  // Transient: 503 twice then 201. Capture headers to prove idempotency reuse.
  let calls = 0
  const seenKeys: string[] = []
  const fakeFetch = (async (_url: any, init: any) => {
    calls += 1
    seenKeys.push(new Headers(init.headers).get('idempotency-key') || '')
    if (calls < 3) return new Response(JSON.stringify({ error: { type: 'api_unavailable_error', code: 'x', message: 'down' } }), { status: 503 })
    return new Response(JSON.stringify({ id: 'ev_ok', object: 'evidence' }), { status: 201, headers: { 'BioVeracity-Request-Id': 'req_x' } })
  }) as typeof fetch

  const bio = new BioVeracity({ apiKey: 'bv_test_aa_bb', baseUrl: 'https://example.test', fetch: fakeFetch, maxRetries: 3 })
  const ev = await bio.evidence.create({ provider: 'scout', evidence_type: 'observation', source_data: { x: 1 } })
  assert.equal(ev.id, 'ev_ok')
  assert.equal(calls, 3)
  assert.equal(new Set(seenKeys).size, 1, 'the same idempotency key must be reused across retries')

  // Validation errors are terminal — no retry.
  let vCalls = 0
  const validationFetch = (async () => {
    vCalls += 1
    return new Response(JSON.stringify({ error: { type: 'validation_error', code: 'invalid_request', message: 'bad', param: 'provider' } }), { status: 400 })
  }) as typeof fetch
  const bio2 = new BioVeracity({ apiKey: 'bv_test_aa_bb', baseUrl: 'https://example.test', fetch: validationFetch, maxRetries: 3 })
  await assert.rejects(
    bio2.evidence.create({ provider: '', evidence_type: 't', source_data: {} }),
    (err: unknown) => err instanceof BioVeracityError && err.type === 'validation_error' && err.param === 'provider',
  )
  assert.equal(vCalls, 1)
})
