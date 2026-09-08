// One-off: give the two linear water bodies an INDICATIVE point on their course
// so the Map tab orients the viewer, while the UI clearly frames it as indicative
// (not a discharge or monitoring point). Additive update to the shared DB.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // River Cam — representative point on its course through Cambridge.
  await prisma.asset.update({
    where: { slug: 'river-cam' },
    data: {
      latitude: 52.21,
      longitude: 0.12,
      description:
        'The River Cam is the flagship receiving water of the Cambridgeshire showcase. The reviewed evidence establishes that the Cambridge (Milton) Water Recycling Centre discharges to it and that it sits within the North East Cambridge regeneration area. The Environment Agency Water Framework Directive classification for this water body (GB105033042750) has been located and records the water body as Moderate overall — ecological status Moderate, chemical status Fail — and designates it a Heavily Modified Water Body; these values are attributed to the Environment Agency classification record. A validated water-quality monitoring series adjacent to the Milton WRC discharge has still not been located in the reviewed public sources, so the effect of the discharge on the receiving water remains unresolved. A river is a linear water body rather than a single point; the map shows only an indicative point on its course through Cambridge for orientation, not a discharge or monitoring location.',
    },
  })

  // River Nene — representative point on its course through Peterborough.
  await prisma.asset.update({
    where: { slug: 'river-nene' },
    data: {
      latitude: 52.5736,
      longitude: -0.2478,
      description:
        'The River Nene is identified as the receiving water for the March Water Recycling Centre discharge. Its Water Framework Directive classification and a validated monitoring series adjacent to the discharge are recorded as evidence gaps because they were not located in the reviewed public sources. A river is a linear water body rather than a single point; the map shows only an indicative point on its course through Peterborough for orientation, not a discharge or monitoring location.',
    },
  })

  const rows = await prisma.asset.findMany({
    where: { slug: { in: ['river-cam', 'river-nene'] } },
    select: { slug: true, latitude: true, longitude: true },
  })
  console.log('UPDATED', JSON.stringify(rows))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
