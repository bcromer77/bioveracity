'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { PUBLIC_NAV_LINKS } from '@/lib/public-navigation'
import { PublicAccount } from './public-account'

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
    navRef.current?.querySelector<HTMLElement>('a,button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="bv-nav-wrap">
      <button ref={btnRef} type="button" className="bv-nav-toggle" aria-expanded={open} aria-controls="bv-main-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>
      {open && <button type="button" className="bv-nav-backdrop" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />}
      <nav id="bv-main-nav" ref={navRef} aria-label="Main navigation" className={open ? 'bv-nav is-open' : 'bv-nav'}>
        {PUBLIC_NAV_LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
        <PublicAccount />
      </nav>
    </div>
  )
}
