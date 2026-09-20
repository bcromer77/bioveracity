import { body } from '@/lib/workspaces/request-body'
import { onboardingRequest } from '@/lib/wild-hubs/onboarding-http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  return onboardingRequest(async service => service.claim(await body(request, 2000)))
}
