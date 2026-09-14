import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/wild/public-shell'
import { CountyNature } from '@/components/wild/county-nature'
import { CountyMap } from '@/components/wild/county-map'
import { EvidenceLink } from '@/components/evidence-link'
import { getWildCounty, WILD_COUNTIES } from '@/lib/wild-counties/counties'
import { venueIdForCounty } from '@/lib/wild-counties/venues'

const SCOPE_LABEL: Record<string, string> = {
  county: 'County record',
  regional: 'Regional context',
  'national-context': 'National context',
}

export function generateStaticParams() {
  return WILD_COUNTIES.map(({ slug }) => ({ county: slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ county: string }> }): Promise<Metadata> {
  const county = getWildCounty((await params).county)
  return county
    ? {
        title: county.brandName + ' | BioVeracity',
        description: `Explore ${county.brandName}: source-backed nature stories, a discovery map and live biodiversity records, each with its source and the date it was checked in view.`,
      }
    : {}
}

export default async function WildCountyPage({ params }: { params: Promise<{ county: string }> }) {
  const county = getWildCounty((await params).county)
  if (!county) notFound()
  const venueId = venueIdForCounty(county.slug)
  const stories = county.topics

  return (
    <PublicShell>
      <section className="bv-hero">
        <Link href="/wild" className="bv-text-link">← All Wild Counties</Link>
        <p className="bv-eyebrow">{county.province} · {county.jurisdiction}</p>
        <h1>{county.brandName}</h1>
        {county.intro && <p className="bv-intro">{county.intro}</p>}
      </section>

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
