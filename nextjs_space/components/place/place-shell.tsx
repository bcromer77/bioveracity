// Universal Place shell (Place Experience PR D; Gate F X1 ARRIVE layout).
// Server component with no handlers of its own. Layout wrapper only: tokens,
// skip link, header (desktop section nav at lg), in-flow consent slot, mobile
// navigation (hidden at lg), main and footer. The ARRIVE content is rendered by
// PlaceArrive from a PlaceShellView built from the PR C public DTOs.
// Place-neutral: every Place-specific word arrives as data.

import type { PlaceShellView } from '@/lib/place/shell-view'
import Link from 'next/link'
import { CookieConsent } from '@/components/cookie-consent'
import { HashLink, SheetKeys } from '@/components/place-client/hash-link'
import { BioVeracityPlaceMark } from './place-mark'
import { PlaceMobileNav } from './place-mobile-nav'
import { placeTokenStyle } from './place-tokens'
import { PlaceArrive } from './place-arrive'
import { PLACE_ARRIVE_CSS, focusRing, target44 } from './place-arrive-styles'

export { PlaceStateBadge } from './place-arrive'

const DESKTOP_SECTIONS = [
  { href: '#explore', label: 'Explore' },
  { href: '#species', label: 'Species' },
  { href: '#evidence', label: 'Public record' },
  { href: '#how-we-know', label: 'How we know' },
  { href: '#place-menu', label: 'Menu' },
] as const

export function PlaceShell({ view }: { view: PlaceShellView }) {
  return (
    <div style={placeTokenStyle} className="pa min-h-screen pb-28 font-sans lg:pb-0" data-place-shell="v1">
      <style dangerouslySetInnerHTML={{ __html: PLACE_ARRIVE_CSS }} />
      <Link href="#place-main" className={`sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[color:var(--pl-paper)] focus:px-4 focus:py-3 ${focusRing}`}>
        Skip to place content
      </Link>
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 pt-5 md:px-8">
        <Link href="/" className={`${target44} gap-2`}>
          <BioVeracityPlaceMark size={28} />
          <span className="text-[17px] font-semibold tracking-tight text-[color:var(--pl-green-deep)]">BioVeracity</span>
        </Link>
        <nav aria-label="Place sections" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {DESKTOP_SECTIONS.map((s) => (
              <li key={s.href}><HashLink href={s.href} className={`${target44} px-3 text-[14px] font-medium hover:bg-[color:var(--pl-green-soft)]`}>{s.label}</HashLink></li>
            ))}
          </ul>
        </nav>
        <span className="text-[12px] font-medium text-[color:var(--pl-muted)] lg:hidden">Free to explore · no account needed</span>
      </header>
      {/* In-flow consent slot: the global fixed banner is off on /place/* (globalBanner false). */}
      <div className="mx-auto max-w-5xl px-5 md:px-8" data-place-consent-slot="">
        <CookieConsent placement="inline" />
      </div>
      <PlaceMobileNav />
      <SheetKeys />

      <main id="place-main" tabIndex={-1} className="focus:outline-none">
        <PlaceArrive view={view} />
      </main>

      <footer className="bg-[color:var(--pl-green-deep)] text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="inline-flex items-center gap-2 text-[15px] font-semibold"><BioVeracityPlaceMark tone="white" size={22} /> BioVeracity</p>
          <p className="text-[13px] text-white/85">Evidence first. Unknowns stay visible.</p>
        </div>
      </footer>
    </div>
  )
}
