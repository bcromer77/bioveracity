import { prisma } from '@/lib/prisma'

// The minimal owner notification for a new visitor observation.
//
// Design constraints (deliberately narrow — this must NOT grow into a
// general notification system):
//   * It says only that something is waiting and links to the curator. It never
//     exposes the observation, the photo, the category, the coarse location, or
//     anything a visitor typed. The owner reads those in the curator, gated by
//     their own sign-in.
//   * It is best-effort. It is always called AFTER the contribution has already
//     been committed, and every failure here is swallowed. An email problem can
//     never stop a visitor's observation being stored.

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function notifyOwnerOfNewContribution(hubId: string): Promise<void> {
  try {
    const hub = await prisma.wildHub.findUnique({
      where: { id: hubId },
      select: { profile: true, owner: { select: { email: true } } },
    })
    const ownerEmail = hub?.owner?.email
    if (!ownerEmail) return
    const placeName =
      (hub?.profile as { name?: string } | null)?.name?.trim() || 'your place'

    const appUrl = process.env.NEXTAUTH_URL || 'https://bioveracity.com'
    const hostname = (() => {
      try {
        return new URL(appUrl).hostname
      } catch {
        return 'bioveracity.com'
      }
    })()
    const curatorUrl = `${appUrl.replace(/\/$/, '')}/wild/studio/curate`

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color:#111;">
        <h2 style="color:#111; border-bottom:2px solid #2f6b3a; padding-bottom:10px;">A new observation is waiting</h2>
        <p style="font-size:15px; line-height:1.6;">Someone has added an observation to <strong>${esc(
          placeName,
        )}</strong>. Review it when you have a moment — nothing becomes public until you decide.</p>
        <p style="margin:22px 0;">
          <a href="${esc(
            curatorUrl,
          )}" style="display:inline-block; background:#2f6b3a; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600; font-size:15px;">Review it</a>
        </p>
        <p style="color:#666; font-size:12px;">You are receiving this because you tend this place on BioVeracity. Sent from ${esc(
          hostname,
        )}.</p>
      </div>`

    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_NEW_VISITOR_OBSERVATION,
        subject: `A new observation is waiting at ${placeName}`,
        body: htmlBody,
        is_html: true,
        recipient_email: ownerEmail,
        sender_email: `noreply@${hostname}`,
        sender_alias: 'BioVeracity',
      }),
    })
    const result = await res.json().catch(() => ({}))
    const inner = result?.result ?? result
    const delivered =
      inner?.success === true || inner?.notification_disabled === true
    if (!delivered) {
      console.error(
        'Contribution notification not delivered:',
        inner?.message ?? res.status,
      )
    }
  } catch (err) {
    // Best-effort only. The contribution is already stored.
    console.error('Contribution notification error:', err)
  }
}
