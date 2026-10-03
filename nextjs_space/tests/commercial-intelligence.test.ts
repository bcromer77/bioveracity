import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { commercialService, type Database, type Sql } from '../lib/commercial/service'
import { CommercialError } from '../lib/commercial/principles'
import { SIGNALS, operationalSignals } from '../lib/commercial/registry'

const RETRIEVED = '2026-10-03'

function sql(client: Pick<PGlite, 'query'>): Sql {
  return { query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows }
}

async function database() {
  const pg = new PGlite()
  await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY)')
  await pg.exec(readFileSync(new URL('../prisma/migrations/20260909_private_workspace_foundation/migration.sql', import.meta.url), 'utf8'))
  await pg.exec(readFileSync(new URL('../prisma/migrations/20261003_commercial_intelligence/migration.sql', import.meta.url), 'utf8'))
  await pg.exec(`INSERT INTO "User" (id) VALUES ('alice'),('bob'),('cara')`)
  await pg.exec(`INSERT INTO "PrivateWorkspace" (id,name) VALUES ('org-a','Demonstration organisation'),('org-b','Another organisation')`)
  await pg.exec(`INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES
    ('org-a','alice','OWNER'),('org-a','bob','VIEWER'),('org-b','cara','OWNER')`)
  const db = (user: string): Database => ({
    ...sql(pg),
    transaction: operation => pg.transaction(tx => operation(sql(tx))),
  })
  return { pg, alice: commercialService(db('alice'), 'alice'), bob: commercialService(db('bob'), 'bob'), cara: commercialService(db('cara'), 'cara') }
}

test('the registry separates retrieved signals from signals that were not checked', () => {
  assert.ok(SIGNALS.length >= 40)
  assert.equal(operationalSignals().length, 9)
  assert.ok(SIGNALS.some(signal => signal.operational === false && signal.freshness === 'NOT_CHECKED'))
})

