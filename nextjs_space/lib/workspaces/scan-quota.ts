import { prisma } from '@/lib/prisma'
import { WorkspaceError } from './service'

// Cloudmersive free tier: 600 API calls/month.
// We enforce a conservative budget of 500 to leave headroom for retries/other uses.
const MONTHLY_LIMIT = 500

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Atomically reserve one scan call in this month's quota.
 * Throws WorkspaceError(503) if the monthly limit has been reached.
 * Uses a raw upsert + check to avoid race conditions across instances.
 */
export async function reserveScan(): Promise<void> {
  const month = currentMonth()
  // Upsert and increment atomically, then check.
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO "ScanUsage" ("month", "count") VALUES ($1, 1)
     ON CONFLICT ("month") DO UPDATE SET "count" = "ScanUsage"."count" + 1
     RETURNING "count"`,
    month
  )
  const count = rows[0]?.count ?? 0
  if (count > MONTHLY_LIMIT) {
    // Roll back the increment — we're over.
    await prisma.$queryRawUnsafe(
      `UPDATE "ScanUsage" SET "count" = GREATEST("count" - 1, 0) WHERE "month" = $1`,
      month
    ).catch(() => { /* best-effort rollback */ })
    throw new WorkspaceError(503, `The monthly scanning quota (${MONTHLY_LIMIT} scans) has been reached. Uploads are paused until next month. Nothing imported.`)
  }
}

/** Read the current usage for display / diagnostics. */
export async function scanUsage(): Promise<{ month: string; count: number; limit: number }> {
  const month = currentMonth()
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT "count" FROM "ScanUsage" WHERE "month" = $1`, month
  )
  return { month, count: rows[0]?.count ?? 0, limit: MONTHLY_LIMIT }
}
