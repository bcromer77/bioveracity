import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import type { Sql } from '@/lib/workspaces/service'
import { isPlaceExperienceEnabled, loadPlaceShell } from '@/lib/place/shell-loader'
import { SPECIES_SLUG_RE, speciesJourney } from '@/lib/place/shell-view'
import { placePresentation } from '@/lib/place-memory/place-presentation'
import { PlaceShell } from '@/components/place/place-shell'
import { PlaceJourney } from '@/components/place/place-journey'

// Place Experience PR F: species / feature object journey. Same flag, same
// PR B slug resolution and PR C public read as the Place page; an unknown,
// malformed or non-public object is the same uniform 404.
export const dynamic = 'force-dynamic'

const db: Sql = { query: <T,>(text: string, values: unknown[]) => prisma.$queryRawUnsafe<T[]>(text, ...values) }

export const metadata: Metadata = {
  title: 'Place — BioVeracity',
  robots: { index: false, follow: false },
}

export default async function PlaceSpeciesPage({ params }: { params: Promise<{ slug: string; species: string }> }) {
  if (!isPlaceExperienceEnabled()) notFound()
  const { slug, species } = await params
  if (typeof species !== 'string' || species.length > 80 || !SPECIES_SLUG_RE.test(species)) notFound()
  const result = await loadPlaceShell(db, slug, placePresentation)
  if (result.outcome === 'redirect') permanentRedirect(`${result.location}/species/${species}`)
  if (result.outcome !== 'ok' || !result.view.path) notFound()
  const journey = speciesJourney(result.view, species)
  if (!journey) notFound()
  return (
    <PlaceShell view={result.view}>
      <PlaceJourney j={journey} placeTitle={result.view.title} placePath={result.view.path} />
    </PlaceShell>
  )
}
