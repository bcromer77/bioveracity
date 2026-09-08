// Dry-run by default. Run against an approved preview database and inspect the
// proposed change before using --apply. Does not seed or delete records.
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { CAM_CLASSIFICATION, CAM_SOURCE } from '../lib/river-cam-baseline'

async function main() {
  const asset = await prisma.asset.findUnique({ where: { slug: 'river-cam' } })
  if (!asset) throw new Error('River Cam asset not found; no changes made')
  const events = await prisma.event.findMany({ where: { assetId: asset.id, title: 'Water Framework Directive classification located' } })
  const data = { statusDetail: 'EA ecological classification: Moderate (2022)', summary: CAM_CLASSIFICATION }
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', assetId: asset.id, data, events: events.map(e => e.id), source: CAM_SOURCE }))
  if (!process.argv.includes('--apply')) return
  await prisma.$transaction(async tx => {
    await tx.asset.update({ where: { id: asset.id }, data: { ...data, description: CAM_CLASSIFICATION + ' The map location is indicative. Local discharge effects require separately reviewed evidence.' } })
    for (const e of events) await tx.event.update({ where: { id: e.id }, data: {
      title: 'EA water body classifications: 2019 and 2022', description: CAM_CLASSIFICATION,
      date: new Date('2022-01-01T00:00:00Z'), datePrecision: 'year',
      sourceUrl: CAM_SOURCE, sourceDomain: 'environment.data.gov.uk', evidenceClass: 'R',
    } })
  })
}
main().catch(() => { console.error('Cam correction failed; check configuration and preview records.'); process.exitCode = 1 }).finally(() => prisma.$disconnect())
