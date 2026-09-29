'use client'

// Hash navigation for the Place ARRIVE screen's CSS :target sheets.
// After hydration, next/link performs same-page hash changes through
// history.pushState, which does NOT update the CSS :target pseudo-class, so a
// sheet would not open or close. HashLink keeps the managed next/link <a> (works
// without JavaScript, native :target) and, once hydrated, assigns
// window.location.hash itself so :target re-evaluates. It also moves focus into
// an opened sheet and returns focus to the opener when the sheet closes.
// It never fetches, posts or navigates off the page.

import Link from 'next/link'
import { useEffect, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

let lastOpener: HTMLElement | null = null

type HashLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: `#${string}`
  children: ReactNode
  /** Closing link inside a sheet: focus returns to the control that opened it. */
  close?: boolean
}

export function goToHash(href: string, opts: { close?: boolean; opener?: HTMLElement | null } = {}) {
  const id = href.slice(1)
  if (!id) return
  if (window.location.hash !== href) window.location.hash = id
  const target = document.getElementById(id)
  if (opts.close) {
    const back = lastOpener && document.contains(lastOpener) ? lastOpener : target
    lastOpener = null
    back?.focus({ preventScroll: true })
    return
  }
  if (target?.hasAttribute('data-pa-sheet')) lastOpener = opts.opener ?? null
  target?.focus({ preventScroll: target.hasAttribute('data-pa-sheet') })
}

export function HashLink({ href, close, children, ...rest }: HashLinkProps) {
  function handle(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    goToHash(href, { close, opener: event.currentTarget })
  }
  return (
    <Link href={href} scroll={false} {...rest} {...(close ? { 'data-pa-close': '' } : {})} onClick={handle}>
      {children}
    </Link>
  )
}

/** Escape closes the open sheet; Tab stays inside it while it is open. Renders nothing. */
export function SheetKeys() {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const id = window.location.hash.slice(1)
      const sheet = id ? document.getElementById(id) : null
      if (!sheet?.hasAttribute('data-pa-sheet')) return
      if (event.key === 'Escape') {
        const closer = sheet.querySelector<HTMLAnchorElement>('[data-pa-close]')
        event.preventDefault()
        goToHash(closer?.getAttribute('href') ?? '#place-main', { close: true })
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, input, [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === sheet)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (active === last || !sheet.contains(active))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return null
}
