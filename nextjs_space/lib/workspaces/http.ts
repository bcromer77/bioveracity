import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { WorkspaceError, workspaceService, type Sql } from './service'

export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
const adapter = (client: Pick<typeof prisma, '$queryRawUnsafe'>): Sql => ({
  // SQL strings are fixed in service.ts; all user values remain bound parameters.
  query: <T>(sql: string, values: unknown[]) => client.$queryRawUnsafe<T[]>(sql, ...values),
})
export async function body(request: Request): Promise<unknown> {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new WorkspaceError(403, 'Same-origin request required')
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new WorkspaceError(415, 'JSON required')
  if (Number(request.headers.get('content-length')) > 16384) throw new WorkspaceError(413, 'Request too large')
  const reader = request.body?.getReader()
  if (!reader) throw new WorkspaceError(400, 'Body required')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16384) { await reader.cancel(); throw new WorkspaceError(413, 'Request too large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { throw new WorkspaceError(400, 'Invalid JSON') }
  } finally { reader.releaseLock() }
}
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
