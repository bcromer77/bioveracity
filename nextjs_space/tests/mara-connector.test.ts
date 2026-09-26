import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMaraDeterminationMetadata, fetchMaraForAuthorisedCase, MARA_DETERMINATIONS, maraSelection } from '../lib/ingest/connectors-mara'
import { validateEvidence } from '../lib/evidence-contract'
import type { Options } from '../lib/ingest/connectors-scotland'

// All records and dates below are synthetic fixtures. No Codling dataset or private user.
const selection = { kind: 'MUL' as const, reference: 'MUL_TEST_01'.replaceAll('_', '-') }
const fields = { OBJECTID: 7, MARA_FileRecordNumber: selection.reference, MARA_SiteReference: 'Synthetic area A',
  MARA_AuthorisationStatus: 'Synthetic status', MARA_AuthorisationType: 'Synthetic usage',
  MARA_StartDate: 0, MARA_ExpiryDate: null }
const feature = (change: Record<string, unknown> = {}) => ({ attributes: { ...fields, ...change } })
const now = () => new Date('2020-01-01T00:00:00.000Z')
const fake = (body: unknown, status = 200): Options => ({ now,
  fetcher: async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) })

test('exact-reference query uses the fixed service, scoped fields, ordering and no geometry', async () => {
  let called = ''
  const result = await fetchMaraDeterminationMetadata(selection, { now, limit: 2, offset: 4,
    fetcher: async (url, init) => {
      called = String(url)
      assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store'); assert.ok(init?.signal)
      return new Response(JSON.stringify({ features: [feature()], exceededTransferLimit: true }))
    } })
  const u = new URL(called)
  assert.equal(u.origin + u.pathname, `${MARA_DETERMINATIONS}/1/query`)
  assert.equal(u.searchParams.get('where'), `MARA_FileRecordNumber='${selection.reference}'`)
  assert.equal(u.searchParams.get('returnGeometry'), 'false')
  assert.equal(u.searchParams.get('resultRecordCount'), '2'); assert.equal(u.searchParams.get('resultOffset'), '4')
  assert.equal(u.searchParams.get('orderByFields'), 'OBJECTID ASC')
  assert.equal(result.nextOffset, 6); assert.equal(result.status, 'ok')
})

test('MAC uses layer zero and keeps the operator-supplied identifier without invented aliases', async () => {
  const ref = '2099-MAC-TEST'
  const result = await fetchMaraDeterminationMetadata({ kind: 'MAC', reference: ref }, { now,
    fetcher: async url => {
      assert.ok(String(url).startsWith(`${MARA_DETERMINATIONS}/0/query?`))
      return new Response(JSON.stringify({ features: [feature({ MARA_FileRecordNumber: ref })] }))
    } })
  assert.equal(result.records.length, 1)
  assert.ok(result.records[0].title.includes(ref))
})

test('source provenance is retained, dates are not invented and acquisition remains unapproved', async () => {
  const r = (await fetchMaraDeterminationMetadata(selection, fake({ features: [feature()] }))).records[0]
  assert.equal(r.authority_id, 'ie:mara'); assert.equal(r.jurisdiction, 'Republic of Ireland')
  assert.equal(r.retrieved_at, now().toISOString()); assert.equal(r.acquisition_permitted, false)
  assert.equal(r.event_date, null); assert.equal(r.event_date_precision, 'unknown'); assert.equal(r.publication_date, null)
  assert.equal(r.source_licence, undefined)
  assert.equal(JSON.parse(r.sections[0].text).MARA_StartDate, 0)
  assert.equal(JSON.parse(r.sections[0].text).MARA_ExpiryDate, null)
  assert.equal(new URL(r.url).searchParams.get('objectIds'), '7')
})

test('same bytes across retrievals give same document key and version hash', async () => {
  const first = (await fetchMaraDeterminationMetadata(selection, fake({ features: [feature()] }))).records[0]
  const later = { ...first, retrieved_at: '2020-02-01T00:00:00Z' }
  assert.equal(validateEvidence(first).versionHash, validateEvidence(later).versionHash)
  assert.equal(validateEvidence(first).documentKey, validateEvidence(later).documentKey)
})

test('a changed status creates a new version, not a new document identity', async () => {
  const a = validateEvidence((await fetchMaraDeterminationMetadata(selection, fake({ features: [feature()] }))).records[0])
  const b = validateEvidence((await fetchMaraDeterminationMetadata(selection, fake({ features: [feature({ MARA_AuthorisationStatus: 'Other synthetic status' })] }))).records[0])
  assert.notEqual(a.versionHash, b.versionHash); assert.equal(a.documentKey, b.documentKey)
})

