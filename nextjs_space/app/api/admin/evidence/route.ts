import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdmin } from '@/lib/access'
import { boundedJson, evidenceEnabled } from '@/lib/evidence-http'
import { reviewEvidence, withdrawEvidence } from '@/lib/evidence-store'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  if (!evidenceEnabled()) return NextResponse.json({ error: 'Evidence review is not enabled' }, { status: 503 })
  const session = await auth()
  if (!isAdmin(session)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
  if (!session?.user?.email) return NextResponse.json({ error: 'Identified reviewer required' }, { status: 403 })
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Same-origin review required' }, { status: 403 })
  try {
    const body = await boundedJson(request, 12000)
    if (typeof body.id !== 'string' || body.id.length > 100) throw new Error('Invalid ID')
    if (body.action === 'withdraw') return NextResponse.json(await withdrawEvidence(body.id, session.user.email, typeof body.reason === 'string' ? body.reason : ''))
    return NextResponse.json(await reviewEvidence(body.id, body, session.user.email))
  } catch {
    return NextResponse.json({ error: 'Review not accepted. Check the source excerpt, confirmations and latest version.' }, { status: 422 })
  }
}
