// Authenticated hand-off from the existing evidence intake into the shared,
// versioned opportunity substrate. The caller cannot select workspaces: the
// server evaluates every enabled monitoring profile and creates references.

import { NextResponse } from 'next/server'
import { boundedJson, evidenceEnabled, validIngestKey } from '@/lib/evidence-http'
import { ellonaEnabled } from '@/lib/ellona/config'
import { parseCanonicalOpportunityInput, routeCanonicalOpportunity } from '@/lib/ellona/routing'

export const dynamic = 'force-dynamic'

function routingEnabled() {
  return process.env.OPPORTUNITY_ROUTING_ENABLED === 'true' || ellonaEnabled()
}

export async function POST(request: Request) {
  if (!routingEnabled() || !evidenceEnabled()) {
    return NextResponse.json({ error: 'Opportunity evidence routing is not enabled' }, { status: 503 })
  }
  if (!validIngestKey(request.headers.get('x-bioveracity-evidence-key'))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const input = parseCanonicalOpportunityInput(await boundedJson(request, 100_000))
    if (!input.evidenceDocumentId) throw new Error('A verified evidence document is required.')
    const result = await routeCanonicalOpportunity(input)
    return NextResponse.json({
      canonicalId: result.canonicalId,
      versionId: result.versionId,
      duplicate: result.duplicate,
      routedWorkspaceCount: result.routedWorkspaceIds.length,
      sandboxNotificationCount: result.notificationIds.length,
    }, { status: result.duplicate ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Opportunity record not accepted; check verification, source support and schema.' }, { status: 422 })
  }
}
