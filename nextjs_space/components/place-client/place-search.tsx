// Place Menu search (Gate F X1). A plain GET form to the site search page:
// no handler, no POST, no server action. It only builds a /search?q= URL.

import { focusRing, target44 } from '@/components/place/place-arrive-styles'

export function PlaceSearch() {
  return (
    <form action="/search" method="get" role="search" aria-label="Search BioVeracity" className="mt-5 flex gap-2">
      <label htmlFor="place-search-q" className="sr-only">Search places and records</label>
      <input id="place-search-q" name="q" type="search" placeholder="Search places and records" className={`min-h-[44px] flex-1 rounded-lg border-2 border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] px-3 text-[16px] ${focusRing}`} />
      <button type="submit" className={`${target44} bg-[color:var(--pl-green-deep)] px-4 text-[15px] font-semibold text-white`} data-place-search="get">Search</button>
    </form>
  )
}
