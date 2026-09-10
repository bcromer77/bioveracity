// Pre-bundles the forked upload parser into a single self-contained ES module
// with NO runtime node_modules dependencies. The result is committed to the
// repository at public/parser/worker.mjs so the deploy packaging step (which
// unconditionally copies public/ into the standalone artifact) always ships it,
// independent of the platform-managed next.config.js file-tracing config.
//
// The parser runs in an isolated child process (see lib/workspaces/parser.ts).
// Its heavy dependencies (pdfjs-dist, mammoth, mailparser) load dynamically at
// runtime and are therefore invisible to the Next.js build tracer. Inlining
// them here removes that gap: the worker needs nothing from node_modules on the
// deployed host.
//
// Alongside the bundle this script writes two companion artifacts so the
// committed bundle stays auditable and verifiable:
//   * public/parser/worker.LICENSES.txt  - third-party licence notices for
//     every package inlined into the bundle (esbuild strips inline licence
//     comments via legalComments:'none', so they are preserved here instead).
//   * public/parser/worker.manifest.json - hashes of the bundle and its
//     sources plus dependency/esbuild versions, consumed by
//     scripts/check-parser-worker.mjs to detect drift.
//
// Regenerate with:  node scripts/build-parser-worker.mjs   (or: yarn build:worker)
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  root,
  outfile,
  licensesFile,
  manifestFile,
  sourceFiles,
  buildOptions,
} from './parser-worker.config.mjs'

const require = createRequire(import.meta.url)
const esbuildVersion = require('esbuild/package.json').version
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const rel = (p) => path.relative(root, p).split(path.sep).join('/')

const result = await build(buildOptions({ outfile, write: true, metafile: true }))

// ---- Collect third-party licence notices for everything actually inlined ----
const pkgNames = new Set()
for (const input of Object.keys(result.metafile.inputs)) {
  const m = input.match(/node_modules\/((@[^/]+\/)?[^/]+)\//)
  if (m) pkgNames.add(m[1])
}

const licenceCandidates = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt',
  'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'COPYING', 'COPYING.md',
]

// Resolve a package's directory even when its `exports` map blocks the
// `<name>/package.json` subpath (Node throws ERR_PACKAGE_PATH_NOT_EXPORTED for
// packages such as entities, domhandler, htmlparser2, deepmerge-ts). Falling
// back to resolving the package entry and walking up to the package.json whose
// `name` matches recovers those directories so their attribution is never
// silently dropped.
function resolvePkgDir(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`))
  } catch {
    /* exports map may block the package.json subpath; fall through */
  }
  try {
    let dir = path.dirname(require.resolve(name))
    while (dir !== path.dirname(dir)) {
      const pj = path.join(dir, 'package.json')
      if (fs.existsSync(pj)) {
        try {
          if (JSON.parse(fs.readFileSync(pj, 'utf8')).name === name) return dir
        } catch {
          /* ignore malformed nested package.json */
        }
      }
      dir = path.dirname(dir)
    }
  } catch {
    /* fall through to node_modules scan */
  }
  for (const base of require.resolve.paths(name) || []) {
    const cand = path.join(base, ...name.split('/'))
    if (fs.existsSync(path.join(cand, 'package.json'))) return cand
  }
  return null
}

const deps = {}
const blocks = []
const unattributed = []
for (const name of [...pkgNames].sort()) {
  const pkgDir = resolvePkgDir(name)
  if (!pkgDir) {
    unattributed.push(name)
    continue
  }
  let meta = {}
  try {
    meta = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
  } catch {
    /* ignore */
  }
  deps[name] = meta.version || 'unknown'
  const spdx = meta.license || meta.licenses || 'UNSTATED'
  let licenceText = ''
  for (const cand of licenceCandidates) {
    const p = path.join(pkgDir, cand)
    if (fs.existsSync(p)) {
      licenceText = fs.readFileSync(p, 'utf8').trim()
      break
    }
  }
  const header = `${name}@${meta.version || '?'}  (${spdx})`
  blocks.push(
    `${'='.repeat(78)}\n${header}\n${'='.repeat(78)}\n\n` +
      (licenceText ||
        `(No licence file is bundled in this package. Its declared SPDX licence is "${spdx}" ` +
          '(from the package metadata above); no separate NOTICE/COPYING file was published.)'),
  )
}

// Fail loudly: a package inlined into the bundle whose attribution could not be
// collected must never be silently dropped from the licence notices.
if (unattributed.length) {
  throw new Error(
    `Unable to resolve licence attribution for inlined package(s): ${unattributed.join(', ')}. ` +
      'Fix resolvePkgDir() or add an explicit mapping before regenerating the bundle.',
  )
}

const licencesHeader =
  'THIRD-PARTY LICENCE NOTICES\n' +
  'public/parser/worker.mjs is a generated bundle that inlines the packages\n' +
  'listed below. Their licence texts are reproduced here to satisfy the\n' +
  'attribution requirements of the licences. This file is generated by\n' +
  'scripts/build-parser-worker.mjs; do not edit by hand.\n'
const licencesContent = `${licencesHeader}\n${blocks.join('\n\n')}\n`
fs.writeFileSync(licensesFile, licencesContent)

// ---- Write the integrity manifest -----------------------------------------
const sources = {}
for (const f of sourceFiles) {
  sources[rel(f)] = sha256(fs.readFileSync(f))
}
const manifest = {
  description:
    'Integrity manifest for public/parser/worker.mjs. Regenerate with ' +
    'yarn build:worker; verify with yarn check:worker.',
  esbuildVersion,
  deps,
  sources,
  worker: sha256(fs.readFileSync(outfile)),
  licenses: sha256(Buffer.from(licencesContent)),
}
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

console.log('Bundled parser worker ->', rel(outfile))
console.log('Licence notices       ->', rel(licensesFile), `(${pkgNames.size} packages)`)
console.log('Integrity manifest    ->', rel(manifestFile))
