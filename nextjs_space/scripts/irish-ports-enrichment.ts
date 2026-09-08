import { PrismaClient } from '@prisma/client'

// Legacy candidate data retained for reconciliation, not approved ingestion.
// The previously asserted source/date guarantees were not supported by review.
const RETRIEVED = new Date('2026-09-07') // legacy candidate; NOT verified retrieval metadata

import { assertPortSeedReady } from '../lib/port-seed-gate'
export { assertPortSeedReady } from '../lib/port-seed-gate'

type Prisma = PrismaClient

async function bySlug(prisma: Prisma, slug: string) {
  return prisma.asset.findUnique({ where: { slug } })
}

// Attach a sourceUrl to an existing event (matched by asset + exact title) only
// if it does not already have one. Never overwrites an existing URL.
async function setEventSource(prisma: Prisma, assetId: string, title: string, sourceUrl: string) {
  const evt = await prisma.event.findFirst({ where: { assetId, title } })
  if (evt && !evt.sourceUrl) {
    await prisma.event.update({ where: { id: evt.id }, data: { sourceUrl } })
  }
}

async function setProjectSource(prisma: Prisma, assetId: string, name: string, data: any) {
  const proj = await prisma.capitalProject.findFirst({ where: { assetId, name } })
  if (proj) {
    const patch: any = {}
    if (!proj.sourceUrl && data.sourceUrl) patch.sourceUrl = data.sourceUrl
    if ((proj.value === null || proj.value === undefined) && data.value !== undefined) patch.value = data.value
    if (Object.keys(patch).length) await prisma.capitalProject.update({ where: { id: proj.id }, data: patch })
  }
}

async function setAuthSource(prisma: Prisma, assetId: string, match: any, sourceUrl: string) {
  const au = await prisma.authorisation.findFirst({ where: { assetId, ...match } })
  if (au && !au.sourceUrl) await prisma.authorisation.update({ where: { id: au.id }, data: { sourceUrl } })
}

async function ensureEvent(prisma: Prisma, assetId: string, e: any) {
  const existing = await prisma.event.findFirst({ where: { assetId, title: e.title } })
  if (!existing) return prisma.event.create({ data: { assetId, ...e } })
  // Backfill a missing source URL on re-run without overwriting other fields.
  if (!existing.sourceUrl && e.sourceUrl) {
    await prisma.event.update({ where: { id: existing.id }, data: { sourceUrl: e.sourceUrl } })
  }
  return existing
}

async function ensureProject(prisma: Prisma, assetId: string, p: any) {
  const existing = await prisma.capitalProject.findFirst({ where: { assetId, name: p.name } })
  if (!existing) return prisma.capitalProject.create({ data: { assetId, ...p } })
  return existing
}

async function ensureAuth(prisma: Prisma, assetId: string, a: any) {
  const existing = await prisma.authorisation.findFirst({ where: { assetId, description: a.description } })
  if (!existing) return prisma.authorisation.create({ data: { assetId, ...a } })
  return existing
}

async function ensureQuestion(prisma: Prisma, assetId: string, q: any, paths: any[]) {
  let existing = await prisma.unresolvedQuestion.findFirst({ where: { assetId, title: q.title } })
  if (!existing) {
    existing = await prisma.unresolvedQuestion.create({ data: { assetId, ...q } })
  }
  for (const path of paths) {
    const p = await prisma.resolutionPath.findFirst({
      where: { unresolvedQuestionId: existing.id, description: path.description },
    })
    if (!p) await prisma.resolutionPath.create({ data: { unresolvedQuestionId: existing.id, ...path } })
  }
  return existing
}

async function ensureChange(prisma: Prisma, assetId: string, c: any) {
  const existing = await prisma.changeRecord.findFirst({ where: { assetId, title: c.title } })
  if (!existing) return prisma.changeRecord.create({ data: { ...c, assetId, published: false, detectedAt: new Date() } })
  // A rerun must never undo a publication/withdrawal decision.
  return existing
}

