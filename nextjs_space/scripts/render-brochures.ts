// Render every business-type fixture through the ONE shared renderer and write
// the PDFs to dev-assets/brochure-output (override with BROCHURE_OUT_DIR), reporting real file sizes and any
// validation issues. Run:
//   yarn tsx --require dotenv/config scripts/render-brochures.ts

import fs from 'node:fs'
import path from 'node:path'
import { ALL_FIXTURES } from '../lib/brochure/fixtures'
import { validateEdition } from '../lib/brochure/edition'
import { renderEdition, BROCHURE_RENDERER_VERSION } from '../lib/brochure/render-edition'
import { BROCHURE_TEMPLATE_VERSION } from '../lib/brochure/tokens'

async function main() {
  const outDir = process.env.BROCHURE_OUT_DIR || path.join(process.cwd(), 'dev-assets', 'brochure-output')
  fs.mkdirSync(outDir, { recursive: true })
  console.log(`Template ${BROCHURE_TEMPLATE_VERSION} · renderer ${BROCHURE_RENDERER_VERSION}`)
  console.log('='.repeat(64))
  let total = 0
  for (const { key, label, edition } of ALL_FIXTURES) {
    const v = validateEdition(edition)
    const res = await renderEdition(edition)
    const file = path.join(outDir, `${key}.pdf`)
    fs.writeFileSync(file, res.bytes)
    total += res.byteLength
    const kb = (res.byteLength / 1024).toFixed(0)
    console.log(`\n${label}  [${edition.status}, rev ${edition.revision}]`)
    console.log(`  venue    : ${edition.venueName}`)
    console.log(`  file     : ${file}`)
    console.log(`  pages    : ${res.pageCount}   size: ${kb} KB`)
    console.log(`  validate : ${v.ok ? 'OK' : `${v.errors.length} ERROR(S)`}, ${v.warnings.length} warning(s)`)
    for (const e of v.errors) console.log(`    ERROR   ${e.field}: ${e.message}`)
    for (const w of v.warnings) console.log(`    warn    ${w.field}: ${w.message}`)
  }
  console.log('\n' + '='.repeat(64))
  console.log(`Total: ${ALL_FIXTURES.length} PDFs, ${(total / 1024).toFixed(0)} KB combined, ${(total / ALL_FIXTURES.length / 1024).toFixed(0)} KB average`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
