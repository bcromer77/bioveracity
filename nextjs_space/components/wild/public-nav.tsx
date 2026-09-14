'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { PublicAccount } from './public-account'

const LINKS = [
  { href: '/wild/partners', label: 'For businesses & places' },
  { href: '/professionals', label: 'For professionals' },
  { href: '/wild', label: 'Wild Counties' },
]

export function PublicNav() {
  const [open, setOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    // Move focus into the newly opened menu for keyboard users.
    navRef.current?.querySelector<HTMLElement>('a,button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="bv-nav-wrap">
      <button
        ref={btnRef}
        type="button"
        className="bv-nav-toggle"
        aria-expanded={open}
        aria-controls="bv-main-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>
      {open && <button type="button" className="bv-nav-backdrop" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />}
      <nav id="bv-main-nav" ref={navRef} aria-label="Main navigation" className={open ? 'bv-nav is-open' : 'bv-nav'}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
        ))}
        <PublicAccount />
      </nav>
    </div>
  )
}
