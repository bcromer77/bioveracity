import { auth } from '@/auth'
import { enabled, hubDb, privateHeaders } from './http'
import { HubError } from './domain'
import { WorkspaceError } from '../workspaces/service'
import { contributionService, ownerContributionService } from './contributions'

function fail(e: unknown) {
  const known = e instanceof HubError || e instanceof WorkspaceError
  const conflict = (e as { code?: string })?.code === 'P2034'
  return Response.json(
    {
      error: known
        ? e.message
        : conflict
          ? 'This place changed. Reload and try again.'
          : 'Unable to complete this just now. Please try again.',
    },
    {
      status: known ? e.status : conflict ? 409 : 503,
      headers: privateHeaders,
    },
  )
}

// Public contribution endpoints. Deliberately UNAUTHENTICATED — anyone who can
// reach the place (via its plaque/QR) may take part — but always flag-gated.
export async function contributeRequest(
  operation: (s: ReturnType<typeof contributionService>) => Promise<Response | unknown>,
  status = 200,
) {
  try {
    if (!enabled()) throw new HubError(503, 'This place is not open for contributions yet.')
    const result = await operation(contributionService(hubDb))
    return result instanceof Response
      ? result
      : Response.json(result, { status, headers: privateHeaders })
  } catch (e) {
    return fail(e)
  }
}

// Owner (curator) contribution endpoints. Flag-gated AND authenticated;
// ownership of the hub is enforced inside ownerContributionService.
export async function ownerContribRequest(
  operation: (s: ReturnType<typeof ownerContributionService>) => Promise<Response | unknown>,
  status = 200,
) {
  try {
    if (!enabled()) throw new HubError(503, 'Ecology hubs are not enabled.')
    const session = await auth()
    if (!session?.user?.id) throw new HubError(401, 'Please sign in.')
    const result = await operation(ownerContributionService(hubDb, session.user.id))
    return result instanceof Response
      ? result
      : Response.json(result, { status, headers: privateHeaders })
  } catch (e) {
    return fail(e)
  }
}
