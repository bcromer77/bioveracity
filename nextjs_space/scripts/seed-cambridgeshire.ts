import { PrismaClient } from '@prisma/client'

// Idempotent seed for:
//  (A) Two requested ports/assets: Port of Waterford (port) and Derry/Londonderry WWTP
//      (a wastewater works - the only Londonderry asset the reviewed public sources support).
//  (B) The Cambridgeshire & Peterborough showcase: existing March/Milton WRC re-homed to the
//      canonical region, plus source-backed wastewater assets, receiving waters and the River Cam.
//
// Every record below is grounded in the reviewed source material (Anglian Water / Environment
// Agency / Ofwat / An Coimisiún Pleanála / NI Water / local reporting). Where a fact is not
// established in those sources it is recorded as an evidence gap, never invented.
//
// Safe to re-run: assets are upserted by slug; every child record is checked by
// (assetId + a stable field) before creation. NO deletes.

const prisma = new PrismaClient()

async function upsertAsset(slug: string, data: any) {
  const asset = await prisma.asset.upsert({
    where: { slug },
    update: {
      // Only fields safe to refresh on re-run. We intentionally re-home region strings.
      region: data.region,
      regionSlug: data.regionSlug,
      ...(data.summary ? { summary: data.summary } : {}),
    },
    create: { slug, ...data },
  })
  return asset
}

async function ensureEvent(assetId: string, e: any) {
  const existing = await prisma.event.findFirst({ where: { assetId, title: e.title } })
  if (!existing) await prisma.event.create({ data: { assetId, ...e } })
}

async function ensureAuthorisation(assetId: string, a: any) {
  const existing = await prisma.authorisation.findFirst({
    where: { assetId, description: a.description },
  })
  if (!existing) await prisma.authorisation.create({ data: { assetId, ...a } })
}

async function ensureProject(assetId: string, p: any) {
  const existing = await prisma.capitalProject.findFirst({ where: { assetId, name: p.name } })
  if (!existing) await prisma.capitalProject.create({ data: { assetId, ...p } })
}

async function ensureRegulatory(assetId: string, r: any) {
  const existing = await prisma.regulatoryActivity.findFirst({ where: { assetId, title: r.title } })
  if (!existing) await prisma.regulatoryActivity.create({ data: { assetId, ...r } })
}

async function ensureCommunity(assetId: string, c: any) {
  const existing = await prisma.communityReport.findFirst({ where: { assetId, title: c.title } })
  if (!existing) await prisma.communityReport.create({ data: { assetId, ...c } })
}

async function ensureGap(assetId: string, g: any) {
  const existing = await prisma.evidenceGap.findFirst({ where: { assetId, description: g.description } })
  if (!existing) await prisma.evidenceGap.create({ data: { assetId, ...g } })
}

async function ensureDivergence(assetId: string, d: any) {
  const existing = await prisma.divergence.findFirst({ where: { assetId, title: d.title, date: d.date } })
  if (!existing) await prisma.divergence.create({ data: { assetId, ...d } })
}

