const ENQUIRY_RECIPIENT = 'bazil.cromer@ripplexn.com'

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Email the enquiry through to the BioVeracity founder. Never let an email
// failure break the enquiry submission itself.
export async function notifyFounder(lead: {
  name: string
  email: string
  organisation?: string | null
  role?: string | null
  assetName?: string | null
  issue: string
  disputed?: string | null
  decisionMatters?: string | null
  orgsInvolved?: string | null
}) {
  try {
    const appUrl = process.env.NEXTAUTH_URL || ''
    const hostname = appUrl ? new URL(appUrl).hostname : 'bioveracity.com'
    const rows: Array<[string, string | null | undefined]> = [
      ['Name', lead.name],
      ['Email', lead.email],
      ['Organisation', lead.organisation],
      ['Role', lead.role],
      ['Place / asset', lead.assetName],
      ['What is disputed', lead.disputed],
      ['Why the decision matters', lead.decisionMatters],
      ['Organisations involved', lead.orgsInvolved],
    ]
    const detailRows = rows
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(
        ([k, v]) =>
          `<p style="margin:8px 0"><strong>${esc(k)}:</strong> ${
            k === 'Email' ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : esc(v)
          }</p>`,
      )
      .join('')

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#111; border-bottom:2px solid #e6b800; padding-bottom:10px;">New BioVeracity enquiry</h2>
        <div style="background:#f9fafb; padding:20px; border-radius:8px; margin:16px 0;">
          ${detailRows}
          <p style="margin:12px 0 6px"><strong>Message:</strong></p>
          <div style="background:#fff; padding:15px; border-radius:4px; border-left:4px solid #e6b800; white-space:pre-wrap;">${esc(
            lead.issue,
          )}</div>
        </div>
        <p style="color:#666; font-size:12px;">Sent from ${esc(hostname)}</p>
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
        notification_id: process.env.NOTIF_ID_CONTACT_ENQUIRY_SUBMISSION,
        subject: `New BioVeracity enquiry from ${lead.name}`,
        body: htmlBody,
        is_html: true,
        recipient_email: ENQUIRY_RECIPIENT,
        reply_to: lead.email,
        sender_email: `noreply@${hostname}`,
        sender_alias: 'BioVeracity',
      }),
    })
    const result = await res.json().catch(() => ({}))
    // The service wraps delivery status in a nested `result` object; inspect both
    // levels so a throttled/failed send is surfaced instead of silently swallowed.
    const inner = result?.result ?? result
    const delivered = inner?.success === true || inner?.notification_disabled === true
    if (!delivered) {
      console.error('Enquiry notification not delivered:', inner?.message ?? res.status)
    }
  } catch (err) {
    console.error('Enquiry notification error:', err)
  }
}
