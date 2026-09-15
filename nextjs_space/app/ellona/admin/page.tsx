// Admin view (brief §14) — visible ONLY to Bazil (the originator). Gives an
// honest operational picture of the Ellona tenant during the trial: trial
// state and dates, the authentication event log, the sandbox emails that have
// been rendered (never sent), and the customer-created assessments. It is
// strictly read-only and does not expose any secret material.

import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { ellonaEnabled, ELLONA, REPRESENTATION_LINE } from '@/lib/ellona/config'
import { findEllonaWorkspace } from '@/lib/ellona/access'
import { prisma } from '@/lib/prisma'
import { computeTrialInfo, formatDublin } from '@/lib/ellona/trial'
import { EllonaShell } from '@/components/ellona/ellona-shell'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

const BAZIL_EMAIL = 'bazil.cromer@ripplexn.com'

export default async function EllonaAdminPage() {
  if (!ellonaEnabled()) notFound()
  const session = await auth()
  const userId = session?.user?.id
  const email = (session?.user?.email || '').toLowerCase()
  if (!userId) redirect('/login?callbackUrl=/ellona/admin')
  // Admin is Bazil-only. Anyone else (including Natalia) gets a 404 — the page
  // does not reveal its own existence.
  if (email !== BAZIL_EMAIL) notFound()

  const membership = await findEllonaWorkspace(userId)
  if (!membership) notFound()
  const workspaceId = membership.workspaceId

  const [tenant, authEvents, emails, assessments, opps] = await Promise.all([
    prisma.partnerTenant.findUnique({ where: { workspaceId } }),
    prisma.partnerAuthEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.partnerEmail.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.opportunityAssessment.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, status: true, decisionType: true, documentName: true, reviewedAt: true, createdAt: true },
    }),
    prisma.opportunity.count({ where: { workspaceId } }),
  ])

  if (!tenant) notFound()
  const trial = computeTrialInfo(tenant)

  return (
    <EllonaShell showAdmin>
      <div className="bv-eyebrow">Admin — originator view</div>
      <h1 style={{ marginTop: 8 }}>{ELLONA.workspaceName}</h1>
      <p className="bv-lead" style={{ marginTop: 8 }}>
        Operational view for {ELLONA.originatorName} / {ELLONA.originatorOrg}. Read-only. Emails shown here are
        sandbox renders and have not been sent.
      </p>

      <h2 style={{ marginTop: 24 }}>Tenant &amp; trial</h2>
      <div className="bv-ellona-panel">
        <Row label="Organisation" value={tenant.orgName} />
        <Row label="Workspace" value={tenant.workspaceName} />
        <Row label="Contact" value={`${tenant.contactName} (${tenant.contactEmail})`} />
        <Row label="Partner role" value={tenant.partnerRole} />
        <Row label="Territories" value={tenant.territories} />
        <Row label="Trial state" value={trial.state} />
        <Row label="Trial day" value={trial.dayNumber ? `Day ${trial.dayNumber} of ${tenant.trialDays}` : 'Not started'} />
        <Row label="Trial started" value={formatDublin(trial.startedAt, true)} />
        <Row label="Trial ends" value={formatDublin(trial.endsAt, true)} />
        <Row label="First login" value={formatDublin(trial.firstLoginAt, true)} />
        <Row label="Last login" value={formatDublin(trial.lastLoginAt, true)} />
        <Row label="Opportunities in tenant" value={String(opps)} />
        <Row label="Alerts paused" value={tenant.alertsPaused ? 'Yes' : 'No'} />
      </div>

      <h2 style={{ marginTop: 28 }}>Authentication events ({authEvents.length})</h2>
      {authEvents.length === 0 ? (
        <p style={{ fontSize: 14, color: '#8a8f83' }}>No authentication events recorded yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {authEvents.map((e) => (
            <div key={e.id} className="bv-comment">
              <div>
                <span className="bv-tag">{e.kind}</span> <strong>{e.email}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#5b6157', marginTop: 4 }}>
                {formatDublin(e.createdAt, true)}
                {e.detail ? ` — ${e.detail}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 28 }}>Sandbox emails rendered ({emails.length})</h2>
      <p style={{ fontSize: 13, color: '#5b6157', marginTop: 4 }}>
        These are rendered previews stored for review. Real sending is gated on authenticated senders, DNS
        verification and your explicit approval.
      </p>
      {emails.length === 0 ? (
        <p style={{ fontSize: 14, color: '#8a8f83', marginTop: 8 }}>No emails rendered yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {emails.map((m) => (
            <div key={m.id} className="bv-comment">
              <div>
                <span className="bv-tag">{m.kind}</span> <strong>{m.subject}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#5b6157', marginTop: 4 }}>
                From {m.senderIdentity} → {m.recipient} · {m.status} · {m.sandbox ? 'sandbox' : 'live'} ·{' '}
                {formatDublin(m.createdAt, true)}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 28 }}>Customer assessments ({assessments.length})</h2>
      {assessments.length === 0 ? (
        <p style={{ fontSize: 14, color: '#8a8f83', marginTop: 8 }}>No assessments created yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {assessments.map((a) => (
            <div key={a.id} className="bv-comment">
              <div>
                <span className="bv-tag bv-tag-status">{a.status}</span> <strong>{a.title}</strong>{' '}
                <span className="bv-tag">{a.decisionType}</span>
              </div>
              <div style={{ fontSize: 12, color: '#5b6157', marginTop: 4 }}>
                {a.documentName} · created {formatDublin(a.createdAt, true)}
                {a.reviewedAt ? ` · reviewed ${formatDublin(a.reviewedAt, true)}` : ' · not yet reviewed'}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="bv-ellona-rep" style={{ marginTop: 28 }}>
        {REPRESENTATION_LINE}
      </p>
    </EllonaShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bv-field">
      <div className="bv-field-label">{label}</div>
      <div className="bv-field-val">{value}</div>
    </div>
  )
}