async function main() {
  const CAMBS = 'Cambridgeshire & Peterborough'
  const CAMBS_SLUG = 'cambridgeshire'

  // ---------------------------------------------------------------------------
  // (A) REQUESTED PORT / ASSET SEEDS
  // ---------------------------------------------------------------------------

  // Port of Waterford (Belview) - source: pleanala.ie / first_50 asset register.
  const waterford = await upsertAsset('port-of-waterford', {
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
      'Port of Waterford Company operates the Belview facility on the River Suir estuary in Co. Kilkenny. The reviewed evidence confirms a proposal for an offshore-renewable-energy (ORE) capable terminal - a 250-metre wharf extension with land reclamation - identified as maritime development requiring a Maritime Area Consent (MAC) and an Environmental Impact Assessment Report (EIAR). The reclamation footprint, final decision, construction timetable, permit conditions and any recent environmental event are not established in the reviewed sources.',
    operatorName: 'Port of Waterford Company',
    regulatorName: 'MARA, EPA Ireland, Kilkenny County Council',
    jurisdiction: 'Ireland',
    priorityScore: 55,
  })

  await ensureEvent(waterford.id, {
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

  await ensureAuthorisation(waterford.id, {
    type: 'mac',
    status: 'under_review',
    authority: 'An Coimisiún Pleanála / MARA',
    description:
      'Maritime Area Consent and EIAR required for the proposed ORE-capable terminal (250m wharf extension and reclamation). Final decision not established in the reviewed sources.',
    sourceUrl: 'https://www.pleanala.ie/',
    evidenceClass: 'P',
  })

  await ensureGap(waterford.id, {
    description:
      'BioVeracity has not located the reclamation footprint, final planning decision, construction timetable or permit conditions for the proposed ORE-capable terminal in the public sources reviewed.',
    consequence:
      'Until a decision and conditions are published, it is not possible to establish an environmental baseline or the monitoring commitments a construction contract would fix.',
    dataRequired:
      'Sources to check: An Coimisiún Pleanála (pleanala.ie) case file, MARA Maritime Area Consent register, and the project EIAR. Last checked at seed time; publication expected once the application is determined.',
    priority: 'high',
    status: 'open',
  })

  // Derry/Londonderry WWTP - source: first_50 asset register (NI Water / NIEA).
  // NOTE: the reviewed public sources support Londonderry only as a wastewater works,
  // not as a port. Seeded honestly as a wastewater asset.
  const derry = await upsertAsset('derry-wwtw', {
    name: 'Derry/Londonderry WWTP',
    type: 'wastewater',
    subtype: 'wwtw',
    region: 'Northern Ireland',
    regionSlug: 'northern_ireland',
    status: 'monitoring',
    statusDetail: 'Wastewater treatment works discharging to the River Foyle',
    latitude: 55.006,
    longitude: -7.32,
    summary:
      'NI Water wastewater treatment works serving Derry/Londonderry, discharging to the River Foyle. Capacity and discharge detail are limited in the reviewed public sources.',
    description:
      'The Derry/Londonderry wastewater treatment works is operated by NI Water and regulated by NIEA/DAERA, discharging treated effluent to the River Foyle. The reviewed sources identify the works, its receiving water and a general capacity interest, but do not supply a detailed discharge consent, capacity figures or a validated monitoring series.',
    operatorName: 'NI Water',
    regulatorName: 'NIEA/DAERA',
    jurisdiction: 'Northern Ireland',
    priorityScore: 30,
  })

  await ensureEvent(derry.id, {
    title: 'Wastewater treatment works discharges to the River Foyle',
    description:
      'The Derry/Londonderry treatment works, operated by NI Water and regulated by NIEA/DAERA, discharges to the River Foyle. Capacity is identified as an interest in the reviewed sources.',
    date: new Date('2025-01-01'),
    eventType: 'operational',
    evidenceClass: 'O',
    changeType: 'event',
    sourceDomain: 'niwater.com',
    verified: false,
  })

  await ensureGap(derry.id, {
    description:
      'BioVeracity has not located a detailed discharge consent, design capacity or a validated effluent monitoring series for the Derry/Londonderry works in the public sources reviewed.',
    consequence:
      'Without consent limits and monitoring, it is not possible to establish whether the works operates within its permitted envelope or how it affects the River Foyle.',
    dataRequired:
      'Sources to check: NIEA water discharge consents register and NI Water asset records. Last checked at seed time.',
    priority: 'medium',
    status: 'open',
  })

  // ---------------------------------------------------------------------------
  // (B) CAMBRIDGESHIRE & PETERBOROUGH SHOWCASE
  // ---------------------------------------------------------------------------

  // Re-home the two existing WRCs to the canonical region name (regionSlug unchanged).
  const march = await prisma.asset.update({
    where: { slug: 'march-wrc' },
    data: { region: CAMBS, regionSlug: CAMBS_SLUG },
  })
  const milton = await prisma.asset.update({
    where: { slug: 'milton-wrc' },
    data: { region: CAMBS, regionSlug: CAMBS_SLUG },
  })

  // --- March WRC: permit, community reports, evidence gaps (divergence already seeded) ---
  await ensureAuthorisation(march.id, {
    permitRef: 'AN/AW1NF1063/015',
    type: 'environmental_permit',
    status: 'active',
    authority: 'Environment Agency',
    description:
      'Anglian Water operates March Water Recycling Centre under environmental permit AN/AW1NF1063/015 (Environment Agency public register).',
    sourceUrl: 'https://environment.data.gov.uk/public-register/view/search-permits',
    evidenceClass: 'R',
  })

  await ensureCommunity(march.id, {
    title: 'Residents report persistent odour and heavy vehicle movements',
    description:
      'March residents have reported persistent severe odour, approximately 30-40 lorry or tanker movements per day, road deterioration, vibration and alleged spillages of sewage cake, with effects on gardens, open windows and quality of life. These are media-recorded community reports, not regulator findings.',
    date: new Date('2025-06-01'),
    reportedBy: 'residents',
    type: 'odour',
    corroborated: false,
    sourceUrl: 'https://www.lbc.co.uk/',
    evidenceClass: 'C',
  })

  await ensureEvent(march.id, {
    title: 'Anglian Water pauses lime-related waste treatment (27 Jul - 22 Sep 2025)',
    description:
      'Anglian Water temporarily paused waste-treatment operations involving lime from 27 July to 22 September 2025, stating the measure was intended to reduce odour and vehicle impacts during the school holidays. The period offers a quasi-experimental before/during/after comparison.',
    date: new Date('2025-07-27'),
    endDate: new Date('2025-09-22'),
    eventType: 'operational',
    evidenceClass: 'O',
    changeType: 'material_change',
    sourceDomain: 'marchtowncouncil.gov.uk',
    verified: true,
  })

  const marchGaps = [
    'BioVeracity has not located a verified odour-concentration or source-apportionment series for March WRC in the public sources reviewed.',
    'BioVeracity has not located a complete complaint chronology for March WRC in the public sources reviewed.',
    'BioVeracity has not located a process-state, lime-use, sludge-receipt or vehicle-movement dataset for March WRC in the public sources reviewed.',
    'No authoritative incident record has been located to support the alleged spillages of sewage cake at March WRC.',
    'No evidence has been located linking the reported March odour to a permit breach or to Environment Agency enforcement.',
  ]
  for (const d of marchGaps) {
    await ensureGap(march.id, {
      description: d,
      consequence:
        'Without this record, human experience of the site and the operational/regulatory record cannot be reconciled.',
      dataRequired:
        'Sources to check: EA public register (permits, compliance, enforcement), operator process logs, council contact records. Last checked at seed time.',
      priority: 'high',
      status: 'open',
    })
  }

  // --- Milton / Cambridge WRC: cancelled relocation project + constraints ---
  await ensureProject(milton.id, {
    name: 'Cambridge (Milton) WRC relocation - cancelled',
    description:
      'Relocation of the Cambridge (Milton) Water Recycling Centre received development consent in April 2025 but was cancelled in August 2025 after Housing Infrastructure Fund support was withdrawn. The relocation had been intended to release land for more than 8,300-8,500 homes. Anglian Water states it is reviewing alternatives to increase capacity at the existing plant - an operator position, not a confirmed replacement scheme.',
    value: null,
    status: 'cancelled',
    startDate: new Date('2025-04-01'),
    endDate: new Date('2025-08-01'),
    proofRequired:
      'Whether any replacement scheme with defined capacity and environmental scope is published, and whether the prior consent baseline transfers to a retained-site option.',
    sourceUrl: 'https://www.anglianwater.co.uk/news/',
    evidenceClass: 'P',
  })

  await ensureEvent(milton.id, {
    title: 'Discharges to the River Cam',
    description:
      'The Cambridge (Milton) Water Recycling Centre serves Cambridge and surrounding villages and discharges to the River Cam. It sits within the North East Cambridge regeneration area.',
    date: new Date('2025-01-01'),
    eventType: 'operational',
    evidenceClass: 'O',
    changeType: 'event',
    sourceDomain: 'democracy.cambridge.gov.uk',
    verified: true,
  })

  await ensureGap(milton.id, {
    description:
      'BioVeracity has not located a defined replacement-capacity scheme for the Cambridge (Milton) WRC following the August 2025 cancellation of the relocation.',
    consequence:
      'It is not established whether the environmental baseline prepared for the relocation transfers to any future option at the existing site.',
    dataRequired:
      'Sources to check: Anglian Water announcements and Cambridge planning authority records (democracy.cambridge.gov.uk). Last checked at seed time.',
    priority: 'high',
    status: 'open',
  })
  await ensureGap(milton.id, {
    description:
      'Site constraints at the existing Milton WRC (surface-water flooding modelled at 0.3-0.5m in depressions, high mapped groundwater-flooding susceptibility, likely contamination from prior industrial use) are identified but no recorded groundwater-flooding event within the boundary has been located.',
    consequence:
      'Any redevelopment or expansion would require site investigation and appropriate drainage design; the current evidence is planning-sensitive but incomplete.',
    dataRequired:
      'Sources to check: Cambridge planning authority environmental reports. Last checked at seed time.',
    priority: 'medium',
    status: 'open',
  })

  // --- Woodhurst / Envar composting ---
  const woodhurst = await upsertAsset('woodhurst-envar', {
    name: 'Woodhurst / Envar Composting',
    type: 'industrial',
    subtype: 'composting',
    region: CAMBS,
    regionSlug: CAMBS_SLUG,
    status: 'monitoring',
    statusDetail: 'Composting facility under intensified Environment Agency monitoring',
    latitude: 52.351,
    longitude: -0.053,
    summary:
      'Composting facility near Woodhurst operating under EA permit EPR/GP3930DF with a reported permitted capacity of 200,000 tonnes per year. Subject to a 2026 EA investigation that substantiated one Envar-linked compost-odour incident while identifying alternative local odour sources.',
    description:
      'The Woodhurst composting facility, operated by Envar Composting Ltd, operates under Environment Agency permit EPR/GP3930DF with a reported permitted capacity of 200,000 tonnes per year. The reviewed evidence keeps three matters separate: the existing composting operation and its permit; a proposed sewage-sludge bio-drying trial/variation (2025-2026, designated high public interest); and a separately consented Healthcare Waste Energy Recovery Facility (refused by Cambridgeshire County Council in April 2023, granted on appeal by the Secretary of State in July 2024). Planning permission does not establish that a facility is operational or that emissions have occurred.',
    operatorName: 'Envar Composting Ltd',
    regulatorName: 'Environment Agency',
    jurisdiction: 'England',
    priorityScore: 45,
  })

  await ensureAuthorisation(woodhurst.id, {
    permitRef: 'EPR/GP3930DF',
    type: 'environmental_permit',
    status: 'active',
    authority: 'Environment Agency',
    description:
      'Environment Agency environmental permit EPR/GP3930DF for the Woodhurst composting facility, reported permitted capacity 200,000 tonnes per year.',
    sourceUrl: 'https://environment.data.gov.uk/public-register/view/search-permits',
    evidenceClass: 'R',
  })

  await ensureRegulatory(woodhurst.id, {
    title: 'EA proactive investigation substantiates one Envar-linked odour incident (8 Aug 2026)',
    description:
      'The Environment Agency intensified monitoring and launched a proactive four-week investigation in 2026. It substantiated one Envar-linked compost-odour incident on 8 August 2026. The same regulator material warns against simplistic attribution: other local odours were associated with poultry and agricultural activity, and smoke/burning reports were linked to external fires including Holme Fen or Biffa St Neots.',
    date: new Date('2026-08-08'),
    regulator: 'Environment Agency',
    type: 'investigation',
    outcome: 'One Envar-linked compost-odour incident substantiated; alternative local sources identified for other reports.',
    sourceUrl: 'https://environment.data.gov.uk/public-register/view/search-compliance-assessments',
    evidenceClass: 'R',
  })

  await ensureRegulatory(woodhurst.id, {
    title: 'Sewage-sludge bio-drying permit variation treated as high public interest (2025-2026)',
    description:
      'Permit variations in 2025-2026 included a proposed sewage-sludge bio-drying trial and were designated high public interest by the Environment Agency.',
    date: new Date('2025-01-01'),
    regulator: 'Environment Agency',
    type: 'permit_variation',
    outcome: 'Consultation designated high public interest.',
    sourceUrl: 'https://environment.data.gov.uk/public-register/view/search-permits',
    evidenceClass: 'R',
  })

  await ensureRegulatory(woodhurst.id, {
    title: 'Healthcare Waste Energy Recovery Facility: refused locally, granted on appeal',
    description:
      'A proposed Healthcare Waste Energy Recovery Facility was refused by Cambridgeshire County Council Planning Committee in April 2023 over traffic, noise and air-pollution concerns, but planning permission was granted by the Secretary of State on appeal in July 2024. Planning permission does not establish that the facility is operational or that emissions have occurred.',
    date: new Date('2024-07-01'),
    regulator: 'Cambridgeshire County Council / Secretary of State',
    type: 'consultation',
    outcome: 'Permission granted on appeal after local refusal.',
    sourceUrl: 'https://www.cambridgeshire.gov.uk/residents/planning-and-building-control',
    evidenceClass: 'P',
  })

  await ensureGap(woodhurst.id, {
    description:
      'BioVeracity has not located an odour source-apportionment dataset that separates the Envar composting operation from the poultry, agricultural and external-fire sources the Environment Agency also identified locally.',
    consequence:
      'Individual odour observations cannot be reliably attributed without activity logs, wind fields and process status for each candidate source.',
    dataRequired:
      'Sources to check: EA investigation records, operator activity logs, meteorological data. Last checked at seed time.',
    priority: 'medium',
    status: 'open',
  })

  // Woodhurst divergence - genuinely source-supported (community reports vs EA attribution).
  await ensureDivergence(woodhurst.id, {
    title: 'The evidence starts to disagree here',
    date: new Date('2026-08-08'),
    summary: 'Community odour experience and the regulator\u2019s attribution describe the same area differently.',
    before:
      'Local residents associated persistent odours in the area with the Envar composting facility. The community record framed the facility as the source of the problem.',
    theChange:
      'The Environment Agency\u2019s 2026 proactive investigation substantiated one Envar-linked compost-odour incident on 8 August 2026, but also attributed other local odours to poultry and agricultural activity and linked smoke/burning reports to external fires including Holme Fen and Biffa St Neots.',
    theDifference:
      'The community record attributes a sustained problem primarily to one operator, while the regulator record distributes causation across several sources and substantiates only one incident against Envar. No source-apportionment series has been located that would reconcile the two accounts.',
    whatHappenedNext:
      'Permit variations (including a sewage-sludge bio-drying trial) continued to be treated as high public interest, and a Site Liaison Forum provides a governance route for presenting reconciled evidence.',
    status: 'unresolved',
    sourceDomain: 'environment.data.gov.uk',
  })

  // --- Foxton WRC (operator capacity position; coordinates not supplied - left null) ---
  const foxton = await upsertAsset('foxton-wrc', {
    name: 'Foxton Water Recycling Centre',
    type: 'wastewater',
    subtype: 'wrc',
    region: CAMBS,
    regionSlug: CAMBS_SLUG,
    status: 'monitoring',
    statusDetail: 'Operator has warned of capacity and environmental constraints',
    latitude: null,
    longitude: null,
    summary:
      'Anglian Water has warned, through local reporting, that Foxton\u2019s existing infrastructure cannot support further housing connections without increased environmental risk. This is an operator position, not a regulator determination.',
    description:
      'Anglian Water has warned that Foxton\u2019s existing infrastructure cannot support further housing connections without increased environmental risk or conflict with environmental requirements. This is an operator warning cited through local reporting, not a regulator determination in the reviewed sources. A precise site location has not been established in the reviewed sources.',
    operatorName: 'Anglian Water',
    regulatorName: 'Environment Agency',
    jurisdiction: 'England',
    priorityScore: 25,
  })

  await ensureEvent(foxton.id, {
    title: 'Operator warns of capacity constraint on further housing connections',
    description:
      'Anglian Water has warned that Foxton\u2019s existing infrastructure cannot support further housing connections without increased environmental risk. This is an operator position cited through local reporting, not a regulator determination.',
    date: new Date('2025-01-01'),
    eventType: 'operational',
    evidenceClass: 'O',
    changeType: 'event',
    sourceDomain: 'cambridgeindependent.co.uk',
    verified: false,
  })

  await ensureGap(foxton.id, {
    description:
      'BioVeracity has not located permit headroom, actual influent, treatment-performance or receiving-water data for Foxton WRC that would establish whether the reported capacity constraint is current, seasonal or upgrade-dependent.',
    consequence:
      'Planning authorities cannot yet distinguish an operator position from a demonstrated environmental constraint.',
    dataRequired:
      'Sources to check: EA permit and compliance registers, Anglian Water flow data. Last checked at seed time.',
    priority: 'medium',
    status: 'open',
  })

  // --- Flag Fen WRC / pumping station: reported capital project ---
  const flagfen = await upsertAsset('flag-fen-wrc', {
    name: 'Flag Fen Water Recycling Centre',
    type: 'wastewater',
    subtype: 'pumping_station',
    region: CAMBS,
    regionSlug: CAMBS_SLUG,
    status: 'construction',
    statusDetail: 'Reported storm-capacity and pollution-risk reduction project',
    latitude: 52.583,
    longitude: 0.207,
    summary:
      'A \u00a310 million project is reported at Flag Fen, Peterborough, to expand storm-related capacity and reduce pollution risk. Investment completion alone is not an environmental outcome.',
    description:
      'A \u00a310 million project is reported at Flag Fen (Peterborough) to expand storm-related capacity and reduce pollution risk as part of Anglian Water\u2019s 2025-2030 programme. Proof of effect should compare rainfall-normalised overflow performance, storm-tank utilisation, treatment throughput and downstream conditions before and after commissioning.',
    operatorName: 'Anglian Water',
    regulatorName: 'Environment Agency',
    jurisdiction: 'England',
    priorityScore: 35,
  })

  await ensureProject(flagfen.id, {
    name: 'Flag Fen storm-capacity and pollution-risk project',
    description:
      'A reported \u00a310 million project to expand storm-related capacity and reduce pollution risk at Flag Fen, part of the 2025-2030 programme.',
    value: '\u00a310 million',
    status: 'construction',
    proofRequired:
      'Rainfall-normalised overflow performance, storm-tank utilisation, treatment throughput and downstream conditions compared before and after commissioning. Investment completion alone is not an environmental outcome.',
    sourceUrl: 'https://www.peterboroughtoday.co.uk/',
    evidenceClass: 'O',
  })

  await ensureGap(flagfen.id, {
    description:
      'BioVeracity has not located before/after overflow-performance or receiving-water data that would demonstrate the environmental effect of the reported Flag Fen project.',
    consequence:
      'Whether the investment reduces pollution risk in practice cannot yet be established.',
    dataRequired:
      'Sources to check: EA storm-overflow (EDM) dataset and water-quality archive. Last checked at seed time.',
    priority: 'medium',
    status: 'open',
  })

  // --- Whittlesey WRC (real Cambs Anglian Water asset; minimal public evidence located) ---
  const whittlesey = await upsertAsset('whittlesey-wrc', {
    name: 'Whittlesey Water Recycling Centre',
    type: 'wastewater',
    subtype: 'wrc',
    region: CAMBS,
    regionSlug: CAMBS_SLUG,
    status: 'monitoring',
    statusDetail: 'Anglian Water works; limited site-specific public evidence located',
    latitude: 52.557,
    longitude: -0.128,
    summary:
      'Anglian Water water-recycling centre at Whittlesey. No site-specific regulatory finding or monitoring series has been located in the reviewed public sources.',
    description:
      'The Whittlesey Water Recycling Centre is an Anglian Water works regulated by the Environment Agency. It is included as part of the Cambridgeshire wastewater picture; however, no site-specific regulatory finding, capital project or validated monitoring series has been located in the reviewed public sources.',
    operatorName: 'Anglian Water',
    regulatorName: 'Environment Agency',
    jurisdiction: 'England',
    priorityScore: 15,
  })

  await ensureGap(whittlesey.id, {
    description:
      'BioVeracity has not located a site-specific regulatory finding, capital project or validated monitoring series for Whittlesey WRC in the public sources reviewed.',
    consequence:
      'The works is part of the regional wastewater network but its current environmental performance is not established here.',
    dataRequired:
      'Sources to check: EA permit, compliance and enforcement registers; Anglian Water asset records. Last checked at seed time.',
    priority: 'low',
    status: 'open',
  })

  // --- Receiving waters (water bodies). Rivers are linear; coords are an INDICATIVE point on the course (framed as indicative in the UI). ---
  const cam = await upsertAsset('river-cam', {
    name: 'River Cam',
    type: 'river',
    subtype: 'water_body',
    region: CAMBS,
    regionSlug: CAMBS_SLUG,
    status: 'monitoring',
    statusDetail: 'Environment Agency WFD classification located — Moderate overall',
    latitude: 52.21,
    longitude: 0.12,
    summary:
      'The River Cam flows through Cambridge and receives treated effluent from the Cambridge (Milton) Water Recycling Centre. The Environment Agency Water Framework Directive classification for this water body (GB105033042750) has been located: Moderate overall, with ecological status Moderate and chemical status Fail. It is designated a Heavily Modified Water Body.',
    description:
      'The River Cam is the flagship receiving water of the Cambridgeshire showcase. The reviewed evidence establishes that the Cambridge (Milton) Water Recycling Centre discharges to it and that it sits within the North East Cambridge regeneration area. The Environment Agency Water Framework Directive classification for this water body (GB105033042750) has been located and records the water body as Moderate overall — ecological status Moderate, chemical status Fail — and designates it a Heavily Modified Water Body; these values are attributed to the Environment Agency classification record. A validated water-quality monitoring series adjacent to the Milton WRC discharge has still not been located in the reviewed public sources, so the effect of the discharge on the receiving water remains unresolved. A river is a linear water body rather than a single point; the map shows only an indicative point on its course through Cambridge for orientation, not a discharge or monitoring location.',
    operatorName: null,
    regulatorName: 'Environment Agency',
    jurisdiction: 'England',
    priorityScore: 50,
  })

  await ensureEvent(cam.id, {
    title: 'Receives discharge from the Cambridge (Milton) WRC',
    description:
      'The Cambridge (Milton) Water Recycling Centre discharges treated effluent to the River Cam. The river runs through the North East Cambridge regeneration area.',
    date: new Date('2025-01-01'),
    eventType: 'environmental',
    evidenceClass: 'O',
    changeType: 'event',
    sourceDomain: 'democracy.cambridge.gov.uk',
    verified: true,
  })

  await ensureEvent(cam.id, {
    title: 'Water Framework Directive classification located',
    description:
      'The Environment Agency classifies this water body (GB105033042750) as Moderate overall — ecological status Moderate, chemical status Fail — and designates it a Heavily Modified Water Body. These values are attributed to the Environment Agency Water Framework Directive classification record.',
    date: new Date('2025-06-01'),
    eventType: 'regulatory',
    evidenceClass: 'O',
    changeType: 'event',
    sourceDomain: 'environment.data.gov.uk',
    verified: true,
  })
  await ensureGap(cam.id, {
    description:
      'BioVeracity has not located a validated water-quality monitoring series for the River Cam adjacent to the Milton WRC discharge in the public sources reviewed.',
    consequence:
      'The effect of the discharge on the receiving water cannot be established without paired flow and concentration data.',
    dataRequired:
      'Sources to check: EA Water Quality Archive monitoring stations. Last checked at seed time.',
    priority: 'high',
    status: 'open',
  })

  const nene = await upsertAsset('river-nene', {
    name: 'River Nene',
    type: 'river',
    subtype: 'water_body',
    region: CAMBS,
    regionSlug: CAMBS_SLUG,
    status: 'monitoring',
    statusDetail: 'Receiving water for March WRC',
    latitude: 52.5736,
    longitude: -0.2478,
    summary:
      'The River Nene receives discharge from March Water Recycling Centre. A validated water-quality monitoring series adjacent to the discharge has not been located in the reviewed public sources.',
    description:
      'The River Nene is identified as the receiving water for the March Water Recycling Centre discharge. Its Water Framework Directive classification and a validated monitoring series adjacent to the discharge are recorded as evidence gaps because they were not located in the reviewed public sources. A river is a linear water body rather than a single point; the map shows only an indicative point on its course through Peterborough for orientation, not a discharge or monitoring location.',
    operatorName: null,
    regulatorName: 'Environment Agency',
    jurisdiction: 'England',
    priorityScore: 30,
  })

  await ensureEvent(nene.id, {
    title: 'Receives discharge from March WRC',
    description:
      'March Water Recycling Centre discharges to the River Nene.',
    date: new Date('2025-01-01'),
    eventType: 'environmental',
    evidenceClass: 'O',
    changeType: 'event',
    sourceDomain: 'environment.data.gov.uk',
    verified: true,
  })

  await ensureGap(nene.id, {
    description:
      'BioVeracity has not located a validated water-quality monitoring series for the River Nene adjacent to the March WRC discharge in the public sources reviewed.',
    consequence:
      'The effect of the discharge on the receiving water cannot be established without monitoring data.',
    dataRequired:
      'Sources to check: EA Water Quality Archive. Last checked at seed time.',
    priority: 'medium',
    status: 'open',
  })

  console.log('Cambridgeshire & ports seed complete.')
  const count = await prisma.asset.count({ where: { regionSlug: CAMBS_SLUG } })
  console.log(`Assets in Cambridgeshire region: ${count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
