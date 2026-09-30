import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import type { Sql } from '@/lib/workspaces/service'
import { isPlaceExperienceEnabled, loadPlaceShell } from '@/lib/place/shell-loader'
import { searchPlaceView } from '@/lib/place/shell-view'
import { placePresentation } from '@/lib/place-memory/place-presentation'
import { PlaceShell } from '@/components/place/place-shell'
import { PlaceListenInvitation } from '@/components/place/place-listen-invitation'
import { isListeningPilotEnabled, isObservationPilotEnabled, placeListenPath, placeNoticePath, resolveListeningPlace, resolveObservationPlace } from '@/lib/place/participation'

// Place Experience PR D: dark by default. The route exists only when the
// server-only PLACE_EXPERIENCE_ENABLED flag is exactly 'true'; otherwise, and
// for every malformed, unknown or non-public slug, it is a uniform 404.
export const dynamic = 'force-dynamic'

// Read-only: the SQL text is fixed inside the PR B / PR C modules; values stay bound.
const db: Sql = { query: <T,>(text: string, values: unknown[]) => prisma.$queryRawUnsafe<T[]>(text, ...values) }

export const metadata: Metadata = {
  title: 'Place — BioVeracity',
  robots: { index: false, follow: false },
}

// PR F: an optional GET ?q= runs the deterministic Place-scoped search over the
// same public view; it never widens what the page can read.
export default async function PlacePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  if (!isPlaceExperienceEnabled()) notFound()
  const { slug } = await params
  const result = await loadPlaceShell(db, slug, placePresentation)
  if (result.outcome === 'redirect') permanentRedirect(result.location)
  if (result.outcome !== 'ok') notFound()
  const { q } = await searchParams
  // PILOT-001: the invitation appears only when the listening flag is on and this
  // Place has participation enabled. It reads participation config, never listening data.
  const listening = isListeningPilotEnabled() ? await resolveListeningPlace(db, slug) : null
  const invitation = listening?.outcome === 'ok' ? <PlaceListenInvitation href={placeListenPath(listening.place.slug)} /> : undefined
  // PILOT-001 NE demo: observation entry points, likewise config-only. Participant
  // observations are never read here and never reach the public view or search.
  const observation = isObservationPilotEnabled() ? await resolveObservationPlace(db, slug) : null
  const notice = observation?.outcome === 'ok' ? { href: placeNoticePath(observation.place.slug) } : null
  return <PlaceShell view={result.view} search={searchPlaceView(result.view, q)} invitation={invitation} notice={notice} />
}
