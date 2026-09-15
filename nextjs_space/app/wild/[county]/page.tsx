import { EvidenceLink } from '@/components/evidence-link'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/wild/public-shell'
import { CountyNature } from '@/components/wild/county-nature'
import { getWildCounty, WILD_COUNTIES } from '@/lib/wild-counties/counties'
export function generateStaticParams() { return WILD_COUNTIES.map(({slug}) => ({county:slug})) }
export async function generateMetadata({params}:{params:Promise<{county:string}>}):Promise<Metadata> {
 const county=getWildCounty((await params).county)
 return county ? {title:county.brandName+' | BioVeracity',description:county.jurisdiction === 'England' ? 'Twelve sourced nature stories and places to explore across Cambridgeshire and Peterborough.' : 'Explore API-sourced county biodiversity records inside BioVeracity.'} : {}
}
export default async function WildCountyPage({params}:{params:Promise<{county:string}>}) {
 const county=getWildCounty((await params).county);if(!county)notFound()
 return <PublicShell>
  <section className="bv-hero"><Link href="/wild">All Wild Counties</Link><p className="bv-eyebrow">{county.province} · {county.jurisdiction}</p><h1>{county.brandName}</h1><p className="bv-intro">Discover the wider story through recorded wildlife, with its source and date kept in view.</p></section>
  {county.jurisdiction === 'England' ? <section className="bv-section">
   <h2>Places and their connections</h2>
   <p>Source pages checked 15 September 2026. Seasonal descriptions are not current sightings. Check the manager’s latest access information before travelling. These places are not listed as BioVeracity partners.</p>
   <nav aria-label="Places in this collection" className="my-6 flex flex-wrap gap-4">{county.topics.map(topic => <Link key={topic.slug} href={`#${topic.slug}`} className="underline">{topic.title}</Link>)}</nav>
   {county.topics.map(topic => <article key={topic.slug} id={topic.slug} className="border-t border-current/20 py-8 scroll-mt-24">
    <p className="bv-eyebrow">{topic.locality}</p><h3 className="text-2xl font-semibold">{topic.title}</h3>
    <p className="mt-3">{topic.summary}</p>
    <p className="mt-3"><strong>Seasonal interest: </strong>{topic.season}</p>
    <p className="mt-3"><strong>Planning a visit: </strong>{topic.access}</p>
    <p className="mt-3 text-sm"><EvidenceLink href={topic.sourceUrl}>{topic.publisher} source reference</EvidenceLink> · Section: {topic.sourceLocator} · Checked {topic.checkedAt}. Publication date not established.</p>
    <p className="mt-3 text-sm">{topic.caveat}</p>
    <p className="mt-4"><strong>Follow the connection: </strong>{topic.connectionNote}</p>
    <div className="mt-2 flex gap-4">{topic.relatedSlugs?.map(slug => <Link key={slug} className="underline" href={`#${slug}`}>{county.topics.find(item => item.slug === slug)?.title}</Link>)}</div>
   </article>)}
   <p className="mt-6">Connections are editorial suggestions, not surveyed routes, travel-time estimates or proof of ecological effects between sites.</p>
   <Link className="underline" href="/regions/cambridgeshire-peterborough">Explore the separate regional environmental evidence collection</Link>
  </section> : <section className="bv-section"><CountyNature county={county.slug}/></section>}
  <section className="bv-section bv-tinted"><h2>Your place in this Wild County</h2><p>Your story, seasonal discoveries and a QR code that starts at your door.</p><Link href="/wild/studio" className="bv-button bv-green">Create your ecology hub</Link></section>
 </PublicShell>
}
