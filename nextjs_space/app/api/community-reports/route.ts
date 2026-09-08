import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { validateResidentReport } from '@/lib/resident-report'

export async function POST(request: NextRequest) {
  if (process.env.COMMUNITY_REPORTS_ENABLED !== 'true') return NextResponse.json({ error: 'Report intake is not enabled yet.' }, { status: 503 })
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  let data: ReturnType<typeof validateResidentReport>
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 12000) throw new Error('Report too large')
    const text = await request.text()
    if (text.length > 12000) throw new Error('Report too large')
    data = validateResidentReport(JSON.parse(text))
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid report' }, { status: 400 }) }
  try {
    const report = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.user.id}))`
      const existing = await tx.residentSubmission.findUnique({ where: { userId_requestId: { userId: session.user.id, requestId: data.requestId } } })
      if (existing) return existing
      const count = await tx.residentSubmission.count({ where: { userId: session.user.id, receivedAt: { gte: new Date(Date.now() - 86400000) } } })
      if (count >= 10) throw new Error('RATE_LIMIT')
      const asset = await tx.asset.findUnique({ where: { id: data.assetId }, select: { latitude: true, longitude: true } })
      if (!asset || asset.latitude === null || asset.longitude === null) throw new Error('PLACE_UNAVAILABLE')
      return tx.residentSubmission.create({ data: { ...data, userId: session.user.id, status: 'PENDING_VERIFICATION', visibility: 'PRIVATE' } })
    })
    return NextResponse.json({ id: report.id, status: report.status, visibility: report.visibility, receivedAt: report.receivedAt }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    return NextResponse.json({ error: code === 'RATE_LIMIT' ? 'You can submit up to 10 reports per day.' : code === 'PLACE_UNAVAILABLE' ? 'Select an available mapped place.' : 'Your report could not be saved. Please retry.' }, { status: code === 'RATE_LIMIT' ? 429 : code === 'PLACE_UNAVAILABLE' ? 400 : 503 })
  }
}
