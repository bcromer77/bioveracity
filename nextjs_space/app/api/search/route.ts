export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { searchPlaces } from '@/lib/search'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''
    const limit = Number(searchParams.get('limit') ?? '8') || 8
    const results = await searchPlaces(q, limit)
    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Search failed', results: [] }, { status: 500 })
  }
}
