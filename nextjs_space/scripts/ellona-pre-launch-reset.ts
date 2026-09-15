// Ellona pre-launch reset — the controlled clean reset run AFTER Bazil's review
// and BEFORE Natalia is invited (brief Part 5). It is deliberately conservative:
//
//   PRESERVES (never touched):
//     - Opportunity rows (the verified public-source records)
//     - OpportunityEvent rows (the source-change chronology)
//     - PartnerEmail sandbox renders (audit trail; never sent)
//
//   REMOVES / CLEARS (only test + review engagement):
//     - OpportunityAction rows for the Ellona workspace
//       (relevant / not-relevant / follow / investigation-request / decision)
//     - OpportunityAssessment rows for the Ellona workspace
//       (test comments live inside these rows' `comments` JSON)
//     - Invalidates every outstanding PartnerInvitation (marks consumedAt) so no
//       activation link minted during review can ever be used
//     - Natalia's password (set back to null so she must set her own on activation)
//     - PartnerTenant trial state -> INVITED_NOT_ACTIVATED with every trial
//       timestamp cleared (activatedAt, firstLoginAt, lastLoginAt,
//       trialStartedAt, trialEndsAt)
//
//   RECORDS: a PartnerAuthEvent (kind PRE_LAUNCH_RESET) for the audit trail.
//
// SAFETY: dry-run by DEFAULT. It reports exactly what it WOULD change and makes
// NO mutations unless run with CONFIRM=RESET. This makes the committed script
// safe to exist in the tree and safe to run accidentally.
//
//   Dry-run : yarn tsx --require dotenv/config scripts/ellona-pre-launch-reset.ts
//   Execute : CONFIRM=RESET yarn tsx --require dotenv/config scripts/ellona-pre-launch-reset.ts

import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { ELLONA } from '../lib/ellona/config'

const EXECUTE = process.env.CONFIRM === 'RESET'

async function delById(model: any, where: any): Promise<number> {
  const rows = await model.findMany({ where, select: { id: true } })
  if (EXECUTE) for (const r of rows) await model.delete({ where: { id: r.id } })
  return rows.length
}

async function main() {
  const tenant = await prisma.partnerTenant.findUnique({ where: { contactEmail: ELLONA.contactEmail } })
  if (!tenant) throw new Error('Ellona tenant not found. Run scripts/seed-ellona.ts first.')
  const workspaceId = tenant.workspaceId

  const report: Record<string, unknown> = { mode: EXECUTE ? 'EXECUTE' : 'DRY-RUN', workspaceId }

  // 1) Remove engagement actions (follows / decisions / investigation requests).
  report.opportunityActionsRemoved = await delById(prisma.opportunityAction, { workspaceId })

  // 2) Remove test assessments (their `comments` JSON holds any review comments).
  report.opportunityAssessmentsRemoved = await delById(prisma.opportunityAssessment, { workspaceId })

  // 3) Invalidate every outstanding activation/reset invitation (single-use).
  const openInvites = await prisma.partnerInvitation.findMany({
    where: { workspaceId, consumedAt: null }, select: { id: true },
  })
  if (EXECUTE) {
    for (const inv of openInvites) {
      await prisma.partnerInvitation.update({ where: { id: inv.id }, data: { consumedAt: new Date() } })
    }
  }
  report.invitationsInvalidated = openInvites.length

  // 4) Clear Natalia's password so she must choose her own at activation.
  const natalia = await prisma.user.findUnique({
    where: { email: ELLONA.contactEmail }, select: { id: true, password: true },
  })
  report.passwordWasSet = !!natalia?.password
  if (EXECUTE && natalia) {
    await prisma.user.update({ where: { id: natalia.id }, data: { password: null } })
  }

  // 5) Reset trial state to a pristine invited-not-activated tenant.
  report.trialStateBefore = tenant.trialState
  if (EXECUTE) {
    await prisma.partnerTenant.update({
      where: { workspaceId },
      data: {
        trialState: 'INVITED_NOT_ACTIVATED',
        activatedAt: null,
        firstLoginAt: null,
        lastLoginAt: null,
        trialStartedAt: null,
        trialEndsAt: null,
      },
    })
  }

  // 6) Record an auditable reset event.
  if (EXECUTE) {
    await prisma.partnerAuthEvent.create({
      data: {
        id: randomUUID(),
        workspaceId,
        email: ELLONA.contactEmail,
        kind: 'PRE_LAUNCH_RESET',
        detail: 'Controlled pre-launch reset: cleared review engagement, invalidated invitations, reset trial state.',
      },
    })
  }

  // 7) Verify the post-reset state (read-only; always runs).
  const remainingActions = await prisma.opportunityAction.count({ where: { workspaceId } })
  const remainingAssessments = await prisma.opportunityAssessment.count({ where: { workspaceId } })
  const t2 = await prisma.partnerTenant.findUnique({ where: { workspaceId } })
  const n2 = await prisma.user.findUnique({ where: { email: ELLONA.contactEmail }, select: { password: true } })
  const openInvites2 = await prisma.partnerInvitation.count({ where: { workspaceId, consumedAt: null } })
  const oppCount = await prisma.opportunity.count({ where: { workspaceId } })
  const eventCount = await prisma.opportunityEvent.count({
    where: { opportunity: { workspaceId } },
  })

  report.verify = {
    opportunitiesPreserved: oppCount,
    sourceEventsPreserved: eventCount,
    remainingActions,
    remainingAssessments,
    openInvitationsRemaining: openInvites2,
    passwordNowNull: !n2?.password,
    trialState: t2?.trialState,
    timestampsNull: {
      activatedAt: !t2?.activatedAt,
      firstLoginAt: !t2?.firstLoginAt,
      lastLoginAt: !t2?.lastLoginAt,
      trialStartedAt: !t2?.trialStartedAt,
      trialEndsAt: !t2?.trialEndsAt,
    },
  }

  console.log(JSON.stringify(report, null, 2))
  if (!EXECUTE) {
    console.log('\nDRY-RUN only. No changes were made. Re-run with CONFIRM=RESET to apply.')
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
