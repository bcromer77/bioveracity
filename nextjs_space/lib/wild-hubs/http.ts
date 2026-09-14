import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Database, Sql } from '@/lib/workspaces/service'
import { WorkspaceError } from '@/lib/workspaces/service'
import { HubError } from './domain'
import { hubService } from './service'
export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
}
const adapter = (client: Pick<typeof prisma, '$queryRawUnsafe'>): Sql => ({
  query: <T>(sql: string, values: unknown[]) =>
    client.$queryRawUnsafe<T[]>(sql, ...values),
})
export const hubDb: Database = {
  ...adapter(prisma),
  transaction: (operation) =>
    prisma.$transaction((tx) => operation(adapter(tx)), {
      isolationLevel: 'Serializable',
    }),
}
export function enabled() {
  return process.env.WILD_HUBS_ENABLED === 'true'
}
export async function hubRequest(
  operation: (service: ReturnType<typeof hubService>) => Promise<unknown>,
  status = 200,
) {
  try {
    if (!enabled())
      throw new HubError(
        503,
        'Ecology hub setup is not enabled yet. Please contact us for pricing.',
      )
    const session = await auth()
    if (!session?.user?.id) throw new HubError(401, 'Please sign in.')
    return Response.json(await operation(hubService(hubDb, session.user.id)), {
      status,
      headers: privateHeaders,
    })
  } catch (e) {
    const serial = (e as { code?: string })?.code === 'P2034'
    return Response.json(
      {
        error:
          e instanceof HubError || e instanceof WorkspaceError
            ? e.message
            : serial
              ? 'This hub changed. Reload and try again.'
              : 'Unable to complete this action. Your draft has not been published.',
      },
      {
        status:
          e instanceof HubError || e instanceof WorkspaceError
            ? e.status
            : serial
              ? 409
              : 503,
        headers: privateHeaders,
      },
    )
  }
}
