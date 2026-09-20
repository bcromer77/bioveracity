export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { normaliseEmail, passwordInput } from '@/lib/workspaces/invitations'
import { WorkspaceError } from '@/lib/workspaces/service'
import { validatePassword } from '@/lib/account-recovery/password-policy'

export async function POST(request: Request) {
  try {
    const input = await request.json()
    const email = normaliseEmail(input.email)
    const password = passwordInput(input.password)
    const policy = validatePassword(password)
    if (!policy.ok) return NextResponse.json({ error: policy.error }, { status: 400 })
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name || name.length > 120) return NextResponse.json({ error: 'Valid name is required' }, { status: 400 })
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'user' },
    })
    return NextResponse.json({ id: user.id, email: user.email, name: user.name })
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
