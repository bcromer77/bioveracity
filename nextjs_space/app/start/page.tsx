import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { resolveUserContext, contextHome } from '@/lib/auth-context'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Choose where to work | BioVeracity',
  robots: { index: false, follow: false },
}

// The post-sign-in resolver. It never renders for single-context people — they
// are redirected straight to their home. Only a person who is BOTH a
// professional investigator AND a venue owner sees the chooser, so that moving
// between the two products is a deliberate act rather than an accident.
export default async function StartPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Fstart')

  const ctx = await resolveUserContext(session.user.id)
  if (!(ctx.ownsVenue && ctx.isProfessional)) redirect(contextHome(ctx))

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[860px] flex-1 px-4 py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Where would you like to work?
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Your account has access to more than one part of BioVeracity. Choose where to go — you can switch back at any time.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Link
            href="/workspace"
            className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-foreground"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Professional
            </span>
            <span className="mt-2 block font-display text-xl font-bold text-foreground">
              Investigations workspace
            </span>
            <span className="mt-2 block text-[14px] leading-relaxed text-muted-foreground">
              Open the satellite-led operating picture, evidence chronology and Honeycomb search to investigate a place.
            </span>
            <span className="mt-4 inline-block text-[14px] font-semibold text-[hsl(var(--link))]">
              Enter workspace →
            </span>
          </Link>
          <Link
            href="/wild/studio"
            className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-foreground"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Wild Counties
            </span>
            <span className="mt-2 block font-display text-xl font-bold text-foreground">
              Your venue{ctx.venueCount > 1 ? 's' : ''}
            </span>
            <span className="mt-2 block text-[14px] leading-relaxed text-muted-foreground">
              Tend your place’s field journal, panoramas and visitor observations, and see what people have noticed.
            </span>
            <span className="mt-4 inline-block text-[14px] font-semibold text-[hsl(var(--link))]">
              Enter your studio →
            </span>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
