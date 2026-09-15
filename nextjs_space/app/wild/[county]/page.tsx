import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/wild/public-shell'
import { CountyNature } from '@/components/wild/county-nature'
import { CountyMap } from '@/components/wild/county-map'
import { EvidenceLink } from '@/components/evidence-link'
import { RegionalSearch } from '@/components/wild/regional-search'
import { loadSnapshot } from '@/lib/cambridgeshire/server'
import { getWildCounty, WILD_COUNTIES } from '@/lib/wild-counties/counties'
import { venueIdForCounty } from '@/lib/wild-counties/venues'

const SCOPE_LABEL: Record<string, string> = {
  county: 'County record',
  regional: 'Regional context',
  'national-context': 'National context',
}

// Pick up atomically refreshed public snapshots without a redeployment.
export const revalidate = 300

export function generateStaticParams() {
  return WILD_COUNTIES.map(({ slug }) => ({ county: slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ county: string }> }): Promise<Metadata> {
  const county = getWildCounty((await params).county)
  if (!county) return {}
  return {
    title: county.brandName + ' | BioVeracity',
    description:
      county.jurisdiction === 'England'
        ? `Search sourced wildlife, seasonal displays and visitor places across ${county.brandName.replace(/^Wild /, '')}, each with its source and the date it was checked in view.`
        : `Explore ${county.brandName}: source-backed nature stories, a discovery map and live biodiversity records, each with its source and the date it was checked in view.`,
  }
}

export default async function WildCountyPage({ params }: { params: Promise<{ county: string }> }) {
  const county = getWildCounty((await params).county)
  if (!county) notFound()

  const isEngland = county.jurisdiction === 'England'
  const regional = isEngland ? await loadSnapshot() : null
  const venueId = venueIdForCounty(county.slug)
  const stories = county.topics

  return (
    <PublicShell>
      <section className="bv-hero">
        <Link href="/wild" className="bv-text-link">← All Wild Counties</Link>
        <p className="bv-eyebrow">{county.province} · {county.jurisdiction}</p>
        <h1>{county.brandName}</h1>
        {county.intro ? (
          <p className="bv-intro">{county.intro}</p>
        ) : isEngland ? (
          <p className="bv-intro">Search sourced wildlife records and explore visitor places across Cambridgeshire and Peterborough, with each source and the date it was checked kept in view.</p>
        ) : null}
      </section>

      {isEngland ? (
        <>
          {regional && <RegionalSearch snapshot={regional.snapshot} status={regional.status} />}

          <section className="bv-section">
            <p className="bv-eyebrow">Places and their connections</p>
            <h2>Places worth noticing</h2>
            <p>Source pages checked 15 September 2026. Seasonal descriptions are drawn from the cited pages and are not current sightings. Check the manager&rsquo;s latest access information before travelling. These places are not listed as BioVeracity partners.</p>
            <nav aria-label="Places in this collection" className="my-6 flex flex-wrap gap-4">
              {county.topics.map((topic) => (
                <Link key={topic.slug} href={`#${topic.slug}`} className="bv-text-link">{topic.title}</Link>
              ))}
            </nav>
            <ol className="bv-discoveries">
              {county.topics.map((topic, index) => (
                <li key={topic.slug} id={topic.slug} className="bv-discovery scroll-mt-24">
                  <span className="bv-discovery-num" aria-hidden="true">{index + 1}</span>
                  <div className="bv-discovery-body">
                    <div className="bv-discovery-head">
                      <h3>{topic.title}</h3>
                      {topic.locality && <span className="bv-badge">{topic.locality}</span>}
                    </div>
                    <p>{topic.summary}</p>
                    {topic.season && <p className="bv-season-note"><strong>Seasonal interest:</strong> {topic.season}</p>}
                    {topic.access && <p className="bv-small"><strong>Planning a visit:</strong> {topic.access}</p>}
                    <p className="bv-small">
                      <EvidenceLink href={topic.sourceUrl}>{topic.publisher} source reference</EvidenceLink>
                      {topic.sourceLocator && <> · Section: {topic.sourceLocator}</>}
                      {topic.checkedAt && <> · Checked {topic.checkedAt}</>}
                      {' '}· Publication date not established.
                    </p>
                    {topic.caveat && <p className="bv-small">{topic.caveat}</p>}
                    {topic.connectionNote && <p><strong>Follow the connection:</strong> {topic.connectionNote}</p>}
                    {topic.relatedSlugs && topic.relatedSlugs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-4">
                        {topic.relatedSlugs.map((slug) => (
                          <Link key={slug} className="bv-text-link" href={`#${slug}`}>{county.topics.find((item) => item.slug === slug)?.title ?? slug}</Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="bv-small">Connections are editorial suggestions, not surveyed routes, travel-time estimates or proof of ecological effects between sites.</p>
            <p className="mt-4"><Link className="bv-text-link" href="/regions/cambridgeshire-peterborough">Explore the separate regional environmental evidence collection →</Link></p>
          </section>
        </>
      ) : (
        <>
          {stories.length > 0 && (
            <section className="bv-section">
              <p className="bv-eyebrow">Discovery map</p>
              <h2>Where these stories live</h2>
              <p>Approximate public localities — towns, landmarks and designated areas — numbered to match the stories below. Sensitive or precise wildlife locations are never shown.</p>
              <CountyMap topics={stories} countyName={county.brandName} />
            </section>
          )}

          {stories.length > 0 && (
            <section className="bv-section bv-tinted">
              <p className="bv-eyebrow">{stories.length} source-backed stories</p>
              <h2>Reasons to look closer</h2>
              <p>Each story is reviewed against a named public source, with the date we last checked the link. These are reasons to notice a place — not a promise of a sighting or a right to enter private land.</p>
              <ol className="bv-discoveries">
                {stories.map((topic, index) => (
                  <li key={topic.slug} id={topic.slug} className="bv-discovery">
                    <span className="bv-discovery-num" aria-hidden="true">{index + 1}</span>
                    <div className="bv-discovery-body">
                      <div className="bv-discovery-head">
                        <h3>{topic.title}</h3>
                        <span className="bv-badge">{SCOPE_LABEL[topic.evidenceScope] ?? 'Context'}</span>
                      </div>
                      {topic.place && <p className="bv-small">Locality: {topic.place}</p>}
                      <p>{topic.summary}</p>
                      {topic.season && (
                        <p className="bv-season-note"><strong>When to look:</strong> {topic.season}</p>
                      )}
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
          )}

          <section className="bv-section">
            <CountyNature county={county.slug} />
          </section>
        </>
      )}

      <section className="bv-section bv-tinted">
        <h2>Bring a place in {county.brandName} to life</h2>
        {venueId ? (
          <p>
            See how a place here could tell its nature story — with a discovery guide, seasonal features and its own QR signage.{' '}
            <Link href={`/wild/places/${venueId}`} className="bv-text-link">View the example experience →</Link>
          </p>
        ) : (
          <p>See how a place here could tell its nature story — with a discovery guide, seasonal features and its own QR signage.</p>
        )}
        <p>Founding partners are welcomed through a short, guided conversation — we prepare everything with you, so there is nothing to build on your own.</p>
        <div className="bv-actions">
          <Link href="/wild/partners#enquire" className="bv-button bv-green">Enquire about a founding partnership</Link>
          <Link href="/wild/partners" className="bv-text-link">Explore the business experience</Link>
        </div>
      </section>
    </PublicShell>
  )
}
