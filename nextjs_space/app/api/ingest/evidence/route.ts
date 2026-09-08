import { NextResponse } from 'next/server'
import { receiveEvidence } from '@/lib/evidence-store'
import { boundedJson, evidenceEnabled, validIngestKey } from '@/lib/evidence-http'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  if (!evidenceEnabled()) return NextResponse.json({ error: 'Evidence intake is not enabled' }, { status: 503 })
  if (!validIngestKey(request.headers.get('x-bioveracity-evidence-key'))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const result = await receiveEvidence(await boundedJson(request))
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
  } catch {
    // Database failures must not leak credentials, SQL, or submitted content.
    return NextResponse.json({ error: 'Record not accepted; check schema and service health' }, { status: 422 })
  }
}
