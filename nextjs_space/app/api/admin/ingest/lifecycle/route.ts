export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { computeNormalisation, commitNormalisation, CANDIDATE_SELECT, type NormalisationTarget } from '@/lib/ingest/normalise'
import { rollupRawIngestStatus } from '@/lib/ingest/lifecycle'

// ==========================================================================
// §L/§O — Human-review lifecycle actions for observation candidates.
//
// Admin-only. Moves a single candidate through the reviewed part of the
// pipeline: verify → normalise → publish, or reject. Publishing is the ONLY
// step that writes a public canonical record; everything before it is internal.
// ==========================================================================

type Action = 'verify' | 'reject' | 'normalise' | 'publish'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 })
  }

  const candidateId: string | undefined = body?.candidateId
  const action: Action | undefined = body?.action
  const reason: string | undefined = typeof body?.reason === 'string' ? body.reason : undefined
  if (!candidateId || !action) {
    return NextResponse.json({ error: 'candidateId and action are required' }, { status: 400 })
  }

  const reviewer = (session.user as any).email ?? (session.user as any).name ?? 'admin'
  const now = new Date()

  const candidate = await prisma.observationCandidate.findUnique({
    where: { id: candidateId },
    select: { ...CANDIDATE_SELECT, status: true, rawIngestId: true, normalisedTargetType: true, normalisedPayload: true, normalisedRecordId: true },
  })
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  try {
    if (action === 'verify') {
      if (!['CANDIDATE', 'NEEDS_REVIEW'].includes(candidate.status)) {
        return NextResponse.json({ error: `Cannot verify a candidate in state ${candidate.status}.` }, { status: 409 })
      }
      await prisma.observationCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'VERIFIED',
          verificationMethod: 'HUMAN_REVIEW',
          verificationNote: reason ?? 'Verified by human reviewer.',
          reviewedBy: reviewer,
          verifiedAt: now,
          rejectedAt: null,
          rejectionReason: null,
        },
      })
    } else if (action === 'reject') {
      if (candidate.status === 'PUBLISHED') {
        return NextResponse.json({ error: 'Cannot reject an already-published candidate.' }, { status: 409 })
      }
      await prisma.observationCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewer,
          rejectedAt: now,
          rejectionReason: reason ?? 'Rejected by human reviewer.',
        },
      })
    } else if (action === 'normalise') {
      if (candidate.status !== 'VERIFIED') {
        return NextResponse.json({ error: `Only VERIFIED candidates can be normalised (state is ${candidate.status}).` }, { status: 409 })
      }
      const plan = computeNormalisation(candidate as any)
      if (!plan.ok || !plan.target || !plan.payload) {
        return NextResponse.json({ error: plan.reason ?? 'Normalisation could not be computed.' }, { status: 422 })
      }
      await prisma.observationCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'NORMALISED',
          normalisedTargetType: plan.target,
          normalisedPayload: plan.payload as any,
          normalisedAt: now,
          reviewedBy: reviewer,
        },
      })
    } else if (action === 'publish') {
      if (candidate.status !== 'NORMALISED') {
        return NextResponse.json({ error: `Only NORMALISED candidates can be published (state is ${candidate.status}).` }, { status: 409 })
      }
      if (candidate.normalisedRecordId) {
        return NextResponse.json({ error: 'Candidate has already been published.' }, { status: 409 })
      }
      if (!candidate.normalisedTargetType || !candidate.normalisedPayload) {
        return NextResponse.json({ error: 'No normalised payload to publish. Normalise the candidate first.' }, { status: 422 })
      }
      const { recordType, recordId } = await commitNormalisation(
        candidate.normalisedTargetType as NormalisationTarget,
        candidate.normalisedPayload as Record<string, any>,
      )
      await prisma.observationCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'PUBLISHED',
          normalisedRecordType: recordType,
          normalisedRecordId: recordId,
          lifecyclePublishedAt: now,
          reviewedBy: reviewer,
        },
      })
    } else {
      return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Action failed: ${String(e?.message ?? e).slice(0, 500)}` }, { status: 500 })
  }

  const rawStatus = await rollupRawIngestStatus(candidate.rawIngestId)
  const updated = await prisma.observationCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      status: true,
      verificationMethod: true,
      normalisedTargetType: true,
      normalisedRecordType: true,
      normalisedRecordId: true,
      rejectionReason: true,
    },
  })

  return NextResponse.json({ success: true, candidate: updated, rawIngestStatus: rawStatus })
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 })
}
