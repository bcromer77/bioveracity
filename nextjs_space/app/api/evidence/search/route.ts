import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isRegistered } from '@/lib/access'
import { evidenceEnabled } from '@/lib/evidence-http'
import { searchReviewedEvidence } from '@/lib/evidence-search'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const session = await auth()
  if (!isRegistered(session) || !session?.user?.id) return NextResponse.json({ error: 'Sign in to search evidence' }, { status: 401, headers })
  if (!evidenceEnabled()) return NextResponse.json({ error: 'Evidence search is not enabled' }, { status: 503, headers })
  const p = new URL(request.url).searchParams
  try {
    return NextResponse.json(await searchReviewedEvidence(session, {
      q: p.get('q') ?? '', authority: p.get('authority') ?? '', from: p.get('from') ?? '', to: p.get('to') ?? '',
      mode: p.get('mode') ?? 'hybrid', sort: p.get('sort') ?? 'relevance',
    }), { headers })
  } catch {
    return NextResponse.json({ error: 'Search could not complete. Check the filters or try again.' }, { status: 422, headers })
  }
}
