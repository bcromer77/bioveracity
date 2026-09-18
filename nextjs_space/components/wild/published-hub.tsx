import { CountyNature } from '@/components/wild/county-nature'
import { EvidenceLink } from '@/components/evidence-link'
import Link from 'next/link'
import { PublicShell } from './public-shell'
import { Panorama } from './panorama'
import { FieldJournal } from './field-journal'
import { ContributeForm } from './contribute-form'
import { activeCampaign, MONTHS, type Snapshot } from '@/lib/wild-hubs/domain'
import type { Photo } from '@/lib/wild-hubs/service'
import type { PanoramaPoint } from '@/lib/wild-hubs/photos'
import type { Journal } from '@/lib/wild-hubs/journal'
import { getWildCounty } from '@/lib/wild-counties/counties'
export type PanoramaView = {
  id: string
  caption: string
  credit: string
  points: PanoramaPoint[]
}
export function PublishedHub({
  id,
  snapshot,
  photos,
  panoramas = [],
  journal,
}: {
  id: string
  snapshot: Snapshot
  photos: Photo[]
  panoramas?: PanoramaView[]
  journal?: Journal
}) {
  const { profile, plan } = snapshot,
    county = getWildCounty(profile.county),
    campaign = activeCampaign(plan)
  return (
    <PublicShell>
      <section className="bv-hero">
        <p className="bv-eyebrow">{county?.brandName} · A living field journal</p>
        <h1>{profile.name}</h1>
        {profile.website && (
          <EvidenceLink
            className="bv-button"
            href={profile.website}
            rel="noopener noreferrer"
          >
            Visit our website ↗
          </EvidenceLink>
        )}
      </section>
      <ContributeForm hubId={id} />
      {panoramas.length > 0 && (
        <section className="bv-section">
          <p className="bv-eyebrow">Stand here a moment</p>
          <h2>Look around.</h2>
          <p>
            A view of the place, with a few things worth pausing over. Take your
            time — there is always more here than first meets the eye.
          </p>
          {panoramas.map((p) => (
            <Panorama
              key={p.id}
              photoId={p.id}
              caption={p.caption}
              credit={p.credit}
              points={p.points}
            />
          ))}
        </section>
      )}
      <section className="bv-section">
        <p className="bv-eyebrow">Our story</p>
        <h2>A place to discover.</h2>
        <p className="bv-preserve">{profile.story}</p>
        <div className="bv-photo-grid">
          {photos.map((p) => (
            <figure key={p.id}>
              <img
                src={`/api/wild/photos/${p.id}`}
                alt={p.caption}
                loading="lazy"
              />
              <figcaption>
                {p.caption} · {p.credit}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      {campaign && (
        <section className="bv-section bv-tinted bv-split">
          <div>
            <p className="bv-eyebrow">
              {MONTHS[campaign.month - 1]} {plan.year} · Seasonal inspiration
            </p>
            <h2>{campaign.title}</h2>
            <p>{campaign.introduction}</p>
          </div>
          <div className="bv-topic">
            <p className="bv-eyebrow">A discovery to share</p>
            <h3>Bring your curiosity.</h3>
            <p>{campaign.activity}</p>
            <p className="bv-small">
              Observe without disturbing wildlife. Check access, opening times
              and local conditions before visiting. No wildlife sightings are
              promised.
            </p>
          </div>
        </section>
      )}
      {journal && <FieldJournal journal={journal} placeName={profile.name} />}
      <section className="bv-section"><CountyNature county={profile.county}/></section>
      <section className="bv-section bv-colophon">
        <Link href={`/wild/${profile.county}`} className="bv-colophon-link">
          Discover more of {county?.brandName} →
        </Link>
        <p className="bv-small">
          This page is written and approved by {profile.name}. County wildlife
          records come from national databases and update separately. It is a
          place&rsquo;s own story, shared with care — not an environmental
          certification.
        </p>
      </section>
    </PublicShell>
  )
}
