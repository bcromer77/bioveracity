import { body } from '@/lib/workspaces/request-body'
import { onboardingRequest } from '@/lib/wild-hubs/onboarding-http'
import { HubError, record } from '@/lib/wild-hubs/domain'
import { publicWildOrigin } from '@/lib/wild-counties/venues'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return onboardingRequest(async service => {
    const input = record(await body(request))
    const origin = input.action === 'issue' ? publicWildOrigin() : null
    if (input.action === 'issue' && !origin) throw new HubError(503, 'Configure the public site address before preparing setup links.')
    const result = await service.change((await context.params).id, input)
    return result.path ? { url: `${origin}${result.path}`, expiresAt: result.expiresAt } : result
  })
}
