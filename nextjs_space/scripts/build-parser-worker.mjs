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
//
// Attribution is driven by esbuild's own input graph, not by re-resolving
// package names. Each inlined input file is mapped to the EXACT package
// directory that contains it - the last `node_modules/<pkg>` segment in its
// path - so nested and duplicated versions (e.g. htmlparser2's private copy of
// `entities`, or readable-stream's private `safe-buffer`) are attributed from
// the precise directory esbuild inlined rather than from a hoisted copy that
// might be a different version.
function inputToPkgDir(inputKey) {
  const norm = path.resolve(root, inputKey).split(path.sep).join('/')
  const marker = '/node_modules/'
  const idx = norm.lastIndexOf(marker)
  if (idx === -1) return null
  const after = norm.slice(idx + marker.length).split('/')
  const pkg = after[0].startsWith('@') ? `${after[0]}/${after[1]}` : after[0]
  return { pkg, dir: `${norm.slice(0, idx + marker.length)}${pkg}` }
}

// Case-insensitive match for licence, copying and NOTICE files, so variants the
// old fixed list missed (license.md, LICENSE-MIT.txt, LICENSE.markdown, a bare
// lowercase `license`, dual-licence LICENSE.MIT + LICENSE.EUPL-1.2, NOTICE) are
// all collected - and ALL matches are kept, not just the first.
const LICENCE_RE = /^(licen[cs]e|copying|notice)/i
function collectLicenceFiles(dir) {
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((n) => LICENCE_RE.test(n))
    .filter((n) => {
      try {
        return fs.statSync(path.join(dir, n)).isFile()
      } catch {
        return false
      }
    })
    .sort()
}

function authorString(meta) {
  const a = meta.author
  if (!a) return null
  if (typeof a === 'string') return a
  if (typeof a === 'object') {
    return [a.name, a.email ? `<${a.email}>` : null].filter(Boolean).join(' ') || null
  }
  return null
}

function normaliseSpdx(lic) {
  if (!lic) return null
  if (typeof lic === 'string') return lic
  if (Array.isArray(lic)) {
    return lic.map((l) => (typeof l === 'string' ? l : l && l.type)).filter(Boolean).join(' OR ') || null
  }
  if (typeof lic === 'object') return lic.type || null
  return null
}

// Canonical templates for the short permissive licences we may need to
// reconstruct when a package ships NO licence file at all. Only used for the
// reconstructed category, and always clearly labelled as non-verbatim.
const BSD_2_CLAUSE = (holder) =>
  `BSD 2-Clause License\n\n` +
  `Copyright (c) ${holder}\n` +
  `All rights reserved.\n\n` +
  `Redistribution and use in source and binary forms, with or without\n` +
  `modification, are permitted provided that the following conditions are met:\n\n` +
  `1. Redistributions of source code must retain the above copyright notice, this\n` +
  `   list of conditions and the following disclaimer.\n\n` +
  `2. Redistributions in binary form must reproduce the above copyright notice,\n` +
  `   this list of conditions and the following disclaimer in the documentation\n` +
  `   and/or other materials provided with the distribution.\n\n` +
  `THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"\n` +
  `AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\n` +
  `IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\n` +
  `DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE\n` +
  `FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL\n` +
  `DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR\n` +
  `SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER\n` +
  `CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,\n` +
  `OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\n` +
  `OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`
const MIT = (holder) =>
  `MIT License\n\n` +
  `Copyright (c) ${holder}\n\n` +
  `Permission is hereby granted, free of charge, to any person obtaining a copy\n` +
  `of this software and associated documentation files (the "Software"), to deal\n` +
  `in the Software without restriction, including without limitation the rights\n` +
  `to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n` +
  `copies of the Software, and to permit persons to whom the Software is\n` +
  `furnished to do so, subject to the following conditions:\n\n` +
  `The above copyright notice and this permission notice shall be included in all\n` +
  `copies or substantial portions of the Software.\n\n` +
  `THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n` +
  `IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n` +
  `FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n` +
  `AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n` +
  `LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n` +
  `OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n` +
  `SOFTWARE.`
const SPDX_TEMPLATES = { 'BSD-2-Clause': BSD_2_CLAUSE, MIT }

