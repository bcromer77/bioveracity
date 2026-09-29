import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import QRCode from 'qrcode'
import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '../lib/workspaces/service'
import {
  ACCESS_NOT_FOUND,
  PLACE_ACCESS_QR_OPTIONS,
  PUBLIC_ACCESS_ID_ALPHABET,
  PUBLIC_ACCESS_HEADERS,
  PUBLIC_ACCESS_ID_LENGTH,
  PUBLIC_ACCESS_NOT_FOUND_BODY,
  PlaceAccessError,
  publicAccessResponse,
  accessPointQrPayload,
  generatePublicAccessId,
  isPublicAccessId,
  issueAccessPoint,
  publicAccessPath,
  publicPlaceOrigin,
  resolvePublicAccessPoint,
  revokeAccessPoint,
  type PublicAccessId,
} from '../lib/place/access-points'
import { handleAccessPointAction, handleAccessPointQr, isPlaceAccessOperatorEnabled } from '../lib/place/access-operator'
import { assignCanonicalPlaceSlug } from '../lib/place/slugs'

// Synthetic, Place-neutral fixtures only (ADR-0001 §5).
const root = process.cwd()
const MIGRATIONS = [
  '0000_init', '20260909_private_workspace_foundation', '20260920_observation_revisions',
  '20261001_developer_platform_v1', '20261003_kerry_place_memory_v1', '20261004_place_slug_history',
  '20261005_place_access_point',
]
const ALPHA = 'bv_place_synthetic_alpha'
const BETA = 'bv_place_synthetic_beta'
const PRIVATE_ONLY = 'bv_place_synthetic_private_only'
const NO_SLUG = 'bv_place_synthetic_no_slug'
const INACTIVE = 'bv_place_synthetic_inactive'
const EMPTY = 'bv_place_synthetic_empty'
const ORIGIN = 'https://places.example.org'
const ON_ENV = { PLACE_EXPERIENCE_ENABLED: 'true', PLACE_ACCESS_OPERATOR_ENABLED: 'true', PLACE_PUBLIC_ORIGIN: ORIGIN }
const ADMIN = { user: { id: 'u_admin', role: 'admin' } }
const j = (v: unknown) => JSON.stringify(v)
const CLEARED = { licence: 'Open Licence 1.0', rights_class: 'CLEARED_FOR_INGEST', attribution: 'Synthetic Publisher' }

let clock = Date.parse('2026-10-05T09:00:00.000Z')
const tick = () => new Date((clock += 1000))

