'use client'

import { useMemo, useState } from 'react'
import { PlaceCard } from '@/components/search/place-card'
import { CategoryChips, categoryLabel } from '@/components/category-chips'
import type { PlaceResult } from '@/lib/search'

export function SearchResults({ places, query }: { places: PlaceResult[]; query: string }) {
  const [category, setCategory] = useState('all')

  const present = useMemo(() => {
    const set = new Set<string>()
    for (const p of places) for (const c of p.categories ?? []) set.add(c)
    return Array.from(set)
  }, [places])

  const filtered = useMemo(
    () => (category === 'all' ? places : places.filter((p) => (p.categories ?? []).includes(category))),
    [places, category],
  )

  return (
    <div>
      {present.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-secondary/40 p-4">
          <CategoryChips present={present} selected={category} onSelect={setCategory} />
        </div>
      )}

      <div className="mb-4 text-[15px] text-muted-foreground">
        {query ? (
          <p>
            <span className="font-semibold text-foreground">{filtered.length}</span> place{filtered.length === 1 ? '' : 's'} for{' '}
            <span className="font-semibold text-foreground">“{query}”</span>
            {category !== 'all' ? <> · {categoryLabel(category)}</> : null}
          </p>
        ) : (
          <p>
            {category === 'all'
              ? 'Every place currently in the record'
              : `Places with ${categoryLabel(category).toLowerCase()} evidence`}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-8 text-center">
          <p className="text-[16px] text-muted-foreground">
            BioVeracity has not located {categoryLabel(category).toLowerCase()} evidence among these places in the public sources reviewed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </div>
  )
}
