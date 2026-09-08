import Link from 'next/link'
import { SafeDate } from '@/components/safe-format'

export function RecentlyChanged({ events }: { events: any[] }) {
  if (!events?.length) return null
  return (
    <section>
      <div className="mx-auto max-w-[760px] px-4 py-12">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recently updated
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {events.map((e: any) => (
            <li key={e.id} className="py-4">
              <Link
                href={`/asset/${e?.asset?.slug ?? ''}`}
                className="group block"
              >
                <p className="text-[17px] font-semibold text-foreground">
                  {e?.asset?.name ?? ''}
                </p>
                <p className="mt-0.5 text-[15px] text-muted-foreground">
                  New environmental record ·{' '}
                  <SafeDate date={e?.date} options={{ dateStyle: 'long' }} />
                </p>
                <span className="mt-1 inline-block text-[15px] text-[hsl(var(--link))] underline underline-offset-2 group-hover:decoration-2">
                  View timeline →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
