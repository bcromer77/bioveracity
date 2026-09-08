// One-off, NON-DESTRUCTIVE correction for the River Cam WFD false gap.
// Uses only the staged Layer A values supplied for water body GB105033042750,
// attributed explicitly to the Environment Agency. No deletes; the stale gap is
// marked 'resolved' (so it drops out of the open-gap queries) rather than removed.
import { prisma } from '@/lib/prisma'

async function main() {
  const cam = await prisma.asset.findUnique({ where: { slug: 'river-cam' } })
  if (!cam) {
    console.log('river-cam not found; nothing to correct')
    return
  }

  await prisma.asset.update({
    where: { id: cam.id },
    data: {
      statusDetail: 'EA ecological classification: Moderate (2022)',
      summary:
        'The River Cam flows through Cambridge and receives treated effluent from the Cambridge (Milton) Water Recycling Centre. The Environment Agency Water Framework Directive classification for this water body (GB105033042750) has been located: Moderate ecological status (2019 and 2022); chemical status Fail (2019) and Does not require assessment (2022). It is designated a Heavily Modified Water Body.',
      description:
        'The River Cam is the flagship receiving water of the Cambridgeshire showcase. The reviewed evidence establishes that the Cambridge (Milton) Water Recycling Centre discharges to it and that it sits within the North East Cambridge regeneration area. The Environment Agency Water Framework Directive classification for this water body (GB105033042750) has been located and records the water body as Moderate ecological status (2019 and 2022); chemical status Fail (2019) and Does not require assessment (2022) — and designates it a Heavily Modified Water Body; these values are attributed to the Environment Agency classification record. A validated water-quality monitoring series adjacent to the Milton WRC discharge has still not been located in the reviewed public sources, so the effect of the discharge on the receiving water remains unresolved. A river is a linear water body rather than a single point, so no map coordinate is asserted.',
    },
  })

  // Add the located-classification record to the chronology (idempotent by title).
  const evtTitle = 'Water Framework Directive classification located'
  const existingEvt = await prisma.event.findFirst({ where: { assetId: cam.id, title: evtTitle } })
  if (!existingEvt) {
    await prisma.event.create({
      data: {
        assetId: cam.id,
        title: evtTitle,
        description:
          'The Environment Agency classifies this water body (GB105033042750) as Moderate ecological status (2019 and 2022); chemical status Fail (2019) and Does not require assessment (2022) — and designates it a Heavily Modified Water Body. These values are attributed to the Environment Agency Water Framework Directive classification record.',
        date: new Date('2025-06-01'),
        eventType: 'regulatory',
        evidenceClass: 'O',
        changeType: 'event',
        sourceDomain: 'environment.data.gov.uk',
        verified: true,
      },
    })
  }

  // Mark the stale 'WFD classification not located' gap as resolved (no delete).
  const resolved = await prisma.evidenceGap.updateMany({
    where: {
      assetId: cam.id,
      status: 'open',
      description: { contains: 'has not located a current Water Framework Directive classification' },
    },
    data: { status: 'resolved' },
  })

  console.log('river-cam corrected; stale WFD gaps resolved:', resolved.count)
}

main().finally(() => process.exit(0))
