import { randomUUID } from 'node:crypto'

export type Template = 'PLANNING' | 'FARMER' | 'ESG' | 'FREIGHT' | 'GENERAL'
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
  if (!['PLANNING', 'FARMER', 'ESG', 'FREIGHT', 'GENERAL'].includes(String(template))) throw new WorkspaceError(400, 'Invalid template')
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
export function workspaceInput(value: unknown) { return { name: text(object(value).name, 120) } }
export type Workspace = { id: string; name: string; createdAt: Date }
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
  return {
    async listWorkspaces() {
      return db.query<Workspace>('SELECT w.id,w.name,w."createdAt" FROM "PrivateWorkspace" w JOIN "PrivateWorkspaceMember" m ON m."workspaceId"=w.id WHERE m."userId"=$1 AND m."revokedAt" IS NULL AND m.role IN (\'OWNER\',\'CONTRIBUTOR\',\'REVIEWER\',\'VIEWER\') ORDER BY w."createdAt" DESC LIMIT 100', [userId])
    },
    async createWorkspace(value: unknown) {
      const { name } = workspaceInput(value)
      return db.transaction(async tx => {
        const id = randomUUID()
        const [workspace] = await tx.query<Workspace>('INSERT INTO "PrivateWorkspace" (id,name) VALUES ($1,$2) RETURNING id,name,"createdAt"', [id, name])
        await tx.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,$2,$3)', [id, userId, 'OWNER'])
        await audit(tx, id, null, 'WORKSPACE_CREATED')
        return workspace
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
  }
}
