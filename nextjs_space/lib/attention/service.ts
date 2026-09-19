import { randomUUID } from 'node:crypto'
import type { Database, Sql } from '@/lib/workspaces/service'
import { WorkspaceError } from '@/lib/workspaces/service'

export type AttentionSignificance = 'ROUTINE' | 'IMPORTANT' | 'ACTION' | 'CRITICAL'
export type AttentionCategory =
  | 'EVIDENCE_ARRIVED'
  | 'EVIDENCE_CHANGED'
  | 'REVIEW_REQUESTED'
  | 'MILESTONE_DUE'
  | 'SOURCE_DEGRADED'
  | 'QUESTION_RESOLVABLE'
  | 'SECURITY'

export type AttentionInput = {
  userId: string
  scopeKey: string
  workspaceId?: string | null
  caseId?: string | null
  category: AttentionCategory
  significance: AttentionSignificance
  requiresAction?: boolean
  title: string
  summary: string
  actionPath: string
  dedupeKey: string
  occurredAt: Date
  metadata?: Record<string, unknown>
}

export type AttentionDecision =
  | { kind: 'SUPPRESS'; reason: string }
  | { kind: 'IN_PRODUCT'; reason: string }
  | { kind: 'DIGEST'; reason: string; earliestAt: Date; bundleKey: string }
  | { kind: 'EMAIL'; reason: string; earliestAt: Date; bundleKey: string }

type Preference = {
  actionEmail: boolean
  importantChangeEmail: boolean
  weeklyDigest: boolean
  routineEmail: boolean
  quietHoursStart: number | null
  quietHoursEnd: number | null
  timezone: string | null
}

const DEFAULTS: Preference = {
  actionEmail: true,
  importantChangeEmail: true,
  weeklyDigest: true,
  routineEmail: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: null,
}

function validatePath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020]/.test(path)) throw new WorkspaceError(400, 'Invalid notification path')
}

function addHours(d: Date, n: number) {
  return new Date(d.getTime() + n * 60 * 60 * 1000)
}

// Deliberately conservative. Critical security can interrupt immediately.
// Everything else must earn an interruption.
export function decideAttention(input: AttentionInput, pref: Preference, recentNonCriticalEmailAt: Date | null): AttentionDecision {
  validatePath(input.actionPath)
  if (input.significance === 'CRITICAL' || input.category === 'SECURITY') {
    return { kind: 'EMAIL', reason: 'critical event may justify immediate interruption', earliestAt: input.occurredAt, bundleKey: `critical:${input.scopeKey}` }
  }

  if (input.requiresAction || input.significance === 'ACTION') {
    if (!pref.actionEmail) return { kind: 'IN_PRODUCT', reason: 'user disabled action email' }
    if (recentNonCriticalEmailAt && input.occurredAt.getTime() - recentNonCriticalEmailAt.getTime() < 24 * 60 * 60 * 1000) {
      return { kind: 'DIGEST', reason: 'same user was already interrupted recently; bundle the next action', earliestAt: addHours(recentNonCriticalEmailAt, 24), bundleKey: `daily:${input.userId}:${input.scopeKey}` }
    }
    return { kind: 'EMAIL', reason: 'action required and interruption budget is available', earliestAt: input.occurredAt, bundleKey: `daily:${input.userId}:${input.scopeKey}` }
  }

  if (input.significance === 'IMPORTANT') {
    if (!pref.importantChangeEmail) return { kind: 'IN_PRODUCT', reason: 'user disabled important-change email' }
    if (recentNonCriticalEmailAt && input.occurredAt.getTime() - recentNonCriticalEmailAt.getTime() < 24 * 60 * 60 * 1000) {
      return { kind: 'DIGEST', reason: 'important change bundled to protect attention', earliestAt: addHours(recentNonCriticalEmailAt, 24), bundleKey: `daily:${input.userId}:${input.scopeKey}` }
    }
    return { kind: 'EMAIL', reason: 'important change and interruption budget is available', earliestAt: input.occurredAt, bundleKey: `daily:${input.userId}:${input.scopeKey}` }
  }

  if (pref.routineEmail) {
    return { kind: 'DIGEST', reason: 'routine email requested by user; never send as immediate interruption', earliestAt: addHours(input.occurredAt, 24), bundleKey: `daily:${input.userId}:${input.scopeKey}` }
  }
  if (pref.weeklyDigest) {
    return { kind: 'DIGEST', reason: 'routine change saved for quiet weekly summary', earliestAt: addHours(input.occurredAt, 24 * 7), bundleKey: `weekly:${input.userId}:${input.scopeKey}` }
  }
  return { kind: 'IN_PRODUCT', reason: 'routine activity belongs in-product only' }
}

