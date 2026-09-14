import { body, privateRequest } from '@/lib/workspaces/http'
import { WorkspaceError } from '@/lib/workspaces/service'
import { authorisedHoneycombSearch, HoneycombInputError } from '@/lib/honeycomb/search'
import { runHoneycombSearch } from '@/lib/honeycomb/providers'
import { withHoneycombSlot, HoneycombBusy } from '@/lib/honeycomb/limits'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; caseId: string }> }
) {
  return privateRequest(async (service) => {
    const { workspaceId, caseId } = await context.params
    try {
      return await authorisedHoneycombSearch(
        service,
        workspaceId,
        caseId,
        () => body(request, 4096),
        (query) => withHoneycombSlot(caseId, () => runHoneycombSearch(query, { signal: request.signal }))
      )
    } catch (error) {
      if (error instanceof HoneycombInputError) throw new WorkspaceError(400, error.message)
      if (error instanceof HoneycombBusy) throw new WorkspaceError(429, error.message)
      throw error
    }
  })
}
