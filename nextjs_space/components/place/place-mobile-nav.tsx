import Link from 'next/link'
import type { ReactNode } from 'react'
import { HashLink } from '@/components/place-client/hash-link'

// Place navigation (PR D). Mobile-first bottom bar: Home | Explore | + | Species | Menu.
// Managed links only (HashLink on the Place page so :target sheets open; next/link
// back to the Place from an object page), fully keyboard reachable, 44px+ targets. The
// central + is a truthful, disabled control: it is not inside a form, has no
// handler and cannot submit anything. Contributions are not open.

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pl-fuchsia)]'
const item = `flex min-h-[56px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-1 text-[12px] font-medium text-[color:var(--pl-ink)] hover:bg-[color:var(--pl-green-soft)] motion-safe:transition-colors ${focus}`

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  explore: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
  species: 'M5 19c0-8 6-13 14-14-1 8-6 14-14 14Zm0 0 7-7',
  menu: 'M4 7h16M4 12h16M4 17h16',
}

export const PLACE_CONTRIBUTE_STATUS = 'Not open yet'

function Section({ base, hash, children }: { base?: string | null; hash: `#${string}`; children: ReactNode }) {
  return base ? <Link href={`${base}${hash}`} prefetch={false} className={item}>{children}</Link> : <HashLink href={hash} className={item}>{children}</HashLink>
}

// PILOT-001 NE demo: when the observation pilot is enabled for this Place the + becomes
// a link to the private observation flow; otherwise the inert control is unchanged.
export function PlaceMobileNav({ base, noticeHref }: { base?: string | null; noticeHref?: string | null } = {}) {
  return (
    <nav
      aria-label="Place navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:bottom-auto md:border-b md:border-t-0 lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5 items-center px-2 py-1">
        <li><Link href="/" prefetch={false} className={item}><Icon d={ICONS.home} /><span>Home</span></Link></li>
        <li><Section base={base} hash="#explore"><Icon d={ICONS.explore} /><span>Explore</span></Section></li>
        {noticeHref ? <li className="flex flex-col items-center justify-center gap-0.5">
          <Link href={noticeHref} prefetch={false} className={`flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--pl-green-deep)] text-white ${focus}`} data-place-contribute="notice" aria-describedby="place-contribute-status">
            <span aria-hidden="true" className="text-2xl leading-none">+</span>
            <span className="sr-only">Make an observation</span>
          </Link>
          <span id="place-contribute-status" className="text-[11px] font-medium text-[color:var(--pl-ink)]">Notice</span>
        </li> : <li className="flex flex-col items-center justify-center gap-0.5">
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-describedby="place-contribute-status"
            className="flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full border-2 border-dashed border-[color:var(--pl-muted)] bg-[color:var(--pl-warm)] text-[color:var(--pl-muted)]"
            data-place-contribute="inert"
          >
            <span aria-hidden="true" className="text-2xl leading-none">+</span>
            <span className="sr-only">Add to this place</span>
          </button>
          <span id="place-contribute-status" className="text-[11px] font-medium text-[color:var(--pl-muted)]">{PLACE_CONTRIBUTE_STATUS}</span>
        </li>}
        <li><Section base={base} hash="#species"><Icon d={ICONS.species} /><span>Species</span></Section></li>
        <li><Section base={base} hash="#place-menu"><Icon d={ICONS.menu} /><span>Menu</span></Section></li>
      </ul>
    </nav>
  )
}