test('five real assets, two portfolios, isolation, dates, refusals, reports', async () => {
  const { pg, alice, bob, cara } = await database()
  try {
    const portfolio = await alice.createPortfolio('org-a', 'Demonstration portfolio')
    const other = await alice.createPortfolio('org-a', 'Scale fixture — not evidence')
    await alice.grantPortfolio('org-a', other.id, 'bob', 'VIEWER')
    const denied = (promise: Promise<unknown>) => assert.rejects(promise, (error: unknown) => error instanceof CommercialError && error.status === 404)
    await denied(bob.summary('org-a', portfolio.id))
    await denied(alice.portfolios('org-b'))
    await denied(cara.summary('org-a', portfolio.id))

    const office = await alice.createAsset('org-a', portfolio.id, {
      name: 'Central Bank of Ireland, North Wall Quay',
      assetType: 'OFFICE',
      address: 'New Wapping Street, North Wall Quay, Dublin 1',
      eircode: 'D01 F7X3',
      localAuthority: 'Dublin City',
      county: 'Dublin',
      latitude: null,
      longitude: null,
      geography: { coordinates: 'UNKNOWN', eircode: 'KNOWN', source: 'https://www.centralbank.ie/contact-us' },
    })
    const logistics = await alice.createAsset('org-a', portfolio.id, {
      name: 'Lands described as adjacent to Bracetown Business Park',
      assetType: 'LOGISTICS',
      address: 'Described as beside the R147, off M3 junction 5, near Clonee',
      county: 'Meath',
      localAuthority: 'Meath County Council',
      geography: { coordinates: 'UNKNOWN', zoningDocument: 'NOT_RETRIEVED' },
    })
    const retail = await alice.createAsset('org-a', portfolio.id, {
      name: 'Dundrum Town Centre',
      assetType: 'RETAIL',
      address: 'Dundrum, Dublin',
      county: 'Dublin',
      localAuthority: 'Dún Laoghaire-Rathdown',
      geography: { coordinates: 'UNKNOWN', decisionDocument: 'NOT_RETRIEVED' },
    })
    const industrial = await alice.createAsset('org-a', portfolio.id, {
      name: 'Intel Ireland, Collinstown Industrial Park',
      assetType: 'INDUSTRIAL',
      address: 'Collinstown Industrial Park, Leixlip, County Kildare',
      eircode: 'W23 CX68',
      county: 'Kildare',
      localAuthority: 'Kildare County Council',
      geography: { coordinates: 'UNKNOWN', irishGridStated: 'E298500 N237000', gridSource: 'EPA application form' },
    })
    const coastal = await alice.createAsset('org-a', portfolio.id, {
      name: 'Dublin Port',
      assetType: 'COASTAL',
      address: 'Dublin Port',
      county: 'Dublin',
      geography: { coordinates: 'UNKNOWN' },
    })

    const address = await alice.recordEvent('org-a', {
      registrySignalId: 'official-site-identity',
      sourceAuthority: 'Central Bank of Ireland',
      sourceRecordId: 'cbi-contact-address',
      sourceUrl: 'https://www.centralbank.ie/contact-us',
      title: 'Published address',
      factualObservation: 'The Central Bank of Ireland contact page states the docklands address as New Wapping Street, North Wall Quay, Dublin 1, D01 F7X3. No latitude was published on that page.',
      retrievalDate: RETRIEVED,
      publicationDate: null,
      eventDate: null,
      spatialResolution: 'P1',
      evidenceStatus: 'PUBLISHED_BY_THE_INSTITUTION',
    })
    const breeam = await alice.recordEvent('org-a', {
      registrySignalId: 'design-stage-rating',
      sourceAuthority: 'Central Bank of Ireland',
      sourceRecordId: 'cbi-breeam-design-stage',
      sourceUrl: 'https://www.centralbank.ie/about/our-dockland-campus',
      title: 'Design-stage rating',
      factualObservation: 'The Bank states that North Wall Quay is the first office building in Ireland to achieve a BREEAM Outstanding rating at design stage. The page does not present that sentence as an operational certificate.',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P1',
      lifecycleStage: 'DESIGN',
      evidenceStatus: 'PUBLISHED_BY_THE_INSTITUTION',
    })
    const zoning = await alice.recordEvent('org-a', {
      registrySignalId: 'planning-zoning-statement',
      sourceAuthority: 'Coonan Property',
      sourceRecordId: 'coonan-bracetown-lands-2023',
      sourceUrl: 'https://coonan.com/bracetown-clonee-co-meath-approx-15-acres-6-07-ha/',
      title: 'Agent’s zoning statement',
      factualObservation: 'A March 2023 selling-agent page states that lands adjacent to Bracetown Business Park are zoned E2/E3 in the Meath County Development Plan 2021–2027. The development-plan document itself was not retrieved.',
      eventDate: '2023-03-16',
      publicationDate: '2023-03-16',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P1',
      evidenceStatus: 'AGENT_STATEMENT',
    })
    const irishTimes = await alice.recordEvent('org-a', {
      registrySignalId: 'planning-decision-reported',
      sourceAuthority: 'The Irish Times',
      sourceRecordId: 'irishtimes-dundrum-2025-08-18',
      underlyingMatterId: 'dundrum-town-square-retention-2025',
      sourceUrl: 'https://www.irishtimes.com/business/2025/08/18/dundrum-town-centre-owners-appeal-council-refusal-for-outdoor-food-concessions/',
      title: 'Council refusal reported',
      factualObservation: 'The Irish Times reported on 18 August 2025 that Dún Laoghaire-Rathdown County Council had refused a retention application for food concessions at Dundrum Town Centre, and that an appeal had been lodged. This row is the news report, not the planning order.',
      eventDate: null,
      publicationDate: '2025-08-18',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P1',
      lifecycleStage: 'APPLICATION_SUBMITTED',
      evidenceStatus: 'NEWS_REPORT',
    })
    const breaking = await alice.recordEvent('org-a', {
      registrySignalId: 'planning-decision-reported',
      sourceAuthority: 'BreakingNews.ie',
      sourceRecordId: 'breakingnews-dundrum-2025-11-27',
      underlyingMatterId: 'dundrum-town-square-retention-2025',
      sourceUrl: 'https://www.breakingnews.ie/ireland/dundrum-town-centre-refused-planning-permission-to-keep-using-plaza-for-foodstalls-1835169.html',
      title: 'Appeal refusal reported',
      factualObservation: 'BreakingNews.ie reported on 27 November 2025 that An Coimisiún Pleanála had upheld the council’s refusal for food stalls on the plaza at Dundrum Town Centre. The Commission’s order was not retrieved.',
      publicationDate: '2025-11-27',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P1',
      lifecycleStage: 'REFUSED',
      previousLifecycleStage: 'APPLICATION_SUBMITTED',
      evidenceStatus: 'NEWS_REPORT',
    })
    const application = await alice.recordEvent('org-a', {
      registrySignalId: 'epa-licence-application',
      sourceAuthority: 'Environmental Protection Agency',
      sourceRecordId: 'epa-intel-application-2019',
      underlyingMatterId: 'epa-intel-collinstown',
      sourceUrl: 'https://epawebapp.epa.ie/licences/lic_eDMS/090151b28072504b.pdf',
      title: 'Licence application received',
      factualObservation: 'An EPA industrial-emissions application form for Intel Ireland Limited at Collinstown Industrial Park, Leixlip, prints register number P0207-05, receipt date 26 November 2019, and Eircode W23 CX68. It also states an Irish Grid centre of E298500 N237000. A WGS84 coordinate was not derived.',
      eventDate: '2019-11-26',
      publicationDate: '2020-04-25',
      retrievalDate: RETRIEVED,
      observedValue: 'P0207-05',
      spatialResolution: 'P1',
      lifecycleStage: 'APPLICATION_SUBMITTED',
      evidenceStatus: 'PRIMARY_FORM',
    })
    const amendment = await alice.recordEvent('org-a', {
      registrySignalId: 'epa-licence-status',
      sourceAuthority: 'Environmental Protection Agency',
      sourceRecordId: 'epa-intel-clerical-amendment-2024',
      underlyingMatterId: 'epa-intel-collinstown',
      sourceUrl: 'https://epawebapp.epa.ie/licences/lic_eDMS/090151b2809052d4.pdf',
      title: 'Clerical amendment',
      factualObservation: 'An EPA PDF states that it is a clerical amendment to an industrial-emissions licence for Intel Ireland Limited at Collinstown Industrial Park. The scan says the licence was granted on 17 November 2022 and amended on 5 June 2024, and that Schedule 8.1.2 is amended. The scanned register number reads PO207-05. The 2019 form prints P0207-05. Those two readings were not silently reconciled.',
      eventDate: null,
      publicationDate: '2024-11-21',
      retrievalDate: RETRIEVED,
      observedValue: 'PO207-05',
      previousValue: 'P0207-05',
      spatialResolution: 'P1',
      evidenceStatus: 'PRIMARY_PDF_SCAN',
    })
    const plan = await alice.recordEvent('org-a', {
      registrySignalId: 'published-capital-plan',
      sourceAuthority: 'Dublin Port Company',
      sourceRecordId: 'dpc-masterplan-review-2018',
      sourceUrl: 'https://www.dublinport.ie/masterplan/masterplan-2040-reviewed-2018/',
      title: 'Planned capital investment',
      factualObservation: 'Dublin Port Company’s Masterplan 2040 review page says the masterplan was first published in 2012 and reviewed in 2017 and 2018, and that capital investment of €1 billion is planned over the next decade. Planned is not delivered.',
      observedValue: '€1 billion',
      unit: 'EUR planned',
      publicationDate: null,
      retrievalDate: RETRIEVED,
      spatialResolution: 'P2',
      lifecycleStage: 'PROPOSED',
      evidenceStatus: 'PUBLISHED_BY_THE_COMPANY',
    })
    const inland = await alice.recordEvent('org-a', {
      registrySignalId: 'construction-stated',
      sourceAuthority: 'Dublin Port Company',
      sourceRecordId: 'dpc-inland-port-commenced',
      sourceUrl: 'https://www.dublinport.ie/masterplan/masterplan-2040-reviewed-2018/',
      title: 'Inland port commencement, as stated',
      factualObservation: 'The same Masterplan page says works have commenced on the 44-hectare Dublin Inland Port adjacent to Dublin Airport. That sentence is about the inland site, not every project in the €1 billion plan.',
      publicationDate: null,
      retrievalDate: RETRIEVED,
      spatialResolution: 'P3',
      lifecycleStage: 'CONSTRUCTION',
      evidenceStatus: 'PUBLISHED_BY_THE_COMPANY',
    })
    const stamullen = await alice.recordEvent('org-a', {
      registrySignalId: 'flood-study',
      sourceAuthority: 'Irish Independent',
      sourceRecordId: 'independent-stamullen-2025-10-09',
      sourceUrl: 'https://www.independent.ie/regionals/meath/news/opw-approves-funding-in-meath-for-a-90000-study-on-flooding-at-gormanstown-road/a962496441.html',
      title: 'Flood study at a different place',
      factualObservation: 'The Irish Independent reported on 9 October 2025 that the OPW had approved €90,000 for a flood study at Gormanstown Road, Stamullen. The article does not name Bracetown.',
      observedValue: '€90,000',
      publicationDate: '2025-10-09',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P3',
      lifecycleStage: 'FUNDED',
      evidenceStatus: 'NEWS_REPORT',
    })

    await alice.relate('org-a', office.id, address.id, 'ON_SITE', 'The institution publishes this building as its docklands address. A coordinate was not published.', 'NOT_ESTABLISHED')
    await alice.relate('org-a', office.id, breeam.id, 'ON_SITE', 'The sentence is about the North Wall Quay building, and it is explicitly a design-stage rating.', 'NOT_ESTABLISHED')
    await alice.relate('org-a', logistics.id, zoning.id, 'ON_SITE', 'The page describes these lands. It is the agent’s account of the zoning, not the plan document.', 'NOT_ESTABLISHED')
    await alice.relate('org-a', retail.id, irishTimes.id, 'ON_SITE', 'The report is about the plaza at this centre. The planning order was not retrieved.', 'NOT_ESTABLISHED')
    await alice.relate('org-a', retail.id, breaking.id, 'ON_SITE', 'The later report is about the same plaza application. It is a second publication, not a second decision.', 'NOT_ESTABLISHED')
    await alice.relate('org-a', industrial.id, application.id, 'ON_SITE', 'The form names this installation. No conclusion is drawn about emissions performance.', 'NOT_ESTABLISHED')
    await alice.relate('org-a', industrial.id, amendment.id, 'ON_SITE', 'The amendment names this installation. The scanned register number and the form’s register number are both shown.', 'NOT_ESTABLISHED')
    const portBand = await alice.relate('org-a', coastal.id, plan.id, 'CONTEXT_ONLY', 'The €1 billion figure is the company’s plan for the port. It is not a sum assigned to one berth, and it is not described as spent.', 'NOT_ESTABLISHED')
    const inlandBand = await alice.relate('org-a', coastal.id, inland.id, 'CONTEXT_ONLY', 'Dublin Inland Port is described as adjacent to Dublin Airport. It is not stated to be this port estate.', 'NOT_ESTABLISHED')
    assert.equal(portBand.band, 'REGIONAL CONTEXT')
    assert.equal(inlandBand.band, 'REGIONAL CONTEXT')

    await alice.recordCheck('org-a', 'flood-study', 'RECORD_LOCATED', 'A Stamullen flood-study report was located and was not attached to the Bracetown lands.')
    await alice.recordCheck('org-a', 'river-level', 'NOT_CHECKED', 'No gauge series was opened for these five assets.')
    await alice.recordCheck('org-a', 'sac-relationship', 'NOT_CHECKED', 'No protected-site boundary was overlaid.')
    const again = await alice.recordEvent('org-a', {
      registrySignalId: 'official-site-identity',
      sourceAuthority: 'Central Bank of Ireland',
      sourceRecordId: 'cbi-contact-address',
      sourceUrl: 'https://www.centralbank.ie/contact-us',
      title: 'Published address',
      factualObservation: 'The Central Bank of Ireland contact page states the docklands address as New Wapping Street, North Wall Quay, Dublin 1, D01 F7X3. No latitude was published on that page.',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P1',
      evidenceStatus: 'PUBLISHED_BY_THE_INSTITUTION',
    })
    assert.equal(again.change, 'NO_CHANGE')
    await assert.rejects(
      alice.recordEvent('org-a', {
        registrySignalId: 'flood-extent',
        sourceAuthority: 'Fixture',
        sourceUrl: 'https://example.test/not-a-source',
        title: 'Blocked',
        factualObservation: 'This property will flood.',
        retrievalDate: RETRIEVED,
        spatialResolution: 'P7',
        evidenceStatus: 'FIXTURE',
      }),
      (error: unknown) => error instanceof CommercialError,
    )
    const national = await alice.recordEvent('org-a', {
      registrySignalId: 'budget-line',
      sourceAuthority: 'Fixture',
      sourceRecordId: 'national-fixture',
      sourceUrl: 'https://example.test/national-fixture',
      title: 'National fixture',
      factualObservation: 'Fixture only: a national budget line was not retrieved. This sentence exists to test that national text cannot be labelled as on an asset.',
      retrievalDate: RETRIEVED,
      spatialResolution: 'P7',
      evidenceStatus: 'FIXTURE',
    })
    const nationalBand = await alice.relate('org-a', office.id, national.id, 'INTERSECTS', 'The fixture is national. It must not be labelled as on the building.', 'NOT_ESTABLISHED')
    assert.equal(nationalBand.band, 'NATIONAL CONTEXT')
    await alice.recordCheck('org-a', 'budget-line', 'SOURCE_UNAVAILABLE', 'The budget series was not opened. This is not a finding of no change.')

    const finance = await alice.assetView('org-a', industrial.id, 'FINANCE')
    const legal = await alice.assetView('org-a', industrial.id, 'LEGAL')
    assert.equal(finance.evidence[0].factualObservation, legal.evidence[0].factualObservation)
    assert.notEqual(finance.evidence[0].question, legal.evidence[0].question)
    assert.match(finance.evidence[0].question, /No financial conclusion/)
    assert.match(legal.evidence[0].question, /not a legal conclusion/)
    assert.match(finance.evidence[0].why, /ON THIS SITE/)
    assert.match(finance.cluster, /No independent multi-source cluster/)
    const dundrum = await alice.assetView('org-a', retail.id, 'LEGAL')
    assert.equal(dundrum.evidence.length, 2)
    const reported = dundrum.evidence.find(item => item.title === 'Council refusal reported')
    assert.ok(reported)
    assert.equal(reported.eventDate, null)
    assert.equal(reported.publicationDate, '2025-08-18')
    assert.match(dundrum.cluster, /No independent multi-source cluster/)
    const port = await alice.assetView('org-a', coastal.id, 'FINANCE')
    assert.match(port.evidence.map(item => item.factualObservation).join(' '), /Planned is not delivered/)
    assert.match(port.evidence.map(item => item.factualObservation).join(' '), /not every project/)

    await denied(bob.review('org-a', nationalBand.id, 'COMMENT', 'Should fail'))
    await alice.grantPortfolio('org-a', portfolio.id, 'bob', 'COMMENTER')
    const review = await bob.review('org-a', nationalBand.id, 'NO_ACTION', 'National fixture. No action on the building.')
    assert.ok(review.id)
    await denied(bob.issueReport('org-a', portfolio.id, 'FINANCE', 'FINANCE'))

    const before = await alice.issueReport('org-a', portfolio.id, 'FINANCE', 'FINANCE')
    assert.equal(before.pdfBytes.subarray(0, 5).toString(), '%PDF-')
    assert.match(JSON.stringify(before.snapshot), /design stage/)
    assert.match(JSON.stringify(before.snapshot), /Planned is not delivered/)
    const pdf = await PDFDocument.load(before.pdfBytes)
    assert.ok(pdf.getPageCount() >= 2)
    assert.match(pdf.getTitle() ?? '', /FINANCE/)
    const zip = await JSZip.loadAsync(before.xlsxBytes)
    const signals = await zip.file('xl/worksheets/sheet2.xml')!.async('string')
    assert.match(signals, /https:\/\/epawebapp\.epa\.ie/)
    assert.match(signals, /Event date/)
    assert.match(await zip.file('xl/worksheets/sheet5.xml')!.async('string'), /SOURCE_UNAVAILABLE/)
    assert.equal(zip.file('xl/worksheets/sheet6.xml') !== null, true)
    const frozen = await pg.query<{ snapshot: { rows: unknown[] } }>('SELECT snapshot FROM "CommercialReport" WHERE id=$1', [before.id])
    await alice.recordCheck('org-a', 'tender', 'CHECK_FAILED', 'The tender source did not respond. This is not no change.')
    const still = await pg.query<{ snapshot: { rows: unknown[] } }>('SELECT snapshot FROM "CommercialReport" WHERE id=$1', [before.id])
    assert.equal(still.rows[0].snapshot.rows.length, frozen.rows[0].snapshot.rows.length)
    const legalReport = await alice.issueReport('org-a', portfolio.id, 'LEGAL', 'LEGAL')
    assert.notEqual(legalReport.id, before.id)

    const started = Date.now()
    for (let index = 0; index < 50; index += 1) {
      await alice.createAsset('org-a', other.id, { name: `Scale fixture ${index}`, assetType: 'OFFICE', geography: { evidence: 'NONE' } })
    }
    const fifty = Date.now()
    await pg.exec(`INSERT INTO "CommercialAsset" (id,"workspaceId","portfolioId",name,"assetType",geography)
      SELECT 'scale-' || n, 'org-a', '${other.id}', 'Scale fixture ' || n, 'OFFICE', '{"evidence":"NONE"}'::jsonb
      FROM generate_series(50, 499) AS n`)
    const fiveHundred = Date.now()
    const summary = await bob.summary('org-a', other.id)
    const afterSummary = Date.now()
    assert.equal(summary.assetsMonitored, 500)
    assert.equal(summary.newRecords, 0)
    console.log(JSON.stringify({
      insert50ThroughServiceMs: fifty - started,
      insert450BySqlMs: fiveHundred - fifty,
      summary500Ms: afterSummary - fiveHundred,
    }))
    const overview = await alice.summary('org-a', portfolio.id)
    assert.equal(overview.assetsMonitored, 5)
    assert.equal(overview.assetsWithChange, 5)
  } finally {
    await pg.close()
  }
})