export function attentionService(db: Database) {
  async function preference(sql: Sql, userId: string, scopeKey: string): Promise<Preference> {
    const rows = await sql.query<Preference>(
      'SELECT "actionEmail","importantChangeEmail","weeklyDigest","routineEmail","quietHoursStart","quietHoursEnd","timezone" FROM "AttentionPreference" WHERE "userId"=$1 AND "scopeKey" IN ($2,\'GLOBAL\') ORDER BY CASE WHEN "scopeKey"=$2 THEN 0 ELSE 1 END LIMIT 1',
      [userId, scopeKey],
    )
    return rows[0] ?? DEFAULTS
  }

  return {
    async record(input: AttentionInput) {
      if (!input.userId || !input.scopeKey || !input.title.trim() || !input.summary.trim() || !input.dedupeKey.trim()) throw new WorkspaceError(400, 'Invalid attention event')
      validatePath(input.actionPath)
      return db.transaction(async tx => {
        const existing = await tx.query<{ id: string }>('SELECT id FROM "AttentionEvent" WHERE "userId"=$1 AND "dedupeKey"=$2', [input.userId, input.dedupeKey])
        if (existing[0]) return { eventId: existing[0].id, duplicate: true, decision: { kind: 'SUPPRESS', reason: 'duplicate event already recorded' } as AttentionDecision }

        const pref = await preference(tx, input.userId, input.scopeKey)
        const recent = await tx.query<{ sentAt: Date }>(
          'SELECT "sentAt" FROM "NotificationDelivery" WHERE "userId"=$1 AND channel=\'EMAIL\' AND status=\'SENT\' AND "sentAt" IS NOT NULL AND reason NOT LIKE \'critical:%\' ORDER BY "sentAt" DESC LIMIT 1',
          [input.userId],
        )
        const decision = decideAttention(input, pref, recent[0]?.sentAt ?? null)
        const eventId = randomUUID()
        await tx.query(
          'INSERT INTO "AttentionEvent" (id,"userId","scopeKey","workspaceId","caseId",category,significance,"requiresAction",title,summary,"actionPath","dedupeKey","occurredAt",metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)',
          [eventId,input.userId,input.scopeKey,input.workspaceId ?? null,input.caseId ?? null,input.category,input.significance,Boolean(input.requiresAction),input.title.trim(),input.summary.trim(),input.actionPath,input.dedupeKey,input.occurredAt,JSON.stringify(input.metadata ?? {})],
        )

        if (decision.kind === 'EMAIL' || decision.kind === 'DIGEST') {
          await tx.query(
            'INSERT INTO "NotificationDelivery" (id,"userId","attentionEventId",channel,status,reason,"bundleKey",subject,"actionPath","scheduledAt") VALUES ($1,$2,$3,\'EMAIL\',\'PENDING\',$4,$5,$6,$7,$8)',
            [randomUUID(),input.userId,eventId,`${decision.kind.toLowerCase()}:${decision.reason}`,decision.bundleKey,input.title,input.actionPath,decision.earliestAt],
          )
        }
        return { eventId, duplicate: false, decision }
      })
    },

    async updatePreference(userId: string, scopeKey: string, values: Partial<Pick<Preference, 'actionEmail'|'importantChangeEmail'|'weeklyDigest'|'routineEmail'>>) {
      if (!userId || !scopeKey) throw new WorkspaceError(400, 'Invalid notification preference')
      const current = await preference(db, userId, scopeKey)
      const next = { ...current, ...values }
      await db.query(
        'INSERT INTO "AttentionPreference" (id,"userId","scopeKey","actionEmail","importantChangeEmail","weeklyDigest","routineEmail") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("userId","scopeKey") DO UPDATE SET "actionEmail"=EXCLUDED."actionEmail","importantChangeEmail"=EXCLUDED."importantChangeEmail","weeklyDigest"=EXCLUDED."weeklyDigest","routineEmail"=EXCLUDED."routineEmail","updatedAt"=now()',
        [randomUUID(),userId,scopeKey,next.actionEmail,next.importantChangeEmail,next.weeklyDigest,next.routineEmail],
      )
      return next
    },
  }
}
