// Reproducible integrity check for the committed parser worker bundle.
//
// Fails (non-zero exit) when public/parser/worker.mjs no longer matches the
// source files or the pinned dependencies it was built from - i.e. when someone
// edited the parser sources, bumped pdfjs-dist/mammoth/mailparser, or changed
// the esbuild version without regenerating the committed bundle.
//
// It performs two independent checks:
//   1. Manifest check - recomputes SHA-256 of the committed bundle, licence
//      file and source files, and compares dependency + esbuild versions to
//      public/parser/worker.manifest.json.
//   2. Rebuild check   - re-runs esbuild in memory (write:false) and compares
//      the freshly produced bytes to the committed bundle. esbuild output is
//      deterministic for a given version and input graph, so any drift in a
//      direct or transitive dependency is caught here even if the manifest was
//      hand-edited.
//
// Run with:  node scripts/check-parser-worker.mjs   (or: yarn check:worker)
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
  bundledDeps,
  buildOptions,
} from './parser-worker.config.mjs'

const require = createRequire(import.meta.url)
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const rel = (p) => path.relative(root, p).split(path.sep).join('/')

const problems = []
const ok = (msg) => console.log(`  ok   ${msg}`)
const fail = (msg) => {
  problems.push(msg)
  console.log(`  FAIL ${msg}`)
}

for (const f of [outfile, licensesFile, manifestFile]) {
  if (!fs.existsSync(f)) {
    console.error(`Missing generated artifact: ${rel(f)}. Run: yarn build:worker`)
    process.exit(1)
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))

console.log('Manifest check:')
const esbuildVersion = require('esbuild/package.json').version
if (esbuildVersion === manifest.esbuildVersion) ok(`esbuild ${esbuildVersion}`)
else fail(`esbuild version ${esbuildVersion} != manifest ${manifest.esbuildVersion}`)

for (const name of bundledDeps) {
  let version = 'missing'
  try {
    version = require(`${name}/package.json`).version
  } catch {
    /* keep missing */
  }
  if (version === manifest.deps?.[name]) ok(`${name}@${version}`)
  else fail(`${name} version ${version} != manifest ${manifest.deps?.[name]}`)
}

for (const f of sourceFiles) {
  const key = rel(f)
  const actual = sha256(fs.readFileSync(f))
  if (actual === manifest.sources?.[key]) ok(`source ${key}`)
  else fail(`source ${key} sha changed since bundle was built`)
}

const committedWorker = fs.readFileSync(outfile)
if (sha256(committedWorker) === manifest.worker) ok('worker.mjs matches manifest hash')
else fail('worker.mjs sha does not match manifest')

if (sha256(fs.readFileSync(licensesFile)) === manifest.licenses) ok('worker.LICENSES.txt matches manifest hash')
else fail('worker.LICENSES.txt sha does not match manifest')

console.log('Rebuild check:')
const result = await build(buildOptions({ write: false, metafile: false }))
const rebuilt = Buffer.from(result.outputFiles[0].contents)
if (sha256(rebuilt) === sha256(committedWorker)) {
  ok('re-bundled output is byte-identical to the committed worker.mjs')
} else {
  fail(
    're-bundled output differs from committed worker.mjs ' +
      '(source or dependency changed without running yarn build:worker)',
  )
}

if (problems.length) {
  console.error(`\nParser worker integrity check FAILED (${problems.length} problem(s)).`)
  console.error('Regenerate the committed artifacts with:  yarn build:worker')
  process.exit(1)
}
console.log('\nParser worker integrity check passed.')
