import { NextRequest, NextResponse } from 'next/server'
import { fetchRainfall, rainfallRequest, type RainResult } from '@/lib/station-rainfall'

// Public OGL station data only. Fixed upstream host/station allowlist, bounded dates,
// a bounded cache and one upstream request in flight per process (EA fair-use advice).
export const runtime = 'nodejs'
const cache = new Map<string, { expires: number; result: RainResult }>()
let busy = false
export async function GET(request: NextRequest) {
  let query: ReturnType<typeof rainfallRequest>
  try {
    const p = request.nextUrl.searchParams
    query = rainfallRequest(p.get('station') ?? '', p.get('date') ?? '', Number(p.get('days') ?? '7'))
  } catch { return NextResponse.json({ error: 'Choose a supported station, valid date and 1, 7 or 30 days.' }, { status: 400 }) }
  const cached = cache.get(query.url)
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.result)
  if (busy) return NextResponse.json({ error: 'A rainfall request is already running. Please retry shortly.' }, { status: 429, headers: { 'Retry-After': '5' } })
  busy = true
  try {
    const result = await fetchRainfall(query)
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(query.url, { expires: Date.now() + 3600000, result })
    return NextResponse.json(result)
  } catch { return NextResponse.json({ error: 'Rainfall could not be retrieved or validated. No values have been substituted.' }, { status: 502 }) }
  finally { busy = false }
}
