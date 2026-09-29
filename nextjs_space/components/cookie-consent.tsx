'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const CONSENT_STORAGE_KEY = 'bv-cookie-consent'
const STORAGE_KEY = CONSENT_STORAGE_KEY

export type CookieConsentPlacement = 'fixed' | 'inline'

/** Routes that render their own in-flow consent slot, so the global fixed banner stays off (globalBanner false). */
export function isGlobalBannerRoute(pathname: string | null | undefined): boolean {
  return !(pathname ?? '').startsWith('/place/')
}

/**
 * Site-wide cookie & privacy consent banner.
 * Appears for every visitor who has not yet responded, and stays hidden
 * once a choice ('accepted' | 'necessary') has been recorded in localStorage.
 * localStorage is read only after mount, so SSR output stays deterministic
 * (no hydration mismatch).
 * placement 'fixed' (default, app/layout.tsx) is the global bottom banner and is
 * suppressed on routes with their own slot; 'inline' renders in document flow.
 * The inline notice IS server-rendered, so its space is reserved from first
 * paint (no layout shift). A visitor who has already chosen has the slot hidden
 * before paint by the host page (html[data-bv-consent]), and it unmounts after
 * hydration. Removal after a click follows user input, so it is not a shift.
 */
export function CookieConsent({ placement = 'fixed' }: { placement?: CookieConsentPlacement } = {}) {
  const pathname = usePathname()
  // null = not yet determined (during SSR / before mount) -> render nothing.
  const inline = placement === 'inline'
  const [visible, setVisible] = useState(inline)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      setVisible(!stored)
    } catch {
      // If storage is unavailable, still show the notice.
      setVisible(true)
    }
  }, [])

  const record = (choice: 'accepted' | 'necessary') => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
      document.documentElement.setAttribute('data-bv-consent', '1')
    } catch {
      // Non-fatal: dismiss for this session even if we cannot persist.
    }
    setVisible(false)
  }

  if (inline) {
    if (!visible) return null
    return (
      <div role="region" aria-label="Cookie and privacy notice" data-consent-placement="inline" className="rounded-2xl border border-[#E4DED0] bg-white p-4 shadow-[0_8px_24px_rgba(28,42,34,0.08)]">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-[12rem] flex-1 text-[15px] leading-snug text-[#1C2A22]">
            <span className="font-semibold">Essential cookies only</span> unless you allow analytics.{' '}
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center font-medium text-[#1E5B3F] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B0246A]">
              Privacy notice
            </Link>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => record('necessary')} aria-label="Essential cookies only" data-consent-choice="necessary"
              className="min-h-[44px] min-w-[44px] rounded-full border border-[#C9C1AE] bg-white px-5 text-[15px] font-semibold text-[#1C2A22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B0246A]">
              Essential
            </button>
            <button type="button" onClick={() => record('accepted')} aria-label="Allow analytics cookies" data-consent-choice="accepted"
              className="min-h-[44px] min-w-[44px] rounded-full bg-[#1E5B3F] px-5 text-[15px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B0246A]">
              Allow
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (!mounted || !visible) return null
  if (placement === 'fixed' && !isGlobalBannerRoute(pathname)) return null

  return (
    <div
      role={placement === 'fixed' ? 'dialog' : 'region'}
      aria-live="polite"
      aria-label="Cookie and privacy notice"
      data-consent-placement={placement}
      className={placement === 'fixed' ? 'fixed inset-x-0 bottom-0 z-[1000] px-4 pb-4 sm:px-6' : 'pt-4'}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-xl border border-border bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-foreground">
            <Cookie className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We use essential cookies to make BioVeracity work, and optional cookies to
            understand how the platform is used so we can improve it. See our{' '}
            <Link
              href="/privacy"
              className="font-medium text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2"
            >
              Privacy notice
            </Link>{' '}
            for details.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => record('necessary')}
            className="flex-1 sm:flex-none"
          >
            Necessary only
          </Button>
          <Button
            size="sm"
            onClick={() => record('accepted')}
            className="flex-1 sm:flex-none"
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  )
}
