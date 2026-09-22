import { body } from '@/lib/workspaces/request-body'
import { onboardingRequest } from '@/lib/wild-hubs/onboarding-http'
import { enabled, privateHeaders } from '@/lib/wild-hubs/http'
import { WorkspaceError } from '@/lib/workspaces/service'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const setupCookie = 'bioveracity_venue_setup'
const setupLifetime = 7 * 24 * 60 * 60
const setupToken = /^[A-Za-z0-9_-]{43}$/
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/wild/join',
}

function failure(error: unknown) {
  const known = error instanceof WorkspaceError
  return NextResponse.json(
    { error: known ? error.message : 'Unable to remember this setup link.' },
    { status: known ? error.status : 503, headers: privateHeaders },
  )
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(setupCookie)?.value || ''
  return NextResponse.json(
    { available: enabled() && setupToken.test(token) },
    { headers: privateHeaders },
  )
}

export async function POST(request: NextRequest) {
  let raw: unknown
  try { raw = await body(request, 2000) } catch (error) { return failure(error) }
  const input = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  if (input.action === 'remember') {
    if (!enabled()) return NextResponse.json(
      { error: 'Venue setup is not available yet. Please contact BioVeracity.' },
      { status: 503, headers: privateHeaders },
    )
    const token = typeof input.token === 'string' ? input.token : ''
    if (!setupToken.test(token)) return NextResponse.json(
      { error: 'Use a valid venue setup link.' },
      { status: 400, headers: privateHeaders },
    )
    const response = NextResponse.json({ remembered: true }, { headers: privateHeaders })
    response.cookies.set(setupCookie, token, { ...cookieOptions, maxAge: setupLifetime })
    return response
  }
  const token = typeof input.token === 'string'
    ? input.token
    : request.cookies.get(setupCookie)?.value
  const response = await onboardingRequest(async service => service.claim({ ...input, token }))
  if (response.ok) response.headers.append(
    'Set-Cookie',
    `${setupCookie}=; Path=${cookieOptions.path}; Max-Age=0; HttpOnly; SameSite=Lax${cookieOptions.secure ? '; Secure' : ''}`,
  )
  return response
}
