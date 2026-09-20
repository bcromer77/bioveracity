import { body } from '@/lib/workspaces/request-body'
import { onboardingRequest } from '@/lib/wild-hubs/onboarding-http'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get('page') ?? '0'
  const page = /^\d{1,5}$/.test(value) ? Number(value) : 0
  return onboardingRequest(service => service.list(page))
}
export async function POST(request: Request) {
  return onboardingRequest(async service => service.prepare(await body(request, 180000)))
}
