import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  PLACE_ID_MAX_SUFFIX_LENGTH,
  PLACE_ID_PREFIX,
  assertPlaceId,
  assertPlaceIdentityUnchanged,
  hasPlaceIdShape,
  isPlaceId,
} from '../lib/place/identity'
import { searchPlaceMemory } from '../lib/place-memory/retrieval'
import { validateQrObservationDraft } from '../lib/place-memory/qr-contract'
import type { Sql } from '../lib/workspaces/service'

// The two literal patterns that existed before the shared validator. The shared
// validator must be behaviourally identical to each at its call site.
const LEGACY_RETRIEVAL_RE = /^bv_place_[a-z0-9_]{1,120}$/
const LEGACY_QR_RE = /^bv_place_[a-z0-9_]+$/

const corpus = [
  '', 'bv_place_', 'bv_place_a', 'bv_place_synthetic_one', 'bv_place_ZZ', 'bv_place_a-b', 'bv_place_a b',
  ' bv_place_a', 'bv_place_a ', 'bv_place_a\n', 'BV_PLACE_a', 'bv_placea', 'xbv_place_a', 'bv_place_é',
  'bv_place_0', 'bv_place___', 'bv_place_a.b', 'bv_place_a/b', 'bv_place_%61', 'asset_1', 'tralee-bay',
  `bv_place_${'a'.repeat(119)}`, `bv_place_${'a'.repeat(120)}`, `bv_place_${'a'.repeat(121)}`,
  `bv_place_${'a'.repeat(151)}`, `bv_place_${'a'.repeat(152)}`, `bv_place_${'z9_'.repeat(60)}`,
]

test('shared validator is identical to the former retrieval and QR patterns (no behaviour change)', () => {
  for (const value of corpus) {
    assert.equal(isPlaceId(value), LEGACY_RETRIEVAL_RE.test(value), `retrieval parity: ${JSON.stringify(value)}`)
    assert.equal(hasPlaceIdShape(value), LEGACY_QR_RE.test(value), `QR parity: ${JSON.stringify(value)}`)
  }
  assert.equal(PLACE_ID_PREFIX, 'bv_place_')
  assert.equal(PLACE_ID_MAX_SUFFIX_LENGTH, 120)
})

test('canonical Place ID accepts prefix + 1..120 lower-case alphanumerics/underscores and nothing else', () => {
  assert.equal(isPlaceId('bv_place_synthetic_one'), true)
  assert.equal(isPlaceId(`bv_place_${'a'.repeat(120)}`), true)
  assert.equal(isPlaceId(`bv_place_${'a'.repeat(121)}`), false)
  assert.equal(isPlaceId('bv_place_'), false)
  assert.equal(isPlaceId('tralee-bay'), false, 'a slug is never a Place ID')
  assert.equal(isPlaceId('bv_place_A'), false)
  assert.equal(assertPlaceId('bv_place_x'), 'bv_place_x')
  assert.throws(() => assertPlaceId('slug-like'), /Invalid place id/)
  assert.throws(() => assertPlaceId('x', 'custom'), /custom/)
})

const refusingSql: Sql = { query: async () => { throw new Error('database must not be reached') } }

test('retrieval still rejects an invalid Place ID before any database access', async () => {
  for (const placeId of ['', 'bv_place_', 'tralee-bay', `bv_place_${'a'.repeat(121)}`, 'bv_place_A']) {
    await assert.rejects(searchPlaceMemory(refusingSql, { kind: 'public' }, { placeId }), /Invalid place id/)
  }
  // A valid id passes validation and proceeds to the (refusing) database.
  await assert.rejects(searchPlaceMemory(refusingSql, { kind: 'public' }, { placeId: 'bv_place_synthetic_one' }), /database must not be reached/)
})

const baseDraft = {
  originalLanguage: 'en', originalText: 'Unidentified bird', observedAt: null, observedPrecision: 'unknown',
  location: { geometry: null, crs: null, spatialUncertaintyMeters: null, precision: 'UNKNOWN' },
  media: [], attribution: { state: 'ANONYMOUS', publicLabel: null }, claimedObservation: { text: 'Unidentified bird' },
  machineInterpretation: null, licence: null,
  consent: { venuePublication: false, widerReuse: false, recordedAt: '2026-09-28T12:00:00Z' },
  sensitiveLocation: false, locationDisclosure: 'NAMED_ONLY',
}

test('QR draft contract keeps its exact Place ID behaviour (shape + 160 total, not the 120 suffix bound)', () => {
  assert.equal(validateQrObservationDraft({ ...baseDraft, placeId: 'bv_place_synthetic_one' }).placeId, 'bv_place_synthetic_one')
  // 151-char suffix = 160 total: accepted before and after (behaviour preserved, divergence recorded in ADR-0001 §9).
  const long = `bv_place_${'a'.repeat(151)}`
  assert.equal(validateQrObservationDraft({ ...baseDraft, placeId: long }).placeId, long)
  assert.throws(() => validateQrObservationDraft({ ...baseDraft, placeId: `bv_place_${'a'.repeat(152)}` }), /Invalid place identity/)
  for (const placeId of ['tralee-bay', 'bv_place_', 'bv_place_A', 'bv_place_a-b']) {
    assert.throws(() => validateQrObservationDraft({ ...baseDraft, placeId }), /Invalid place identity/)
  }
})

