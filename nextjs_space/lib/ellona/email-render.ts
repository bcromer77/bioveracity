// Email RENDERING (not sending) for the Ellona Opportunity Watch.
//
// During the trial we render every partner email to HTML and store it in the
// PartnerEmail table with status RENDERED and sandbox=true. No real message is
// dispatched: real sending is gated on authenticated senders + SPF/DKIM/DMARC
// verification and Bazil's explicit approval. Storing (never sending) lets the
// activation/digest/alert/correction/trial emails be reviewed exactly as they
// would appear, without contacting the customer.

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { ELLONA, REPRESENTATION_LINE, SENDERS } from './config'

export type EmailKind = 'ACTIVATION' | 'DIGEST' | 'ALERT' | 'CORRECTION' | 'MIDPOINT' | 'EXPIRY' | 'TRIAL_SUMMARY'

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FOREST = '#173d35'
const GOLD = '#dfc27a'
const CREAM = '#f7f4ec'

function shell(title: string, inner: string, opts: { withRepresentation: boolean }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:${CREAM};font-family:Arial,Helvetica,sans-serif;color:#20241f;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:${FOREST};color:#fff;padding:18px 22px;border-radius:10px 10px 0 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${GOLD};">BioVeracity Opportunity Watch</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px;">${esc(title)}</div>
    </div>
    <div style="background:#fff;padding:22px;border:1px solid #e4e2d6;border-top:none;border-radius:0 0 10px 10px;">
      ${inner}
    </div>
    ${
      opts.withRepresentation
        ? `<p style="font-size:12px;color:#5b6157;margin:16px 4px 4px;font-style:italic;">${esc(REPRESENTATION_LINE)}</p>`
        : ''
    }
    <p style="font-size:11px;color:#8a8f83;margin:8px 4px;">Sent to ${esc(ELLONA.contactName)} for the ${esc(
      ELLONA.workspaceName,
    )}. This is a trial preview rendered by BioVeracity; log in to see the live record.</p>
  </div>
</body></html>`
}

function actionBtn(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;background:${FOREST};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;margin:10px 0;">${esc(
    label,
  )}</a>`
}

export type RenderedEmail = {
  kind: EmailKind
  senderIdentity: string
  subject: string
  recipient: string
  html: string
  dedupKey: string | null
}

// ---- Individual renderers -------------------------------------------------

export function renderActivationEmail(input: { activationUrl: string; expiresLabel: string }): RenderedEmail {
  const inner = `
    <p>Hello ${esc(ELLONA.contactName)},</p>
    <p>Your private ${esc(ELLONA.workspaceName)} is ready. This is a secure, single-use activation link — it expires ${esc(
      input.expiresLabel,
    )}.</p>
    <p>${actionBtn(input.activationUrl, 'Activate your account')}</p>
    <p style="font-size:13px;color:#5b6157;">You will choose your own password. If you did not expect this, ignore this email and nothing changes.</p>`
  return {
    kind: 'ACTIVATION',
    senderIdentity: SENDERS.accounts.identity,
    subject: `Activate your ${ELLONA.workspaceName}`,
    recipient: ELLONA.contactEmail,
    html: shell('Activate your account', inner, { withRepresentation: false }),
    dedupKey: null,
  }
}

export type OpportunityLine = {
  buyer: string
  title: string
  measurementNeed: string | null
  deadline: string | null
  url: string
  classification: string
}

export function renderAlertEmail(opp: OpportunityLine): RenderedEmail {
  const need = opp.measurementNeed || 'measurement need to be confirmed'
  const deadline = opp.deadline || 'no stated deadline'
  const inner = `
    <p>A new opportunity relevant to Ellona has been added to your watch.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#5b6157;width:38%;">Buyer</td><td style="padding:6px 0;"><strong>${esc(
        opp.buyer,
      )}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#5b6157;">Opportunity</td><td style="padding:6px 0;">${esc(opp.title)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6157;">Classification</td><td style="padding:6px 0;">${esc(
        opp.classification,
      )}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6157;">Measurement need</td><td style="padding:6px 0;">${esc(need)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6157;">Deadline</td><td style="padding:6px 0;">${esc(deadline)}</td></tr>
    </table>
    <p>${actionBtn(opp.url, 'Open the opportunity')}</p>
    <p style="font-size:12px;color:#5b6157;">Any published value shown in the record is the whole-contract value unless stated otherwise, not a value attributable to Ellona.</p>`
  return {
    kind: 'ALERT',
    senderIdentity: SENDERS.alerts.identity,
    subject: `Ellona opportunity: ${opp.buyer} — ${need} — ${deadline}`,
    recipient: ELLONA.contactEmail,
    html: shell('New opportunity', inner, { withRepresentation: true }),
    dedupKey: `alert:${opp.url}`,
  }
}

