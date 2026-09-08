'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'bv-cookie-consent'

/**
 * Site-wide cookie & privacy consent banner.
 * Appears for every visitor who has not yet responded, and stays hidden
 * once a choice ('accepted' | 'necessary') has been recorded in localStorage.
 * localStorage is read only after mount, so SSR output stays deterministic
 * (no hydration mismatch).
 */
export function CookieConsent() {
  // null = not yet determined (during SSR / before mount) -> render nothing.
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      // If storage is unavailable, still show the notice.
      setVisible(true)
    }
  }, [])

  const record = (choice: 'accepted' | 'necessary') => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // Non-fatal: dismiss for this session even if we cannot persist.
    }
    setVisible(false)
  }

  if (!mounted || !visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie and privacy notice"
      className="fixed inset-x-0 bottom-0 z-[1000] px-4 pb-4 sm:px-6"
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
