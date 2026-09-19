import { PublicShell } from './public-shell'
import { VisitorPage } from './visitor-page'
import { buildEdition } from '@/lib/wild-hubs/edition'
import type { Snapshot } from '@/lib/wild-hubs/domain'
import type { Photo } from '@/lib/wild-hubs/service'
import { getWildCounty } from '@/lib/wild-counties/counties'

function ieDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { timeZone: 'Europe/Dublin' })
}

export function PublishedHub({
  snapshot,
  photos,
}: {
  // id is retained in the props contract for callers; the rendering no longer needs it.
  id?: string
  snapshot: Snapshot
  photos: Photo[]
}) {
  const { profile, plan } = snapshot
  const county = getWildCounty(profile.county)
  const view = buildEdition({
    kind: 'published',
    profile,
    plan,
    photos: photos.map((p) => ({ ...p, src: `/api/wild/photos/${p.id}` })),
    countyBrand: county?.brandName || profile.county,
    provenanceLabel: `Venue-approved edition ${snapshot.version} · ${ieDate(snapshot.approvedAt)}. Venue content supplied and approved by the venue account. Business identity and environmental performance are not certified by BioVeracity.`,
    reviewedLabel: snapshot.reviewedAt
      ? `Editorial review completed ${ieDate(snapshot.reviewedAt)}. This is content review, not environmental certification.`
      : null,
  })
  return (
    <PublicShell>
      <VisitorPage view={view} />
    </PublicShell>
  )
}
