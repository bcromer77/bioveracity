// TEMPORARY dev-only route — grants a read-only preview session as the
// originator (Bazil). Does NOT touch the client's real workspace.
// DELETE after use.

import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { ellonaEnabled } from '@/lib/ellona/config'
import { ORIGINATOR_EMAIL } from '@/lib/ellona/access'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Guard 1: dev only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // Guard 2: Ellona must be enabled
  if (!ellonaEnabled()) {
    return NextResponse.json({ error: 'Disabled' }, { status: 503 })
  }
  // Guard 3: simple key
  if (req.nextUrl.searchParams.get('k') !== 'walkthrough-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findFirst({
    where: { email: ORIGINATOR_EMAIL },
    select: { id: true, email: true, name: true, role: true, accessState: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
  const isSecure = (req.headers.get('x-forwarded-proto') || 'http') === 'https'
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await encode({
    secret,
    salt: cookieName,
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessState: user.accessState,
    },
    maxAge: 60 * 60, // 1 hour
  })

  // Use x-forwarded-host so the redirect lands on the external preview domain,
  // not on localhost (which the user's browser can't reach).
  const fwdHost = req.headers.get('x-forwarded-host')
  const fwdProto = req.headers.get('x-forwarded-proto') || 'http'
  const base = fwdHost ? `${fwdProto}://${fwdHost}` : req.url
  const url = new URL('/ellona', base)
  const res = NextResponse.redirect(url, 303)
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })
  return res
}
