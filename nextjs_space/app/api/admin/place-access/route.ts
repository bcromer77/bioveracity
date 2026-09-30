import { auth } from '@/auth'
import { placeAccessDb } from '@/lib/place/access-db'
import { handleAccessPointAction } from '@/lib/place/access-operator'
export const dynamic = 'force-dynamic'

// Operator-only: issue or revoke a Place Access Point. See lib/place/access-operator.ts.
export async function POST(request: Request) {
  let body: unknown = null
  try {
    const text = await request.text()
    body = text.length <= 2000 ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const res = await handleAccessPointAction(
    { session: await auth(), db: placeAccessDb },
    { origin: request.headers.get('origin'), requestOrigin: new URL(request.url).origin, body },
  )
  return new Response(res.body, { status: res.status, headers: res.headers })
}
