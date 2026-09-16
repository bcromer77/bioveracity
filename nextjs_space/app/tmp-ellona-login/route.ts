/**
 * TEMPORARY dev-only preview login for Ellona originator testing.
 * DELETE THIS FILE before any checkpoint, deploy or test tool run.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encode } from 'next-auth/jwt'

export const dynamic = 'force-dynamic'

const KEY = 'walkthrough-2026'

export async function GET(request: NextRequest) {
  const k = request.nextUrl.searchParams.get('k')
  if (k !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const user = await prisma.user.findFirst({
    where: { email: 'bazil.cromer@ripplexn.com' },
  })
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''

  // Build an absolute redirect target from the forwarded host so we land back on
  // the public preview domain, not the internal localhost the server sees.
  const fwdHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  const fwdProto = request.headers.get('x-forwarded-proto') || 'https'
  const target = `${fwdProto}://${fwdHost}/ellona`
  const res = NextResponse.redirect(target, 303)

  // The session-token cookie name (and its decode salt) depend on whether the
  // app is running with secure cookies. To be robust we mint a token for BOTH
  // the secure and non-secure names, each salted with its own name; the app
  // reads whichever one it is configured for and ignores the other.
  for (const cookieName of ['authjs.session-token', '__Secure-authjs.session-token']) {
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: (user as any).role ?? 'user',
        accessState: (user as any).accessState ?? 'REGISTERED',
      },
      secret,
      salt: cookieName,
      maxAge: 3600,
    })
    res.cookies.set(cookieName, token, {
      path: '/',
      httpOnly: true,
      secure: cookieName.startsWith('__Secure-'),
      sameSite: 'lax',
      maxAge: 3600,
    })
  }
  return res
}
