import { CountyNature } from '@/components/wild/county-nature'
import { CountyMap } from '@/components/wild/county-map'
import { EvidenceLink } from '@/components/evidence-link'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'
import { getWildVenue, publicWildOrigin } from '@/lib/wild-counties/venues'
import { getPublishedHub } from '@/lib/wild-hubs/public'
import { hubDb } from '@/lib/wild-hubs/http'
import { PublishedHub } from '@/components/wild/published-hub'
import type { Photo } from '@/lib/wild-hubs/service'

const SCOPE_LABEL: Record<string, string> = {
  county: 'County record',
  regional: 'Regional context',
  'national-context': 'National context',
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Example ecology hub | BioVeracity Wild', robots: { index: false, follow: false } }

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = getWildVenue(id)
  if (!venue) {
    const snapshot = await getPublishedHub(id)
    if (!snapshot) notFound()
    const photos = snapshot.photoIds.length
      ? await hubDb.query<Photo>('SELECT "id","caption","credit" FROM "WildHubPhoto" WHERE "hubId"=$1 AND "id"=ANY($2::text[]) ORDER BY "createdAt","id"', [id, snapshot.photoIds])
      : []
    return <PublishedHub id={id} snapshot={snapshot} photos={photos} />
  }

  const origin = publicWildOrigin()
  const { discoveries } = venue

  return (
    <PublicShell>
      <div className="bv-demo">Fictional example · Not a real venue or a signed-up partner. Names, story and captions are illustrative.</div>

      <section className="bv-hero bv-split">
        <div>
          <Link className="bv-eyebrow" href={`/wild/${venue.county}`}>← {venue.countyData.brandName}</Link>
          <p className="bv-small">{venue.locality}</p>
          <h1>{venue.name}</h1>
          <p className="bv-intro">{venue.heading}</p>
          <div className="bv-actions">
            <Link className="bv-button bv-green" href="/wild/partners#enquire">Enquire about a founding partnership</Link>
            <Link className="bv-text-link" href={`/wild/${venue.county}`}>Explore {venue.countyData.brandName} →</Link>
          </div>
        </div>
        <figure className="bv-hero-figure">
          <div className="bv-preview-photo">
            <img src={venue.image.src} alt={venue.image.alt} width={1400} height={893} />
            <figcaption className="bv-photo-caption">
              <span className="bv-photo-species">{venue.image.caption}</span>
              <span className="bv-photo-credit">{venue.image.credit}</span>
            </figcaption>
          </div>
        </figure>
      </section>

      <section className="bv-section bv-split">
        <div>
          <p className="bv-eyebrow">The story of the place</p>
          <h2>People. Place. Possibility.</h2>
          <p>{venue.story}</p>
          <p className="bv-small">This narrative demonstrates the layout. It is written by BioVeracity as an illustration, not supplied by a venue.</p>
        </div>
        <aside className="bv-preview-card">
          <span>SEASONAL FEATURE</span>
          <h3>{venue.seasonalFeature.title}</h3>
          <p>{venue.seasonalFeature.body}</p>
        </aside>
      </section>

      <section className="bv-section bv-tinted">
        <p className="bv-eyebrow">Three things to discover nearby</p>
        <h2>Verified discoveries within reach</h2>
        <p>Each nearby discovery is one of {venue.countyData.brandName}’s reviewed stories, checked against a named public source. Locations are public localities — never precise or sensitive wildlife sites.</p>
        <CountyMap topics={discoveries} countyName={venue.countyData.brandName} />
        <ol className="bv-discoveries">
          {discoveries.map((topic, index) => (
            <li key={topic.slug} id={topic.slug} className="bv-discovery">
              <span className="bv-discovery-num" aria-hidden="true">{index + 1}</span>
              <div className="bv-discovery-body">
                <div className="bv-discovery-head">
                  <h3>{topic.title}</h3>
                  <span className="bv-badge">{SCOPE_LABEL[topic.evidenceScope] ?? 'Context'}</span>
                </div>
                {topic.place && <p className="bv-small">Locality: {topic.place}</p>}
                <p>{topic.summary}</p>
                {topic.season && <p className="bv-season-note"><strong>When to look:</strong> {topic.season}</p>}
                {topic.caveat && <p className="bv-small">{topic.caveat}</p>}
                <p className="bv-small">
                  <EvidenceLink href={topic.sourceUrl}>Source: {topic.publisher}</EvidenceLink>
                  {topic.sourceChecked && <> · Link last checked {topic.sourceChecked}</>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bv-section bv-split">
        <div>
          <p className="bv-eyebrow">Invite guests to notice</p>
          <h2>A prompt for your visitors</h2>
          <p>{venue.guestPrompt}</p>
          <p className="bv-small">Guest observations are reviewed before they ever shape the published guide — nothing goes live unchecked.</p>
        </div>
        <aside className="bv-preview-card">
          <span>EXAMPLE CAPTIONS YOU COULD ADAPT</span>
          <ul className="bv-caption-list">
            {venue.captions.map((caption) => (
              <li key={caption}>“{caption}”</li>
            ))}
          </ul>
          <p className="bv-small">These are editable examples. We draft and refine your captions with you — you approve every word before it appears.</p>
        </aside>
      </section>

      <section className="bv-section">
        <CountyNature county={venue.county} />
      </section>

      <section className="bv-section bv-tinted bv-split">
        <div>
          <p className="bv-eyebrow">One code. Your own starting point.</p>
          <h2>Scan here. Start discovering.</h2>
          <p>A venue-specific QR code connects your sign to this page. The address stays stable while approved content changes, so printed signage never goes out of date.</p>
          <p className="bv-small">Example code only. Confirm the published destination before printing signage.</p>
        </div>
        <div className="bv-qr">
          {origin ? (
            <>
              <img src={`/api/wild/qr/${venue.id}`} alt={`QR code opening the ${venue.name} example page`} width="256" height="256" />
              <EvidenceLink className="bv-button bv-green" download={`${venue.id}-example-qr.svg`} href={`/api/wild/qr/${venue.id}?download=1`}>Download example QR</EvidenceLink>
              <p className="bv-small">{origin}/wild/q/{venue.id}</p>
            </>
          ) : (
            <p>Your downloadable example QR will appear when the public site address is configured.</p>
          )}
        </div>
      </section>

      <section className="bv-section bv-split">
        <div>
          <p className="bv-eyebrow">Booking</p>
          <h2>How a booking prompt could look</h2>
          <p>A partner can add a clear call to book directly with them. BioVeracity does not take bookings or payments — the button below is a demonstration only.</p>
        </div>
        <aside className="bv-preview-card">
          <span>DEMONSTRATION · NOT A REAL BOOKING</span>
          <h3>Plan your visit</h3>
          <p>No live dates, availability or payment are shown here. A real partner links this to their own booking system or contact page.</p>
          <button type="button" className="bv-button bv-green" disabled aria-disabled="true">Check availability (example only)</button>
        </aside>
      </section>

      <section className="bv-section">
        <h2>Make this experience yours.</h2>
        <p>Your content. Your place. Your Wild County. We prepare everything with you — there is nothing to build on your own.</p>
        <Link className="bv-button bv-green" href="/wild/partners#enquire">Contact us for pricing</Link>
      </section>
    </PublicShell>
  )
}
