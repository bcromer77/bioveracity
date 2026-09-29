// Place Menu search (Gate F X1; Place-scoped in PR F). A plain GET form: no
// handler, no POST, no server action. On a Place it builds
// /place/<slug>?q=...#place-search, which the Place page answers server-side
// from its own public records and opens the results sheet with :target.
// Elsewhere it falls back to the site search page (/search?q=).

import { focusRing, target44 } from '@/components/place/place-arrive-styles'

export function PlaceSearch({ path, defaultValue }: { path?: string | null; defaultValue?: string }) {
  const action = path ? `${path}#place-search` : '/search'
  return (
    <form action={action} method="get" role="search" aria-label={path ? 'Search this place' : 'Search BioVeracity'} className="mt-5 flex gap-2">
      <label htmlFor="place-search-q" className="sr-only">{path ? 'Search the public record for this place' : 'Search places and records'}</label>
      <input id="place-search-q" name="q" type="search" maxLength={300} defaultValue={defaultValue} placeholder={path ? 'Search species, habitats, records' : 'Search places and records'} className={`min-h-[44px] min-w-0 flex-1 rounded-lg border-2 border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] px-3 text-[16px] ${focusRing}`} />
      <button type="submit" className={`${target44} bg-[color:var(--pl-green-deep)] px-4 text-[15px] font-semibold text-white`} data-place-search="get">Search</button>
    </form>
  )
}
