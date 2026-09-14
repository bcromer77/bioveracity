import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/wild/public-shell'
import { CountyNature } from '@/components/wild/county-nature'
import { getWildCounty, WILD_COUNTIES } from '@/lib/wild-counties/counties'
export function generateStaticParams() { return WILD_COUNTIES.map(({slug}) => ({county:slug})) }
export async function generateMetadata({params}:{params:Promise<{county:string}>}):Promise<Metadata> {
 const county=getWildCounty((await params).county)
 return county ? {title:county.brandName+' | BioVeracity',description:'Explore API-sourced county biodiversity records inside BioVeracity.'} : {}
}
export default async function WildCountyPage({params}:{params:Promise<{county:string}>}) {
 const county=getWildCounty((await params).county);if(!county)notFound()
 return <PublicShell>
  <section className="bv-hero"><Link href="/wild">All Wild Counties</Link><p className="bv-eyebrow">{county.province} · {county.jurisdiction}</p><h1>{county.brandName}</h1><p className="bv-intro">Discover the wider story through recorded wildlife, with its source and date kept in view.</p></section>
  <section className="bv-section"><CountyNature county={county.slug}/></section>
  <section className="bv-section bv-tinted"><h2>Your place in this Wild County</h2><p>Your story, seasonal discoveries and a QR code that starts at your door.</p><Link href="/wild/studio" className="bv-button bv-green">Create your ecology hub</Link></section>
 </PublicShell>
}
