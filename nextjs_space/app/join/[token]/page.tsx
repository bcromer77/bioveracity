import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hashInvitationToken } from '@/lib/workspaces/invitations'
import { AcceptInvitation } from './accept-invitation'

export const dynamic = 'force-dynamic'

function mask(email: string) {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}•••@${domain}`
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await prisma.privateWorkspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { workspace: true, case: true },
  })
  const unavailable = !invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()
  if (unavailable) return <main className="mx-auto max-w-lg px-5 py-20"><h1 className="font-display text-3xl font-bold">This invitation is no longer available.</h1><p className="mt-4 text-muted-foreground">Ask the person who invited you to send a fresh link.</p><Link className="mt-6 inline-block underline" href="/login">Sign in</Link></main>

  const session = await auth()
  const callbackUrl = `/join/${encodeURIComponent(token)}`

  return <main className="mx-auto flex min-h-[75vh] max-w-lg items-center px-5 py-12">
    <section className="w-full rounded-xl border border-border bg-card p-7 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">BioVeracity invitation</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{invite.case?.title || invite.workspace.name}</h1>
      {invite.case && <p className="mt-2 text-muted-foreground">{invite.workspace.name}</p>}
      <p className="mt-6 text-[16px] leading-7">Your place is already prepared. Sign in with <strong>{mask(invite.email)}</strong> and BioVeracity will take you straight to the evidence you were invited to review.</p>

      {!session?.user ? <div className="mt-7 grid gap-3">
        <Link className="rounded-md bg-primary px-4 py-3 text-center font-semibold text-primary-foreground" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link>
        <Link className="rounded-md border border-input px-4 py-3 text-center font-semibold" href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Create account</Link>
      </div> : session.user.email?.trim().toLowerCase() !== invite.email ? <div className="mt-7 rounded-md border border-destructive/40 p-4 text-sm">
        <p>This invitation is for a different email address.</p>
        <Link className="mt-3 inline-block underline" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in with the invited address</Link>
      </div> : <div className="mt-7"><AcceptInvitation token={token} /></div>}
      <p className="mt-6 text-xs text-muted-foreground">Invitation expires {invite.expiresAt.toLocaleDateString('en-GB')}.</p>
    </section>
  </main>
}