test('Asset.id immutability guard refuses any identity change for a Place and any rename into a Place ID', () => {
  assert.doesNotThrow(() => assertPlaceIdentityUnchanged('bv_place_synthetic_one', { name: 'Renamed', slug: 'new-slug' }))
  assert.doesNotThrow(() => assertPlaceIdentityUnchanged('asset_ordinary', { id: 'asset_other' }))
  assert.throws(() => assertPlaceIdentityUnchanged('bv_place_synthetic_one', { id: 'bv_place_synthetic_two' }), /place_identity_immutable/)
  assert.throws(() => assertPlaceIdentityUnchanged('bv_place_synthetic_one', { id: 'bv_place_synthetic_one' }), /place_identity_immutable/)
  assert.throws(() => assertPlaceIdentityUnchanged('bv_place_synthetic_one', { id: undefined }), /place_identity_immutable/)
  assert.throws(() => assertPlaceIdentityUnchanged('asset_ordinary', { id: 'bv_place_synthetic_one' }), /place_identity_immutable/)
})

// ---- Static guard: no application write path may change Asset.id -------------

const root = process.cwd()
const SCAN_DIRS = ['app', 'lib', 'scripts', 'components']

function sourceFiles(dir: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path))
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) out.push(path)
  }
  return out
}

/** Returns the text of the balanced {...} starting at index `open`. */
function balanced(source: string, open: number): string {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(open, i + 1)
  }
  return source.slice(open)
}

/** True if the object literal text has a top-level `id` key. */
function hasTopLevelId(objectText: string): boolean {
  let depth = 0
  for (let i = 0; i < objectText.length; i++) {
    const c = objectText[i]
    if (c === '{' || c === '[' || c === '(') depth++
    else if (c === '}' || c === ']' || c === ')') depth--
    else if (depth === 1 && /[\s,{]/.test(objectText[i - 1] ?? '') && /^id\s*:/.test(objectText.slice(i))) return true
  }
  return false
}

function assetIdMutations(file: string, source: string): string[] {
  const findings: string[] = []
  // Prisma: asset.update / updateMany `data: {...}` and asset.upsert `update: {...}`.
  for (const call of source.matchAll(/\basset\s*\.\s*(update|updateMany|upsert)\s*\(/g)) {
    const start = call.index! + call[0].length
    const window = source.slice(start, start + 20000)
    const key = call[1] === 'upsert' ? /\bupdate\s*:\s*\{/ : /\bdata\s*:\s*\{/
    const m = key.exec(window)
    if (!m) continue
    const objectText = balanced(window, m.index + m[0].length - 1)
    if (hasTopLevelId(objectText)) findings.push(`${file}: prisma asset.${call[1]} writes id`)
  }
  // Raw SQL: UPDATE "Asset" SET ... id = ...  (SET clause only, WHERE excluded).
  for (const m of source.matchAll(/UPDATE\s+"?Asset"?\s+SET\s+([\s\S]*?)(\bWHERE\b|;|`|$)/gi)) {
    if (/(^|[\s,"])"?id"?\s*=/.test(m[1])) findings.push(`${file}: raw UPDATE "Asset" sets id`)
  }
  // Raw SQL upsert into Asset whose conflict action updates id.
  for (const m of source.matchAll(/INSERT\s+INTO\s+"?Asset"?\b[\s\S]*?ON\s+CONFLICT[\s\S]*?DO\s+UPDATE\s+SET\s+([\s\S]*?)(\bWHERE\b|;|`|$)/gi)) {
    if (/(^|[\s,"])"?id"?\s*=/.test(m[1])) findings.push(`${file}: raw Asset upsert updates id`)
  }
  return findings
}

test('static guard detector catches identity writes (self-test)', () => {
  assert.deepEqual(assetIdMutations('x', 'prisma.asset.update({ where: { id: a }, data: { name: b } })'), [])
  assert.equal(assetIdMutations('x', 'prisma.asset.update({ where: { id: a }, data: { id: b } })').length, 1)
  assert.equal(assetIdMutations('x', 'prisma.asset.upsert({ where: { id: a }, create: { id: a }, update: { id: b } })').length, 1)
  assert.deepEqual(assetIdMutations('x', 'prisma.asset.upsert({ where: { id: a }, create: { id: a }, update: { name: n } })'), [])
  assert.equal(assetIdMutations('x', 'UPDATE "Asset" SET name=$1, id=$2 WHERE id=$3').length, 1)
  assert.deepEqual(assetIdMutations('x', 'UPDATE "Asset" SET name=$1 WHERE id=$2'), [])
  assert.equal(assetIdMutations('x', 'INSERT INTO "Asset" (id) VALUES ($1) ON CONFLICT (slug) DO UPDATE SET id=$1').length, 1)
  assert.deepEqual(assetIdMutations('x', 'INSERT INTO "Asset" (id) VALUES ($1) ON CONFLICT (id) DO NOTHING'), [])
})

test('no application, library or script write path can change Asset.id', () => {
  const files = SCAN_DIRS.flatMap((dir) => sourceFiles(join(root, dir)))
  assert.ok(files.length > 100, 'scan must cover the application tree')
  const findings = files.flatMap((file) => assetIdMutations(relative(root, file), readFileSync(file, 'utf8')))
  assert.deepEqual(findings, [])
})
