import { auth } from '@/auth'
import { enabled, hubDb, privateHeaders } from './http'
import { reviewService } from './review'
import { HubError } from './domain'
import { WorkspaceError } from '../workspaces/service'
export async function reviewRequest(operation: (s: ReturnType<typeof reviewService>) => Promise<Response | unknown>) {
  try {
    if (!enabled()) throw new HubError(503, 'Ecology hubs are not enabled.')
    const session = await auth()
    if (!session?.user?.id) throw new HubError(401, 'Please sign in.')
    const result = await operation(reviewService(hubDb, session.user.id))
    return result instanceof Response ? result : Response.json(result, { headers: privateHeaders })
  } catch (e) {
    const known = e instanceof HubError || e instanceof WorkspaceError
    const conflict = (e as { code?: string })?.code === 'P2034'
    return Response.json({ error: known ? e.message : conflict ? 'This submission changed. Reload and try again.' : 'Review temporarily unavailable.' },
      { status: known ? e.status : conflict ? 409 : 503, headers: privateHeaders })
  }
}
