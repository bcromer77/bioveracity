export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// Follow a place (optionally with a reason). Requires an authenticated user.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You need an account to follow a place.' }, { status: 401 })
    }
    const { assetId, reason } = await request.json()
    if (!assetId) {
      return NextResponse.json({ error: 'Asset is required' }, { status: 400 })
    }

    const existing = await prisma.watchlist.findFirst({
      where: { userId: session.user.id, assetId },
    })

    if (existing) {
      const updated = await prisma.watchlist.update({
        where: { id: existing.id },
        data: { reason: reason ?? existing.reason },
      })
      return NextResponse.json({ id: updated.id, following: true })
    }

    const watchlist = await prisma.watchlist.create({
      data: {
        assetId,
        userId: session.user.id,
        email: session.user.email ?? null,
        reason: reason ?? null,
      },
    })
    return NextResponse.json({ id: watchlist.id, following: true })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to follow this place' }, { status: 500 })
  }
}

// Update the reason ("why this place matters to you") for a followed place.
export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { assetId, reason, alertTypes } = await request.json()
    if (!assetId) {
      return NextResponse.json({ error: 'Asset is required' }, { status: 400 })
    }
    const existing = await prisma.watchlist.findFirst({
      where: { userId: session.user.id, assetId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not following this place' }, { status: 404 })
    }
    const updated = await prisma.watchlist.update({
      where: { id: existing.id },
      data: {
        reason: reason ?? null,
        ...(typeof alertTypes === 'string' && alertTypes ? { alertTypes } : {}),
      },
    })
    return NextResponse.json({ id: updated.id, reason: updated.reason })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

// Unfollow a place.
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')
    if (!assetId) {
      return NextResponse.json({ error: 'Asset is required' }, { status: 400 })
    }
    await prisma.watchlist.deleteMany({
      where: { userId: session.user.id, assetId },
    })
    return NextResponse.json({ following: false })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 })
  }
}
