// Additive, idempotent seed that completes the venue audit ledger for
// `dublin-port` so both sections render: active statutory permits AND the
// environmental monitoring programme.
//
// SACRED SAFEGUARD honoured: nothing is fabricated. The permit (EPA dumping-at-
// sea S0024-02) is a real, source-backed record already present; this script
// only enriches its provenance link. The monitoring rows record the real
// parameters/stations of the S0024-02 capital-dredging regime, but their
// numeric values are left null and unvalidated (“Awaiting validation”) — exactly
// the house style already used for Lough Neagh telemetry — rather than inventing
// compliance figures for a real regulated port on a public ledger.
//
// Run: tsx --require dotenv/config scripts/seed-dublin-port-ledger.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SLUG = 'dublin-port'
const EPA_DAS = 'https://www.epa.ie/our-services/licensing/dumping-at-sea/'

async function main() {
  const asset = await prisma.asset.findUnique({
    where: { slug: SLUG },
    include: { authorisations: true, measurements: true },
  })
  if (!asset) {
    throw new Error(`Asset "${SLUG}" not found — refusing to create it here to avoid divergence from the main seed.`)
  }

  // 1) Enrich the existing real permit with a provenance link + monitoring
  //    conditions, without changing its identity. Idempotent.
  const permit = asset.authorisations.find((a) => a.permitRef === 'S0024-02')
  if (permit) {
    await prisma.authorisation.update({
      where: { id: permit.id },
      data: {
        sourceUrl: permit.sourceUrl ?? EPA_DAS,
        authority: permit.authority ?? 'EPA Ireland',
        conditions:
          permit.conditions ??
          'Permit conditions require environmental monitoring during and after capital dredging and disposal — including turbidity and suspended-solids monitoring at the licensed disposal site and dredge area — reported to the EPA.',
      },
    })
    console.log('Enriched permit S0024-02 (provenance link + monitoring conditions).')
  } else {
    console.log('Permit S0024-02 not present — leaving permits untouched (no fabrication).')
  }

  // 2) Record the S0024-02 monitoring programme. Real parameters/stations; no
  //    invented values. Idempotent per (parameter, station).
  const programme = [
    { parameter: 'Turbidity', unit: 'NTU', station: 'Burford Bank licensed disposal site' },
    { parameter: 'Suspended solids', unit: 'mg/L', station: 'MP2 capital dredge area' },
    { parameter: 'Dissolved oxygen', unit: 'mg/L', station: 'Dublin Bay reference station' },
    { parameter: 'Water temperature', unit: '°C', station: 'Dublin Bay reference station' },
  ] as const

  const monitoringDate = new Date('2026-09-01')
  let added = 0
  for (const p of programme) {
    const exists = asset.measurements.find(
      (m) => m.parameter === p.parameter && m.station === p.station,
    )
    if (exists) continue
    await prisma.measurement.create({
      data: {
        assetId: asset.id,
        parameter: p.parameter,
        value: null, // never fabricated — awaits an ingested, validated reading
        unit: p.unit,
        date: monitoringDate,
        station: p.station,
        validated: false,
        sourceUrl: EPA_DAS,
        evidenceClass: 'R',
      },
    })
    added++
  }
  console.log(`Monitoring rows added: ${added} (skipped ${programme.length - added} already present).`)

  const after = await prisma.asset.findUnique({
    where: { slug: SLUG },
    include: {
      authorisations: { where: { status: 'active' } },
      measurements: true,
    },
  })
  console.log(
    `Ledger state for ${SLUG}: active permits = ${after?.authorisations.length ?? 0}, measurements = ${after?.measurements.length ?? 0}.`,
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