async function harness() {
  const pg = new PGlite()
  for (const m of MIGRATIONS) await pg.exec(readFileSync(join(root, 'prisma/migrations', m, 'migration.sql'), 'utf8'))
  const log: string[] = []
  const sql = (client: Pick<PGlite, 'query'>): Sql => ({
    query: async <T>(text: string, values: unknown[]) => { log.push(text); return (await client.query<T>(text, values)).rows },
  })
  const db: Database = { ...sql(pg), transaction: (op) => pg.transaction((tx) => op(sql(tx))) }
  const q = <T = Record<string, unknown>>(text: string, values: unknown[] = []) => pg.query<T>(text, values)
  const places: [string, string, string][] = [
    [ALPHA, 'Alpha Marsh', 'active'], [BETA, 'Beta Fen', 'active'], [PRIVATE_ONLY, 'Private Place', 'active'],
    [NO_SLUG, 'No Slug Place', 'active'], [INACTIVE, 'Inactive Place', 'archived'], [EMPTY, 'Empty Place', 'active'],
  ]
  for (const [id, name, status] of places) {
    await q(`INSERT INTO "Asset" (id,slug,name,type,region,"regionSlug",status,"updatedAt") VALUES ($1,$2,$3,'living_place','r','r',$4,now())`,
      [id, id.replace(/_/g, '-'), name, status])
  }
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId") VALUES ('alpha-marsh',$1),('beta-fen',$2),('private-place',$3),('inactive-place',$4),('empty-place',$5)`,
    [ALPHA, BETA, PRIVATE_ONLY, INACTIVE, EMPTY])
  await q(`INSERT INTO "PlaceSlug" (slug,"placeId","retiredAt") VALUES ('no-slug-old',$1,now())`, [NO_SLUG])
  await q(`INSERT INTO "PrivateWorkspace" (id,name) VALUES ('ws_sentinel','SENTINEL_WORKSPACE')`)
  await q(`INSERT INTO "PlatformApiKey" (id,name,mode,"lookupId","secretHash") VALUES ('ak_s','k','live','L','H')`)
  const items: [string, string, string, string, string | null][] = [
    ['m_alpha', ALPHA, 'PUBLIC', 'CLEARED_FOR_INGEST', null],
    ['m_beta', BETA, 'PUBLIC', 'CLEARED_FOR_INGEST', null],
    ['m_private', PRIVATE_ONLY, 'WORKSPACE_PRIVATE', 'NOT_CLEARED', 'ws_sentinel'],
    ['m_noslug', NO_SLUG, 'PUBLIC', 'CLEARED_FOR_INGEST', null],
    ['m_inactive', INACTIVE, 'PUBLIC', 'CLEARED_FOR_INGEST', null],
  ]
  for (const [i, [id, place, visibility, rights, ws]] of items.entries()) {
    await q(`INSERT INTO "PlatformRawEvidence" (id,"apiKeyId",mode,"payloadFingerprint","rawBody","requestId") VALUES ($1,'ak_s','live',$2,'{}'::jsonb,$3)`,
      [`raw_${id}`, `fp_${id}`, `req_${id}`])
    await q(`INSERT INTO "PlatformEvidence" (id,"apiKeyId",mode,"rawEvidenceId",provider,"sourceExternalId","evidenceType",publisher,"sourceUrl","retrievalTime","sourceData",provenance,"processingStatus","requestId","idempotencyKey")
      VALUES ($1,'ak_s','live',$2,'synthetic',$3,'t','Synthetic Publisher','https://example.org/source','2026-01-02T03:04:05Z','{}'::jsonb,$4::jsonb,'PROCESSED',$5,'idem_' || $1)`,
      [`ev_${id}`, `raw_${id}`, `SRC-${i}`, j(CLEARED), `req_${id}`])
    await q(`INSERT INTO "PlaceMemoryItem" (id,"itemKey","placeId","platformEvidenceId","workspaceId",kind,"evidenceClass",visibility,"rightsState","originalStatement","sourceIndependenceKey","geographyPrecision","locationDisclosure",uncertainty,status)
      VALUES ($1,$1,$2,$3,$4,'OBSERVATION','PROFESSIONAL_OBSERVATION',$5,$6,'Synthetic statement','k','named site','NAMED_ONLY','{}'::jsonb,'ACTIVE')`,
      [id, place, `ev_${id}`, ws, visibility, rights])
    await q(`INSERT INTO "PlaceMemorySourceLink" ("itemId","platformEvidenceId",relationship,"sourceIndependenceKey") VALUES ($1,$2,'PRIMARY','k')`, [id, `ev_${id}`])
  }
  const issue = (placeId: string) => issueAccessPoint(db, placeId, { now: tick })
  const revoke = (id: string) => revokeAccessPoint(db, id, { now: tick })
  return { pg, db, log, q, issue, revoke }
}

async function rejectsSql(pg: PGlite, text: string, values: unknown[], pattern: RegExp) {
  await assert.rejects(pg.query(text, values), (e: unknown) => pattern.test(String((e as Error).message)), text)
}
async function rejectsCode(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof PlaceAccessError && e.code === code)
}

// ---------------------------------------------------------------- generation

