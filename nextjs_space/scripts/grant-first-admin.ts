// Operator CLI for the first production administrator bootstrap.
// Default is a READ-ONLY check. The grant runs only with --grant and a
// confirmation that repeats the exact email. Never takes or prints a password.
//
//   node --import tsx scripts/grant-first-admin.ts --email <e> --operator <who ran it> \
//     --authorised-by <who authorised it> --reason <text> [--grant --confirm <e>]
//
// Requires migration 20261002_admin_grant_audit to be applied first.
import { PrismaClient } from '@prisma/client'
import type { Database, Sql } from '../lib/workspaces/service'
import { checkFirstAdmin, grantFirstAdmin, FirstAdminError } from '../lib/identity/first-admin'

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : ''
}

async function main() {
  const prisma = new PrismaClient()
  const sql = (c: Pick<PrismaClient, '$queryRawUnsafe'>): Sql => ({ query: <T>(q: string, v: unknown[]) => c.$queryRawUnsafe<T[]>(q, ...v) })
  const db: Database = { ...sql(prisma), transaction: (op) => prisma.$transaction((tx) => op(sql(tx)), { isolationLevel: 'Serializable' }) }
  const grant = process.argv.includes('--grant')
  const input = { email: arg('email'), confirm: grant ? arg('confirm') : arg('email'), operator: arg('operator'), authorisedBy: arg('authorised-by'), reason: arg('reason') }
  try {
    const out = grant ? await grantFirstAdmin(db, input) : { mode: 'check-only (no writes)', ...(await checkFirstAdmin(db, input)) }
    console.log(JSON.stringify(out, null, 2))
  } catch (e) {
    if (e instanceof FirstAdminError) { console.error(JSON.stringify({ refused: e.code, message: e.message })); process.exitCode = 2 }
    else { console.error(JSON.stringify({ error: 'grant_failed_rolled_back', message: String((e as Error)?.message ?? e).slice(0, 300) })); process.exitCode = 1 }
  } finally { await prisma.$disconnect() }
}
main()
