import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter, privateHeaders } from '@/lib/workspaces/http'
import { WorkspaceError, type Database } from '@/lib/workspaces/service'
import { rightsService } from './service'
export const rightsEnabled = () => process.env.DATA_RIGHTS_ENABLED === 'true'
export const rightsDb: Database = {...adapter(prisma), transaction: fn => prisma.$transaction(tx => fn(adapter(tx)), {isolationLevel:'Serializable'})}
export async function rightsRequest(fn: (service: ReturnType<typeof rightsService>) => Promise<unknown>, download=false) {
  try {
    if (!rightsEnabled()) throw new WorkspaceError(503, 'Online data controls are not enabled. Please use Contact to exercise your rights.')
    const session = await auth()
    if (!session?.user?.id) throw new WorkspaceError(401, 'Please sign in.')
    const result = await fn(rightsService(rightsDb, session.user.id))
    return Response.json(result, {headers:{...privateHeaders, ...(download ? {'Content-Disposition':'attachment; filename="bioveracity-account-data.json"'} : {})}})
  } catch(e) {
    return Response.json({error:e instanceof WorkspaceError ? e.message : 'Unable to complete this request. Please retry or use Contact.'}, {status:e instanceof WorkspaceError ? e.status : 503, headers:privateHeaders})
  }
}
