// Trial lifecycle for the Ellona partner tenant.
// The 14-day trial starts ATOMICALLY on the first successful customer login —
// never when the administrator creates the account, and never twice.

import { prisma } from '@/lib/prisma'
import { ELLONA } from './config'

export type TrialState = 'INVITED_NOT_ACTIVATED' | 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'REVOKED'

export type TrialInfo = {
  state: TrialState
  startedAt: Date | null
  endsAt: Date | null
  dayNumber: number | null // 1-based day within the trial
  daysRemaining: number | null
  firstLoginAt: Date | null
  lastLoginAt: Date | null
}

/**
 * Called on every successful login for a partner user. Starts the trial exactly
 * once (on first login) using a conditional update, and refreshes lastLoginAt.
 * Also flips ACTIVE→EXPIRED when the window has elapsed.
 */
export async function onPartnerLogin(workspaceId: string): Promise<void> {
  const now = new Date()
  const tenant = await prisma.partnerTenant.findUnique({ where: { workspaceId } })
  if (!tenant) return
  if (tenant.trialState === 'REVOKED') return

  if (tenant.trialState === 'INVITED_NOT_ACTIVATED' && !tenant.trialStartedAt) {
    const endsAt = new Date(now.getTime() + tenant.trialDays * 24 * 60 * 60 * 1000)
    // Conditional update: only starts if still un-started (atomic guard against
    // a double first-login race).
    await prisma.partnerTenant.updateMany({
      where: { workspaceId, trialStartedAt: null, trialState: 'INVITED_NOT_ACTIVATED' },
      data: {
        trialState: 'ACTIVE',
        trialStartedAt: now,
        trialEndsAt: endsAt,
        activatedAt: tenant.activatedAt ?? now,
        firstLoginAt: now,
        lastLoginAt: now,
      },
    })
    return
  }

  // Subsequent logins: refresh lastLoginAt and lazily expire.
  const expired = tenant.trialState === 'ACTIVE' && tenant.trialEndsAt && tenant.trialEndsAt.getTime() < now.getTime()
  await prisma.partnerTenant.update({
    where: { workspaceId },
    data: { lastLoginAt: now, ...(expired ? { trialState: 'EXPIRED' } : {}) },
  })
}

export function computeTrialInfo(tenant: {
  trialState: string
  trialStartedAt: Date | null
  trialEndsAt: Date | null
  firstLoginAt: Date | null
  lastLoginAt: Date | null
}): TrialInfo {
  const now = Date.now()
  let state = tenant.trialState as TrialState
  if (state === 'ACTIVE' && tenant.trialEndsAt && tenant.trialEndsAt.getTime() < now) {
    state = 'EXPIRED'
  }
  let dayNumber: number | null = null
  let daysRemaining: number | null = null
  if (tenant.trialStartedAt && tenant.trialEndsAt) {
    const elapsedMs = now - tenant.trialStartedAt.getTime()
    dayNumber = Math.max(1, Math.min(ELLONA.trialDays, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1))
    daysRemaining = Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
  }
  return {
    state,
    startedAt: tenant.trialStartedAt,
    endsAt: tenant.trialEndsAt,
    dayNumber,
    daysRemaining,
    firstLoginAt: tenant.firstLoginAt,
    lastLoginAt: tenant.lastLoginAt,
  }
}

// Format a date in Europe/Dublin (the operational timezone, brief §9).
export function formatDublin(date: Date | null, withTime = false): string {
  if (!date) return '\u2014'
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}
