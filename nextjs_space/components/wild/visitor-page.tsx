import Link from 'next/link'
import { CountyNature } from '@/components/wild/county-nature'
import { EvidenceLink } from '@/components/evidence-link'
import type { EditionView } from '@/lib/wild-hubs/edition'

// The one Wild Counties visitor rendering, shared by the private preview, the
// published page and the editorial-review queue. Given an EditionView it renders
// the venue exactly as a visitor will see it. It does not wrap itself in a shell,
// so each caller can place it inside the public shell or an admin card.
const BANNERS: Record<EditionView['kind'], string | null> = {
  preview: 'Private preview — only you can see this. Nothing here is published yet.',
  review: 'Editorial review preview — this is the version submitted for review.',
  published: null,
}

export function VisitorPage({ view }: { view: EditionView }) {
  const banner = BANNERS[view.kind]
  const hero = view.photos[0]
  const gallery = view.photos.slice(1)
  const visitHref = view.visitUrl || view.website
  return (
    <>
      {banner && <div className="bv-demo">{banner}</div>}
      <section className="bv-hero">
        <p className="bv-eyebrow">
          {view.countyBrand}
          {view.locality ? ` · ${view.locality}` : ''}
        </p>
        <h1>{view.placeName}</h1>
        {view.invitation && <p className="bv-intro">{view.invitation}</p>}
        {hero && (
          <figure className="bv-preview-photo">
            <img src={hero.src} alt={hero.caption} />
            <figcaption className="bv-photo-caption">
              <span className="bv-photo-species">{hero.caption}</span>
              {hero.credit && <span className="bv-photo-credit">{hero.credit}</span>}
            </figcaption>
          </figure>
        )}
        {visitHref && (
          <EvidenceLink
            className="bv-button bv-green"
            href={visitHref}
            rel="noopener noreferrer"
          >
            Plan your visit ↗
          </EvidenceLink>
        )}
      </section>

      {view.story && (
        <section className="bv-section">
          <p className="bv-eyebrow">The story of the place</p>
          <p className="bv-preserve">{view.story}</p>
          {gallery.length > 0 && (
            <div className="bv-photo-grid">
              {gallery.map((p) => (
                <figure key={p.id}>
                  <img src={p.src} alt={p.caption} loading="lazy" />
                  <figcaption>
                    {p.caption}
                    {p.credit ? ` · ${p.credit}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {view.campaign && (
        <section className="bv-section bv-tinted bv-split">
          <div>
            <p className="bv-eyebrow">{view.campaign.monthName} · Seasonal discovery</p>
            <h2>{view.campaign.title}</h2>
            <p>{view.campaign.introduction}</p>
          </div>
          <div className="bv-topic">
            <p className="bv-eyebrow">A discovery to share</p>
            <p>{view.campaign.activity}</p>
            <p className="bv-small">
              Observe without disturbing wildlife. Check access, opening times and
              local conditions before visiting. No wildlife sightings are promised.
            </p>
          </div>
        </section>
      )}

      {(view.natureStory || view.visitPrompt) && (
        <section className="bv-section bv-split">
          {view.natureStory && (
            <div>
              <p className="bv-eyebrow">Nature around the place</p>
              <p className="bv-preserve">{view.natureStory}</p>
            </div>
          )}
          {view.visitPrompt && (
            <aside className="bv-preview-card">
              <p className="bv-eyebrow">Before you come</p>
              <p>{view.visitPrompt}</p>
            </aside>
          )}
        </section>
      )}

      <section className="bv-section">
        <CountyNature county={view.county} />
        <p className="bv-small">
          We&rsquo;re connecting source-linked information about the landscape and
          wildlife around your place. County records update separately from the
          venue-approved edition.
        </p>
      </section>

      {view.recommendations.length > 0 && (
        <section className="bv-section bv-tinted">
          <p className="bv-eyebrow">Nearby, worth a look</p>
          <div className="bv-photo-grid">
            {view.recommendations.map((r, i) => (
              <div key={i} className="bv-topic">
                <h3>{r.name}</h3>
                {r.note && <p>{r.note}</p>}
              </div>
            ))}
          </div>
          <p className="bv-small">
            Venue-supplied recommendations, not verified by BioVeracity.
          </p>
        </section>
      )}

      <section className="bv-section">
        <p className="bv-small">{view.provenanceLabel}</p>
        {view.reviewedLabel && <p className="bv-small">{view.reviewedLabel}</p>}
        <Link href={`/wild/${view.county}`}>Discover {view.countyBrand} &rarr;</Link>
      </section>
    </>
  )
}