function reconstructNotice(spdx, meta) {
  const holder = authorString(meta) || meta.name || 'the package authors'
  const preamble =
    'NOTE: This package publishes no licence file in its distribution. The text\n' +
    `below is RECONSTRUCTED from the package's declared SPDX identifier (${spdx}) and\n` +
    'its package.json metadata; it is NOT a verbatim copy of an upstream file.\n\n'
  const tmpl = SPDX_TEMPLATES[spdx]
  if (tmpl) return preamble + tmpl(holder)
  return (
    preamble +
    `Declared licence: ${spdx}\n` +
    `Copyright holder (from metadata): ${holder}\n` +
    'No canonical template is embedded for this SPDX identifier; consult the\n' +
    'package repository for the authoritative licence text.'
  )
}

// Map every inlined input to its exact enclosing package directory. Keyed by
// absolute dir so two versions of the same package name are kept distinct.
const pkgDirs = new Map() // absolute dir -> package name
for (const input of Object.keys(result.metafile.inputs)) {
  const info = inputToPkgDir(input)
  if (info) pkgDirs.set(info.dir, info.pkg)
}

const entries = [...pkgDirs.entries()]
  .map(([dir, name]) => ({ dir, name }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.dir.localeCompare(b.dir))

const deps = {}
const blocks = []
const notices = []
const unattributed = []
for (const { dir, name } of entries) {
  let meta
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch {
    unattributed.push(`${name} (${rel(dir)}: package.json missing or unreadable)`)
    continue
  }
  const version = meta.version || 'unknown'
  deps[name] = version
  const spdx = normaliseSpdx(meta.license || meta.licenses) || 'UNSTATED'
  const files = collectLicenceFiles(dir)
  let body
  let reconstructed = false
  if (files.length) {
    body = files
      .map((f) => {
        const text = fs.readFileSync(path.join(dir, f), 'utf8').trim()
        return files.length > 1 ? `----- ${f} -----\n${text}` : text
      })
      .join('\n\n')
  } else {
    reconstructed = true
    body = reconstructNotice(spdx, meta)
  }
  notices.push({ name, version, spdx, dir: rel(dir), files, reconstructed })
  const header = `${name}@${version}  (${spdx})`
  blocks.push(`${'='.repeat(78)}\n${header}\n${'='.repeat(78)}\n\n${body}`)
}

// Fail loudly: a package inlined into the bundle whose directory could not be
// read must never be silently dropped from the licence notices.
if (unattributed.length) {
  throw new Error(
    `Unable to resolve licence attribution for inlined package(s): ${unattributed.join('; ')}.`,
  )
}

const reconstructedList = notices.filter((n) => n.reconstructed)
const attributedFromFiles = notices.length - reconstructedList.length
const licencesHeader =
  'THIRD-PARTY LICENCE NOTICES\n' +
  'public/parser/worker.mjs is a generated bundle that inlines the packages\n' +
  'listed below. For each package this file reproduces the licence, COPYING and\n' +
  'NOTICE files found in the exact package directory esbuild inlined (nested and\n' +
  'duplicated versions are attributed separately). Generated by\n' +
  'scripts/build-parser-worker.mjs; do not edit by hand.\n\n' +
  `Packages inlined: ${notices.length}\n` +
  `Attributed from bundled licence/NOTICE files: ${attributedFromFiles}\n` +
  `Reconstructed from SPDX + metadata (no upstream licence file published): ${reconstructedList.length}` +
  (reconstructedList.length
    ? '\n  ' +
      reconstructedList.map((n) => `${n.name}@${n.version} (${n.spdx})`).join('\n  ') +
      '\nThe reconstructed notices above are NOT verbatim upstream texts, so\n' +
      'attribution is not claimed to be complete or verbatim for those packages.\n'
    : '\nAll inlined packages are attributed from their bundled licence files.\n')
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
  licenceSummary: {
    packagesInlined: notices.length,
    attributedFromFiles,
    reconstructed: reconstructedList.map((n) => `${n.name}@${n.version}`),
  },
  notices: notices.map((n) => ({
    name: n.name,
    version: n.version,
    spdx: n.spdx,
    files: n.files,
    reconstructed: n.reconstructed,
  })),
  sources,
  worker: sha256(fs.readFileSync(outfile)),
  licenses: sha256(Buffer.from(licencesContent)),
}
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

console.log('Bundled parser worker ->', rel(outfile))
console.log(
  'Licence notices       ->',
  rel(licensesFile),
  `(${notices.length} packages; ${reconstructedList.length} reconstructed from metadata)`,
)
if (reconstructedList.length) {
  console.log(
    '  reconstructed (no upstream licence file):',
    reconstructedList.map((n) => `${n.name}@${n.version}`).join(', '),
  )
}
console.log('Integrity manifest    ->', rel(manifestFile))
