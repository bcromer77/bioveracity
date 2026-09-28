import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { harness } from './support/v1-harness'
import { operatorAccess } from '../lib/v1-operator/access'
import { loadPlatformOperatorView } from '../lib/v1-operator/view'
import { submitScoutDiscovery } from '../lib/scout/v1-adapter'
import { npwsSac002162Discovery } from './fixtures/scout-npws-sac-002162'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

test('operator access: unauthenticated and non-admin are rejected; admin allowed', () => {
  assert.equal(operatorAccess(null), 'unauthenticated')
  assert.equal(operatorAccess(undefined), 'unauthenticated')
  assert.equal(operatorAccess({}), 'unauthenticated')
  assert.equal(operatorAccess({ user: { email: 'x@example.org' } }), 'forbidden')
  assert.equal(operatorAccess({ user: { role: 'user' } }), 'forbidden')
  assert.equal(operatorAccess({ user: { role: 'Admin' } }), 'forbidden')
  assert.equal(operatorAccess({ user: { role: 'admin' } }), 'allowed')
})

test('page enforces the guard before any read and exposes no mutation', () => {
  const page = readFileSync('app/admin/platform/page.tsx', 'utf8')
  const guard = page.indexOf('operatorAccess(await auth())')
  const load = page.indexOf('loadPlatformOperatorView(')
  const loadCall = page.indexOf('loadPlatformOperatorView(adapter(prisma))')
  assert.ok(guard > 0 && loadCall > guard && load > 0, 'guard must run before the data load')
  assert.ok(page.indexOf("redirect('/login')") > guard && page.indexOf("redirect('/')") > guard)
  for (const src of [page, readFileSync('lib/v1-operator/view.ts', 'utf8')]) {
    for (const banned of [/'use server'/, /<form/i, /<button/i, /method:\s*'POST'/, /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /onClick/, /"rawBody",/, /"sourceData"/, /secretHash/, /lookupId/]) {
      assert.equal(banned.test(src), false, `forbidden pattern ${banned}`)
    }
  }
})

test('no fifth V1 endpoint and no new API route', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
  const v1 = walk('app/api/v1').sort()
  assert.deepEqual(v1, ['app/api/v1/evidence/[id]/route.ts', 'app/api/v1/evidence/route.ts', 'app/api/v1/health/route.ts', 'app/api/v1/requests/[id]/route.ts'])
  assert.equal(walk('app/api').some((p) => /platform|operator|scout/i.test(p)), false)
})

test('request → raw → evidence → PROCESSED → provenance is visible; secrets and raw bodies are not', async () => {
  const h = await harness({ processor: async () => {} })
  try {
    const { token, id: keyId } = await h.service.createKey({ name: 'scout', mode: 'test' })
    const res = await submitScoutDiscovery(clone(npwsSac002162Discovery), { apiKey: token, baseUrl: 'https://bioveracity.test', fetch: h.makeSdkFetch() })
    // A rejected request (bad credential) must also be visible, with no evidence.
    await h.handle('POST', '/api/v1/evidence', { token: 'bv_test_' + 'c'.repeat(24) + '_' + 'd'.repeat(48), body: {} })

    const view = await loadPlatformOperatorView(h.db)
    assert.equal(view.counts.evidence, 1)
    assert.equal(view.counts.raw, 1)
    assert.equal(view.counts.requests, 2)
    assert.equal(view.counts.active_keys, 1)
    assert.deepEqual(view.counts.by_status, { PROCESSED: 1 })

    const chain = view.chains[0]
    assert.equal(chain.evidence.id, res.evidence_id)
    assert.equal(chain.evidence.processing_status, 'PROCESSED')
    assert.equal(chain.evidence.mode, 'test')
    assert.equal(chain.evidence.api_key_id, keyId)
    assert.equal(chain.evidence.source_url, 'https://www.npws.ie/protected-sites/sac/002162')
    assert.equal(chain.evidence.source_external_id, '002162')
    assert.equal(chain.evidence.retrieval_time, '2026-09-27T21:14:53.000Z')
    assert.equal(chain.evidence.publication_time, null)
    assert.equal((chain.evidence.provenance as any).licence, 'CC BY 4.0')
    assert.equal((chain.evidence.provenance as any).source_locator.includes('SITECODE = 002162'), true)
    assert.equal(chain.raw?.id, res.raw_evidence_id)
    assert.ok((chain.raw?.bytes ?? 0) > 100)
    assert.equal(chain.requests.length, 1)
    assert.equal(chain.requests[0].id, res.request_id)
    assert.equal(chain.requests[0].status, 201)
    const stages = (chain.requests[0].trace as { stage: string }[]).map((t) => t.stage)
    assert.deepEqual(stages.slice(0, 5), ['received', 'authenticated', 'validated', 'raw_persisted', 'evidence_id'])
    assert.match(String(chain.requests[0].idempotency_key_digest), /^sha256:[0-9a-f]{12}$/)

    const failed = view.recent_requests.find((r) => r.status === 401)
    assert.ok(failed && failed.evidence_id === null && failed.error_code === 'invalid_api_key')

    const serialised = JSON.stringify(view)
    assert.equal(serialised.includes(token), false, 'no plaintext credential')
    assert.equal(serialised.includes('d'.repeat(48)), false)
    assert.equal(serialised.includes(res.idempotency_key), false, 'idempotency key shown as digest only')
    assert.equal(serialised.includes('Old Red Sandstone'), false)
    assert.equal(serialised.includes('source_record'), false, 'raw source_data not exposed')
    const keyRow = await h.db.query<any>('SELECT "secretHash","lookupId" FROM "PlatformApiKey" WHERE "id" = $1', [keyId])
    assert.equal(serialised.includes(keyRow[0].secretHash), false)
    assert.equal(serialised.includes(keyRow[0].lookupId), false)

    // Read-only: the view leaves every table byte-for-byte unchanged.
    const snap = async () => JSON.stringify(await Promise.all(['PlatformApiKey', 'PlatformRawEvidence', 'PlatformEvidence', 'PlatformIdempotency', 'PlatformRequest'].map((t) => h.db.query(`SELECT * FROM "${t}" ORDER BY "id"`, []))))
    const before = await snap()
    await loadPlatformOperatorView(h.db)
    assert.equal(await snap(), before)
  } finally {
    await h.pg.close()
  }
})
