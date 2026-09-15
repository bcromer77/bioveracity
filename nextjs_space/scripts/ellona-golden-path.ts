// Golden-path SETUP for the Ellona Opportunity Watch launch checkpoint.
//
// This does the parts of the observable golden path that happen OUTSIDE the
// browser, using only the real product libraries (no shortcuts):
//   1. Creates a single-use activation invitation for Natalia and prints the
//      raw activation URL so the browser e2e can complete activation. The raw
//      token is never persisted (only its hash is).
//   2. Renders the activation email and stores it as a sandbox PartnerEmail
//      (RENDERED, never sent).
//   3. Renders an opportunity ALERT email for the flagship EPA opportunity and
//      stores it as a sandbox PartnerEmail.
//   4. Writes both rendered emails to the ELLONA_OUT_DIR directory for review.
//      Set ELLONA_OUT_DIR to an absolute path when running (dev-only tool).
//
// It is idempotent enough to re-run: emails dedup on (workspaceId, dedupKey);
// a fresh invitation is created each run (old ones simply expire / are single-use).

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { ELLONA } from '../lib/ellona/config'
import { createInvitation } from '../lib/ellona/invitation'
import {
  renderActivationEmail,
  renderAlertEmail,
  storeRenderedEmail,
  type OpportunityLine,
} from '../lib/ellona/email-render'
import { formatDublin } from '../lib/ellona/trial'

const OUT = process.env.ELLONA_OUT_DIR || path.join(process.cwd(), '.ellona-out')
const BASE = process.env.NEXTAUTH_URL || 'http://localhost:3000'

async function main() {
  mkdirSync(OUT, { recursive: true })

  const tenant = await prisma.partnerTenant.findUnique({ where: { contactEmail: ELLONA.contactEmail } })
  if (!tenant) throw new Error('Ellona tenant not found. Run scripts/seed-ellona.ts first.')
  const workspaceId = tenant.workspaceId

  // 1) Activation invitation (raw token returned once).
  const { token, expiresAt } = await createInvitation(workspaceId, ELLONA.contactEmail, 'ACTIVATION')
  const activationUrl = `${BASE}/ellona/activate?token=${token}`

  // 2) Activation email (sandbox render + store).
  const activation = renderActivationEmail({
    activationUrl,
    expiresLabel: formatDublin(expiresAt, true),
  })
  const activationId = await storeRenderedEmail(workspaceId, activation)
  writeFileSync(`${OUT}/activation-email.html`, activation.html)

  // 3) Alert email for the flagship EPA opportunity.
  const epa = await prisma.opportunity.findFirst({ where: { workspaceId, id: 'ellona-seed-epa-air' } })
  let alertId = 'skipped'
  if (epa) {
    const line: OpportunityLine = {
      buyer: epa.buyer,
      title: epa.title,
      measurementNeed: epa.measurementNeed ?? null,
      deadline: epa.tenderDeadline ?? null,
      url: `${BASE}/ellona/opportunity/${epa.id}`,
      classification: epa.classification,
    }
    const alert = renderAlertEmail(line)
    alertId = await storeRenderedEmail(workspaceId, alert)
    writeFileSync(`${OUT}/alert-email.html`, alert.html)
  }

  // Write the activation URL to a file for the e2e step (contains a secret token,
  // so it stays on the local machine only and is never committed).
  writeFileSync(`${OUT}/activation-url.txt`, activationUrl + '\n')

  console.log(JSON.stringify({
    workspaceId,
    activationEmailId: activationId,
    alertEmailId: alertId,
    activationExpiresAt: expiresAt.toISOString(),
    wroteActivationUrlTo: `${OUT}/activation-url.txt`,
    epaFound: !!epa,
  }, null, 2))
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
