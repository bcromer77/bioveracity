import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { enrichIrishPorts } from './irish-ports-enrichment'

// ---------------------------------------------------------------------------
// DEMO / BOOTSTRAP SEED
// This script populates the demo/bootstrap corpus (the initial assets and
// evidence used to showcase the product). It is intentionally separate from
// production corpus ingestion (RawIngest -> ObservationCandidate -> verify ->
// SourceDocument -> normalise -> canonical), which is driven by the ingest
// pipeline, not by this file.
//
// It is idempotent: the admin account is upserted, and each demo evidence
// block is only created when that table is empty, so re-running against an
// already-populated database does NOT create duplicate rows. No records are
// ever deleted here.
//
// The admin/bootstrap credential is read from the environment
// (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) and is never hard-coded. If either
// is unset, admin creation is skipped.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient()

async function main() {
  // Seed admin/bootstrap account from environment (no hard-coded credential).
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12)
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: 'admin', accessState: 'ADMIN' },
      create: {
        email: adminEmail,
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin',
        accessState: 'ADMIN',
      },
    })
  } else {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set - skipping admin account seed')
  }

  // ===== ASSETS =====
  const portOfCork = await prisma.asset.upsert({
    where: { slug: 'port-of-cork' },
    update: {},
    create: {
      slug: 'port-of-cork',
      name: 'Port of Cork / Ringaskiddy',
      type: 'port',
      subtype: 'container_terminal',
      region: 'Irish Ports',
      regionSlug: 'irish_ports',
      status: 'construction',
      statusDetail: 'Cork Container Terminal opened September 2022 at €94 million. Selected for €38.4 million CEF support for 200m container-berth extension and 182m Deepwater Berth extension. Associated M28 Cork–Ringaskiddy road (€456 million) received Cabinet approval April 2025.',
      latitude: 51.8329,
      longitude: -8.3125,
      summary: 'Major port redevelopment with berth extensions supported by €38.4M EU funding and the €456M M28 project. Proof-of-effect requirement around capacity, access, construction and marine effects.',
      description: 'Port of Cork\'s central proof-of-effect opportunity is Ringaskiddy. The Cork Container Terminal opened in September 2022. In July 2024, the port was selected for €38.4 million of Connecting Europe Facility support for berth extensions intended to increase capacity and support offshore renewable energy. The port redevelopment received ten-year planning permission in May 2015. Subsequent changes to handling methods and berth design required further environmental assessment. This creates a long evidence history in which approved design assumptions, later alterations and actual construction effects need to be reconciled.',
      operatorName: 'Port of Cork Company',
      regulatorName: 'EPA Ireland / An Coimisiún Pleanála',
      jurisdiction: 'Ireland',
      priorityScore: 20,
    },
  })

  const dublinPort = await prisma.asset.upsert({
    where: { slug: 'dublin-port' },
    update: {},
    create: {
      slug: 'dublin-port',
      name: 'Dublin Port',
      type: 'port',
      subtype: 'multi_purpose',
      region: 'Irish Ports',
      regionSlug: 'irish_ports',
      status: 'planning',
      statusDetail: '3FM application submitted as Strategic Infrastructure Development on 23 July 2024. 51 valid submissions received by 25 October 2024. Dublin Port Company submitted further response in August 2025 addressing ecology, ornithology, noise, vibration, traffic and land use.',
      latitude: 53.3478,
      longitude: -6.2044,
      summary: '3FM planning process with 51 public submissions addressing ecology, birds, noise, vibration, traffic and land use. Also operates under EPA dumping-at-sea permit S0024-02 for capital dredging.',
      description: 'Dublin Port\'s 3FM application was submitted on 23 July 2024 as Strategic Infrastructure Development. Public consultation ran from 31 July to 25 September 2024, and 51 valid submissions had been received by 25 October 2024. Separately, Dublin Port operates under EPA dumping-at-sea permit S0024-02 for capital dredging including the MP2 project, using a licensed disposal site west of Burford Bank. The opportunity is to prevent fragmentation between the 3FM planning record and the continuing marine permit record.',
      operatorName: 'Dublin Port Company',
      regulatorName: 'An Coimisiún Pleanála / EPA Ireland',
      jurisdiction: 'Ireland',
      priorityScore: 22,
    },
  })

  const shannonFoynes = await prisma.asset.upsert({
    where: { slug: 'shannon-foynes' },
    update: {},
    create: {
      slug: 'shannon-foynes',
      name: 'Shannon Foynes Port',
      type: 'port',
      subtype: 'logistics_ore',
      region: 'Irish Ports',
      regionSlug: 'irish_ports',
      status: 'active',
      statusDetail: 'Positioned as a major prospective offshore-renewable-energy and logistics location. EPA record confirms permitted maintenance dredging at Ted Russell Dock in Limerick and Foynes Harbour with disposal at three licensed locations.',
      latitude: 52.6119,
      longitude: -9.1125,
      summary: 'Strategic ORE and logistics port with cumulative estuary evidence needs. Maintenance dredging permitted at three disposal locations in the Shannon Estuary.',
      description: 'Shannon Foynes is positioned as a major prospective offshore-renewable-energy and logistics location, supported by its strategic plan and the Shannon Estuary planning framework. The EPA record confirms permitted maintenance dredging at the Ted Russell Dock in Limerick and Foynes Harbour, with disposal at three licensed locations. Because the estuary hosts multiple developments and environmentally sensitive receptors, the opportunity is cumulative rather than project-specific.',
      operatorName: 'Shannon Foynes Port Company',
      regulatorName: 'EPA Ireland',
      jurisdiction: 'Ireland',
      priorityScore: 19,
    },
  })

  const rosslare = await prisma.asset.upsert({
    where: { slug: 'rosslare-europort' },
    update: {},
    create: {
      slug: 'rosslare-europort',
      name: 'Rosslare Europort ORE Hub',
      type: 'port',
      subtype: 'ore_hub',
      region: 'Irish Ports',
      regionSlug: 'irish_ports',
      status: 'planning',
      statusDetail: 'Application lodged 10 December 2025 following Maritime Area Consent MAC20230005 (granted 2 July 2025). Statutory consultation to 24 February 2026. Proposal covers 80.3ha including 48.4ha capital dredging and 27.7ha reclamation.',
      latitude: 52.2543,
      longitude: -6.3389,
      summary: 'Major ORE hub proposal: 48.4ha dredging, 27.7ha reclamation, two heavy-lift berths, 50-year marine design life. High-value planning-sensitive proof-of-effect case.',
      description: 'The Rosslare ORE Hub application was lodged on 10 December 2025, following the grant of Maritime Area Consent MAC20230005 on 2 July 2025. The proposal covers 80.3 hectares, including 48.4 hectares of capital dredging, dredged depths of minus 10 metres Chart Datum for the navigation channel and minus 12 metres for ORE Berth 1, 27.7 hectares of marine reclamation, two heavy-lift berths of 330 metres and 240 metres, a 19.7-hectare ORE storage area, and replacement facilities for the existing small-boat harbour.',
      operatorName: 'Iarnród Éireann',
      regulatorName: 'An Coimisiún Pleanála / MARA',
      jurisdiction: 'Ireland',
      priorityScore: 23,
    },
  })

  const marchWRC = await prisma.asset.upsert({
    where: { slug: 'march-wrc' },
    update: {},
    create: {
      slug: 'march-wrc',
      name: 'March Water Recycling Centre',
      type: 'wastewater',
      subtype: 'wrc',
      region: 'Cambridgeshire',
      regionSlug: 'cambridgeshire',
      status: 'monitoring',
      statusDetail: 'Clear case for reconciling human experience with operational evidence. Residents report persistent odour. Anglian Water paused lime-related waste treatment 27 July to 22 September 2025. No supplied record confirms EA enforcement or planning sanction.',
      latitude: 52.5519,
      longitude: 0.0875,
      summary: 'Persistent community odour reports, 30-40 daily heavy vehicle movements reported. Lime treatment pause in summer 2025 offers quasi-experimental comparison. No enforcement finding established.',
      description: 'March WRC is a clear case for reconciling human experience with operational evidence. Residents have reported persistent severe odour, approximately 30–40 lorry or tanker movements per day, road deterioration, vibration and alleged spillages. Anglian Water temporarily paused waste-treatment operations involving lime from 27 July to 22 September 2025. No supplied record confirms Environment Agency enforcement or planning sanction against March WRC.',
      operatorName: 'Anglian Water',
      regulatorName: 'Environment Agency',
      jurisdiction: 'England',
      priorityScore: 21,
    },
  })

  const miltonWRC = await prisma.asset.upsert({
    where: { slug: 'milton-wrc' },
    update: {},
    create: {
      slug: 'milton-wrc',
      name: 'Milton / Cambridge Water Recycling Centre',
      type: 'wastewater',
      subtype: 'wrc',
      region: 'Cambridgeshire',
      regionSlug: 'cambridgeshire',
      status: 'active',
      statusDetail: 'Relocation received development consent April 2025 but cancelled August 2025 after HIF funding withdrawn. Anglian Water reviewing alternatives to increase capacity at existing plant. Sits within North East Cambridge regeneration area.',
      latitude: 52.2297,
      longitude: 0.1506,
      summary: 'Relocation project cancelled after government funding withdrawn. Capacity expansion options under review. Planning-sensitive site within North East Cambridge regeneration area.',
      description: 'The existing plant serves Cambridge and surrounding villages and sits within the North East Cambridge regeneration area. The proposed relocation received development consent in April 2025 but was cancelled in August 2025 after Housing Infrastructure Fund support was withdrawn. Anglian Water states that it is reviewing alternatives to increase capacity at the existing plant. Historical odour reports exist but the available evidence refers to only five operator-recorded complaints in one earlier reporting period.',
      operatorName: 'Anglian Water',
      regulatorName: 'Environment Agency',
      jurisdiction: 'England',
      priorityScore: 19,
    },
  })

  const seafield = await prisma.asset.upsert({
    where: { slug: 'seafield-wwtw' },
    update: {},
    create: {
      slug: 'seafield-wwtw',
      name: 'Edinburgh Seafield WWTW',
      type: 'wastewater',
      subtype: 'wwtw',
      region: 'Scotland',
      regionSlug: 'scotland',
      status: 'construction',
      statusDetail: '£10 million Seafield Sludge Investment Project scheduled to start summer 2026 and complete by end-2027. Follows a £25 million Odour Improvement Project completed in 2010. Site expected to return to Scottish Water ownership in 2029.',
      latitude: 55.9686,
      longitude: -3.1538,
      summary: 'Clearest UK proof-of-effect project. £10M sludge investment for covered storage and odour reduction. Long community concern history. Veolia PFI operation returning to Scottish Water 2029.',
      description: 'Seafield WWTW processes a reported 265 million litres of wastewater per day. It is operated by Veolia under a PFI arrangement. The £10 million Seafield Sludge Investment Project is intended to add storage capacity and move odorous sludge from open areas into covered, extracted facilities. Construction is scheduled to start in summer 2026 and finish by end-2027. The City of Edinburgh Council investigates strong and persistent sewerage odours. SEPA addresses odour associated with waste treatment.',
      operatorName: 'Veolia (PFI) / Scottish Water',
      regulatorName: 'SEPA / City of Edinburgh Council',
      jurisdiction: 'Scotland',
      priorityScore: 23,
    },
  })

  const loughNeagh = await prisma.asset.upsert({
    where: { slug: 'lough-neagh' },
    update: {},
    create: {
      slug: 'lough-neagh',
      name: 'Lough Neagh',
      type: 'lake',
      subtype: 'catchment',
      region: 'Northern Ireland',
      regionSlug: 'northern_ireland',
      status: 'monitoring',
      statusDetail: 'Executive approved 37-point Action Plan July 2024. By mid-2025, 23 actions delivered and 14 in progress. Severe blooms continued in 2025. 339 treatment works, 724 storm overflows in catchment. Nutrient attribution disputed.',
      latitude: 54.6167,
      longitude: -6.4000,
      summary: 'Most complex evidence environment across all markets. Recurring cyanobacterial blooms, disputed nutrient sources, 339 WWTWs, 724 overflows. Drinking water compliant but taste/odour events recorded.',
      description: 'Lough Neagh\'s recurring cyanobacterial blooms create the most complex evidence environment in the four markets. The Executive approved a 37-point Action Plan in July 2024. By mid-2025, DAERA reported 23 actions delivered and 14 in progress. Yet severe blooms continued in 2025. The high-value product is a trusted system of record showing what each intervention changed, over what area, against what counterfactual and with what uncertainty. Nutrient-source estimates vary: approximately 56–62% agriculture and 24–36% wastewater. Drinking-water compliance was 99.88% for 2024, but serious taste-and-odour events were recorded in September 2024.',
      operatorName: 'NI Water / Multiple',
      regulatorName: 'DAERA / NIEA',
      jurisdiction: 'Northern Ireland',
      priorityScore: 25,
    },
  })

  // ===== EVENTS =====
  const eventData = [
    // Port of Cork
    { assetId: portOfCork.id, title: '€38.4M CEF funding selected for Ringaskiddy berth extensions', date: new Date('2024-07-15'), eventType: 'planning', evidenceClass: 'G', severity: 'high', sourceDomain: 'gov.ie' },
    { assetId: portOfCork.id, title: '€456M M28 Cork–Ringaskiddy road receives Cabinet approval', date: new Date('2025-04-10'), eventType: 'planning', evidenceClass: 'G', severity: 'high', sourceDomain: 'gov.ie' },
    { assetId: portOfCork.id, title: 'Ten-year planning permission granted for port redevelopment', date: new Date('2015-05-01'), eventType: 'planning', evidenceClass: 'P', severity: 'medium', sourceDomain: 'pleanala.ie' },
    // Dublin Port
    { assetId: dublinPort.id, title: '3FM SID application submitted to An Coimisiún Pleanála', date: new Date('2024-07-23'), eventType: 'planning', evidenceClass: 'P', severity: 'high', sourceDomain: 'pleanala.ie' },
    { assetId: dublinPort.id, title: '51 valid public submissions received on 3FM', date: new Date('2024-10-25'), eventType: 'planning', evidenceClass: 'P', severity: 'medium', sourceDomain: 'pleanala.ie' },
    { assetId: dublinPort.id, title: 'Dublin Port Company submits response addressing ecology, noise, traffic', date: new Date('2025-08-01'), eventType: 'planning', evidenceClass: 'O', severity: 'medium', sourceDomain: 'pleanala.ie' },
    // Shannon Foynes
    { assetId: shannonFoynes.id, title: 'Planning documents reference dredging identifier LIC230014', date: new Date('2024-11-01'), eventType: 'planning', evidenceClass: 'P', severity: 'low', sourceDomain: 'pleanala.ie' },
    { assetId: shannonFoynes.id, title: 'Maintenance dredging and three disposal sites documented by EPA', date: new Date('2024-06-01'), eventType: 'regulatory', evidenceClass: 'R', severity: 'low', sourceDomain: 'leap.epa.ie' },
    // Rosslare
    { assetId: rosslare.id, title: 'Maritime Area Consent MAC20230005 granted', date: new Date('2025-07-02'), eventType: 'planning', evidenceClass: 'P', severity: 'high', sourceDomain: 'pleanala.ie' },
    { assetId: rosslare.id, title: 'ORE Hub planning application lodged', date: new Date('2025-12-10'), eventType: 'planning', evidenceClass: 'P', severity: 'high', sourceDomain: 'pleanala.ie' },
    { assetId: rosslare.id, title: 'Statutory consultation period closes', date: new Date('2026-02-24'), eventType: 'planning', evidenceClass: 'P', severity: 'medium', sourceDomain: 'pleanala.ie' },
    // March WRC
    { assetId: marchWRC.id, title: 'Anglian Water pauses lime-related waste treatment', date: new Date('2025-07-27'), eventType: 'operational', evidenceClass: 'O', severity: 'medium', sourceDomain: 'marchtowncouncil.gov.uk' },
    { assetId: marchWRC.id, title: 'Lime treatment resumes after summer pause', date: new Date('2025-09-22'), eventType: 'operational', evidenceClass: 'O', severity: 'medium', sourceDomain: 'marchtowncouncil.gov.uk' },
    { assetId: marchWRC.id, title: 'Residents report persistent severe odour and 30-40 daily HGV movements', date: new Date('2025-06-01'), eventType: 'community', evidenceClass: 'C', severity: 'high', sourceDomain: 'lbc.co.uk' },
    // Milton WRC
    { assetId: miltonWRC.id, title: 'Relocation development consent granted', date: new Date('2025-04-01'), eventType: 'planning', evidenceClass: 'P', severity: 'high', sourceDomain: 'anglianwater.co.uk' },
    { assetId: miltonWRC.id, title: 'Relocation cancelled after HIF funding withdrawn', date: new Date('2025-08-01'), eventType: 'planning', evidenceClass: 'P', severity: 'critical', sourceDomain: 'anglianwater.co.uk' },
    // Seafield
    { assetId: seafield.id, title: '£10M Sludge Investment Project construction scheduled to begin', date: new Date('2026-06-01'), eventType: 'construction', evidenceClass: 'O', severity: 'high', sourceDomain: 'scottishwater.co.uk' },
    { assetId: seafield.id, title: '£25M Odour Improvement Project completed', date: new Date('2010-12-01'), eventType: 'construction', evidenceClass: 'O', severity: 'medium', sourceDomain: 'scottishwater.co.uk' },
    { assetId: seafield.id, title: 'Strategic Odour Review recommendations published', date: new Date('2017-11-01'), eventType: 'regulatory', evidenceClass: 'O', severity: 'medium', sourceDomain: 'scottishwater.co.uk' },
    // Lough Neagh
    { assetId: loughNeagh.id, title: 'Executive approves 37-point Lough Neagh Action Plan', date: new Date('2024-07-01'), eventType: 'regulatory', evidenceClass: 'G', severity: 'critical', sourceDomain: 'daera-ni.gov.uk' },
    { assetId: loughNeagh.id, title: 'DAERA reports 23 of 37 actions delivered, 14 in progress', date: new Date('2025-06-01'), eventType: 'regulatory', evidenceClass: 'G', severity: 'high', sourceDomain: 'daera-ni.gov.uk' },
    { assetId: loughNeagh.id, title: 'Serious taste-and-odour events at Castor Bay and Moyola WTW', date: new Date('2024-09-15'), eventType: 'environmental', evidenceClass: 'R', severity: 'high', sourceDomain: 'daera-ni.gov.uk' },
    { assetId: loughNeagh.id, title: 'Fisheries, Aquaculture and Water Environment Bill introduced', date: new Date('2026-06-22'), eventType: 'regulatory', evidenceClass: 'G', severity: 'high', sourceDomain: 'daera-ni.gov.uk' },
    { assetId: loughNeagh.id, title: 'OEP opens investigation into DfI, DAERA and Utility Regulator', date: new Date('2025-11-01'), eventType: 'regulatory', evidenceClass: 'R', severity: 'critical', sourceDomain: 'theoep.org.uk' },
    { assetId: loughNeagh.id, title: 'Drinking water compliance reported at 99.88% for 2024', date: new Date('2025-03-01'), eventType: 'environmental', evidenceClass: 'R', severity: 'info', sourceDomain: 'daera-ni.gov.uk' },
    { assetId: loughNeagh.id, title: 'Four suppliers advance to Phase 2 of blue-green algae innovation pilots', date: new Date('2026-03-01'), eventType: 'operational', evidenceClass: 'G', severity: 'medium', sourceDomain: 'daera-ni.gov.uk' },
  ]

  if ((await prisma.event.count()) === 0) {
    for (const e of eventData) {
      await prisma.event.create({ data: e })
    }
  }

  // ===== AUTHORISATIONS =====
  const authData = [
    { assetId: dublinPort.id, permitRef: 'S0024-02', type: 'dumping_at_sea', status: 'active', authority: 'EPA Ireland', description: 'Dumping-at-sea permit for capital dredging including MP2 project. Disposal at licensed site west of Burford Bank.', evidenceClass: 'R' },
    { assetId: rosslare.id, permitRef: 'MAC20230005', type: 'mac', grantedDate: new Date('2025-07-02'), status: 'active', authority: 'MARA', description: 'Maritime Area Consent for Rosslare ORE Hub development.', evidenceClass: 'P' },
    { assetId: marchWRC.id, permitRef: 'AN/AW1NF1063/015', type: 'environmental_permit', status: 'active', authority: 'Environment Agency', description: 'Environmental permit for March Water Recycling Centre.', evidenceClass: 'R' },
    { assetId: seafield.id, type: 'environmental_permit', status: 'active', authority: 'SEPA', description: 'Discharge and waste treatment authorisation for Seafield WWTW.', evidenceClass: 'R' },
    { assetId: shannonFoynes.id, type: 'dumping_at_sea', status: 'active', authority: 'EPA Ireland', description: 'Maintenance dredging permit for Ted Russell Dock and Foynes Harbour with three licensed disposal locations.', evidenceClass: 'R' },
  ]

  if ((await prisma.authorisation.count()) === 0) {
    for (const a of authData) {
      await prisma.authorisation.create({ data: a })
    }
  }

  // ===== CAPITAL PROJECTS =====
  const projectData = [
    { assetId: portOfCork.id, name: 'Ringaskiddy Container Berth Extension', value: '€38.4 million (CEF)', status: 'approved', description: '200m container-berth and 182m Deepwater Berth extensions to increase capacity and support ORE.', proofRequired: 'Environmental baseline before works, consent commitment mapping, actual vs predicted coastal-process effects.', evidenceClass: 'G' },
    { assetId: portOfCork.id, name: 'M28 Cork–Ringaskiddy Road', value: '€456 million', status: 'approved', description: 'Approximately 11km of motorway and 1.5km of single carriageway to support port access.', startDate: new Date('2025-04-10'), proofRequired: 'Combined programme access and relocation benefits verification.', evidenceClass: 'G' },
    { assetId: rosslare.id, name: 'Rosslare ORE Hub', value: 'Not disclosed', status: 'planning', description: '80.3ha development: 48.4ha capital dredging, 27.7ha marine reclamation, two heavy-lift berths (330m and 240m), 19.7ha ORE storage.', proofRequired: 'Receptor-specific baselines, sediment quality, turbidity, ecology, noise, community access.', evidenceClass: 'P' },
    { assetId: seafield.id, name: 'Seafield Sludge Investment Project', value: '£10 million', status: 'approved', description: 'Additional covered storage and odour reduction. Construction summer 2026 to end-2027.', startDate: new Date('2026-06-01'), endDate: new Date('2027-12-31'), proofRequired: 'Odour frequency/duration before and after, sludge in covered conditions, complaint rates, wind alignment.', evidenceClass: 'O' },
    { assetId: loughNeagh.id, name: 'Ballyronan WWTW Upgrade', value: '£4.8 million', status: 'planned', description: 'Treatment works upgrade to meet tighter discharge consents.', proofRequired: 'Commissioning dates, influent/effluent loads, consent limits, receiving-water observations.', evidenceClass: 'O' },
    { assetId: miltonWRC.id, name: 'Cambridge WWTP Relocation (Cancelled)', value: 'Significant (HIF funded)', status: 'cancelled', description: 'Proposed relocation to release land for 8,300-8,500 homes. Consent granted April 2025, cancelled August 2025 after funding withdrawn.', proofRequired: 'Capacity expansion options at existing site now require evidence framework.', evidenceClass: 'P' },
  ]

  if ((await prisma.capitalProject.count()) === 0) {
    for (const p of projectData) {
      await prisma.capitalProject.create({ data: p })
    }
  }

  // ===== REGULATORY ACTIVITY =====
  const regData = [
    { assetId: marchWRC.id, title: 'Environment Agency Anglian area: 1,500+ wastewater inspections', description: 'Five dedicated water-industry regulation teams completed more than 1,500 compliance inspections between April 2025 and March 2026. Portfolio-level finding, not site-specific to March.', date: new Date('2026-03-31'), regulator: 'Environment Agency', type: 'inspection', evidenceClass: 'R' },
    { assetId: marchWRC.id, title: 'Ofwat enforcement: Anglian Water £62.8M redress package', description: 'Ofwat concluded investigation into Anglian Water management of sewage-treatment works. Undertakings and £62.8 million redress package including £57M for Excess Flow Management Plans. Portfolio-level, not site-specific.', date: new Date('2025-09-01'), regulator: 'Ofwat', type: 'enforcement', evidenceClass: 'R' },
    { assetId: seafield.id, title: 'Edinburgh Public Health Team odour investigation powers', description: 'City of Edinburgh Council states powers are limited and cannot require complete elimination of odour, but can act where reasonable minimisation measures have not been taken.', regulator: 'City of Edinburgh Council', type: 'investigation', evidenceClass: 'G' },
    { assetId: loughNeagh.id, title: 'OEP statutory investigation into DfI, DAERA and Utility Regulator', description: 'Opened November 2025. Concerns regulation of untreated wastewater discharges to Belfast Lough and surrounding rivers. NI Water is not the subject of the investigation.', date: new Date('2025-11-01'), regulator: 'Office for Environmental Protection', type: 'investigation', evidenceClass: 'R' },
    { assetId: loughNeagh.id, title: 'Proposed withdrawal from SORPI 2007', description: 'NIEA proposes ending the 2007 Statement of Regulatory Principles and Intent to move towards equal regulatory treatment. NI Water requests phased, funded transition.', date: new Date('2025-06-01'), regulator: 'NIEA / DAERA', type: 'consultation', evidenceClass: 'G' },
    { assetId: dublinPort.id, title: '3FM public consultation with 51 valid submissions', description: 'Consultation ran 31 July to 25 September 2024. Submissions address ecology, birds, noise, vibration, traffic and land-use planning.', date: new Date('2024-10-25'), regulator: 'An Coimisiún Pleanála', type: 'consultation', evidenceClass: 'P' },
  ]

  if ((await prisma.regulatoryActivity.count()) === 0) {
    for (const r of regData) {
      await prisma.regulatoryActivity.create({ data: r })
    }
  }

  // ===== COMMUNITY REPORTS =====
  const communityData = [
    { assetId: marchWRC.id, title: 'Persistent severe odour reported by March residents', description: 'Residents describe effects on gardens, open windows, business plans and quality of life. Media-recorded community reports, not regulator findings.', date: new Date('2025-06-01'), reportedBy: 'Residents', type: 'odour', evidenceClass: 'C' },
    { assetId: marchWRC.id, title: 'Approximately 30-40 daily HGV/tanker movements reported', description: 'Community reports of road deterioration, vibration and alleged spillages of sewage cake. These are community observations not supported by an authoritative incident record.', date: new Date('2025-06-01'), reportedBy: 'Residents', type: 'traffic', evidenceClass: 'C' },
    { assetId: seafield.id, title: 'Long history of community odour concern around Seafield', description: 'The Seafield Stakeholder Group provides a forum for community engagement. Site has generated complaints for decades.', reportedBy: 'Stakeholder Group', type: 'odour', evidenceClass: 'C' },
    { assetId: loughNeagh.id, title: 'Severe bloom conditions described as exceptionally intense in 2025', description: 'Local observers described conditions as exceptionally intense. Save Lough Neagh and other groups have organised public protests.', date: new Date('2025-08-01'), reportedBy: 'Community observers / campaigners', type: 'visual', evidenceClass: 'C' },
    { assetId: loughNeagh.id, title: 'Eel fishery and other users report substantial disruption', description: 'According to government, media and stakeholder records. Claims of ecological collapse are stakeholder descriptions unless tied to specific official incident records.', date: new Date('2025-06-01'), reportedBy: 'Eel fishers / Countryside Alliance Ireland', type: 'health', evidenceClass: 'C' },
    { assetId: loughNeagh.id, title: 'Judicial review challenge by eel fisherman Declan Conlon', description: 'River Action UK supports a judicial-review challenge. Active legal claim, not a finding of liability.', date: new Date('2025-09-01'), reportedBy: 'River Action UK', type: 'health', evidenceClass: 'C' },
  ]

  if ((await prisma.communityReport.count()) === 0) {
    for (const c of communityData) {
      await prisma.communityReport.create({ data: c })
    }
  }

  // ===== EVIDENCE GAPS =====
  const gapData = [
    { assetId: marchWRC.id, description: 'No verified odour concentration or source-apportionment series supplied', consequence: 'Cannot determine whether specific processes or external sources are responsible for reported odour.', dataRequired: 'Dispersion modelling, source apportionment, wind-correlated odour measurements', priority: 'critical' },
    { assetId: marchWRC.id, description: 'No complete complaint chronology supplied', consequence: 'Cannot correlate reported odour with operational state, weather, or vehicle movements.', dataRequired: 'Timestamped complaint records, operational logs, vehicle counts', priority: 'high' },
    { assetId: marchWRC.id, description: 'Alleged spillages not supported by authoritative incident record', consequence: 'Community reports cannot be confirmed or refuted.', dataRequired: 'Environment Agency incident records, operator event logs', priority: 'high' },
    { assetId: miltonWRC.id, description: 'Replacement capacity options undefined after relocation cancellation', consequence: 'Prior environmental work may become stranded unless mapped to future options.', dataRequired: 'Options appraisal scope, baseline evidence transferability assessment', priority: 'high' },
    { assetId: seafield.id, description: 'No agreed quantitative post-project odour criteria supplied', consequence: 'Completion in 2027 may not resolve debate over effectiveness without pre-agreed measures.', dataRequired: 'Odour outcome definitions agreed by Scottish Water, Veolia, Council, SEPA and stakeholders', priority: 'critical' },
    { assetId: loughNeagh.id, description: 'Nutrient-source percentages vary by model scope and source grouping', consequence: 'A single headline attribution would be misleading. Competing estimates cannot be reconciled without common model boundary.', dataRequired: 'Model boundary definitions, period, source grouping methodology for each estimate', priority: 'critical' },
    { assetId: loughNeagh.id, description: 'Tributary stations lack continuous nutrient concentration data', consequence: 'Tributary source-to-lough attribution remains incomplete. Near-real-time load calculation not possible.', dataRequired: 'Paired flow and nutrient concentration data at tributary stations', priority: 'critical' },
    { assetId: loughNeagh.id, description: 'Majority of 724 overflows lack confirmed EDM coverage', consequence: 'Overflow frequency and duration cannot be independently verified for most locations.', dataRequired: 'Asset-by-asset EDM installation status and data quality records', priority: 'high' },
    { assetId: loughNeagh.id, description: 'Sediment phosphorus release contribution not quantified', consequence: 'Short-term lack of ecological response may not prove interventions failed—internal loading may sustain blooms.', dataRequired: 'Quantified sediment phosphorus release estimates and modelling', priority: 'high' },
  ]

  if ((await prisma.evidenceGap.count()) === 0) {
    for (const g of gapData) {
      await prisma.evidenceGap.create({ data: g })
    }
  }

  // ===== NEWS ITEMS =====
  const newsData = [
    { assetId: loughNeagh.id, title: 'UK\'s largest lake faces environmental crisis as rescue plans stall', date: new Date('2025-08-30'), sourceDomain: 'theguardian.com', evidenceClass: 'M', region: 'Northern Ireland', category: 'water' },
    { assetId: loughNeagh.id, title: 'Minister Muir introduces Fisheries, Aquaculture and Water Environment Bill', date: new Date('2026-06-22'), sourceDomain: 'daera-ni.gov.uk', evidenceClass: 'G', region: 'Northern Ireland', category: 'regulation' },
    { assetId: marchWRC.id, title: 'Cambridgeshire market town blighted by smell from sewage works', date: new Date('2025-06-01'), sourceDomain: 'lbc.co.uk', evidenceClass: 'M', region: 'Cambridgeshire', category: 'wastewater' },
    { assetId: seafield.id, title: 'Scottish Water announces £10M Seafield sludge investment', date: new Date('2026-03-12'), sourceDomain: 'scottishwater.co.uk', evidenceClass: 'O', region: 'Scotland', category: 'wastewater' },
    { assetId: portOfCork.id, title: 'Irish projects to receive €112M+ from EU Connecting Europe Facility', date: new Date('2024-07-15'), sourceDomain: 'gov.ie', evidenceClass: 'G', region: 'Irish Ports', category: 'ports' },
    { assetId: dublinPort.id, title: 'Dublin Port 3FM applicant response addresses ecology, noise, traffic', date: new Date('2025-08-01'), sourceDomain: 'pleanala.ie', evidenceClass: 'P', region: 'Irish Ports', category: 'ports' },
    { title: 'Anglian Water £62.8M redress package after Ofwat investigation', date: new Date('2025-09-01'), sourceDomain: 'ofwat.gov.uk', evidenceClass: 'R', region: 'Cambridgeshire', category: 'regulation' },
    { title: 'Environment Agency secures £275,000 from Anglian Water', date: new Date('2025-06-01'), sourceDomain: 'gov.uk', evidenceClass: 'R', region: 'Cambridgeshire', category: 'regulation' },
    { assetId: loughNeagh.id, title: 'OEP investigates over Belfast Lough sewage discharges', date: new Date('2025-11-25'), sourceDomain: 'theoep.org.uk', evidenceClass: 'R', region: 'Northern Ireland', category: 'regulation' },
    { assetId: rosslare.id, title: 'Rosslare ORE Hub MAC consent granted for major port development', date: new Date('2025-07-02'), sourceDomain: 'pleanala.ie', evidenceClass: 'P', region: 'Irish Ports', category: 'ports' },
  ]

  if ((await prisma.newsItem.count()) === 0) {
    for (const n of newsData) {
      await prisma.newsItem.create({ data: n })
    }
  }

  // ===== MEASUREMENTS =====
  const measurementData = [
    { assetId: loughNeagh.id, parameter: 'Drinking water compliance', value: 99.88, unit: '%', date: new Date('2024-12-31'), station: 'NI-wide treated water', validated: true, evidenceClass: 'R' },
    { assetId: loughNeagh.id, parameter: 'Phycocyanin fluorescence', value: null, unit: 'RFU', date: new Date('2026-06-01'), station: 'Rea\'s Wood (30-min telemetry)', validated: false, evidenceClass: 'R' },
    { assetId: loughNeagh.id, parameter: 'Dissolved oxygen', value: null, unit: 'mg/L', date: new Date('2026-06-01'), station: 'Washing Bay (30-min telemetry)', validated: false, evidenceClass: 'R' },
    { assetId: loughNeagh.id, parameter: 'Temperature', value: null, unit: '°C', date: new Date('2026-06-01'), station: 'Six Mile Water tributary (monthly)', validated: false, evidenceClass: 'R' },
  ]

  if ((await prisma.measurement.count()) === 0) {
    for (const m of measurementData) {
      await prisma.measurement.create({ data: m })
    }
  }

  // Irish Ports maritime module: ensure all five ports exist, attach real
  // source URLs, and add the source-backed intervention / pipeline / change
  // records. Idempotent and additive (no deletes) — safe on the shared DB.
  await enrichIrishPorts(prisma)

  console.log('Seed completed successfully')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
