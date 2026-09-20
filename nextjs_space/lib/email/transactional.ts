// Transactional email boundary. Supports two providers, selected EXPLICITLY by
// TRANSACTIONAL_EMAIL_PROVIDER with no silent fallback:
//   - 'resend'  : preferred production sender (Resend HTTP API)
//   - 'abacus'  : Abacus.AI notification service (used elsewhere in the app)
// Provider errors and account existence must never leak to the browser; callers
// treat any thrown error as an internal condition and return a generic response.
//
// Implemented with plain fetch so no new dependency (and no lockfile change) is
// required. Never logs recipient addresses, message bodies or provider secrets.

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigError'
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

export type ResendConfig = {
  provider: 'resend'
  from: string
  apiKey: string
}

export type AbacusConfig = {
  provider: 'abacus'
  from: string
  apiKey: string
  appId: string
  notificationId: string
}

export type EmailConfig = ResendConfig | AbacusConfig

type EnvLike = Record<string, string | undefined>

export function parseFrom(from: string): { email: string; name?: string } {
  const match = /^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/.exec(from)
  if (match) {
    const name = match[1]?.trim()
    return { email: match[2].trim(), name: name ? name.replace(/^"|"$/g, '') : undefined }
  }
  return { email: from.trim() }
}

export function resolveEmailConfig(env: EnvLike): EmailConfig {
  const provider = env.TRANSACTIONAL_EMAIL_PROVIDER
  const from = env.TRANSACTIONAL_EMAIL_FROM
  if (!provider) {
    throw new EmailConfigError('TRANSACTIONAL_EMAIL_PROVIDER is not configured')
  }
  if (!from) {
    throw new EmailConfigError('TRANSACTIONAL_EMAIL_FROM is not configured')
  }
  if (provider === 'resend') {
    const apiKey = env.RESEND_API_KEY
    if (!apiKey) throw new EmailConfigError('RESEND_API_KEY is not configured')
    return { provider: 'resend', from, apiKey }
  }
  if (provider === 'abacus') {
    const apiKey = env.ABACUSAI_API_KEY
    const appId = env.WEB_APP_ID
    const notificationId = env.NOTIF_ID_TRANSACTIONAL_EMAIL
    if (!apiKey) throw new EmailConfigError('ABACUSAI_API_KEY is not configured')
    if (!appId) throw new EmailConfigError('WEB_APP_ID is not configured')
    if (!notificationId) throw new EmailConfigError('NOTIF_ID_TRANSACTIONAL_EMAIL is not configured')
    return { provider: 'abacus', from, apiKey, appId, notificationId }
  }
  throw new EmailConfigError(`Unknown TRANSACTIONAL_EMAIL_PROVIDER: ${provider}`)
}

type FetchLike = typeof fetch

export function createEmailer(config: EmailConfig, fetchImpl: FetchLike = fetch) {
  async function send(message: EmailMessage): Promise<void> {
    if (config.provider === 'resend') {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          from: config.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      })
      if (!res.ok) {
        // Do not surface provider response bodies (may echo the recipient).
        throw new EmailDeliveryError(`Resend delivery failed with status ${res.status}`)
      }
      return
    }

    const sender = parseFrom(config.from)
    const res = await fetchImpl('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        app_id: config.appId,
        notification_id: config.notificationId,
        subject: message.subject,
        body: message.html,
        is_html: true,
        recipient_email: message.to,
        sender_email: sender.email,
        sender_alias: sender.name ?? 'BioVeracity',
      }),
    })
    if (!res.ok) {
      throw new EmailDeliveryError(`Abacus delivery failed with status ${res.status}`)
    }
    const result = await res.json().catch(() => ({} as any))
    const inner = result?.result ?? result
    const delivered = inner?.success === true || inner?.notification_disabled === true
    if (!delivered) {
      throw new EmailDeliveryError('Abacus delivery was not confirmed')
    }
  }

  return { send }
}
