// Content for the password-reset email. Plain, brand-consistent, and free of any
// sensitive material in logs (the caller never logs this body). The raw token is
// only ever present inside the emailed link.

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildResetEmail(input: { resetUrl: string }): { subject: string; html: string; text: string } {
  const { resetUrl } = input
  const subject = 'Reset your BioVeracity password'
  const safeUrl = esc(resetUrl)
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color:#173d35;">
      <h2 style="color:#173d35; border-bottom:2px solid #dfc27a; padding-bottom:10px;">Reset your password</h2>
      <p style="font-size:15px; line-height:1.5;">We received a request to reset the password for your BioVeracity account. Click the button below to choose a new password.</p>
      <p style="margin:24px 0;">
        <a href="${safeUrl}" style="background:#173d35; color:#f7f4ec; text-decoration:none; padding:12px 22px; border-radius:6px; font-weight:bold; display:inline-block;">Reset password</a>
      </p>
      <p style="font-size:14px; line-height:1.5; color:#4b5563;">This link expires in one hour and can be used only once. If you did not request a password reset, you can safely ignore this email &mdash; your password will not change.</p>
      <p style="font-size:13px; color:#6b7280; word-break:break-all;">If the button does not work, paste this link into your browser:<br/>${safeUrl}</p>
    </div>`
  const text = [
    'Reset your BioVeracity password',
    '',
    'We received a request to reset the password for your BioVeracity account.',
    'Open the link below to choose a new password:',
    '',
    resetUrl,
    '',
    'This link expires in one hour and can be used only once.',
    'If you did not request a password reset, you can safely ignore this email.',
  ].join('\n')
  return { subject, html, text }
}
