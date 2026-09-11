import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UniversalSearch } from '@/components/search/universal-search'

const TRY_LINKS = [
  { label: 'River Blackwater', q: 'River Blackwater' },
  { label: 'Lough Neagh', q: 'Lough Neagh' },
  { label: 'Port of Cork', q: 'Port of Cork' },
]

// The landing hero. Keeps the BioVeracity identity and the “What happened here?”
// headline, adds a plain-English subheading and two primary actions, and keeps
// the public place search positioned as a useful example rather than the whole
// product. `openHref` points signed-in visitors to their workspace and signed-out
// visitors to sign-in.
export function LandingHero({ openHref }: { openHref: string }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[820px] px-4 py-16 text-center md:py-24">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          What happened here?
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-foreground/80">
          Bring planning records, environmental data and your own documents into one
          source-linked chronology—so you can see what changed, what is disputed and
          what still needs review.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
          <Button asChild>
            <Link href={openHref}>Open BioVeracity</Link>
          </Button>
        </div>

        <div className="mx-auto mt-14 max-w-2xl rounded-lg border border-border bg-card p-5 text-left shadow-sm">
          <p className="text-sm font-medium text-foreground">Try the public place search</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick example of the public record. The full case tools open once you sign in.
          </p>
          <div className="mt-4">
            <UniversalSearch size="large" showSubmitButton />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
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
        </div>
      </div>
    </section>
  )
}