export async function enrichIrishPorts(prisma: Prisma) {
  assertPortSeedReady()
  // -------------------------------------------------------------------------
  // (0) Ensure Port of Waterford exists in the DEPLOY path (previously only
  //     created by seed-cambridgeshire.ts). Upsert by slug — additive.
  // -------------------------------------------------------------------------
  const waterford = await prisma.asset.upsert({
    where: { slug: 'port-of-waterford' },
    update: { region: 'Irish Ports', regionSlug: 'irish_ports' },
    create: {
      slug: 'port-of-waterford',
      name: 'Port of Waterford (Belview)',
      type: 'port',
      subtype: 'bulk_terminal',
      region: 'Irish Ports',
      regionSlug: 'irish_ports',
      status: 'planning',
      statusDetail: 'ORE-capable terminal proposal before the planning process',
      latitude: 52.2774,
      longitude: -7.0547,
      summary:
        'Tier 2 Port of National Significance on the Suir estuary at Belview. An offshore-renewable-capable terminal with a 250-metre wharf extension and land reclamation has been proposed and requires a Maritime Area Consent and EIAR.',
      description:
        'Port of Waterford Company operates the Belview facility on the River Suir estuary in Co. Kilkenny. The reviewed evidence confirms a proposal for an offshore-renewable-energy (ORE) capable terminal - a 250-metre wharf extension with land reclamation - identified as maritime development requiring a Maritime Area Consent (MAC) and an Environmental Impact Assessment Report (EIAR).',
      operatorName: 'Port of Waterford Company',
      regulatorName: 'MARA, EPA Ireland, Kilkenny County Council',
      jurisdiction: 'Ireland',
      priorityScore: 55,
    },
  })

  await ensureEvent(prisma, waterford.id, {
    title: 'ORE-capable terminal proposed: 250m wharf extension and reclamation',
    description:
      'Port of Waterford has sought permission for an offshore-renewable-energy-capable terminal involving a 250-metre wharf extension and land reclamation, identified as maritime development requiring a Maritime Area Consent and EIAR. The port is identified as a Tier 2 Port of National Significance.',
    date: new Date('2025-01-01'),
    eventType: 'planning',
    evidenceClass: 'P',
    changeType: 'event',
    sourceDomain: 'pleanala.ie',
    verified: true,
  })

  await ensureAuth(prisma, waterford.id, {
    type: 'mac',
    status: 'under_review',
    authority: 'An Coimisiún Pleanála / MARA',
    description:
      'Maritime Area Consent and EIAR required for the proposed ORE-capable terminal (250m wharf extension and reclamation). Final decision not established in the reviewed sources.',
    sourceUrl: 'https://www.pleanala.ie/',
    evidenceClass: 'P',
  })

  const cork = await bySlug(prisma, 'port-of-cork')
  const dublin = await bySlug(prisma, 'dublin-port')
  const shannon = await bySlug(prisma, 'shannon-foynes')
  const rosslare = await bySlug(prisma, 'rosslare-europort')

  // -------------------------------------------------------------------------
  // (1) Attach REAL source URLs to existing seeded records (item 6).
  // -------------------------------------------------------------------------
  if (cork) {
    await setEventSource(
      prisma,
      cork.id,
      '€38.4M CEF funding selected for Ringaskiddy berth extensions',
      'https://www.portofcork.ie/port-of-cork-welcomes-cef-funding-of-e38-4-million-to-expand-ringaskiddy-facilities/',
    )
  }
  if (dublin) {
    await setEventSource(
      prisma,
      dublin.id,
      '3FM SID application submitted to An Coimisiún Pleanála',
      'https://www.dublinport.ie/dublin-port-company-lodges-planning-application-for-3fm-project-to-transform-port-lands-focused-on-the-poolbeg-peninsula/',
    )
  }
  if (rosslare) {
    await setEventSource(
      prisma,
      rosslare.id,
      'ORE Hub planning application lodged',
      'https://afloat.ie/port-news/rosslare-europort/item/69598-rosslare-europort-to-seek-approval-for-220m-ore-hub',
    )
    await setProjectSource(prisma, rosslare.id, 'Rosslare ORE Hub', {
      sourceUrl: 'https://afloat.ie/port-news/rosslare-europort/item/69598-rosslare-europort-to-seek-approval-for-220m-ore-hub',
      value: '€220 million',
    })
  }
  if (waterford) {
    await setEventSource(
      prisma,
      waterford.id,
      'ORE-capable terminal proposed: 250m wharf extension and reclamation',
      'https://www.portofwaterford.com/2025/09/09/landmark-application-for-offshore-renewable-energy-terminal/',
    )
    await setAuthSource(
      prisma,
      waterford.id,
      { type: 'mac' },
      'https://www.portofwaterford.com/2025/09/09/landmark-application-for-offshore-renewable-energy-terminal/',
    )
  }

  // -------------------------------------------------------------------------
  // (2) Canonical Cork Container Terminal intervention chain (item 1).
  //     PROJECT -> BASELINE -> DEPLOYMENT -> OPERATION -> UNRESOLVED QUESTION
  //     -> RESOLUTION PATHS. Every stage is source-backed public record.
  // -------------------------------------------------------------------------
  if (cork) {
    // PROJECT — the intervention itself.
    await ensureProject(prisma, cork.id, {
      name: 'Cork Container Terminal (CCT), Ringaskiddy',
      description:
        'Deepwater, multi-modal container terminal at Ringaskiddy — a 360-metre quay at 13-metre depth able to accommodate the largest container vessels calling at Irish ports. Reported at approximately €89 million and described as the largest single marine-infrastructure investment by an Irish port in a century. Funded through the EIB, ISIF, AIB and the EU Connecting Europe Facility.',
      value: '≈ €89 million',
      status: 'completed',
      startDate: new Date('2019-01-01'),
      endDate: new Date('2022-04-23'),
      sourceUrl: 'https://www.rte.ie/news/regional/2022/0923/1325053-ringaskiddy-terminal/',
      evidenceClass: 'O',
    })

    // DEPLOYMENT — operational commencement (container handling began).
    await ensureEvent(prisma, cork.id, {
      title: 'Cork Container Terminal became operational at Ringaskiddy',
      description:
        'The Cork Container Terminal began handling container operations at Ringaskiddy on 23 April 2022, marking the transfer of container activity to the new deepwater facility.',
      date: new Date('2022-04-23'),
      eventType: 'operational',
      evidenceClass: 'O',
      changeType: 'intervention',
      sourceDomain: 'thecork.ie',
      sourceUrl: 'https://www.thecork.ie/2022/04/23/corks-new-container-terminal-becomes-operational-in-ringaskiddy/',
      verified: true,
    })

    // OPERATION — official opening (commissioning of record).
    await ensureEvent(prisma, cork.id, {
      title: 'Cork Container Terminal officially opened',
      description:
        'The Cork Container Terminal was officially opened on 23 September 2022. Reported at approximately €89 million, the 360-metre-quay facility was described as the largest single investment in marine infrastructure by an Irish port in the last 100 years.',
      date: new Date('2022-09-23'),
      eventType: 'operational',
      evidenceClass: 'O',
      changeType: 'intervention',
      sourceDomain: 'rte.ie',
      sourceUrl: 'https://www.rte.ie/news/regional/2022/0923/1325053-ringaskiddy-terminal/',
      verified: true,
    })

    // UNRESOLVED QUESTION + RESOLUTION PATHS — the honest 'after' doctrine.
    await ensureQuestion(
      prisma,
      cork.id,
      {
        title: 'What environmental effect followed operation of the Cork Container Terminal?',
        question:
          'The Cork Container Terminal entered operation in 2022. The public record establishes the intervention and its commissioning, but BioVeracity has not connected verified environmental monitoring evidence covering the period after operation began. The question is not whether the project succeeded commercially, but what change — if any — the surrounding air, water and underwater-noise environment shows after the intervention, measured against a pre-operation baseline.',
        status: 'OPEN',
        materialityInternal: 'material',
      },
      [
        {
          evidenceType: 'CONTINUOUS_SENSOR',
          description:
            'Ambient air-quality monitoring near Ringaskiddy (particulate and NO2) compared before and after operation, to test for any change attributable to terminal and associated road traffic.',
          priorityInternal: 'high',
        },
        {
          evidenceType: 'UPSTREAM_DOWNSTREAM_SAMPLING',
          description:
            'Water and sediment sampling in the lower Cork Harbour receiving water, upstream and downstream of the terminal, to establish whether operation coincides with any measurable change in water quality.',
          priorityInternal: 'high',
        },
        {
          evidenceType: 'CONTINUOUS_SENSOR',
          description:
            'Underwater-noise monitoring during vessel calls and cargo handling, compared with a pre-operation baseline, to characterise any change in the acoustic environment.',
          priorityInternal: 'medium',
        },
      ],
    )
  }

  // -------------------------------------------------------------------------
  // (3) Source-backed development-pipeline records, ADDED ALONGSIDE existing
  //     baselines (item 1 resolution — new distinct projects, never overwrites).
  // -------------------------------------------------------------------------
  if (cork) {
    await ensureProject(prisma, cork.id, {
      name: 'Ringaskiddy ORE Development (CORE1)',
      description:
        "Offshore-renewable-energy development at Ringaskiddy set out in the Port of Cork's five-year corporate strategy 'Powering Sustainable Growth', referencing a circa €100 million ORE development to position Cork as an assembly and O&M base for offshore wind.",
      value: '≈ €100 million',
      status: 'planned',
      sourceUrl: 'https://www.portofcork.ie/port-of-cork-unveils-ambitious-five-year-plan-to-power-sustainable-growth/',
      evidenceClass: 'P',
    })
  }

  if (rosslare) {
    await ensureProject(prisma, rosslare.id, {
      name: 'GREEN DRIFT — Berth 3 upgrade and onshore power supply',
      description:
        'EU CEF co-funded works (a joint programme with the Port of Dunkirk) to extend Berth 3, replace the RoRo ramp steel deck and install onshore power supply at Rosslare Europort. Reported at approximately €38.5 million overall with €19.2 million of CEF support; works scheduled from Q4 2026 with completion in 2028.',
      value: '≈ €38.5 million (with Dunkirk; €19.2M CEF)',
      status: 'approved',
      sourceUrl: 'https://www.irishrail.ie/en-ie/about-us/iarnrod-eireann-projects-and-investments/green-drift',
      evidenceClass: 'P',
    })
  }

  if (shannon) {
    await ensureProject(prisma, shannon.id, {
      name: 'Foynes Island Deepwater Berth',
      description:
        'Deepwater berth and an access-road bridge to Foynes Island, part of Shannon Foynes Port Company Vision 2041. The project has secured a Maritime Area Consent from the Maritime Area Regulatory Authority (MARA).',
      status: 'planned',
      sourceUrl: 'https://afloat.ie/port-news/shannon-estuary/item/72319-foynes-deepwater-project-wins-key-maritime-approval',
      evidenceClass: 'P',
    })
    await ensureAuth(prisma, shannon.id, {
      type: 'mac',
      status: 'granted',
      authority: 'MARA',
      description:
        'Maritime Area Consent granted for the Foynes Island deepwater project (deepwater berth and access-road bridge), part of Vision 2041.',
      sourceUrl: 'https://afloat.ie/port-news/shannon-estuary/item/72319-foynes-deepwater-project-wins-key-maritime-approval',
      evidenceClass: 'R',
    })
  }

  if (waterford) {
    await ensureProject(prisma, waterford.id, {
      name: 'Belview ORE Terminal — 250m wharf extension',
      description:
        'Offshore-renewable-energy-capable terminal at Belview: a 250-metre wharf extension with land reclamation, before An Coimisiún Pleanála (application lodged 9 September 2025) and requiring a Maritime Area Consent and EIAR.',
      status: 'planning',
      startDate: new Date('2025-09-09'),
      sourceUrl: 'https://www.portofwaterford.com/2025/09/09/landmark-application-for-offshore-renewable-energy-terminal/',
      evidenceClass: 'P',
    })
  }

  if (dublin) {
    await ensureProject(prisma, dublin.id, {
      name: '3FM Project (Third and Final Masterplan phase)',
      description:
        'Dublin Port Company\'s €1.1 billion Strategic Infrastructure Development on the Poolbeg peninsula — the third and final masterplan phase to complete the redevelopment of the port lands. Planning application lodged with An Coimisiún Pleanála on 23 July 2024.',
      value: '≈ €1.1 billion',
      status: 'planning',
      startDate: new Date('2024-07-23'),
      sourceUrl: 'https://www.dublinport.ie/dublin-port-company-lodges-planning-application-for-3fm-project-to-transform-port-lands-focused-on-the-poolbeg-peninsula/',
      evidenceClass: 'P',
    })
  }

  // -------------------------------------------------------------------------
  // (4) Published ChangeRecords — what a programme director needs to see
  //     (item 4). Material, source-anchored, phrased as changes not counts.
  // -------------------------------------------------------------------------
  if (cork) {
    await ensureChange(prisma, cork.id, {
      changeType: 'INTERVENTION_RECORDED',
      title: 'Cork Container Terminal entered operation',
      description:
        'A capital intervention reached operation: the Cork Container Terminal was officially opened on 23 September 2022 (operational since 23 April 2022). This establishes the intervention against which any subsequent environmental effect can be measured.',
      eventDate: new Date('2022-09-23'),
      detectedAt: new Date('2022-09-23'),
      materialityState: 'MATERIAL',
    })
    await ensureChange(prisma, cork.id, {
      changeType: 'NEW_UNRESOLVED_QUESTION',
      title: 'New evidence requirement: environmental effect after operation at Cork',
      description:
        'A previously unstated evidence requirement has been identified for Cork: verified environmental monitoring (air, water and underwater noise) covering the period after the Cork Container Terminal entered operation. No such after-evidence is yet connected.',
      eventDate: new Date('2022-09-23'),
      detectedAt: new Date('2022-09-23'),
      materialityState: 'MATERIAL',
    })
  }
  if (rosslare) {
    await ensureChange(prisma, rosslare.id, {
      changeType: 'RECORD_ADDED',
      title: 'Rosslare offshore renewable energy hub application lodged (€220M)',
      description:
        'A planning application for the €220 million Rosslare Europort offshore-renewable-energy hub has been lodged, with a statutory consultation period. This is a material development in the Irish ports clean-maritime pipeline.',
      eventDate: new Date('2025-12-10'),
      detectedAt: new Date('2025-12-10'),
      materialityState: 'MATERIAL',
    })
  }
  if (dublin) {
    await ensureChange(prisma, dublin.id, {
      changeType: 'RECORD_ADDED',
      title: 'Dublin Port 3FM application lodged (€1.1bn)',
      description:
        'Dublin Port Company lodged its €1.1 billion 3FM Strategic Infrastructure Development with An Coimisiún Pleanála on 23 July 2024 — the third and final masterplan phase for the Poolbeg peninsula.',
      eventDate: new Date('2024-07-23'),
      detectedAt: new Date('2024-07-23'),
      materialityState: 'MATERIAL',
    })
  }
  if (waterford) {
    await ensureChange(prisma, waterford.id, {
      changeType: 'RECORD_ADDED',
      title: 'Waterford Belview ORE terminal application lodged',
      description:
        'Port of Waterford lodged a planning application on 9 September 2025 for an offshore-renewable-energy-capable terminal at Belview (250-metre wharf extension with reclamation), requiring a Maritime Area Consent and EIAR.',
      eventDate: new Date('2025-09-09'),
      detectedAt: new Date('2025-09-09'),
      materialityState: 'MATERIAL',
    })
  }
  if (shannon) {
    await ensureChange(prisma, shannon.id, {
      changeType: 'RECORD_ADDED',
      title: 'Foynes Island deepwater project secured Maritime Area Consent',
      description:
        'The Foynes Island deepwater project (deepwater berth and access-road bridge, part of Vision 2041) secured a Maritime Area Consent from MARA — a material regulatory milestone in the Shannon Estuary.',
      detectedAt: RETRIEVED,
      materialityState: 'MATERIAL',
    })
  }

  console.log('Irish Ports enrichment complete.')
}

// Standalone runner: `yarn tsx --require dotenv/config scripts/irish-ports-enrichment.ts`
if (require.main === module) {
  const prisma = new PrismaClient()
  enrichIrishPorts(prisma)
    .then(() => console.log('Done.'))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
