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
  const token = await encode({
    token: { sub: user.id, email: user.email, name: user.name },
    secret,
    maxAge: 3600,
  })

  const isSecure = request.nextUrl.protocol === 'https:'
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

  const res = NextResponse.redirect(new URL('/ellona', request.url), 303)
  res.cookies.set(cookieName, token, {
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 3600,
  })
  return res
}
