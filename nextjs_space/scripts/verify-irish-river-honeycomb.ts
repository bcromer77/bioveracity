/**
 * PR55 live verification — Irish river Honeycomb seeds.
 *
 * For each target river this derives Honeycomb cells from a real on-river
 * navigation anchor using the EXISTING geometry (cellAt + neighbours) and runs
 * the EXISTING live Honeycomb providers (NPWS designations, Irish planning,
 * GBIF bats). It prints the real, source-linked records that overlap each
 * river corridor, with counts and sample source URLs. No database writes, no
 * seeding, no fabricated data — this is a read-only proof that a river-name
 * search resolves to geography that returns real evidence in Honeycomb.
 *
 * Run: yarn tsx scripts/verify-irish-river-honeycomb.ts
 */
import { cellAt, neighbours } from '../lib/honeycomb/geometry'
import { runHoneycombSearch } from '../lib/honeycomb/providers'
import { RIVER_ANCHORS } from '../components/workspace/irish-rivers.mjs'

async function main() {
  console.log('PR55 live Honeycomb verification for five Irish rivers\n')
  for (const river of RIVER_ANCHORS) {
    for (const anchor of river.anchors) {
      const centre = cellAt({ lat: anchor.lat, lng: anchor.lng }, 1000)
      // The workspace panel searches the selected cell plus its immediate
      // neighbours; parseHoneycombQuery allows up to seven cells, so take the
      // centre plus its first ring (7 cells total).
      const ring = neighbours(centre, 1)
      const cells = ring.slice(0, 7)
      const label = `${river.name}${river.anchors.length > 1 ? ` — ${anchor.label}` : ''}`
      process.stdout.write(`\n=== ${label} (${anchor.lat}, ${anchor.lng}) ===\n`)
      process.stdout.write(`centre cell: ${centre.id}; cells queried: ${cells.length}\n`)
      try {
        const res = await runHoneycombSearch({ cells, q: '', from: '', to: '' })
        const byKind: Record<string, number> = { designation: 0, planning: 0, species: 0 }
        for (const hit of res.results) byKind[hit.kind] = (byKind[hit.kind] ?? 0) + 1
        process.stdout.write(
          `results: ${res.results.length} (designation ${byKind.designation}, planning ${byKind.planning}, species ${byKind.species})\n`
        )
        for (const src of res.sources) process.stdout.write(`  source ${src.id}: ${src.status} (${src.returned})\n`)
        for (const hit of res.results.slice(0, 6))
          process.stdout.write(`  - [${hit.kind}] ${hit.title} | ${hit.publisher} | ${hit.sourceUrl}\n`)
      } catch (error) {
        process.stdout.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
  }
}
main().catch((error) => {
  console.error(error)
  process.exit(1)
})
