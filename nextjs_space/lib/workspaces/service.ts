import { randomUUID } from 'node:crypto'

export type Template = 'PLANNING' | 'FARMER' | 'ESG' | 'FREIGHT' | 'BNG' | 'GENERAL'
export type Role = 'OWNER' | 'CONTRIBUTOR' | 'REVIEWER' | 'VIEWER'
export type Action = 'read' | 'write' | 'review' | 'export'
export interface Sql {
  query<T>(sql: string, values: unknown[]): Promise<T[]>
}
export interface Database extends Sql {
  transaction<T>(operation: (tx: Sql) => Promise<T>): Promise<T>
}
export class WorkspaceError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function permits(role: string, action: Action, canExport = false): boolean {
  if (!['OWNER', 'CONTRIBUTOR', 'REVIEWER', 'VIEWER'].includes(role)) return false
  if (action === 'export') return canExport
  if (action === 'read') return true
  if (action === 'write') return role === 'OWNER' || role === 'CONTRIBUTOR'
  return role === 'OWNER' || role === 'REVIEWER'
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) {
    throw new WorkspaceError(400, 'Invalid text field')
  }
  return value.trim()
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkspaceError(400, 'Expected an object')
  return value as Record<string, unknown>
}
export function caseInput(value: unknown) {
  const input = object(value)
  const title = text(input.title, 180)
  const template = input.template ?? 'GENERAL'
  if (!['PLANNING', 'FARMER', 'ESG', 'FREIGHT', 'BNG', 'GENERAL'].includes(String(template))) throw new WorkspaceError(400, 'Invalid template')
  const rawSites = input.sites ?? []
  if (!Array.isArray(rawSites) || rawSites.length > 20) throw new WorkspaceError(400, 'Maximum 20 sites')
  const sites = rawSites.map(raw => {
    const site = object(raw)
    const name = text(site.name, 180)
    const latitude = site.latitude ?? null
    const longitude = site.longitude ?? null
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (
      typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    ))) throw new WorkspaceError(400, 'Coordinates require a valid latitude and longitude pair')
    return { name, latitude, longitude }
  })
  return { title, template: template as Template, sites }
}
// BNG obligation vocabularies. Deliberately small and evidence-led: recurrence never
// auto-generates future rows; future obligations are derived from documented dates.
export const DUE_PRECISION = ['UNKNOWN', 'YEAR', 'MONTH', 'DAY'] as const
export const RECURRENCE = ['NONE', 'ANNUAL', 'BIENNIAL', 'FIVE_YEARLY', 'MILESTONE'] as const
export const EVIDENCE_STATUS = ['UNKNOWN', 'LOCATED', 'NOT_LOCATED'] as const
export const REVIEW_STATUS = ['DRAFT', 'UNRESOLVED', 'REVIEWED'] as const
function optionalText(value: unknown, max: number): string {
  return value == null || value === '' ? '' : text(value, max)
}
function obligationDate(date: unknown, precision: string): string | null {
  if (precision === 'UNKNOWN' && (date === null || date === undefined || date === '')) return null
  if (typeof date !== 'string') throw new WorkspaceError(400, 'Supply a due date with its stated precision')
  const patterns: Record<string, RegExp> = { YEAR: /^\d{4}$/, MONTH: /^\d{4}-(0[1-9]|1[0-2])$/, DAY: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/ }
  if (!patterns[precision]?.test(date)) throw new WorkspaceError(400, 'Due date does not match its stated precision')
  if (precision === 'DAY' && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new WorkspaceError(400, 'Invalid calendar date')
  return date
}
export function obligationInput(value: unknown) {
  const input = object(value)
  const sourceObligation = text(input.sourceObligation, 2000)
  const responsibleParty = optionalText(input.responsibleParty, 300)
  const duePrecision = String(input.duePrecision ?? 'UNKNOWN')
  if (!(DUE_PRECISION as readonly string[]).includes(duePrecision)) throw new WorkspaceError(400, 'Invalid due date precision')
  const dueDate = obligationDate(input.dueDate ?? null, duePrecision)
  const recurrence = String(input.recurrence ?? 'NONE')
  if (!(RECURRENCE as readonly string[]).includes(recurrence)) throw new WorkspaceError(400, 'Invalid recurrence')
  const expectedEvidence = optionalText(input.expectedEvidence, 2000)
  const evidenceStatus = String(input.evidenceStatus ?? 'UNKNOWN')
  if (!(EVIDENCE_STATUS as readonly string[]).includes(evidenceStatus)) throw new WorkspaceError(400, 'Invalid evidence status')
  const note = optionalText(input.note, 2000)
  const passageId = input.passageId == null || input.passageId === '' ? null : text(input.passageId, 64)
  const documentId = input.documentId == null || input.documentId === '' ? null : text(input.documentId, 64)
  const evidenceCheckId = input.evidenceCheckId == null || input.evidenceCheckId === '' ? null : text(input.evidenceCheckId, 64)
  return { sourceObligation, responsibleParty, dueDate, duePrecision, recurrence, expectedEvidence, evidenceStatus, note, passageId, documentId, evidenceCheckId }
}
export type ObligationInput = ReturnType<typeof obligationInput>
export type ObligationRow = {
  id: string; passageId: string | null; documentId: string | null; evidenceCheckId: string | null; createdAt: Date
  passageLocator: string | null; passageDocumentName: string | null; documentName: string | null
  evidenceCheckStatus: string | null; evidenceCheckQuestion: string | null
  revision: number; sourceObligation: string; responsibleParty: string; dueDate: string | null; duePrecision: string
  recurrence: string; expectedEvidence: string; evidenceStatus: string; reviewStatus: string; reviewedBy: string | null; note: string; revisedAt: Date
}

// Recognised workspace presets. Anything else is stored/displayed as "custom".
export const PERSONA_KEYS = ['custom', 'ecology', 'planning', 'architecture', 'maritime'] as const
export function normalisePersona(value: unknown): string {
  return (PERSONA_KEYS as readonly string[]).includes(String(value)) ? String(value) : 'custom'
}
export function workspaceInput(value: unknown) {
  const input = object(value)
  return { name: text(input.name, 120), persona: normalisePersona(input.persona ?? 'custom') }
}
export type Workspace = { id: string; name: string; persona: string; createdAt: Date }
export type WorkspaceSummary = Workspace & { caseCount: number; lastUpdated: Date; recentCaseTitle: string | null }
export type Case = { id: string; workspaceId: string; title: string; template: Template; createdAt: Date }
export type Site = { id: string; name: string; latitude: number | null; longitude: number | null }

// Never accept user identity from a request body; callers supply the authenticated session ID.
export function workspaceService(db: Database, userId: string) {
  if (!userId) throw new WorkspaceError(401, 'Authentication required')
  const missing = () => new WorkspaceError(404, 'Workspace or case unavailable')
  async function workspaceAccess(tx: Sql, workspaceId: string, write = false) {
    const rows = await tx.query<{ role: string }>(
      'SELECT m.role FROM "PrivateWorkspaceMember" m WHERE m."workspaceId"=$1 AND m."userId"=$2 AND m."revokedAt" IS NULL FOR SHARE', [workspaceId, userId])
    if (!rows[0] || !permits(rows[0].role, write ? 'write' : 'read')) throw missing()
  }
  async function caseAccess(tx: Sql, workspaceId: string, caseId: string, action: Action = 'read') {
    await workspaceAccess(tx, workspaceId)
    const rows = await tx.query<{ role: string; canExport: boolean }>(
      'SELECT m.role, m."canExport" FROM "PrivateCaseMember" m WHERE m."workspaceId"=$1 AND m."caseId"=$2 AND m."userId"=$3 AND m."revokedAt" IS NULL FOR SHARE', [workspaceId, caseId, userId])
    if (!rows[0] || !permits(rows[0].role, action, rows[0].canExport)) throw missing()
  }
  async function audit(tx: Sql, workspaceId: string, caseId: string | null, action: string) {
    await tx.query('INSERT INTO "PrivateWorkspaceAudit" (id,"workspaceId","caseId","actorId",action) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), workspaceId, caseId, userId, action])
  }
  // Provenance may only point at sources that belong to this very case (passage/document)
  // or at an evidence-check record; anything else is rejected so obligations cannot be
  // attached to evidence the reviewer never actually has in front of them.
  async function validateProvenance(tx: Sql, workspaceId: string, caseId: string, input: Pick<ObligationInput, 'passageId' | 'documentId' | 'evidenceCheckId'>) {
    if (input.passageId && !(await tx.query<{ id: string }>('SELECT id FROM "PrivateCasePassage" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3', [workspaceId, caseId, input.passageId]))[0]) throw new WorkspaceError(400, 'Linked source passage was not found in this case')
    if (input.documentId && !(await tx.query<{ id: string }>('SELECT id FROM "PrivateCaseDocument" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3', [workspaceId, caseId, input.documentId]))[0]) throw new WorkspaceError(400, 'Linked source document was not found in this case')
    if (input.evidenceCheckId && !(await tx.query<{ id: string }>('SELECT id FROM "EvidenceCheckRecord" WHERE id=$1', [input.evidenceCheckId]))[0]) throw new WorkspaceError(400, 'Linked evidence-check record was not found')
  }
  return {
    async listWorkspaces() {
      // Each row carries the persona plus counts and the most recent case the caller
      // can access, so repeated workspaces are distinguishable in the list.
      return db.query<WorkspaceSummary>(
        'SELECT w.id,w.name,w.persona,w."createdAt",' +
        ' (SELECT COUNT(*)::int FROM "PrivateCase" c JOIN "PrivateCaseMember" cm ON cm."workspaceId"=c."workspaceId" AND cm."caseId"=c.id WHERE c."workspaceId"=w.id AND cm."userId"=$1 AND cm."revokedAt" IS NULL) AS "caseCount",' +
        ' GREATEST(w."createdAt", COALESCE((SELECT MAX(c."createdAt") FROM "PrivateCase" c JOIN "PrivateCaseMember" cm ON cm."workspaceId"=c."workspaceId" AND cm."caseId"=c.id WHERE c."workspaceId"=w.id AND cm."userId"=$1 AND cm."revokedAt" IS NULL), w."createdAt")) AS "lastUpdated",' +
        ' (SELECT c.title FROM "PrivateCase" c JOIN "PrivateCaseMember" cm ON cm."workspaceId"=c."workspaceId" AND cm."caseId"=c.id WHERE c."workspaceId"=w.id AND cm."userId"=$1 AND cm."revokedAt" IS NULL ORDER BY c."createdAt" DESC LIMIT 1) AS "recentCaseTitle"' +
        ' FROM "PrivateWorkspace" w JOIN "PrivateWorkspaceMember" m ON m."workspaceId"=w.id WHERE m."userId"=$1 AND m."revokedAt" IS NULL AND m.role IN (\'OWNER\',\'CONTRIBUTOR\',\'REVIEWER\',\'VIEWER\') ORDER BY "lastUpdated" DESC LIMIT 100', [userId])
    },
    async getWorkspace(workspaceId: string) {
      return db.transaction(async tx => {
        await workspaceAccess(tx, workspaceId)
        const [result] = await tx.query<Workspace>('SELECT id,name,persona,"createdAt" FROM "PrivateWorkspace" WHERE id=$1', [workspaceId])
        if (!result) throw missing()
        return result
      })
    },
    async createWorkspace(value: unknown) {
      const { name, persona } = workspaceInput(value)
      return db.transaction(async tx => {
        const id = randomUUID()
        const [workspace] = await tx.query<Workspace>('INSERT INTO "PrivateWorkspace" (id,name,persona) VALUES ($1,$2,$3) RETURNING id,name,persona,"createdAt"', [id, name, persona])
        await tx.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', [id, userId, 'OWNER'])
        await audit(tx, id, null, 'WORKSPACE_CREATED')
        return workspace
      })
    },
    async renameWorkspace(workspaceId: string, value: unknown) {
      const name = text(object(value).name, 120)
      return db.transaction(async tx => {
        await workspaceAccess(tx, workspaceId, true)
        const [updated] = await tx.query<Workspace>('UPDATE "PrivateWorkspace" SET name=$1 WHERE id=$2 RETURNING id,name,persona,"createdAt"', [name, workspaceId])
        if (!updated) throw missing()
        await audit(tx, workspaceId, null, 'WORKSPACE_RENAMED')
        return updated
      })
    },
    async listCases(workspaceId: string) {
      return db.transaction(async tx => {
        await workspaceAccess(tx, workspaceId)
        return tx.query<Case>('SELECT c.id,c."workspaceId",c.title,c.template,c."createdAt" FROM "PrivateCase" c JOIN "PrivateCaseMember" m ON m."workspaceId"=c."workspaceId" AND m."caseId"=c.id WHERE c."workspaceId"=$1 AND m."userId"=$2 AND m."revokedAt" IS NULL AND m.role IN (\'OWNER\',\'CONTRIBUTOR\',\'REVIEWER\',\'VIEWER\') ORDER BY c."createdAt" DESC LIMIT 100', [workspaceId, userId])
      })
    },
    async createCase(workspaceId: string, value: unknown) {
      const input = caseInput(value)
      return db.transaction(async tx => {
        await workspaceAccess(tx, workspaceId, true)
        const id = randomUUID()
        const [created] = await tx.query<Case>('INSERT INTO "PrivateCase" (id,"workspaceId",title,template) VALUES ($1,$2,$3,$4) RETURNING id,"workspaceId",title,template,"createdAt"', [id, workspaceId, input.title, input.template])
        await tx.query('INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role,"canExport") VALUES ($1,$2,$3,$4,$5)', [workspaceId, id, userId, 'OWNER', false])
        for (const site of input.sites) await tx.query('INSERT INTO "PrivateCaseSite" (id,"workspaceId","caseId",name,latitude,longitude) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), workspaceId, id, site.name, site.latitude, site.longitude])
        await audit(tx, workspaceId, id, 'CASE_CREATED')
        return created
      })
    },
    async getCase(workspaceId: string, caseId: string) {
      return db.transaction(async tx => {
        await caseAccess(tx, workspaceId, caseId)
        const [result] = await tx.query<Case>('SELECT id,"workspaceId",title,template,"createdAt" FROM "PrivateCase" WHERE "workspaceId"=$1 AND id=$2', [workspaceId, caseId])
        if (!result) throw missing()
        const sites = await tx.query<Site>('SELECT id,name,latitude,longitude FROM "PrivateCaseSite" WHERE "workspaceId"=$1 AND "caseId"=$2 ORDER BY id', [workspaceId, caseId])
        return { ...result, sites }
      })
    },
    async listObligations(workspaceId: string, caseId: string) {
      return db.transaction(async tx => {
        await caseAccess(tx, workspaceId, caseId)
        return tx.query<ObligationRow>(
          'SELECT o.id, o."passageId", o."documentId", o."evidenceCheckId", o."createdAt",' +
          ' p.locator AS "passageLocator", pd.name AS "passageDocumentName", d.name AS "documentName",' +
          ' ec."resultStatus" AS "evidenceCheckStatus", ec.question AS "evidenceCheckQuestion",' +
          ' r.revision, r."sourceObligation", r."responsibleParty", r."dueDate", r."duePrecision",' +
          ' r.recurrence, r."expectedEvidence", r."evidenceStatus", r."reviewStatus", r."reviewedBy", r.note, r."createdAt" AS "revisedAt"' +
          ' FROM "PrivateCaseObligation" o' +
          ' LEFT JOIN "PrivateCasePassage" p ON p."workspaceId"=o."workspaceId" AND p."caseId"=o."caseId" AND p.id=o."passageId"' +
          ' LEFT JOIN "PrivateCaseDocument" pd ON pd.id=p."documentId"' +
          ' LEFT JOIN "PrivateCaseDocument" d ON d.id=o."documentId"' +
          ' LEFT JOIN "EvidenceCheckRecord" ec ON ec.id=o."evidenceCheckId"' +
          ' JOIN LATERAL (SELECT * FROM "PrivateCaseObligationRevision" rev WHERE rev."obligationId"=o.id ORDER BY rev.revision DESC LIMIT 1) r ON TRUE' +
          ' WHERE o."workspaceId"=$1 AND o."caseId"=$2 ORDER BY r."dueDate" ASC NULLS LAST, o."createdAt" ASC, o.id',
          [workspaceId, caseId])
      })
    },
    async createObligation(workspaceId: string, caseId: string, value: unknown) {
      const input = obligationInput(value)
      return db.transaction(async tx => {
        await caseAccess(tx, workspaceId, caseId, 'write')
        await validateProvenance(tx, workspaceId, caseId, input)
        const id = randomUUID()
        await tx.query('INSERT INTO "PrivateCaseObligation" (id,"workspaceId","caseId","passageId","documentId","evidenceCheckId") VALUES ($1,$2,$3,$4,$5,$6)', [id, workspaceId, caseId, input.passageId, input.documentId, input.evidenceCheckId])
        await tx.query('INSERT INTO "PrivateCaseObligationRevision" ("obligationId",revision,"sourceObligation","responsibleParty","dueDate","duePrecision",recurrence,"expectedEvidence","evidenceStatus","reviewStatus","reviewedBy",note) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [id, input.sourceObligation, input.responsibleParty, input.dueDate, input.duePrecision, input.recurrence, input.expectedEvidence, input.evidenceStatus, 'DRAFT', null, input.note])
        await audit(tx, workspaceId, caseId, 'OBLIGATION_CREATED')
        return { id, revision: 1 }
      })
    },
    async reviseObligation(workspaceId: string, caseId: string, obligationId: string, value: unknown) {
      const raw = object(value)
      const reviewStatus = String(raw.reviewStatus ?? 'DRAFT')
      if (!(REVIEW_STATUS as readonly string[]).includes(reviewStatus)) throw new WorkspaceError(400, 'Invalid review status')
      const wantsReview = reviewStatus === 'REVIEWED'
      const input = obligationInput(value)
      return db.transaction(async tx => {
        await caseAccess(tx, workspaceId, caseId, wantsReview ? 'review' : 'write')
        const [existing] = await tx.query<{ id: string }>('SELECT id FROM "PrivateCaseObligation" WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3 FOR UPDATE', [workspaceId, caseId, obligationId])
        if (!existing) throw new WorkspaceError(404, 'Obligation not found')
        const [latest] = await tx.query<{ revision: number }>('SELECT revision FROM "PrivateCaseObligationRevision" WHERE "obligationId"=$1 ORDER BY revision DESC LIMIT 1', [obligationId])
        if (!latest) throw new WorkspaceError(404, 'Obligation not found')
        if (raw.revision != null && Number(raw.revision) !== latest.revision) throw new WorkspaceError(409, 'This obligation was updated by someone else; reload before saving')
        await validateProvenance(tx, workspaceId, caseId, input)
        if (wantsReview && !(input.passageId || input.documentId || (input.evidenceStatus === 'NOT_LOCATED' && input.evidenceCheckId))) throw new WorkspaceError(400, 'A reviewed obligation must link a source passage, a source document, or an evidence-check record showing evidence was not located')
        await tx.query('UPDATE "PrivateCaseObligation" SET "passageId"=$4,"documentId"=$5,"evidenceCheckId"=$6 WHERE "workspaceId"=$1 AND "caseId"=$2 AND id=$3', [workspaceId, caseId, obligationId, input.passageId, input.documentId, input.evidenceCheckId])
        const next = latest.revision + 1
        await tx.query('INSERT INTO "PrivateCaseObligationRevision" ("obligationId",revision,"sourceObligation","responsibleParty","dueDate","duePrecision",recurrence,"expectedEvidence","evidenceStatus","reviewStatus","reviewedBy",note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [obligationId, next, input.sourceObligation, input.responsibleParty, input.dueDate, input.duePrecision, input.recurrence, input.expectedEvidence, input.evidenceStatus, reviewStatus, wantsReview ? userId : null, input.note])
        await audit(tx, workspaceId, caseId, wantsReview ? 'OBLIGATION_REVIEWED' : 'OBLIGATION_REVISED')
        return { revision: next }
      })
    },
  }
}
