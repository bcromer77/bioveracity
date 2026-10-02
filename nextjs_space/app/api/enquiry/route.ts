import { createEmailer, resolveEmailConfig } from '@/lib/email/transactional'
import { ENQUIRY_LIMITS } from '@/lib/enquiry/config'
import {
  EnquiryValidationError, buildEnquiryEmail, checkRateLimit, claim, enquiryRecipient, enquiryStore, parseEnquiry, settle,
} from '@/lib/enquiry/server'

export const dynamic = 'force-dynamic'

// Generic responses only: never echo the recipient, provider errors or the enquiry body.
const OK = () => Response.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
const FAIL = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } })
const UNAVAILABLE = 'We could not send your enquiry just now. Please try again later.'

// Same trust rule as account recovery: forwarded IPs are used only when the host is
// confirmed to replace client-supplied headers; otherwise one shared, wider bucket.
function clientIp(request: Request): string | null {
  if (process.env.AUTH_TRUST_PROXY_IP !== 'true') return null
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) || 'unknown'
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return FAIL(415, 'Please send the enquiry form.')
  let body: unknown
  try {
    const reader = request.body?.getReader()
    let raw = ''
    let size = 0
    const decoder = new TextDecoder()
    if (reader) {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > ENQUIRY_LIMITS.body) { await reader.cancel(); return FAIL(413, 'Your enquiry is too long.') }
        raw += decoder.decode(value, { stream: true })
      }
      raw += decoder.decode()
    }
    body = JSON.parse(raw)
  } catch {
    return FAIL(400, 'Please check the enquiry details.')
  }

  let parsed: ReturnType<typeof parseEnquiry>
  try {
    parsed = parseEnquiry(body)
  } catch (e) {
    return FAIL(400, e instanceof EnquiryValidationError ? `${e.message}.` : 'Please check the enquiry details.')
  }
  // Honeypot hit: indistinguishable success, nothing sent.
  if (parsed.spam) return OK()
  const enquiry = parsed.enquiry
  const store = enquiryStore()

  const state = claim(store, enquiry)
  if (state === 'duplicate') return OK()
  if (state === 'conflict') return FAIL(409, 'Please refresh the page before sending a different enquiry.')
  if (state === 'inflight') return FAIL(409, 'Your enquiry is already being sent.')

  let delivered = false
  try {
    if (!checkRateLimit(store, clientIp(request), enquiry.email)) return FAIL(429, 'Please wait a little before sending another enquiry.')
    const recipient = enquiryRecipient(process.env)
    if (!recipient) {
      console.error('[enquiry] not sent: recipient is not configured')
      return FAIL(503, UNAVAILABLE)
    }
    let emailer: ReturnType<typeof createEmailer>
    try {
      emailer = createEmailer(resolveEmailConfig(process.env))
    } catch {
      console.error('[enquiry] not sent: email delivery is not configured')
      return FAIL(503, UNAVAILABLE)
    }
    const message = buildEnquiryEmail(enquiry)
    try {
      const result = await emailer.sendWithId({ to: recipient, replyTo: enquiry.email, ...message })
      delivered = true
      // Context and provider id only — no names, addresses or message text.
      console.info(`[enquiry] delivered source=${enquiry.source} cta=${enquiry.cta ?? 'none'} ref=${enquiry.requestId} provider_id=${result.id ?? 'n/a'}`)
      return OK()
    } catch (e) {
      console.error(`[enquiry] delivery failed source=${enquiry.source} ref=${enquiry.requestId} (${e instanceof Error ? e.name : 'error'})`)
      return FAIL(503, UNAVAILABLE)
    }
  } finally {
    settle(store, enquiry, delivered)
  }
}
