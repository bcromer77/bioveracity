import { authReturnPath } from '@/lib/auth-return-path'
import { requestResetService, AccountRecoveryError, recoveryHeaders, clientIp } from '@/lib/account-recovery/http'

// This route reads runtime env (email provider, base URL); never prerender it.
export const dynamic = 'force-dynamic'

// Identical public response for known and unknown accounts, so account existence
// is never revealed. Only malformed input (400) and rate limiting (429) differ.
const GENERIC_MESSAGE =
  'If an account exists for that email address, we will attempt to send a password reset link.'

export async function POST(req: Request) {
  let email: unknown
  let callbackUrl = '/start'
  try {
    const body = await req.json()
    email = body?.email
    callbackUrl = authReturnPath(typeof body?.callbackUrl === 'string' ? body.callbackUrl : null)
  } catch {
    return Response.json({ error: 'A valid email address is required' }, { status: 400, headers: recoveryHeaders })
  }

  try {
    const service = requestResetService(callbackUrl)
    await service.requestReset({ email, ip: clientIp(req) })
    return Response.json({ ok: true, message: GENERIC_MESSAGE }, { status: 200, headers: recoveryHeaders })
  } catch (error) {
    if (error instanceof AccountRecoveryError) {
      // 400 (malformed email) and 429 (rate limited) are safe to surface; they do
      // not reveal whether an account exists.
      return Response.json({ error: error.message }, { status: error.status, headers: recoveryHeaders })
    }
    console.error('forgot-password failed:', error instanceof Error ? error.name : 'unknown')
    // Never leak internal errors or account existence.
    return Response.json({ ok: true, message: GENERIC_MESSAGE }, { status: 200, headers: recoveryHeaders })
  }
}
