export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

import { notifyFounder } from '@/lib/lead-notification'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, organisation, role, assetName, issue, disputed, decisionMatters, orgsInvolved } = body ?? {}
    if (!name || !email || !issue) {
      return NextResponse.json({ error: 'Name, email and issue are required' }, { status: 400 })
    }
    const session = await auth()
    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        organisation: organisation ?? null,
        role: role ?? null,
        assetName: assetName ?? null,
        issue,
        disputed: disputed ?? null,
        decisionMatters: decisionMatters ?? null,
        orgsInvolved: orgsInvolved ?? null,
        userId: session?.user?.id ?? null,
      },
    })

    // Send the enquiry through to the founder (non-blocking on failure).
    await notifyFounder({ name, email, organisation, role, assetName, issue, disputed, decisionMatters, orgsInvolved })

    return NextResponse.json({ id: lead?.id })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to submit lead' }, { status: 500 })
  }
}
