import { getWildCounty } from '@/lib/wild-counties/counties'
import { fetchCountyNature, type CountyNatureResult } from '@/lib/wild-counties/api-nature'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// At most 32 accepted county keys, one in-flight request per county in this process.
// Cache the entire response so the displayed check time belongs to the actual fetch.
const cache = new Map<string, { expires: number; data: CountyNatureResult }>()
const pending = new Map<string, Promise<CountyNatureResult>>()
export async function GET(_: Request, context: { params: Promise<{ county: string }> }) {
 const { county } = await context.params
 if (!getWildCounty(county)) return Response.json({ error: 'Unknown county' }, { status: 404 })
 const saved = cache.get(county)
 if (saved && saved.expires > Date.now()) return Response.json(saved.data, { headers: { 'Cache-Control': 'no-store' } })
 let request = pending.get(county)
 if (!request) {
  request = fetchCountyNature(county).then(data => {
   cache.set(county, { data, expires: Date.now() + (data.status === 'unavailable' ? 30000 : 900000) })
   return data
  }).finally(() => { pending.delete(county) })
  pending.set(county, request)
 }
 return Response.json(await request, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
