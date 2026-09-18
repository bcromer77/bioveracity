'use client'

import dynamic from 'next/dynamic'
import type { WildTopic } from '@/lib/wild-counties/types'
import type { DiscoveryPoint } from './discovery-map-inner'

// Client-only wrapper: Leaflet touches window/document, so the map itself is
// dynamically imported with ssr:false (the same pattern as the asset place map).
const DiscoveryMapInner = dynamic(() => import('./discovery-map-inner'), {
  ssr: false,
  loading: () => <div className="bv-dmap bv-dmap-loading">Loading map…</div>,
})

export function DiscoveryMap({
  topics,
  countyName,
}: {
  topics: readonly WildTopic[]
  countyName: string
}) {
  // Keep each story's number from the FULL list, then keep only the ones that
  // carry an approximate public locality to place on the map.
  const points: DiscoveryPoint[] = topics
    .map((t, index) => ({ t, index }))
    .filter(
      (x): x is { t: WildTopic; index: number } =>
        typeof x.t.lat === 'number' && typeof x.t.lng === 'number',
    )
    .map(({ t, index }) => ({
      slug: t.slug,
      index,
      title: t.title,
      place: t.place ?? t.locality ?? '',
      summary: t.summary,
      season: t.season,
      sourceUrl: t.sourceUrl,
      publisher: t.publisher,
      sourceChecked: t.sourceChecked,
      lat: t.lat as number,
      lng: t.lng as number,
    }))

  if (points.length === 0) return null

  return <DiscoveryMapInner points={points} countyName={countyName} />
}
