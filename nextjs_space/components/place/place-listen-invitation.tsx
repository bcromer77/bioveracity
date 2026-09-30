// Restrained invitation to private listening (PILOT-001, decision P-4: exact copy).
// Server component, Place-neutral: the only Place-specific value is the route path,
// which arrives as data. Rendered only when the server has confirmed that listening
// is enabled for this Place. It reads no listening data.

import Link from 'next/link'
import { card, editorial, eyebrow, focusRing, section } from './place-arrive-styles'

export function PlaceListenInvitation({ href }: { href: string }) {
  return (
    <section id="listen" aria-labelledby="listen-title" className={section} data-place-listen-invitation="">
      <div className={`${card} p-6 md:p-8`}>
        <h2 id="listen-title" className={eyebrow}>LISTEN TO THIS PLACE</h2>
        <p className={`${editorial} mt-3 text-[22px] leading-snug text-[color:var(--pl-ink)] md:text-[26px]`}>Spend five quiet minutes here and begin your own listening history.</p>
        <p className="mt-2 text-[16px] leading-relaxed text-[color:var(--pl-ink)]">Return over time and notice what changes.</p>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">Your observations remain private and are not part of the public evidence record.</p>
        <p className="mt-5">
          <Link href={href} prefetch={false} className={`inline-flex min-h-[48px] items-center rounded-full bg-[color:var(--pl-green-deep)] px-6 text-[15px] font-semibold tracking-[0.06em] text-white hover:bg-[color:var(--pl-green)] ${focusRing}`}>BEGIN A FIVE-MINUTE LISTEN</Link>
        </p>
      </div>
    </section>
  )
}
