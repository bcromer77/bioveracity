import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { workspaceService, WorkspaceError, obligationInput, evidenceCheckInput, type Sql, type Database } from '../lib/workspaces/service'
import { caseFiles } from '../lib/workspaces/case-files'
import { parseFile } from '../lib/workspaces/parse-file.mjs'
import { renderCase } from '../lib/workspaces/render-case'

const key = 'ab'.repeat(32)
const MIGRATIONS = ['20260909_private_workspace_foundation', '20260909_private_case_files', '20260911_workspace_persona', '20260923_bng_obligations']

async function harness(users: string[]) {
  const pg = new PGlite()
  await pg.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES ${users.map(u => `('${u}')`).join(',')};`)
  for (const m of MIGRATIONS) await pg.exec(readFileSync(new URL(`../prisma/migrations/${m}/migration.sql`, import.meta.url), 'utf8'))
  const sql = (client: Pick<PGlite, 'query'>): Sql => ({ query: async <T>(text: string, values: unknown[]) => (await client.query<T>(text, values)).rows })
  const db: Database = { ...sql(pg), transaction: f => pg.transaction(tx => f(sql(tx))) }
  const member = async (workspaceId: string, caseId: string, userId: string, role: string, canExport = false) => {
    await pg.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', [workspaceId, userId, role])
    await pg.query('INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role,"canExport") VALUES ($1,$2,$3,$4,$5)', [workspaceId, caseId, userId, role, canExport])
  }
  return { pg, db, member }
}

function obl(overrides: Record<string, unknown> = {}) {
  return { sourceObligation: 'Maintain the wetland scrape for five years', responsibleParty: 'Site manager', duePrecision: 'UNKNOWN', recurrence: 'NONE', expectedEvidence: 'Annual monitoring report', evidenceStatus: 'UNKNOWN', note: '', ...overrides }
}

test('obligationInput and evidenceCheckInput reject malformed or dishonest input', () => {
  assert.equal(obligationInput(obl()).sourceObligation, 'Maintain the wetland scrape for five years')
  assert.equal(obligationInput(obl({ duePrecision: 'DAY', dueDate: '2027-03-01' })).dueDate, '2027-03-01')
  for (const bad of [
    obl({ sourceObligation: '' }),
    obl({ duePrecision: 'DECADE' }),
    obl({ recurrence: 'HOURLY' }),
    obl({ evidenceStatus: 'MAYBE' }),
    obl({ duePrecision: 'DAY', dueDate: '2027-13-40' }),
    obl({ duePrecision: 'MONTH', dueDate: '2027-03-01' }),
    obl({ duePrecision: 'DAY', dueDate: null }),
  ]) assert.throws(() => obligationInput(bad), WorkspaceError)
  assert.equal(evidenceCheckInput({ question: 'Was a maintenance report filed?', reviewedScope: 'Case documents 2024-2026' }).resultStatus, 'NOT_LOCATED_IN_REVIEWED_SCOPE')
  for (const bad of [{ question: '', reviewedScope: 'x' }, { question: 'x', reviewedScope: '' }, { question: 'x', reviewedScope: 'y', resultStatus: 'FOUND' }]) assert.throws(() => evidenceCheckInput(bad), WorkspaceError)
})

test('obligation authoring respects role policy and closes cross-case provenance', async () => {
  const { pg, db, member } = await harness(['owner', 'contributor', 'reviewer', 'viewer', 'outsider'])
  try {
    const owner = workspaceService(db, 'owner')
    const w = await owner.createWorkspace({ name: 'BNG workspace' })
    const bng = await owner.createCase(w.id, { title: 'Meadow BNG case', template: 'BNG' })
    const other = await owner.createCase(w.id, { title: 'Second BNG case', template: 'BNG' })
    await member(w.id, bng.id, 'contributor', 'CONTRIBUTOR')
    await member(w.id, bng.id, 'reviewer', 'REVIEWER')
    await member(w.id, bng.id, 'viewer', 'VIEWER')
    const denied = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof WorkspaceError && e.status === status)

    // Create allowed for OWNER + CONTRIBUTOR; denied for VIEWER, REVIEWER, and outsiders.
    const created = await owner.createObligation(w.id, bng.id, obl())
    assert.equal(created.revision, 1)
    await workspaceService(db, 'contributor').createObligation(w.id, bng.id, obl({ sourceObligation: 'Contributor added obligation' }))
    await denied(workspaceService(db, 'viewer').createObligation(w.id, bng.id, obl()), 404)
    await denied(workspaceService(db, 'reviewer').createObligation(w.id, bng.id, obl()), 404)
    await denied(workspaceService(db, 'outsider').createObligation(w.id, bng.id, obl()), 404)

    // Provenance must stay inside the same case: a passage from another case is rejected.
    const files = caseFiles(db, 'owner', key)
    await files.import(w.id, other.id, await parseFile(Buffer.from('2026-09-01 Wetland scrape maintained by contractor.'), 'other.txt'))
    const [foreignPassage] = (await pg.query<{ id: string }>('SELECT id FROM "PrivateCasePassage" WHERE "workspaceId"=$1 AND "caseId"=$2 LIMIT 1', [w.id, other.id])).rows
    await denied(owner.createObligation(w.id, bng.id, obl({ passageId: foreignPassage.id })), 400)
    const foreignCheck = await owner.createEvidenceCheck(w.id, other.id, { question: 'Filed?', reviewedScope: 'Other case' })
    await denied(owner.createObligation(w.id, bng.id, obl({ evidenceStatus: 'NOT_LOCATED', evidenceCheckId: foreignCheck.id })), 400)
  } finally { await pg.close() }
})

test('review gate: reviewed obligation needs in-case provenance; not-located needs a scoped evidence check; stale revision is rejected', async () => {
  const { pg, db, member } = await harness(['owner', 'reviewer', 'contributor'])
  try {
    const owner = workspaceService(db, 'owner')
    const w = await owner.createWorkspace({ name: 'Review workspace' })
    const bng = await owner.createCase(w.id, { title: 'Review BNG case', template: 'BNG' })
    await member(w.id, bng.id, 'reviewer', 'REVIEWER')
    await member(w.id, bng.id, 'contributor', 'CONTRIBUTOR')
    const reviewer = workspaceService(db, 'reviewer')
    const denied = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof WorkspaceError && e.status === status)

    const files = caseFiles(db, 'owner', key)
    await files.import(w.id, bng.id, await parseFile(Buffer.from('2026-09-02 Scrape maintenance evidence recorded.'), 'in-case.txt'))
    const [passage] = (await pg.query<{ id: string }>('SELECT id FROM "PrivateCasePassage" WHERE "workspaceId"=$1 AND "caseId"=$2 LIMIT 1', [w.id, bng.id])).rows

    // A CONTRIBUTOR may draft/revise but may not mark REVIEWED.
    const o = await owner.createObligation(w.id, bng.id, obl())
    await denied(workspaceService(db, 'contributor').reviseObligation(w.id, bng.id, o.id, { ...obl(), revision: 1, reviewStatus: 'REVIEWED', passageId: passage.id }), 404)

    // REVIEWED with no linked source is rejected.
    await denied(reviewer.reviseObligation(w.id, bng.id, o.id, { ...obl(), revision: 1, reviewStatus: 'REVIEWED' }), 400)

    // REVIEWED evidence-not-located without a scoped check is rejected...
    await denied(reviewer.reviseObligation(w.id, bng.id, o.id, { ...obl(), revision: 1, reviewStatus: 'REVIEWED', evidenceStatus: 'NOT_LOCATED' }), 400)
    // ...but succeeds once a case-scoped evidence check is linked.
    const check = await owner.createEvidenceCheck(w.id, bng.id, { question: 'Was a five-year maintenance report filed?', reviewedScope: 'All imported case documents 2024-2026' })
    const reviewed = await reviewer.reviseObligation(w.id, bng.id, o.id, { ...obl(), revision: 1, reviewStatus: 'REVIEWED', evidenceStatus: 'NOT_LOCATED', evidenceCheckId: check.id })
    assert.equal(reviewed.revision, 2)

    // Stale revision (someone else already advanced it) is a 409.
    await denied(reviewer.reviseObligation(w.id, bng.id, o.id, { ...obl(), revision: 1, reviewStatus: 'REVIEWED', passageId: passage.id }), 409)

    // A source-passage-backed reviewed obligation also succeeds.
    const o2 = await owner.createObligation(w.id, bng.id, obl({ sourceObligation: 'Second obligation' }))
    const r2 = await reviewer.reviseObligation(w.id, bng.id, o2.id, { ...obl({ sourceObligation: 'Second obligation' }), revision: 1, reviewStatus: 'REVIEWED', evidenceStatus: 'LOCATED', passageId: passage.id })
    assert.equal(r2.revision, 2)
  } finally { await pg.close() }
})

test('BNG issued record exports reviewed obligations (incl not-located scope); drafts excluded; non-BNG manifest omits the key', async () => {
  const { pg, db, member } = await harness(['owner', 'reviewer'])
  try {
    const owner = workspaceService(db, 'owner')
    const w = await owner.createWorkspace({ name: 'Export workspace' })
    const bng = await owner.createCase(w.id, { title: 'Exportable BNG case', template: 'BNG' })
    await member(w.id, bng.id, 'reviewer', 'REVIEWER')
    const reviewer = workspaceService(db, 'reviewer')
    const files = caseFiles(db, 'owner', key)

    await files.import(w.id, bng.id, await parseFile(Buffer.from('2026-09-03 Habitat scrape maintained and recorded on site.'), 'source.txt'))
    const [passage] = (await pg.query<{ id: string }>('SELECT id FROM "PrivateCasePassage" WHERE "workspaceId"=$1 AND "caseId"=$2 LIMIT 1', [w.id, bng.id])).rows

    // Reviewed, source-linked obligation -> exported.
    const located = await owner.createObligation(w.id, bng.id, obl({ sourceObligation: 'Maintain habitat scrape for five years' }))
    await reviewer.reviseObligation(w.id, bng.id, located.id, { ...obl({ sourceObligation: 'Maintain habitat scrape for five years' }), revision: 1, reviewStatus: 'REVIEWED', evidenceStatus: 'LOCATED', passageId: passage.id })

    // Reviewed, evidence-not-located obligation with a scoped check -> exported with its scope.
    const check = await owner.createEvidenceCheck(w.id, bng.id, { question: 'Was the year-3 monitoring report filed?', reviewedScope: 'All case documents to 2026', resultSummary: 'No such report found in the reviewed set.' })
    const notLocated = await owner.createObligation(w.id, bng.id, obl({ sourceObligation: 'File year-3 monitoring report' }))
    await reviewer.reviseObligation(w.id, bng.id, notLocated.id, { ...obl({ sourceObligation: 'File year-3 monitoring report' }), revision: 1, reviewStatus: 'REVIEWED', evidenceStatus: 'NOT_LOCATED', evidenceCheckId: check.id })

    // DRAFT obligation -> excluded from the export.
    await owner.createObligation(w.id, bng.id, obl({ sourceObligation: 'Draft obligation that must not be exported' }))

    await files.setExport(w.id, bng.id, true)
    const issued = await files.export(w.id, bng.id, renderCase)
    const manifest = JSON.parse((await files.downloadExport(w.id, bng.id, issued.id, true)).bytes.toString())
    assert.ok(Array.isArray(manifest.obligations), 'BNG manifest carries obligations')
    assert.equal(manifest.obligations.length, 2, 'only the two reviewed obligations are exported')
    assert.ok(manifest.obligationFilter.includes('REVIEWED'))
    const sources = manifest.obligations.map((o: Record<string, unknown>) => o.sourceObligation)
    assert.ok(sources.includes('Maintain habitat scrape for five years'))
    assert.ok(sources.includes('File year-3 monitoring report'))
    assert.ok(!sources.includes('Draft obligation that must not be exported'))
    const nl = manifest.obligations.find((o: Record<string, unknown>) => o.evidenceStatus === 'NOT_LOCATED')
    assert.equal(nl.evidenceCheckScope, 'All case documents to 2026')
    assert.equal(nl.reviewStatus, 'REVIEWED')

    // The rendered PDF surfaces the obligations section and the explicit reviewed-scope wording.
    const pdf = (await files.downloadExport(w.id, bng.id, issued.id)).bytes
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    const text = (await parseFile(pdf, 'issued.pdf')).passages.map(p => p.text).join(' ')
    assert.match(text, /Reviewed obligations/)
    assert.match(text, /Maintain habitat scrape for five years/)
    assert.match(text, /Evidence not located within the explicitly reviewed scope/)

    // Non-BNG case: even with an accepted event, the manifest must not gain an obligations key.
    const planning = await owner.createCase(w.id, { title: 'Planning case', template: 'PLANNING' })
    const pf = caseFiles(db, 'owner', key)
    await pf.import(w.id, planning.id, await parseFile(Buffer.from('2026-09-04 Planning site visit recorded.'), 'plan.txt'))
    const data = await pf.list(w.id, planning.id)
    const e = data.events[0]
    await pf.review(w.id, planning.id, e.id, { revision: e.revision, title: 'Site visit', quote: e.quote, eventDate: '2026-09-04', precision: 'DAY', status: 'ACCEPTED', evidenceType: 'SOURCE_STATEMENT', note: '' })
    await pf.setExport(w.id, planning.id, true)
    const planIssued = await pf.export(w.id, planning.id, renderCase)
    const planManifest = JSON.parse((await pf.downloadExport(w.id, planning.id, planIssued.id, true)).bytes.toString())
    assert.equal('obligations' in planManifest, false, 'non-BNG manifest never adds an obligations key')
  } finally { await pg.close() }
})
