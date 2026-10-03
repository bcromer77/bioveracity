import { consumeResetService, AccountRecoveryError, recoveryHeaders, clientIp } from '@/lib/account-recovery/http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let token: unknown
  let password: unknown
  try {
    const body = await req.json()
    token = body?.token
    password = body?.password
  } catch {
    return Response.json({ error: 'This reset link is invalid or has expired' }, { status: 400, headers: recoveryHeaders })
  }

  try {
    const service = consumeResetService()
    await service.consumeReset({ token, newPassword: password, ip: clientIp(req) })
    return Response.json(
      { ok: true, message: 'Your password has been reset. You can now sign in with your new password.' },
      { status: 200, headers: recoveryHeaders },
    )
  } catch (error) {
    if (error instanceof AccountRecoveryError) {
      return Response.json({ error: error.message }, { status: error.status, headers: recoveryHeaders })
    }
    console.error('reset-password failed:', error instanceof Error ? error.name : 'unknown')
    return Response.json({ error: 'Unable to reset password' }, { status: 500, headers: recoveryHeaders })
  }
}
