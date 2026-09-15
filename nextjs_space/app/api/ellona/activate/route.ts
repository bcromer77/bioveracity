// Public activation endpoint: exchange a single-use invitation token for a set
// password. No session is required (the caller is not yet activated), but the
// token itself is the credential. The password is never returned or logged.

import { consumeAndSetPassword } from '@/lib/ellona/invitation'
import { ellonaEnabled } from '@/lib/ellona/config'
import { jsonError, privateHeaders } from '@/lib/ellona/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!ellonaEnabled()) return jsonError(404, 'Not found')
  let body: any = null
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'Expected a JSON body.')
  }
  const token = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!token) return jsonError(400, 'A valid activation link is required.')

  const result = await consumeAndSetPassword(token, password)
  if (!result.ok) return jsonError(result.status, result.message)
  // Return the email so the client can pre-fill the sign-in form. No secret.
  return Response.json({ ok: true, email: result.email }, { headers: privateHeaders })
}
