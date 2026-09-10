import { privateRequest } from '@/lib/workspaces/http'
import { fetchBatOccurrencesNear, fetchPlanningApplicationsNear } from '@/lib/ingest/connectors-ireland'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Read-only retrieval of PUBLIC records (bat occurrences from GBIF + planning
// applications from the national ArcGIS layer) to display on the investigation
// map. It NEVER writes to the database and NEVER touches private case evidence:
// membership is verified with getCase (throws 404 for non-members), then the
// two keyless upstreams are queried server-side. The retrieved records are
// returned separately from private evidence and are never auto-accepted or
// written into an audit export.
export async function GET(request: Request, context: { params: Promise<{ workspaceId: string; caseId: string }> }) {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const radiusParam = Number(url.searchParams.get('radius'))
  const radiusKm = Number.isFinite(radiusParam) && radiusParam > 0 && radiusParam <= 50 ? radiusParam : 20

  return privateRequest(async s => {
    const { workspaceId, caseId } = await context.params
    // Enforce case membership before returning anything (throws 404 if not a member).
    await s.getCase(workspaceId, caseId)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { species: null, planning: null, error: 'A valid location is required to retrieve public records.' }
    }
    const [species, planning] = await Promise.all([
      fetchBatOccurrencesNear({ lat, lng, radiusKm }),
      fetchPlanningApplicationsNear({ lat, lng, radiusKm }),
    ])
    return { species, planning, radiusKm }
  })
}
