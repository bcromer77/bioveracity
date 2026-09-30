import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Sql } from '@/lib/workspaces/service'
import { isPlaceExperienceEnabled, loadPlaceShell } from '@/lib/place/shell-loader'
import { placePresentation } from '@/lib/place-memory/place-presentation'
import { isListeningPilotEnabled, isObservationPilotEnabled, placeListenPath, placeNoticePath, resolveListeningPlace, resolveObservationPlace } from '@/lib/place/participation'
import { placeRoutePath } from '@/lib/place/slugs'
import { NoticeHome, type PublicRecordSummary } from './notice-home'
import '@/app/listen/listen.css'
import './notice.css'

// PILOT-001 NE demo: private participant observation at a public Place.
// Place-neutral: every Place-specific word arrives as data. Uniform 404 unless the
// server-only flags are exactly 'true' and the Place has observation enabled.
// The public record summary is read from the same public view as the Place page;
// participant data is only ever read by the owner through the private API.
export const dynamic = 'force-dynamic'

const db: Sql = { query: <T,>(text: string, values: unknown[]) => prisma.$queryRawUnsafe<T[]>(text, ...values) }

export const metadata: Metadata = {
  title: 'Notice this place — BioVeracity',
  robots: { index: false, follow: false },
}

export default async function PlaceNoticePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isPlaceExperienceEnabled() || !isObservationPilotEnabled()) notFound()
  const { slug } = await params
  const resolved = await resolveObservationPlace(db, slug)
  if (resolved.outcome === 'redirect') permanentRedirect(resolved.location)
  if (resolved.outcome !== 'ok') notFound()
  const { place } = resolved
  const shell = await loadPlaceShell(db, place.slug, placePresentation)
  if (shell.outcome !== 'ok') notFound()
  const publicRecord: PublicRecordSummary = {
    categories: shell.view.categories.filter((c) => c.status === 'available').map((c) => ({ id: c.id, label: c.label, count: c.count })),
    dated: shell.view.timeline.length,
  }
  const listening = isListeningPilotEnabled() ? await resolveListeningPlace(db, place.slug) : null
  const back = placeRoutePath(place.slug)
  const returnTo = encodeURIComponent(placeNoticePath(place.slug))
  const session = await auth()
  const verified = session?.user?.id ? Boolean((await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } }))?.emailVerified) : false
  return <main className="listening notice-page">
    <header className="listen-nav"><Link href={back} prefetch={false}>BioVeracity<span>Back to {place.name}</span></Link><Link href={session?.user ? '/start' : `/login?callbackUrl=${returnTo}`}>{session?.user ? 'My account' : 'Sign in'}</Link></header>
    <section className="listen-intro notice-intro"><p className="listen-eyebrow">Notice this place</p><h1>{place.name}</h1><p>What have you seen, heard or noticed?</p><p className="listen-small">Your observations stay private to you. They are not part of the public evidence record and are never checked, scored or identified automatically.</p></section>
    {!session?.user ? <section className="listen-card"><h2>Begin your own memory of this place.</h2><p>Free participation. No payment card. Adult participants only. Your observations remain private to your account in this demonstration.</p><Link className="listen-button" href={`/signup?callbackUrl=${returnTo}`}>Join free</Link> <Link href={`/login?callbackUrl=${returnTo}`}>I already have an account</Link></section>
      : !verified ? <section className="listen-card"><h2>Confirm your email to begin.</h2><p>We sent a confirmation link when you joined. Your observations stay private to your account once your email is confirmed.</p><Link className="listen-button" href={`/verify-email?callbackUrl=${returnTo}`}>Confirm or resend my email</Link></section>
      : <NoticeHome place={{ slug: place.slug, title: place.name, mapCentre: place.mapCentre }} publicRecord={publicRecord} listenHref={listening?.outcome === 'ok' ? placeListenPath(place.slug) : null} />}
    <p className="listen-back"><Link href={back} prefetch={false}>Return to {place.name}</Link></p>
    <footer className="listen-footer"><p>Participant observations are personal records, not verified species records. BioVeracity does not identify species, validate observations or publish them in this demonstration. Repeated observations describe your own experience of a place; they do not establish ecological change, presence or absence, abundance or trend.</p><p>Built by BioVeracity · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p></footer>
  </main>
}
