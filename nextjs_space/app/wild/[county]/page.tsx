import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, MapPin } from 'lucide-react'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getWildCounty, WILD_COUNTIES } from '@/lib/wild-counties/counties'

export function generateStaticParams() {
  return WILD_COUNTIES.map(({ slug }) => ({ county: slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ county: string }> }): Promise<Metadata> {
  const { county: slug } = await params
  const county = getWildCounty(slug)
  if (!county) return {}
  return {
    title: `${county.brandName} | BioVeracity`,
    description: `Explore source-linked nature and visitor places across ${county.name}.`,
  }
}

export default async function WildCountyPage({ params }: { params: Promise<{ county: string }> }) {
  const { county: slug } = await params
  const county = getWildCounty(slug)
  if (!county) notFound()

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f2e9] text-[#18332a]">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-[#173d35] px-5 py-14 text-white md:py-20">
          <div className="mx-auto max-w-[1050px]">
            <Link href="/wild" className="text-sm font-semibold text-[#e0c86e]">← All Wild Counties</Link>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#e0c86e]">{county.province} · {county.jurisdiction}</p>
            <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.04em] sm:text-7xl">{county.brandName}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#dfe9e4]">Discover the county through evidence-linked wildlife, landscapes and useful places along the way.</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1050px] px-5 py-12">
          {county.topics.length ? (
            <>
              <h2 className="font-display text-3xl font-semibold">Explore reviewed starting points</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {county.topics.map((topic) => (
                  <article key={topic.slug} className="rounded-md border border-[#d8d3c4] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="rounded-full bg-[#e4efe8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#24573f]">{topic.evidenceScope}</span>
                      <span className="text-xs text-[#6d756f]">Source reviewed</span>
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-semibold">{topic.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#4f5d56]">{topic.summary}</p>
                    {topic.caveat && <p className="mt-4 border-l-2 border-[#d2bd6a] pl-3 text-xs leading-5 text-[#6b654f]">{topic.caveat}</p>}
                    <a href={topic.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#176251] underline underline-offset-4">Open the source <ExternalLink className="h-3.5 w-3.5" /></a>
                  </article>
                ))}
              </div>

              <div className="mt-12">
                <h2 className="font-display text-3xl font-semibold">Possible places along the way</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c6962]">These are public business candidates for a future pilot. They are not confirmed BioVeracity partners, approved listings or evidence of environmental performance.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {county.businessCandidates.map((business) => (
                    <a key={business.slug} href={business.sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[#d8d3c4] bg-white p-5 hover:border-[#8ea697]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7a704a]">Pilot candidate · no partnership implied</span>
                      <h3 className="mt-2 font-display text-xl font-semibold">{business.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-[#65716b]"><MapPin className="h-3.5 w-3.5" /> {business.locality} · {business.category}</p>
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-[#bbb6a8] bg-white p-10 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#7a704a]">County registered · evidence not yet curated</span>
              <h2 className="mt-3 font-display text-3xl font-semibold">This Wild County is waiting for its first reviewed story.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#617069]">The page exists in the architecture, but BioVeracity will not invent species, places, partners or completeness while the evidence collection is still planned.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

