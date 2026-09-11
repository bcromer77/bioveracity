import { prisma } from '@/lib/prisma'
import { WorkspaceError } from './service'

// Cloudmersive free tier: 600 API calls/month, 1 call/second, 1 concurrent.
// We enforce a conservative budget of 500 to leave headroom for retries/other uses.
const MONTHLY_LIMIT = 500

// Cross-instance pacing: the free tier allows ~1 call/second across ALL hosting
// instances sharing the one provider key. An in-process timer alone cannot
// coordinate separate instances, so we reserve each 1-second slot atomically in
// the database. Waiting is BOUNDED — if the next free slot is further away than
// MAX_PACING_WAIT_MS the request is rejected (nothing imported) rather than held
// indefinitely.
const PACING_INTERVAL_MS = 1_000
const MAX_PACING_WAIT_MS = 12_000

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Reserve the next cross-instance pacing slot and wait (bounded) until it opens.
 *
 * A single atomic upsert advances a shared "next free slot" cursor by one
 * interval and returns the slot start assigned to THIS caller. If that slot is
 * within the bound we sleep until it arrives; otherwise we reject so requests
 * never queue without limit.
 */
async function pace(): Promise<void> {
  const now = Date.now()
  let slotStart: number
  try {
    const rows = await prisma.$queryRawUnsafe<{ nextMs: bigint }[]>(
      `INSERT INTO "ScanPacing" ("id", "nextMs") VALUES ('global', $1::bigint)
       ON CONFLICT ("id") DO UPDATE SET "nextMs" = GREATEST("ScanPacing"."nextMs", $2::bigint) + $3::bigint
       RETURNING "nextMs"`,
      now + PACING_INTERVAL_MS, now, PACING_INTERVAL_MS
    )
    // On first insert nextMs = now + interval (slot start = now, no wait).
    // On conflict nextMs = max(existing, now) + interval; slot start = nextMs - interval.
    slotStart = Number(rows[0]?.nextMs ?? BigInt(now + PACING_INTERVAL_MS)) - PACING_INTERVAL_MS
  } catch {
    // If the pacing table/query fails we fall back to no cross-instance pacing
    // rather than blocking uploads; the in-process limiter still applies.
    return
  }
  const wait = slotStart - Date.now()
  if (wait > MAX_PACING_WAIT_MS) {
    throw new WorkspaceError(503, 'The security scanner is busy handling other uploads right now. Nothing imported. Please try again in a minute.')
  }
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
}

/**
 * Reserve one scan call: first pace it against the shared per-second limit
 * (bounded wait), then atomically reserve one slot in this month's quota.
 * Throws WorkspaceError(503) if the scanner is too busy or the monthly limit
 * has been reached. Nothing is imported when this throws.
 */
export async function reserveScan(): Promise<void> {
  // 1. Per-second cross-instance pacing (bounded). No quota consumed if this rejects.
  await pace()

  // 2. Monthly quota — atomic upsert + increment, then check.
  const month = currentMonth()
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