export function renderCorrectionEmail(input: {
  opp: OpportunityLine
  whatChanged: string
}): RenderedEmail {
  const inner = `
    <p>An opportunity you are following has changed.</p>
    <p style="background:${CREAM};border-left:4px solid ${GOLD};padding:10px 14px;"><strong>What changed:</strong> ${esc(
      input.whatChanged,
    )}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#5b6157;width:38%;">Buyer</td><td style="padding:6px 0;"><strong>${esc(
        input.opp.buyer,
      )}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#5b6157;">Opportunity</td><td style="padding:6px 0;">${esc(
        input.opp.title,
      )}</td></tr>
    </table>
    <p>${actionBtn(input.opp.url, 'Review the change')}</p>`
  return {
    kind: 'CORRECTION',
    senderIdentity: SENDERS.alerts.identity,
    subject: `Correction: ${input.opp.buyer} — ${input.whatChanged}`,
    recipient: ELLONA.contactEmail,
    html: shell('Correction / deadline change', inner, { withRepresentation: true }),
    dedupKey: `correction:${input.opp.url}:${input.whatChanged}`,
  }
}

export function renderDigestEmail(input: { opps: OpportunityLine[]; dashboardUrl: string; periodLabel: string }): RenderedEmail {
  const rows = input.opps
    .map(
      (o) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;"><strong>${esc(o.buyer)}</strong><br><span style="color:#5b6157;font-size:13px;">${esc(
          o.title,
        )}</span><br><span style="font-size:12px;color:#8a8f83;">${esc(o.classification)} — ${esc(
          o.deadline || 'no stated deadline',
        )}</span><br><a href="${esc(o.url)}" style="color:${FOREST};font-size:13px;">Open opportunity</a></td></tr>`,
    )
    .join('')
  const inner = `
    <p>Your ${esc(input.periodLabel)} summary of environmental opportunities relevant to Ellona.</p>
    <table style="width:100%;border-collapse:collapse;">${rows || '<tr><td>No new opportunities this period.</td></tr>'}</table>
    <p>${actionBtn(input.dashboardUrl, 'Open your opportunity watch')}</p>`
  return {
    kind: 'DIGEST',
    senderIdentity: SENDERS.alerts.identity,
    subject: `Your ${input.periodLabel} Ellona opportunity summary`,
    recipient: ELLONA.contactEmail,
    html: shell('Opportunity summary', inner, { withRepresentation: true }),
    dedupKey: `digest:${input.periodLabel}`,
  }
}

export function renderTrialEmail(
  kind: 'MIDPOINT' | 'EXPIRY' | 'TRIAL_SUMMARY',
  input: { dashboardUrl: string; endsLabel: string; daysRemaining: number },
): RenderedEmail {
  const titles: Record<typeof kind, string> = {
    MIDPOINT: 'You are halfway through your trial',
    EXPIRY: 'Your trial is ending',
    TRIAL_SUMMARY: 'Your trial summary',
  } as const
  const bodies: Record<typeof kind, string> = {
    MIDPOINT: `<p>You are halfway through your 14-day trial of the ${esc(
      ELLONA.workspaceName,
    )}. Your trial ends ${esc(input.endsLabel)} (${input.daysRemaining} days remaining).</p>`,
    EXPIRY: `<p>Your 14-day trial of the ${esc(ELLONA.workspaceName)} ends ${esc(
      input.endsLabel,
    )}. After that your workspace becomes read-only until the trial is converted.</p>`,
    TRIAL_SUMMARY: `<p>Here is a summary of your ${esc(ELLONA.workspaceName)} trial.</p>`,
  } as const
  const inner = `${bodies[kind]}<p>${actionBtn(input.dashboardUrl, 'Open your opportunity watch')}</p>`
  return {
    kind,
    senderIdentity: SENDERS.accounts.identity,
    subject: `${titles[kind]} — ${ELLONA.workspaceName}`,
    recipient: ELLONA.contactEmail,
    html: shell(titles[kind], inner, { withRepresentation: true }),
    dedupKey: `${kind.toLowerCase()}`,
  }
}

// ---- Persistence ----------------------------------------------------------

/**
 * Store a rendered email. Deduplicates on (workspaceId, dedupKey) so a repeated
 * alert/digest is not stored twice. Returns the stored row id (or the existing
 * one). NEVER sends.
 */
export async function storeRenderedEmail(workspaceId: string, email: RenderedEmail): Promise<string> {
  if (email.dedupKey) {
    const existing = await prisma.partnerEmail.findUnique({
      where: { workspaceId_dedupKey: { workspaceId, dedupKey: email.dedupKey } },
      select: { id: true },
    })
    if (existing) return existing.id
  }
  const id = randomUUID()
  await prisma.partnerEmail.create({
    data: {
      id,
      workspaceId,
      kind: email.kind,
      senderIdentity: email.senderIdentity,
      subject: email.subject,
      recipient: email.recipient,
      renderedHtml: email.html,
      status: 'RENDERED',
      dedupKey: email.dedupKey,
      sandbox: true,
    },
  })
  return id
}
