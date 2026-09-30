import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Sql } from '@/lib/workspaces/service'
import { isPlaceExperienceEnabled } from '@/lib/place/shell-loader'
import { isListeningPilotEnabled, placeListenPath, resolveListeningPlace } from '@/lib/place/participation'
import { placeRoutePath } from '@/lib/place/slugs'
import { ListeningHome } from '@/app/listen/listening-home'
import '@/app/listen/listen.css'

// PILOT-001: private listening at a public Place. Place-neutral: every Place-specific
// word arrives as data. The route exists only when both server-only flags are exactly
// 'true' and the Place has participation enabled; otherwise it is a uniform 404.
export const dynamic = 'force-dynamic'

const db: Sql = { query: <T,>(text: string, values: unknown[]) => prisma.$queryRawUnsafe<T[]>(text, ...values) }

export const metadata: Metadata = {
  title: 'Listen to this place — BioVeracity',
  robots: { index: false, follow: false },
}

export default async function PlaceListenPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isPlaceExperienceEnabled() || !isListeningPilotEnabled()) notFound()
  const { slug } = await params
  const resolved = await resolveListeningPlace(db, slug)
  if (resolved.outcome === 'redirect') permanentRedirect(resolved.location)
  if (resolved.outcome !== 'ok') notFound()
  const { place } = resolved
  const back = placeRoutePath(place.slug)
  const returnTo = encodeURIComponent(placeListenPath(place.slug))
  const session = await auth()
  const verified = session?.user?.id ? Boolean((await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } }))?.emailVerified) : false
  return <main className="listening"><header className="listen-nav"><Link href={back} prefetch={false}>BioVeracity<span>Back to {place.name}</span></Link><Link href={session?.user ? '/start' : `/login?callbackUrl=${returnTo}`}>{session?.user ? 'My account' : 'Sign in'}</Link></header>
    <section className="listen-intro"><p className="listen-eyebrow">Listen to this place</p><h1>{place.name}</h1><p>Spend five quiet minutes here and begin your own listening history.</p><p>Return over time and notice what changes.</p><p className="listen-small">Your observations remain private and are not part of the public evidence record.</p></section>
    {!session?.user ? <section className="listen-card"><h2>Your first five minutes matter.</h2><p>Free participation. No payment card. Adult participants only. Your visits remain private to your account in this pilot.</p><Link className="listen-button" href={`/signup?callbackUrl=${returnTo}`}>Join free</Link> <Link href={`/login?callbackUrl=${returnTo}`}>I already have an account</Link></section>
      : !verified ? <section className="listen-card"><h2>Confirm your email to begin.</h2><p>We sent a confirmation link when you joined. Your visits stay private to your account once your email is confirmed.</p><Link className="listen-button" href={`/verify-email?callbackUrl=${returnTo}`}>Confirm or resend my email</Link></section>
      : <ListeningHome place={{ slug: place.slug, title: place.name }} />}
    <p className="listen-back"><Link href={back} prefetch={false}>Return to {place.name}</Link></p>
    <footer className="listen-footer"><p>Listening visits are personal observations, not verified species records. A quiet visit does not establish that birds are absent. Differences between visits do not establish ecological decline or its cause.</p><p>Built by BioVeracity · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p></footer>
  </main>
}
