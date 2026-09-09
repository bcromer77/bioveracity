import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { WorkspaceError, workspaceService, type Sql } from './service'

export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
export const adapter = (client: Pick<typeof prisma, '$queryRawUnsafe'>): Sql => ({
  // SQL strings are fixed in service.ts; all user values remain bound parameters.
  query: <T>(sql: string, values: unknown[]) => client.$queryRawUnsafe<T[]>(sql, ...values),
})
export { body } from './request-body'
export async function privateRequest(operation: (service: ReturnType<typeof workspaceService>) => Promise<unknown>, status = 200) {
  try {
    const session = await auth()
    if (!session?.user?.id) throw new WorkspaceError(401, 'Authentication required')
    if (process.env.PRIVATE_WORKSPACES_ENABLED !== 'true') throw new WorkspaceError(503, 'Private workspaces are not enabled on this deployment')
    const service = workspaceService({
      ...adapter(prisma),
      transaction: operation => prisma.$transaction(tx => operation(adapter(tx)), { isolationLevel: 'Serializable' }),
    }, session.user.id)
    return Response.json(await operation(service), { status, headers: privateHeaders })
  } catch (error) {
    // No database details, user data or distinction between foreign and missing IDs.
    return Response.json({ error: error instanceof WorkspaceError ? error.message : 'Workspace request failed' }, {
      status: error instanceof WorkspaceError ? error.status : 500, headers: privateHeaders,
    })
  }
}
