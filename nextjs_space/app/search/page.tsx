import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { UniversalSearch } from '@/components/search/universal-search'
import { SearchResults } from '@/components/search/search-results'
import { EvidenceLegend } from '@/components/evidence-badge'
import { searchPlaces } from '@/lib/search'
import { SearchX, MapPin, ArrowRight, Anchor } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const results = await searchPlaces(query, 30)
  const showsRegion = /cambridgeshire|peterborough|cambs|river cam|\bcam\b|nene|anglian/i.test(query)
  const showsIrishPorts =
    /irish port|irish ports|\bports?\b|dublin port|port of cork|ringaskiddy|shannon|foynes|rosslare|europort|waterford|belview|dredg|offshore renewable|\bore\b/i.test(
      query,
    )

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-4 py-6 md:py-8">
          <div className="mb-6">
            <UniversalSearch size="large" initialValue={query} />
          </div>

          {showsIrishPorts && (
            <div className="mb-6 overflow-hidden rounded-xl border-2 border-accent bg-accent/[0.06]">
              <div className="flex items-start gap-3 p-5">
                <Anchor className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Irish ports</p>
                  <p className="mt-0.5 text-[18px] font-bold text-foreground">Maritime environmental evidence picture</p>
                  <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                    Explore ports, projects, permits, environmental evidence and material changes through one
                    source-backed operating picture.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/regions/irish-ports"
                      className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-foreground transition hover:brightness-95"
                    >
                      Explore Irish ports <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/regions/irish-ports/live"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 text-[14px] font-semibold text-foreground transition hover:border-accent"
                    >
                      Open regional operating picture
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showsRegion && (
            <Link
              href="/regions/cambridgeshire-peterborough"
              className="mb-6 flex items-start gap-3 rounded-lg border-2 border-accent bg-accent/10 p-4 transition hover:bg-accent/20"
            >
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span className="flex-1">
                <span className="block text-[16px] font-semibold text-foreground">
                  Cambridgeshire &amp; Peterborough — view the regional evidence picture
                </span>
                <span className="mt-0.5 block text-[14px] text-muted-foreground">
                  What is happening across the region&rsquo;s rivers, wastewater assets and projects, assembled from the public record.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            </Link>
          )}

          {results.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-10 text-center">
              <SearchX className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-[17px] font-semibold text-foreground">No place matches “{query}” yet</p>
              <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
                The record is still being built. If you have a live problem at a specific place, you can bring it to us and we will assemble the evidence.
              </p>
              <Link
                href="/lead"
                className="mt-4 inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-[15px] font-semibold text-accent-foreground hover:brightness-95"
              >
                Bring us this place
              </Link>
            </div>
          ) : (
            <SearchResults places={results} query={query} />
          )}

          <div className="mt-8 rounded-lg border border-border bg-secondary/40 p-4">
            <p className="mb-2 text-[14px] font-semibold text-foreground">How to read the evidence</p>
            <EvidenceLegend />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