test('unrequested attributes and geometry are not retained or fetched as documents', async () => {
  const record = feature({ privateNote: 'SHOULD_NOT_COPY', LicenceApplicationDocuments: 'http://127.0.0.1/private' })
  const result = await fetchMaraDeterminationMetadata(selection, fake({ features: [{ ...record, geometry: { rings: [] } }] }))
  assert.equal(result.records.length, 1)
  assert.ok(!result.records[0].sections[0].text.includes('SHOULD_NOT_COPY'))
  assert.ok(!result.records[0].sections[0].text.includes('127.0.0.1'))
  assert.ok(!result.records[0].sections[0].text.includes('rings'))
})

test('invalid selection, SQL payload and URL input never send a network request', async () => {
  let calls = 0
  const options: Options = { fetcher: async () => { calls++; throw Error('Unexpected') } }
  for (const input of [null, { kind: 'OTHER', reference: 'ABCD' }, { ...selection, reference: "X' OR 1=1" },
    { ...selection, reference: 'https://localhost/' }, { ...selection, reference: ' MUL123' }]) {
    const result = await fetchMaraDeterminationMetadata(input as never, options)
    assert.equal(result.status, 'error')
  }
  assert.equal(calls, 0); assert.throws(() => maraSelection({ ...selection, reference: '%' }))
})

test('empty result states bounded coverage, not that the permission does not exist', async () => {
  const result = await fetchMaraDeterminationMetadata(selection, fake({ features: [] }))
  assert.equal(result.status, 'ok'); assert.deepEqual(result.records, []); assert.equal(result.nextOffset, null)
  assert.match(result.coverage, /do not establish absence/)
})

test('wrong reference is rejected and not silently associated with the project', async () => {
  const result = await fetchMaraDeterminationMetadata(selection, fake({ features: [feature({ MARA_FileRecordNumber: 'OTHER-REF' })] }))
  assert.equal(result.status, 'partial'); assert.equal(result.rejected, 1); assert.equal(result.records.length, 0)
})

test('missing fields, invalid dates, string IDs and repeated IDs are visible rejections', async () => {
  const incomplete = feature(); delete (incomplete.attributes as Record<string, unknown>).MARA_SiteReference
  const result = await fetchMaraDeterminationMetadata(selection, fake({ features: [incomplete,
    feature({ MARA_StartDate: '2026-01-01' }), feature({ OBJECTID: '7' }), feature(), feature()] }))
  assert.equal(result.status, 'partial'); assert.equal(result.rejected, 4); assert.equal(result.records.length, 1)
})

test('schema/API/HTTP failures return no fabricated records or upstream confidential message', async () => {
  for (const fixture of [fake({ features: 'bad' }), fake({ error: { message: 'PRIVATE upstream detail' } }), fake({}, 503)]) {
    const result = await fetchMaraDeterminationMetadata(selection, fixture)
    assert.equal(result.status, 'error'); assert.deepEqual(result.records, [])
    assert.ok(!JSON.stringify(result).includes('PRIVATE'))
  }
})

test('a non-advancing, malformed or oversized page is a failure, not completion', async () => {
  for (const body of [{ features: [], exceededTransferLimit: true }, { features: [], exceededTransferLimit: 'true' },
    { features: [feature(), feature({ OBJECTID: 8 })] }]) {
    const result = await fetchMaraDeterminationMetadata(selection, { ...fake(body), limit: 1 })
    assert.equal(result.status, 'error')
  }
})

test('an invalid pagination limit is rejected before fetching', async () => {
  let calls = 0
  const result = await fetchMaraDeterminationMetadata(selection, { limit: 51, fetcher: async () => { calls++; return new Response('{}') } })
  assert.equal(result.status, 'error'); assert.equal(calls, 0)
})

test('shared transport rejects a response over its four MiB bound', async () => {
  const result = await fetchMaraDeterminationMetadata(selection, { fetcher: async () => new Response(' '.repeat(4 * 1024 * 1024 + 1)) })
  assert.equal(result.status, 'error'); assert.deepEqual(result.records, [])
})

test('access denial at the resolver occurs before any provider call', async () => {
  let calls = 0
  await assert.rejects(fetchMaraForAuthorisedCase(async () => { throw Error('Access denied') },
    { fetcher: async () => { calls++; return new Response('{}') } }), /Access denied/)
  assert.equal(calls, 0)
})

test('the authorisation seam uses only the server-resolved selection', async () => {
  let authorised = false
  const result = await fetchMaraForAuthorisedCase(async () => { authorised = true; return selection }, {
    now, fetcher: async url => {
      assert.equal(authorised, true)
      assert.equal(new URL(String(url)).searchParams.get('where'), `MARA_FileRecordNumber='${selection.reference}'`)
      return new Response(JSON.stringify({ features: [feature()] }))
    },
  })
  assert.equal(result.status, 'ok')
})
