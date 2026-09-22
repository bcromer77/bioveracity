import { requireLimit, securityIp } from '@/lib/account-recovery/security'
import { identities, securityDb } from '@/lib/account-recovery/security-http'
export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { body } from '@/lib/workspaces/request-body'
import { recordAcceptance } from '@/lib/data-rights/service'
import { validAcceptance } from '@/lib/data-rights/policy'
import { adapter } from '@/lib/workspaces/http'
import bcrypt from 'bcryptjs'
import { normaliseEmail, passwordInput } from '@/lib/workspaces/invitations'
import { WorkspaceError } from '@/lib/workspaces/service'
import { validatePassword } from '@/lib/account-recovery/password-policy'

export async function POST(request: Request) {
  try {
    await requireLimit(securityDb, 'signupIp', securityIp(request))
    const input = await body(request) as Record<string, unknown>
    if (!input || typeof input !== 'object') throw new WorkspaceError(400, 'Invalid signup')
    const termsEnabled = process.env.DATA_RIGHTS_ENABLED === 'true'
    if (termsEnabled && !validAcceptance(input)) throw new WorkspaceError(400, 'Please read and accept the current terms and acknowledge the privacy notice.')
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
    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({data:{email,password:hashed,name,role:'user'}})
      if (termsEnabled) await recordAcceptance(adapter(tx), created.id, input, 'signup')
      return created
    })
    const verificationRequired = process.env.AUTH_REQUIRE_VERIFIED_EMAIL === 'true'
    if (verificationRequired) {
      try { await identities().issue({email:user.email,ip:securityIp(request),purpose:'VERIFY_EMAIL'}) }
      catch { console.error('signup_verification_issue_failed') }
    }
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, verificationRequired })
  } catch (error: unknown) {
    if (error instanceof WorkspaceError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
