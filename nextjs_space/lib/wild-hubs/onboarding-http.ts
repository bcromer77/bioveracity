import { auth } from '@/auth'
import { enabled, hubDb, privateHeaders } from './http'
import { venueOnboardingService } from './onboarding'
import { HubError } from './domain'
import { WorkspaceError } from '../workspaces/service'
export async function onboardingRequest(operation: (service: ReturnType<typeof venueOnboardingService>) => Promise<unknown>) {
  try {
    if (!enabled()) throw new HubError(503, 'Venue setup is not available yet. Please contact BioVeracity.')
    const session = await auth()
    if (!session?.user?.id) throw new HubError(401, 'Please sign in.')
    return Response.json(await operation(venueOnboardingService(hubDb, session.user.id)), { headers: privateHeaders })
  } catch (error) {
    const known = error instanceof HubError || error instanceof WorkspaceError
    const conflict = (error as { code?: string })?.code === 'P2034'
    return Response.json({ error: known ? error.message : conflict ? 'This setup changed. Reload and try again.' : 'Venue setup is temporarily unavailable. No page has been published.' },
      { status: known ? error.status : conflict ? 409 : 503, headers: privateHeaders })
  }
}
