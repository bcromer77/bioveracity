import Link from 'next/link'
import { PublicShell } from './public-shell'
import { activeCampaign, MONTHS, type Snapshot } from '@/lib/wild-hubs/domain'
import type { Photo } from '@/lib/wild-hubs/service'
import { getWildCounty } from '@/lib/wild-counties/counties'
export function PublishedHub({
  id,
  snapshot,
  photos,
}: {
  id: string
  snapshot: Snapshot
  photos: Photo[]
}) {
  const { profile, plan } = snapshot,
    county = getWildCounty(profile.county),
    campaign = activeCampaign(plan)
  return (
    <PublicShell>
      <section className="bv-hero">
        <p className="bv-eyebrow">{county?.brandName} · Ecology hub</p>
        <h1>{profile.name}</h1>
        <p className="bv-intro">
          Your starting point for local stories and seasonal discoveries.
        </p>
        {profile.website && (
          <a
            className="bv-button"
            href={profile.website}
            rel="noopener noreferrer"
          >
            Visit our website ↗
          </a>
        )}
        <p className="bv-small">
          Venue content supplied and approved by the publishing account.
          Business identity and environmental performance are not certified by
          BioVeracity.
        </p>
      </section>
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
      {plan.sources.length > 0 && (
        <section className="bv-section">
          <p className="bv-eyebrow">Beyond the doorstep</p>
          <h2>Explore the wider story.</h2>
          <div className="bv-grid bv-three">
            {plan.sources.map((s) => (
              <article className="bv-topic" key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.caveat}</p>
                <a href={s.url}>{s.publisher} · Read the source ↗</a>
                <p className="bv-small">
                  Scope: {s.scope}. Publication and event dates are not recorded
                  in this catalogue. This is a reading link, not a dated
                  wildlife observation at this venue.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="bv-section">
        <p className="bv-small">
          Venue-approved edition {snapshot.version} ·{' '}
          {new Date(snapshot.approvedAt).toLocaleDateString('en-GB', {
            timeZone: 'Europe/Dublin',
          })}
        </p>
        <Link href={`/wild/${profile.county}`}>
          Discover {county?.brandName} →
        </Link>
      </section>
    </PublicShell>
  )
}
