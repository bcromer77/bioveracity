// Universal Place shell (Place Experience PR D; Gate F X1 ARRIVE layout).
// Server component with no handlers of its own. Layout wrapper only: tokens,
// skip link, header (desktop section nav at lg), in-flow consent slot, mobile
// navigation (hidden at lg), main and footer. The ARRIVE content is rendered by
// PlaceArrive from a PlaceShellView built from the PR C public DTOs.
// Place-neutral: every Place-specific word arrives as data.

import type { PlaceSearchResult, PlaceShellView } from '@/lib/place/shell-view'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { CookieConsent } from '@/components/cookie-consent'
import { HashLink, SheetKeys } from '@/components/place-client/hash-link'
import { BioVeracityPlaceMark } from './place-mark'
import { PlaceMobileNav } from './place-mobile-nav'
import { placeTokenStyle } from './place-tokens'
import { PlaceArrive } from './place-arrive'
import type { PlaceNotice } from './place-notice-invitation'
import { PLACE_ARRIVE_CSS, focusRing, target44 } from './place-arrive-styles'

export { PlaceStateBadge } from './place-arrive'

// Journey order: EXPLORE -> MAP -> TIME -> SPECIES -> EVIDENCE.
const DESKTOP_SECTIONS = [
  { href: '#explore', label: 'Explore' },
  { href: '#map', label: 'Map' },
  { href: '#time', label: 'Time' },
  { href: '#species', label: 'Species' },
  { href: '#evidence', label: 'Evidence' },
] as const

// Runs during parsing, before the consent slot paints: a visitor who has already
// chosen gets the slot hidden up front, so neither first nor returning visits shift.
// The key is a literal (must equal CONSENT_STORAGE_KEY): importing a value from the
// 'use client' consent module into this server file yields a client reference, not the string.
export const PLACE_CONSENT_PREPAINT = `try{if(localStorage.getItem('bv-cookie-consent'))document.documentElement.setAttribute('data-bv-consent','1')}catch(e){}`

/**
 * `children` replaces ARRIVE on a Place object page (PR F species journey):
 * the header turns solid and section links return to the Place page.
 */
export function PlaceShell({ view, search, children, invitation, notice }: { view: PlaceShellView; search?: PlaceSearchResult | null; children?: ReactNode; invitation?: ReactNode; notice?: PlaceNotice | null }) {
  const base = children ? view.path : null
  return (
    <div style={placeTokenStyle} className="pa relative min-h-screen pb-28 font-sans lg:pb-0" data-place-shell="v1">
      <style dangerouslySetInnerHTML={{ __html: PLACE_ARRIVE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: PLACE_CONSENT_PREPAINT }} />
      <Link href="#place-main" className={`sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[color:var(--pl-paper)] focus:px-4 focus:py-3 ${focusRing}`}>
        Skip to place content
      </Link>
      <header className={children ? 'relative z-20 bg-[color:var(--pl-green-deep)] text-white' : 'absolute inset-x-0 top-0 z-20 text-white md:static md:bg-[color:var(--pl-green-deep)] lg:absolute lg:bg-transparent'}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-8 lg:py-5">
          <Link href="/" prefetch={false} className={`${target44} gap-2`}>
            <BioVeracityPlaceMark tone="white" size={28} />
            <span className="text-[19px] font-semibold tracking-tight">BioVeracity</span>
          </Link>
          <nav aria-label="Place sections" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {DESKTOP_SECTIONS.map((s) => (
                <li key={s.href}>{base ? <Link href={`${base}${s.href}`} prefetch={false} className={`${target44} px-3 text-[16px] font-medium hover:bg-white/10`}>{s.label}</Link> : <HashLink href={s.href} className={`${target44} px-3 text-[16px] font-medium hover:bg-[#12251C]/60`}>{s.label}</HashLink>}</li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <PlaceMobileNav base={base} noticeHref={notice?.href ?? null} />
      <SheetKeys />

      <main id="place-main" tabIndex={-1} className="focus:outline-none">
        {children ?? <PlaceArrive
          view={view}
          search={search}
          invitation={invitation}
          notice={notice}
          consent={
            // Reserved, server-rendered, in-flow consent slot (the global fixed banner is off on /place/*).
            <div className="pa-consent mt-5" data-place-consent-slot="">
              <CookieConsent placement="inline" />
            </div>
          }
        />}
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