test('generation: 22 base62 characters carry >= 128 bits and never repeat', () => {
  assert.equal(PUBLIC_ACCESS_ID_ALPHABET.length, 62)
  assert.equal(new Set(PUBLIC_ACCESS_ID_ALPHABET).size, 62)
  assert.ok(PUBLIC_ACCESS_ID_LENGTH * Math.log2(62) >= 128, 'entropy >= 128 bits')
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  for (let i = 0; i < 20000; i++) {
    const id = generatePublicAccessId()
    assert.ok(isPublicAccessId(id), id)
    assert.equal(id.length, 22)
    seen.add(id)
    for (const c of id) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  assert.equal(seen.size, 20000, 'no collisions across 20,000 identifiers')
  assert.equal(counts.size, 62, 'every base62 symbol appears')
  const expected = (20000 * 22) / 62
  for (const [c, n] of counts) assert.ok(Math.abs(n - expected) < expected * 0.1, `symbol ${c} is roughly uniform (${n})`)
})

test('generation: bytes >= 248 are rejected (no modulo bias) and the CSPRNG is the source', () => {
  const calls: number[] = []
  const fake = (size: number) => {
    calls.push(size)
    return Buffer.from(Array.from({ length: size }, (_, i) => (i % 2 === 0 ? 255 : 61)))
  }
  const id = generatePublicAccessId(fake)
  assert.equal(id, 'z'.repeat(22), 'every rejected 255 byte is skipped; 61 maps to the last symbol')
  assert.ok(calls.length >= 1)
  const src = readFileSync(join(root, 'lib/place/access-points.ts'), 'utf8')
  assert.match(src, /import \{ randomBytes \} from 'node:crypto'/)
  assert.ok(!/Math\.random/.test(src), 'Math.random is never used')
})

// ---------------------------------------------------------------------- shape

const MALFORMED: unknown[] = [
  '', 'a', 'A'.repeat(21), 'A'.repeat(23), 'A'.repeat(200), 'abcdefghijklmnopqrstu-', 'abcdefghijklmnopqrstu_',
  'abcdefghijklmnopqrstu.', 'abcdefghijklmnopqrst/v', '../../../../etc/passwd', '..%2F..%2F..%2Fetc%2Fp',
  'abcdefghijklmnopqrstu ', ' bcdefghijklmnopqrstuv', 'abcdefghijklmnopqrstu\n', 'abcdefghijklmnopqrstuß',
  'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖ', 'abcdefghijklmnopqrstu\u0000', 'abcdéfghijklmnopqrstuv'.normalize('NFD').slice(0, 22),
  'bv_place_synthetic_alpha', "abcdefghijk' OR '1'='1", null, undefined, 42, {}, ['AAAAAAAAAAAAAAAAAAAAAA'],
]

test('shape: malformed identifiers are rejected before any database lookup', async () => {
  const h = await harness()
  try {
    for (const bad of MALFORMED) {
      assert.equal(isPublicAccessId(bad), false, JSON.stringify(bad))
      h.log.length = 0
      assert.equal(await resolvePublicAccessPoint(h.db, bad), ACCESS_NOT_FOUND)
      assert.equal(h.log.length, 0, `no query for ${JSON.stringify(bad)}`)
    }
    assert.throws(() => publicAccessPath('../x'), (e: unknown) => e instanceof PlaceAccessError && e.code === 'malformed_access_id')
    for (const ok of ['0123456789ABCDEFGHIJKL', 'zzzzzzzzzzzzzzzzzzzzzz', generatePublicAccessId()]) assert.equal(isPublicAccessId(ok), true)
  } finally { await h.pg.close() }
})

// ----------------------------------------------------------------- resolution

test('resolution: active access point -> Place ID -> current canonical slug, following renames', async () => {
  const h = await harness()
  try {
    const a = await h.issue(ALPHA)
    assert.ok(isPublicAccessId(a.publicAccessId))
    assert.equal(a.placeId, ALPHA)
    assert.deepEqual(await resolvePublicAccessPoint(h.db, a.publicAccessId), { outcome: 'redirect', status: 307, location: '/place/alpha-marsh' })
    await assignCanonicalPlaceSlug(h.db, ALPHA, 'alpha-marsh-renamed', { now: tick })
    assert.deepEqual(await resolvePublicAccessPoint(h.db, a.publicAccessId), { outcome: 'redirect', status: 307, location: '/place/alpha-marsh-renamed' },
      'redirect targets the CURRENT slug, never a retired one')
    const rows = (await h.q('SELECT "publicAccessId","placeId" FROM "PlaceAccessPoint"')).rows
    assert.deepEqual(rows, [{ publicAccessId: a.publicAccessId, placeId: ALPHA }], 'rename never touches the access point')
  } finally { await h.pg.close() }
})

test('404 uniformity: unknown, revoked, private, unpublished, unresolved, empty and errored all return one frozen not_found', async () => {
  const h = await harness()
  try {
    const revoked = await h.issue(ALPHA)
    await h.revoke(revoked.publicAccessId)
    const cases: Record<string, string> = {
      unknown: generatePublicAccessId(),
      revoked: revoked.publicAccessId,
      private: (await h.issue(PRIVATE_ONLY)).publicAccessId,
      unpublished: (await h.issue(INACTIVE)).publicAccessId,
      unresolved: (await h.issue(NO_SLUG)).publicAccessId,
      empty: (await h.issue(EMPTY)).publicAccessId,
      malformed: '../../etc/passwd',
    }
    for (const [label, id] of Object.entries(cases)) {
      const r = await resolvePublicAccessPoint(h.db, id)
      assert.equal(r, ACCESS_NOT_FOUND, label)
      assert.deepEqual(Object.keys(r), ['outcome'], `${label}: no reason, place or slug is carried`)
    }
    assert.ok(Object.isFrozen(ACCESS_NOT_FOUND))
    const broken: Sql = { query: async () => { throw new Error('relation "PlaceAccessPoint" does not exist') } }
    assert.equal(await resolvePublicAccessPoint(broken, generatePublicAccessId()), ACCESS_NOT_FOUND, 'store failure fails closed')
  } finally { await h.pg.close() }
})

test('cross-Place isolation: an access point only ever reaches its own Place', async () => {
  const h = await harness()
  try {
    const a = await h.issue(ALPHA)
    const b = await h.issue(BETA)
    assert.notEqual(a.publicAccessId, b.publicAccessId)
    assert.deepEqual(await resolvePublicAccessPoint(h.db, a.publicAccessId), { outcome: 'redirect', status: 307, location: '/place/alpha-marsh' })
    assert.deepEqual(await resolvePublicAccessPoint(h.db, b.publicAccessId), { outcome: 'redirect', status: 307, location: '/place/beta-fen' })
    await h.revoke(b.publicAccessId)
    assert.equal(await resolvePublicAccessPoint(h.db, b.publicAccessId), ACCESS_NOT_FOUND)
    assert.deepEqual(await resolvePublicAccessPoint(h.db, a.publicAccessId), { outcome: 'redirect', status: 307, location: '/place/alpha-marsh' },
      'revoking B never affects A')
    await rejectsSql(h.pg, 'UPDATE "PlaceAccessPoint" SET "placeId" = $1 WHERE "publicAccessId" = $2', [BETA, a.publicAccessId], /place_access_point_place_immutable/)
  } finally { await h.pg.close() }
})

// ------------------------------------------------------------ issue / revoke

test('issue and revoke: validation, unknown Place, idempotent final revocation, collision retry', async () => {
  const h = await harness()
  try {
    for (const bad of ['', 'asset_x', 'bv_place_UPPER', null, 1, 'bv_place_' + 'a'.repeat(121)]) await rejectsCode(issueAccessPoint(h.db, bad), 'malformed_place_id')
    await rejectsCode(issueAccessPoint(h.db, 'bv_place_synthetic_missing'), 'place_not_found')
    await rejectsCode(revokeAccessPoint(h.db, 'nope'), 'malformed_access_id')
    await rejectsCode(revokeAccessPoint(h.db, generatePublicAccessId()), 'access_point_not_found')

    const a = await h.issue(ALPHA)
    const first = await h.revoke(a.publicAccessId)
    assert.equal(first.alreadyRevoked, false)
    const again = await h.revoke(a.publicAccessId)
    assert.deepEqual(again, { ...first, alreadyRevoked: true }, 'second revoke keeps the original timestamp')

    const fixed = generatePublicAccessId()
    const dup = await issueAccessPoint(h.db, ALPHA, { generate: () => fixed })
    let n = 0
    const next = generatePublicAccessId()
    const retried = await issueAccessPoint(h.db, BETA, { generate: () => (n++ === 0 ? fixed : next) })
    assert.equal(dup.publicAccessId, fixed)
    assert.equal(retried.publicAccessId, next, 'a unique collision retries with a fresh identifier')
    await rejectsCode(issueAccessPoint(h.db, BETA, { generate: () => fixed as PublicAccessId, maxAttempts: 2 }), 'issue_retry_exhausted')
    const owners = (await h.q('SELECT "placeId" FROM "PlaceAccessPoint" WHERE "publicAccessId" = $1', [fixed])).rows
    assert.deepEqual(owners, [{ placeId: ALPHA }], 'an identifier is never re-issued to another Place')
  } finally { await h.pg.close() }
})

// ------------------------------------------------------- PostgreSQL protection

test('PostgreSQL guard: no re-keying, re-pointing, deletion, truncation or un-revocation', async () => {
  const h = await harness()
  try {
    const a = await h.issue(ALPHA)
    const id = a.publicAccessId
    await rejectsSql(h.pg, 'UPDATE "PlaceAccessPoint" SET "publicAccessId" = $1 WHERE "publicAccessId" = $2', [generatePublicAccessId(), id], /place_access_point_id_immutable/)
    await rejectsSql(h.pg, 'UPDATE "PlaceAccessPoint" SET "placeId" = $1 WHERE "publicAccessId" = $2', [BETA, id], /place_access_point_place_immutable/)
    await rejectsSql(h.pg, 'UPDATE "PlaceAccessPoint" SET "createdAt" = now() - interval \'1 day\' WHERE "publicAccessId" = $1', [id], /place_access_point_row_immutable/)
    await rejectsSql(h.pg, 'DELETE FROM "PlaceAccessPoint" WHERE "publicAccessId" = $1', [id], /place_access_point_never_deleted/)
    await rejectsSql(h.pg, 'TRUNCATE "PlaceAccessPoint"', [], /place_access_point_never_deleted/)
    await h.revoke(id)
    await rejectsSql(h.pg, 'UPDATE "PlaceAccessPoint" SET "revokedAt" = NULL WHERE "publicAccessId" = $1', [id], /place_access_point_revocation_final/)
    await rejectsSql(h.pg, 'UPDATE "PlaceAccessPoint" SET "revokedAt" = "revokedAt" + interval \'1 day\' WHERE "publicAccessId" = $1', [id], /place_access_point_revocation_final/)
    await rejectsSql(h.pg, 'UPDATE "Asset" SET id = $1 WHERE id = $2', ['bv_place_synthetic_moved', ALPHA], /place_access_point_place_immutable|foreign key constraint/)
    await rejectsSql(h.pg, 'DELETE FROM "Asset" WHERE id = $1', [ALPHA], /foreign key/)
    await rejectsSql(h.pg, 'INSERT INTO "PlaceAccessPoint" ("publicAccessId","placeId") VALUES ($1,$2)', ['short', ALPHA], /publicAccessId_format_check/)
    await rejectsSql(h.pg, 'INSERT INTO "PlaceAccessPoint" ("publicAccessId","placeId") VALUES ($1,$2)', [generatePublicAccessId(), 'asset_x'], /placeId_format_check/)
    await rejectsSql(h.pg, 'INSERT INTO "PlaceAccessPoint" ("publicAccessId","placeId") VALUES ($1,$2)', [id, BETA], /unique|duplicate/)
    const rows = (await h.q('SELECT "publicAccessId","placeId","revokedAt" IS NOT NULL AS revoked FROM "PlaceAccessPoint"')).rows
    assert.deepEqual(rows, [{ publicAccessId: id, placeId: ALPHA, revoked: true }])
  } finally { await h.pg.close() }
})

test('PostgreSQL guard: an access point blocks Asset.id changes via the ON UPDATE CASCADE path', async () => {
  const h = await harness()
  try {
    // A Place with access points but no slug history isolates the access-point guard.
    await h.q(`INSERT INTO "Asset" (id,slug,name,type,region,"regionSlug","updatedAt") VALUES ('bv_place_synthetic_solo','solo','Solo','living_place','r','r',now())`)
    await h.issue('bv_place_synthetic_solo')
    await rejectsSql(h.pg, 'UPDATE "Asset" SET id = $1 WHERE id = $2', ['bv_place_synthetic_solo_moved', 'bv_place_synthetic_solo'], /place_access_point_place_immutable/)
  } finally { await h.pg.close() }
})

// ------------------------------------------------------------------ QR payload

test('QR origin: only an exact configured https origin is admitted; the request Host is never an input', () => {
  assert.equal(publicPlaceOrigin({ PLACE_PUBLIC_ORIGIN: ORIGIN }), ORIGIN)
  assert.equal(publicPlaceOrigin({ PLACE_PUBLIC_ORIGIN: `${ORIGIN}/` }), ORIGIN)
  assert.equal(publicPlaceOrigin({ PLACE_PUBLIC_ORIGIN: 'https://places.example.org:8443' }), 'https://places.example.org:8443')
  for (const bad of [undefined, '', 'http://places.example.org', 'https://u:p@places.example.org', 'https://places.example.org/path',
    'https://places.example.org/?q=1', 'https://places.example.org/#x', 'javascript:alert(1)', 'places.example.org', ' https://places.example.org',
    'https://PLACES.example.org']) {
    assert.equal(publicPlaceOrigin({ PLACE_PUBLIC_ORIGIN: bad }), null, String(bad))
  }
  const id = generatePublicAccessId()
  assert.equal(accessPointQrPayload(ORIGIN, id), `${ORIGIN}/p/${id}`)
  assert.throws(() => accessPointQrPayload(ORIGIN, '../admin'))
  const operator = readFileSync(join(root, 'lib/place/access-operator.ts'), 'utf8')
  assert.ok(!/headers\.get\(['"]host|x-forwarded-host|request\.url/i.test(operator), 'QR code path never reads Host or the request URL')
})

test('QR SVG: payload is exactly origin + /p/ + id (byte-identical to an independent encoding), nosniff, no-store', async () => {
  const h = await harness()
  try {
    const a = await h.issue(ALPHA)
    const res = await handleAccessPointQr({ session: ADMIN, db: h.db, env: ON_ENV }, a.publicAccessId)
    assert.equal(res.status, 200)
    assert.equal(res.headers['Content-Type'], 'image/svg+xml')
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff')
    assert.equal(res.headers['Cache-Control'], 'no-store')
    const expected = await QRCode.toString(`${ORIGIN}/p/${a.publicAccessId}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 512, color: { dark: '#173d35', light: '#ffffff' } })
    assert.equal(res.body, expected)
    const segments = QRCode.create(`${ORIGIN}/p/${a.publicAccessId}`, { errorCorrectionLevel: 'M' }).segments
    assert.equal(segments.map((s: { data: Uint8Array | string }) => typeof s.data === 'string' ? s.data : Buffer.from(s.data).toString('utf8')).join(''), `${ORIGIN}/p/${a.publicAccessId}`)
    assert.ok(!res.body.includes(ALPHA) && !res.body.includes('alpha-marsh'), 'no Place ID or slug in the artefact')
    assert.deepEqual({ ...PLACE_ACCESS_QR_OPTIONS.color }, { dark: '#173d35', light: '#ffffff' })
    const dl = await handleAccessPointQr({ session: ADMIN, db: h.db, env: ON_ENV }, a.publicAccessId, true)
    assert.equal(dl.headers['Content-Disposition'], `attachment; filename="place-access-${a.publicAccessId}-qr.svg"`)
    await h.revoke(a.publicAccessId)
    assert.equal((await handleAccessPointQr({ session: ADMIN, db: h.db, env: ON_ENV }, a.publicAccessId)).status, 404, 'no QR for a revoked point')
    assert.equal((await handleAccessPointQr({ session: ADMIN, db: h.db, env: { ...ON_ENV, PLACE_PUBLIC_ORIGIN: 'http://evil.example' } }, a.publicAccessId)).status, 503)
    assert.equal((await handleAccessPointQr({ session: ADMIN, db: h.db, env: ON_ENV }, '../x')).status, 400)
  } finally { await h.pg.close() }
})

// --------------------------------------------------------------- operator auth

test('operator auth: unauthenticated 401, non-admin 403, flags absent 503, cross-origin 403; admin can issue and revoke', async () => {
  const h = await harness()
  try {
    const same = { origin: 'https://ops.example', requestOrigin: 'https://ops.example' }
    const issueBody = { action: 'issue', placeId: ALPHA }
    const ctx = (session: unknown, env: Record<string, string | undefined> = ON_ENV) => ({ session, db: h.db, env })
    for (const [session, status] of [[null, 401], [{}, 401], [{ user: { role: 'user' } }, 403], [{ user: { role: 'Admin' } }, 403], [{ user: {} }, 403]] as const) {
      assert.equal((await handleAccessPointAction(ctx(session), { ...same, body: issueBody })).status, status, JSON.stringify(session))
      assert.equal((await handleAccessPointQr(ctx(session), generatePublicAccessId())).status, status)
    }
    assert.equal(isPlaceAccessOperatorEnabled({}), false, 'dark by default')
    for (const env of [{}, { PLACE_EXPERIENCE_ENABLED: 'true' }, { PLACE_ACCESS_OPERATOR_ENABLED: 'true' }, { PLACE_EXPERIENCE_ENABLED: 'TRUE', PLACE_ACCESS_OPERATOR_ENABLED: 'true' }]) {
      assert.equal((await handleAccessPointAction(ctx(ADMIN, env), { ...same, body: issueBody })).status, 503, JSON.stringify(env))
    }
    assert.equal((await handleAccessPointAction(ctx(ADMIN), { origin: 'https://evil.example', requestOrigin: 'https://ops.example', body: issueBody })).status, 403)
    assert.equal((await handleAccessPointAction(ctx(ADMIN), { origin: null, requestOrigin: 'https://ops.example', body: issueBody })).status, 403)
    assert.equal((await h.q<{ n: number }>('SELECT COUNT(*)::int AS n FROM "PlaceAccessPoint"')).rows[0].n, 0, 'no denied request wrote anything')

    const issued = await handleAccessPointAction(ctx(ADMIN), { ...same, body: issueBody })
    assert.equal(issued.status, 201)
    const { publicAccessId } = JSON.parse(issued.body)
    assert.ok(isPublicAccessId(publicAccessId))
    assert.equal((await handleAccessPointAction(ctx(ADMIN), { ...same, body: { action: 'issue', placeId: 'bv_place_synthetic_missing' } })).status, 404)
    assert.equal((await handleAccessPointAction(ctx(ADMIN), { ...same, body: { action: 'issue', placeId: '../x' } })).status, 400)
    assert.equal((await handleAccessPointAction(ctx(ADMIN), { ...same, body: { action: 'delete', publicAccessId } })).status, 400)
    const revoked = await handleAccessPointAction(ctx(ADMIN), { ...same, body: { action: 'revoke', publicAccessId } })
    assert.equal(revoked.status, 200)
    assert.equal(JSON.parse(revoked.body).alreadyRevoked, false)
    assert.equal(await resolvePublicAccessPoint(h.db, publicAccessId), ACCESS_NOT_FOUND)
  } finally { await h.pg.close() }
})

// ------------------------------------------------------------- route contract

const walk = (dir: string): string[] => !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

test('/p response: bodiless 307 to /place only; every not_found is one byte-identical 404 that echoes nothing', () => {
  const ok = publicAccessResponse({ outcome: 'redirect', status: 307, location: '/place/alpha-marsh' })
  assert.deepEqual(ok, { status: 307, body: null, headers: { ...PUBLIC_ACCESS_HEADERS, Location: '/place/alpha-marsh' } })
  assert.equal(ok.headers['Cache-Control'], 'no-store')
  assert.equal(ok.headers['X-Robots-Tag'], 'noindex, nofollow')
  const nf = publicAccessResponse(ACCESS_NOT_FOUND)
  assert.equal(nf.status, 404)
  assert.equal(nf.body, PUBLIC_ACCESS_NOT_FOUND_BODY)
  assert.ok(!/<|script|bv_place_|place\//i.test(nf.body ?? ''), 'plain text, no markup and no identity')
  // A resolution that somehow points anywhere but /place/ is refused, never followed.
  for (const location of ['https://evil.example/', '//evil.example', '/api/x', '/p/x']) {
    assert.deepEqual(publicAccessResponse({ outcome: 'redirect', status: 307, location }), nf, location)
  }
  assert.ok(Object.isFrozen(PUBLIC_ACCESS_HEADERS))
})

test('/p end-to-end on the harness: active -> 307 current slug; unknown/revoked/malformed identical 404', async () => {
  const h = await harness()
  try {
    const a = await h.issue(ALPHA)
    const r = await h.issue(ALPHA)
    await h.revoke(r.publicAccessId)
    const at = async (raw: string) => publicAccessResponse(await resolvePublicAccessPoint(h.db, raw))
    assert.deepEqual(await at(a.publicAccessId), { status: 307, body: null, headers: { ...PUBLIC_ACCESS_HEADERS, Location: '/place/alpha-marsh' } })
    const nf = publicAccessResponse(ACCESS_NOT_FOUND)
    for (const raw of [r.publicAccessId, generatePublicAccessId(), 'abc', '../x', ALPHA, 'alpha-marsh']) assert.deepEqual(await at(raw), nf, raw)
  } finally { await h.pg.close() }
})

test('route contract: /p is flag-first, dynamic, resolve-only route handler; issuance exists only behind the operator boundary', () => {
  assert.ok(!existsSync(join(root, 'app/p/[publicAccessId]/page.tsx')), 'no page: a React render would add an RSC payload to the redirect')
  const page = readFileSync(join(root, 'app/p/[publicAccessId]/route.ts'), 'utf8')
  const body = page.slice(page.indexOf('export async function GET'))
  assert.ok(body.indexOf('isPlaceExperienceEnabled()') < body.indexOf('await params'), 'flag is checked before anything else')
  assert.match(page, /export const dynamic = 'force-dynamic'/)
  assert.match(page, /publicAccessResponse\(await resolvePublicAccessPoint\(placeAccessDb, publicAccessId\)\)/)
  assert.ok(!/export async function (POST|PUT|PATCH|DELETE)/.test(page), '/p is GET-only')
  assert.ok(!/permanentRedirect|issueAccessPoint|revokeAccessPoint|access-operator|30[18]/.test(page), '/p never issues, revokes or permanently redirects')
  const writers = walk(join(root, 'app')).filter((p) => /\.(ts|tsx)$/.test(p) && /issueAccessPoint|revokeAccessPoint|handleAccessPoint(Action|Qr)/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(writers.map((p) => relative(root, p)).sort(), ['app/api/admin/place-access/qr/[publicAccessId]/route.ts', 'app/api/admin/place-access/route.ts'])
  for (const p of writers) assert.match(readFileSync(p, 'utf8'), /session: await auth\(\)/, `${p} passes the server session to the operator gate`)
  const operator = readFileSync(join(root, 'lib/place/access-operator.ts'), 'utf8')
  assert.match(operator, /operatorAccess\(ctx\.session\)/)
  assert.ok(operator.indexOf('const denied = gate(ctx)') < operator.indexOf('issueAccessPoint(ctx.db'), 'gate precedes every write')
  const components = walk(join(root, 'components')).filter((p) => /access-points|access-operator|place-access/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(components, [], 'no customer or public UI reaches the access point controls')
})
