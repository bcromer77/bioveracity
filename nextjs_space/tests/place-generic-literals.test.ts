import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Permanent guard: the universal Place Experience code must never contain
// Place-, county- or designation-specific literals. Individual Places are data,
// never code paths. Place-specific source adapters live in lib/place-memory/.
const root = process.cwd()
const GENERIC_DIRS = ['lib/place', 'components/place']
const FORBIDDEN = [/tralee/i, /kerry/i, /004188/]

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function forbiddenLiterals(path: string, source: string): string[] {
  return FORBIDDEN.filter((re) => re.test(source)).map((re) => `${path}: ${re}`)
}

test('detector self-test flags each forbidden literal in any case', () => {
  assert.equal(forbiddenLiterals('x', 'const s = "TRALEE"').length, 1)
  assert.equal(forbiddenLiterals('x', '// County Kerry').length, 1)
  assert.equal(forbiddenLiterals('x', "code = 'IE0004188'").length, 1)
  assert.deepEqual(forbiddenLiterals('x', 'export const PLACE_ID_PREFIX = "bv_place_"'), [])
})

test('generic lib/place and components/place code contains no Tralee, Kerry or 004188 literals', () => {
  const scanned = GENERIC_DIRS.flatMap((dir) => files(join(root, dir)))
  assert.ok(scanned.some((path) => path.endsWith(join('lib', 'place', 'identity.ts'))), 'guard must not be vacuous')
  const findings = scanned.flatMap((path) => forbiddenLiterals(relative(root, path), readFileSync(path, 'utf8')))
  assert.deepEqual(findings, [])
})
