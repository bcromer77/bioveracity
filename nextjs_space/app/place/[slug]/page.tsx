import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import type { Sql } from '@/lib/workspaces/service'
import { isPlaceExperienceEnabled, loadPlaceShell } from '@/lib/place/shell-loader'
import { placePresentation } from '@/lib/place-memory/place-presentation'
import { PlaceShell } from '@/components/place/place-shell'

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

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isPlaceExperienceEnabled()) notFound()
  const { slug } = await params
  const result = await loadPlaceShell(db, slug, placePresentation)
  if (result.outcome === 'redirect') permanentRedirect(result.location)
  if (result.outcome !== 'ok') notFound()
  return <PlaceShell view={result.view} />
}
