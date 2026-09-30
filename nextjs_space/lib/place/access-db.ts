// Prisma wiring for Place Access Points. Fixed SQL lives in access-points.ts;
// every value stays a bound parameter. READ COMMITTED (the default) so that a
// concurrent revoke re-checks `revokedAt IS NULL` and settles as alreadyRevoked.
import { prisma } from '@/lib/prisma'
import type { Database, Sql } from '@/lib/workspaces/service'

const sql = (client: Pick<typeof prisma, '$queryRawUnsafe'>): Sql => ({
  query: <T>(text: string, values: unknown[]) => client.$queryRawUnsafe<T[]>(text, ...values),
})

export const placeAccessDb: Database = {
  ...sql(prisma),
  transaction: (operation) => prisma.$transaction((tx) => operation(sql(tx))),
}
