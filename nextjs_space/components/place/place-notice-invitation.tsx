import Link from 'next/link'
import { editorial, focusRing } from './place-arrive-styles'

// PILOT-001 NE demo. Replaces the inert "not open yet" card only when the server-only
// observation flags are on and this Place has observation enabled (config, never data).
// Place-neutral. Observations are private and unverified; nothing is published.
export type PlaceNotice = { href: string }

export function PlaceNoticeInvitation({ notice }: { notice: PlaceNotice }) {
  return (
    <article className="rounded-2xl border-2 border-[color:var(--pl-gold)] bg-[color:var(--pl-paper)] p-5" data-contribute="notice">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-gold-text)]">Notice this place</h2>
      <p className={`${editorial} mt-1 text-[22px] leading-snug text-[color:var(--pl-ink)]`}>What have you seen, heard or noticed?</p>
      <Link href={notice.href} prefetch={false} className={`mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[color:var(--pl-green-deep)] px-5 text-[16px] font-semibold text-white hover:bg-[color:var(--pl-green)] ${focusRing}`}>
        Make an observation <span aria-hidden="true" className="ml-1.5">→</span>
      </Link>
      <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--pl-muted)]">Private to you and unverified. It never changes the public record.</p>
    </article>
  )
}
