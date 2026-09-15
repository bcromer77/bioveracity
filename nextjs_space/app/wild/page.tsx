import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { searchWildCounties } from '@/lib/wild-counties/counties'

export const metadata: Metadata = {
  title: 'Wild Counties | BioVeracity',
  description: 'Discover wildlife, seasonal stories and places to explore across Ireland and Cambridgeshire & Peterborough.',
}

export default async function WildCountiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const counties = searchWildCounties(q)

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f2e9] text-[#18332a]">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-[#173d35] px-5 py-14 text-white md:py-20">
          <div className="mx-auto max-w-[1100px]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e0c86e]">Powered by BioVeracity</p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Find the wild story in every county.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#dfe9e4]">A wood worth wandering through. A flower worth stopping for. Start with a county and see what catches your curiosity.</p>
            <Link href="/wild/partners" className="mt-6 inline-block rounded bg-[#dfc27a] px-5 py-3 font-semibold text-[#173d35]">Run a venue? Discover the Wild community →</Link>
            <form className="mt-8 flex max-w-2xl overflow-hidden rounded-md bg-white p-1.5 shadow-xl" action="/wild">
              <Search className="ml-3 mt-3 h-5 w-5 text-[#65736d]" aria-hidden="true" />
              <label className="sr-only" htmlFor="wild-search">Search Wild Counties</label>
              <input id="wild-search" name="q" defaultValue={q} placeholder="Try snowdrops, Cambridgeshire or Kilkenny" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[#17231e] outline-none" />
              <button className="rounded bg-[#e0c86e] px-5 py-2.5 text-sm font-bold text-[#17231e]">Search</button>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-5 py-10 md:py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f744f]">Explore Wild Counties</p>
              <h2 className="mt-2 font-display text-3xl font-semibold">{q ? `Results for “${q}”` : 'Choose a county'}</h2>
            </div>
            <p className="text-sm text-[#637069]">{counties.length} result{counties.length === 1 ? '' : 's'}</p>
          </div>

          {counties.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {counties.map((county) => (
                <Link key={county.slug} href={`/wild/${county.slug}`} className="group rounded-md border border-[#d8d3c4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#8ea697] hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold">{county.brandName}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${county.status === 'foundation' ? 'bg-[#e4efe8] text-[#24573f]' : 'bg-[#efede6] text-[#6a706c]'}`}>{county.jurisdiction === 'England' ? `${county.topics.length} places to explore` : county.jurisdiction === 'Ireland' ? 'Wildlife records' : 'Taking shape'}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#66716b]">{county.province} · {county.jurisdiction}</p>
                  <p className="mt-4 text-sm font-semibold text-[#24573f]">{county.jurisdiction === 'England' ? 'Explore nature stories and visits' : county.jurisdiction === 'Ireland' ? 'Look closer at local wildlife' : 'See what is available so far'} →</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[#bbb6a8] bg-white p-10 text-center">
              <h3 className="font-display text-2xl font-semibold">No matching place or topic</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66716b]">Try a county, place or topic such as snowdrops. We’re still adding places, so a blank search needn’t mean a dull destination.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

