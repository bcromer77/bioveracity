'use client'

import Link from 'next/link'
import { UniversalSearch } from '@/components/search/universal-search'

const TRY_LINKS = [
  { label: 'River Blackwater', q: 'River Blackwater' },
  { label: 'Lough Neagh', q: 'Lough Neagh' },
  { label: 'Port of Cork', q: 'Port of Cork' },
]

export function SearchHero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[760px] px-4 py-16 text-center md:py-24">
        <h1 className="mb-8 font-display text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          What happened here?
        </h1>

        <div className="mx-auto max-w-2xl">
          <UniversalSearch size="large" showSubmitButton />
        </div>

        <p className="mt-4 text-[15px] text-muted-foreground">
          Try{' '}
          {TRY_LINKS.map((t, i) => (
            <span key={t.q}>
              <Link
                href={`/search?q=${encodeURIComponent(t.q)}`}
                className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2"
              >
                {t.label}
              </Link>
              {i < TRY_LINKS.length - 1 ? (i === TRY_LINKS.length - 2 ? ' or ' : ', ') : ''}
            </span>
          ))}
        </p>

        <p className="mx-auto mt-10 max-w-xl text-[17px] leading-relaxed text-foreground/80">
          BioVeracity brings environmental records together so you can see what happened,
          when it changed and where the evidence comes from.
        </p>
      </div>
    </section>
  )
}
